using Kalypsis.Application.Common;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 6 — Per-tenant billing breakdown for the superadmin Tenant detail UI.
/// Computes the office surcharge from active AgencyOffices vs the base
/// included count (set on TenantSubscription).
/// </summary>
[ApiController]
[Route("api/platform/tenants")]
[Authorize(Policy = "PlatformLevel")]
public class TenantBillingController : ControllerBase
{
    private readonly AppDbContext _db;
    public TenantBillingController(AppDbContext db) => _db = db;

    public record OfficeLine(Guid Id, string Code, string Name, string? City, bool IsHeadquarters, bool IsActive);
    public record BillingBreakdownResponse(
        Guid TenantId,
        string TenantName,
        string? Plan,
        int OfficeIncludedCount,
        decimal OfficeSurchargeAmount,
        string OfficeSurchargeCurrency,
        int ActiveOfficeCount,
        int BillableOfficeCount,
        decimal MonthlyOfficeSurchargeTotal,
        IReadOnlyList<OfficeLine> Offices);

    [HttpGet("{tenantId:guid}/billing")]
    public async Task<ActionResult<BillingBreakdownResponse>> Get(Guid tenantId, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var sub = await _db.TenantSubscriptions.IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var offices = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId && o.DeletedAt == null)
            .OrderByDescending(o => o.IsHeadquarters).ThenBy(o => o.Name)
            .Select(o => new OfficeLine(o.Id, o.Code, o.Name, o.City, o.IsHeadquarters, o.IsActive))
            .ToListAsync(ct);

        var activeCount = offices.Count(o => o.IsActive);
        var included = sub?.OfficeIncludedCount ?? 1;
        var billable = Math.Max(0, activeCount - included);
        var perOffice = sub?.OfficeSurchargeAmount ?? 0m;
        var total = billable * perOffice;

        return Ok(new BillingBreakdownResponse(
            tenantId, tenant.Name, sub?.Plan,
            included, perOffice, sub?.OfficeSurchargeCurrency ?? "EUR",
            activeCount, billable, total,
            offices));
    }

    public record SetSurchargeBody(int OfficeIncludedCount, decimal OfficeSurchargeAmount, string OfficeSurchargeCurrency);

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPut("{tenantId:guid}/billing/office-surcharge")]
    public async Task<ActionResult<BillingBreakdownResponse>> SetSurcharge(
        Guid tenantId, [FromBody] SetSurchargeBody body, CancellationToken ct)
    {
        var sub = await _db.TenantSubscriptions.IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (sub is null)
        {
            // Auto-create a subscription stub for the tenant so the surcharge can be stored.
            sub = new Domain.Entities.TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Plan = "Manual"
            };
            _db.TenantSubscriptions.Add(sub);
        }
        sub.OfficeIncludedCount = Math.Max(0, body.OfficeIncludedCount);
        sub.OfficeSurchargeAmount = Math.Max(0m, body.OfficeSurchargeAmount);
        sub.OfficeSurchargeCurrency = string.IsNullOrWhiteSpace(body.OfficeSurchargeCurrency) ? "EUR" : body.OfficeSurchargeCurrency.ToUpperInvariant();
        await _db.SaveChangesAsync(ct);
        return await Get(tenantId, ct);
    }
}
