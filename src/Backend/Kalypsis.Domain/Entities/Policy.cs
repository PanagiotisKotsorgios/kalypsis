using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Policy : TenantEntity
{
    public string PolicyNumber { get; set; } = string.Empty;

    /// <summary>
    /// Ο αριθμός αίτησης (application number) που εκδίδει η ασφαλιστική
    /// πριν το συμβόλαιο πάρει οριστικό policy number. Παραμένει null όταν
    /// η αίτηση εκδόθηκε ταυτόχρονα με το συμβόλαιο.
    /// </summary>
    public string? ApplicationNumber { get; set; }

    public Guid CustomerId { get; set; }
    /// <summary>Ασφαλιζόμενος — το πρόσωπο για το οποίο ισχύει η κάλυψη.</summary>
    public Customer Customer { get; set; } = null!;

    /// <summary>
    /// Συμβαλλόμενος — το πρόσωπο που υπογράφει τη σύμβαση και έχει την
    /// υποχρέωση καταβολής των ασφαλίστρων. Συχνά συμπίπτει με τον
    /// ασφαλιζόμενο (γι' αυτό nullable), αλλά διαφέρει π.χ. όταν ο γονέας
    /// συμβάλλεται για ανήλικο τέκνο ή εταιρεία για εργαζόμενο.
    /// </summary>
    public Guid? ContractPartyCustomerId { get; set; }
    public Customer? ContractPartyCustomer { get; set; }

    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    /// <summary>
    /// Προηγούμενη ασφαλιστική εταιρεία — από πού μεταφέρθηκε το συμβόλαιο
    /// (π.χ. renewal-with-carrier-switch, ή win-back). Χρησιμοποιείται
    /// για churn analytics.
    /// </summary>
    public Guid? PreviousInsuranceCompanyId { get; set; }
    public InsuranceCompany? PreviousInsuranceCompany { get; set; }

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public PolicyType PolicyType { get; set; }
    /// <summary>Vehicle-use sub-classification for motor policies (ΕΙΧ, ΦΔΧ, etc.).
    /// Optional and ignored on non-motor policies.</summary>
    public VehicleUseCategory? VehicleUseCategory { get; set; }
    public PolicyStatus Status { get; set; } = PolicyStatus.Draft;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    /// <summary>
    /// Ημερομηνία έκδοσης του συμβολαίου από την ασφαλιστική εταιρεία
    /// (distinct from <see cref="CreatedAt"/>, which is the DB row timestamp,
    /// and <see cref="StartDate"/>, which is when the cover begins). Enables
    /// the operator to record «η εταιρεία εξέδωσε το συμβόλαιο στις X» even
    /// αν το καταχώρησαν στο σύστημα μια εβδομάδα αργότερα.
    /// </summary>
    public DateOnly? IssuedAt { get; set; }

    /// <summary>
    /// Αριθμός κυκλοφορίας οχήματος (για κλάδο αυτοκινήτου). Το ίδιο πεδίο
    /// διατηρείται και στο SpecsJson για ιστορικούς λόγους, αλλά προωθείται
    /// σε κανονική στήλη ώστε να μπορεί να ευρετηριαστεί και να αναζητηθεί
    /// άμεσα (search-by-plate ήταν το Νο 1 daily-driver missing filter).
    /// </summary>
    public string? VehicleRegistrationPlate { get; set; }

    public decimal Premium { get; set; }
    public string Currency { get; set; } = "EUR";

    /// <summary>Καθαρό ασφάλιστρο (before taxes and fees).</summary>
    public decimal? NetPremium { get; set; }
    /// <summary>ΦΠΑ / VAT amount (typically 24% on GR).</summary>
    public decimal? VatAmount { get; set; }
    /// <summary>Χαρτόσημο — τέλος χαρτοσήμου (2.4% on many branches).</summary>
    public decimal? StampDutyAmount { get; set; }
    /// <summary>
    /// Ασφαλιστική εισφορά — τέλος υπέρ Επικουρικού Κεφαλαίου/Ειδικού Λογαριασμού,
    /// varies by policy type. Kept as a nullable free field so future rate changes
    /// don't need a schema change.
    /// </summary>
    public decimal? InsuranceContributionAmount { get; set; }
    /// <summary>Λοιπές επιβαρύνσεις — άλλα τέλη που δεν εμπίπτουν στις παραπάνω
    /// κατηγορίες (π.χ. δικαίωμα συμβολαίου, εγκύκλιοι).</summary>
    public decimal? OtherChargesAmount { get; set; }

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
    public ICollection<PolicyObject> Objects { get; set; } = new List<PolicyObject>();
    public ICollection<PolicyCover> Covers { get; set; } = new List<PolicyCover>();
    public ICollection<PolicyInstallment> Installments { get; set; } = new List<PolicyInstallment>();
}
