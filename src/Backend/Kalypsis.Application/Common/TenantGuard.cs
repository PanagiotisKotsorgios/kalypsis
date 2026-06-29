using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Common;

namespace Kalypsis.Application.Common;

/// <summary>
/// Small helper to make IDOR-safe "fetch by id" calls explicit at the call site.
/// Use whenever a handler queries with <c>IgnoreQueryFilters()</c> by primary
/// key — the global tenant filter is bypassed and you must check ownership.
///
/// PlatformAdmin / PlatformEmployee not impersonating are allowed across
/// tenants (matches the read-side behaviour of <c>BypassTenantFilter</c>).
/// </summary>
public static class TenantGuard
{
    /// <summary>
    /// Verifies the entity belongs to the current user's tenant. Throws
    /// AppException.NotFound on mismatch — we deliberately return 404 rather
    /// than 403 so an attacker probing for IDs can't tell "exists in other
    /// tenant" from "doesn't exist".
    /// </summary>
    public static T RequireSameTenant<T>(T? entity, ICurrentUser current, string entityLabel)
        where T : TenantEntity
    {
        if (entity is null) throw AppException.NotFound(entityLabel);
        if (current.IsPlatformLevel && !current.IsImpersonating) return entity;
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (entity.TenantId != tenantId)
            throw AppException.NotFound(entityLabel); // never 403 — don't leak existence
        return entity;
    }

    /// <summary>Same check, no entity-label customisation.</summary>
    public static T RequireSameTenant<T>(T? entity, ICurrentUser current)
        where T : TenantEntity
        => RequireSameTenant(entity, current, "Εγγραφή");
}
