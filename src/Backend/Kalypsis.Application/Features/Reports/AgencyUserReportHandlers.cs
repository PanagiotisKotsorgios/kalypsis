using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

public record AgencyUserKpiDto(
    int MyCustomers,
    int MyPolicies,
    int MyExpiringSoon,
    int MyOpenRequests,
    int MyOpenClaims,
    decimal MyMonthlyPremium);

public record TimelineItem(string Kind, string Label, string OccurredAt);

public record AgencyUserReportDto(
    AgencyUserKpiDto Kpis,
    IReadOnlyList<SeriesPoint> MyPoliciesByType,
    IReadOnlyList<SeriesPoint> MyPoliciesByStatus,
    IReadOnlyList<SeriesPoint> MyMonthlyPremium,
    IReadOnlyList<TimelineItem> RecentActivity,
    IReadOnlyList<UpcomingRenewal> UpcomingRenewals);

public record UpcomingRenewal(string PolicyNumber, string CustomerDisplay, string EndDate, decimal Premium, int DaysUntil);

public record GetAgencyUserReportQuery() : IRequest<AgencyUserReportDto>;

public class GetAgencyUserReportQueryHandler : IRequestHandler<GetAgencyUserReportQuery, AgencyUserReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public GetAgencyUserReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<AgencyUserReportDto> Handle(GetAgencyUserReportQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var today = DateOnly.FromDateTime(_clock.UtcNow);
        var soon = today.AddDays(30);

        // "My" customers = those assigned to me.
        var myCustomerIds = await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.AssignedAdvisorId == userId)
            .Select(c => c.Id).ToListAsync(ct);

        // "My" policies = policies for those customers OR explicitly created by me.
        var policies = _db.Policies.IgnoreQueryFilters()
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Customer)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && (p.CreatedByUserId == userId || myCustomerIds.Contains(p.CustomerId)));

        var active = policies.Where(p => p.Status == PolicyStatus.Active);
        var expiring = active.Where(p => p.EndDate <= soon && p.EndDate >= today);

        var requests = _db.ServiceRequests.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null
                        && myCustomerIds.Contains(r.CustomerId));
        var claims = _db.Claims.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && (myCustomerIds.Contains(c.Policy.CustomerId)));

        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthlyPremium = await active
            .Where(p => p.StartDate >= monthStart)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;

        var kpis = new AgencyUserKpiDto(
            MyCustomers: myCustomerIds.Count,
            MyPolicies: await active.CountAsync(ct),
            MyExpiringSoon: await expiring.CountAsync(ct),
            MyOpenRequests: await requests.CountAsync(r =>
                r.Status != ServiceRequestStatus.Resolved &&
                r.Status != ServiceRequestStatus.Closed &&
                r.Status != ServiceRequestStatus.Rejected, ct),
            MyOpenClaims: await claims.CountAsync(c =>
                c.Status != ClaimStatus.Closed && c.Status != ClaimStatus.Paid, ct),
            MyMonthlyPremium: monthlyPremium);

        // Breakdowns
        var byType = await active.GroupBy(p => p.PolicyType)
            .Select(g => new SeriesPoint(g.Key.ToString(), g.Count()))
            .ToListAsync(ct);
        var byStatus = await policies.GroupBy(p => p.Status)
            .Select(g => new SeriesPoint(g.Key.ToString(), g.Count()))
            .ToListAsync(ct);

        // Last 6 months of premium
        var since = new DateOnly(today.AddMonths(-5).Year, today.AddMonths(-5).Month, 1);
        var rawMonths = await policies
            .Where(p => p.StartDate >= since)
            .GroupBy(p => new { p.StartDate.Year, p.StartDate.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Sum = g.Sum(x => x.Premium) })
            .ToListAsync(ct);
        var monthly = new List<SeriesPoint>();
        for (var i = 5; i >= 0; i--)
        {
            var d = today.AddMonths(-i);
            var hit = rawMonths.FirstOrDefault(m => m.Year == d.Year && m.Month == d.Month);
            monthly.Add(new SeriesPoint($"{d.Year}-{d.Month:D2}", hit?.Sum ?? 0m));
        }

        // Recent activity: last 8 service requests + claims + new policies
        var recentReqs = await requests
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .Select(r => new TimelineItem("request", $"Αίτημα: {r.Subject}", r.CreatedAt.ToString("o")))
            .ToListAsync(ct);
        var recentClaims = await claims
            .OrderByDescending(c => c.CreatedAt)
            .Take(3)
            .Select(c => new TimelineItem("claim", $"Ζημιά: {c.ClaimNumber}", c.CreatedAt.ToString("o")))
            .ToListAsync(ct);
        var recent = recentReqs.Concat(recentClaims)
            .OrderByDescending(t => t.OccurredAt)
            .Take(8)
            .ToList();

        // Upcoming renewals in the next 30 days
        var upcoming = await expiring
            .OrderBy(p => p.EndDate)
            .Take(8)
            .Select(p => new {
                p.PolicyNumber,
                Customer = p.Customer.Type == CustomerType.Company
                    ? (p.Customer.CompanyName ?? "—")
                    : ((p.Customer.FirstName ?? "") + " " + (p.Customer.LastName ?? "")).Trim(),
                p.EndDate,
                p.Premium
            })
            .ToListAsync(ct);
        var renewals = upcoming.Select(u => new UpcomingRenewal(
            u.PolicyNumber, u.Customer, u.EndDate.ToString("yyyy-MM-dd"),
            u.Premium, u.EndDate.DayNumber - today.DayNumber)).ToList();

        return new AgencyUserReportDto(kpis, byType, byStatus, monthly, recent, renewals);
    }
}
