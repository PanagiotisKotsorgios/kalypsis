using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A single (tenant × package) license row. Presence of a row = the package
/// is currently enabled for that tenant. Removal (or DeletedAt set) = disabled.
/// The superadmin manages these from <c>/app/tenants/{id}</c>.
/// </summary>
public class TenantPackageGrant : BaseEntity
{
    public Guid TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public PackageCode Package { get; set; }

    public DateTime EnabledAt { get; set; }
    public Guid? EnabledByUserId { get; set; }

    public string? Notes { get; set; }

    /// <summary>
    /// Bespoke monthly price the superadmin negotiated with this tenant for
    /// this package, in <see cref="Currency"/>. Null until the superadmin
    /// records a price — invoice generation skips lines with null prices
    /// (caller treats the grant as "trial / not yet priced").
    /// </summary>
    public decimal? MonthlyPrice { get; set; }
    public string Currency { get; set; } = "EUR";
}
