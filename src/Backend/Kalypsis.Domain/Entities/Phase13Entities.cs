using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 13 — Complete BluByte parity. Remaining 80+ items grouped by area.
// ============================================================================

// ----- Integration settings (credentials per service, encrypted) -----
public class IntegrationSetting : TenantEntity
{
    public string Service { get; set; } = string.Empty;          // "Aade" / "Gemi" / "Dias" / "Usae" / "Tachypay" / "Sap" / "InfoCenter"
    public string KeyName { get; set; } = string.Empty;          // "Username" / "Password" / "Endpoint" / "ApiKey"
    public string? Value { get; set; }                            // stored as-is; encryption at infra layer
    public bool IsSecret { get; set; }                            // hide on read for non-admin
    public string? Notes { get; set; }
}

// ----- Σχεδιαστής Αρχείων (custom fields engine) -----
public class CustomFieldDefinition : TenantEntity
{
    public string EntityType { get; set; } = string.Empty;        // Customer / Producer / Policy / Claim / Vehicle ...
    public string Code { get; set; } = string.Empty;              // unique within entity type
    public string Label { get; set; } = string.Empty;
    public string Kind { get; set; } = "Text";                    // Text / Number / Date / Boolean / Select / Lookup
    public string? Options { get; set; }                          // pipe-separated for Select
    public string? LookupEntity { get; set; }                     // when Kind = Lookup
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string? HelpText { get; set; }
}

public class CustomFieldValue : TenantEntity
{
    public Guid FieldId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }                            // FK to whatever EntityType refers to
    public string? Value { get; set; }
    public CustomFieldDefinition? Field { get; set; }
}

// ----- Είδη Κινήσεων (movement type configurator) -----
public class MovementType : TenantEntity
{
    public string Code { get; set; } = string.Empty;              // CHARGE_CUSTOMER, COMMISSION_IN, etc.
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Charge";              // Charge / Receipt / Payment / Commission / Prepayment / Reversal
    public string Party { get; set; } = "Customer";               // Customer / Producer / Carrier / Vendor
    public bool AutoChargeCustomer { get; set; }                  // auto-create matching customer charge
    public bool AutoOffsetCarrier { get; set; }                   // auto-create matching carrier movement
    public Guid? GlAccountId { get; set; }                         // GL account this type posts to
    public string ReceiptNumberPrefix { get; set; } = string.Empty;
    public int ReceiptPadding { get; set; } = 6;
    public bool IsCashType { get; set; }                          // true = cash drawer, false = on-account
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

// ----- Bonus-Malus engine -----
public class BonusMalusRule : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid? InsuranceCompanyId { get; set; }                  // null = applies to all carriers
    public string PolicyTypeFilter { get; set; } = "Auto";         // Auto / Home / Health / ...
    public int ClaimsCountFrom { get; set; }                       // inclusive
    public int ClaimsCountTo { get; set; }                         // inclusive
    public decimal AdjustmentPercent { get; set; }                 // -25 = 25% discount, +50 = 50% malus
    public string AdjustmentDirection { get; set; } = "Premium";   // Premium / Commission / Both
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
}

// ----- Renewal rules (declarative engine) -----
public class RenewalRule : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string PolicyTypeFilter { get; set; } = "*";            // * = all
    public Guid? InsuranceCompanyId { get; set; }
    public string ConditionJson { get; set; } = "{}";              // {"claims_lt":1,"age_lt":30}
    public string ActionJson { get; set; } = "{}";                  // {"discount":15,"flag":"young-driver"}
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

// ----- Μητρώα (policy register column designer) -----
public class RegisterTemplate : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PolicyTypeFilter { get; set; } = "*";
    public string ColumnsJson { get; set; } = "[]";                // [{"field":"PolicyNumber","label":"Αρ.","width":120}]
    public bool ShowSubtotals { get; set; }
    public string? GroupByField { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
}

