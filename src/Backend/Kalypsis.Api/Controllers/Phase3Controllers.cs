using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers.Phase3;

/* ============ Carriers (registered adapters + per-tenant connections) ============ */

[ApiController]
[Route("api/carriers")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class CarriersController : ControllerBase
{
    private readonly ICarrierAdapterRegistry _registry;
    private readonly AppDbContext _db;
    public CarriersController(ICarrierAdapterRegistry registry, AppDbContext db) { _registry = registry; _db = db; }

    public record CarrierSummary(string CarrierCode, string DisplayName, IReadOnlyList<string> SupportedProductTypes);

    [HttpGet("adapters")]
    public ActionResult<IReadOnlyList<CarrierSummary>> Adapters() =>
        Ok(_registry.All.Select(a => new CarrierSummary(a.CarrierCode, a.DisplayName, a.SupportedProductTypes)).ToList());

    public record ConnectionDto(Guid Id, string CarrierCode, CarrierAdapterStatus Status, string? AgentCode, DateTime? LastSuccessfulCallAt);

    [HttpGet("connections")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<IReadOnlyList<ConnectionDto>>> Connections(CancellationToken ct) =>
        Ok(await _db.CarrierConnections
            .Where(c => c.DeletedAt == null)
            .Select(c => new ConnectionDto(c.Id, c.CarrierCode, c.Status, c.AgentCode, c.LastSuccessfulCallAt))
            .ToListAsync(ct));

    public record UpsertConnectionBody(string CarrierCode, CarrierAdapterStatus Status,
        string? BaseUrl, string? ClientId, string? ClientSecret, string? AgentCode, string? AuthMode, string? Notes);

    [HttpPost("connections")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ConnectionDto>> UpsertConnection([FromBody] UpsertConnectionBody body, CancellationToken ct)
    {
        if (!_registry.IsKnown(body.CarrierCode))
            return BadRequest(new { code = "unknown_carrier", message = $"Unknown carrier {body.CarrierCode}" });

        var existing = await _db.CarrierConnections.FirstOrDefaultAsync(
            c => c.CarrierCode == body.CarrierCode && c.DeletedAt == null, ct);
        if (existing is null)
        {
            existing = new Domain.Entities.CarrierConnection
            {
                Id = Guid.NewGuid(),
                CarrierCode = body.CarrierCode
            };
            _db.CarrierConnections.Add(existing);
        }
        existing.Status = body.Status;
        existing.BaseUrl = body.BaseUrl;
        existing.ClientId = body.ClientId;
        // TODO: encrypt — for now store as-is in a dev environment.
        existing.ClientSecretEncrypted = body.ClientSecret;
        existing.AgentCode = body.AgentCode;
        existing.AuthMode = body.AuthMode;
        existing.Notes = body.Notes;
        await _db.SaveChangesAsync(ct);

        return Ok(new ConnectionDto(existing.Id, existing.CarrierCode, existing.Status, existing.AgentCode, existing.LastSuccessfulCallAt));
    }
}

/* ============ Quotes (multi-carrier πολυτιμολόγηση) ============ */

[ApiController]
[Route("api/quotes")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class QuotesController : ControllerBase
{
    private readonly ICarrierAdapterRegistry _registry;
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;

    public QuotesController(ICarrierAdapterRegistry registry, AppDbContext db, IDateTimeProvider clock)
    { _registry = registry; _db = db; _clock = clock; }

    public record CreateQuoteBody(string ProductType, string RiskInputsJson, Guid? CustomerId, IReadOnlyList<string>? OnlyCarriers);
    public record OfferDto(Guid OfferId, string CarrierCode, decimal? Premium, decimal? Commission, string? CarrierProductCode, string? Summary, DateTime? ValidUntil);
    public record QuoteResponse(Guid QuoteId, string QuoteNumber, IReadOnlyList<OfferDto> Offers);

    [HttpPost]
    public async Task<ActionResult<QuoteResponse>> Create([FromBody] CreateQuoteBody body, CancellationToken ct)
    {
        // Validate JSON shape
        try { _ = JsonDocument.Parse(body.RiskInputsJson); }
        catch { return BadRequest(new { code = "invalid_json", message = "RiskInputsJson is not valid JSON" }); }

        var quote = new Domain.Entities.Quote
        {
            Id = Guid.NewGuid(),
            QuoteNumber = $"Q-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            CustomerId = body.CustomerId,
            ProductType = body.ProductType,
            RiskInputsJson = body.RiskInputsJson,
            Status = QuoteStatus.Submitted,
            ExpiresAt = _clock.UtcNow.AddDays(14)
        };
        _db.Quotes.Add(quote);

        var carriers = (body.OnlyCarriers is { Count: > 0 }
            ? _registry.All.Where(a => body.OnlyCarriers.Contains(a.CarrierCode, StringComparer.OrdinalIgnoreCase))
            : _registry.All).ToList();

        // Fan-out to every enabled adapter in parallel.
        var tasks = carriers.Select(a => a.GetQuoteAsync(new CarrierQuoteRequest(body.ProductType, body.RiskInputsJson), ct)
            .ContinueWith(t => (Adapter: a, Result: t.Result), ct));
        var results = await Task.WhenAll(tasks);

        var offers = new List<OfferDto>();
        foreach (var (adapter, result) in results)
        {
            if (!result.Success || result.Premium is null) continue;
            var offer = new Domain.Entities.QuoteOffer
            {
                Id = Guid.NewGuid(),
                QuoteId = quote.Id,
                CarrierCode = adapter.CarrierCode,
                CarrierProductCode = result.CarrierProductCode,
                Premium = result.Premium.Value,
                Currency = result.Currency,
                Commission = result.Commission,
                CoverageSummary = result.CoverageSummary,
                RawResponseRedacted = result.RawResponseRedacted,
                ValidUntil = result.ValidUntil
            };
            _db.QuoteOffers.Add(offer);
            offers.Add(new OfferDto(offer.Id, adapter.CarrierCode, offer.Premium, offer.Commission,
                offer.CarrierProductCode, offer.CoverageSummary, offer.ValidUntil));
        }
        quote.Status = offers.Count > 0 ? QuoteStatus.Quoted : QuoteStatus.Rejected;
        await _db.SaveChangesAsync(ct);

        return Ok(new QuoteResponse(quote.Id, quote.QuoteNumber, offers.OrderBy(o => o.Premium).ToList()));
    }
}

/* ============ Workflow rules CRUD ============ */

[ApiController]
[Route("api/workflows")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Intelligence)]
public class WorkflowsController : ControllerBase
{
    private readonly AppDbContext _db;
    public WorkflowsController(AppDbContext db) => _db = db;

    public record RuleDto(Guid Id, string Name, WorkflowEvent TriggerEvent, bool IsActive, int Priority,
        string? ConditionsJson, IReadOnlyList<RuleActionDto> Actions);
    public record RuleActionDto(Guid Id, WorkflowAction Action, int Order, string PayloadJson);
    public record UpsertRuleBody(string Name, WorkflowEvent TriggerEvent, bool IsActive, int Priority,
        string? ConditionsJson, IReadOnlyList<UpsertRuleActionBody> Actions);
    public record UpsertRuleActionBody(WorkflowAction Action, int Order, string PayloadJson);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RuleDto>>> List(CancellationToken ct) =>
        Ok(await _db.WorkflowRules.Include(r => r.Actions)
            .Where(r => r.DeletedAt == null)
            .Select(r => new RuleDto(r.Id, r.Name, r.TriggerEvent, r.IsActive, r.Priority, r.ConditionsJson,
                r.Actions.OrderBy(a => a.Order).Select(a => new RuleActionDto(a.Id, a.Action, a.Order, a.PayloadJson)).ToList()))
            .ToListAsync(ct));

    [HttpPost]
    public async Task<ActionResult<RuleDto>> Create([FromBody] UpsertRuleBody body, CancellationToken ct)
    {
        var rule = new Domain.Entities.WorkflowRule
        {
            Id = Guid.NewGuid(),
            Name = body.Name,
            TriggerEvent = body.TriggerEvent,
            IsActive = body.IsActive,
            Priority = body.Priority,
            ConditionsJson = body.ConditionsJson
        };
        foreach (var a in body.Actions)
        {
            rule.Actions.Add(new Domain.Entities.WorkflowRuleAction
            { Id = Guid.NewGuid(), RuleId = rule.Id, Action = a.Action, Order = a.Order, PayloadJson = a.PayloadJson });
        }
        _db.WorkflowRules.Add(rule);
        await _db.SaveChangesAsync(ct);
        return Ok(new RuleDto(rule.Id, rule.Name, rule.TriggerEvent, rule.IsActive, rule.Priority, rule.ConditionsJson,
            rule.Actions.OrderBy(a => a.Order).Select(a => new RuleActionDto(a.Id, a.Action, a.Order, a.PayloadJson)).ToList()));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var rule = await _db.WorkflowRules.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (rule is null) return NotFound();
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

/* ============ AI assistants (uniform surface) ============ */

[ApiController]
[Route("api/ai")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public class AiController : ControllerBase
{
    private readonly IAiService _ai;
    public AiController(IAiService ai) => _ai = ai;

    [HttpPost("extract-policy-pdf")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<AiExtractPolicyResult>> ExtractPdf(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest();
        using var s = file.OpenReadStream();
        return Ok(await _ai.ExtractPolicyFromPdfAsync(s, ct));
    }

    [HttpPost("draft")]
    public async Task<ActionResult<AiDraftResult>> Draft([FromBody] AiDraftRequest body, CancellationToken ct)
        => Ok(await _ai.DraftCommunicationAsync(body, ct));

    [HttpGet("churn/{customerId:guid}")]
    public async Task<ActionResult<AiChurnResult>> Churn(Guid customerId, CancellationToken ct)
        => Ok(await _ai.ScoreChurnAsync(customerId, ct));

    [HttpGet("portfolio-summary")]
    public async Task<ActionResult<object>> Portfolio(CancellationToken ct)
        => Ok(new { summary = await _ai.SummarisePortfolioAsync(Guid.Empty, ct) });

    [HttpGet("search")]
    public async Task<ActionResult> Search([FromQuery] string q, [FromQuery] int take = 10, CancellationToken ct = default)
        => Ok(await _ai.SemanticSearchAsync(q, take, ct));
}

/* ============ Billing — installments + bank statement import ============ */

[ApiController]
[Route("api/billing")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class BillingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBankStatementParser _parser;
    private readonly IPaymentReconciler _reconciler;
    public BillingController(AppDbContext db, IBankStatementParser parser, IPaymentReconciler reconciler)
    { _db = db; _parser = parser; _reconciler = reconciler; }

    public record InstallmentDto(Guid Id, Guid PolicyId, int SequenceNumber, string DueDate, decimal Amount, decimal PaidAmount, string Status);

    [HttpGet("installments")]
    public async Task<ActionResult<IReadOnlyList<InstallmentDto>>> ListInstallments([FromQuery] Guid? policyId, CancellationToken ct)
    {
        var q = _db.Installments.Where(i => i.DeletedAt == null);
        if (policyId.HasValue) q = q.Where(i => i.PolicyId == policyId.Value);
        var rows = await q.OrderBy(i => i.DueDate)
            .Select(i => new InstallmentDto(i.Id, i.PolicyId, i.SequenceNumber, i.DueDate.ToString("yyyy-MM-dd"),
                i.Amount, i.PaidAmount, i.Status.ToString()))
            .ToListAsync(ct);
        return Ok(rows);
    }

    public record GenerateScheduleBody(Guid PolicyId, int Installments, decimal TotalAmount, DateOnly Start, string Frequency);

    [HttpPost("installments/generate")]
    public async Task<ActionResult<IReadOnlyList<InstallmentDto>>> Generate([FromBody] GenerateScheduleBody body, CancellationToken ct)
    {
        if (body.Installments <= 0) return BadRequest();
        var amount = Math.Round(body.TotalAmount / body.Installments, 2);
        var stepDays = body.Frequency.ToLowerInvariant() switch
        { "monthly" => 30, "quarterly" => 90, "semiannual" => 182, _ => 30 };

        var created = new List<Domain.Entities.Installment>();
        for (var i = 0; i < body.Installments; i++)
        {
            created.Add(new Domain.Entities.Installment
            {
                Id = Guid.NewGuid(),
                PolicyId = body.PolicyId,
                SequenceNumber = i + 1,
                DueDate = body.Start.AddDays(stepDays * i),
                Amount = amount,
                PaidAmount = 0,
                Currency = "EUR",
                Status = InstallmentStatus.Scheduled
            });
        }
        _db.Installments.AddRange(created);
        await _db.SaveChangesAsync(ct);
        return Ok(created.Select(i => new InstallmentDto(i.Id, i.PolicyId, i.SequenceNumber,
            i.DueDate.ToString("yyyy-MM-dd"), i.Amount, i.PaidAmount, i.Status.ToString())).ToList());
    }

    public record ImportResponseDto(Guid ImportId, int Total, int Matched, int Ambiguous, int Unmatched);

    [HttpPost("statements/import")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<ImportResponseDto>> ImportStatement(IFormFile file, [FromQuery] string bank, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest();
        using var s = file.OpenReadStream();
        var parsed = await _parser.ParseAsync(s, ct);

        var import = new Domain.Entities.BankStatementImport
        {
            Id = Guid.NewGuid(),
            FileName = file.FileName,
            Bank = bank ?? "?",
            ImportedAt = DateTime.UtcNow,
            TotalLines = parsed.Count
        };
        _db.BankStatementImports.Add(import);
        foreach (var p in parsed)
        {
            _db.BankStatementLines.Add(new Domain.Entities.BankStatementLine
            {
                Id = Guid.NewGuid(),
                ImportId = import.Id,
                TransactionDate = p.TransactionDate,
                Amount = p.Amount,
                Currency = p.Currency,
                Reference = p.Reference,
                CounterpartyName = p.CounterpartyName,
                CounterpartyIban = p.CounterpartyIban,
                RawLine = p.RawLine,
                MatchStatus = BankStatementMatchStatus.Unmatched
            });
        }
        await _db.SaveChangesAsync(ct);
        var rec = await _reconciler.ReconcileAsync(import.Id, ct);
        return Ok(new ImportResponseDto(import.Id, parsed.Count, rec.Matched, rec.Ambiguous, rec.Unmatched));
    }
}

/* ============ myDATA invoice submission ============ */

[ApiController]
[Route("api/mydata")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class MyDataController : ControllerBase
{
    private readonly IMyDataClient _client;
    public MyDataController(IMyDataClient client) => _client = client;

    public record SubmitBody(Guid InvoiceId);

    [HttpPost("submit")]
    public async Task<ActionResult<MyDataSubmitResult>> Submit([FromBody] SubmitBody body, CancellationToken ct)
        => Ok(await _client.SubmitInvoiceAsync(new MyDataSubmitRequest(body.InvoiceId), ct));

    [HttpPost("cancel/{mark}")]
    public async Task<ActionResult<MyDataSubmitResult>> Cancel(string mark, CancellationToken ct)
        => Ok(await _client.CancelInvoiceAsync(mark, ct));
}

/* ============ Mailbox sync OAuth bootstrap ============ */

[ApiController]
[Route("api/mailboxes")]
[Authorize]
[RequiresPackage(PackageCode.Integrations)]
public class MailboxesController : ControllerBase
{
    private readonly IMailboxSyncer _syncer;
    public MailboxesController(IMailboxSyncer syncer) => _syncer = syncer;

    [HttpGet("authorize-url")]
    public async Task<ActionResult> Authorize([FromQuery] string redirectUri, [FromQuery] string state, CancellationToken ct)
        => Ok(new { url = await _syncer.GetOAuthAuthorizeUrlAsync(redirectUri, state, ct) });
}

/* ============ Telephony — outbound calls ============ */

[ApiController]
[Route("api/telephony")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Integrations)]
public class TelephonyController : ControllerBase
{
    private readonly ITelephonyAdapter _phone;
    public TelephonyController(ITelephonyAdapter phone) => _phone = phone;

    public record OutboundBody(string ToNumber, Guid UserId, Guid? CustomerId);

    [HttpPost("call")]
    public async Task<ActionResult> Call([FromBody] OutboundBody body, CancellationToken ct)
        => Ok(new { callId = await _phone.PlaceOutboundCallAsync(body.ToNumber, body.UserId, body.CustomerId, ct) });
}

/* ============ Custom reports ============ */

[ApiController]
[Route("api/custom-reports")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public class CustomReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IReportRunner _runner;
    public CustomReportsController(AppDbContext db, IReportRunner runner) { _db = db; _runner = runner; }

    public record ReportDefDto(Guid Id, string Name, ReportEntity Entity, string? FieldsJson, string? FiltersJson,
        string? GroupByJson, string? AggregationsJson, string? SortJson, string Visibility, bool IsScheduled);
    public record UpsertReportDefBody(string Name, ReportEntity Entity, string? FieldsJson, string? FiltersJson,
        string? GroupByJson, string? AggregationsJson, string? SortJson, string Visibility, bool IsScheduled, string? ScheduleCron, string? DeliveryEmails);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReportDefDto>>> List(CancellationToken ct) =>
        Ok(await _db.ReportDefinitions.Where(r => r.DeletedAt == null)
            .Select(r => new ReportDefDto(r.Id, r.Name, r.Entity, r.FieldsJson, r.FiltersJson,
                r.GroupByJson, r.AggregationsJson, r.SortJson, r.Visibility, r.IsScheduled))
            .ToListAsync(ct));

    [HttpPost]
    public async Task<ActionResult<ReportDefDto>> Create([FromBody] UpsertReportDefBody body, CancellationToken ct)
    {
        var def = new Domain.Entities.ReportDefinition
        {
            Id = Guid.NewGuid(),
            Name = body.Name, Entity = body.Entity,
            FieldsJson = body.FieldsJson, FiltersJson = body.FiltersJson,
            GroupByJson = body.GroupByJson, AggregationsJson = body.AggregationsJson,
            SortJson = body.SortJson, Visibility = body.Visibility,
            IsScheduled = body.IsScheduled, ScheduleCron = body.ScheduleCron, DeliveryEmails = body.DeliveryEmails
        };
        _db.ReportDefinitions.Add(def);
        await _db.SaveChangesAsync(ct);
        return Ok(new ReportDefDto(def.Id, def.Name, def.Entity, def.FieldsJson, def.FiltersJson,
            def.GroupByJson, def.AggregationsJson, def.SortJson, def.Visibility, def.IsScheduled));
    }

    [HttpPost("{id:guid}/run")]
    public async Task<ActionResult<ReportRunResult>> Run(Guid id, CancellationToken ct)
        => Ok(await _runner.RunAsync(id, ct));

    [HttpGet("{id:guid}/export.csv")]
    public async Task<ActionResult> Export(Guid id, CancellationToken ct)
    {
        var bytes = await _runner.ExportXlsxAsync(id, ct);
        return File(bytes, "text/csv", $"report-{id}.csv");
    }
}

/* ============ Subscription billing webhooks + portal ============ */

[ApiController]
[Route("api/billing/subscription")]
public class SubscriptionBillingController : ControllerBase
{
    private readonly ISubscriptionBilling _billing;
    public SubscriptionBillingController(ISubscriptionBilling billing) => _billing = billing;

    public record CheckoutBody(string PriceCode, string SuccessUrl, string CancelUrl);

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("checkout")]
    public async Task<ActionResult> Checkout([FromBody] CheckoutBody body, CancellationToken ct)
    {
        // Tenant is resolved from the JWT — using Guid.Empty here as placeholder until ICurrentUser is wired.
        var url = await _billing.CreateCheckoutAsync(Guid.Empty, body.PriceCode, body.SuccessUrl, body.CancelUrl, ct);
        return Ok(new { url });
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("portal")]
    public async Task<ActionResult> Portal([FromQuery] string returnUrl, CancellationToken ct)
    {
        var session = await _billing.CreatePortalSessionAsync(Guid.Empty, returnUrl, ct);
        return Ok(session);
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook(CancellationToken ct)
    {
        using var sr = new StreamReader(Request.Body);
        var raw = await sr.ReadToEndAsync(ct);
        var eventId = Request.Headers["X-Provider-Event-Id"].ToString();
        var eventType = Request.Headers["X-Provider-Event-Type"].ToString();
        await _billing.HandleWebhookAsync(eventId, eventType, raw, ct);
        return Ok();
    }
}

/* ============ OCR / file scanning helper endpoints ============ */

[ApiController]
[Route("api/documents/intelligence")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public class DocumentIntelligenceController : ControllerBase
{
    private readonly IOcrService _ocr;
    private readonly IFileScanner _scanner;
    public DocumentIntelligenceController(IOcrService ocr, IFileScanner scanner) { _ocr = ocr; _scanner = scanner; }

    [HttpPost("ocr")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<OcrResult>> Ocr(IFormFile file, [FromQuery] string? language = "el", CancellationToken ct = default)
    {
        using var s = file.OpenReadStream();
        return Ok(await _ocr.ExtractAsync(s, file.ContentType, language, ct));
    }

    [HttpPost("scan")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<FileScanReport>> Scan(IFormFile file, CancellationToken ct)
    {
        using var s = file.OpenReadStream();
        return Ok(await _scanner.ScanAsync(s, ct));
    }
}
