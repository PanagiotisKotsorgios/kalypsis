using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kalypsis.VehicleOwnership;

public sealed record OwnershipPerson(Guid Id, Guid? CustomerId, string Name, string VatNumber, decimal? Percentage,
    DateOnly? AcquiredOn = null, string Capacity = "", string Notes = "");
public sealed record OwnershipEvent(Guid Id, string Kind, DateOnly Date, DateTimeOffset RecordedAt, string Reason,
    string Reference, string Notes, OwnershipPerson[] Before, OwnershipPerson[] After,
    Guid BeforePrimaryId, Guid AfterPrimaryId, Guid? FromId = null, Guid? ToId = null,
    decimal? Percentage = null, Guid? ReversesId = null)
{ public string Actor { get; init; } = ""; }
public sealed record OwnershipLedger(int Version, int Revision, Guid PrimaryOwnerId, OwnershipPerson[] Owners, OwnershipEvent[] Events);
public sealed record OwnershipChange(DateOnly Date, string Reason = "", string Reference = "", string Notes = "");
public sealed record OwnershipMutation(int ExpectedRevision, string Operation, OwnershipChange Change,
    OwnershipPerson[]? Owners = null, Guid? PrimaryOwnerId = null, Guid? FromOwnerId = null,
    OwnershipPerson? Recipient = null, decimal? Percentage = null, bool MakePrimary = false);
public sealed class OwnershipException(string message) : Exception(message);

