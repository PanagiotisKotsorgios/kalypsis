using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>Official Greek insurance line, available to an office for a carrier.
/// Carrier file codes and bridge mappings remain in CompanyParameterItem.</summary>
public class StatutoryInsuranceBranch : BaseEntity
{
    public Guid TenantId { get; set; }
    public Guid InsuranceCompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}
