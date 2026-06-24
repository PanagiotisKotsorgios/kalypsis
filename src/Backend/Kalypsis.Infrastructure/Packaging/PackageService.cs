using System.Collections.Concurrent;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Packaging;

/// <summary>
/// Concrete <see cref="IPackageService"/> backed by <see cref="AppDbContext"/>
/// with a small in-memory TTL cache. Cache lifetime is 60 seconds; the superadmin
/// UI explicitly invalidates on every write so toggles feel instant.
/// </summary>
public sealed class PackageService : IPackageService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    // Singleton-scoped cache shared across all requests.
    private static readonly ConcurrentDictionary<Guid, (DateTime ExpiresAt, IReadOnlySet<PackageCode> Packages)> Cache = new();

    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;

    public PackageService(AppDbContext db, IDateTimeProvider clock)
    { _db = db; _clock = clock; }

    public async Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default)
    {
        if (Cache.TryGetValue(tenantId, out var hit) && hit.ExpiresAt > DateTime.UtcNow)
            return hit.Packages;

        var pkgs = await _db.TenantPackageGrants
            .IgnoreQueryFilters()                                          // service must see ALL tenants
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null)
            .Select(g => g.Package)
            .ToListAsync(ct);

        var set = (IReadOnlySet<PackageCode>)pkgs.ToHashSet();
        Cache[tenantId] = (DateTime.UtcNow.Add(CacheTtl), set);
        return set;
    }

    public async Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default)
        => (await GetEnabledAsync(tenantId, ct)).Contains(package);

    public async Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default)
    {
        var desired = packages.Distinct().ToHashSet();

        // Pull ALL grants for the tenant, including soft-deleted ones, so we
        // can revive instead of insert (MySQL/Pomelo ignores filtered unique
        // indexes — we have to keep a single row per (tenant, package)).
        var allGrants = await _db.TenantPackageGrants
            .IgnoreQueryFilters()
            .Where(g => g.TenantId == tenantId)
            .ToListAsync(ct);

        var byPackage = allGrants.ToDictionary(g => g.Package);

        foreach (var pkg in Enum.GetValues<PackageCode>())
        {
            var shouldBeEnabled = desired.Contains(pkg);
            if (byPackage.TryGetValue(pkg, out var grant))
            {
                if (shouldBeEnabled && grant.DeletedAt != null)
                {
                    // Revive
                    grant.DeletedAt = null;
                    grant.EnabledAt = _clock.UtcNow;
                    grant.EnabledByUserId = enabledByUserId;
                }
                else if (!shouldBeEnabled && grant.DeletedAt == null)
                {
                    grant.DeletedAt = _clock.UtcNow;
                }
            }
            else if (shouldBeEnabled)
            {
                _db.TenantPackageGrants.Add(new TenantPackageGrant
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Package = pkg,
                    EnabledAt = _clock.UtcNow,
                    EnabledByUserId = enabledByUserId
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        InvalidateCache(tenantId);
    }

    public void InvalidateCache(Guid tenantId) => Cache.TryRemove(tenantId, out _);
}