/// <summary>Shared, deterministic rules used by the desktop and web API. No database or UI dependencies.</summary>
public static class OwnershipRules
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public const string SpecsKey = "vehicleOwnershipLedger";
    public static string Serialize(OwnershipLedger ledger) => JsonSerializer.Serialize(ledger, Json);
    public static OwnershipLedger Deserialize(string raw)
    {
        try
        {
            var ledger = JsonSerializer.Deserialize<OwnershipLedger>(raw, Json);
            if (ledger is null || ledger.Version != 1 || ledger.Revision < 0 || ledger.Owners is null || ledger.Events is null
                || ledger.Revision != ledger.Events.Length || !ledger.Owners.Any(p => p.Id == ledger.PrimaryOwnerId)) throw new JsonException();
            return ledger;
        }
        catch (JsonException) { throw new OwnershipException("Το αποθηκευμένο ιστορικό ιδιοκτησίας δεν είναι έγκυρο. Δεν έγινε αλλαγή."); }
    }
    public static OwnershipLedger Legacy(string? specsJson, Guid seed, Guid customerId, string name, string vat, int? countOverride = null)
    {
        var specs = Object(specsJson);
        if (specs[SpecsKey] is JsonNode ledger) return Deserialize(ledger.ToJsonString());
        var count = countOverride ?? (int.TryParse(specs["ownerCount"]?.ToString(), out var n) ? n : 1);
        count = Math.Clamp(count, 1, 100);
        var saved = specs["vehicleOwnership"] as JsonArray;
        var rows = Enumerable.Range(0, count).Select(i =>
        {
            var row = saved?.ElementAtOrDefault(i);
            var id = Guid.TryParse(row?["id"]?.ToString(), out var existing) ? existing : StableId(seed, i);
            var savedName=row?["name"]?.ToString()??"";var savedVat=row?["vatNumber"]?.ToString()??"";
            var matchesCustomer=savedVat.Length>0?savedVat==vat:savedName.Length==0||string.Equals(savedName.Trim(),name.Trim(),StringComparison.OrdinalIgnoreCase);
            var linked = Guid.TryParse(row?["customerId"]?.ToString(), out var link) ? link : i == 0 && matchesCustomer ? customerId : (Guid?)null;
            return new OwnershipPerson(id, linked, row?["name"]?.ToString() ?? (i == 0 ? name : ""),
                row?["vatNumber"]?.ToString() ?? (i == 0 ? vat : ""),
                decimal.TryParse(row?["percentage"]?.ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var share) ? share : null);
        }).ToArray();
        return new(1, 0, rows[0].Id, rows, []);
    }
    public static Guid StableId(Guid seed, int index) => new(SHA256.HashData(Encoding.UTF8.GetBytes(seed.ToString("N") + ":" + index))[..16]);
    public static OwnershipPerson Primary(OwnershipLedger ledger) => ledger.Owners.Single(p => p.Id == ledger.PrimaryOwnerId);
    public static JsonObject Object(string? raw)
    {
        try { return string.IsNullOrWhiteSpace(raw) ? new() : JsonNode.Parse(raw) as JsonObject ?? throw new JsonException(); }
        catch (JsonException) { throw new OwnershipException("Μη έγκυρα στοιχεία οχήματος. Τα παλιά δεδομένα διατηρήθηκαν."); }
    }
    public static string ToSpecs(string? raw, OwnershipLedger ledger)
    {
        var specs = Object(raw);
        specs[SpecsKey] = JsonSerializer.SerializeToNode(ledger, Json);
        specs["ownerCount"] = ledger.Owners.Length;
        specs["vehicleOwnership"] = JsonSerializer.SerializeToNode(ledger.Owners, Json);
        return specs.ToJsonString();
    }
    public static OwnershipLedger Replace(OwnershipLedger current, OwnershipPerson[] owners, Guid primaryId,
        OwnershipChange change, DateOnly today, DateTimeOffset now)
    {
        ValidateChange(current, change, today);
        var normalized = owners.Select(p => p is null ? throw new OwnershipException("Μη έγκυρος ιδιοκτήτης.") : p with { Name = p.Name?.Trim() ?? "", VatNumber = p.VatNumber?.Trim() ?? "", Capacity = p.Capacity?.Trim() ?? "", Notes = p.Notes?.Trim() ?? "" }).ToArray();
        ValidateOwners(normalized, primaryId, change.Date);
        return Append(current, normalized, primaryId, current.Revision == 0 ? "Initial" : "Correction", change, now);
    }
    public static OwnershipLedger Transfer(OwnershipLedger current, Guid fromId, OwnershipPerson recipient, decimal percentage,
        bool makePrimary, OwnershipChange change, DateOnly today, DateTimeOffset now)
    {
        recipient = recipient with { Name=recipient.Name?.Trim()??"",VatNumber=recipient.VatNumber?.Trim()??"",Capacity=recipient.Capacity?.Trim()??"",Notes=recipient.Notes?.Trim()??"" };
        ValidateChange(current, change, today);
        ValidateOwners(current.Owners, current.PrimaryOwnerId, today);
        var from = current.Owners.SingleOrDefault(p => p.Id == fromId) ?? throw new OwnershipException("Επιλέξτε τον ιδιοκτήτη που μεταβιβάζει.");
        if (percentage <= 0 || percentage > from.Percentage || decimal.Round(percentage, 2) != percentage)
            throw new OwnershipException("Το μεταβιβαζόμενο ποσοστό πρέπει να είναι θετικό, με έως δύο δεκαδικά, και να μην υπερβαίνει το διαθέσιμο ποσοστό.");
        var matches = current.Owners.Where(p => p.Id == recipient.Id
            || p.CustomerId.HasValue && p.CustomerId == recipient.CustomerId
            || p.VatNumber.Length > 0 && p.VatNumber == recipient.VatNumber).ToArray();
        if(matches.Length>1)throw new OwnershipException("Τα στοιχεία παραλήπτη αντιστοιχούν σε διαφορετικούς ιδιοκτήτες. Επιλέξτε ξανά τον παραλήπτη.");
        var target = matches.SingleOrDefault() ?? recipient with { Percentage = 0, AcquiredOn = change.Date };
        if(target.Id==recipient.Id && target.CustomerId.HasValue && recipient.CustomerId.HasValue && target.CustomerId!=recipient.CustomerId)
            throw new OwnershipException("Δεν μπορείτε να αλλάξετε τη σύνδεση υφιστάμενου ιδιοκτήτη μέσα από τη μεταβίβαση.");
        if (target.Id == from.Id) throw new OwnershipException("Ο ιδιοκτήτης προέλευσης και ο νέος ιδιοκτήτης πρέπει να διαφέρουν.");
        var after = current.Owners.Where(p => p.Id != target.Id).Select(p => p.Id == fromId ? p with { Percentage = p.Percentage - percentage } : p)
            .Where(p => p.Percentage > 0).Append(target with { Percentage = (target.Percentage ?? 0) + percentage }).ToArray();
        var primary = makePrimary || !after.Any(p => p.Id == current.PrimaryOwnerId) ? target.Id : current.PrimaryOwnerId;
        ValidateOwners(after, primary, change.Date);
        return Append(current, after, primary, percentage == from.Percentage ? "FullTransfer" : "PartialTransfer", change, now, fromId, target.Id, percentage);
    }
    public static OwnershipLedger ReverseLast(OwnershipLedger current, OwnershipChange change, DateOnly today, DateTimeOffset now)
    {
        ValidateChange(current, change, today);
        var last = current.Events.LastOrDefault();
        if (last is null || last.Kind is "Initial" or "Reversal") throw new OwnershipException("Δεν υπάρχει τελευταία μεταβολή που μπορεί να αναιρεθεί. Χρησιμοποιήστε διόρθωση ιδιοκτητών.");
        ValidateOwners(last.Before, last.BeforePrimaryId, today);
        return Append(current, last.Before, last.BeforePrimaryId, "Reversal", change, now, reverses: last.Id);
    }
    public static void ValidateOwners(OwnershipPerson[] owners, Guid primaryId, DateOnly today)
    {
        if (owners.Length is < 1 or > 100) throw new OwnershipException("Προσθέστε από 1 έως 100 ιδιοκτήτες.");
        if (owners.Any(p => p.Id == Guid.Empty) || owners.Select(p => p.Id).Distinct().Count() != owners.Length) throw new OwnershipException("Διπλή εγγραφή ιδιοκτήτη.");
        if (owners.Any(p => string.IsNullOrWhiteSpace(p.Name) || p.Name.Length > 200 || p.Capacity.Length > 120 || p.Notes.Length > 2000))
            throw new OwnershipException("Κάθε ιδιοκτήτης χρειάζεται ονοματεπώνυμο / επωνυμία (έως 200 χαρακτήρες).");
        if (owners.Any(p => p.VatNumber.Length > 0 && (p.VatNumber.Length != 9 || p.VatNumber.Any(c => c is < '0' or > '9')))) throw new OwnershipException("Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία.");
        var vats = owners.Select(p => p.VatNumber).Where(v => v.Length > 0).ToArray();
        var customers = owners.Where(p => p.CustomerId.HasValue).Select(p => p.CustomerId).ToArray();
        if (vats.Distinct().Count() != vats.Length || customers.Distinct().Count() != customers.Length) throw new OwnershipException("Ο ίδιος πελάτης ή το ίδιο ΑΦΜ δεν μπορεί να προστεθεί δύο φορές.");
        if (owners.Any(p => p.Percentage is null or <= 0 or > 100 || decimal.Round(p.Percentage.Value, 2) != p.Percentage)
            || owners.Sum(p => p.Percentage) != 100) throw new OwnershipException("Συμπληρώστε το ποσοστό κάθε ιδιοκτήτη με έως δύο δεκαδικά. Το σύνολο πρέπει να είναι ακριβώς 100%.");
        if (owners.Any(p => p.AcquiredOn > today)) throw new OwnershipException("Η ημερομηνία απόκτησης δεν μπορεί να είναι μελλοντική.");
        if (!owners.Any(p => p.Id == primaryId && p.CustomerId.HasValue && p.CustomerId != Guid.Empty))
            throw new OwnershipException("Ο βασικός ιδιοκτήτης πρέπει να είναι συνδεδεμένος με πελάτη του γραφείου.");
    }
    private static void ValidateChange(OwnershipLedger current, OwnershipChange change, DateOnly today)
    {
        if (change.Date > today || change.Date.Year < 1900) throw new OwnershipException("Συμπληρώστε έγκυρη ημερομηνία μεταβολής έως σήμερα.");
        if (current.Events.LastOrDefault() is { } last && change.Date < last.Date) throw new OwnershipException("Η ημερομηνία δεν μπορεί να προηγείται της τελευταίας καταχωρημένης μεταβολής.");
        if (current.Revision > 0 && string.IsNullOrWhiteSpace(change.Reason)) throw new OwnershipException("Συμπληρώστε την αιτιολογία της μεταβολής.");
        if ((change.Reason??"").Length > 500 || (change.Reference??"").Length > 120 || (change.Notes??"").Length > 2000) throw new OwnershipException("Η αιτιολογία δέχεται έως 500 χαρακτήρες, η αναφορά 120 και οι σημειώσεις 2.000.");
    }
    private static OwnershipLedger Append(OwnershipLedger before, OwnershipPerson[] after, Guid primary, string kind, OwnershipChange change,
        DateTimeOffset now, Guid? from = null, Guid? to = null, decimal? percentage = null, Guid? reverses = null)
    {
        var entry = new OwnershipEvent(Guid.NewGuid(), kind, change.Date, now, change.Reason?.Trim()??"", change.Reference?.Trim()??"", change.Notes?.Trim()??"",
            before.Owners, after, before.PrimaryOwnerId, primary, from, to, percentage, reverses);
        return new(1, before.Revision + 1, primary, after, [..before.Events, entry]);
    }
}
