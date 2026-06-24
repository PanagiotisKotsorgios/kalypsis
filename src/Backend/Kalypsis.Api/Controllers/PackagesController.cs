using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 5 — package licensing endpoints.
///   /api/me/packages                       (any authed user) — read own tenant's set
///   /api/platform/tenants/{id}/packages    (PlatformAdmin)   — read / replace any tenant's set
/// </summary>
[ApiController]
public class PackagesController : ControllerBase
{
    private readonly IPackageService _pkg;
    private readonly ICurrentUser _current;
    private readonly AppDbContext _db;

    public PackagesController(IPackageService pkg, ICurrentUser current, AppDbContext db)
    { _pkg = pkg; _current = current; _db = db; }

    public record MyPackagesResponse(IReadOnlyList<string> Packages, bool IsPlatformBypass);
    public record TenantPackagesResponse(Guid TenantId, string TenantName, IReadOnlyList<string> Packages);
    public record SetTenantPackagesBody(IReadOnlyList<PackageCode> Packages);

    /// <summary>
    /// Returns the packages enabled for the caller's current (or impersonated) tenant.
    /// PlatformAdmin / PlatformEmployee NOT impersonating get a bypass flag —
    /// the frontend uses that to show every nav item regardless of license.
    /// </summary>
    [Authorize]
    [HttpGet("/api/me/packages")]
    public async Task<ActionResult<MyPackagesResponse>> Mine(CancellationToken ct)
    {
        if (_current.IsPlatformLevel && !_current.IsImpersonating)
            return Ok(new MyPackagesResponse(
                Enum.GetNames<PackageCode>(),
                IsPlatformBypass: true));

        var tenantId = _current.TenantId
            ?? throw AppException.Forbidden("Δεν υπάρχει tenant context.");
        var set = await _pkg.GetEnabledAsync(tenantId, ct);
        return Ok(new MyPackagesResponse(
            set.Select(p => p.ToString()).ToList(),
            IsPlatformBypass: false));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("/api/platform/tenants/{tenantId:guid}/packages")]
    public async Task<ActionResult<TenantPackagesResponse>> Get(Guid tenantId, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");
        var set = await _pkg.GetEnabledAsync(tenantId, ct);
        return Ok(new TenantPackagesResponse(
            tenantId, tenant.Name,
            set.Select(p => p.ToString()).ToList()));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPut("/api/platform/tenants/{tenantId:guid}/packages")]
    public async Task<ActionResult<TenantPackagesResponse>> Set(Guid tenantId, [FromBody] SetTenantPackagesBody body, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        await _pkg.SetAsync(tenantId, body.Packages ?? Array.Empty<PackageCode>(), _current.UserId, ct);
        var set = await _pkg.GetEnabledAsync(tenantId, ct);
        return Ok(new TenantPackagesResponse(
            tenantId, tenant.Name,
            set.Select(p => p.ToString()).ToList()));
    }

    /// <summary>
    /// Lists every available package code + its friendly name. Used by the
    /// superadmin UI to render the toggle list.
    /// </summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("/api/platform/packages/catalog")]
    public ActionResult<IReadOnlyList<object>> Catalog() =>
        Ok(Enum.GetValues<PackageCode>().Select(p => new
        {
            code = p.ToString(),
            value = (int)p
        }).ToList());
}
