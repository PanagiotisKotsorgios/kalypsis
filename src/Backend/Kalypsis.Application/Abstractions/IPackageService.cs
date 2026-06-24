using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Single source of truth for "does tenant X have package Y enabled?".
/// Caches the set per tenant for a short window so the hot path (every API call)
/// doesn't round-trip the DB.
/// </summary>
public interface IPackageService
{
    Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default);
    Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default);

    /// <summary>Replace the full set of packages for a tenant. Triggers cache invalidation.</summary>
    Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default);

    /// <summary>Invalidate the cache for a tenant (e.g. after a write from the superadmin UI).</summary>
    void InvalidateCache(Guid tenantId);
}
