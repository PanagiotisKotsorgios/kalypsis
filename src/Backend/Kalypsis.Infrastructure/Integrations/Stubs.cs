using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Integrations;

/* ============ myDATA stub ============ */
public sealed class StubMyDataClient : IMyDataClient
{
    private readonly ILogger<StubMyDataClient> _log;
    public StubMyDataClient(ILogger<StubMyDataClient> log) => _log = log;

    public Task<MyDataSubmitResult> SubmitInvoiceAsync(MyDataSubmitRequest request, CancellationToken ct = default)
    {
        var mark = $"MARK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..10].ToUpperInvariant()}";
        _log.LogInformation("[STUB myDATA] submit invoice {Id} → {Mark}", request.InvoiceId, mark);
        return Task.FromResult(new MyDataSubmitResult(true, mark, Guid.NewGuid().ToString("N"), null));
    }
    public Task<MyDataSubmitResult> CancelInvoiceAsync(string mark, CancellationToken ct = default)
    {
        _log.LogInformation("[STUB myDATA] cancel {Mark}", mark);
        return Task.FromResult(new MyDataSubmitResult(true, mark, null, null));
    }
    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}

/* ============ Generic bank statement parser stub ============ */
public sealed class StubBankStatementParser : IBankStatementParser
{
    public string Bank => "STUB";
    public async Task<IReadOnlyList<BankStatementLineDto>> ParseAsync(Stream content, CancellationToken ct = default)
    {
        // Tolerant CSV — date,amount,ref,counterparty
        using var reader = new StreamReader(content);
        var raw = await reader.ReadToEndAsync(ct);
        var lines = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var result = new List<BankStatementLineDto>();
        for (var i = 1; i < lines.Length; i++)
        {
            var parts = lines[i].Trim().Split(new[] { ',', ';' });
            if (parts.Length < 2) continue;
            if (!DateOnly.TryParse(parts[0], out var date)) continue;
            if (!decimal.TryParse(parts[1].Replace(',', '.'),
                System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var amount)) continue;
            result.Add(new BankStatementLineDto(
                date, amount, "EUR",
                parts.Length > 2 ? parts[2].Trim() : null,
                parts.Length > 3 ? parts[3].Trim() : null,
                null, lines[i].Trim()));
        }
        return result;
    }
}

/* ============ OCR stub ============ */
public sealed class StubOcrService : IOcrService
{
    private readonly ILogger<StubOcrService> _log;
    public StubOcrService(ILogger<StubOcrService> log) => _log = log;
    public string Provider => "stub";
    public Task<OcrResult> ExtractAsync(Stream content, string mimeType, string? language = "el", CancellationToken ct = default)
    {
        _log.LogInformation("[STUB OCR] {Mime} bytes={Len}", mimeType, content.Length);
        return Task.FromResult(new OcrResult(true,
            Text: "[STUB] extracted text",
            StructuredJson: JsonSerializer.Serialize(new { stub = true, language }),
            Confidence: 0.5, ErrorMessage: null));
    }
    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}

/* ============ Virus scanner stub ============ */
public sealed class StubFileScanner : IFileScanner
{
    public string Scanner => "stub";
    public Task<FileScanReport> ScanAsync(Stream content, CancellationToken ct = default)
        => Task.FromResult(new FileScanReport(true, "OK", null));
}

/* ============ Mailbox syncer stub ============ */
public sealed class StubMailboxSyncer : IMailboxSyncer
{
    private readonly ILogger<StubMailboxSyncer> _log;
    public StubMailboxSyncer(ILogger<StubMailboxSyncer> log) => _log = log;
    public MailboxProvider Provider => MailboxProvider.Imap;
    public Task<IReadOnlyList<SyncedMessageDto>> FetchSinceAsync(Guid mailboxConnectionId, DateTime since, CancellationToken ct = default)
    {
        _log.LogInformation("[STUB Mailbox] {Id} since {Since}", mailboxConnectionId, since);
        return Task.FromResult<IReadOnlyList<SyncedMessageDto>>(Array.Empty<SyncedMessageDto>());
    }
    public Task<string> GetOAuthAuthorizeUrlAsync(string redirectUri, string state, CancellationToken ct = default)
        => Task.FromResult($"https://accounts.example.invalid/o/oauth2/auth?state={state}&redirect_uri={Uri.EscapeDataString(redirectUri)}");
    public Task ExchangeCodeAsync(Guid mailboxConnectionId, string code, string redirectUri, CancellationToken ct = default)
        => Task.CompletedTask;
}

/* ============ Telephony stub ============ */
public sealed class StubTelephonyAdapter : ITelephonyAdapter
{
    private readonly ILogger<StubTelephonyAdapter> _log;
    public StubTelephonyAdapter(ILogger<StubTelephonyAdapter> log) => _log = log;
    public string Provider => "stub";
    public Task<string> PlaceOutboundCallAsync(string toNumber, Guid userId, Guid? customerId, CancellationToken ct = default)
    {
        var id = $"CALL-{Guid.NewGuid():N}".Substring(0, 16);
        _log.LogInformation("[STUB Telephony] call → {To} as {Id}", toNumber, id);
        return Task.FromResult(id);
    }
    public Task<Stream> DownloadRecordingAsync(string providerCallId, CancellationToken ct = default)
        => Task.FromResult<Stream>(new MemoryStream(System.Text.Encoding.UTF8.GetBytes($"[STUB recording {providerCallId}]")));
}

