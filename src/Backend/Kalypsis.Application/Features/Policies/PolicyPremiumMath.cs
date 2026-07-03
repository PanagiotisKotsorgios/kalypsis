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

    /// <summary>Result of <see cref="ApplyBridgeAgencyPercentChange"/>.</summary>
    public readonly record struct BridgeAdjustmentResult(
        decimal? OldAgencyPercent, decimal NewAgencyPercent,
        decimal? OldProducerPercent, decimal? NewProducerPercent,
        decimal AgencyAmountDelta, decimal ProducerAmountDelta,
        string Reason);

    /// <summary>
    /// Task-2 core rule: when a carrier bridge reports a new agency % on a
    /// cover, mutate the cover so
    ///   • agency % → newAgencyPercent
    ///   • producer % is scaled by the SAME RATIO the agency % moved by,
    ///     so if the agency lost 3/15 of its rate the producer loses 3/15
    ///     of theirs. Preserves the office↔producer contract ratio.
    /// Returns a struct with all deltas so the caller can persist a
    /// <see cref="Kalypsis.Domain.Entities.PolicyCoverAdjustment"/> audit row.
    /// A null oldAgencyPct (no prior rate on file) skips the producer
    /// proportional step — there's no ratio to preserve.
    /// </summary>
    public static BridgeAdjustmentResult ApplyBridgeAgencyPercentChange(
        PolicyCover cover, decimal newAgencyPercent)
    {
        var oldAgency = cover.AgencyCommissionPercent;
        var oldProducer = cover.CommissionPercent;
        decimal? newProducer = oldProducer;

        if (oldAgency.HasValue && oldAgency.Value > 0m && oldProducer.HasValue)
        {
            var ratio = newAgencyPercent / oldAgency.Value;
            newProducer = decimal.Round(oldProducer.Value * ratio, 4);
        }
        cover.AgencyCommissionPercent = newAgencyPercent;
        cover.CommissionPercent = newProducer;

        var agencyAmountBefore = decimal.Round(cover.GrossPremium * (oldAgency ?? 0m) / 100m, 2);
        var agencyAmountAfter  = decimal.Round(cover.GrossPremium * newAgencyPercent / 100m, 2);
        var producerAmountBefore = decimal.Round(cover.GrossPremium * (oldProducer ?? 0m) / 100m, 2);
        var producerAmountAfter  = decimal.Round(cover.GrossPremium * (newProducer ?? 0m) / 100m, 2);

        var diffAgency   = agencyAmountBefore - agencyAmountAfter;
        var diffProducer = producerAmountBefore - producerAmountAfter;

        var reason = oldAgency.HasValue
            ? $"Ενημέρωση από γέφυρα: προμήθεια έδρας άλλαξε από {oldAgency:0.##}% σε {newAgencyPercent:0.##}% " +
              $"(διαφορά {diffAgency:0.00} €). Ανάλογη προσαρμογή συνεργάτη: " +
              (oldProducer.HasValue
                  ? $"από {oldProducer:0.##}% σε {newProducer:0.##}% (διαφορά {diffProducer:0.00} €)."
                  : "καμία (χωρίς προηγούμενο ποσοστό συνεργάτη).")
            : $"Ενημέρωση από γέφυρα: αρχικό ποσοστό έδρας {newAgencyPercent:0.##}%.";

        return new BridgeAdjustmentResult(
            oldAgency, newAgencyPercent,
            oldProducer, newProducer,
            diffAgency, diffProducer,
            reason);
    }

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
