using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/* ============ Multi-level commission splits ============ */

/// <summary>
/// One commission slice. A single carrier-paid commission can fan out into
/// many splits (agency / manager / agent / sub-agent). Clawbacks are recorded
/// as negative splits with the same ParentTransactionId.
/// </summary>
public class CommissionSplit : TenantEntity
{
    public Guid ParentTransactionId { get; set; }
    public CommissionTransaction ParentTransaction { get; set; } = null!;

    public Guid? RecipientUserId { get; set; }
    public User? RecipientUser { get; set; }

    public Guid? RecipientProducerId { get; set; }
    public Producer? RecipientProducer { get; set; }

    public string Role { get; set; } = "Agent";                  // Agency / Manager / Agent / SubAgent
    public decimal Percentage { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";

    public bool IsClawback { get; set; }
    public DateOnly? SettledOn { get; set; }
    public string? Notes { get; set; }
}

/* ============ OCR + document index ============ */

public class DocumentExtraction : TenantEntity
{
    public Guid DocumentId { get; set; }
    public PolicyDocument Document { get; set; } = null!;

    public string Provider { get; set; } = "stub";              // tesseract / aws-textract / azure-form-recognizer / openai
    public string? TextContent { get; set; }                    // full extracted text
    public string? StructuredJson { get; set; }                 // {policyNumber, premium, dates...}
    public double Confidence { get; set; }
    public DateTime ExtractedAt { get; set; }
    public string? Language { get; set; }
}

public class FileScanResult : TenantEntity
{
    public string FileKey { get; set; } = string.Empty;          // storage key (e.g. s3://bucket/x)
    public string Scanner { get; set; } = "stub";                // clamav / windows-defender / cloud-av
    public bool Clean { get; set; }
    public string? Verdict { get; set; }                         // OK / suspicious / infected
    public string? Signature { get; set; }                       // detected threat name
    public DateTime ScannedAt { get; set; }
}

/* ============ Workflow rules ============ */

public class WorkflowRule : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public WorkflowEvent TriggerEvent { get; set; }
    public string? ConditionsJson { get; set; }                  // { "policyType": "Auto", "premium>": 500 }
    public bool IsActive { get; set; } = true;
    public int Priority { get; set; } = 100;
    public ICollection<WorkflowRuleAction> Actions { get; set; } = new List<WorkflowRuleAction>();
}

public class WorkflowRuleAction : TenantEntity
{
    public Guid RuleId { get; set; }
    public WorkflowRule Rule { get; set; } = null!;

    public WorkflowAction Action { get; set; }
    public int Order { get; set; }
    public string PayloadJson { get; set; } = "{}";              // shape depends on Action
}

public class WorkflowExecution : TenantEntity
{
    public Guid? RuleId { get; set; }
    public WorkflowRule? Rule { get; set; }

    public WorkflowEvent Event { get; set; }
    public string? EntityRef { get; set; }                       // "Policy:{id}", "Customer:{id}"
    public DateTime ExecutedAt { get; set; }
    public bool Success { get; set; }
    public string? ResultSummary { get; set; }
}

/* ============ Inbound mailbox sync ============ */

public class MailboxConnection : TenantEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public MailboxProvider Provider { get; set; }
    public string EmailAddress { get; set; } = string.Empty;
    public string? AccessTokenEncrypted { get; set; }
    public string? RefreshTokenEncrypted { get; set; }
    public DateTime? AccessTokenExpiresAt { get; set; }

    // Custom IMAP settings — only used when Provider == Imap
    public string? ImapHost { get; set; }
    public int? ImapPort { get; set; }
    public string? ImapUsername { get; set; }
    public string? ImapPasswordEncrypted { get; set; }

    public DateTime? LastSyncedAt { get; set; }
    public string? LastSyncStatus { get; set; }
    public bool IsActive { get; set; } = true;
}

public class InboundMail : TenantEntity
{
    public Guid MailboxConnectionId { get; set; }
    public MailboxConnection MailboxConnection { get; set; } = null!;

    public string? MessageId { get; set; }
    public string? ThreadId { get; set; }
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? BodyText { get; set; }
    public string? BodyHtml { get; set; }
    public DateTime ReceivedAt { get; set; }

    public Guid? MatchedCustomerId { get; set; }
    public Customer? MatchedCustomer { get; set; }
    public bool Ignored { get; set; }
}

/* ============ Telephony / VoIP ============ */

