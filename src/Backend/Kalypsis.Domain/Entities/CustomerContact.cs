using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Multiple contacts can hang off a single Customer (typically a company customer).
/// Roles: LegalRepresentative, HRManager, CFO, Accountant, Decision-maker, Other.
/// </summary>
public class CustomerContact : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Role { get; set; }              // free text in case the agency needs a custom role
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public bool IsPrimary { get; set; }
}
