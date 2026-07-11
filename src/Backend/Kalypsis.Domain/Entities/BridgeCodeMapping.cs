using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-tenant link between an unfamiliar raw code arriving from a carrier
/// bridge and the agency's own parametric (company / branch / coverage / use /
/// package). When a bridge import encounters a code the mapping resolves,
/// the row routes directly. Otherwise the import surfaces the unknown code
/// so the operator can create the mapping without leaving the flow.
/// </summary>
public enum BridgeMappingKind
{
    Company = 1,
    Branch = 2,
    Coverage = 3,
    Use = 4,
    Package = 5
}

public class BridgeCodeMapping : TenantEntity
{
    /// <summary>What kind of thing the raw code represents.</summary>
    public BridgeMappingKind Kind { get; set; }

    /// <summary>
    /// The carrier bridge the code came from — e.g. "INTERLIFE",
    /// "ERGO". Nullable for Kind=Company (we're linking to the bridge itself).
    /// </summary>
    public string? SourceCarrier { get; set; }

    /// <summary>The literal code as it appears in the bridge feed.</summary>
    public string RawCode { get; set; } = string.Empty;

    /// <summary>Optional label the bridge attached to the code.</summary>
    public string? RawLabel { get; set; }

    /// <summary>
    /// Points to the agency's own InsuranceCompany when Kind=Company. Null
    /// otherwise. Non-cascade so a company delete doesn't wipe mappings.
    /// </summary>
    public Guid? TargetInsuranceCompanyId { get; set; }
    public InsuranceCompany? TargetInsuranceCompany { get; set; }

    /// <summary>
    /// Points to the agency's own CompanyParameterItem when Kind is
    /// Branch / Coverage / Use / Package. Null when Kind=Company.
    /// </summary>
    public Guid? TargetParameterItemId { get; set; }
    public CompanyParameterItem? TargetParameterItem { get; set; }

    /// <summary>Optional operator note recorded at link time.</summary>
    public string? Notes { get; set; }

    /// <summary>Who confirmed this mapping — null when auto-inferred.</summary>
    public Guid? ConfirmedByUserId { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}
