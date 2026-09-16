using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Tenants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Platform-admin only, per-office presentation settings. These settings hide
/// sidebar entries only; they deliberately do not change package grants,
/// permissions, routes, or API authorisation.
/// </summary>
[ApiController]
[Route("api/platform/tenants/{tenantId:guid}/sidebar-visibility")]
[Authorize(Policy = "PlatformAdmin")]
public class TenantSidebarVisibilityController : ControllerBase
{
    private readonly IAppDbContext _db;

    public TenantSidebarVisibilityController(IAppDbContext db) => _db = db;

    public record SidebarVisibilityResponse(string[] HiddenItems);
    public record UpdateSidebarVisibilityRequest(string[]? HiddenItems);

    [HttpGet]
    public async Task<ActionResult<SidebarVisibilityResponse>> Get(Guid tenantId, CancellationToken ct)
    {
        var tenant = await FindTenant(tenantId, ct);
        return Ok(new SidebarVisibilityResponse(
            TenantSidebarVisibility.Parse(tenant.HiddenSidebarItemsJson)));
    }

    [HttpPut]
    public async Task<ActionResult<SidebarVisibilityResponse>> Update(
        Guid tenantId,
        [FromBody] UpdateSidebarVisibilityRequest request,
        CancellationToken ct)
    {
        var tenant = await FindTenant(tenantId, ct);
        var hiddenItems = TenantSidebarVisibility.Normalize(request.HiddenItems);
        tenant.HiddenSidebarItemsJson = TenantSidebarVisibility.Serialize(hiddenItems);
        await _db.SaveChangesAsync(ct);
        return Ok(new SidebarVisibilityResponse(hiddenItems));
    }

    private async Task<Domain.Entities.Tenant> FindTenant(Guid tenantId, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId && t.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        if (string.Equals(tenant.Code, "PLATFORM", StringComparison.OrdinalIgnoreCase))
            throw AppException.Forbidden("Δεν επιτρέπεται αλλαγή του sidebar του τεχνικού tenant της πλατφόρμας.");

        return tenant;
    }
}
