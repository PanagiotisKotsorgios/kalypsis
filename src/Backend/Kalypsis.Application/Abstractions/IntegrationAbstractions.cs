using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Abstractions;

/* ============ myDATA ============ */

public record MyDataSubmitRequest(Guid InvoiceId);
public record MyDataSubmitResult(bool Success, string? Mark, string? Uid, string? ErrorMessage);

public interface IMyDataClient
{
    Task<MyDataSubmitResult> SubmitInvoiceAsync(MyDataSubmitRequest request, CancellationToken ct = default);
    Task<MyDataSubmitResult> CancelInvoiceAsync(string mark, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

/* ============ Bank statement parser ============ */

public record BankStatementLineDto(
    DateOnly TransactionDate,
    decimal Amount,
    string Currency,
    string? Reference,
    string? CounterpartyName,
    string? CounterpartyIban,
    string? RawLine);

public interface IBankStatementParser
{
    string Bank { get; }                                          // Eurobank / Piraeus / Alpha / NBG
    Task<IReadOnlyList<BankStatementLineDto>> ParseAsync(Stream content, CancellationToken ct = default);
}

/* ============ Reconciliation ============ */

public record ReconciliationResult(int Matched, int Ambiguous, int Unmatched);

public interface IPaymentReconciler
{
    Task<ReconciliationResult> ReconcileAsync(Guid bankStatementImportId, CancellationToken ct = default);
}

/* ============ Commission split engine ============ */

public record CommissionSplitInput(Guid PolicyId, decimal CarrierCommission, string Currency);
public record CommissionSplitOutput(Guid TransactionId, IReadOnlyList<(Guid? UserId, Guid? ProducerId, string Role, decimal Percentage, decimal Amount)> Splits);

public interface ICommissionSplitter
{
    Task<CommissionSplitOutput> SplitAsync(CommissionSplitInput input, CancellationToken ct = default);
    Task<bool> ApplyClawbackAsync(Guid policyId, decimal refundedCommission, CancellationToken ct = default);
}

/* ============ OCR ============ */

public record OcrResult(bool Success, string? Text, string? StructuredJson, double Confidence, string? ErrorMessage);

public interface IOcrService
{
    string Provider { get; }
    Task<OcrResult> ExtractAsync(Stream content, string mimeType, string? language = "el", CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

/* ============ File scanning (ClamAV-style) ============ */

public record FileScanReport(bool Clean, string? Verdict, string? Signature);

public interface IFileScanner
{
    string Scanner { get; }
    Task<FileScanReport> ScanAsync(Stream content, CancellationToken ct = default);
}

/* ============ Mailbox sync (Gmail / Outlook / IMAP) ============ */

public record SyncedMessageDto(
    string MessageId, string? ThreadId,
    string FromAddress, string FromName,
    string Subject, string? BodyText, string? BodyHtml,
    DateTime ReceivedAt);

public interface IMailboxSyncer
{
    MailboxProvider Provider { get; }
    Task<IReadOnlyList<SyncedMessageDto>> FetchSinceAsync(Guid mailboxConnectionId, DateTime since, CancellationToken ct = default);
    Task<string> GetOAuthAuthorizeUrlAsync(string redirectUri, string state, CancellationToken ct = default);
    Task ExchangeCodeAsync(Guid mailboxConnectionId, string code, string redirectUri, CancellationToken ct = default);
}

/* ============ Telephony ============ */

public interface ITelephonyAdapter
{
    string Provider { get; }
    Task<string> PlaceOutboundCallAsync(string toNumber, Guid userId, Guid? customerId, CancellationToken ct = default);
    Task<Stream> DownloadRecordingAsync(string providerCallId, CancellationToken ct = default);
}

/* ============ Audio transcription ============ */

public record TranscriptionResult(bool Success, string? Text, string? SegmentsJson, double? Confidence, string Language, string? ErrorMessage);

public interface IAudioTranscriber
{
    string Provider { get; }
    Task<TranscriptionResult> TranscribeAsync(Stream audio, string mimeType, string language = "el", CancellationToken ct = default);
}

/* ============ AI assistants ============ */

public record AiExtractPolicyResult(bool Success, string? PolicyNumber, string? Carrier, string? ProductType,
    DateOnly? StartDate, DateOnly? EndDate, decimal? Premium, string? FullJson, string? ErrorMessage);

public record AiDraftRequest(AiTaskType Task, string? Locale, IReadOnlyDictionary<string, string>? Variables);
public record AiDraftResult(bool Success, string? Subject, string? Body, string? ErrorMessage);

public record AiChurnFactor(string Factor, double Weight, string Description);
public record AiChurnResult(double Score, string Band, IReadOnlyList<AiChurnFactor> TopFactors);

public interface IAiService
{
    string Model { get; }
    Task<AiExtractPolicyResult> ExtractPolicyFromPdfAsync(Stream pdf, CancellationToken ct = default);
    Task<AiDraftResult> DraftCommunicationAsync(AiDraftRequest req, CancellationToken ct = default);
    Task<AiChurnResult> ScoreChurnAsync(Guid customerId, CancellationToken ct = default);
    Task<string> SummarisePortfolioAsync(Guid tenantId, CancellationToken ct = default);
    Task<IReadOnlyList<(Guid CustomerId, string Display, double Match)>> SemanticSearchAsync(string query, int take = 10, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

/* ============ Subscription billing ============ */

public record BillingPortalSession(string Url);

public interface ISubscriptionBilling
{
    string Provider { get; }
    Task<string> CreateCheckoutAsync(Guid tenantId, string priceCode, string successUrl, string cancelUrl, CancellationToken ct = default);
    Task<BillingPortalSession> CreatePortalSessionAsync(Guid tenantId, string returnUrl, CancellationToken ct = default);
    Task HandleWebhookAsync(string providerEventId, string eventType, string rawPayload, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

/* ============ Workflow engine ============ */

public record WorkflowFireRequest(WorkflowEvent Event, IReadOnlyDictionary<string, object?> Context);

public interface IWorkflowEngine
{
    Task FireAsync(WorkflowFireRequest request, CancellationToken ct = default);
}

/* ============ Custom report runner ============ */

public record ReportRunResult(IReadOnlyList<string> Columns, IReadOnlyList<IReadOnlyList<object?>> Rows, int TotalRows);

public interface IReportRunner
{
    Task<ReportRunResult> RunAsync(Guid reportDefinitionId, CancellationToken ct = default);
    Task<byte[]> ExportXlsxAsync(Guid reportDefinitionId, CancellationToken ct = default);
}
