using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Materialises <see cref="PolicyCommissionSplit"/> rows for a policy — one
/// per hierarchy level in the leaf producer's chain that the matched rule
/// defines a percent for. Collaborator commission is paid in full; no tax
/// withholding is deducted from producer-level shares. The Agency row is the
/// office remainder, not a withholding row.
///
/// Fallback path: if the matched rule has no <c>LevelPercentsJson</c> we
/// materialise the legacy two-level split (Producer, Agency) from
/// <c>ProducerPercent</c> / <c>AgencyPercent</c> — so tenants that haven't
/// touched their rules still get a matrix, just a smaller one.
///
/// Called by Policy create + update handlers. Idempotent — the caller
/// deletes existing splits for the policy first (see helper below), then we
/// insert the new set in one round-trip.
/// </summary>
public class PolicyCommissionCalculator
{
    private readonly IAppDbContext _db;

    public PolicyCommissionCalculator(IAppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Wipe any existing splits for the policy and materialise a fresh set
    /// based on its current premium, producer chain, and the best-matching
    /// commission rule. The caller is responsible for calling
    /// <c>SaveChangesAsync</c> — we don't commit here so we can be composed
    /// into a larger create/update transaction.
    /// </summary>
    public async Task RecomputeAsync(Policy policy, CancellationToken ct)
    {
        var tenantId = policy.TenantId;

        // Existing splits — wipe them so a premium/rule change cleanly
        // replaces rather than duplicates.
        var existing = await _db.PolicyCommissionSplits
            .Where(s => s.PolicyId == policy.Id)
            .ToListAsync(ct);
        _db.PolicyCommissionSplits.RemoveRange(existing);

        // Insurance commissions are calculated on net premium when available.
        // If the contract has cover rows, evaluate the matching rule for each
        // cover and aggregate the resulting amounts into one policy split per
        // hierarchy level. This allows a negotiated cover-specific rate to
        // coexist with a carrier-wide fallback without applying one rate to
        // the whole policy by accident.
        var commissionBase = policy.NetPremium ?? policy.Premium;
        if (commissionBase == 0m) return;

        // Resolve the producer chain (leaf → parent → ... → root). Missing
        // parent stops the walk.
        var chain = await ResolveChainAsync(tenantId, policy.ProducerId, ct);

        // Pick the best-matching rule using the same specificity ordering the
        // rest of the system uses (per-producer > per-tier > global, then
        // per-carrier > wildcard, per-branch > wildcard, per-cover > wildcard,
        // per-vehicle-use > wildcard).
        var coverRows = await _db.PolicyCovers
            .Where(c => c.TenantId == tenantId && c.PolicyId == policy.Id && c.DeletedAt == null)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct);
        List<(string? Code, decimal Base, PolicyCover? Cover)> coverInputs = coverRows.Count > 0
            ? coverRows.Select(c => ((string?)c.CoverCode, c.NetPremium > 0m ? c.NetPremium : c.GrossPremium, (PolicyCover?)c)).ToList()
            : [(null, commissionBase, null)];
        var amountByLevel = new Dictionary<HierarchyLevel, decimal>();
        decimal calculationBaseTotal = 0m;
        var fixedAmountsApplied = new HashSet<(Guid RuleId, HierarchyLevel Level)>();

        foreach (var cover in coverInputs)
        {
            var coverBase = coverRows.Count > 0 ? cover.Base : commissionBase;
            if (coverBase == 0m) continue;
            var rule = await PickBestRuleAsync(tenantId, policy, chain, cover.Code, ct);
            var totalRule = await PickBestTotalRuleAsync(tenantId, policy, chain, cover.Code, ct);
            calculationBaseTotal += coverBase;
        var incomingRule = rule?.IncomingPercent.HasValue == true ? rule : totalRule ?? rule;
            var incoming = CalculateIncomingCommission(policy, cover.Cover, incomingRule, coverBase);

            var percents = ResolveOverrideLevels(policy.SpecialLevelPercentsJson);
            if (percents.Count == 0 && policy.SpecialCommissionPercent.HasValue && policy.ProducerId.HasValue)
            {
                var manualProducerPercent = Math.Max(0m, policy.SpecialCommissionPercent.Value);
                var rulePercents = ResolvePercents(rule);
                var replacedProducer = false;
                percents = rulePercents.Select(item =>
                {
                    if (item.Level != HierarchyLevel.Producer) return item;
                    replacedProducer = true;
                    return (item.Level, manualProducerPercent);
                }).ToList();
                if (!replacedProducer && manualProducerPercent > 0m)
                    percents.Insert(0, (HierarchyLevel.Producer, manualProducerPercent));
            }
            if (percents.Count == 0) percents = ResolvePercents(rule);
            if (percents.Count == 0 && totalRule is not null && !ReferenceEquals(totalRule, rule))
                percents = ResolvePercents(totalRule);
            if (percents.Count == 0) continue;

            // Explicit bridge values on a cover take precedence over the
            // parametrized percentage for that same cover.
            if (cover.Cover?.CommissionPercent is decimal coverProducerPercent)
            {
                var found = false;
                percents = percents.Select(x =>
                {
                    if (x.Level != HierarchyLevel.Producer) return x;
                    found = true;
                    return (x.Level, coverProducerPercent);
                }).ToList();
                if (!found && coverProducerPercent > 0m)
                    percents.Insert(0, (HierarchyLevel.Producer, coverProducerPercent));
            }

            if (cover.Cover?.AgencyCommissionPercent is decimal coverAgencyPercent)
            {
                percents = percents.Where(x => x.Level != HierarchyLevel.Agency).ToList();
                if (coverAgencyPercent > 0m) percents.Add((HierarchyLevel.Agency, coverAgencyPercent));
            }
            else if (cover.Cover?.AgencyCommissionPercent is null
                     && (rule?.AgencyCalculationBase ?? totalRule?.AgencyCalculationBase) is null)
            {
                var configuredTotalPercent = ConfiguredTotalPercent(totalRule) ?? ConfiguredTotalPercent(rule);
                if (configuredTotalPercent.HasValue && !policy.ProducerId.HasValue)
                    percents = [(HierarchyLevel.Agency, configuredTotalPercent.Value)];
                else if (configuredTotalPercent.HasValue)
                {
                    var remainder = Math.Max(configuredTotalPercent.Value - percents
                        .Where(x => x.Level != HierarchyLevel.Agency).Sum(x => Math.Max(0m, x.Percent)), 0m);
                    percents = percents.Where(x => x.Level != HierarchyLevel.Agency).ToList();
                    if (remainder > 0m) percents.Add((HierarchyLevel.Agency, remainder));
                }
            }

            if (!policy.ProducerId.HasValue)
            {
                var officePercent = percents.Where(x => x.Level == HierarchyLevel.Agency).Sum(x => Math.Max(0m, x.Percent));
                percents = officePercent > 0m ? [(HierarchyLevel.Agency, officePercent)] : [];
            }
            foreach (var (level, percent) in percents)
            {
                if (percent <= 0m || (level != HierarchyLevel.Agency && !policy.ProducerId.HasValue)) continue;
                var matchedRule = level == HierarchyLevel.Agency ? totalRule ?? rule : rule ?? totalRule;
                var basis = level == HierarchyLevel.Agency
                    ? matchedRule?.AgencyCalculationBase
                    : matchedRule?.ProducerCalculationBase;
                var amount = CalculateCommissionAmount(policy, cover.Cover, basis, percent, incoming, coverBase);
                if (basis == CommissionCalculationBase.FixedAmount && matchedRule is not null
                    && string.IsNullOrWhiteSpace(matchedRule.CoverCode)
                    && !fixedAmountsApplied.Add((matchedRule.Id, level))) continue;
                amountByLevel[level] = amountByLevel.GetValueOrDefault(level) + amount;
            }

            if (rule is not null && rule.OverCommissionPercent is decimal overPercent && overPercent > 0m)
            {
                var basis = rule.OverCommissionCalculationBase ?? CommissionCalculationBase.NetPremium;
                var amount = CalculateCommissionAmount(policy, cover.Cover, basis, overPercent, incoming, coverBase);
                if (basis != CommissionCalculationBase.FixedAmount
                    || !string.IsNullOrWhiteSpace(rule.CoverCode)
                    || fixedAmountsApplied.Add((rule.Id, HierarchyLevel.OverCommission)))
                    amountByLevel[HierarchyLevel.OverCommission] = amountByLevel.GetValueOrDefault(HierarchyLevel.OverCommission) + amount;
            }
        }

        foreach (var (level, amount) in amountByLevel.Where(x => x.Value != 0m))
        {
            var levelProducer = level == HierarchyLevel.OverCommission
                ? chain.FirstOrDefault()
                : chain.FirstOrDefault(p => p.HierarchyLevel == level);
            var percentBase = calculationBaseTotal > 0m ? calculationBaseTotal : commissionBase;
            var effectivePercent = Math.Round(amount / percentBase * 100m, 4, MidpointRounding.AwayFromZero);
            _db.PolicyCommissionSplits.Add(new PolicyCommissionSplit
            {
                Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = policy.Id,
                HierarchyLevel = level, ProducerId = levelProducer?.Id,
                Percent = effectivePercent, GrossAmount = amount, TaxWithholdingAmount = 0m,
                NetAmount = amount, Currency = policy.Currency, CreatedAt = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Walk up ParentProducerId, returning [leaf, parent, ...]. A cycle
    /// guard trips at depth 8 (defensive — real trees never nest that deep).
    /// </summary>
    private async Task<List<Producer>> ResolveChainAsync(Guid tenantId, Guid? leafId, CancellationToken ct)
    {
        var chain = new List<Producer>();
        if (leafId is null) return chain;

        var current = await _db.Producers
            .FirstOrDefaultAsync(p => p.Id == leafId && p.TenantId == tenantId && p.DeletedAt == null, ct);
        var seen = new HashSet<Guid>();
        while (current is not null && chain.Count < 8)
        {
            if (!seen.Add(current.Id)) break;
            chain.Add(current);
            if (current.ParentProducerId is null) break;
            current = await _db.Producers
                .FirstOrDefaultAsync(p => p.Id == current.ParentProducerId
                                          && p.TenantId == tenantId && p.DeletedAt == null, ct);
        }
        return chain;
    }

    /// <summary>
    /// Same scope-matching as <c>ListAgencyReconciliationByRuleHandler</c>:
    /// producer-specific rules beat producer-agnostic; more-specific carrier
    /// / branch / use scope beats wildcards.
    /// </summary>
    private async Task<CommissionRule?> PickBestRuleAsync(
        Guid tenantId, Policy policy, IReadOnlyList<Producer> chain, string? coverCode, CancellationToken ct)
    {
        var rules = await _db.CommissionRules
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync(ct);
        if (rules.Count == 0) return null;

        var producerIds = chain.Select(p => (Guid?)p.Id).ToHashSet();
        producerIds.Add(policy.ProducerId);

        var match = rules
            .Where(r =>
                r.EffectiveFrom <= policy.StartDate && (!r.EffectiveTo.HasValue || r.EffectiveTo.Value >= policy.StartDate) &&
                (!r.ProducerId.HasValue         || producerIds.Contains(r.ProducerId)) &&
                (!r.ProducerTier.HasValue       || chain.Any(p => p.Tier == r.ProducerTier)) &&
                (!r.PolicyType.HasValue         || r.PolicyType == policy.PolicyType) &&
                (!r.VehicleUseCategory.HasValue || r.VehicleUseCategory == policy.VehicleUseCategory) &&
                (!r.InsuranceCompanyId.HasValue || r.InsuranceCompanyId == policy.InsuranceCompanyId) &&
                (!r.InsuranceYear.HasValue      || r.InsuranceYear == policy.StartDate.Year) &&
                (!r.MinimumGrossPremium.HasValue || policy.Premium >= r.MinimumGrossPremium.Value) &&
                (!r.MaximumGrossPremium.HasValue || policy.Premium <= r.MaximumGrossPremium.Value) &&
                (!r.MinimumDeductible.HasValue || (policy.Deductible ?? 0m) >= r.MinimumDeductible.Value) &&
                (!r.MaximumDeductible.HasValue || (policy.Deductible ?? 0m) <= r.MaximumDeductible.Value) &&
                CoverMatches(r.CoverCode, coverCode, policy.CarrierCoverageCode))
            .OrderByDescending(r =>
                (r.ProducerId.HasValue         ? 32 : 0) +
                (r.ProducerTier.HasValue       ? 16 : 0) +
                (r.InsuranceYear.HasValue      ? 8 : 0) +
                (r.PolicyType.HasValue         ? 4 : 0) +
                (r.CoverCode is not null       ? 2 : 0) +
                (r.VehicleUseCategory.HasValue ? 1 : 0) +
                (r.InsuranceCompanyId.HasValue ? 1 : 0) +
                (r.MinimumGrossPremium.HasValue || r.MaximumGrossPremium.HasValue ? 1 : 0) +
                (r.MinimumDeductible.HasValue || r.MaximumDeductible.HasValue ? 1 : 0))
            .ThenByDescending(r => r.Priority)
            .ThenByDescending(r => r.EffectiveFrom)
            .FirstOrDefault();
        return match;
    }

    private async Task<CommissionRule?> PickBestTotalRuleAsync(
        Guid tenantId, Policy policy, IReadOnlyList<Producer> chain, string? coverCode, CancellationToken ct)
    {
        var rules = await _db.CommissionRules
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync(ct);
        rules = rules.Where(r => ConfiguredTotalPercent(r).HasValue).ToList();
        if (rules.Count == 0) return null;

        var producerIds = chain.Select(p => (Guid?)p.Id).ToHashSet();
        producerIds.Add(policy.ProducerId);
        return rules
            .Where(r =>
                r.EffectiveFrom <= policy.StartDate && (!r.EffectiveTo.HasValue || r.EffectiveTo.Value >= policy.StartDate) &&
                (!r.ProducerId.HasValue         || producerIds.Contains(r.ProducerId)) &&
                (!r.ProducerTier.HasValue       || chain.Any(p => p.Tier == r.ProducerTier)) &&
                (!r.PolicyType.HasValue         || r.PolicyType == policy.PolicyType) &&
                (!r.VehicleUseCategory.HasValue || r.VehicleUseCategory == policy.VehicleUseCategory) &&
                (!r.InsuranceCompanyId.HasValue  || r.InsuranceCompanyId == policy.InsuranceCompanyId) &&
                (!r.InsuranceYear.HasValue      || r.InsuranceYear == policy.StartDate.Year) &&
                (!r.MinimumGrossPremium.HasValue || policy.Premium >= r.MinimumGrossPremium.Value) &&
                (!r.MaximumGrossPremium.HasValue || policy.Premium <= r.MaximumGrossPremium.Value) &&
                (!r.MinimumDeductible.HasValue || (policy.Deductible ?? 0m) >= r.MinimumDeductible.Value) &&
                (!r.MaximumDeductible.HasValue || (policy.Deductible ?? 0m) <= r.MaximumDeductible.Value) &&
                CoverMatches(r.CoverCode, coverCode, policy.CarrierCoverageCode))
            .OrderByDescending(r =>
                (r.ProducerId.HasValue         ? 32 : 0) +
                (r.ProducerTier.HasValue       ? 16 : 0) +
                (r.InsuranceYear.HasValue      ? 8 : 0) +
                (r.PolicyType.HasValue         ? 4 : 0) +
                (r.CoverCode is not null       ? 2 : 0) +
                (r.VehicleUseCategory.HasValue ? 1 : 0) +
                (r.InsuranceCompanyId.HasValue  ? 1 : 0) +
                (r.MinimumGrossPremium.HasValue || r.MaximumGrossPremium.HasValue ? 1 : 0) +
                (r.MinimumDeductible.HasValue || r.MaximumDeductible.HasValue ? 1 : 0))
            .ThenByDescending(r => r.Priority)
            .ThenByDescending(r => r.EffectiveFrom)
            .FirstOrDefault();
    }

    private static bool CoverMatches(string? ruleCode, string? coverCode, string? policyCodes)
    {
        if (ruleCode is null) return true;
        if (!string.IsNullOrWhiteSpace(coverCode))
            return string.Equals(ruleCode.Trim(), coverCode.Trim(), StringComparison.OrdinalIgnoreCase);
        return (policyCodes ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Contains(ruleCode, StringComparer.OrdinalIgnoreCase);
    }

    private static decimal CalculateIncomingCommission(Policy policy, PolicyCover? cover, CommissionRule? rule, decimal premiumFallback)
    {
        if (rule?.IncomingPercent is not decimal rate || rate <= 0m) return 0m;
        var basis = rule.IncomingCalculationBase ?? CommissionCalculationBase.GrossPremium;
        var amountBase = basis == CommissionCalculationBase.NetPremium
            ? cover?.NetPremium is > 0m ? cover.NetPremium : (policy.NetPremium ?? premiumFallback)
            : cover?.GrossPremium ?? policy.Premium;
        return Math.Round(amountBase * rate / 100m, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal CalculateCommissionAmount(Policy policy, PolicyCover? cover,
        CommissionCalculationBase? calculationBase, decimal rate, decimal incoming, decimal premiumFallback)
    {
        var basis = calculationBase ?? CommissionCalculationBase.NetPremium;
        var signSource = policy.Premium != 0m ? policy.Premium : premiumFallback;
        var amountBase = basis switch
        {
            CommissionCalculationBase.GrossPremium => cover?.GrossPremium ?? policy.Premium,
            CommissionCalculationBase.NetPremium => cover?.NetPremium is > 0m ? cover.NetPremium : (policy.NetPremium ?? premiumFallback),
            CommissionCalculationBase.IncomingCommission => incoming,
            CommissionCalculationBase.FixedAmount => Math.Sign(signSource),
            _ => throw new ArgumentOutOfRangeException(nameof(calculationBase))
        };
        var divisor = basis == CommissionCalculationBase.FixedAmount ? 1m : 100m;
        return Math.Round(amountBase * rate / divisor, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Returns [level → percent] in top-down order (Producer first, Agency
    /// last). Parses <c>LevelPercentsJson</c> when set, otherwise falls back
    /// to the legacy two-level <c>ProducerPercent</c> / <c>AgencyPercent</c>
    /// so tenants that haven't opted in still see a matrix.
    /// </summary>
    /// <summary>
    /// Parse the same LevelPercentsJson shape when it's stored on the policy
    /// itself as a per-contract override. Returns an empty list when the
    /// blob is null/empty/malformed so the caller falls back to the rule.
    /// </summary>
    internal static List<(HierarchyLevel Level, decimal Percent)> ResolveOverrideLevels(string? json)
    {
        var result = new List<(HierarchyLevel, decimal)>();
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            var raw = JsonSerializer.Deserialize<Dictionary<string, decimal>>(json);
            if (raw is null) return result;
            foreach (var level in Enum.GetValues<HierarchyLevel>())
            {
                if (level == HierarchyLevel.OverCommission) continue;
                if (raw.TryGetValue(level.ToString(), out var pct) && pct > 0m)
                    result.Add((level, pct));
            }
        }
        catch { /* malformed override — silently ignore, fall back to rule */ }
        return result;
    }

    internal static List<(HierarchyLevel Level, decimal Percent)> ResolvePercents(CommissionRule? rule)
    {
        var result = new List<(HierarchyLevel, decimal)>();
        if (rule is null) return result;

        if (!string.IsNullOrWhiteSpace(rule.LevelPercentsJson))
        {
            try
            {
                var raw = JsonSerializer.Deserialize<Dictionary<string, decimal>>(rule.LevelPercentsJson);
                if (raw is not null)
                {
                    foreach (var level in Enum.GetValues<HierarchyLevel>())
                    {
                        if (level == HierarchyLevel.OverCommission) continue;
                        if (raw.TryGetValue(level.ToString(), out var pct) && pct > 0m)
                            result.Add((level, pct));
                    }
                    if (result.Count > 0) return result;
                }
            }
            catch { /* fall through to legacy split */ }
        }

        // Legacy fallback: infer Producer + Agency from the two flat columns.
        var producerPct = rule.ProducerPercent ??
            (rule.CommissionType == CommissionType.Percentage ? rule.Value : 0m);
        var agencyPct = rule.AgencyPercent ?? 0m;
        if (producerPct > 0m) result.Add((HierarchyLevel.Producer, producerPct));
        if (agencyPct > 0m)   result.Add((HierarchyLevel.Agency,   agencyPct));
        return result;
    }

    private static decimal? ConfiguredTotalPercent(CommissionRule? rule)
    {
        if (rule is null) return null;
        if (rule.AgencyPercent.HasValue)
            return rule.AgencyPercent.Value > 0m ? rule.AgencyPercent.Value : null;
        return !rule.ProducerPercent.HasValue
            && rule.CommissionType == CommissionType.Percentage
            && rule.Value > 0m
            ? rule.Value
            : null;
    }
}
