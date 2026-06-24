using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 4 — Datawise / WebInsurer parity
// Risk profiles, carrier coverage options, pending items, payment notices,
// plafond / κουμπαράς, carrier orders, online payments, multi-channel
// messaging, and backoffice bridges.
// ============================================================================

/// <summary>
/// Saved risk profile (Υπερτιμολόγηση). Keyed by registration number for
/// vehicles, by NIN/AFM for individuals, free-text for everything else.
/// Lets the same set of inputs flow across many quote attempts without
/// re-typing — exactly the Datawise super-pricing flow.
/// </summary>
public class RiskProfile : TenantEntity
{
    public string ProductType { get; set; } = string.Empty;     // Auto / Home / Health / …
    public string Key { get; set; } = string.Empty;             // Plate / AFM / arbitrary tag
    public string Label { get; set; } = string.Empty;           // Display name
    public string InputsJson { get; set; } = "{}";              // The risk inputs blob
    public Guid? CustomerId { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public int TimesUsed { get; set; }
}

/// <summary>
/// Per-carrier add-on coverage option (roadside assistance, legal protection,
/// extended pyros etc). The quote engine can apply these "to all carriers"
/// uniformly when the user toggles them.
/// </summary>
public class CoverageOption : TenantEntity
{
    public Guid CarrierConnectionId { get; set; }
    public CarrierConnection? CarrierConnection { get; set; }
    public string Code { get; set; } = string.Empty;            // e.g. ROADSIDE / LEGAL_PROTECTION
    public string Name { get; set; } = string.Empty;
    public string? ProductType { get; set; }
    public CoverageTier? Tier { get; set; }
    public decimal AddonPremium { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Pending items (Εκκρεμότητες) on an application — missing doc, missing data,
/// signature still needed. Resolved when the broker uploads / fills in the gap.
/// </summary>
public class PendingItem : TenantEntity
{
    public Guid PolicyApplicationId { get; set; }
    public PolicyApplication? PolicyApplication { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Category { get; set; }                       // Document / Data / Signature / Other
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedByUserId { get; set; }
}

/// <summary>
/// Payment notice (Ειδοποιητήριο). Carries one of the four Datawise code kinds:
/// D = pre-issuance customer notice paid directly to broker,
/// F = aggregated F-code basket for partner→broker settlement,
/// R = renewal pay-then-issue code,
/// W = new-business pay-then-issue code.
/// </summary>
public class PaymentNotice : TenantEntity
{
    public PaymentNoticeKind Kind { get; set; }
    public string Code { get; set; } = string.Empty;            // D…/F…/R…/W…
    public PaymentNoticeStatus Status { get; set; } = PaymentNoticeStatus.Open;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public Guid? PolicyId { get; set; }
    public Guid? PolicyApplicationId { get; set; }
    public Guid? ProducerId { get; set; }
    public Guid? CustomerId { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime? DueAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }               // bank deposit reference
    public string? Notes { get; set; }
    public List<PaymentNoticeLine> Lines { get; set; } = new();
}

/// <summary>
/// Items inside an aggregated F-code basket. Each line refers to a specific
/// policy/installment the partner is settling in one bulk payment.
/// </summary>
public class PaymentNoticeLine : TenantEntity
{
    public Guid PaymentNoticeId { get; set; }
    public PaymentNotice? PaymentNotice { get; set; }
    public Guid? PolicyId { get; set; }
    public Guid? InstallmentId { get; set; }
    public Guid? PolicyApplicationId { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
}

/// <summary>
/// Partner credit limit (Πλαφόν) — controls whether a producer can charge
/// new policies to credit. Auto-locks when overdue or over-limit.
/// </summary>
public class ProducerPlafond : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }
    public PlafondRegime Regime { get; set; } = PlafondRegime.TypoPlirono;
    public decimal CreditLimit { get; set; }
    public decimal CurrentBalance { get; set; }                 // negative = partner owes us
    public int GraceDays { get; set; } = 15;
    public bool IsLocked { get; set; }
    public DateTime? LockedAt { get; set; }
    public string? LockReason { get; set; }
    public DateTime? OverdueSince { get; set; }
}

/// <summary>
/// Κουμπαράς — prepayment piggy bank ledger per producer. Each line is a
/// top-up (positive) or a debit against a policy/notice (negative). Balance
/// is the sum of lines and feeds ProducerPlafond.CurrentBalance for regime
/// Koumparas.
/// </summary>
public class KoumparasLine : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }
    public DateTime OccurredAt { get; set; }
    public decimal Amount { get; set; }                         // + topup / - debit
    public string? Reference { get; set; }                      // notice code / receipt #
    public Guid? PaymentNoticeId { get; set; }
    public Guid? PolicyId { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Carrier order (Παραγγελία) — partner asks the broker/manager to perform
/// an operation through the carrier portal (issuance, endorsement, cancel)
/// that the platform can't yet automate for that carrier. Manager processes
/// it, attaches the resulting carrier file, and charges the partner's plafond.
/// </summary>
public class CarrierOrder : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer? Producer { get; set; }
    public string CarrierCode { get; set; } = string.Empty;
    public string OperationType { get; set; } = string.Empty;   // Issue / Endorse / Cancel / Other
    public Guid? PolicyId { get; set; }
    public Guid? PolicyApplicationId { get; set; }
    public string InstructionsText { get; set; } = string.Empty;
    public CarrierOrderStatus Status { get; set; } = CarrierOrderStatus.Submitted;
    public DateTime SubmittedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CompletedByUserId { get; set; }
    public string? ResultFileKey { get; set; }                  // attachment in object store
    public string? ResultNotes { get; set; }
    public decimal? ChargedAmount { get; set; }
}

/// <summary>
/// Online payment session — e-pos / ePay / DIAS / Viva / Stripe. Each session
/// references the gateway's external id and the notice/policy/installment it
/// is settling. Webhooks update Status and PaidAt; the reconciler picks it up
/// from there.
/// </summary>
public class OnlinePaymentSession : TenantEntity
{
    public OnlinePaymentGatewayType Gateway { get; set; }
    public OnlinePaymentSessionStatus Status { get; set; } = OnlinePaymentSessionStatus.Created;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? ExternalSessionId { get; set; }
    public string? CheckoutUrl { get; set; }
    public string? RawCreatePayload { get; set; }
    public string? RawCallbackPayload { get; set; }
    public Guid? PaymentNoticeId { get; set; }
    public Guid? PolicyId { get; set; }
    public Guid? InstallmentId { get; set; }
    public Guid? CustomerId { get; set; }
    public DateTime CreatedExternallyAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
}

/// <summary>
/// Backoffice bridge configuration — credentials and toggles for the
/// BlueByte / ALIS / ONESOFT sync. Concrete sync work is logged via
/// CompanyBridge already; this entity stores the destination config.
/// </summary>
public class BackofficeBridgeConnection : TenantEntity
{
    public BackofficeBridge Bridge { get; set; }
    public bool IsEnabled { get; set; }
    public string? BaseUrl { get; set; }
    public string? AccountCode { get; set; }
    public string? UsernameOrClientId { get; set; }
    public string? SecretEncrypted { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public string? LastSyncResult { get; set; }
}

/// <summary>
/// Outbound SMS log — every SMS we send through any provider goes here so
/// the audit trail + delivery status survives the provider call.
/// </summary>
public class SmsLog : TenantEntity
{
    public string Provider { get; set; } = "stub";
    public string ToNumber { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? ProviderMessageId { get; set; }
    public string Status { get; set; } = "Queued";              // Queued / Sent / Delivered / Failed
    public string? FailureReason { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? PolicyId { get; set; }
    public DateTime QueuedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
}

/// <summary>
/// Outbound Viber log — Viber Business Messages are billed and tracked
/// separately from SMS, so a dedicated log.
/// </summary>
public class ViberLog : TenantEntity
{
    public string Provider { get; set; } = "stub";
    public string ToNumber { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? ProviderMessageId { get; set; }
    public string Status { get; set; } = "Queued";
    public string? FailureReason { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? PolicyId { get; set; }
    public DateTime QueuedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
}
