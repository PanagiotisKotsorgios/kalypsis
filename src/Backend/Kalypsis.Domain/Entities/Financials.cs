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

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid? IssuingBankId { get; set; }
    public BankConnection? IssuingBank { get; set; }

    public DateOnly IssueDate { get; set; }
    public DateOnly MaturityDate { get; set; }
    public DateOnly? PaidDate { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
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
