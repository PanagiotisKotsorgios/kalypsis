using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 14 — Default-value rules engine + carrier bridge import runs.
// ============================================================================

/// <summary>
/// Declarative rule that injects default values into a manually-entered policy
/// based on its carrier × policy type × cover × package. The most specific
/// rule wins (more non-null conditions = higher priority).
/// </summary>
public class DefaultValueRule : TenantEntity
{
    public string Name { get; set; } = string.Empty;

    // Match conditions — all nullable; null means "any". The more conditions
    // populated, the more specific the rule and the higher it sorts.
    public Guid? InsuranceCompanyId { get; set; }
    public PolicyType? PolicyType { get; set; }
    public string? CoverCode { get; set; }              // e.g. "BASIC", "EXTRA", "MTPL"
    public string? PackageCode { get; set; }            // e.g. "STANDARD"

    /// <summary>
    /// JSON: { "field":"value", ... } — field names map to either Policy
    /// columns (PaymentFrequency, Currency, SpecialCommissionPercent) or
    /// SpecsJson keys (cc, hp, plate, region, age).
    /// </summary>
    public string ValuesJson { get; set; } = "{}";

    public int Priority { get; set; }                   // tie-breaker; higher wins
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }

    public InsuranceCompany? InsuranceCompany { get; set; }
}

/// <summary>
/// One execution of a CompanyBridge import. Captures the file processed,
/// counts, and per-row outcomes for audit/troubleshooting.
/// </summary>
public class CompanyBridgeRun : TenantEntity
{
    public Guid BridgeId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string Status { get; set; } = "Running";    // Running / Completed / Failed
    public string? SourceFile { get; set; }              // file name uploaded
    public int RowsTotal { get; set; }
    public int RowsCreated { get; set; }
    public int RowsSkipped { get; set; }
    public int RowsFailed { get; set; }
    public string? ResultJson { get; set; }              // per-row log
    public string? ErrorMessage { get; set; }
    public Guid? TriggeredByUserId { get; set; }

    public CompanyBridge? Bridge { get; set; }
}
