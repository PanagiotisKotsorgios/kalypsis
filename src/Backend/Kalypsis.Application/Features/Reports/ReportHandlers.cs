using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

public record KpiDto(int Customers, int ActivePolicies, int ExpiringSoon, decimal MonthlyPremium, int OpenClaims, int OpenRequests);
public record SeriesPoint(string Label, decimal Value);
public record CarrierShare(string Carrier, int Policies, decimal Premium);

public record AgencyReportDto(
    KpiDto Kpis,
    IReadOnlyList<SeriesPoint> PoliciesByType,
    IReadOnlyList<SeriesPoint> PoliciesByStatus,
    IReadOnlyList<SeriesPoint> ClaimsByStatus,
    IReadOnlyList<SeriesPoint> RequestsByStatus,
    IReadOnlyList<SeriesPoint> MonthlyPremium,
    IReadOnlyList<CarrierShare> TopCarriers);

public record GetAgencyReportQuery() : IRequest<AgencyReportDto>;

public class GetAgencyReportQueryHandler : IRequestHandler<GetAgencyReportQuery, AgencyReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public GetAgencyReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<AgencyReportDto> Handle(GetAgencyReportQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var in30 = today.AddDays(30);

        var policies = _db.Policies.IgnoreQueryFilters().Where(p => p.TenantId == tenantId && p.DeletedAt == null);
        var claims = _db.Claims.IgnoreQueryFilters().Where(c => c.TenantId == tenantId && c.DeletedAt == null);
        var requests = _db.ServiceRequests.IgnoreQueryFilters().Where(r => r.TenantId == tenantId && r.DeletedAt == null);
        var customers = _db.Customers.IgnoreQueryFilters().Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        var customerCount = await customers.CountAsync(ct);
        var activePolicies = await policies.CountAsync(p => p.Status == PolicyStatus.Active, ct);
        var expiringSoon = await policies.CountAsync(p => p.Status == PolicyStatus.Active && p.EndDate <= in30, ct);
        var monthlyPremium = await policies.Where(p => p.Status == PolicyStatus.Active).SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;
        var openClaims = await claims.CountAsync(c => c.Status != ClaimStatus.Closed && c.Status != ClaimStatus.Paid && c.Status != ClaimStatus.Rejected, ct);
        var openRequests = await requests.CountAsync(r => r.Status != ServiceRequestStatus.Closed
            && r.Status != ServiceRequestStatus.Resolved && r.Status != ServiceRequestStatus.Rejected, ct);

        var policiesByType = await policies
            .GroupBy(p => p.PolicyType)
            .Select(g => new { Type = g.Key, N = g.Count() })
            .ToListAsync(ct);
        var policiesByStatus = await policies
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, N = g.Count() })
            .ToListAsync(ct);
        var claimsByStatus = await claims
            .GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, N = g.Count() })
            .ToListAsync(ct);
        var requestsByStatus = await requests
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, N = g.Count() })
            .ToListAsync(ct);

        // Premium by month (last 6 months including current) — from StartDate.
        var monthBuckets = new List<SeriesPoint>();
        var now = _clock.UtcNow;
        for (int i = 5; i >= 0; i--)
        {
            var monthStart = new DateOnly(now.Year, now.Month, 1).AddMonths(-i);
            var nextMonth = monthStart.AddMonths(1);
            var monthTotal = await policies
                .Where(p => p.StartDate >= monthStart && p.StartDate < nextMonth && p.Status != PolicyStatus.Cancelled)
                .SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;
            monthBuckets.Add(new SeriesPoint(monthStart.ToString("yyyy-MM"), monthTotal));
        }

        var carrierRows = await policies
            .Where(p => p.Status == PolicyStatus.Active)
            .Select(p => new { p.InsuranceCompanyId, p.InsuranceCompany.Name, p.Premium })
            .ToListAsync(ct);
        var topCarriers = carrierRows
            .GroupBy(r => new { r.InsuranceCompanyId, r.Name })
            .Select(g => new CarrierShare(g.Key.Name, g.Count(), g.Sum(x => x.Premium)))
            .OrderByDescending(x => x.Premium)
            .Take(6)
            .ToList();

        return new AgencyReportDto(
            new KpiDto(customerCount, activePolicies, expiringSoon, monthlyPremium, openClaims, openRequests),
            policiesByType.Select(g => new SeriesPoint(g.Type.ToString(), g.N)).ToList(),
            policiesByStatus.Select(g => new SeriesPoint(g.Status.ToString(), g.N)).ToList(),
            claimsByStatus.Select(g => new SeriesPoint(g.Status.ToString(), g.N)).ToList(),
            requestsByStatus.Select(g => new SeriesPoint(g.Status.ToString(), g.N)).ToList(),
            monthBuckets,
            topCarriers);
    }
}
