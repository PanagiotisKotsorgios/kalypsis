using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

/* ----------- DTOs ----------- */

public record PlatformKpiDto(
    int Tenants,
    int ActiveTenants,
    int Users,
    int ActiveUsers7d,
    int ActiveUsers30d,
    int Customers,
    int ActivePolicies,
    int OpenClaims,
    int OpenRequests,
    decimal TotalPremiumVolume,
    decimal MonthlyPremiumVolume);

public record SubscriptionShare(string Plan, int Tenants);

public record TenantHeadline(
    Guid TenantId,
    string Name,
    string Plan,
    int Users,
    int Customers,
    int Policies,
    decimal Premium,
    DateTime CreatedAt,
    DateTime? OnboardingCompletedAt);

public record PlatformActivity(string Kind, string Label, string OccurredAt);

public record SystemHealth(
    bool ApiOk,
    int TotalNotifications30d,
    int FailedLoginAttempts24h,
    int LockedAccounts,
    int AnonymizedCustomers,
    int AuditEvents24h);

public record PlatformReportDto(
    PlatformKpiDto Kpis,
    IReadOnlyList<SubscriptionShare> SubscriptionMix,
    IReadOnlyList<SeriesPoint> NewTenantsByMonth,
    IReadOnlyList<SeriesPoint> NewCustomersByMonth,
    IReadOnlyList<SeriesPoint> MonthlyPremium,
    IReadOnlyList<TenantHeadline> TopTenantsByPremium,
    IReadOnlyList<TenantHeadline> TopTenantsByCustomers,
    IReadOnlyList<TenantHeadline> RecentTenants,
    IReadOnlyList<PlatformActivity> RecentActivity,
    SystemHealth Health);

public record GetPlatformReportQuery() : IRequest<PlatformReportDto>;

