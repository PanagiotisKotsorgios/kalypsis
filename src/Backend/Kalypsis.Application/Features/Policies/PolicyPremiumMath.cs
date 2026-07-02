using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Central place for the arithmetic the rest of the platform expects on
/// premium- and commission-related numbers. All methods are pure and don't
/// touch the DbContext — callers hand in the already-loaded rows.
///
/// The two things it enforces:
///
/// 1. **Policy premium = Σ (cover.GrossPremium)** when there ARE covers.
///    When a policy has no covers on file (typical for the current manual
///    entry flow) the caller-provided premium is kept as-is. This means a
///    freshly-imported carrier file — which comes with a full covers
///    breakdown — will always reconcile against its own line total.
///
/// 2. **Per-cover commissions**. Each cover may carry its own
///    `CommissionPercent` (producer) and `AgencyCommissionPercent`
///    (office share). When either is null the caller-supplied fallback
///    (usually the CommissionRule.ProducerPercent / AgencyPercent) is
///    used. Total policy commission = Σ (cover.gross × cover_rate).
///
/// This matches how real carriers pay: MTPL 15%, οδική 0%, νομική 0%,
/// υλικές 12%, etc. — a flat rate applied to the policy total is what
/// created the diff-from-declaration noise that ProducerReconciliation
/// tries to catch.
/// </summary>
public static class PolicyPremiumMath
{
    /// <summary>Sum of gross premiums across a covers list. Zero for no covers.</summary>
    public static decimal SumGrossFromCovers(IEnumerable<PolicyCover> covers)
    {
        decimal total = 0m;
        foreach (var c in covers) total += c.GrossPremium;
        return total;
    }

    /// <summary>
    /// If any covers exist for the policy, mutate `policy.Premium` to their
    /// gross sum and return true. Otherwise leave the caller-supplied
    /// premium in place and return false. The caller usually calls this
    /// right before <c>SaveChangesAsync</c>.
    /// </summary>
    public static bool TrySyncPolicyPremiumFromCovers(Policy policy, IReadOnlyCollection<PolicyCover> covers)
    {
        if (covers.Count == 0) return false;
        policy.Premium = SumGrossFromCovers(covers);
        return true;
    }

    /// <summary>Result shape for the per-cover breakdown.</summary>
    public readonly record struct CoverCommissionLine(
        Guid CoverId, string CoverCode, string? CoverName,
        decimal Gross,
        decimal AgencyPercent, decimal ProducerPercent,
        decimal AgencyAmount, decimal ProducerAmount);

    /// <summary>Aggregate totals from <see cref="ComputePerCoverCommissions"/>.</summary>
    public readonly record struct PolicyCommissionBreakdown(
        decimal TotalGross,
        decimal TotalAgencyAmount,
        decimal TotalProducerAmount,
        IReadOnlyList<CoverCommissionLine> Lines);

    /// <summary>
    /// Compute per-cover commission amounts. `fallbackAgencyPercent` and
    /// `fallbackProducerPercent` come from the matching CommissionRule
    /// (or 0 when no rule matches) and are used only when the cover row
    /// itself doesn't carry a per-cover override.
    /// </summary>
    public static PolicyCommissionBreakdown ComputePerCoverCommissions(
        IReadOnlyCollection<PolicyCover> covers,
        decimal fallbackAgencyPercent,
        decimal fallbackProducerPercent)
    {
        var lines = new List<CoverCommissionLine>(covers.Count);
        decimal totalGross = 0m, totalAgency = 0m, totalProducer = 0m;
        foreach (var c in covers)
        {
            var agencyPct = c.AgencyCommissionPercent ?? fallbackAgencyPercent;
            var producerPct = c.CommissionPercent ?? fallbackProducerPercent;
            var agencyAmount = decimal.Round(c.GrossPremium * agencyPct / 100m, 2);
            var producerAmount = decimal.Round(c.GrossPremium * producerPct / 100m, 2);
            lines.Add(new CoverCommissionLine(
                c.Id, c.CoverCode, c.CoverName,
                c.GrossPremium, agencyPct, producerPct,
                agencyAmount, producerAmount));
            totalGross += c.GrossPremium;
            totalAgency += agencyAmount;
            totalProducer += producerAmount;
        }
        return new PolicyCommissionBreakdown(totalGross, totalAgency, totalProducer, lines);
    }
}
