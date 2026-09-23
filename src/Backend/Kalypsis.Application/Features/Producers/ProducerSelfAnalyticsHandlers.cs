using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerMonthlyAnalyticsDto(
    int Month,
    decimal Premium,
    int PolicyCount,
    decimal ExpectedGrossCommission,
    decimal ExpectedNetCommission);

public record ProducerTypeAnalyticsDto(
    PolicyType PolicyType,
    decimal Premium,
    int PolicyCount,
    decimal ExpectedNetCommission);

public record ProducerStatusAnalyticsDto(PolicyStatus Status, decimal Premium, int PolicyCount);

public record ProducerSelfAnalyticsDto(
    int Year,
    int PolicyCount,
    decimal TotalPremium,
    decimal ExpectedGrossCommission,
    decimal ExpectedNetCommission,
    decimal AverageCommissionRatePercent,
    IReadOnlyList<ProducerMonthlyAnalyticsDto> Monthly,
    IReadOnlyList<ProducerTypeAnalyticsDto> ByPolicyType,
    IReadOnlyList<ProducerStatusAnalyticsDto> ByStatus);

public record GetProducerSelfAnalyticsQuery(
    int? Year,
    PolicyType? PolicyType,
    PolicyStatus? Status) : IRequest<ProducerSelfAnalyticsDto>;

/// <summary>
/// Analytics intentionally use the same persisted personal policy splits as
/// the monthly production list. This gives the producer useful trends without
/// exposing agency income, rule definitions, or another producer's figures.
/// </summary>
public class GetProducerSelfAnalyticsQueryHandler
    : IRequestHandler<GetProducerSelfAnalyticsQuery, ProducerSelfAnalyticsDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetProducerSelfAnalyticsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerSelfAnalyticsDto> Handle(GetProducerSelfAnalyticsQuery request, CancellationToken ct)
    {
        var year = request.Year ?? DateTime.UtcNow.Year;
        if (year is < 2000 or > 2100)
            throw new AppException("producer_analytics_invalid_year", "Επιλέξτε έγκυρο έτος.", 400);

        var producerId = await ProducerSelfData.GetProducerIdAsync(_db, _current, ct);
        var firstDay = new DateOnly(year, 1, 1);
        var nextYear = firstDay.AddYears(1);

        var policiesQuery = _db.Policies
            .AsNoTracking()
            .Where(p => p.ProducerId == producerId
                && p.StartDate >= firstDay
                && p.StartDate < nextYear
                && p.Status != PolicyStatus.Prospect);

        if (request.PolicyType.HasValue)
            policiesQuery = policiesQuery.Where(p => p.PolicyType == request.PolicyType.Value);
        if (request.Status.HasValue)
            policiesQuery = policiesQuery.Where(p => p.Status == request.Status.Value);

        var policies = await policiesQuery
            .Select(p => new ProducerAnalyticsPolicy(
                p.Id,
                p.StartDate.Month,
                p.PolicyType,
                p.Status,
                p.Premium))
            .ToListAsync(ct);

        var estimates = await ProducerSelfData.GetCommissionEstimatesAsync(
            _db, producerId, policies.Select(x => x.PolicyId).ToArray(), ct);

        var rows = policies.Select(policy =>
        {
            estimates.TryGetValue(policy.PolicyId, out var estimate);
            estimate ??= ProducerSelfCommissionEstimate.Empty;
            return new ProducerAnalyticsRow(policy, estimate);
        }).ToList();

        var monthly = Enumerable.Range(1, 12)
            .Select(month =>
            {
                var bucket = rows.Where(x => x.Policy.Month == month).ToList();
                return new ProducerMonthlyAnalyticsDto(
                    month,
                    bucket.Sum(x => x.Policy.Premium),
                    bucket.Count,
                    bucket.Sum(x => x.Estimate.GrossAmount),
                    bucket.Sum(x => x.Estimate.NetAmount));
            })
            .ToList();

        var byPolicyType = rows
            .GroupBy(x => x.Policy.PolicyType)
            .Select(group => new ProducerTypeAnalyticsDto(
                group.Key,
                group.Sum(x => x.Policy.Premium),
                group.Count(),
                group.Sum(x => x.Estimate.NetAmount)))
            .OrderByDescending(x => x.Premium)
            .ToList();

        var byStatus = rows
            .GroupBy(x => x.Policy.Status)
            .Select(group => new ProducerStatusAnalyticsDto(
                group.Key,
                group.Sum(x => x.Policy.Premium),
                group.Count()))
            .OrderByDescending(x => x.PolicyCount)
            .ToList();

        var totalPremium = rows.Sum(x => x.Policy.Premium);
        var totalGross = rows.Sum(x => x.Estimate.GrossAmount);
        return new ProducerSelfAnalyticsDto(
            year,
            rows.Count,
            totalPremium,
            totalGross,
            rows.Sum(x => x.Estimate.NetAmount),
            totalPremium > 0m ? Math.Round(totalGross / totalPremium * 100m, 2) : 0m,
            monthly,
            byPolicyType,
            byStatus);
    }

    private sealed record ProducerAnalyticsPolicy(
        Guid PolicyId,
        int Month,
        PolicyType PolicyType,
        PolicyStatus Status,
        decimal Premium);

    private sealed record ProducerAnalyticsRow(
        ProducerAnalyticsPolicy Policy,
        ProducerSelfCommissionEstimate Estimate);
}

