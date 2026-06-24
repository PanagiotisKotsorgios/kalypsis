using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/* ============ Billing — installment schedule ============ */

public class Installment : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public int SequenceNumber { get; set; }                     // 1..N within the schedule
    public DateOnly DueDate { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public InstallmentStatus Status { get; set; } = InstallmentStatus.Scheduled;
    public string? Notes { get; set; }

    public ICollection<InstallmentPayment> Payments { get; set; } = new List<InstallmentPayment>();
}

public class InstallmentPayment : TenantEntity
{
    public Guid InstallmentId { get; set; }
    public Installment Installment { get; set; } = null!;

    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    public string Method { get; set; } = "BankTransfer";        // BankTransfer / Card / Cash / SEPA / DiasCode
    public string? Reference { get; set; }                       // bank statement line id, card auth code, etc
    public Guid? BankStatementLineId { get; set; }
}

/* ============ Bank statement import + auto-reconciliation ============ */

public class BankStatementImport : TenantEntity
{
    public string FileName { get; set; } = string.Empty;
    public string Bank { get; set; } = string.Empty;             // Eurobank / Piraeus / Alpha / NBG ...
    public DateTime ImportedAt { get; set; }
    public int TotalLines { get; set; }
    public int MatchedLines { get; set; }
    public int UnmatchedLines { get; set; }

    public ICollection<BankStatementLine> Lines { get; set; } = new List<BankStatementLine>();
}

public class BankStatementLine : TenantEntity
{
    public Guid ImportId { get; set; }
    public BankStatementImport Import { get; set; } = null!;

    public DateOnly TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Reference { get; set; }                       // statement reference, often contains policy number
    public string? CounterpartyName { get; set; }
    public string? CounterpartyIban { get; set; }
    public string? RawLine { get; set; }
    public BankStatementMatchStatus MatchStatus { get; set; } = BankStatementMatchStatus.Unmatched;
    public Guid? MatchedInstallmentId { get; set; }
    public Installment? MatchedInstallment { get; set; }
}

/* ============ myDATA (Greek AADE e-invoicing) ============ */

/// <summary>
/// One e-invoice destined for AADE myDATA. Production adapter serialises this to
/// the official XSD-bound XML and POSTs to the production myDATA endpoint.
/// </summary>
public class MyDataInvoice : TenantEntity
{
    public string InvoiceNumber { get; set; } = string.Empty;
    public string Series { get; set; } = "Α";
    public DateOnly IssueDate { get; set; }
    public MyDataInvoiceStatus Status { get; set; } = MyDataInvoiceStatus.Draft;

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string CustomerVat { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;

    public decimal NetAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal GrossAmount { get; set; }
    public string Currency { get; set; } = "EUR";

    public string DocumentType { get; set; } = "1.1";            // AADE doctype code
    public string? MyDataMark { get; set; }                      // unique MARK returned by AADE
    public string? MyDataUid { get; set; }
    public string? CancellationMark { get; set; }
    public string? RawXml { get; set; }                          // sanitised — no embedded customer secrets
    public string? ErrorMessage { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public ICollection<MyDataInvoiceLine> Lines { get; set; } = new List<MyDataInvoiceLine>();
}

public class MyDataInvoiceLine : TenantEntity
{
    public Guid InvoiceId { get; set; }
    public MyDataInvoice Invoice { get; set; } = null!;

    public int Position { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; } = 1m;
    public decimal UnitPrice { get; set; }
    public decimal VatRate { get; set; } = 24m;
    public string IncomeClassification { get; set; } = "category1_2"; // e.g. category1_2 — AADE classification code
}
