using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Policies;

/// <summary>Partial edits preserve carrier JSON. Medical data never enters SpecsJson.</summary>
public static class PolicyRiskProfile
{
    private const string ProfileKey = "_kalypsisPolicyProfile";
    public static readonly string[] VehicleKeys = ["make", "model", "year", "vin", "engineCapacity", "taxableHorsepower"];
    public static readonly string[] PropertyKeys = ["address", "areaSqm", "constructionYear", "constructionType", "alarm", "securityDoor"];
    public static readonly string[] HealthKeys = ["medicalHistory", "heightCm", "weightKg", "smoker", "occupationRisk", "exclusions"];
    public static readonly string[] TaxKeys = ["vatAmount", "stampDutyAmount", "insuranceContributionAmount", "otherChargesAmount"];
    public record Beneficiary(Guid Id, string Name, string? Relationship, decimal? Share);

    private static JsonObject Object(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        try { return JsonNode.Parse(raw) as JsonObject ?? throw new JsonException(); }
        catch (JsonException) { throw AppException.Validation("Τα αποθηκευμένα στοιχεία δεν είναι έγκυρα. Δεν τροποποιήθηκαν."); }
    }
    private static string Text(JsonNode? value) => value is JsonValue scalar ? scalar.ToString() : "";
    private static JsonObject Medical(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new();
        try
        {
            var parsed = JsonNode.Parse(raw) as JsonObject;
            if (parsed?["schema"]?.ToString() == "kalypsis-health-1" && parsed["fields"] is JsonObject fields) return (JsonObject)fields.DeepClone();
        }
        catch (JsonException) { }
        // Preserve pre-existing free-text examination notes on the first structured edit.
        return new() { ["medicalHistory"] = raw };
    }
    public static Dictionary<string, string> Read(Policy policy)
    {
        var root = Object(policy.SpecsJson);
        var profile = root[ProfileKey] as JsonObject ?? new();
        var values = profile.ToDictionary(pair => pair.Key, pair => Text(pair.Value));
        var vehicle = root["vehicle"] as JsonObject ?? root;
        foreach (var key in VehicleKeys) values["vehicle:" + key] = Text(vehicle[key] ?? root[key]);
        if (policy.PolicyType is PolicyType.Health or PolicyType.Life)
        {
            var medical = Medical(policy.MedicalExamsNotes);
            foreach (var key in HealthKeys) values["health:" + key] = Text(medical[key]);
        }
        values["vatAmount"] = policy.VatAmount?.ToString(CultureInfo.InvariantCulture) ?? "";
        values["stampDutyAmount"] = policy.StampDutyAmount?.ToString(CultureInfo.InvariantCulture) ?? "";
        values["insuranceContributionAmount"] = policy.InsuranceContributionAmount?.ToString(CultureInfo.InvariantCulture) ?? "";
        values["otherChargesAmount"] = policy.OtherChargesAmount?.ToString(CultureInfo.InvariantCulture) ?? "";
        return values;
    }
    public static void Apply(Policy policy, IReadOnlyDictionary<string, string> changes, ISet<Guid> ownCoverIds)
    {
        if (changes.Count is < 1 or > 100) throw AppException.Validation("Επιλέξτε από 1 έως 100 πεδία.");
        var root = Object(policy.SpecsJson);
        var profile = root[ProfileKey] as JsonObject ?? new();
        var medical = Medical(policy.MedicalExamsNotes);
        var taxes = new Dictionary<string, decimal?>();
        var medicalChanged = false;
        var specsChanged = false;
        foreach (var (key, raw) in changes)
        {
            if (raw is null || raw.Length > 20_000) throw AppException.Validation("Το περιεχόμενο του πεδίου είναι πολύ μεγάλο.");
            var value = raw.Trim();
            var vehicleKey = key.StartsWith("vehicle:") ? key[8..] : "";
            var healthKey = key.StartsWith("health:") ? key[7..] : "";
            if (TaxKeys.Contains(key)) taxes[key] = Number(value, 0, 1_000_000_000);
            else if (VehicleKeys.Contains(vehicleKey) && policy.PolicyType == PolicyType.Auto)
            {
                if (vehicleKey == "year") Number(value, 1886, 2200, integer: true);
                if (vehicleKey is "engineCapacity" or "taxableHorsepower") Number(value, 0, 100_000);
                if (vehicleKey == "vin" && value.Length > 30) throw AppException.Validation("Ο αριθμός πλαισίου είναι πολύ μεγάλος.");
                var vehicle = root["vehicle"] as JsonObject ?? root;
                vehicle[vehicleKey] = value.Length == 0 ? null : value;
                specsChanged = true;
            }
            else if (HealthKeys.Contains(healthKey) && policy.PolicyType is PolicyType.Health or PolicyType.Life)
            {
                if (healthKey == "heightCm") Number(value, 20, 300);
                if (healthKey == "weightKg") Number(value, 1, 600);
                if (healthKey == "smoker" && value is not ("" or "true" or "false")) throw AppException.Validation("Επιλέξτε Ναι ή Όχι.");
                medical[healthKey] = value.Length == 0 ? null : value;
                medicalChanged = true;
            }
            else if (key.StartsWith("property:") && PropertyKeys.Contains(key[9..]) && policy.PolicyType is PolicyType.Home or PolicyType.Business)
            {
                if (key == "property:areaSqm") Number(value, 0, 10_000_000);
                if (key == "property:constructionYear") Number(value, 1000, 2200, integer: true);
                if (key is "property:alarm" or "property:securityDoor" && value is not ("" or "true" or "false")) throw AppException.Validation("Επιλέξτε Ναι ή Όχι.");
                profile[key] = value.Length == 0 ? null : value;
                specsChanged = true;
            }
            else if (key == "beneficiaries")
            {
                Beneficiary[] rows;
                try { rows = JsonSerializer.Deserialize<Beneficiary[]>(value, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? []; }
                catch (JsonException) { throw AppException.Validation("Μη έγκυρη λίστα δικαιούχων."); }
                if (rows.Length > 50 || rows.Any(row => row is null) || rows.Select(row => row.Id).Distinct().Count() != rows.Length
                    || rows.Any(row => row.Id == Guid.Empty || string.IsNullOrWhiteSpace(row.Name) || row.Name.Length > 200
                        || row.Relationship?.Length > 200 || row.Share is < 0 or > 100) || rows.Sum(row => row.Share ?? 0) > 100)
                    throw AppException.Validation("Ελέγξτε τα ονόματα και τα ποσοστά των δικαιούχων (σύνολο έως 100%).");
                profile[key] = JsonSerializer.Serialize(rows.Select(row => row with { Name = row.Name.Trim(), Relationship = row.Relationship?.Trim() }), new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                specsChanged = true;
            }
            else if (key.StartsWith("coverDeductible:") && Guid.TryParse(key[16..], out var coverId) && ownCoverIds.Contains(coverId))
            {
                Number(value, 0, 1_000_000_000);
                profile[key] = value.Length == 0 ? null : value;
                specsChanged = true;
            }
            else throw AppException.Validation("Μη υποστηριζόμενο πεδίο ή κάλυψη άλλου συμβολαίου.");
        }
        // Commit only after every field has passed validation.
        if (specsChanged) { if (profile.Parent is null) root[ProfileKey] = profile; policy.SpecsJson = root.ToJsonString(); }
        if (medicalChanged) policy.MedicalExamsNotes = new JsonObject { ["schema"] = "kalypsis-health-1", ["fields"] = medical }.ToJsonString();
        foreach (var (key, amount) in taxes)
            switch (key)
            {
                case "vatAmount": policy.VatAmount = amount; break;
                case "stampDutyAmount": policy.StampDutyAmount = amount; break;
                case "insuranceContributionAmount": policy.InsuranceContributionAmount = amount; break;
                case "otherChargesAmount": policy.OtherChargesAmount = amount; break;
            }
    }
    private static decimal? Number(string value, decimal min, decimal max, bool integer = false)
    {
        if (value.Length == 0) return null;
        if (!decimal.TryParse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)
            || amount < min || amount > max || integer && amount != decimal.Truncate(amount))
            throw AppException.Validation("Συμπληρώστε έγκυρο αριθμό εντός των επιτρεπτών ορίων.");
        return amount;
    }
}
