using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Global carrier parameter maintained by Kalypsis PlatformAdmin.
/// Tenant-owned carrier copies inherit these rows by InsuranceCompany.Code, so
/// agencies do not have to reconfigure branches, coverages, uses or bridge
/// mappings per office.
/// </summary>
public class CompanyParameterItem : BaseEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public CompanyParameterItemKind Kind { get; set; }

    /// <summary>Stable internal code, e.g. AUTO, MTPL, EIX, BASIC.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>Optional branch scope when this item belongs to a policy type.</summary>
    public PolicyType? PolicyType { get; set; }

    /// <summary>Optional vehicle-use scope for motor parameters.</summary>
    public VehicleUseCategory? VehicleUseCategory { get; set; }

    /// <summary>Parent parameter code, usually a branch or package code.</summary>
    public string? ParentCode { get; set; }

    /// <summary>Bridge identifier such as ERGO, BLUEBYTE, ALIS or ONESOFT.</summary>
    public string? BridgeSystem { get; set; }

    /// <summary>External carrier/bridge code that maps to this normalized item.</summary>
    public string? BridgeCode { get; set; }

    /// <summary>Optional source field name in the bridge payload/file.</summary>
    public string? BridgeField { get; set; }

    /// <summary>Optional JSON payload for default values or parser hints.</summary>
    public string? DefaultValuesJson { get; set; }

    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public string Source { get; set; } = "Manual";
    public string? Notes { get; set; }
}
