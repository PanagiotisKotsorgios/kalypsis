using System.Globalization;
using System.Text.Json;
using Kalypsis.Application.Common;

namespace Kalypsis.Application.Features.Policies;

public static class VehicleOwnershipRules
{
    public static void Validate(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return;
        using var document = JsonDocument.Parse(specsJson);
        var root = document.RootElement;
        // Existing legacy specs without co-ownership metadata are unchanged.
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("vehicleOwnership", out var owners)) return;
        var count = 1;
        if (root.TryGetProperty("ownerCount", out var ownerCount) && ownerCount.ValueKind != JsonValueKind.Null
            && !string.IsNullOrWhiteSpace(ownerCount.ToString())
            && !int.TryParse(ownerCount.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out count))
            throw AppException.Validation("Ο αριθμός ιδιοκτητών πρέπει να είναι ακέραιος.");
        if (count < 1 || count > 100 || owners.ValueKind != JsonValueKind.Array || owners.GetArrayLength() != count)
            throw AppException.Validation("Οι συνιδιοκτήτες πρέπει να αντιστοιχούν στον αριθμό ιδιοκτητών του οχήματος.");
        decimal total = 0;
        var completed = 0;
        var vats = new HashSet<string>(StringComparer.Ordinal);
        foreach (var owner in owners.EnumerateArray())
        {
            if (owner.ValueKind != JsonValueKind.Object) throw AppException.Validation("Μη έγκυρα στοιχεία συνιδιοκτήτη.");
            if (owner.TryGetProperty("vatNumber", out var vat))
            {
                if (vat.ValueKind != JsonValueKind.String) throw AppException.Validation("Μη έγκυρο ΑΦΜ συνιδιοκτήτη.");
                var text = vat.GetString()?.Trim() ?? "";
                if (text.Length > 0 && (text.Length != 9 || text.Any(c => c is < '0' or > '9') || !vats.Add(text)))
                    throw AppException.Validation("Κάθε ΑΦΜ συνιδιοκτήτη πρέπει να είναι μοναδικό και να έχει 9 ψηφία.");
            }
            if (!owner.TryGetProperty("percentage", out var percentage) || percentage.ValueKind == JsonValueKind.Null) continue;
            if (percentage.ValueKind != JsonValueKind.Number || !percentage.TryGetDecimal(out var share)
                || share <= 0 || share > 100 || decimal.Truncate(share * 100) != share * 100)
                throw AppException.Validation("Το ποσοστό ιδιοκτησίας πρέπει να είναι μεγαλύτερο από 0 και έως 100%, με έως δύο δεκαδικά ψηφία.");
            total += share;
            completed++;
        }
        if (total > 100 || (completed == count && total != 100))
            throw AppException.Validation("Το σύνολο των ποσοστών ιδιοκτησίας πρέπει να είναι 100%.");
    }
}
