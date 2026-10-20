using System.Text.Json;

namespace Kalypsis.Application.Common;

public record AuditFieldChange(string Field, string Label, string? Before, string? After,
    bool BeforeRecorded, bool AfterRecorded);

/// <summary>Reads persisted snapshots, never the current entity (which may have changed again).</summary>
public static class AuditChangeReader
{
    public static IReadOnlyList<AuditFieldChange> Read(string? oldValues, string? newValues, bool knownFieldsOnly = false, string? entityName = null)
    {
        var before = Parse(oldValues);
        var after = Parse(newValues);
        var changes = new List<AuditFieldChange>();
        foreach (var field in before.Keys.Union(after.Keys))
        {
            if (field is "Id" or "TenantId" or "AgencyOfficeScopeId" or "UpdatedAt" or "CreatedAt" ||
                Sensitive(field) || (knownFieldsOnly && !Labels.ContainsKey(field))) continue;
            var hadBefore = before.TryGetValue(field, out var previous);
            var hasAfter = after.TryGetValue(field, out var next);
            if (hadBefore && hasAfter && previous == next) continue;
            // Never echo redacted secrets, including historical snapshots.
            if (previous == "***" || next == "***") continue;
            changes.Add(new(field, Labels.GetValueOrDefault(field, field), EnumName(entityName, field, previous),
                EnumName(entityName, field, next), hadBefore, hasAfter));
        }
        return changes;
    }

    private static bool Sensitive(string field) => new[] { "password", "token", "secret", "apikey", "hash", "credential" }
        .Any(word => field.Contains(word, StringComparison.OrdinalIgnoreCase));

    private static string? EnumName(string? entityName, string field, string? value)
    {
        var type = typeof(Kalypsis.Domain.Entities.Customer).Assembly.GetType("Kalypsis.Domain.Entities." + entityName)?.GetProperty(field)?.PropertyType;
        if (type is not null) type = Nullable.GetUnderlyingType(type) ?? type;
        return type?.IsEnum == true && long.TryParse(value, out var number) && Enum.IsDefined(type, Enum.ToObject(type, number))
            ? Enum.GetName(type, Enum.ToObject(type, number)) : value;
    }

    private static Dictionary<string, string?> Parse(string? json)
    {
        var result = new Dictionary<string, string?>();
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return result;
            foreach (var p in document.RootElement.EnumerateObject())
                if (p.Value.ValueKind is not (JsonValueKind.Array or JsonValueKind.Object or JsonValueKind.Undefined))
                    result[p.Name] = p.Value.ValueKind == JsonValueKind.Null ? null :
                        p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() : p.Value.GetRawText();
        }
        catch (JsonException) { /* Legacy/custom events may not contain JSON snapshots. */ }
        return result;
    }

    private static readonly Dictionary<string, string> Labels = new()
    {
        ["FirstName"] = "Όνομα", ["LastName"] = "Επώνυμο", ["CompanyName"] = "Επωνυμία",
        ["CustomerNumber"] = "Κωδικός πελάτη", ["Type"] = "Τύπος", ["Status"] = "Κατάσταση",
        ["VatNumber"] = "ΑΦΜ", ["Email"] = "Email", ["Phone"] = "Τηλέφωνο", ["AltPhone"] = "2ο τηλέφωνο",
        ["MobilePhone"] = "Κινητό", ["ThirdPhone"] = "3ο τηλέφωνο", ["SecondaryMobilePhone"] = "2ο κινητό",
        ["SecondaryEmail"] = "2ο email", ["Address"] = "Διεύθυνση", ["City"] = "Πόλη", ["PostalCode"] = "Τ.Κ.",
        ["Region"] = "Περιφέρεια", ["Notes"] = "Σημειώσεις", ["BirthDate"] = "Ημ. γέννησης",
        ["Occupation"] = "Επάγγελμα / κλάδος", ["Employer"] = "Εργοδότης / επιχείρηση", ["TaxOffice"] = "ΔΟΥ",
        ["FatherName"] = "Πατρώνυμο", ["MotherName"] = "Μητρώνυμο", ["SpouseName"] = "Σύζυγος / σύντροφος",
        ["Nationality"] = "Εθνικότητα", ["Zone"] = "Ζώνη", ["ActivityCode"] = "Κωδ. δραστηριότητας",
        ["GemiNumber"] = "ΓΕΜΗ", ["LegalForm"] = "Νομική μορφή", ["Amka"] = "ΑΜΚΑ",
        ["IdNumber"] = "Αριθμός ταυτότητας", ["PassportNumber"] = "Διαβατήριο", ["Gender"] = "Φύλο",
        ["MaritalStatus"] = "Οικογενειακή κατάσταση", ["DriverLicenseNumber"] = "Αριθμός διπλώματος",
        ["DriverLicenseClass"] = "Κατηγορία διπλώματος", ["DriverLicenseIssueDate"] = "Έκδοση διπλώματος",
        ["DriverLicenseExpiryDate"] = "Λήξη διπλώματος", ["Source"] = "Πηγή", ["TagsJson"] = "Ετικέτες",
        ["PhotoUrl"] = "URL φωτογραφίας", ["PaymentDueDate"] = "Ημ. εξόφλησης", ["AssignedAdvisorId"] = "Υπεύθυνος πελάτη",
        ["PolicyNumber"] = "Αριθμός συμβολαίου", ["PolicyType"] = "Κλάδος", ["Premium"] = "Ασφάλιστρο",
        ["StartDate"] = "Έναρξη", ["EndDate"] = "Λήξη", ["Description"] = "Περιγραφή", ["Subject"] = "Θέμα",
        ["Body"] = "Κείμενο", ["Kind"] = "Είδος", ["Direction"] = "Κατεύθυνση", ["Outcome"] = "Αποτέλεσμα",
        ["OccurredAt"] = "Ημερομηνία επικοινωνίας", ["DeletedAt"] = "Διαγραφή", ["Amount"] = "Ποσό",
        ["RelatedPolicyId"] = "Σύνδεση συμβολαίου", ["RelatedPolicyNumber"] = "Συμβόλαιο",
        ["DurationSeconds"] = "Διάρκεια", ["Role"] = "Ιδιότητα", ["IsPrimary"] = "Κύρια επαφή",
        ["Granted"] = "Συγκατάθεση", ["GrantedAt"] = "Χορήγηση συγκατάθεσης", ["RevokedAt"] = "Ανάκληση συγκατάθεσης",
        ["Method"] = "Μέθοδος", ["Version"] = "Έκδοση", ["FileName"] = "Όνομα αρχείου", ["Title"] = "Τίτλος",
        ["DueDate"] = "Προθεσμία", ["CompletedAt"] = "Ολοκλήρωση", ["Priority"] = "Προτεραιότητα",
        ["ClaimNumber"] = "Αριθμός ζημιάς", ["IncidentDate"] = "Ημ. συμβάντος", ["Number"] = "Αριθμός",
        ["CreditNoteNumber"] = "Αριθμός πιστωτικού", ["Currency"] = "Νόμισμα", ["ReasonText"] = "Αιτιολογία",
        ["EndorsementNumber"] = "Αριθμός πρόσθετης πράξης", ["CancellationNumber"] = "Αριθμός ακύρωσης",
        ["EffectiveDate"] = "Ημερομηνία ισχύος", ["PaidAt"] = "Ημερομηνία πληρωμής", ["PaymentMethod"] = "Τρόπος πληρωμής",
    };
}