/* ============ Transcription stub ============ */
public sealed class StubAudioTranscriber : IAudioTranscriber
{
    public string Provider => "stub";
    public Task<TranscriptionResult> TranscribeAsync(Stream audio, string mimeType, string language = "el", CancellationToken ct = default)
        => Task.FromResult(new TranscriptionResult(true,
            Text: "[STUB] Καλημέρα, ήθελα να ρωτήσω για την ανανέωση του συμβολαίου μου.",
            SegmentsJson: """[{"start":0,"end":4,"speaker":"customer","text":"[STUB] Καλημέρα..."}]""",
            Confidence: 0.6, Language: language, ErrorMessage: null));
}

/* ============ AI assistant stub ============ */
public sealed class StubAiService : IAiService
{
    private readonly ILogger<StubAiService> _log;
    public StubAiService(ILogger<StubAiService> log) => _log = log;
    public string Model => "stub";

    public Task<AiExtractPolicyResult> ExtractPolicyFromPdfAsync(Stream pdf, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Task.FromResult(new AiExtractPolicyResult(
            Success: true,
            PolicyNumber: "STUB-2026-000001",
            Carrier: "INTERAMERICAN",
            ProductType: "Auto",
            StartDate: today,
            EndDate: today.AddYears(1),
            Premium: 380.00m,
            FullJson: JsonSerializer.Serialize(new { stub = true }),
            ErrorMessage: null));
    }

    public Task<AiDraftResult> DraftCommunicationAsync(AiDraftRequest req, CancellationToken ct = default)
    {
        var greeting = req.Variables?.GetValueOrDefault("customerName") ?? "πελάτη";
        return Task.FromResult(new AiDraftResult(
            Success: true,
            Subject: $"[STUB] Επικοινωνία για {greeting}",
            Body: $"Καλησπέρα {greeting},\n\n[STUB AI-generated body — swap with real model output.]\n\nΦιλικά,\nΗ ομάδα σας",
            ErrorMessage: null));
    }

    public Task<AiChurnResult> ScoreChurnAsync(Guid customerId, CancellationToken ct = default)
    {
        // Deterministic per-customer for dev so the UI is stable.
        var hash = customerId.GetHashCode();
        var score = Math.Round(((hash & 0xFF) / 255.0), 2);
        var band = score switch { < 0.25 => "Safe", < 0.5 => "Watch", < 0.75 => "At-risk", _ => "Critical" };
        var factors = new List<AiChurnFactor>
        {
            new("Last contact > 90 days", 0.34, "Ο πελάτης δεν επικοινώνησε πάνω από 3 μήνες"),
            new("Pending renewal", 0.28, "Έχει συμβόλαιο που λήγει σε <30 ημέρες"),
            new("Past unpaid installment", 0.22, "Καθυστερημένη δόση τους τελευταίους 6 μήνες"),
            new("Low policy density", 0.16, "Λιγότερα συμβόλαια από τον μέσο όρο")
        };
        return Task.FromResult(new AiChurnResult(score, band, factors));
    }

    public Task<string> SummarisePortfolioAsync(Guid tenantId, CancellationToken ct = default)
        => Task.FromResult("[STUB] Το γραφείο σας διαχειρίζεται σταθερό χαρτοφυλάκιο με υγιείς ανανεώσεις. Εστιάστε στους πελάτες με score > 0.75.");

    public Task<IReadOnlyList<(Guid CustomerId, string Display, double Match)>> SemanticSearchAsync(string query, int take = 10, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<(Guid, string, double)>>(Array.Empty<(Guid, string, double)>());

    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}

/* ============ Subscription billing stub (Stripe-shaped) ============ */
public sealed class StubSubscriptionBilling : ISubscriptionBilling
{
    private readonly ILogger<StubSubscriptionBilling> _log;
    public StubSubscriptionBilling(ILogger<StubSubscriptionBilling> log) => _log = log;
    public string Provider => "stub";
    public Task<string> CreateCheckoutAsync(Guid tenantId, string priceCode, string successUrl, string cancelUrl, CancellationToken ct = default)
        => Task.FromResult($"https://billing.example.invalid/checkout/stub?tenant={tenantId}&price={priceCode}");
    public Task<BillingPortalSession> CreatePortalSessionAsync(Guid tenantId, string returnUrl, CancellationToken ct = default)
        => Task.FromResult(new BillingPortalSession($"https://billing.example.invalid/portal/stub?tenant={tenantId}"));
    public Task HandleWebhookAsync(string providerEventId, string eventType, string rawPayload, CancellationToken ct = default)
    {
        _log.LogInformation("[STUB Billing] webhook {Type} id={Id}", eventType, providerEventId);
        return Task.CompletedTask;
    }
    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}
