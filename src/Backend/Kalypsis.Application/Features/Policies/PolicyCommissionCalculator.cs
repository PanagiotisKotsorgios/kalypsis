using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Materialises <see cref="PolicyCommissionSplit"/> rows for a policy — one
/// per hierarchy level in the leaf producer's chain that the matched rule
/// defines a percent for. Tax withholding is deducted at the tenant-level
/// default rate for every level except <see cref="HierarchyLevel.Agency"/>
/// (a broker doesn't withhold from itself).
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

        if (policy.Premium <= 0m) return;

        // Resolve the producer chain (leaf → parent → ... → root). Missing
        // parent stops the walk.
        var chain = await ResolveChainAsync(tenantId, policy.ProducerId, ct);

        // Pick the best-matching rule using the same specificity ordering the
        // rest of the system uses (per-producer > per-tier > global, then
        // per-carrier > wildcard, per-branch > wildcard, per-cover > wildcard,
        // per-vehicle-use > wildcard).
        var rule = await PickBestRuleAsync(tenantId, policy, chain, ct);

        // A per-policy override wins over every rule. Applied identically to
        // the rule-level JSON — same shape, same level keys.
        var percents = ResolveOverrideLevels(policy.SpecialLevelPercentsJson);
        if (percents.Count == 0) percents = ResolvePercents(rule);
        if (percents.Count == 0) return;

        // Withholding rate: per-rule override → tenant default → 20% floor.
        // If Tenants table is missing the column on a partial deploy we fall
        // back to 20% — matches the seeded default and avoids a 500 during boot.
        var tenantWithholdPct = await _db.Tenants
            .Where(t => t.Id == tenantId)
            .Select(t => (decimal?)t.DefaultTaxWithholdingPercent)
            .FirstOrDefaultAsync(ct) ?? 20m;
        // Withholding rate: per-rule override → tenant default. A pure
        // per-policy override with no matched rule falls back to the tenant
        // default (rule is null in that case).
        var withholdPct = rule?.TaxWithholdingPercent ?? tenantWithholdPct;

        foreach (var (level, percent) in percents)
        {
            if (percent <= 0m) continue;

            // Producer at this level = the node in the chain whose
            // HierarchyLevel matches. Might be null (rule pays a level but
            // the chain doesn't reach that high) — we still record the row
            // so the matrix explains the miss.
            var levelProducer = chain.FirstOrDefault(p => p.HierarchyLevel == level);

            var gross = Math.Round(policy.Premium * percent / 100m, 2);
            // Agency doesn't withhold from itself. Every other level does.
            var withheld = level == HierarchyLevel.Agency
                ? 0m
                : Math.Round(gross * withholdPct / 100m, 2);
            var net = gross - withheld;

            _db.PolicyCommissionSplits.Add(new PolicyCommissionSplit
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PolicyId = policy.Id,
                HierarchyLevel = level,
                ProducerId = levelProducer?.Id,
                Percent = percent,
                GrossAmount = gross,
                TaxWithholdingAmount = withheld,
                NetAmount = net,
                Currency = policy.Currency,
                CreatedAt = DateTime.UtcNow
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
        Guid tenantId, Policy policy, IReadOnlyList<Producer> chain, CancellationToken ct)
    {
        var rules = await _db.CommissionRules
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync(ct);
        if (rules.Count == 0) return null;

        var producerIds = chain.Select(p => (Guid?)p.Id).ToHashSet();
        producerIds.Add(policy.ProducerId);

        var match = rules
            .Where(r =>
                (!r.ProducerId.HasValue         || producerIds.Contains(r.ProducerId)) &&
                (!r.PolicyType.HasValue         || r.PolicyType == policy.PolicyType) &&
                (!r.VehicleUseCategory.HasValue || r.VehicleUseCategory == policy.VehicleUseCategory) &&
                (!r.InsuranceCompanyId.HasValue || r.InsuranceCompanyId == policy.InsuranceCompanyId))
            .OrderByDescending(r =>
                (r.ProducerId.HasValue         ? 8 : 0) +
                (r.PolicyType.HasValue         ? 4 : 0) +
                (r.VehicleUseCategory.HasValue ? 2 : 0) +
                (r.InsuranceCompanyId.HasValue ? 1 : 0))
            .FirstOrDefault();
        return match;
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
}
