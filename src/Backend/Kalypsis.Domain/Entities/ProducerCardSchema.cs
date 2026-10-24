using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Mail;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace Kalypsis.Domain.Entities;
public sealed record ProducerCardChoice(string Value,string Label);
public sealed record ProducerCardTab(string Key,string Label);
public sealed record ProducerCardField(string Key,string Label,string Section,int Column,string Desktop,string Web,string Kind,ProducerCardChoice[]? Choices);
public sealed record ProducerCardDefinition(int Version,ProducerCardTab[] Tabs,ProducerCardField[] Fields);
public static class ProducerCardSchema
{
    public static ProducerCardDefinition Definition {get;}=Load();
    private static ProducerCardDefinition Load(){var a=typeof(ProducerCardSchema).Assembly;using var s=a.GetManifestResourceStream(a.GetManifestResourceNames().Single(n=>n.EndsWith("producer-card-layout.json")))!;return JsonSerializer.Deserialize<ProducerCardDefinition>(s,new JsonSerializerOptions{PropertyNameCaseInsensitive=true})!;}
    public static JsonObject Root(string? json){if(string.IsNullOrWhiteSpace(json))return new();try{if(JsonNode.Parse(json) is JsonObject root)return root;}catch(JsonException){}return new(){["legacyAdditionalInfo"]=json};}
    public static Dictionary<string,string> Metadata(string? json){var root=Root(json);if(root["producerCard"] is not JsonObject card)return new();return card.ToDictionary(x=>x.Key,x=>x.Value is JsonValue value&&value.TryGetValue<string>(out var str)?str:x.Value?.ToJsonString()??"");}
    public static string Merge(string? json,IReadOnlyDictionary<string,string> changes){var root=Root(json);var card=root["producerCard"] as JsonObject??new JsonObject();foreach(var (k,v) in changes){if(!Definition.Fields.Any(x=>x.Key==k))throw new FormatException("Μη υποστηριζόμενο πεδίο συνεργάτη.");card[k]=v;}if(root["producerCard"]==null)root["producerCard"]=card;return root.ToJsonString();}
    public static Dictionary<string,string> Values(object row,bool desktop)
    {
        var type=row.GetType();var meta=Metadata(type.GetProperty("AdditionalInfoJson")?.GetValue(row) as string);var result=new Dictionary<string,string>();
        foreach(var f in Definition.Fields){var path=desktop?f.Desktop:f.Web;if(path.StartsWith('$')){result[f.Key]=meta.GetValueOrDefault(f.Key)??(f.Key switch{"creditCurrency"=>"EUR","goalPlanEnabled"=>"true","goalTargetMode"=>"Premium","goalLevelCount"=>"4","goalCommissionIncreasePercent"=>"1","goalMaximumCommissionPercent"=>"14",_=>""});continue;}
            if(path=="@Status"){var potential=(bool)(type.GetProperty("IsPotential")!.GetValue(row)??false);var active=(bool)(type.GetProperty("IsActive")!.GetValue(row)??true);var stored=meta.GetValueOrDefault("status");result[f.Key]=potential?"Prospect":active?"Active":stored is "Suspended" or "Terminated"?stored:"Suspended";continue;}
            var value=type.GetProperty(path)?.GetValue(row);result[f.Key]=value switch{null=>"",DateTime d=>d.ToString("yyyy-MM-dd"),DateOnly d=>d.ToString("yyyy-MM-dd"),bool b=>b?"true":"false",_=>Convert.ToString(value,CultureInfo.InvariantCulture)??""};
            if(desktop&&f.Key=="hierarchyLevel")result[f.Key]=result[f.Key] switch{"1"=>"Producer","2"=>"Manager","3"=>"Unit","4"=>"Assistant","5"=>"Agency",_=>result[f.Key]};
            if(f.Key=="paymentMethod")result[f.Key]=result[f.Key] switch{"Transfer"=>"BankTransfer","Notes"=>"PromissoryNote","Check"=>"Cheque",_=>result[f.Key]};
        }
        return result;
    }
    public static string Normalize(ProducerCardField field,string? raw,bool greekDate=false)
    {
        var v=raw?.Trim()??"";if(v=="—")v="";v=field.Choices?.FirstOrDefault(c=>c.Label==v||c.Value==v)?.Value??v;
        var bound=field.Key switch{"email" or "secondaryEmail"=>256,"phone" or "secondaryPhone"=>40,"taxOffice" or "bankName"=>160,"businessType" or "identityNumber" or "paymentMethod"=>80,"professionalCategory" or "contractNumber" or "city" or "professionalLicenseNumber"=>120,"address"=>240,"iban"=>64,_=>int.MaxValue};if(v.Length>bound)throw new FormatException(field.Label+": επιτρέπονται έως "+bound+" χαρακτήρες.");
        if(v.Length>(field.Key=="notes"?2000:field.Kind=="multiline"?10000:field.Key=="code"?64:field.Key=="name"?200:500))throw new FormatException(field.Label+": το περιεχόμενο είναι πολύ μεγάλο.");
        if(v==""){if(field.Key is "code" or "name" or "status" or "hierarchyLevel" or "tier" or "goalLevelCount" or "goalCommissionIncreasePercent" or "goalMaximumCommissionPercent" or "goalTargetMode")throw new FormatException("Συμπληρώστε "+field.Label+".");return v;}
        if(field.Kind=="date"){if(!DateOnly.TryParseExact(v,greekDate?new[]{"yyyy-MM-dd","dd/MM/yyyy","d/M/yyyy"}:new[]{"yyyy-MM-dd"},CultureInfo.InvariantCulture,DateTimeStyles.None,out var date))throw new FormatException(field.Label+": μη έγκυρη ημερομηνία.");v=date.ToString("yyyy-MM-dd");}
        if(field.Kind=="email"&&(!MailAddress.TryCreate(v,out var address)||address.Address!=v||!Regex.IsMatch(v,@"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")))throw new FormatException("Συμπληρώστε έγκυρο email.");
        if(field.Kind=="phone"&&(!Regex.IsMatch(v,@"^\+?[0-9 ()-]+$")||v.Count(char.IsAsciiDigit)<7||v.Count(char.IsAsciiDigit)>15))throw new FormatException("Συμπληρώστε έγκυρο τηλέφωνο, έως 15 ψηφία.");
        if(field.Kind=="vat"&&!Regex.IsMatch(v,@"^[0-9]{9}$"))throw new FormatException("Το ΑΦΜ πρέπει να έχει 9 ψηφία.");
        if(field.Kind=="postal"&&!Regex.IsMatch(v,@"^[0-9A-Za-z -]{3,12}$"))throw new FormatException("Μη έγκυρος ταχυδρομικός κώδικας.");
        if(field.Kind=="url"&&(!Uri.TryCreate(v,UriKind.Absolute,out var url)||url.Scheme is not ("https" or "http")))throw new FormatException("Συμπληρώστε διεύθυνση http:// ή https://.");
        if(field.Kind is "number" or "integer" or "percent"){if(greekDate)v=v.Replace(',','.');if(!decimal.TryParse(v,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var n)||n<0||n>9999999999.99m||field.Kind=="integer"&&(n!=decimal.Truncate(n)||n>int.MaxValue)||field.Kind=="percent"&&n>100||(field.Kind is "number" or "percent")&&decimal.Round(n,2)!=n)throw new FormatException(field.Label+": μη έγκυρη αριθμητική τιμή.");}
        if(field.Kind=="iban"){var compact=v.Replace(" ","").ToUpperInvariant();if(Regex.IsMatch(compact,@"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$")){int rem=0;foreach(var c in compact[4..]+compact[..4]){var text=char.IsAsciiDigit(c)?c.ToString():((int)c-55).ToString(CultureInfo.InvariantCulture);foreach(var n in text)rem=(rem*10+n-'0')%97;}if(rem!=1)throw new FormatException("Μη έγκυρο IBAN.");v=compact;}else if(!Regex.IsMatch(compact,@"^[0-9]{8,30}$"))throw new FormatException("Συμπληρώστε έγκυρο IBAN ή αριθμό τραπεζικού λογαριασμού.");}
        if(field.Kind is "producer" or "category"&&(!Guid.TryParse(v,out var id)||id==Guid.Empty))throw new FormatException("Επιλέξτε "+field.Label+".");
        if(field.Kind=="boolean"&&v is not ("true" or "false"))throw new FormatException("Επιλέξτε Ναι ή Όχι.");
        if(field.Section!=""&&field.Key=="status"&&v is not ("Active" or "Prospect" or "Suspended" or "Terminated"))throw new FormatException("Μη έγκυρη κατάσταση.");
        if(field.Key=="tier"&&v is not ("None" or "A" or "B" or "C" or "D" or "E"))throw new FormatException("Μη έγκυρη βαθμίδα προμηθειών.");
        if(field.Key=="hierarchyLevel"&&v is not ("Producer" or "Manager" or "Unit" or "Assistant" or "Agency"))throw new FormatException("Μη έγκυρο επίπεδο ιεραρχίας.");
        if(field.Choices?.Length>0&&!field.Choices.Any(c=>c.Value==v))throw new FormatException("Επιλέξτε διαθέσιμη τιμή για "+field.Label+".");
        return v;
    }
    public static void Set(object row,ProducerCardField field,string raw,bool desktop)
    {
        var v=Normalize(field,raw,desktop);var path=desktop?field.Desktop:field.Web;var type=row.GetType();
        if(path=="@Status"){type.GetProperty("IsPotential")!.SetValue(row,v=="Prospect");type.GetProperty("IsActive")!.SetValue(row,v is "Active" or "Prospect");var json=type.GetProperty("AdditionalInfoJson")!;json.SetValue(row,Merge(json.GetValue(row) as string,new Dictionary<string,string>{{field.Key,v}}));return;}
        if(path.StartsWith('$')){var json=type.GetProperty("AdditionalInfoJson")!;json.SetValue(row,Merge(json.GetValue(row) as string,new Dictionary<string,string>{{field.Key,v}}));return;}
        var p=type.GetProperty(path)??throw new FormatException("Μη υποστηριζόμενο πεδίο συνεργάτη.");var nullable=Nullable.GetUnderlyingType(p.PropertyType);var t=nullable??p.PropertyType;object? value;
        if(v==""&&nullable!=null)value=null;else if(t==typeof(string))value=v==""?null:v;else if(t==typeof(bool))value=v=="true";else if(t==typeof(Guid))value=Guid.Parse(v);else if(t==typeof(DateTime))value=DateTime.ParseExact(v,"yyyy-MM-dd",CultureInfo.InvariantCulture);else if(t==typeof(DateOnly))value=DateOnly.ParseExact(v,"yyyy-MM-dd",CultureInfo.InvariantCulture);else if(t.IsEnum)value=Enum.Parse(t,v);else if(desktop&&field.Key=="hierarchyLevel")value=v switch{"Producer"=>1,"Manager"=>2,"Unit"=>3,"Assistant"=>4,_=>5};else value=Convert.ChangeType(v,t,CultureInfo.InvariantCulture);
        p.SetValue(row,value);
    }
    public static void ValidateDates(IReadOnlyDictionary<string,string> values){if(int.TryParse(values.GetValueOrDefault("goalLevelCount"),out var levels)&&(levels<1||levels>12)||int.TryParse(values.GetValueOrDefault("goalCountStep"),out var step)&&step<1)throw new FormatException("Τα επίπεδα στόχων πρέπει να είναι 1–12 και το βήμα πλήθους τουλάχιστον 1.");foreach(var (start,end) in new[]{("contractStartDate","contractEndDate"),("registryFrom","licenseExpiryDate"),("professionalLiabilityFrom","professionalLiabilityTo")}){if(DateOnly.TryParse(values.GetValueOrDefault(start),out var a)&&DateOnly.TryParse(values.GetValueOrDefault(end),out var b)&&b<a)throw new FormatException("Η λήξη δεν μπορεί να προηγείται της έναρξης.");}if(DateOnly.TryParse(values.GetValueOrDefault("birthDate"),out var born)&&born>DateOnly.FromDateTime(DateTime.Today))throw new FormatException("Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική.");}
}
