using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A physical office (υποκατάστημα / παράρτημα) of an agency. One Tenant
/// (single legal entity / γραφείο) can run multiple offices in different
/// cities under the same brand and the same AgencyAdmin.
///
/// Distinct from <see cref="Branch"/>, which represents an insurance line
/// (κλάδος ασφάλισης — Auto/Fire/Life/etc.). Greek brokerage practice
/// keeps these two concepts completely separate.
///
/// Billing: one office (the HQ) is always included in the base subscription;
/// each additional <c>IsActive=true</c> office triggers the per-office
/// surcharge tracked on <see cref="TenantSubscription"/>.
/// </summary>
public class AgencyOffice : TenantEntity
{
    public string Code { get; set; } = string.Empty;                // tenant-unique short code
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }

    /// <summary>The one office included in the base subscription. Only one per tenant.</summary>
    public bool IsHeadquarters { get; set; }

    /// <summary>An inactive office isn't billable but is still visible in history.</summary>
    public bool IsActive { get; set; } = true;

    public string? Notes { get; set; }

    public ICollection<UserAgencyOffice> UserAssignments { get; set; } = new List<UserAgencyOffice>();
}

/// <summary>
/// Many-to-many: a user can serve one or more offices. A user with zero
/// assignments is interpreted as HQ-level — they see every office.
/// </summary>
public class UserAgencyOffice : TenantEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid AgencyOfficeId { get; set; }
    public AgencyOffice? AgencyOffice { get; set; }

    /// <summary>The user's primary office (the one shown by default on stats/dashboards).</summary>
    public bool IsPrimary { get; set; }
}
