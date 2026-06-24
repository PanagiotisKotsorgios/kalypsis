using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 11 — Remaining ALIS gap items. Each entity drives one screen in the
// BackOffice and closes a feature ALIS has that we previously did not.
// ============================================================================

// ----- Ομαδικά συμβόλαια (Group policies) -----
public class GroupPolicy : TenantEntity
{
    public string GroupNumber { get; set; } = string.Empty;        // αρ. ομάδας
    public string Name { get; set; } = string.Empty;                // π.χ. "Υπάλληλοι ΧΥΖ ΑΕ"
    public Guid PolicyHolderCustomerId { get; set; }                // legal entity που πληρώνει
    public Guid InsuranceCompanyId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public decimal Premium { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Status { get; set; } = "Active";                  // Active/Suspended/Expired
    public int MemberCount { get; set; }
    public string? Notes { get; set; }

    public Customer? PolicyHolder { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }
    public List<GroupPolicyMember> Members { get; set; } = new();
}

public class GroupPolicyMember : TenantEntity
{
    public Guid GroupPolicyId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Afm { get; set; }
    public string? Amka { get; set; }
    public DateOnly? BirthDate { get; set; }
    public string? Relationship { get; set; }                        // self / spouse / child
    public DateOnly EnrolledFrom { get; set; }
    public DateOnly? EnrolledTo { get; set; }
    public decimal? IndividualPremium { get; set; }

    public GroupPolicy? GroupPolicy { get; set; }
}

// ----- Προβλέψεις (Reserves / IBNR per claim) -----
public class ClaimProvision : TenantEntity
{
    public Guid ClaimId { get; set; }
    public decimal ReserveAmount { get; set; }                       // εκτιμώμενο ποσό
    public decimal? IncurredButNotReported { get; set; }             // IBNR
    public string Currency { get; set; } = "EUR";
    public DateOnly EvaluationDate { get; set; }
    public string? AssessorName { get; set; }
    public string? Notes { get; set; }

    public Claim? Claim { get; set; }
}

// ----- Αποζημιώσεις (Indemnity payouts on claims) -----
public class ClaimIndemnity : TenantEntity
{
    public Guid ClaimId { get; set; }
    public string PaymentNumber { get; set; } = string.Empty;        // αρ. πληρωμής
    public DateOnly PaidOn { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string PayeeType { get; set; } = "Customer";              // Customer/Garage/Hospital/Other
    public string? PayeeName { get; set; }
    public Guid? GarageId { get; set; }
    public string PaymentMethod { get; set; } = "BankTransfer";
    public string? Reference { get; set; }                            // αρ. τραπεζικής κίνησης
    public string? Notes { get; set; }

    public Claim? Claim { get; set; }
    public Garage? Garage { get; set; }
}

// ----- Συνεργεία (Approved garages / repair shops) -----
public class Garage : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Afm { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Specialty { get; set; }                            // car / motorcycle / glass / body
    public bool IsApproved { get; set; } = true;                      // εγκεκριμένο
    public string? Iban { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

// ----- Λογιστικό σχέδιο (GL chart of accounts) -----
public class GlAccount : TenantEntity
{
    public string Code { get; set; } = string.Empty;                  // π.χ. "60.01"
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Expense";                     // Asset/Liability/Equity/Revenue/Expense
    public string? Category { get; set; }                              // free-form grouping
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

// ----- Άρθρα GL (GL journal entries — έσοδα/έξοδα) -----
public class GlEntry : TenantEntity
{
    public string EntryNumber { get; set; } = string.Empty;           // αρ. άρθρου
    public DateOnly EntryDate { get; set; }
    public Guid AccountId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Debit { get; set; }                                 // χρέωση
    public decimal Credit { get; set; }                                // πίστωση
    public string Currency { get; set; } = "EUR";
    public string? RelatedDocumentRef { get; set; }                    // link to receipt/payment/etc.
    public Guid? CustomerId { get; set; }
    public Guid? ProducerId { get; set; }
    public Guid? PolicyId { get; set; }

    public GlAccount? Account { get; set; }
}

// ----- Κατάσταση ταμείου (Cash drawer / cashbox snapshot) -----
public class CashAccount : TenantEntity
{
    public string Code { get; set; } = string.Empty;                  // π.χ. "ΤΑΜ-01"
    public string Name { get; set; } = string.Empty;                  // π.χ. "Ταμείο γραφείου"
    public string Currency { get; set; } = "EUR";
    public decimal CurrentBalance { get; set; }                        // running balance — recomputed nightly
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public class CashMovement : TenantEntity
{
    public Guid CashAccountId { get; set; }
    public DateOnly MovementDate { get; set; }
    public string Direction { get; set; } = "In";                      // In / Out
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Reason { get; set; } = string.Empty;                 // εισπραξη / πληρωμή / αναλήψη
    public string? Reference { get; set; }
    public Guid? RelatedReceiptId { get; set; }
    public Guid? RelatedPaymentId { get; set; }

    public CashAccount? CashAccount { get; set; }
}

// ----- Εορτολόγιο πελατών (Customer name-days) -----
public class NameDay : TenantEntity
{
    public string Name { get; set; } = string.Empty;                   // π.χ. "Γιώργος"
    public int Month { get; set; }                                      // 1..12
    public int Day { get; set; }                                        // 1..31
    public string? Notes { get; set; }                                  // π.χ. "Αγ. Γεωργίου"
    public bool IsActive { get; set; } = true;
}

// ----- Διαβιβάσεις myDATA (Tax authority transmissions) -----
public class MyDataSubmission : TenantEntity
{
    public string SubmissionNumber { get; set; } = string.Empty;        // εσωτερικός α/α
    public string TransmissionKind { get; set; } = "Income";            // Income/Expense/Cancel
    public DateOnly PeriodFrom { get; set; }
    public DateOnly PeriodTo { get; set; }
    public DateTime SubmittedAt { get; set; }
    public string Status { get; set; } = "Pending";                     // Pending/Accepted/Rejected
    public int InvoiceCount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? AadeMark { get; set; }                                // ΜΑΡΚ που γυρίζει η ΑΑΔΕ
    public string? AadeUid { get; set; }                                 // UID
    public string? ErrorMessage { get; set; }
    public string? Notes { get; set; }
}

// ----- Σχεδιασμός εντύπων + κανόνες αρίθμησης (Document templates + numbering rules) -----
public class DocumentTemplate : TenantEntity
{
    public string Code { get; set; } = string.Empty;                    // RECEIPT, PAYMENT, POLICY_PRINT
    public string Name { get; set; } = string.Empty;
    public string Kind { get; set; } = "Receipt";                       // Receipt/Payment/Policy/Letter/Other
    public string PageSize { get; set; } = "A4";                        // A4 / A5 / Thermal80mm
    public string Orientation { get; set; } = "Portrait";
    public string? HeaderHtml { get; set; }                              // logo/agency block
    public string? BodyHtml { get; set; }                                // Handlebars-like template body
    public string? FooterHtml { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
}

public class DocumentNumberingRule : TenantEntity
{
    public string DocumentKind { get; set; } = "Receipt";               // Receipt/Payment/CreditNote/Policy
    public string Prefix { get; set; } = string.Empty;                  // π.χ. "ΑΠ-"
    public string Suffix { get; set; } = string.Empty;                  // π.χ. "/2026"
    public int Padding { get; set; } = 6;                                // 000001
    public int NextNumber { get; set; } = 1;
    public int? ResetYear { get; set; }                                  // reset annually
    public bool IsActive { get; set; } = true;
}
