using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerDetailDto(
    Guid Id, string Code, string Name, string? Email, string? Phone, ProducerStatus Status,
    // Performance KPIs
    int TotalPolicies, int ActivePolicies, int RenewedPolicies, int CancelledPolicies,
    int NewPoliciesThisYear, int RenewalsDueNext60Days,
    decimal TotalPremiumYtd, decimal TotalPremiumLastYear, decimal PremiumGrowthPercent,
    decimal TotalCommissionsEarned, decimal CommissionsThisYear,
    int ClaimCount, decimal ClaimRatio,
    decimal RenewalRate,
    int CustomerCount,
    // Top breakdowns (for UI)
    IReadOnlyList<ProducerCarrierStat> ByCarrier,
    IReadOnlyList<ProducerTypeStat> ByPolicyType,
    // Overall performance grade
    string PerformanceGrade);

public record ProducerCarrierStat(string CarrierName, int PolicyCount, decimal TotalPremium);
public record ProducerTypeStat(string PolicyType, int PolicyCount, decimal TotalPremium);

public record GetProducerDetailQuery(Guid Id) : IRequest<ProducerDetailDto>;

public class GetProducerDetailQueryHandler : IRequestHandler<GetProducerDetailQuery, ProducerDetailDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetProducerDetailQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerDetailDto> Handle(GetProducerDetailQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Producer");

        var policies = await _db.Policies
            .Include(x => x.InsuranceCompany)
            .Where(x => x.ProducerId == r.Id && x.DeletedAt == null)
            .ToListAsync(ct);

        var policyIds = policies.Select(x => x.Id).ToList();
        var thisYear = DateTime.UtcNow.Year;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var next60 = today.AddDays(60);

        var total = policies.Count;
        var active = policies.Count(x => x.Status == PolicyStatus.Active);
        var cancelled = policies.Count(x => x.Status == PolicyStatus.Cancelled);
        var renewed = policies.Count(x => x.RenewedFromPolicyId != null);
        var newThisYear = policies.Count(x => x.StartDate.Year == thisYear);
        var renewalsDue = policies.Count(x => x.EndDate >= today && x.EndDate <= next60 && x.Status == PolicyStatus.Active);

        decimal premiumYtd = policies.Where(x => x.StartDate.Year == thisYear).Sum(x => x.Premium);
        decimal premiumLastYear = policies.Where(x => x.StartDate.Year == thisYear - 1).Sum(x => x.Premium);
        decimal growth = premiumLastYear == 0 ? 0 : Math.Round((premiumYtd - premiumLastYear) / premiumLastYear * 100m, 1);

        var commissionsAll = await _db.CommissionTransactions
            .Where(x => x.ProducerId == r.Id && x.DeletedAt == null)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var commissionsThisYear = await _db.CommissionTransactions
            .Where(x => x.ProducerId == r.Id && x.DeletedAt == null && x.CreatedAt.Year == thisYear)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        var claimCount = await _db.Claims.IgnoreQueryFilters()
            .CountAsync(x => policyIds.Contains(x.PolicyId) && x.DeletedAt == null, ct);
        decimal claimRatio = total == 0 ? 0 : Math.Round((decimal)claimCount / total * 100m, 1);

        // Renewal rate = renewed / (policies that expired in last 12 months)
        var oneYearAgo = today.AddDays(-365);
        var expiredLastYear = policies.Count(x => x.EndDate >= oneYearAgo && x.EndDate <= today);
        decimal renewalRate = expiredLastYear == 0 ? 0 :
            Math.Round((decimal)policies.Count(x => x.RenewedFromPolicyId != null
                && x.StartDate >= oneYearAgo) / expiredLastYear * 100m, 1);

        var customerCount = policies.Select(x => x.CustomerId).Distinct().Count();

        var byCarrier = policies
            .GroupBy(x => x.InsuranceCompany.Name)
            .Select(g => new ProducerCarrierStat(g.Key, g.Count(), g.Sum(p => p.Premium)))
            .OrderByDescending(x => x.TotalPremium)
            .Take(10).ToList();

        var byType = policies
            .GroupBy(x => x.PolicyType.ToString())
            .Select(g => new ProducerTypeStat(g.Key, g.Count(), g.Sum(p => p.Premium)))
            .OrderByDescending(x => x.TotalPremium)
            .ToList();

        // Performance grade: composite of renewal rate, growth, claim ratio.
        var score = 0;
        if (renewalRate >= 80) score += 3; else if (renewalRate >= 60) score += 2; else if (renewalRate >= 40) score += 1;
        if (growth >= 20) score += 3; else if (growth >= 5) score += 2; else if (growth >= 0) score += 1;
        if (claimRatio < 15) score += 3; else if (claimRatio < 30) score += 2; else if (claimRatio < 50) score += 1;
        var grade = score switch { >= 8 => "A", >= 6 => "B", >= 4 => "C", >= 2 => "D", _ => "F" };

        return new ProducerDetailDto(
            p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status,
            total, active, renewed, cancelled, newThisYear, renewalsDue,
            premiumYtd, premiumLastYear, growth,
            commissionsAll, commissionsThisYear,
            claimCount, claimRatio,
            renewalRate, customerCount,
            byCarrier, byType, grade);
    }
}
