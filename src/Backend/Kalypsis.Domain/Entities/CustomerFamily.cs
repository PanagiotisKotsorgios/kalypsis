using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A directed relationship between two customer records. The application creates
/// the inverse link too, so each member sees the same household from their card.
/// </summary>
public class CustomerRelationship : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid RelatedCustomerId { get; set; }
    public Customer RelatedCustomer { get; set; } = null!;

    public CustomerRelationshipType RelationshipType { get; set; }
    public string? Notes { get; set; }
}

public enum CustomerRelationshipType
{
    Spouse = 1,
    Partner = 2,
    Child = 3,
    Parent = 4,
    Grandparent = 5,
    Grandchild = 6,
    Sibling = 7,
    Dependent = 8,
    Other = 99
}

/// <summary>
/// A customer-owned asset or insurance need. Multiple records of the same type
/// are allowed (for example, more than one vehicle or property).
/// </summary>
public class CustomerInsuranceNeed : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    /// <summary>Home, Vehicle, Health, Life, Business, Travel, Pet, Liability, Cyber, Other.</summary>
    public string Kind { get; set; } = string.Empty;
    /// <summary>Human-readable label, e.g. "Toyota Yaris" or "Κύρια κατοικία".</summary>
    public string Title { get; set; } = string.Empty;

    public bool HasAsset { get; set; } = true;
    public bool IsInsured { get; set; }
    public int Priority { get; set; } = 3;
    public DateOnly? NextContactAt { get; set; }
    public string? Notes { get; set; }
}
