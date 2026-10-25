using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Receipt : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public DateOnly ReceivedOn { get; set; }

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }

    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";

    public string? Notes { get; set; }
    public string? DossierJson { get; set; }
    public Guid? RecordedByUserId { get; set; }
    public User? RecordedByUser { get; set; }

    // Optional external reference — POS terminal id / Ζ report / cheque number /
    // bank tx id — label swaps in the UI depending on Method so it stays useful
    // for whichever channel the receipt was made through.
    public string? TransactionReference { get; set; }
}

public class Payment : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public DateOnly PaidOn { get; set; }

    public BeneficiaryType BeneficiaryType { get; set; }
    public Guid? BeneficiaryInsuranceCompanyId { get; set; }
    public InsuranceCompany? BeneficiaryInsuranceCompany { get; set; }

    public Guid? BeneficiaryProducerId { get; set; }
    public Producer? BeneficiaryProducer { get; set; }

    public string? BeneficiaryName { get; set; }

    public PaymentMethod Method { get; set; } = PaymentMethod.BankTransfer;
    public decimal Amount { get; set; }
    public decimal CommissionsNetted { get; set; }
    /// <summary>Gross producer commission settled by this payment. Amount remains the actual cash movement.</summary>
    public decimal? GrossCommissionAmount { get; set; }
    public decimal? ProducerWithholdingPercent { get; set; }
    public decimal ProducerWithholdingAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Notes { get; set; }

    /// Same shape as Receipt.TransactionReference — bank ref / cheque no / etc.
    public string? TransactionReference { get; set; }

    /// Optional link to the policy the payment settles (if payment is against
    /// a specific policy — e.g. mid-term company billing). Kept nullable for
    /// bulk sweeps to a carrier.
    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }
}

public class Security : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public SecurityKind Kind { get; set; }
    public SecurityStatus Status { get; set; } = SecurityStatus.Open;

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? IssuingBankId { get; set; }
    public BankConnection? IssuingBank { get; set; }

    public DateOnly IssueDate { get; set; }
    public DateOnly MaturityDate { get; set; }
    public DateOnly? PaidDate { get; set; }

    public decimal Amount { get; set; }
    /// <summary>Amount honoured/settled so far. Kept separate from face value.</summary>
    public decimal SettledAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    /// <summary>Incoming means held for collection; outgoing means issued to a payee.</summary>
    public string Direction { get; set; } = "Incoming";
    public string PartyKind { get; set; } = "Customer";
    public Guid? PartyId { get; set; }
    public string PartyName { get; set; } = string.Empty;
    public string? BankAccount { get; set; }
    public string? DrawerName { get; set; }
    public string? HolderName { get; set; }
    public string? EndorserName { get; set; }
    public string? PlaceOfIssue { get; set; }
    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }
    public string? Notes { get; set; }

    public ICollection<SecurityEvent> Events { get; set; } = new List<SecurityEvent>();
}

/// <summary>Append-only business history for receipt, transfer, settlement and reversal actions.</summary>
public class SecurityEvent : TenantEntity
{
    public Guid SecurityId { get; set; }
    public Security Security { get; set; } = null!;
    public string Kind { get; set; } = "Received";
    public DateTime OccurredOn { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; }
    public string? Counterparty { get; set; }
    public Guid? ReversesEventId { get; set; }
    /// <summary>Primary accounting document created by this settlement, if any.</summary>
    public Guid? ReceiptId { get; set; }
    public Guid? PaymentId { get; set; }
    /// <summary>Auditable before/after values for edits and transfers.</summary>
    public string? PreviousValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Manual/legacy debit-credit account line for a customer, producer or insurer.</summary>
public class PartyLedgerEntry : TenantEntity
{
    public string PartyKind { get; set; } = "Customer";
    public Guid PartyId { get; set; }
    public DateTime EntryDate { get; set; } = DateTime.UtcNow;
    public DateTime? DueDate { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Description { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
    public Guid? PolicyId { get; set; }
    public string? CollectionCentreCode { get; set; }
    public string? CostCentreCode { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Applies an existing credit to a debit without creating a second ledger movement.</summary>
public class LedgerAllocation : TenantEntity
{
    public Guid DebitEntryId { get; set; }
    public Guid CreditEntryId { get; set; }
    public decimal Amount { get; set; }
    public DateTime AllocatedOn { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}

/// <summary>Effective-dated receivable limits applied before policy exposure increases.</summary>
public class CreditControlRule : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }
    public PolicyType? PolicyType { get; set; }
    public string? Currency { get; set; }
    public decimal? MaximumOutstanding { get; set; }
    public int? MaximumOverdueDays { get; set; }
    public int? MaximumOpenPolicies { get; set; }
    public DateOnly EffectiveFrom { get; set; } = DateOnly.MinValue;
    public DateOnly? EffectiveTo { get; set; }
    public bool IsException { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public class FinancialMovement : TenantEntity
{
    public DateOnly MovementDate { get; set; }
    public FinancialMovementKind Kind { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Description { get; set; }

    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public Guid? ReceiptId { get; set; }
    public Receipt? Receipt { get; set; }

    public Guid? PaymentId { get; set; }
    public Payment? Payment { get; set; }
}

public class BankConnection : TenantEntity
{
    public string BankName { get; set; } = string.Empty;
    public string? Iban { get; set; }
    public string? Bic { get; set; }
    public string? AccountName { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime? LastSyncedAt { get; set; }
}
