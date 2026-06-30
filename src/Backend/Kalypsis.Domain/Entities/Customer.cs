using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Customer : TenantEntity
{
    public string CustomerNumber { get; set; } = string.Empty;
    public CustomerType Type { get; set; }
    public CustomerStatus Status { get; set; } = CustomerStatus.Active;

    public string? FirstName { get; set; }
    public string? LastName { get; set; }

    public string? CompanyName { get; set; }
    public string? VatNumber { get; set; }
    public string? TaxOffice { get; set; }            // ΔΟΥ
    public string? GemiNumber { get; set; }           // ΓΕΜΗ
    public string? LegalForm { get; set; }            // ΑΕ / ΕΠΕ / ΙΚΕ / ΟΕ ...

    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? AltPhone { get; set; }
    public string? MobilePhone { get; set; }

    // ΑΜΚΑ / αριθμός ταυτότητας / διαβατήριο — sensitive, encrypted at deployment time.
    public string? Amka { get; set; }
    public string? IdNumber { get; set; }
    public string? PassportNumber { get; set; }

    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Region { get; set; }               // νομός

    public DateOnly? BirthDate { get; set; }
    public string? Gender { get; set; }               // Male / Female / Other / PreferNotToSay
    public string? MaritalStatus { get; set; }        // Single / Married / Divorced / Widowed / Other
    public string? Occupation { get; set; }
    public string? Employer { get; set; }

    /// <summary>Δίπλωμα οδήγησης — αριθμός. Used for Auto policies + driver
    /// allow-lists. Sensitive, encrypted at rest where supported.</summary>
    public string? DriverLicenseNumber { get; set; }

    /// <summary>Κατηγορία διπλώματος (Β, Γ, Δ, Ε, ΑΜ, Α1, A2, Α, …).</summary>
    public string? DriverLicenseClass { get; set; }

    public DateOnly? DriverLicenseIssueDate { get; set; }
    public DateOnly? DriverLicenseExpiryDate { get; set; }

    public string? Source { get; set; }               // referral / web / walk-in / ad
    public string? TagsJson { get; set; }             // ["VIP","ξένος","priority"]
    public string? PhotoUrl { get; set; }
    public string? Notes { get; set; }

    public Guid? AssignedAdvisorId { get; set; }
    public User? AssignedAdvisor { get; set; }

    public DateTime? AnonymizedAt { get; set; }       // GDPR right-to-erasure marker

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
    public ICollection<ConsentRecord> Consents { get; set; } = new List<ConsentRecord>();
    public ICollection<CommunicationLog> Communications { get; set; } = new List<CommunicationLog>();
}