public record ProducerOfficeGoalProgressDto(
    Guid GoalId,
    string Source,
    int Year,
    int? Month,
    PolicyType? PolicyType,
    decimal TargetPremium,
    int? TargetPolicies,
    decimal CurrentPremium,
    int CurrentPolicies,
    decimal PremiumProgressPercent,
    decimal? PoliciesProgressPercent,
    string? Notes);

public record ProducerCommissionGrowthTargetDto(
    int Level,
    decimal TargetPremium,
    decimal RemainingPremium,
    decimal CommissionRatePercent,
    decimal EstimatedGrossCommission,
    decimal EstimatedNetCommission);

public record ProducerSelfGoalsDto(
    int Year,
    int Month,
    decimal CurrentPremium,
    int CurrentPolicies,
    decimal CurrentCommissionRatePercent,
    decimal CurrentExpectedNetCommission,
    bool GoalPlanEnabled,
    decimal MaximumCommissionPercent,
    IReadOnlyList<ProducerOfficeGoalProgressDto> OfficeGoals,
    IReadOnlyList<ProducerCommissionGrowthTargetDto> GrowthTargets);

public record GetProducerSelfGoalsQuery() : IRequest<ProducerSelfGoalsDto>;

/// <summary>
/// Returns the current month's progress against office-created goals and a
/// transparent incentive projection. The projection is deliberately read-only:
/// only the office may change real commission rules or finalise a payout.
/// </summary>
public class GetProducerSelfGoalsQueryHandler
    : IRequestHandler<GetProducerSelfGoalsQuery, ProducerSelfGoalsDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetProducerSelfGoalsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerSelfGoalsDto> Handle(GetProducerSelfGoalsQuery _, CancellationToken ct)
    {
        var producerId = await ProducerSelfData.GetProducerIdAsync(_db, _current, ct);
        var plan = await _db.Producers
            .AsNoTracking()
            .FirstOrDefaultAsync(producer => producer.Id == producerId, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
        var now = DateTime.UtcNow;
        var year = now.Year;
        var month = now.Month;
        var periodStart = new DateOnly(year, month, 1);
        var periodEnd = periodStart.AddMonths(1);

        // A cancelled or potential policy is not progress toward a payable
        // production target. Expired issued policies are still historical
        // monthly production and therefore stay in the calculation.
        var currentPolicies = await _db.Policies
            .AsNoTracking()
            .Where(p => p.ProducerId == producerId
                && p.StartDate >= periodStart
                && p.StartDate < periodEnd
                && p.Status != PolicyStatus.Prospect
                && p.Status != PolicyStatus.Cancelled)
            .Select(p => new ProducerGoalPolicy(p.Id, p.PolicyType, p.Premium))
            .ToListAsync(ct);

        var estimates = await ProducerSelfData.GetCommissionEstimatesAsync(
            _db, producerId, currentPolicies.Select(x => x.PolicyId).ToArray(), ct);
        var currentPremium = currentPolicies.Sum(x => x.Premium);
        var currentGross = estimates.Values.Sum(x => x.GrossAmount);
        var currentTax = estimates.Values.Sum(x => x.TaxWithholdingAmount);
        var currentNet = estimates.Values.Sum(x => x.NetAmount);
        var currentRate = currentPremium > 0m
            ? Math.Round(currentGross / currentPremium * 100m, 2)
            : 0m;
        var taxRate = currentGross > 0m
            ? Math.Clamp(currentTax / currentGross, 0m, 1m)
            : 0m;

        var officeGoals = await _db.ProductionGoals
            .AsNoTracking()
            .Where(goal => goal.Year == year
                && (goal.Month == month || goal.Month == null)
                && (goal.ProducerId == producerId || goal.ProducerId == null))
            .OrderByDescending(goal => goal.ProducerId == producerId)
            .ThenBy(goal => goal.PolicyType)
            .ToListAsync(ct);

        var goalProgress = officeGoals.Select(goal =>
        {
            var matching = currentPolicies
                .Where(policy => !goal.PolicyType.HasValue || policy.PolicyType == goal.PolicyType.Value)
                .ToList();
            var premium = matching.Sum(x => x.Premium);
            var count = matching.Count;
            return new ProducerOfficeGoalProgressDto(
                goal.Id,
                goal.ProducerId == producerId ? "Προσωπικός στόχος γραφείου" : "Κοινός στόχος γραφείου",
                goal.Year,
                goal.Month,
                goal.PolicyType,
                goal.TargetPremium,
                goal.TargetPolicies,
                premium,
                count,
                CalculateProgress(premium, goal.TargetPremium),
                goal.TargetPolicies.HasValue ? CalculateProgress(count, goal.TargetPolicies.Value) : null,
                goal.Notes);
        }).ToList();

        var highestOfficeTarget = officeGoals.Select(x => x.TargetPremium).DefaultIfEmpty(0m).Max();
        var growthBase = Math.Max(Math.Max(currentPremium, highestOfficeTarget), 1_000m);
        var baseRate = plan.GoalBaseCommissionPercent ?? currentRate;
        var maximumRate = Math.Clamp(plan.GoalMaximumCommissionPercent, 0m, 100m);
        var defaultPremiumStep = Math.Max(growthBase * 0.25m, 1_000m);
        var firstTarget = plan.GoalFirstTargetPremium is > 0m
            ? plan.GoalFirstTargetPremium.Value
            : growthBase * 1.25m;
        var premiumStep = plan.GoalPremiumStep is > 0m
            ? plan.GoalPremiumStep.Value
            : defaultPremiumStep;
        var growthTargets = plan.GoalPlanEnabled && baseRate > 0m
            ? BuildGrowthTargets(
                firstTarget,
                premiumStep,
                currentPremium,
                baseRate,
                plan.GoalCommissionIncreasePercent,
                maximumRate,
                plan.GoalLevelCount,
                taxRate)
            : Array.Empty<ProducerCommissionGrowthTargetDto>();

        return new ProducerSelfGoalsDto(
            year,
            month,
            currentPremium,
            currentPolicies.Count,
            currentRate,
            currentNet,
            plan.GoalPlanEnabled,
            maximumRate,
            goalProgress,
            growthTargets);
    }

    private static decimal CalculateProgress(decimal current, decimal target)
        => target <= 0m ? 0m : Math.Round(Math.Min(current / target * 100m, 100m), 1);

    private static IReadOnlyList<ProducerCommissionGrowthTargetDto> BuildGrowthTargets(
        decimal firstTargetPremium,
        decimal premiumStep,
        decimal currentPremium,
        decimal baseRate,
        decimal rateIncrease,
        decimal maximumRate,
        int levelCount,
        decimal taxRate)
    {
        // All values are configured per producer by the office. When a field
        // is left empty, the caller sends a current-production-based default.
        // No fixed 14% cap is baked into this logic.
        var targets = new List<ProducerCommissionGrowthTargetDto>();
        var rate = Math.Min(Math.Max(baseRate, 0m), maximumRate);
        var safeStep = Math.Max(premiumStep, 1m);
        var targetPremium = Math.Max(firstTargetPremium, 1m);
        while (targetPremium <= currentPremium)
            targetPremium += safeStep;

        for (var level = 1; level <= Math.Clamp(levelCount, 1, 12) && rate < maximumRate; level++)
        {
            var targetRate = Math.Min(rate + Math.Max(rateIncrease, 0m) * level, maximumRate);
            var gross = Math.Round(targetPremium * targetRate / 100m, 2);
            var net = Math.Round(gross * (1m - taxRate), 2);
            targets.Add(new ProducerCommissionGrowthTargetDto(
                level,
                targetPremium,
                Math.Max(targetPremium - currentPremium, 0m),
                targetRate,
                gross,
                net));
            targetPremium += safeStep;
        }
        return targets;
    }

    private sealed record ProducerGoalPolicy(Guid PolicyId, PolicyType PolicyType, decimal Premium);
}

