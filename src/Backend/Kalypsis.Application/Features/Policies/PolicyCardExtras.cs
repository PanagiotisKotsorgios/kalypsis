using System.Globalization;
using System.Reflection;
using System.Text.Json.Nodes;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Features.Policies;

/// <summary>Lossless adapters for the common desktop/web policy card. Never replaces carrier JSON.</summary>
public static class PolicyCardExtras
{
    public static readonly IReadOnlyDictionary<string,(string? Property,string Kind)> Fields=new Dictionary<string,(string?,string)>
    {
        ["brand"]=(null,"text"),["model"]=(null,"text"),["year"]=(null,"integer"),["engineCapacity"]=(null,"integer"),
        ["characteristic"]=(nameof(Policy.Characteristic),"text"),["insuredAgeAtIssue"]=(nameof(Policy.InsuredAgeAtIssue),"integer"),
        ["contractPartyAgeAtIssue"]=(nameof(Policy.ContractPartyAgeAtIssue),"integer"),["medicalExamsNotes"]=(nameof(Policy.MedicalExamsNotes),"multiline"),
        ["reassessmentCode"]=(null,"text"),["position"]=(nameof(Policy.Position),"text"),["lineOfBusiness"]=(null,"text"),["useCode"]=(nameof(Policy.CarrierUseCode),"text"),
        ["branchId"]=(null,"guid"),["supplierOfficeId"]=(null,"guid"),["groupPolicyId"]=(null,"guid"),["collectionCentreCode"]=(null,"text"),["policyGroupCode"]=(null,"text"),["hardCopyStatusCode"]=(null,"text"),
        ["officeReceivedAt"]=(nameof(Policy.OfficeReceivedAt),"date"),["handoverDate"]=(nameof(Policy.HandoverDate),"date"),["nextRenewalUiDate"]=(null,"date"),
        ["commissionReferenceDate"]=(null,"date"),["commissionPolicyYear"]=(null,"integer"),["paidOnCredit"]=(nameof(Policy.PaidOnCredit),"boolean"),
        ["paymentPromisedOn"]=(nameof(Policy.PaymentPromisedOn),"date"),["creditReason"]=(nameof(Policy.CreditReason),"text"),["notes"]=(nameof(Policy.Notes),"multiline")
    };
    public static void Read(Policy policy,JsonObject profile,Dictionary<string,string> values,JsonObject root)
    {
        var vehicle=root["vehicle"] as JsonObject??root;
        foreach(var (key,definition) in Fields){var value=definition.Property is string name?typeof(Policy).GetProperty(name)!.GetValue(policy):null;
            var raw=value switch{DateOnly date=>date.ToString("yyyy-MM-dd"),bool b=>b?"true":"false",null=>profile["card:"+key]?.ToString()??"",_=>Convert.ToString(value,CultureInfo.InvariantCulture)??""};
            if(definition.Property==null&&key is "brand" or "model" or "year" or "engineCapacity")raw=vehicle[key=="brand"?"make":key]?.ToString()??raw;
            values["card:"+key]=raw;
        }
    }
    public static Action Prepare(Policy policy,IReadOnlyDictionary<string,string> changes,JsonObject profile,JsonObject root)
    {
        var updates=new List<(PropertyInfo Property,object? Value)>();
        foreach(var (rawKey,raw) in changes){if(raw is null)throw AppException.Validation("Δεν δόθηκε τιμή πεδίου.");var key=rawKey[5..];if(!Fields.TryGetValue(key,out var definition))throw AppException.Validation("Μη υποστηριζόμενο πεδίο συμβολαίου.");var value=raw.Trim();if(value.Length>(definition.Kind=="multiline"?20000:500))throw AppException.Validation("Το περιεχόμενο του πεδίου είναι πολύ μεγάλο.");
            object? parsed=value.Length==0?null:value;
            if(value.Length>0)switch(definition.Kind){case "date":if(!DateOnly.TryParseExact(value,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out var date))throw AppException.Validation("Συμπληρώστε έγκυρη ημερομηνία.");parsed=date;break;
            case "integer":if(!int.TryParse(value,NumberStyles.None,CultureInfo.InvariantCulture,out var number)||number<0||key=="commissionPolicyYear"&&number<1||key=="year"&&number is <1886 or >2200||key.Contains("AgeAtIssue")&&number>130)throw AppException.Validation("Συμπληρώστε έγκυρο ακέραιο εντός ορίων.");parsed=number;break;
            case "guid":if(!Guid.TryParse(value,out var id)||id==Guid.Empty)throw AppException.Validation("Επιλέξτε έγκυρη συσχέτιση.");break;
            case "boolean":if(value is not("true" or "false"))throw AppException.Validation("Επιλέξτε Ναι ή Όχι.");parsed=value=="true";break;}
            if(definition.Property is string name){var property=typeof(Policy).GetProperty(name)!;if(parsed==null&&property.PropertyType==typeof(bool))throw AppException.Validation("Επιλέξτε Ναι ή Όχι.");updates.Add((property,parsed));}
            else if(key is "brand" or "model" or "year" or "engineCapacity"){var vehicle=root["vehicle"] as JsonObject??root;vehicle[key=="brand"?"make":key]=value.Length==0?null:JsonValue.Create(value);}
            else profile[rawKey]=value.Length==0?null:JsonValue.Create(value);
        }
        return ()=>{foreach(var (property,value) in updates)property.SetValue(policy,value);};
    }
}