// ----- Προκαταβολές (advance payments / prepayments) -----
public class AdvancePayment : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public DateOnly ReceivedOn { get; set; }
    public string PartyType { get; set; } = "Customer";            // Customer / Producer / Carrier
    public Guid? CustomerId { get; set; }
    public Guid? ProducerId { get; set; }
    public Guid? InsuranceCompanyId { get; set; }
    public decimal Amount { get; set; }
    public decimal AllocatedAmount { get; set; }                    // how much has been matched to policies/receipts
    public string Currency { get; set; } = "EUR";
    public string PaymentMethod { get; set; } = "BankTransfer";
    public string? Reference { get; set; }
    public string Status { get; set; } = "Open";                    // Open / PartiallyAllocated / FullyAllocated / Refunded
    public string? Notes { get; set; }
}

// ----- Συσχέτιση Κινήσεων (movement reconciliation) -----
public class ReconciliationLink : TenantEntity
{
    public string SourceType { get; set; } = string.Empty;          // "Receipt" / "Payment" / "Advance"
    public Guid SourceId { get; set; }
    public string TargetType { get; set; } = string.Empty;          // "Policy" / "Receipt" / "Commission"
    public Guid TargetId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public DateOnly LinkedOn { get; set; }
    public Guid? LinkedByUserId { get; set; }
    public string? Notes { get; set; }
}

// ----- Ταχυπληρωμές (postal payment slips - ΕΛ.ΤΑ) -----
public class TachyPaymentBatch : TenantEntity
{
    public string BatchNumber { get; set; } = string.Empty;
    public DateOnly DueDate { get; set; }
    public int PolicyCount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Status { get; set; } = "Created";                 // Created / Exported / Settled / Cancelled
    public string? ExportFilePath { get; set; }
    public string? Notes { get; set; }
}

public class TachyPaymentLine : TenantEntity
{
    public Guid BatchId { get; set; }
    public Guid PolicyId { get; set; }
    public string PaymentCode { get; set; } = string.Empty;          // ΕΛ.ΤΑ. code
    public decimal Amount { get; set; }
    public decimal Surcharge { get; set; }                            // bank fee
    public string Status { get; set; } = "Pending";                  // Pending / Paid / Cancelled
    public DateOnly? PaidAt { get; set; }
    public TachyPaymentBatch? Batch { get; set; }
    public Policy? Policy { get; set; }
}

// ----- vCard/Outlook export log -----
public class ContactExportLog : TenantEntity
{
    public string EntityType { get; set; } = string.Empty;          // Customer / Producer / Company
    public Guid EntityId { get; set; }
    public string Format { get; set; } = "vCard";                   // vCard / Outlook / Csv
    public DateTime ExportedAt { get; set; }
    public Guid? ExportedByUserId { get; set; }
}

// ----- Editable / mail-merge documents (Επεξεργάσιμα Έγγραφα — extending DocumentTemplate semantics) -----
public class EditableDocument : TenantEntity
{
    public Guid TemplateId { get; set; }                             // FK to DocumentTemplate
    public string EntityType { get; set; } = string.Empty;          // Customer / Policy / Claim
    public Guid EntityId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string RenderedHtml { get; set; } = string.Empty;
    public string? FileKey { get; set; }                              // storage key when frozen to PDF
    public bool IsFinalised { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

// ----- Greek Info Center export (Ελληνικό Κέντρο Πληροφοριών) -----
public class InfoCenterExport : TenantEntity
{
    public string BatchNumber { get; set; } = string.Empty;
    public string Kind { get; set; } = "Vehicles";                  // Vehicles / Customers / Policies
    public int RecordCount { get; set; }
    public string Status { get; set; } = "Created";                 // Created / Submitted / Accepted / Rejected
    public string? FileKey { get; set; }
    public string? ResponseCode { get; set; }
    public string? Notes { get; set; }
}

// ----- SAP / GL bridge config -----
public class SapBridgeMapping : TenantEntity
{
    public Guid MovementTypeId { get; set; }
    public string SapAccount { get; set; } = string.Empty;
    public string? CostCenter { get; set; }
    public string? ProfitCenter { get; set; }
    public bool ExportEnabled { get; set; } = true;
    public MovementType? MovementType { get; set; }
}

// ----- Period locks (Οριακή Ημερομηνία Επεξεργασίας) -----
public class PeriodLock : TenantEntity
{
    public DateOnly LockedBefore { get; set; }                       // no edits to records before this date
    public string Scope { get; set; } = "All";                       // All / Policies / Receipts / Claims
    public bool AutoAdvanceDaily { get; set; }
    public string? Reason { get; set; }
}
