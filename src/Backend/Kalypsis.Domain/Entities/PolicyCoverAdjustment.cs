using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Audit row written every time a bridge (carrier file import) changes the
/// agency's commission percentage on a PolicyCover — e.g. the carrier lowered
/// the office's rate mid-term. The rule of thumb is: whenever the agency's %
/// moves, the producer's % moves by the same RATIO so their contract-level
/// share of the office's earning stays intact. This row captures both sides
/// of that change so the operator can trace exactly why a producer's
/// commission line shrank on a given policy.
///
/// One row per (policyCover, transition). Chronological trail — never
/// updated or deleted, only inserted.
/// </summary>
public class PolicyCoverAdjustment : TenantEntity
{
    public Guid PolicyCoverId { get; set; }
    public PolicyCover PolicyCover { get; set; } = null!;

    /// <summary>Cached for reporting joins so the audit table can be scanned
    /// without dragging PolicyCover in.</summary>
    public Guid PolicyId { get; set; }

    public decimal? OldAgencyPercent { get; set; }
    public decimal? NewAgencyPercent { get; set; }
    public decimal? OldProducerPercent { get; set; }
    public decimal? NewProducerPercent { get; set; }

    /// <summary>Difference in € the change costs on this cover
    /// (positive = agency/producer earned less after the change).</summary>
    public decimal AgencyAmountDelta { get; set; }
    public decimal ProducerAmountDelta { get; set; }

    /// <summary>Free-text explanation, usually derived from the bridge event.</summary>
    public string? Reason { get; set; }
    /// <summary>The bridge import that triggered the change (nullable — some
    /// adjustments will come from operator UI edits later).</summary>
    public Guid? SourceBridgeRunId { get; set; }
}
