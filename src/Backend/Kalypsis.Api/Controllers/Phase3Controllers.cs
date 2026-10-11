using System.Text.Json;
using System.Text;
using System.Security.Cryptography;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
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
        // The AppDbContext applies the AES-GCM encrypted value converter to
        // ClientSecretEncrypted before it is persisted.
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
    private readonly ICurrentUser _current;

    public QuotesController(ICarrierAdapterRegistry registry, AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _registry = registry; _db = db; _clock = clock; _current = current; }

    public record CreateQuoteBody(string ProductType, string RiskInputsJson, Guid? CustomerId, IReadOnlyList<string>? OnlyCarriers);
    public record OfferDto(Guid OfferId, string CarrierCode, decimal? Premium, decimal? Commission, string? CarrierProductCode, string? Summary, DateTime? ValidUntil);
    public record QuoteResponse(Guid QuoteId, string QuoteNumber, IReadOnlyList<OfferDto> Offers);

    [HttpPost]
    public async Task<ActionResult<QuoteResponse>> Create([FromBody] CreateQuoteBody body, CancellationToken ct)
    {
        // Validate JSON shape
        try { _ = JsonDocument.Parse(body.RiskInputsJson); }
        catch { return BadRequest(new { code = "invalid_json", message = "RiskInputsJson is not valid JSON" }); }

        // Cross-tenant FK guard — same class as the Policies bug. Without
        // this, Office B could POST a quote with Office A's CustomerId and
        // silently attach a Quote row to a foreign-tenant customer.
        if (body.CustomerId is Guid cid)
        {
            var tenantId = _current.TenantId ?? throw AppException.Forbidden();
            var owns = await _db.Customers
                .AnyAsync(c => c.Id == cid && c.TenantId == tenantId && c.DeletedAt == null, ct);
            if (!owns) throw AppException.NotFound("Πελάτης");
        }

        var tenantIdForQuote = _current.TenantId ?? throw AppException.Forbidden();
        var quote = new Domain.Entities.Quote
        {
            Id = Guid.NewGuid(), TenantId = tenantIdForQuote,
            QuoteNumber = $"Q-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            CustomerId = body.CustomerId,
            CreatedByUserId = _current.UserId,
            ProductType = body.ProductType,
            RiskInputsJson = body.RiskInputsJson,
            Status = QuoteStatus.Submitted,
            ExpiresAt = _clock.UtcNow.AddDays(14)
        };
        _db.Quotes.Add(quote);

        var carrierConnections = await _db.CarrierConnections
            .Where(c => c.DeletedAt == null).Select(c => new { c.CarrierCode, c.Status }).ToListAsync(ct);
        var configuredCarrierCodes = carrierConnections.Where(c => c.Status == CarrierAdapterStatus.Enabled).Select(c => c.CarrierCode).ToList();
        var availableCarriers = carrierConnections.Count > 0
            ? _registry.All.Where(a => configuredCarrierCodes.Contains(a.CarrierCode, StringComparer.OrdinalIgnoreCase))
            : _registry.All;
        var carriers = (body.OnlyCarriers is { Count: > 0 }
            ? availableCarriers.Where(a => body.OnlyCarriers.Contains(a.CarrierCode, StringComparer.OrdinalIgnoreCase))
            : availableCarriers).ToList();

        // Fan-out to every enabled adapter in parallel. One carrier outage must
        // not make the whole comparison fail; its redacted error is logged.
        var tasks = carriers.Select(async a =>
        {
            try { return (Adapter: a, Result: await a.GetQuoteAsync(new CarrierQuoteRequest(body.ProductType, body.RiskInputsJson), ct)); }
            catch (Exception ex) { return (Adapter: a, Result: new CarrierQuoteResult(false, null, "EUR", null, null, null, null, null, ex.Message)); }
        });
        var results = await Task.WhenAll(tasks);

        var offers = new List<OfferDto>();
        foreach (var (adapter, result) in results)
        {
            _db.CarrierOperationLogs.Add(new Domain.Entities.CarrierOperationLog
            {
                Id = Guid.NewGuid(), TenantId = tenantIdForQuote, CarrierCode = adapter.CarrierCode,
                Operation = CarrierOperation.Quote, CorrelationId = quote.QuoteNumber,
                Success = result.Success, DurationMs = 0, ErrorMessage = result.ErrorMessage,
                ResponseSummary = result.Success ? result.CoverageSummary : null
            });
            if (result.Success)
            {
                var connection = await _db.CarrierConnections.FirstOrDefaultAsync(c => c.CarrierCode == adapter.CarrierCode && c.DeletedAt == null, ct);
                if (connection is not null) connection.LastSuccessfulCallAt = _clock.UtcNow;
            }
            if (!result.Success || result.Premium is null) continue;
            var offer = new Domain.Entities.QuoteOffer
            {
                Id = Guid.NewGuid(), TenantId = tenantIdForQuote,
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
[RequiresPackage(PackageCode.Crm)]
public class WorkflowsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWorkflowEngine _engine;
    private readonly ICurrentUser _current;
    public WorkflowsController(AppDbContext db, IWorkflowEngine engine, ICurrentUser current) { _db = db; _engine = engine; _current = current; }

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
        if (string.IsNullOrWhiteSpace(body.Name) || body.Name.Length > 120) throw AppException.Validation("Το όνομα του αυτοματισμού είναι υποχρεωτικό.");
        ValidateJson(body.ConditionsJson, "Οι συνθήκες");
        var rule = new Domain.Entities.WorkflowRule
        {
            Id = Guid.NewGuid(),
            Name = body.Name,
            TriggerEvent = body.TriggerEvent,
            IsActive = body.IsActive,
            Priority = body.Priority,
            ConditionsJson = body.ConditionsJson
        };
        foreach (var a in body.Actions ?? Array.Empty<UpsertRuleActionBody>())
        {
            ValidateJson(a.PayloadJson, "Το payload της ενέργειας");
            rule.Actions.Add(new Domain.Entities.WorkflowRuleAction
            { Id = Guid.NewGuid(), RuleId = rule.Id, Action = a.Action, Order = a.Order, PayloadJson = a.PayloadJson });
        }
        _db.WorkflowRules.Add(rule);
        await _db.SaveChangesAsync(ct);
        return Ok(new RuleDto(rule.Id, rule.Name, rule.TriggerEvent, rule.IsActive, rule.Priority, rule.ConditionsJson,
            rule.Actions.OrderBy(a => a.Order).Select(a => new RuleActionDto(a.Id, a.Action, a.Order, a.PayloadJson)).ToList()));
    }

    public record FireBody(WorkflowEvent Event, Dictionary<string, object?> Context);
    [HttpPost("fire")]
    public async Task<ActionResult> Fire([FromBody] FireBody body, CancellationToken ct)
    {
        var context = body.Context ?? new Dictionary<string, object?>();
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        context["tenantId"] = tenantId;
        if (_current.UserId is Guid userId) context["userId"] = userId;
        await _engine.FireAsync(new WorkflowFireRequest(body.Event, context), ct);
        return Ok(new { fired = true, body.Event });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RuleDto>> Update(Guid id, [FromBody] UpsertRuleBody body, CancellationToken ct)
    {
        ValidateJson(body.ConditionsJson, "Οι συνθήκες");
        var rule = await _db.WorkflowRules.Include(r => r.Actions)
            .FirstOrDefaultAsync(r => r.Id == id && r.DeletedAt == null, ct);
        if (rule is null) return NotFound();
        if (string.IsNullOrWhiteSpace(body.Name) || body.Name.Length > 120) throw AppException.Validation("Το όνομα του αυτοματισμού είναι υποχρεωτικό.");
        rule.Name = body.Name.Trim();
        rule.TriggerEvent = body.TriggerEvent;
        rule.IsActive = body.IsActive;
        rule.Priority = body.Priority;
        rule.ConditionsJson = body.ConditionsJson;
        foreach (var action in rule.Actions) action.DeletedAt = DateTime.UtcNow;
        foreach (var a in body.Actions ?? Array.Empty<UpsertRuleActionBody>())
        {
            ValidateJson(a.PayloadJson, "Το payload της ενέργειας");
            rule.Actions.Add(new Domain.Entities.WorkflowRuleAction
            { Id = Guid.NewGuid(), RuleId = rule.Id, Action = a.Action, Order = a.Order, PayloadJson = a.PayloadJson });
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new RuleDto(rule.Id, rule.Name, rule.TriggerEvent, rule.IsActive, rule.Priority, rule.ConditionsJson,
            rule.Actions.Where(a => a.DeletedAt == null).OrderBy(a => a.Order)
                .Select(a => new RuleActionDto(a.Id, a.Action, a.Order, a.PayloadJson)).ToList()));
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

    private static void ValidateJson(string? json, string label)
    {
        if (string.IsNullOrWhiteSpace(json)) return;
        try { using var _ = JsonDocument.Parse(json); }
        catch { throw AppException.Validation($"{label} δεν είναι έγκυρο JSON."); }
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
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public AiController(IAiService ai, AppDbContext db, ICurrentUser current) { _ai = ai; _db = db; _current = current; }

    [HttpPost("extract-policy-pdf")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<AiExtractPolicyResult>> ExtractPdf(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest();
        using var s = file.OpenReadStream();
        var result = await _ai.ExtractPolicyFromPdfAsync(s, ct);
        await RecordAiInvocation(AiTaskType.ExtractPolicyPdf, "PDF extraction", result.Success, result.FullJson, 0, 0, result.ErrorMessage, ct);
        return Ok(result);
    }

    [HttpPost("draft")]
    public async Task<ActionResult<AiDraftResult>> Draft([FromBody] AiDraftRequest body, CancellationToken ct)
    {
        var result = await _ai.DraftCommunicationAsync(body, ct);
        await RecordAiInvocation(body.Task, body.Variables?.GetValueOrDefault("customerName"), result.Success, result.Body, 0, 0, result.ErrorMessage, ct);
        return Ok(result);
    }

    [HttpGet("churn/{customerId:guid}")]
    public async Task<ActionResult<AiChurnResult>> Churn(Guid customerId, CancellationToken ct)
    {
        if (!await _db.Customers.AnyAsync(x => x.Id == customerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Πελάτης");
        var result = await _ai.ScoreChurnAsync(customerId, ct);
        var score = await _db.ChurnScores.FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (score is null) _db.ChurnScores.Add(new Domain.Entities.ChurnScore { Id = Guid.NewGuid(), CustomerId = customerId, Score = result.Score, Band = result.Band, TopFactorsJson = JsonSerializer.Serialize(result.TopFactors), ComputedAt = DateTime.UtcNow });
        else { score.Score = result.Score; score.Band = result.Band; score.TopFactorsJson = JsonSerializer.Serialize(result.TopFactors); score.ComputedAt = DateTime.UtcNow; }
        await _db.SaveChangesAsync(ct);
        return Ok(result);
    }

    [HttpGet("portfolio-summary")]
    public async Task<ActionResult<object>> Portfolio(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var summary = await _ai.SummarisePortfolioAsync(tenantId, ct);
        await RecordAiInvocation(AiTaskType.PortfolioSummary, "portfolio", true, summary, 0, 0, null, ct);
        return Ok(new { summary });
    }

    [HttpGet("search")]
    public async Task<ActionResult> Search([FromQuery] string q, [FromQuery] int take = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q)) return BadRequest(new { code = "query_required", message = "Απαιτείται όρος αναζήτησης." });
        return Ok(await _ai.SemanticSearchAsync(q.Trim(), Math.Clamp(take, 1, 50), ct));
    }

    private async Task RecordAiInvocation(AiTaskType task, string? prompt, bool success, string? response, int promptTokens, int completionTokens, string? error, CancellationToken ct)
    {
        var tenantId = _current.TenantId; if (tenantId is null) return;
        _db.AiInvocations.Add(new Domain.Entities.AiInvocation { Id = Guid.NewGuid(), TenantId = tenantId.Value, UserId = _current.UserId, TaskType = task, Model = _ai.Model, PromptRedacted = prompt is null ? null : prompt[..Math.Min(prompt.Length, 4000)], ResponseRedacted = response is null ? null : response[..Math.Min(response.Length, 4000)], PromptTokens = promptTokens, CompletionTokens = completionTokens, Success = success, ErrorMessage = error });
        await _db.SaveChangesAsync(ct);
    }
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
    private readonly ICurrentUser _current;
    public BillingController(AppDbContext db, IBankStatementParser parser, IPaymentReconciler reconciler, ICurrentUser current)
    { _db = db; _parser = parser; _reconciler = reconciler; _current = current; }

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
        if (body.TotalAmount <= 0) throw AppException.Validation("Το συνολικό ποσό πρέπει να είναι μεγαλύτερο από μηδέν.");
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (!await _db.Policies.AnyAsync(x => x.Id == body.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Συμβόλαιο");
        var amount = Math.Round(body.TotalAmount / body.Installments, 2);
        var stepDays = body.Frequency.ToLowerInvariant() switch
        { "monthly" => 30, "quarterly" => 90, "semiannual" => 182, _ => 30 };

        var created = new List<Domain.Entities.Installment>();
        var accumulated = 0m;
        for (var i = 0; i < body.Installments; i++)
        {
            var lineAmount = i == body.Installments - 1 ? Math.Round(body.TotalAmount - accumulated, 2) : amount;
            accumulated += lineAmount;
            created.Add(new Domain.Entities.Installment
            {
                Id = Guid.NewGuid(),
                PolicyId = body.PolicyId,
                SequenceNumber = i + 1,
                DueDate = body.Start.AddDays(stepDays * i),
                Amount = lineAmount,
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
    private readonly AppDbContext _db;
    public MyDataController(IMyDataClient client, AppDbContext db) { _client = client; _db = db; }

    public record SubmitBody(Guid InvoiceId);

    [HttpPost("submit")]
    public async Task<ActionResult<MyDataSubmitResult>> Submit([FromBody] SubmitBody body, CancellationToken ct)
    {
        var invoice = await _db.MyDataInvoices.FirstOrDefaultAsync(x => x.Id == body.InvoiceId && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Παραστατικό");
        if (invoice.Status == MyDataInvoiceStatus.Accepted) return Ok(new MyDataSubmitResult(true, invoice.MyDataMark, invoice.MyDataUid, null));
        var result = await _client.SubmitInvoiceAsync(new MyDataSubmitRequest(body.InvoiceId), ct);
        invoice.Status = result.Success ? MyDataInvoiceStatus.Accepted : MyDataInvoiceStatus.Failed; invoice.MyDataMark = result.Mark; invoice.MyDataUid = result.Uid; invoice.ErrorMessage = result.ErrorMessage; invoice.SubmittedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct); return Ok(result);
    }

    [HttpPost("cancel/{mark}")]
    public async Task<ActionResult<MyDataSubmitResult>> Cancel(string mark, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(mark)) throw AppException.Validation("Το MARK είναι υποχρεωτικό.");
        var invoice = await _db.MyDataInvoices.FirstOrDefaultAsync(x => x.MyDataMark == mark && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Παραστατικό");
        var result = await _client.CancelInvoiceAsync(mark, ct);
        if (result.Success) { invoice.Status = MyDataInvoiceStatus.Cancelled; invoice.CancellationMark = result.Mark; } else invoice.ErrorMessage = result.ErrorMessage;
        await _db.SaveChangesAsync(ct); return Ok(result);
    }
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
    private readonly IAudioTranscriber _transcriber;
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public TelephonyController(ITelephonyAdapter phone, IAudioTranscriber transcriber, AppDbContext db, ICurrentUser current) { _phone = phone; _transcriber = transcriber; _db = db; _current = current; }

    public record OutboundBody(string ToNumber, Guid UserId, Guid? CustomerId);

    [HttpPost("call")]
    public async Task<ActionResult> Call([FromBody] OutboundBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.ToNumber)) throw AppException.Validation("Ο αριθμός τηλεφώνου είναι υποχρεωτικός.");
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? body.UserId;
        if (!await _db.Users.AnyAsync(x => x.Id == userId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Χρήστης");
        if (body.CustomerId is Guid customerId && !await _db.Customers.AnyAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Πελάτης");
        var providerId = await _phone.PlaceOutboundCallAsync(body.ToNumber.Trim(), userId, body.CustomerId, ct);
        _db.CallRecords.Add(new Domain.Entities.CallRecord { Id = Guid.NewGuid(), UserId = userId, CustomerId = body.CustomerId, Direction = CallDirection.Outbound, Status = CallStatus.Ringing, FromNumber = string.Empty, ToNumber = body.ToNumber.Trim(), StartedAt = DateTime.UtcNow, ProviderCallId = providerId });
        await _db.SaveChangesAsync(ct);
        return Ok(new { callId = providerId });
    }

    [HttpGet("calls/{id:guid}/recording")]
    public async Task<IActionResult> Recording(Guid id, CancellationToken ct)
    {
        var call = await _db.CallRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Κλήση");
        if (string.IsNullOrWhiteSpace(call.ProviderCallId)) throw AppException.NotFound("Ηχογράφηση");
        var stream = await _phone.DownloadRecordingAsync(call.ProviderCallId, ct);
        return File(stream, "audio/mpeg", $"call-{id:N}.mp3");
    }

    [HttpPost("calls/{id:guid}/transcribe")]
    public async Task<ActionResult<TranscriptionResult>> Transcribe(Guid id, CancellationToken ct)
    {
        var call = await _db.CallRecords.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Κλήση");
        if (string.IsNullOrWhiteSpace(call.ProviderCallId)) throw AppException.NotFound("Ηχογράφηση");
        await using var recording = await _phone.DownloadRecordingAsync(call.ProviderCallId, ct);
        var result = await _transcriber.TranscribeAsync(recording, "audio/mpeg", "el", ct);
        if (!result.Success) return Ok(result);
        var transcript = new Domain.Entities.Transcript { Id = Guid.NewGuid(), TenantId = call.TenantId, Provider = _transcriber.Provider, Language = result.Language, Confidence = result.Confidence, FullText = result.Text ?? string.Empty, SegmentsJson = result.SegmentsJson, TranscribedAt = DateTime.UtcNow };
        _db.Transcripts.Add(transcript); call.TranscriptId = transcript.Id;
        await _db.SaveChangesAsync(ct);
        return Ok(result);
    }

    [HttpGet("calls/{id:guid}/transcript")]
    public async Task<ActionResult> Transcript(Guid id, CancellationToken ct)
    {
        var transcript = await _db.CallRecords.Where(x => x.Id == id && x.DeletedAt == null && x.TranscriptId != null).Select(x => x.Transcript).FirstOrDefaultAsync(ct);
        if (transcript is null) throw AppException.NotFound("Απομαγνητοφώνηση");
        return Ok(new { transcript.Id, transcript.Provider, transcript.Language, transcript.Confidence, transcript.FullText, transcript.SegmentsJson, transcript.TranscribedAt });
    }

    public record WebhookBody(string ProviderCallId, string FromNumber, string ToNumber, CallStatus Status, int? DurationSeconds, Guid? CustomerId, Guid? TenantId, string? Signature);
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook([FromBody] WebhookBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.ProviderCallId)) return BadRequest(new { code = "provider_call_id_required" });
        var tenantId = _current.TenantId;
        if (tenantId is null)
        {
            tenantId = body.TenantId;
            if (!tenantId.HasValue || string.IsNullOrWhiteSpace(body.Signature)) return Unauthorized();
            var connection = await _db.TelephonyConnections.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IsActive && x.DeletedAt == null, ct);
            if (connection is null || string.IsNullOrWhiteSpace(connection.WebhookSecret)) return Unauthorized();
            var canonical = $"{body.ProviderCallId}|{body.FromNumber}|{body.ToNumber}|{body.Status}|{body.DurationSeconds}|{body.CustomerId}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(connection.WebhookSecret));
            var expected = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical)));
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(body.Signature.Trim().ToUpperInvariant()))) return Unauthorized();
        }
        if (body.CustomerId is Guid customerId && !await _db.Customers.AnyAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)) return BadRequest(new { code = "customer_not_found" });
        var call = await _db.CallRecords.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProviderCallId == body.ProviderCallId && x.DeletedAt == null, ct);
        if (call is null) { call = new Domain.Entities.CallRecord { Id = Guid.NewGuid(), TenantId = tenantId.Value, ProviderCallId = body.ProviderCallId, Direction = CallDirection.Inbound, StartedAt = DateTime.UtcNow, FromNumber = body.FromNumber ?? string.Empty, ToNumber = body.ToNumber ?? string.Empty }; _db.CallRecords.Add(call); }
        call.Status = body.Status; call.DurationSeconds = body.DurationSeconds; call.EndedAt = body.Status is CallStatus.Ended or CallStatus.Missed ? DateTime.UtcNow : call.EndedAt; call.CustomerId = body.CustomerId ?? call.CustomerId;
        await _db.SaveChangesAsync(ct); return Ok(new { accepted = true, call.Id });
    }
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
    private readonly ICurrentUser _current;
    public CustomReportsController(AppDbContext db, IReportRunner runner, ICurrentUser current) { _db = db; _runner = runner; _current = current; }

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
        if (string.IsNullOrWhiteSpace(body.Name) || body.Name.Length > 120) throw AppException.Validation("Το όνομα της αναφοράς είναι υποχρεωτικό.");
        if (!new[] { "Private", "Team", "Tenant" }.Contains(body.Visibility, StringComparer.OrdinalIgnoreCase)) throw AppException.Validation("Μη έγκυρη ορατότητα αναφοράς.");
        var def = new Domain.Entities.ReportDefinition
        {
            Id = Guid.NewGuid(),
            Name = body.Name.Trim(), Entity = body.Entity, OwnerUserId = _current.UserId,
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
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public SubscriptionBillingController(ISubscriptionBilling billing, AppDbContext db, ICurrentUser current) { _billing = billing; _db = db; _current = current; }

    public record CheckoutBody(string PriceCode, string SuccessUrl, string CancelUrl);

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("checkout")]
    public async Task<ActionResult> Checkout([FromBody] CheckoutBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.PriceCode) || string.IsNullOrWhiteSpace(body.SuccessUrl) || string.IsNullOrWhiteSpace(body.CancelUrl)) throw AppException.Validation("Το πακέτο και οι διευθύνσεις επιστροφής είναι υποχρεωτικά.");
        var url = await _billing.CreateCheckoutAsync(tenantId, body.PriceCode.Trim(), body.SuccessUrl, body.CancelUrl, ct);
        var subscription = await _db.TenantSubscriptions.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (subscription is null) { subscription = new Domain.Entities.TenantSubscription { Id = Guid.NewGuid(), TenantId = tenantId, ProviderCode = _billing.Provider, Plan = body.PriceCode.Trim(), State = SubscriptionState.Trial }; _db.TenantSubscriptions.Add(subscription); }
        else subscription.Plan = body.PriceCode.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(new { url });
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("portal")]
    public async Task<ActionResult> Portal([FromQuery] string returnUrl, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(returnUrl)) throw AppException.Validation("Η διεύθυνση επιστροφής είναι υποχρεωτική.");
        var session = await _billing.CreatePortalSessionAsync(tenantId, returnUrl, ct);
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
        if (string.IsNullOrWhiteSpace(eventId)) return BadRequest(new { code = "event_id_required" });
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
    private readonly AppDbContext _db;
    public DocumentIntelligenceController(IOcrService ocr, IFileScanner scanner, AppDbContext db) { _ocr = ocr; _scanner = scanner; _db = db; }

    [HttpPost("ocr")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<OcrResult>> Ocr(IFormFile file, [FromQuery] string? language = "el", [FromQuery] Guid? documentId = null, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0) return BadRequest(new { code = "file_required" });
        using var s = file.OpenReadStream();
        var result = await _ocr.ExtractAsync(s, file.ContentType, language, ct);
        if (documentId is Guid id && await _db.PolicyDocuments.AnyAsync(x => x.Id == id && x.DeletedAt == null, ct)) _db.DocumentExtractions.Add(new Domain.Entities.DocumentExtraction { Id = Guid.NewGuid(), DocumentId = id, Provider = _ocr.Provider, TextContent = result.Text, StructuredJson = result.StructuredJson, Confidence = result.Confidence, ExtractedAt = DateTime.UtcNow, Language = language });
        await _db.SaveChangesAsync(ct);
        return Ok(result);
    }

    [HttpPost("scan")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<FileScanReport>> Scan(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { code = "file_required" });
        using var s = file.OpenReadStream();
        var result = await _scanner.ScanAsync(s, ct);
        _db.FileScanResults.Add(new Domain.Entities.FileScanResult { Id = Guid.NewGuid(), FileKey = file.FileName.Trim(), Scanner = _scanner.GetType().Name, Clean = result.Clean, Verdict = result.Verdict, Signature = result.Signature, ScannedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync(ct);
        return Ok(result);
    }
}
