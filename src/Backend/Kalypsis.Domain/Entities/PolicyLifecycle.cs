using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 9 — Policy lifecycle operations (endorsements, cancellations, credit
// notes). These are the ALIS-equivalent "Πρόσθετες πράξεις / Ακυρώσεις /
// Πιστωτικά" workflows — the core day-to-day activity of a Greek broker that
// touches every existing policy after issuance.
// ============================================================================

/// <summary>
/// Endorsement type — what kind of modification the πρόσθετη πράξη performs.
/// Drives the UI form, the premium-delta sign rules, and the commission rules.
/// </summary>
public enum EndorsementType
{
    AddCoverage = 1,        // Προσθήκη κάλυψης
    RemoveCoverage = 2,     // Αφαίρεση κάλυψης
    ChangeData = 3,         // Αλλαγή στοιχείων (address, name, plate, etc.)
    PartialCancel = 4,      // Μερική ακύρωση κάλυψης
    PremiumAdjustment = 5,  // Αναπροσαρμογή ασφαλίστρου
    AddressChange = 6,      // Αλλαγή διεύθυνσης
    BeneficiaryChange = 7,  // Αλλαγή δικαιούχου
    InsuredObjectChange = 8,// Αλλαγή ασφ. αντικειμένου (e.g. swap car)
    Reissue = 9,            // Επανέκδοση
    Other = 99
}

public enum EndorsementStatus
{
    Draft = 1,
    Issued = 2,
    Cancelled = 3
}

/// <summary>
/// A single endorsement (πρόσθετη πράξη) on an existing policy. Tracks the
/// premium delta (positive = additional charge, negative = refund), the
/// commission delta, the effective dates, and an attachment for the carrier's
/// PDF if available.
/// </summary>
public class PolicyEndorsement : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public string EndorsementNumber { get; set; } = string.Empty;   // unique per tenant — "PP-2026-00001"
    public EndorsementType Type { get; set; }
    public EndorsementStatus Status { get; set; } = EndorsementStatus.Draft;

    public DateOnly IssuedAt { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    public string Description { get; set; } = string.Empty;
    public string? CarrierReference { get; set; }                    // carrier's own endorsement #

    public decimal PremiumDelta { get; set; }                        // signed
    public decimal CommissionDelta { get; set; }                     // signed
    public string Currency { get; set; } = "EUR";

    /// <summary>Free-form JSON snapshot of what changed (oldValue/newValue pairs).</summary>
    public string? ChangesJson { get; set; }

    public string? DocumentFileKey { get; set; }
    public string? Notes { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReasonText { get; set; }
}

/// <summary>
/// Catalog of cancellation reasons per tenant (Greek market practice — each
/// agency curates their own list, but a starter set is seeded).
/// </summary>
public class CancellationReason : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool TriggersRefund { get; set; } = true;
    public bool TriggersCreditNote { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public enum PolicyCancellationStatus
{
    Draft = 1,
    Submitted = 2,        // sent to carrier
    Approved = 3,         // carrier confirmed
    Rejected = 4,
    Effective = 5         // applied — policy now Cancelled
}

/// <summary>
/// Cancellation request on a policy (Ακύρωση). Full or partial; separate from
/// the policy's own <see cref="Domain.Enums.PolicyStatus.Cancelled"/> status —
/// this is the workflow object that ends up flipping it. Computes refund
/// according to pro-rata or short-rate (carrier-specific).
/// </summary>
public class PolicyCancellation : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public string CancellationNumber { get; set; } = string.Empty;   // "AK-2026-00001"
    public PolicyCancellationStatus Status { get; set; } = PolicyCancellationStatus.Draft;

    public Guid? ReasonId { get; set; }
    public CancellationReason? Reason { get; set; }
    public string? ReasonText { get; set; }                          // free-form notes

    public DateOnly RequestedAt { get; set; }
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>
    /// Pro-rata = (remaining-days / total-days) × premium. Short-rate = carrier
    /// formula (typically 10-25% penalty). Set by the form.
    /// </summary>
    public string RefundMethod { get; set; } = "ProRata";            // ProRata / ShortRate / Full / Custom
    public decimal RefundAmount { get; set; }
    public decimal? PenaltyAmount { get; set; }
    public decimal? CommissionClawback { get; set; }
    public string Currency { get; set; } = "EUR";

    public Guid? CreditNoteId { get; set; }
    public CreditNote? CreditNote { get; set; }

    public string? CarrierReference { get; set; }
    public string? DocumentFileKey { get; set; }
    public string? Notes { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

public enum CreditNoteKind
{
    CancellationRefund = 1,    // ακύρωση -> refund
    PremiumDecrease = 2,        // endorsement that reduces premium
    CommissionAdjustment = 3,
    Manual = 99
}

public enum CreditNoteStatus
{
    Draft = 1,
    Issued = 2,
    Applied = 3,                // posted against a receivable
    Cancelled = 4
}

/// <summary>
/// Πιστωτικό σημείωμα — credit issued to a customer or carrier for refunds,
/// commission adjustments, or manual corrections. Idempotent reference to the
/// source operation (Cancellation/Endorsement) so the ledger reconciles.
/// </summary>
public class CreditNote : TenantEntity
{
    public string CreditNoteNumber { get; set; } = string.Empty;     // "PI-2026-00001"
    public CreditNoteKind Kind { get; set; }
    public CreditNoteStatus Status { get; set; } = CreditNoteStatus.Draft;

    public DateOnly IssuedAt { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }

    public decimal Amount { get; set; }
    public decimal? VatAmount { get; set; }
    public string Currency { get; set; } = "EUR";

    public string Description { get; set; } = string.Empty;
    public string? RelatedDocumentRef { get; set; }                  // original receipt # / endorsement #
    public Guid? AppliedToReceiptId { get; set; }                    // when consumed
    public DateTime? AppliedAt { get; set; }

    public string? DocumentFileKey { get; set; }
    public string? Notes { get; set; }

    public Guid? CreatedByUserId { get; set; }
}
