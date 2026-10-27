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

/// <summary>A household member recorded by name, without creating a customer card.</summary>
public class CustomerFamilyMember : TenantEntity
{
    public Guid CustomerId { get; set; }
    public string Relation { get; set; } = "Child";
    public string FullName { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string? Gender { get; set; }
    public string? Amka { get; set; }
    public bool IsBeneficiary { get; set; }
    public decimal? BeneficiarySharePercent { get; set; }
    public string? Notes { get; set; }
    public string? AfmVat { get; set; }
    public string? Occupation { get; set; }
    public string? Email { get; set; }
    public string? MobilePhone { get; set; }
    public bool CanReceiveMarketing { get; set; }
}

/// <summary>Desktop customer property and vehicle details retained for two-way sync.</summary>
public class CustomerAsset : TenantEntity
{
    public string? VehicleSpecsJson { get; set; }
    public Guid CustomerId { get; set; }
    public Guid? FamilyMemberId { get; set; }
    public string AssetKind { get; set; } = "House";
    public string? Description { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; } = "GR";
    public string? Plate { get; set; }
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public int? YearOfConstruction { get; set; }
    public int? EngineCc { get; set; }
    public string? Vin { get; set; }
    public string? ChassisNumber { get; set; }
    public string? FuelType { get; set; }
    public string? Transmission { get; set; }
    public string? Color { get; set; }
    public string? LicenseCountry { get; set; }
    public string? VehicleUse { get; set; }
    public string? InsuranceClass { get; set; }
    public int? TaxableHorsepower { get; set; }
    public int? DoorCount { get; set; }
    public int? SeatCount { get; set; }
    public int? OwnerCount { get; set; }
    public decimal? EstimatedValue { get; set; }
    public DateTime? FirstLicenseDate { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public bool? WasPurchasedNew { get; set; }
    public bool? IsYoungDriver { get; set; }
    public bool? HasSunroof { get; set; }
    public bool? HasAlarm { get; set; }
    public bool? HasImmobilizer { get; set; }
    public decimal? Value { get; set; }
    public decimal? AreaSquareMeters { get; set; }
    public int? ConstructionYear { get; set; }
    public string? ConstructionType { get; set; }
    public string? BusinessActivity { get; set; }
    public string? Kad { get; set; }
    public int? EmployeeCount { get; set; }
    public bool IsInsuredWithUs { get; set; }
    public string? CurrentCarrierName { get; set; }
    public DateTime? CurrentPolicyExpiresOn { get; set; }
    public int? InterestScore { get; set; }
    public string? Notes { get; set; }
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
