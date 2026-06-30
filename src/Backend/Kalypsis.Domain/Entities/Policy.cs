using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Policy : TenantEntity
{
    public string PolicyNumber { get; set; } = string.Empty;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public PolicyType PolicyType { get; set; }
    /// <summary>Vehicle-use sub-classification for motor policies (ΕΙΧ, ΦΔΧ, etc.).
    /// Optional and ignored on non-motor policies.</summary>
    public VehicleUseCategory? VehicleUseCategory { get; set; }
    public PolicyStatus Status { get; set; } = PolicyStatus.Draft;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public decimal Premium { get; set; }
    public string Currency { get; set; } = "EUR";

    public PaymentFrequency PaymentFrequency { get; set; } = PaymentFrequency.Annual;
    public bool PremiumIncludesVat { get; set; } = true;

    /// <summary>
    /// Free-form JSON for type-specific data — vehicle plate / Bonus-Malus / VIN for autos,
    /// square meters / floor / replacement value for property, covered persons + limits for health, etc.
    /// Shape is determined by <see cref="PolicyType"/>.
    /// </summary>
    public string? SpecsJson { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public Guid? RenewedFromPolicyId { get; set; }
    public Policy? RenewedFromPolicy { get; set; }

    // Phase 12 — BluByte parity: renewal preservation flags + special commissions + delivery
    public DateOnly? NextRenewalDate { get; set; }                  // Λήξη επόμενης ανανέωσης
    public Guid? RenewalTransferToProducerId { get; set; }          // αλλαγή συνεργάτη στην ανανέωση
    public Guid? RenewalTransferToCarrierId { get; set; }           // αλλαγή εταιρίας στην ανανέωση
    public bool RetainCommissionsOnRenewal { get; set; }            // Ιστ.Υπερ/ων
    public bool RetainDocumentNumberOnRenewal { get; set; }
    public bool RetainSpecialCommissionsOnRenewal { get; set; }
    public decimal? SpecialCommissionPercent { get; set; }          // Ειδικές προμήθειες (override)
    public string? RenewalInstructions { get; set; }                // Εντολές ανανέωσης (free text)
    public DateOnly? DeliveredAt { get; set; }                       // Παράδοση συμβολαίου
    public string? DeliveredTo { get; set; }                         // Παραλήπτης
    public string? DeliveryMethod { get; set; }                      // hand / post / email

    /// <summary>
    /// Τρόπος είσπραξης ασφαλίστρου — how the premium is collected from the
    /// customer (Cash / BankDeposit / Card / DebitOrder / Cheque / Other).
    /// Shown on the policy card and on the delivery page next to the
    /// delivery method.
    /// </summary>
    public string? PaymentCollectionMethod { get; set; }

    public ICollection<PolicyDocument> Documents { get; set; } = new List<PolicyDocument>();
    public ICollection<Claim> Claims { get; set; } = new List<Claim>();
    public ICollection<CommissionTransaction> CommissionTransactions { get; set; } = new List<CommissionTransaction>();
}
