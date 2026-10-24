using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
namespace Kalypsis.Domain.Entities;
public static class ReceiptDossierRules
{
    public static readonly string[] Keys = ["series","documentType","sourceDocumentNumber","documentIssuedOn","withoutDocument","bankName","instrumentNumber","instrumentDueOn","instrumentAmount","settledOn","receivedBy","collectionCentreCode","deliveryAcknowledgedOn","deliveryAcknowledgedBy"];
    public static Dictionary<string,string?> Read(string? json)=>string.IsNullOrWhiteSpace(json)?new():JsonSerializer.Deserialize<Dictionary<string,string?>>(json)??new();
    public static string Merge(string? json,IReadOnlyDictionary<string,string?> changes)
    {
        var values=Read(json);
        foreach(var pair in changes){if(Array.IndexOf(Keys,pair.Key)<0)throw new FormatException("Άγνωστο πεδίο είσπραξης.");var v=pair.Value?.Trim();if(string.IsNullOrEmpty(v)){values.Remove(pair.Key);continue;}
            if(v.Length>200)throw new FormatException("Το πεδίο δεν μπορεί να υπερβαίνει τους 200 χαρακτήρες.");
            if(pair.Key.EndsWith("On")&&!DateOnly.TryParseExact(v,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out _))throw new FormatException("Η ημερομηνία δεν είναι έγκυρη.");
            if(pair.Key=="instrumentAmount"&&(!decimal.TryParse(v,NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var amount)||amount<0||amount>9999999999.99m||decimal.Round(amount,2)!=amount))throw new FormatException("Το ποσό αξιογράφου πρέπει να είναι θετικό ή μηδέν, με έως δύο δεκαδικά.");
            if(pair.Key=="withoutDocument"&&v is not ("true" or "false"))throw new FormatException("Επιλέξτε Ναι ή Όχι.");
            if(pair.Key=="documentType"&&Array.IndexOf(new[]{"Contract","Renewal","Endorsement","Cancellation","GreenCard","Application","Offer","Instalment","Other"},v)<0)throw new FormatException("Μη έγκυρο είδος παραστατικού.");
            values[pair.Key]=v;
        }
        return JsonSerializer.Serialize(values);
    }
}
