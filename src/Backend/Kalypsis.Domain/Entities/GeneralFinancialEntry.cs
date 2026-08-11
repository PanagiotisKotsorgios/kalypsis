using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Free-form γενικά έσοδα/έξοδα γραφείου that don't come from an insurance
/// policy — rent, utilities, salaries, office supplies, non-insurance income,
/// bank fees, misc. Categorised so the office can produce a monthly P&amp;L
/// alongside the auto-generated FinancialMovement rows.
/// </summary>
public class GeneralFinancialEntry : TenantEntity
{
    /// <summary>Income | Expense.</summary>
    public string Kind { get; set; } = "Expense";
    /// <summary>Freeform category label (Ενοίκιο, Μισθοδοσία, Λογαριασμοί, Εκπαίδευση, Άλλο …).</summary>
    public string Category { get; set; } = "";
    /// <summary>Optional sub-category for finer P&amp;L rollup.</summary>
    public string? Subcategory { get; set; }
    public DateTime EntryDate { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Description { get; set; }
    /// <summary>Optional counterparty (supplier, employee, bank).</summary>
    public string? Counterparty { get; set; }
    /// <summary>Optional invoice / receipt reference.</summary>
    public string? Reference { get; set; }
    /// <summary>Optional linked policy / customer if applicable (e.g. reimbursement).</summary>
    public Guid?  PolicyId    { get; set; }
    public Guid?  CustomerId  { get; set; }
    public Guid?  ProducerId  { get; set; }
    public Guid?  EnteredByUserId { get; set; }
}