public class TelephonyConnection : TenantEntity
{
    public string Provider { get; set; } = string.Empty;          // Twilio / Vonage / Voipfone / Modulus
    public string? AccountSidEncrypted { get; set; }
    public string? AuthTokenEncrypted { get; set; }
    public string? CallerIdNumber { get; set; }
    public bool RecordingEnabled { get; set; }
    public string? WebhookSecret { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CallRecord : TenantEntity
{
    public Guid? UserId { get; set; }                             // agency user who took/made the call
    public User? User { get; set; }
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public CallDirection Direction { get; set; }
    public CallStatus Status { get; set; }
    public string FromNumber { get; set; } = string.Empty;
    public string ToNumber { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? DurationSeconds { get; set; }

    public string? RecordingUrl { get; set; }                     // resolved at runtime against telephony provider
    public Guid? TranscriptId { get; set; }
    public Transcript? Transcript { get; set; }
    public string? ProviderCallId { get; set; }
}

/* ============ Audio transcription ============ */

public class Transcript : TenantEntity
{
    public string Provider { get; set; } = "stub";                // whisper / aws-transcribe / azure-speech
    public string Language { get; set; } = "el";
    public double? Confidence { get; set; }
    public string FullText { get; set; } = string.Empty;
    public string? SegmentsJson { get; set; }                     // [{start, end, speaker, text}, ...]
    public DateTime TranscribedAt { get; set; }
}

/* ============ AI assistants ============ */

public class AiInvocation : TenantEntity
{
    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public AiTaskType TaskType { get; set; }
    public string Model { get; set; } = "stub";
    public string? PromptRedacted { get; set; }                  // never the raw customer data — always summarised
    public string? ResponseRedacted { get; set; }
    public int? PromptTokens { get; set; }
    public int? CompletionTokens { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ChurnScore : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public double Score { get; set; }                            // 0..1, higher = more at-risk
    public string Band { get; set; } = "Unknown";                // Safe / Watch / At-risk / Critical
    public string? TopFactorsJson { get; set; }                  // [{ factor, weight, description }, ...]
    public DateTime ComputedAt { get; set; }
}

/* ============ Sub-agent hierarchy ============ */

/// <summary>
/// Extra layer over Producer to support the Sub-agent depth that big agency
/// networks use. A Producer can have a parent producer which in turn rolls up.
/// </summary>
public class ProducerHierarchyLink : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer Producer { get; set; } = null!;
    public Guid ParentProducerId { get; set; }
    public Producer ParentProducer { get; set; } = null!;
    public string Role { get; set; } = "SubAgent";                // SubAgent / Manager / Director
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

/* ============ Subscription billing (Stripe / Paddle) ============ */

public class TenantSubscription : TenantEntity
{
    public string ProviderCode { get; set; } = "stub";           // stripe / paddle / stub
    public string? ProviderSubscriptionId { get; set; }
    public string? ProviderCustomerId { get; set; }
    public string Plan { get; set; } = "Trial";                  // matches SubscriptionPlan enum
    public SubscriptionState State { get; set; } = SubscriptionState.Trial;
    public DateOnly? CurrentPeriodStart { get; set; }
    public DateOnly? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public string? PaymentMethodLast4 { get; set; }
    public string? LastWebhookEventId { get; set; }
    public DateTime? LastWebhookAt { get; set; }

    // Phase 6 — Per-office surcharge for multi-branch agencies.
    // The HQ office is included in the base subscription; every additional
    // active office triggers OfficeSurchargeAmount per billing period.
    public int OfficeIncludedCount { get; set; } = 1;
    public decimal OfficeSurchargeAmount { get; set; }
    public string OfficeSurchargeCurrency { get; set; } = "EUR";
}

public class SubscriptionUsage : TenantEntity
{
    public DateOnly Month { get; set; }                          // 1st of month
    public int UsersActive { get; set; }
    public int CustomerCount { get; set; }
    public int PolicyCount { get; set; }
    public int SmsSent { get; set; }
    public long StorageBytes { get; set; }
    public int ApiCalls { get; set; }
}

/* ============ Custom Report Builder ============ */

public class ReportDefinition : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public ReportEntity Entity { get; set; }
    public Guid? OwnerUserId { get; set; }
    public User? OwnerUser { get; set; }

    public string? FieldsJson { get; set; }                      // [{ path, label, format }]
    public string? FiltersJson { get; set; }                     // [{ path, op, value }] joined by AND/OR
    public string? GroupByJson { get; set; }                     // [path]
    public string? AggregationsJson { get; set; }                // [{ path, fn: SUM/AVG/COUNT/MIN/MAX }]
    public string? SortJson { get; set; }                        // [{ path, direction }]
    public string Visibility { get; set; } = "Private";          // Private / Team / Tenant
    public bool IsScheduled { get; set; }
    public string? ScheduleCron { get; set; }                    // optional cron string
    public string? DeliveryEmails { get; set; }                  // comma-separated recipients
}
