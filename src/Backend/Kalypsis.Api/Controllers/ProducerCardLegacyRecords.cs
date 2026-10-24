using System.Globalization;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
namespace Kalypsis.Api.Controllers;
public sealed partial class ProducerCardController
{
    private const string ContactPrefix="kalypsis:producer-contact:";
    private static string N(object? value)=>Convert.ToString(value,CultureInfo.InvariantCulture)??"";
    private async Task<List<EntryDto>> MergeLegacy(Producer owner,string kind,List<EntryDto> records,CancellationToken ct)
    {
        var indexed=records.ToDictionary(x=>x.Id);
        if(kind=="contacts"){
            var native=await db.CustomFieldValues.AsNoTracking().Include(x=>x.Field).Where(x=>x.EntityType=="Producer"&&x.EntityId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null&&x.Field!=null&&x.Field.TenantId==owner.TenantId&&x.Field.DeletedAt==null&&x.Field.IsActive&&x.Field.HelpText!=null&&x.Field.HelpText.StartsWith(ContactPrefix)).ToListAsync(ct);
            foreach(var row in native){var data=indexed.TryGetValue(row.Id,out var existing)?new(existing.Values):new Dictionary<string,string>();data["label"]=row.Field!.Label;data["kind"]=row.Field.HelpText![ContactPrefix.Length..];data["value"]=row.Value??"";indexed[row.Id]=new(row.Id,kind,data,row.CreatedAt,row.UpdatedAt);}
        }
        if(kind=="rates"){
            var native=await db.ProducerExpectedRates.AsNoTracking().Where(x=>x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null).ToListAsync(ct);
            foreach(var row in native){var data=indexed.TryGetValue(row.Id,out var existing)?new(existing.Values):new Dictionary<string,string>();data["insuranceCompanyId"]=row.InsuranceCompanyId?.ToString()??"";data["lineOfBusiness"]=row.PolicyType?.ToString()??"";data["vehicleUseCategory"]=row.VehicleUseCategory?.ToString()??"";data["expectedPercent"]=N(row.ExpectedPercent);data["notes"]=row.Notes??"";data["effectiveFrom"]=row.EffectiveFrom?.ToString("yyyy-MM-dd")??"";data["effectiveTo"]=row.EffectiveTo?.ToString("yyyy-MM-dd")??"";indexed[row.Id]=new(row.Id,kind,data,row.CreatedAt,row.UpdatedAt);}
        }
        if(kind=="declarations"){
            var native=await db.ProducerCommissionDeclarations.AsNoTracking().Where(x=>x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null).ToListAsync(ct);
            foreach(var row in native){var data=indexed.TryGetValue(row.Id,out var existing)?new(existing.Values):new Dictionary<string,string>();data["policyId"]=row.PolicyId.ToString();data.TryAdd("year",row.DeclaredAt.Year.ToString());data.TryAdd("month",row.DeclaredAt.Month.ToString());data["declaredAmount"]=N(row.ExpectedAmount);data["currency"]=row.Currency;data.TryAdd("status",row.ReconciliationStatus=="match"?"Approved":"Disputed");data["notes"]=row.Notes??"";indexed[row.Id]=new(row.Id,kind,data,row.CreatedAt,row.UpdatedAt);}
        }
        return indexed.Values.OrderByDescending(x=>x.CreatedAt).ToList();
    }
    private async Task<bool> LegacyExists(Producer owner,string kind,Guid id,CancellationToken ct)=>kind switch{
        "rates"=>await db.ProducerExpectedRates.AnyAsync(x=>x.Id==id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct),
        "declarations"=>await db.ProducerCommissionDeclarations.AnyAsync(x=>x.Id==id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct),
        "contacts"=>await db.CustomFieldValues.Include(x=>x.Field).AnyAsync(x=>x.Id==id&&x.EntityType=="Producer"&&x.EntityId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null&&x.Field!=null&&x.Field.HelpText!=null&&x.Field.HelpText.StartsWith(ContactPrefix),ct),_=>false};
    private async Task SaveLegacy(Producer owner,ProducerCardEntry entry,Dictionary<string,string> values,CancellationToken ct)
    {
        string? S(string key)=>values.GetValueOrDefault(key);Guid? G(string key)=>Guid.TryParse(S(key),out var id)?id:null;decimal D(string key)=>decimal.TryParse(S(key),NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var v)?v:0;
        if(entry.Kind=="contacts"){
            var row=await db.CustomFieldValues.Include(x=>x.Field).FirstOrDefaultAsync(x=>x.Id==entry.Id&&x.EntityType=="Producer"&&x.EntityId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct);
            if(row==null){var definition=new CustomFieldDefinition{TenantId=owner.TenantId,AgencyOfficeScopeId=owner.AgencyOfficeScopeId,EntityType="Producer",Code="CONTACT_"+Guid.NewGuid().ToString("N"),Label=S("label")??"",Kind="Text",HelpText=ContactPrefix+(S("kind")??"Text")};row=new CustomFieldValue{Id=entry.Id,TenantId=owner.TenantId,AgencyOfficeScopeId=owner.AgencyOfficeScopeId,EntityType="Producer",EntityId=owner.Id,FieldId=definition.Id,Field=definition};db.CustomFieldDefinitions.Add(definition);db.CustomFieldValues.Add(row);}
            if(row.Field==null||row.Field.TenantId!=owner.TenantId||row.Field.HelpText?.StartsWith(ContactPrefix)!=true)throw AppException.Validation("Το πεδίο επικοινωνίας δεν είναι διαθέσιμο.");
            if((S("label")??"").Length>160)throw AppException.Validation("Ο τίτλος επικοινωνίας πρέπει να είναι έως 160 χαρακτήρες.");row.Field.Label=S("label")??"";row.Field.HelpText=ContactPrefix+(S("kind")??"Text");row.Value=S("value");
        }
        if(entry.Kind=="rates"){
            var row=await db.ProducerExpectedRates.FirstOrDefaultAsync(x=>x.Id==entry.Id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct);if(row==null){row=new ProducerExpectedRate{Id=entry.Id,TenantId=owner.TenantId,ProducerId=owner.Id};db.ProducerExpectedRates.Add(row);}
            var line=S("lineOfBusiness");if(line=="Motor")line="Auto";if(!string.IsNullOrWhiteSpace(line)&&(!Enum.TryParse<PolicyType>(line,out var _)||!Enum.IsDefined(typeof(PolicyType),line)))throw AppException.Validation("Επιλέξτε έγκυρο κλάδο.");
            row.InsuranceCompanyId=G("insuranceCompanyId");row.PolicyType=string.IsNullOrWhiteSpace(line)?null:Enum.Parse<PolicyType>(line);row.VehicleUseCategory=Enum.TryParse<VehicleUseCategory>(S("vehicleUseCategory"),out var use)?use:null;row.ExpectedPercent=D("expectedPercent");row.Notes=S("notes");row.EffectiveFrom=DateOnly.TryParse(S("effectiveFrom"),out var from)?from:null;row.EffectiveTo=DateOnly.TryParse(S("effectiveTo"),out var to)?to:null;if(row.Notes?.Length>1000)throw AppException.Validation("Οι σημειώσεις ποσοστού πρέπει να είναι έως 1000 χαρακτήρες.");
        }
        if(entry.Kind=="declarations"&&G("policyId") is Guid policyId){
            var policy=await db.Policies.FirstOrDefaultAsync(x=>x.Id==policyId&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct)??throw AppException.NotFound("Συμβόλαιο συνεργάτη");
            if(policy.Currency!=(S("currency")??"EUR"))throw AppException.Validation("Το νόμισμα πρέπει να είναι ίδιο με του συμβολαίου.");
            var row=await db.ProducerCommissionDeclarations.IgnoreQueryFilters().FirstOrDefaultAsync(x=>x.Id==entry.Id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId,ct);if(row==null){row=new ProducerCommissionDeclaration{Id=entry.Id,TenantId=owner.TenantId,ProducerId=owner.Id,PolicyId=policyId,DeclaredAt=DateTime.UtcNow};db.ProducerCommissionDeclarations.Add(row);}
            row.DeletedAt=null;row.PolicyId=policyId;row.ExpectedAmount=D("declaredAmount");row.Currency=S("currency")??"EUR";row.Notes=S("notes");row.RecordedAmount=await db.PolicyCommissionSplits.Where(x=>x.PolicyId==policyId&&x.ProducerId==owner.Id&&x.DeletedAt==null).SumAsync(x=>(decimal?)x.GrossAmount,ct)??0;row.DifferenceAmount=row.RecordedAmount-row.ExpectedAmount;row.ReconciliationStatus=row.DifferenceAmount==0?"match":Math.Abs(row.DifferenceAmount??0)<1?"diff_small":"diff_large";
        }
        else if(entry.Kind=="declarations"){
            var prior=await db.ProducerCommissionDeclarations.FirstOrDefaultAsync(x=>x.Id==entry.Id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct);
            if(prior!=null)prior.DeletedAt=DateTime.UtcNow;
        }
    }
    private async Task DeleteLegacy(Producer owner,string kind,Guid id,CancellationToken ct){
        if(kind=="rates"){var row=await db.ProducerExpectedRates.FirstOrDefaultAsync(x=>x.Id==id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId,ct);if(row!=null)row.DeletedAt=DateTime.UtcNow;}
        if(kind=="declarations"){var row=await db.ProducerCommissionDeclarations.FirstOrDefaultAsync(x=>x.Id==id&&x.ProducerId==owner.Id&&x.TenantId==owner.TenantId,ct);if(row!=null)row.DeletedAt=DateTime.UtcNow;}
        if(kind=="contacts"){var row=await db.CustomFieldValues.Include(x=>x.Field).FirstOrDefaultAsync(x=>x.Id==id&&x.EntityType=="Producer"&&x.EntityId==owner.Id&&x.TenantId==owner.TenantId&&x.Field!=null&&x.Field.HelpText!=null&&x.Field.HelpText.StartsWith(ContactPrefix),ct);if(row!=null){row.DeletedAt=DateTime.UtcNow;if(row.Field!=null)row.Field.DeletedAt=DateTime.UtcNow;}}
    }
}
