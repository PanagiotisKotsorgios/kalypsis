using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Producer self-reported expected commission for a specific policy. Lets the
/// producer tell the agency "I expected to get X EUR for this policy" and lets
/// the agency reconcile against what was actually computed/paid.
///
/// When a declaration is saved, ReconciliationStatus and DifferenceAmount are
/// populated by comparing against the most recent CommissionRunLine for that
/// policy; a discrepancy above the threshold also writes a Notification to
/// the agency admins (see ProducerReconciliationHandlers).
/// </summary>
public class ProducerCommissionDeclaration : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public Guid PolicyId { get; set; }
    public Policy? Policy { get; set; }

    /// <summary>Amount the producer claims they were owed (or received).</summary>
    public decimal ExpectedAmount { get; set; }

    /// <summary>Optional percentage interpretation, for reference only.</summary>
    public decimal? ExpectedPercent { get; set; }

    public string Currency { get; set; } = "EUR";

    public string? Notes { get; set; }

    public DateTime DeclaredAt { get; set; }

    /// <summary>Snapshot of the actual commission at the time of declaration, in EUR.</summary>
    public decimal? RecordedAmount { get; set; }

    /// <summary>Recorded minus expected (positive = agency paid more than producer expected).</summary>
    public decimal? DifferenceAmount { get; set; }

    /// <summary>"match" | "missing" | "diff_small" | "diff_large"</summary>
    public string ReconciliationStatus { get; set; } = "pending";
}
