using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

public record ProducerKpi(int Customers, int ActivePolicies, int ExpiringSoon, decimal MonthlyPremium, int RenewalsThisYear);
public record RecentPolicyDto(Guid Id, string PolicyNumber, string CustomerDisplay, string CarrierName, PolicyType Type, decimal Premium, DateOnly EndDate);

public record ProducerReportDto(
    string ProducerName,
    string ProducerCode,
    ProducerKpi Kpis,
    IReadOnlyList<SeriesPoint> PoliciesByType,
    IReadOnlyList<SeriesPoint> PoliciesByStatus,
    IReadOnlyList<SeriesPoint> MonthlyPremium,
    IReadOnlyList<CarrierShare> CarrierBreakdown,
    IReadOnlyList<RecentPolicyDto> ExpiringSoon);

public record GetProducerReportQuery() : IRequest<ProducerReportDto>;

public class GetProducerReportQueryHandler : IRequestHandler<GetProducerReportQuery, ProducerReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public GetProducerReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ProducerReportDto> Handle(GetProducerReportQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct)
            ?? throw AppException.Forbidden("Ο λογαριασμός δεν είναι συνδεδεμένος με παραγωγό.");

        var producer = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == producerId, ct)
            ?? throw AppException.NotFound("Παραγωγός");

        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var in30 = today.AddDays(30);
        var yearStart = new DateOnly(today.Year, 1, 1);

        var policies = _db.Policies.IgnoreQueryFilters()
            .Include(p => p.Customer)
            .Include(p => p.InsuranceCompany)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null && p.ProducerId == producerId);

        var activePolicies = await policies.CountAsync(p => p.Status == PolicyStatus.Active, ct);
        var expiringSoonCount = await policies.CountAsync(p => p.Status == PolicyStatus.Active && p.EndDate <= in30, ct);
        var monthlyPremium = await policies.Where(p => p.Status == PolicyStatus.Active).SumAsync(p => (decimal?)p.Premium, ct) ?? 0m;
        var renewalsThisYear = await policies.CountAsync(p => p.StartDate >= yearStart && p.RenewedFromPolicyId != null, ct);

        var customerIds = await policies.Select(p => p.CustomerId).Distinct().ToListAsync(ct);
        var customerCount = customerIds.Count;

        var policiesByType = await policies
            .GroupBy(p => p.PolicyType)
            .Select(g => new { Type = g.Key, N = g.Count() })
            .ToListAsync(ct);
        var policiesByStatus = await policies
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, N = g.Count() })
            .ToListAsync(ct);

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
        var carriers = carrierRows
            .GroupBy(r => new { r.InsuranceCompanyId, r.Name })
            .Select(g => new CarrierShare(g.Key.Name, g.Count(), g.Sum(x => x.Premium)))
            .OrderByDescending(x => x.Premium)
            .Take(6)
            .ToList();

        var expiringDetails = await policies
            .Where(p => p.Status == PolicyStatus.Active && p.EndDate <= in30)
            .OrderBy(p => p.EndDate)
            .Take(12)
            .ToListAsync(ct);
        var expiringDtos = expiringDetails.Select(p =>
        {
            var c = p.Customer;
            var display = c is null
                ? string.Empty
                : c.Type == CustomerType.Individual
                    ? $"{c.FirstName} {c.LastName}".Trim()
                    : c.CompanyName ?? "—";
            return new RecentPolicyDto(p.Id, p.PolicyNumber, display, p.InsuranceCompany?.Name ?? string.Empty, p.PolicyType, p.Premium, p.EndDate);
        }).ToList();

        return new ProducerReportDto(
            producer.Name, producer.Code,
            new ProducerKpi(customerCount, activePolicies, expiringSoonCount, monthlyPremium, renewalsThisYear),
            policiesByType.Select(g => new SeriesPoint(g.Type.ToString(), g.N)).ToList(),
            policiesByStatus.Select(g => new SeriesPoint(g.Status.ToString(), g.N)).ToList(),
            monthBuckets,
            carriers,
            expiringDtos);
    }
}
