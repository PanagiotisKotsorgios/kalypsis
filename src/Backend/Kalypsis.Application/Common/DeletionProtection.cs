namespace Kalypsis.Application.Common;

/// <summary>
/// A live relationship that prevents an aggregate root from being deleted.
/// </summary>
public sealed record DeletionBlocker(string Label, int Count);

/// <summary>
/// Gives every protected deletion the same safe, actionable API response.
/// </summary>
public static class DeletionProtection
{
    public static void ThrowIfBlocked(string entityLabel, IEnumerable<DeletionBlocker> blockers)
    {
        var active = blockers.Where(x => x.Count > 0).ToArray();
        if (active.Length == 0) return;

        var details = string.Join(", ", active.Select(x => $"{x.Label}: {x.Count}"));
        throw new AppException(
            "deletion_blocked_by_dependencies",
            $"Δεν είναι δυνατή η διαγραφή του/της {entityLabel}, επειδή υπάρχουν συνδεδεμένα δεδομένα ή ιστορικό ({details}). Διαγράψτε ή μεταφέρετε πρώτα όλο το σχετικό ιστορικό και τις διασυνδέσεις και μετά επαναλάβετε τη διαγραφή.",
            409,
            title: "Η διαγραφή προστατεύτηκε",
            why: "Η εγγραφή χρησιμοποιείται ήδη από άλλα δεδομένα. Η διαγραφή της θα άφηνε ορφανό ή ανακριβές ιστορικό στο γραφείο.",
            fix: "Διαγράψτε ή μεταφέρετε πρώτα όλο το σχετικό ιστορικό και όλες τις διασυνδέσεις που αναφέρονται παραπάνω και, στη συνέχεια, επαναλάβετε τη διαγραφή.",
            severity: "warning");
    }
}
