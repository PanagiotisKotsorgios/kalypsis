using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Ad-hoc chargeable item added to a tenant by the superadmin — training
/// hours, migration flat fees, custom development, etc. Priced independently
/// of the subscription plan and rolled up into the next monthly invoice
/// when it's generated.
///
/// A row is «pending» until <see cref="InvoiceLineId"/> is set — that pointer
/// gets filled the moment the item lands on an issued invoice, at which point
/// its price is frozen and future edits to the source row don't retroactively
/// alter historic invoices.
/// </summary>
public class TenantChargeable : BaseEntity
{
    public Guid TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    /// <summary>e.g. «RemoteTraining», «OnsiteTraining», «DataMigration»,
    /// «CustomDevelopment». Free-text so it can hold anything the superadmin
    /// needs to invoice for.</summary>
    public string ServiceCode { get; set; } = string.Empty;

    /// <summary>Human-readable description that lands on the invoice line
    /// («Remote training · 4 ώρες με τον διαχειριστή», etc.).</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>«ώρα», «flat», «user», «μήνα» — used only for display.</summary>
    public string UnitLabel { get; set; } = "flat";

    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; } = 1;

    /// <summary>Computed at write-time (`UnitPrice × Quantity`) so historic
    /// rows stay correct if the default price catalog changes later.</summary>
    public decimal LineTotal { get; set; }

    /// <summary>Date the service was actually performed / commitment made.
    /// Used to pick the invoice period.</summary>
    public DateTime PerformedOn { get; set; }

    /// <summary>Optional notes for the superadmin («ζητήθηκε από τον Παπαδόπουλο,
    /// έγινε στις 12/07»).</summary>
    public string? Notes { get; set; }

    /// <summary>Populated when the row is rolled into an invoice. Nullable
    /// = «pending», i.e. still visible in the next generation cycle.</summary>
    public Guid? InvoiceLineId { get; set; }
    public TenantInvoiceLine? InvoiceLine { get; set; }

    /// <summary>Set when the operator marks the charge as paid directly
    /// (bypass invoice for cash / in-hand payment). Independent from
    /// InvoiceLineId — a chargeable can be either invoiced OR marked
    /// paid directly, but not both.</summary>
    public DateTime? PaidAt { get; set; }
    public string? PaidReference { get; set; }
}
