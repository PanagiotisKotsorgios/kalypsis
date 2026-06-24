using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 7 — Platform-wide economics for the superadmin dashboard.
///   - MRR / ARR / total revenue book (sum of active TenantSubscriptions + office surcharges + current TenantContract amounts where present)
///   - Tenant counts by state (Trial / Active / PastDue / Cancelled)
///   - Per-tenant revenue contribution table
///   - 12-month time series (synthesised from active-subscription state + contract effective dates)
/// </summary>
[ApiController]
[Route("api/platform/economics")]
[Authorize(Policy = "PlatformLevel")]
public class PlatformEconomicsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PlatformEconomicsController(AppDbContext db) => _db = db;

    public record OverviewResponse(
        int TotalTenants, int ActiveTenants, int TrialTenants, int PastDueTenants, int CancelledTenants,
        int NewTenants30d, int NewTenants90d, int CancelledTenants30d,
        decimal Mrr, decimal Arr, string Currency,
        decimal AverageRevenuePerTenant,
        int TotalUsers, int ActiveUsers30d,
        int TotalCustomers, int TotalPolicies);

    [HttpGet("overview")]
    public async Task<ActionResult<OverviewResponse>> Overview(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var d30 = now.AddDays(-30);
        var d90 = now.AddDays(-90);

        var tenants = await _db.Tenants.IgnoreQueryFilters().ToListAsync(ct);
        var subs = await _db.TenantSubscriptions.IgnoreQueryFilters()
            .Where(s => s.DeletedAt == null)
            .ToListAsync(ct);
        var offices = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.DeletedAt == null && o.IsActive)
            .ToListAsync(ct);
        var contracts = await _db.TenantContracts.IgnoreQueryFilters()
            .Where(c => c.IsActive && c.DeletedAt == null)
            .ToListAsync(ct);

        var officesByTenant = offices.GroupBy(o => o.TenantId).ToDictionary(g => g.Key, g => g.Count());
        var contractByTenant = contracts.ToDictionary(c => c.TenantId);

        decimal mrr = 0m;
        foreach (var t in tenants)
        {
            // Prefer the signed contract's amounts; fall back to TenantSubscription surcharge fields.
            if (contractByTenant.TryGetValue(t.Id, out var contract))
            {
                var officeCount = officesByTenant.GetValueOrDefault(t.Id, 0);
                var billable = Math.Max(0, officeCount - contract.OfficeIncludedCount);
                mrr += contract.MonthlyBaseAmount + (billable * contract.OfficeSurchargePerExtra);
            }
            else
            {
                var sub = subs.FirstOrDefault(s => s.TenantId == t.Id);
                if (sub is null) continue;
                var officeCount = officesByTenant.GetValueOrDefault(t.Id, 0);
                var billable = Math.Max(0, officeCount - sub.OfficeIncludedCount);
                mrr += billable * sub.OfficeSurchargeAmount;
            }
        }

        var activeStates = new[] { SubscriptionState.Active, SubscriptionState.Trial };
        int active   = subs.Count(s => s.State == SubscriptionState.Active);
        int trial    = subs.Count(s => s.State == SubscriptionState.Trial);
        int pastDue  = subs.Count(s => s.State == SubscriptionState.PastDue);
        int cancelled = subs.Count(s => s.State == SubscriptionState.Cancelled || s.State == SubscriptionState.Expired);

        int new30 = tenants.Count(t => t.CreatedAt >= d30);
        int new90 = tenants.Count(t => t.CreatedAt >= d90);
        int churn30 = subs.Count(s => (s.State == SubscriptionState.Cancelled || s.State == SubscriptionState.Expired) && s.UpdatedAt >= d30);

        var users = await _db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null).ToListAsync(ct);
        int totalUsers = users.Count;
        int activeUsers30d = users.Count(u => u.LastLoginAt >= d30);

        int totalCustomers = await _db.Customers.IgnoreQueryFilters().CountAsync(c => c.DeletedAt == null, ct);
        int totalPolicies  = await _db.Policies.IgnoreQueryFilters().CountAsync(p => p.DeletedAt == null, ct);

        var avg = (active + trial) > 0 ? mrr / (active + trial) : 0m;

        return Ok(new OverviewResponse(
            tenants.Count, active, trial, pastDue, cancelled,
            new30, new90, churn30,
            Math.Round(mrr, 2), Math.Round(mrr * 12m, 2), "EUR",
            Math.Round(avg, 2),
            totalUsers, activeUsers30d,
            totalCustomers, totalPolicies));
    }

    public record TenantRevenueRow(
        Guid TenantId, string TenantName, string TenantCode,
        string? Plan, string SubscriptionState,
        int OfficeCount, int BillableOfficeCount,
        decimal MonthlyTotal, string Currency,
        bool HasContract, string? ContractNumber, DateOnly? ContractEffectiveFrom);

    [HttpGet("revenue-by-tenant")]
    public async Task<ActionResult<IReadOnlyList<TenantRevenueRow>>> RevenueByTenant(CancellationToken ct)
    {
        var tenants = await _db.Tenants.IgnoreQueryFilters().ToListAsync(ct);
        var subs = await _db.TenantSubscriptions.IgnoreQueryFilters().Where(s => s.DeletedAt == null).ToListAsync(ct);
        var contracts = await _db.TenantContracts.IgnoreQueryFilters().Where(c => c.IsActive && c.DeletedAt == null).ToListAsync(ct);
        var officeCounts = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.DeletedAt == null && o.IsActive)
            .GroupBy(o => o.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var countByTenant = officeCounts.ToDictionary(x => x.TenantId, x => x.Count);

        var rows = new List<TenantRevenueRow>();
        foreach (var t in tenants.OrderBy(x => x.Name))
        {
            var contract = contracts.FirstOrDefault(c => c.TenantId == t.Id);
            var sub = subs.FirstOrDefault(s => s.TenantId == t.Id);
            int officeCount = countByTenant.GetValueOrDefault(t.Id, 0);

            decimal total;
            int billable;
            string currency;
            string plan;

            if (contract != null)
            {
                billable = Math.Max(0, officeCount - contract.OfficeIncludedCount);
                total = contract.MonthlyBaseAmount + billable * contract.OfficeSurchargePerExtra;
                currency = contract.Currency;
                plan = contract.Plan;
            }
            else
            {
                billable = sub is null ? 0 : Math.Max(0, officeCount - sub.OfficeIncludedCount);
                total = sub is null ? 0m : billable * sub.OfficeSurchargeAmount;
                currency = sub?.OfficeSurchargeCurrency ?? "EUR";
                plan = sub?.Plan ?? "—";
            }

            rows.Add(new TenantRevenueRow(
                t.Id, t.Name, t.Code,
                plan,
                sub?.State.ToString() ?? "—",
                officeCount, billable,
                Math.Round(total, 2), currency,
                contract != null, contract?.ContractNumber, contract?.EffectiveFrom));
        }
        return Ok(rows.OrderByDescending(r => r.MonthlyTotal).ToList());
    }

    public record SeriesPoint(string Month, decimal Mrr, int ActiveTenants, int NewTenants);

    [HttpGet("series")]
    public async Task<ActionResult<IReadOnlyList<SeriesPoint>>> Series([FromQuery] int months = 12, CancellationToken ct = default)
    {
        months = Math.Clamp(months, 1, 36);

        // Build a per-month synthetic series: count tenants that existed at end of month
        // and approximate MRR as (active tenants × average plan + office contribution).
        // Real billing pipeline writes line items to a future Invoice table; this is a
        // useful approximation for the dashboard until that exists.
        var tenants = await _db.Tenants.IgnoreQueryFilters().Select(t => new { t.Id, t.CreatedAt }).ToListAsync(ct);
        var subs = await _db.TenantSubscriptions.IgnoreQueryFilters().Where(s => s.DeletedAt == null).ToListAsync(ct);
        var contracts = await _db.TenantContracts.IgnoreQueryFilters().Where(c => c.DeletedAt == null).ToListAsync(ct);
        var officeMonthly = await _db.AgencyOffices.IgnoreQueryFilters()
            .Where(o => o.DeletedAt == null && o.IsActive)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var firstOfThisMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var points = new List<SeriesPoint>();
        for (var i = months - 1; i >= 0; i--)
        {
            var monthStart = firstOfThisMonth.AddMonths(-i);
            var monthEnd = monthStart.AddMonths(1);
            var existingTenantIds = tenants.Where(t => t.CreatedAt < monthEnd).Select(t => t.Id).ToHashSet();
            var newCount = tenants.Count(t => t.CreatedAt >= monthStart && t.CreatedAt < monthEnd);

            decimal mrr = 0m;
            foreach (var tid in existingTenantIds)
            {
                var contract = contracts.FirstOrDefault(c => c.TenantId == tid && c.IsActive
                    && c.EffectiveFrom <= DateOnly.FromDateTime(monthEnd.AddDays(-1))
                    && (c.EffectiveTo == null || c.EffectiveTo >= DateOnly.FromDateTime(monthStart)));
                var officeCount = officeMonthly.Count(o => o.TenantId == tid);
                if (contract != null)
                {
                    var billable = Math.Max(0, officeCount - contract.OfficeIncludedCount);
                    mrr += contract.MonthlyBaseAmount + billable * contract.OfficeSurchargePerExtra;
                }
                else
                {
                    var sub = subs.FirstOrDefault(s => s.TenantId == tid);
                    if (sub != null)
                    {
                        var billable = Math.Max(0, officeCount - sub.OfficeIncludedCount);
                        mrr += billable * sub.OfficeSurchargeAmount;
                    }
                }
            }
            points.Add(new SeriesPoint(
                monthStart.ToString("yyyy-MM"),
                Math.Round(mrr, 2),
                existingTenantIds.Count,
                newCount));
        }
        return Ok(points);
    }
}
