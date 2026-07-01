using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Premium;

/// <summary>
/// Shared server-side premium gating. Every endpoint that needs a premium
/// feature calls <see cref="RequireAsync"/> so we don't rely on the frontend
/// hiding the button — if someone hits the endpoint directly with the same
/// token, the backend still refuses.
/// </summary>
public static class PremiumGate
{
    /// <summary>
    /// Throws an HTTP 402 AppException if the tenant lacks the feature.
    /// Returns silently when granted. Cheap query — one SELECT + string parse.
    /// </summary>
    public static async Task RequireAsync(
        IAppDbContext db, Guid tenantId, string code, CancellationToken ct)
    {
        var rows = await db.TenantPackageGrants
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null && g.PremiumFeaturesJson != null)
            .Select(g => g.PremiumFeaturesJson!)
            .ToListAsync(ct);
        foreach (var json in rows)
            foreach (var c in PremiumFeatureJson.TryParseCodes(json))
                if (string.Equals(c, code, StringComparison.OrdinalIgnoreCase)) return;
        throw new AppException(
            "premium_required",
            "Αυτή η δυνατότητα απαιτεί αναβάθμιση πλάνου.",
            402,
            title: "Premium δυνατότητα",
            why: $"Το {code} είναι premium feature. Επικοινωνήστε με το Kalypsis για ενεργοποίηση.");
    }

    /// <summary>Non-throwing variant — returns true/false. For read-time gating.</summary>
    public static async Task<bool> HasAsync(
        IAppDbContext db, Guid tenantId, string code, CancellationToken ct)
    {
        var rows = await db.TenantPackageGrants
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null && g.PremiumFeaturesJson != null)
            .Select(g => g.PremiumFeaturesJson!)
            .ToListAsync(ct);
        foreach (var json in rows)
            foreach (var c in PremiumFeatureJson.TryParseCodes(json))
                if (string.Equals(c, code, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }
}
