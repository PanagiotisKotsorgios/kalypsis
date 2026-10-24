using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
namespace Kalypsis.Domain.Entities;
public sealed record ProducerEntryField(string Key,string Label,string Kind,bool Required,ProducerCardChoice[]? Choices);
public sealed record ProducerEntryDefinition(string Key,string Label,string Section,ProducerEntryField[] Fields);
public static class ProducerEntrySchema
{
    public static ProducerEntryDefinition[] Definitions {get;}=Load();
    private static ProducerEntryDefinition[] Load(){var a=typeof(ProducerCardSchema).Assembly;using var s=a.GetManifestResourceStream(a.GetManifestResourceNames().Single(n=>n.EndsWith("producer-card-layout.json")))!;using var doc=JsonDocument.Parse(s);return JsonSerializer.Deserialize<ProducerEntryDefinition[]>(doc.RootElement.GetProperty("tables").GetRawText(),new JsonSerializerOptions{PropertyNameCaseInsensitive=true})!;}
    public static Dictionary<string,string> Normalize(string kind,IReadOnlyDictionary<string,string?> incoming,Dictionary<string,string>? existing=null,bool greekDates=false)
    {
        var def=Definitions.SingleOrDefault(x=>x.Key==kind)??throw new FormatException("Μη υποστηριζόμενη κατηγορία εγγραφών.");var result=existing==null?new Dictionary<string,string>():new(existing);
        foreach(var (key,value) in incoming){var f=def.Fields.FirstOrDefault(x=>x.Key==key);if(f==null){if(key=="contentBase64"&&kind=="documents"){var bytes=Convert.FromBase64String(value??"");if(bytes.Length>5*1024*1024)throw new FormatException("Το αρχείο πρέπει να είναι έως 5 MB.");result[key]=value??"";continue;}throw new FormatException("Μη επιτρεπόμενο πεδίο.");}
            if(f.Kind=="secret"){if(value==null){result.Remove(key);continue;}if(!string.IsNullOrEmpty(value)){if(value.Length>300)throw new FormatException("Ο κωδικός είναι πολύ μεγάλος.");result[key]=value;}continue;}
            var descriptor=new ProducerCardField(key,f.Label,"",0,"$"+key,"$"+key,f.Kind is "company" or "office" or "policy"?"producer":f.Kind, f.Choices);result[key]=ProducerCardSchema.Normalize(descriptor,value,greekDates);
        }
        foreach(var f in def.Fields)if(f.Required&&string.IsNullOrWhiteSpace(result.GetValueOrDefault(f.Key)))throw new FormatException("Συμπληρώστε "+f.Label+".");
        if(kind=="rates"&&(result.GetValueOrDefault("notes")?.Length??0)>1000)throw new FormatException("Οι σημειώσεις ποσοστού πρέπει να είναι έως 1000 χαρακτήρες.");
        if(kind=="contacts"&&(result.GetValueOrDefault("label")?.Length??0)>160)throw new FormatException("Ο τίτλος επικοινωνίας πρέπει να είναι έως 160 χαρακτήρες.");
        if(kind=="companies"&&(result.GetValueOrDefault("producerCode")?.Length??0)>100)throw new FormatException("Οι κωδικοί συνεργάτη πρέπει να είναι έως 100 χαρακτήρες.");
        if(kind=="companies"&&string.IsNullOrWhiteSpace(result.GetValueOrDefault("insuranceCompanyId")))throw new FormatException("Επιλέξτε ασφαλιστική εταιρεία.");
        if(DateOnly.TryParse(result.GetValueOrDefault("effectiveFrom"),out var from)&&DateOnly.TryParse(result.GetValueOrDefault("effectiveTo"),out var to)&&to<from)throw new FormatException("Η λήξη προηγείται της έναρξης.");
        if(kind=="declarations"&&(!int.TryParse(result.GetValueOrDefault("month"),out var month)||month<1||month>12||!int.TryParse(result.GetValueOrDefault("year"),out var year)||year<1900||year>2200))throw new FormatException("Ελέγξτε έτος και μήνα.");
        if(result.TryGetValue("currency",out var currency)&&!string.IsNullOrEmpty(currency)){if(currency.Length!=3||!currency.All(char.IsAsciiLetter))throw new FormatException("Συμπληρώστε νόμισμα τριών γραμμάτων.");result["currency"]=currency.ToUpperInvariant();}
        if(kind=="contacts"){var v=result.GetValueOrDefault("value")??"";var t=result.GetValueOrDefault("kind") switch{"Email"=>"email","Phone"=>"phone","Url"=>"url",_=>"text"};ProducerCardSchema.Normalize(new("value","Στοιχείο επικοινωνίας","",0,"$value","$value",t,null),v);}
        return result;
    }
    public static Dictionary<string,string> Read(string? json)=>string.IsNullOrWhiteSpace(json)?new():JsonSerializer.Deserialize<Dictionary<string,string>>(json)??new();
    public static Dictionary<string,string> Public(IReadOnlyDictionary<string,string> values){var result=values.Where(x=>x.Key is not ("quotePassword" or "issuePassword" or "contentBase64")).ToDictionary(x=>x.Key,x=>x.Value);foreach(var key in new[]{"quotePassword","issuePassword","contentBase64"})result["has"+char.ToUpperInvariant(key[0])+key[1..]]=values.TryGetValue(key,out var v)&&!string.IsNullOrEmpty(v)?"true":"false";return result;}
}