public class GetPlatformReportQueryHandler : IRequestHandler<GetPlatformReportQuery, PlatformReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public GetPlatformReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<PlatformReportDto> Handle(GetPlatformReportQuery request, CancellationToken ct)
    {
        // Platform-level endpoint — only PlatformAdmin/PlatformEmployee may call.
        if (_current.Role != Role.PlatformAdmin && _current.Role != Role.PlatformEmployee)
            throw AppException.Forbidden();

        var now = _clock.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var weekAgo = now.AddDays(-7);
        var dayAgo = now.AddDays(-1);
        var monthStart = new DateOnly(today.Year, today.Month, 1);

        // Cross-tenant aggregates — IgnoreQueryFilters because platform admins
        // see every tenant.
        var tenants = _db.Tenants.IgnoreQueryFilters().Where(t => t.DeletedAt == null);
        var users = _db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null);
        var customers = _db.Customers.IgnoreQueryFilters().Where(c => c.DeletedAt == null);
        var policies = _db.Policies.IgnoreQueryFilters().Where(p => p.DeletedAt == null);
        var claims = _db.Claims.IgnoreQueryFilters().Where(c => c.DeletedAt == null);
        var requests = _db.ServiceRequests.IgnoreQueryFilters().Where(r => r.DeletedAt == null);

        var totalPremium = await policies
            .Where(p => p.Status == PolicyStatus.Active)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;

        var monthlyPremium = await policies
            .Where(p => p.Status == PolicyStatus.Active && p.StartDate >= monthStart)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;

        var kpis = new PlatformKpiDto(
            Tenants: await tenants.CountAsync(ct),
            ActiveTenants: await tenants.CountAsync(t => t.IsActive, ct),
            Users: await users.CountAsync(ct),
            ActiveUsers7d: await users.CountAsync(u => u.LastLoginAt != null && u.LastLoginAt >= weekAgo, ct),
            ActiveUsers30d: await users.CountAsync(u => u.LastLoginAt != null && u.LastLoginAt >= now.AddDays(-30), ct),
            Customers: await customers.CountAsync(ct),
            ActivePolicies: await policies.CountAsync(p => p.Status == PolicyStatus.Active, ct),
            OpenClaims: await claims.CountAsync(c => c.Status != ClaimStatus.Closed && c.Status != ClaimStatus.Paid, ct),
            OpenRequests: await requests.CountAsync(r =>
                r.Status != ServiceRequestStatus.Resolved &&
                r.Status != ServiceRequestStatus.Closed &&
                r.Status != ServiceRequestStatus.Rejected, ct),
            TotalPremiumVolume: totalPremium,
            MonthlyPremiumVolume: monthlyPremium);

        /* ----------- Subscription mix ----------- */

        var subscriptionMix = await tenants
            .GroupBy(t => t.SubscriptionPlan)
            .Select(g => new SubscriptionShare(g.Key.ToString(), g.Count()))
            .ToListAsync(ct);

        /* ----------- 6-month series ----------- */

        var since = new DateOnly(today.AddMonths(-5).Year, today.AddMonths(-5).Month, 1);

        var tenantSignups = await tenants
            .Where(t => t.CreatedAt >= since.ToDateTime(TimeOnly.MinValue))
            .GroupBy(t => new { t.CreatedAt.Year, t.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(ct);

        var customerSignups = await customers
            .Where(c => c.CreatedAt >= since.ToDateTime(TimeOnly.MinValue))
            .GroupBy(c => new { c.CreatedAt.Year, c.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
            .ToListAsync(ct);

        var premiumByMonth = await policies
            .Where(p => p.StartDate >= since)
            .GroupBy(p => new { p.StartDate.Year, p.StartDate.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Sum = g.Sum(x => x.Premium) })
            .ToListAsync(ct);

        var newTenantsByMonth = BuildSixMonthSeries(today, (y, m) =>
            tenantSignups.FirstOrDefault(s => s.Year == y && s.Month == m)?.Count ?? 0);

        var newCustomersByMonth = BuildSixMonthSeries(today, (y, m) =>
            customerSignups.FirstOrDefault(s => s.Year == y && s.Month == m)?.Count ?? 0);

        var monthlyPremiumSeries = BuildSixMonthSeries(today, (y, m) =>
            (int)(premiumByMonth.FirstOrDefault(s => s.Year == y && s.Month == m)?.Sum ?? 0m));

        /* ----------- Top tenants ----------- */

        var tenantHeads = await tenants
            .Select(t => new
            {
                t.Id,
                t.Name,
                Plan = t.SubscriptionPlan.ToString(),
                t.CreatedAt,
                t.OnboardingCompletedAt,
                Users = _db.Users.IgnoreQueryFilters().Count(u => u.TenantId == t.Id && u.DeletedAt == null),
                Customers = _db.Customers.IgnoreQueryFilters().Count(c => c.TenantId == t.Id && c.DeletedAt == null),
                Policies = _db.Policies.IgnoreQueryFilters().Count(p => p.TenantId == t.Id && p.DeletedAt == null
                    && p.Status == PolicyStatus.Active),
                Premium = _db.Policies.IgnoreQueryFilters()
                    .Where(p => p.TenantId == t.Id && p.DeletedAt == null && p.Status == PolicyStatus.Active)
                    .Sum(p => (decimal?)p.Premium) ?? 0m
            })
            .ToListAsync(ct);

        var topByPremium = tenantHeads
            .OrderByDescending(x => x.Premium)
            .Take(5)
            .Select(x => new TenantHeadline(x.Id, x.Name, x.Plan, x.Users, x.Customers, x.Policies, x.Premium, x.CreatedAt, x.OnboardingCompletedAt))
            .ToList();

        var topByCustomers = tenantHeads
            .OrderByDescending(x => x.Customers)
            .Take(5)
            .Select(x => new TenantHeadline(x.Id, x.Name, x.Plan, x.Users, x.Customers, x.Policies, x.Premium, x.CreatedAt, x.OnboardingCompletedAt))
            .ToList();

        var recentTenants = tenantHeads
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .Select(x => new TenantHeadline(x.Id, x.Name, x.Plan, x.Users, x.Customers, x.Policies, x.Premium, x.CreatedAt, x.OnboardingCompletedAt))
            .ToList();

        /* ----------- Recent activity feed ----------- */

        var recentTenantEvents = recentTenants.Select(t =>
            new PlatformActivity("tenant", $"Νέο γραφείο: {t.Name} ({t.Plan})", t.CreatedAt.ToString("o"))).ToList();
        var recentUsers = await users
            .OrderByDescending(u => u.CreatedAt)
            .Take(5)
            .Select(u => new PlatformActivity("user", $"Νέος χρήστης: {u.Email}", u.CreatedAt.ToString("o")))
            .ToListAsync(ct);
        var recentAudits = await _db.AuditLogs.IgnoreQueryFilters()
            .OrderByDescending(a => a.CreatedAt)
            .Take(5)
            .Select(a => new PlatformActivity("audit", $"{a.Action} σε {a.EntityName}", a.CreatedAt.ToString("o")))
            .ToListAsync(ct);

        var recent = recentTenantEvents.Concat(recentUsers).Concat(recentAudits)
            .OrderByDescending(a => a.OccurredAt)
            .Take(12)
            .ToList();

        /* ----------- System health ----------- */

        var notif30 = await _db.Notifications.IgnoreQueryFilters()
            .CountAsync(n => n.CreatedAt >= now.AddDays(-30), ct);
        var lockedAccounts = await users.CountAsync(u => u.LockedUntil != null && u.LockedUntil > now, ct);
        var anonymized = await customers.CountAsync(c => c.AnonymizedAt != null, ct);
        var auditDay = await _db.AuditLogs.IgnoreQueryFilters()
            .CountAsync(a => a.CreatedAt >= dayAgo, ct);
        // FailedLoginAttempts is the current counter, not history — total of non-zero attempts
        // gives a "recent suspicious activity" sniff test.
        var failedLogins = await users.SumAsync(u => (int?)u.FailedLoginAttempts, ct) ?? 0;

        var health = new SystemHealth(
            ApiOk: true,
            TotalNotifications30d: notif30,
            FailedLoginAttempts24h: failedLogins,
            LockedAccounts: lockedAccounts,
            AnonymizedCustomers: anonymized,
            AuditEvents24h: auditDay);

        return new PlatformReportDto(
            kpis,
            subscriptionMix,
            newTenantsByMonth,
            newCustomersByMonth,
            monthlyPremiumSeries,
            topByPremium,
            topByCustomers,
            recentTenants,
            recent,
            health);
    }

    private static List<SeriesPoint> BuildSixMonthSeries(DateOnly today, Func<int, int, int> picker)
    {
        var list = new List<SeriesPoint>();
        for (var i = 5; i >= 0; i--)
        {
            var d = today.AddMonths(-i);
            list.Add(new SeriesPoint($"{d.Year}-{d.Month:D2}", picker(d.Year, d.Month)));
        }
        return list;
    }
}