internal static class ProducerSelfData
{
    public static async Task<Guid> GetProducerIdAsync(IAppDbContext db, ICurrentUser current, CancellationToken ct)
    {
        var userId = current.UserId ?? throw AppException.Unauthorized();
        return await db.Users
            .Where(user => user.Id == userId)
            .Select(user => user.ProducerId)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Συνεργάτης");
    }

    public static async Task<Dictionary<Guid, ProducerSelfCommissionEstimate>> GetCommissionEstimatesAsync(
        IAppDbContext db,
        Guid producerId,
        Guid[] policyIds,
        CancellationToken ct)
    {
        if (policyIds.Length == 0)
            return new Dictionary<Guid, ProducerSelfCommissionEstimate>();

        return await db.PolicyCommissionSplits
            .AsNoTracking()
            .Where(split => split.ProducerId == producerId && policyIds.Contains(split.PolicyId))
            .GroupBy(split => split.PolicyId)
            .Select(group => new ProducerSelfCommissionEstimate(
                group.Key,
                group.Sum(split => split.Percent),
                group.Sum(split => split.GrossAmount),
                group.Sum(split => split.TaxWithholdingAmount),
                group.Sum(split => split.NetAmount)))
            .ToDictionaryAsync(estimate => estimate.PolicyId, ct);
    }
}

internal sealed record ProducerSelfCommissionEstimate(
    Guid PolicyId,
    decimal RatePercent,
    decimal GrossAmount,
    decimal TaxWithholdingAmount,
    decimal NetAmount)
{
    public static readonly ProducerSelfCommissionEstimate Empty = new(Guid.Empty, 0m, 0m, 0m, 0m);
}
