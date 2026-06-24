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
}
