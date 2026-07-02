using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// A per-tenant opt-in to a universal (Kalypsis-managed) carrier. When a row
/// exists the tenant has explicitly said "I do business with this carrier" and
/// it starts appearing in Γέφυρες, policy carrier pickers, dashboard filters,
/// etc. When absent the universal carrier stays visible in the catalog but is
/// hidden from operational surfaces. Only relevant for `InsuranceCompany.TenantId == null`
/// rows — carriers the tenant added themselves are implicitly opted-in.
public class TenantCarrierOptIn : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public DateTime EnabledAt { get; set; } = DateTime.UtcNow;
}
