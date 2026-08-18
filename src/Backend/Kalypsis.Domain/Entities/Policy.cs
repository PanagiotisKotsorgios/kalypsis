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
    /// <summary>
    /// Raw «Χρήση οχήματος» code as it comes from the carrier — either the
    /// bridge's own token (ERGO "000", ATLANTIC "01" …) or the Παραμετρικά
    /// code the operator picked on the manual form (e.g. «Ε.Ι.Χ.ΜΟΤ»). Used
    /// when the underlying value can't be reduced to the VehicleUseCategory
    /// enum, so filters and reports can still target it end-to-end without
    /// forcing every carrier's coding scheme through Kalypsis' enum shortlist.
    /// </summary>
    public string? CarrierUseCode { get; set; }
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

    /// <summary>
    /// ΑΦΜ του κύριου οδηγού του οχήματος. Διαφέρει από τον <c>CustomerId</c>
    /// (ασφαλιζόμενο) όταν οδηγεί άλλο μέλος της οικογένειας — π.χ. γονέας
    /// συμβάλλεται, παιδί οδηγεί. Πεδίο πρώτης γραμμής ώστε να φιλτράρεται
    /// άμεσα (search-by-driver-ΑΦΜ) και να εμφανίζεται σε reports χωρίς JSON.
    /// </summary>
    public string? DriverVatNumber { get; set; }

    /// <summary>
    /// Λόγος κυκλοφορίας (Ιδιωτική, Επαγγελματική, Ταξί, Ασθενοφόρο κ.λπ.) —
    /// distinct from <see cref="VehicleUseCategory"/>, which describes the
    /// vehicle class (ΕΙΧ/ΦΔΧ/…). Το reason για κάθε τιμολογιακό tier ζητά
    /// να το βλέπει ξεχωριστά η ασφαλιστική.
    /// </summary>
    public string? ReasonForCirculation { get; set; }

    // ── Desktop-parity (2026-08-11) — day-to-day operations fields ──
    /// <summary>
    /// Πληρωμή επί πιστώσει — ο πελάτης έφυγε με το συμβόλαιο υπόσχεση να
    /// πληρώσει αργότερα. Combined με <see cref="PaymentPromisedOn"/> τρέφει
    /// το «Αναμενόμενες πληρωμές» dashboard και τους reminders.
    /// </summary>
    public bool PaidOnCredit { get; set; }
    /// <summary>Ημερομηνία που ο πελάτης υποσχέθηκε να πληρώσει.</summary>
    public DateOnly? PaymentPromisedOn { get; set; }
    /// <summary>Free-form λόγος του πιστωτικού (πχ «πληρωμή έως 15/8»).</summary>
    public string? CreditReason { get; set; }

    /// <summary>«Ο πελάτης πληρώνει απευθείας στην ασφαλιστική» — δεν
    /// περνά ταμείο του γραφείου. Άλλαξε το behavior των εισπράξεων:
    /// δεν παράγει receipt-required warning σε δόσεις που λήγουν.</summary>
    public bool PaidDirectlyToCarrier { get; set; }

    /// <summary>Χαρακτηριστικό — free-form label ορατό παντού σε λίστες/searches.</summary>
    public string? Characteristic { get; set; }
    /// <summary>Απαλλαγή (deductible) € — για κάλυψη υλικών ζημιών, ζωής, ιατρικών.</summary>
    public decimal? Deductible { get; set; }
    /// <summary>Ημερομηνία παράδοσης πρωτότυπου/PDF στον πελάτη.</summary>
    public DateOnly? HandoverDate { get; set; }
    /// <summary>Ημερομηνία που παρελήφθη το φυσικό συμβόλαιο από το γραφείο.</summary>
    public DateOnly? OfficeReceivedAt { get; set; }
    /// <summary>Ιατρικές εξετάσεις (Ζωής / Υγείας) — free-form σημείωση.</summary>
    public string? MedicalExamsNotes { get; set; }
    /// <summary>Ηλικίες τη στιγμή έκδοσης — αναφερόμενες σε reports χωρίς recalc.</summary>
    public int? InsuredAgeAtIssue { get; set; }
    public int? ContractPartyAgeAtIssue { get; set; }
    /// <summary>Θέση/spot (marine/aircraft/parking).</summary>
    public string? Position { get; set; }
    /// <summary>Free-form σημειώσεις στο συμβόλαιο.</summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Per-policy override του <c>LevelPercentsJson</c> στο <see cref="CommissionRule"/>.
    /// Ίδιο shape, JSON: <c>{"Producer":15,"Manager":3,"Agency":40}</c>.
    /// Όταν είναι set, ο <c>PolicyCommissionCalculator</c> τον προτιμά αντί
    /// για τον κανόνα — για συμβόλαια όπου συμφωνήθηκαν ιδιαίτερα ποσοστά.
    /// Null = εφαρμόζεται κανονικά ο μηχανισμός επιλογής κανόνα.
    /// </summary>
    public string? SpecialLevelPercentsJson { get; set; }

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
