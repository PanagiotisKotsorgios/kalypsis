using System.Globalization;
using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers.Phase3;

/// <summary>
/// Phase 3 completion surface.  These operations deliberately sit on top of
/// the existing carrier/billing/workflow abstractions: external credentials
/// can be plugged in later without changing the office-facing contract.
/// Every query is tenant/office filtered by AppDbContext and every transition
/// is idempotent where an external provider may retry a callback.
/// </summary>
[ApiController]
[Route("api/carrier-operations")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public sealed class CarrierOperationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICarrierAdapterRegistry _adapters;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly IDateTimeProvider _clock;

    public CarrierOperationsController(AppDbContext db, ICarrierAdapterRegistry adapters, ICurrentUser current,
        IFileStorage storage, IDateTimeProvider clock)
    { _db = db; _adapters = adapters; _current = current; _storage = storage; _clock = clock; }

    public record IssueBody(Guid QuoteId, Guid OfferId, DateOnly StartDate, DateOnly EndDate, string? AgentCode);
    public record LifecycleResult(Guid ApplicationId, string Status, Guid? PolicyId, string? PolicyNumber, string? Error);

    [HttpPost("issue")]
    public async Task<ActionResult<LifecycleResult>> Issue([FromBody] IssueBody body, CancellationToken ct)
    {
        if (body.EndDate <= body.StartDate) throw AppException.Validation("Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.");
        var quote = await _db.Quotes.Include(x => x.Customer).Include(x => x.Offers)
            .FirstOrDefaultAsync(x => x.Id == body.QuoteId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Προσφορά");
        var offer = quote.Offers.FirstOrDefault(x => x.Id == body.OfferId)
            ?? throw AppException.NotFound("Προσφορά ασφαλιστικής");
        if (quote.Customer is null) throw AppException.Validation("Η προσφορά πρέπει να συνδεθεί με πελάτη πριν την έκδοση.");
        var adapter = _adapters.Resolve(offer.CarrierCode) ?? throw AppException.Validation("Δεν υπάρχει ενεργή γέφυρα για την ασφαλιστική.");
        var carrier = await FindCarrierAsync(offer.CarrierCode, ct) ?? throw AppException.NotFound("Ασφαλιστική εταιρεία");
        var application = await _db.PolicyApplications.Include(x => x.IssuedPolicy)
            .FirstOrDefaultAsync(x => x.QuoteId == quote.Id && x.SelectedOfferId == offer.Id && x.DeletedAt == null, ct);
        if (application?.IssuedPolicy is not null)
            return Ok(new LifecycleResult(application.Id, application.Status, application.IssuedPolicyId,
                application.IssuedPolicy.PolicyNumber, null));
        application ??= new PolicyApplication
        {
            Id = Guid.NewGuid(), TenantId = quote.TenantId, QuoteId = quote.Id, SelectedOfferId = offer.Id,
            ApplicationNumber = $"APP-{_clock.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            Status = "Submitted"
        };
        if (_db.Entry(application).State == EntityState.Detached) _db.PolicyApplications.Add(application);

        var started = _clock.UtcNow;
        CarrierIssuanceResult result;
        try
        {
            result = await adapter.IssuePolicyAsync(new CarrierIssuanceRequest(
                quote.ProductType, offer.CarrierProductCode ?? quote.ProductType,
                $"{quote.Customer.FirstName} {quote.Customer.LastName}".Trim(), quote.Customer.VatNumber,
                quote.RiskInputsJson, body.StartDate, body.EndDate, offer.Premium, body.AgentCode), ct);
        }
        catch (Exception ex)
        {
            result = new CarrierIssuanceResult(false, null, null, null, ex.Message);
        }
        _db.CarrierOperationLogs.Add(new CarrierOperationLog
        {
            Id = Guid.NewGuid(), TenantId = quote.TenantId, CarrierCode = offer.CarrierCode,
            Operation = CarrierOperation.IssuePolicy, CorrelationId = application.ApplicationNumber,
            Success = result.Success, DurationMs = Math.Max(0, (int)(_clock.UtcNow - started).TotalMilliseconds),
            ResponseSummary = result.Success ? "Policy issued" : null, ErrorMessage = result.ErrorMessage
        });
        if (!result.Success)
        {
            application.Status = "Rejected"; application.CarrierResponseRedacted = result.ErrorMessage;
            await _db.SaveChangesAsync(ct);
            return Ok(new LifecycleResult(application.Id, application.Status, null, null, result.ErrorMessage));
        }
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = quote.TenantId, PolicyNumber = result.CarrierPolicyNumber ?? application.ApplicationNumber,
            ApplicationNumber = application.ApplicationNumber, CustomerId = quote.CustomerId!.Value,
            InsuranceCompanyId = carrier.Id, PolicyType = MapPolicyType(quote.ProductType), Status = PolicyStatus.Active,
            StartDate = body.StartDate, EndDate = body.EndDate, IssuedAt = body.StartDate,
            Premium = offer.Premium, Currency = offer.Currency, CreatedByUserId = _current.UserId,
            SpecsJson = quote.RiskInputsJson
        };
        _db.Policies.Add(policy);
        application.Status = "Issued"; application.CarrierApplicationId = result.CarrierApplicationId;
        application.CarrierResponseRedacted = result.RawResponseRedacted; application.IssuedPolicyId = policy.Id;
        quote.Status = QuoteStatus.Bound; quote.SelectedOfferId = offer.Id;
        await _db.SaveChangesAsync(ct);
        return Ok(new LifecycleResult(application.Id, application.Status, policy.Id, policy.PolicyNumber, null));
    }

    public record RenewBody(DateOnly StartDate, DateOnly EndDate);
    [HttpPost("policies/{policyId:guid}/renew")]
    public async Task<ActionResult<object>> Renew(Guid policyId, [FromBody] RenewBody body, CancellationToken ct)
    {
        if (body.EndDate <= body.StartDate) throw AppException.Validation("Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.");
        var old = await _db.Policies.Include(x => x.InsuranceCompany).FirstOrDefaultAsync(x => x.Id == policyId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        var adapter = _adapters.Resolve(old.InsuranceCompany.Code) ?? throw AppException.Validation("Δεν υπάρχει ενεργή γέφυρα για την ασφαλιστική.");
        var result = await adapter.RenewPolicyAsync(new CarrierRenewalRequest(old.PolicyNumber, body.StartDate, body.EndDate), ct);
        _db.CarrierOperationLogs.Add(new CarrierOperationLog { Id = Guid.NewGuid(), TenantId = old.TenantId, CarrierCode = old.InsuranceCompany.Code, Operation = CarrierOperation.RenewPolicy, CorrelationId = old.PolicyNumber, Success = result.Success, DurationMs = 0, ErrorMessage = result.ErrorMessage, ResponseSummary = result.RawResponseRedacted });
        if (!result.Success) { await _db.SaveChangesAsync(ct); return BadRequest(new { code = "carrier_renewal_failed", message = result.ErrorMessage }); }
        old.Status = PolicyStatus.Renewed;
        var renewed = new Policy { Id = Guid.NewGuid(), TenantId = old.TenantId, PolicyNumber = result.CarrierPolicyNumber ?? $"{old.PolicyNumber}-R", ApplicationNumber = result.CarrierApplicationId, CustomerId = old.CustomerId, InsuranceCompanyId = old.InsuranceCompanyId, ProducerId = old.ProducerId, PolicyType = old.PolicyType, Status = PolicyStatus.Active, StartDate = body.StartDate, EndDate = body.EndDate, IssuedAt = body.StartDate, Premium = old.Premium, Currency = old.Currency, NetPremium = old.NetPremium, VatAmount = old.VatAmount, StampDutyAmount = old.StampDutyAmount, SpecsJson = old.SpecsJson, RenewedFromPolicyId = old.Id, CreatedByUserId = _current.UserId };
        _db.Policies.Add(renewed); await _db.SaveChangesAsync(ct);
        return Ok(new { policyId = renewed.Id, policyNumber = renewed.PolicyNumber, status = renewed.Status.ToString() });
    }

    public record CancelBody(DateOnly CancellationDate, string? Reason);
    [HttpPost("policies/{policyId:guid}/cancel")]
    public async Task<ActionResult<object>> Cancel(Guid policyId, [FromBody] CancelBody body, CancellationToken ct)
    {
        var policy = await _db.Policies.Include(x => x.InsuranceCompany).FirstOrDefaultAsync(x => x.Id == policyId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        var adapter = _adapters.Resolve(policy.InsuranceCompany.Code) ?? throw AppException.Validation("Δεν υπάρχει ενεργή γέφυρα για την ασφαλιστική.");
        var result = await adapter.CancelPolicyAsync(new CarrierCancellationRequest(policy.PolicyNumber, body.CancellationDate, body.Reason), ct);
        _db.CarrierOperationLogs.Add(new CarrierOperationLog { Id = Guid.NewGuid(), TenantId = policy.TenantId, CarrierCode = policy.InsuranceCompany.Code, Operation = CarrierOperation.CancelPolicy, CorrelationId = policy.PolicyNumber, Success = result.Success, DurationMs = 0, ErrorMessage = result.ErrorMessage, ResponseSummary = result.Refund?.ToString(CultureInfo.InvariantCulture) });
        if (!result.Success) { await _db.SaveChangesAsync(ct); return BadRequest(new { code = "carrier_cancellation_failed", message = result.ErrorMessage }); }
        policy.Status = PolicyStatus.Cancelled;
        if (!await _db.PolicyCancellations.AnyAsync(x => x.PolicyId == policyId && x.Status == PolicyCancellationStatus.Effective && x.DeletedAt == null, ct))
        {
            _db.PolicyCancellations.Add(new PolicyCancellation
            {
                Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
                CancellationNumber = $"AK-{_clock.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                Status = PolicyCancellationStatus.Effective, ReasonText = body.Reason?.Trim(), RequestedAt = body.CancellationDate,
                EffectiveFrom = body.CancellationDate, RefundMethod = "Carrier", RefundAmount = result.Refund ?? 0m,
                Currency = policy.Currency, CarrierReference = policy.PolicyNumber, CreatedByUserId = _current.UserId,
                ApprovedByUserId = _current.UserId, ApprovedAt = _clock.UtcNow
            });
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new { policyId, status = policy.Status.ToString(), refund = result.Refund });
    }

    [HttpGet("policies/{policyId:guid}/documents")]
    public async Task<ActionResult<IReadOnlyList<object>>> Documents(Guid policyId, CancellationToken ct)
    {
        var policy = await _db.Policies.Include(x => x.InsuranceCompany).Include(x => x.Documents).FirstOrDefaultAsync(x => x.Id == policyId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        var adapter = _adapters.Resolve(policy.InsuranceCompany.Code) ?? throw AppException.Validation("Δεν υπάρχει ενεργή γέφυρα για την ασφαλιστική.");
        var docs = await adapter.FetchDocumentsAsync(policy.PolicyNumber, ct);
        foreach (var doc in docs)
        {
            if (policy.Documents.Any(x => x.FileName == doc.FileName && x.DeletedAt == null)) continue;
            await using var stream = new MemoryStream(doc.Bytes, writable: false);
            var path = await _storage.UploadAsync($"policies/{policy.TenantId:N}/{policy.Id:N}", doc.FileName, doc.MimeType, stream, ct);
            _db.PolicyDocuments.Add(new PolicyDocument { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id, DocumentType = DocumentType.Policy, FileName = doc.FileName, StoragePath = path, MimeType = doc.MimeType, SizeBytes = doc.Bytes.LongLength, UploadedByUserId = _current.UserId });
        }
        await _db.SaveChangesAsync(ct);
        return Ok(await _db.PolicyDocuments.AsNoTracking().Where(x => x.PolicyId == policy.Id && x.DeletedAt == null).Select(x => new { x.Id, x.FileName, x.MimeType, x.SizeBytes, x.CreatedAt }).ToListAsync(ct));
    }

    private async Task<InsuranceCompany?> FindCarrierAsync(string code, CancellationToken ct)
        => await _db.InsuranceCompanies.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.IsActive && x.DeletedAt == null && (x.Code == code || x.Code.ToUpper() == code.ToUpper()), ct);

    private static PolicyType MapPolicyType(string value) => Enum.TryParse<PolicyType>(value, true, out var type) ? type : value.ToLowerInvariant() switch { "auto" or "motor" => PolicyType.Auto, "home" or "property" => PolicyType.Home, "health" => PolicyType.Health, "life" => PolicyType.Life, "business" => PolicyType.Business, "travel" => PolicyType.Travel, _ => PolicyType.Other };
}

[ApiController]
[Route("api/billing/extended")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public sealed class BillingCompletionController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public BillingCompletionController(AppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public record PaymentBody(decimal Amount, DateOnly PaidOn, string Method, string? Reference);
    [HttpPost("installments/{id:guid}/payments")]
    public async Task<ActionResult<object>> AddPayment(Guid id, [FromBody] PaymentBody body, CancellationToken ct)
    {
        if (body.Amount <= 0) throw AppException.Validation("Το ποσό πρέπει να είναι μεγαλύτερο από μηδέν.");
        var installment = await _db.Installments.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Δόση");
        var remaining = Math.Round(installment.Amount - installment.PaidAmount, 2);
        if (body.Amount > remaining) throw AppException.Validation("Το ποσό υπερβαίνει το ανεξόφλητο υπόλοιπο.");
        installment.PaidAmount += body.Amount; installment.Status = installment.PaidAmount >= installment.Amount ? InstallmentStatus.Paid : InstallmentStatus.PartiallyPaid;
        _db.InstallmentPayments.Add(new InstallmentPayment { Id = Guid.NewGuid(), TenantId = installment.TenantId, InstallmentId = id, Amount = body.Amount, PaidOn = body.PaidOn, Method = string.IsNullOrWhiteSpace(body.Method) ? "BankTransfer" : body.Method.Trim(), Reference = body.Reference?.Trim() });
        await _db.SaveChangesAsync(ct);
        return Ok(new { installment.Id, installment.Amount, installment.PaidAmount, remaining = installment.Amount - installment.PaidAmount, status = installment.Status.ToString() });
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<object>> Dashboard(CancellationToken ct)
    {
        var rows = await _db.Installments.AsNoTracking().Where(x => x.DeletedAt == null).ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(new { total = rows.Sum(x => x.Amount), paid = rows.Sum(x => x.PaidAmount), outstanding = rows.Sum(x => Math.Max(0, x.Amount - x.PaidAmount)), overdue = rows.Where(x => x.DueDate < today && x.PaidAmount < x.Amount).Sum(x => Math.Max(0, x.Amount - x.PaidAmount)), counts = rows.GroupBy(x => x.Status.ToString()).ToDictionary(x => x.Key, x => x.Count()) });
    }
}

[ApiController]
[Route("api/mydata/invoices")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public sealed class MyDataInvoiceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMyDataClient _client;
    private readonly ICurrentUser _current;
    public MyDataInvoiceController(AppDbContext db, IMyDataClient client, ICurrentUser current) { _db = db; _client = client; _current = current; }
    public record InvoiceLineBody(string Description, decimal Quantity, decimal UnitPrice, decimal VatRate, string? IncomeClassification);
    public record CreateInvoiceBody(string InvoiceNumber, string Series, DateOnly IssueDate, Guid? CustomerId, string CustomerVat, string CustomerName, string DocumentType, IReadOnlyList<InvoiceLineBody> Lines);
    public record InvoiceDto(Guid Id, string InvoiceNumber, string Series, DateOnly IssueDate, MyDataInvoiceStatus Status, decimal NetAmount, decimal VatAmount, decimal GrossAmount, string? Mark, IReadOnlyList<object> Lines);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InvoiceDto>>> List(CancellationToken ct)
    {
        var rows = await _db.MyDataInvoices.AsNoTracking().Include(x => x.Lines).Where(x => x.DeletedAt == null).OrderByDescending(x => x.IssueDate).Take(500).ToListAsync(ct);
        return Ok(rows.Select(ToDto()).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<InvoiceDto>> Create([FromBody] CreateInvoiceBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.InvoiceNumber) || body.Lines is null || body.Lines.Count == 0) throw AppException.Validation("Το παραστατικό χρειάζεται αριθμό και τουλάχιστον μία γραμμή.");
        var duplicate = await _db.MyDataInvoices.AnyAsync(x => x.InvoiceNumber == body.InvoiceNumber.Trim() && x.Series == body.Series.Trim() && x.DeletedAt == null, ct);
        if (duplicate) throw new AppException("invoice_duplicate", "Υπάρχει ήδη παραστατικό με τον ίδιο αριθμό και σειρά.", 409);
        if (body.CustomerId is Guid customerId && !await _db.Customers.AnyAsync(x => x.Id == customerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Πελάτης");
        var lines = body.Lines.Where(x => !string.IsNullOrWhiteSpace(x.Description) && x.Quantity > 0 && x.UnitPrice >= 0).ToList();
        if (lines.Count == 0) throw AppException.Validation("Δεν βρέθηκαν έγκυρες γραμμές.");
        var net = lines.Sum(x => Math.Round(x.Quantity * x.UnitPrice, 2));
        var vat = lines.Sum(x => Math.Round(x.Quantity * x.UnitPrice * x.VatRate / 100m, 2));
        var invoice = new MyDataInvoice { Id = Guid.NewGuid(), TenantId = tenantId, InvoiceNumber = body.InvoiceNumber.Trim(), Series = body.Series.Trim(), IssueDate = body.IssueDate, CustomerId = body.CustomerId, CustomerVat = body.CustomerVat?.Trim() ?? string.Empty, CustomerName = body.CustomerName?.Trim() ?? string.Empty, DocumentType = string.IsNullOrWhiteSpace(body.DocumentType) ? "1.1" : body.DocumentType.Trim(), NetAmount = net, VatAmount = vat, GrossAmount = net + vat, Status = MyDataInvoiceStatus.Draft };
        invoice.Lines = lines.Select((x, i) => new MyDataInvoiceLine { Id = Guid.NewGuid(), TenantId = tenantId, InvoiceId = invoice.Id, Position = i + 1, Description = x.Description.Trim(), Quantity = x.Quantity, UnitPrice = x.UnitPrice, VatRate = x.VatRate, IncomeClassification = x.IncomeClassification ?? "category1_2" }).ToList();
        _db.MyDataInvoices.Add(invoice); await _db.SaveChangesAsync(ct);
        return Ok(ToDto(invoice));
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<InvoiceDto>> Submit(Guid id, CancellationToken ct)
    {
        var invoice = await _db.MyDataInvoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Παραστατικό");
        if (invoice.Status == MyDataInvoiceStatus.Accepted) return Ok(ToDto(invoice));
        var result = await _client.SubmitInvoiceAsync(new MyDataSubmitRequest(id), ct);
        invoice.Status = result.Success ? MyDataInvoiceStatus.Accepted : MyDataInvoiceStatus.Failed; invoice.MyDataMark = result.Mark; invoice.MyDataUid = result.Uid; invoice.ErrorMessage = result.ErrorMessage; invoice.SubmittedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct); return Ok(ToDto(invoice));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<InvoiceDto>> Cancel(Guid id, CancellationToken ct)
    {
        var invoice = await _db.MyDataInvoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Παραστατικό");
        if (invoice.Status != MyDataInvoiceStatus.Accepted || string.IsNullOrWhiteSpace(invoice.MyDataMark)) throw AppException.Validation("Μπορεί να ακυρωθεί μόνο αποδεκτό παραστατικό με MARK.");
        var result = await _client.CancelInvoiceAsync(invoice.MyDataMark, ct);
        if (result.Success) { invoice.Status = MyDataInvoiceStatus.Cancelled; invoice.CancellationMark = result.Mark; }
        else invoice.ErrorMessage = result.ErrorMessage;
        await _db.SaveChangesAsync(ct); return Ok(ToDto(invoice));
    }

    private static Func<MyDataInvoice, InvoiceDto> ToDto() => x => new InvoiceDto(x.Id, x.InvoiceNumber, x.Series, x.IssueDate, x.Status, x.NetAmount, x.VatAmount, x.GrossAmount, x.MyDataMark, x.Lines.OrderBy(l => l.Position).Select(l => (object)new { l.Description, l.Quantity, l.UnitPrice, l.VatRate, l.IncomeClassification }).ToList());
    private static InvoiceDto ToDto(MyDataInvoice x) => ToDto()(x);
}

[ApiController]
[Route("api/phase3/ai")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public sealed class AiUsageController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public AiUsageController(AppDbContext db, ICurrentUser current) { _db = db; _current = current; }
    [HttpGet("usage")]
    public async Task<ActionResult<object>> Usage([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var start = from?.ToDateTime(TimeOnly.MinValue) ?? DateTime.UtcNow.Date.AddDays(-30); var end = to?.ToDateTime(TimeOnly.MaxValue) ?? DateTime.UtcNow;
        var rows = await _db.AiInvocations.AsNoTracking().Where(x => x.CreatedAt >= start && x.CreatedAt <= end && x.DeletedAt == null).ToListAsync(ct);
        var prompt = rows.Sum(x => x.PromptTokens ?? 0); var completion = rows.Sum(x => x.CompletionTokens ?? 0);
        return Ok(new { from = start, to = end, invocations = rows.Count, successful = rows.Count(x => x.Success), failed = rows.Count(x => !x.Success), promptTokens = prompt, completionTokens = completion, totalTokens = prompt + completion, byTask = rows.GroupBy(x => x.TaskType.ToString()).ToDictionary(x => x.Key, x => new { calls = x.Count(), tokens = x.Sum(y => (y.PromptTokens ?? 0) + (y.CompletionTokens ?? 0)) }) });
    }
}

/// <summary>Tenant-safe mailbox management and deterministic message ingestion.</summary>
[ApiController]
[Route("api/mailboxes/managed")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Integrations)]
public sealed class MailboxOperationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMailboxSyncer _syncer;
    private readonly ICurrentUser _current;

    public MailboxOperationsController(AppDbContext db, IMailboxSyncer syncer, ICurrentUser current)
    { _db = db; _syncer = syncer; _current = current; }

    public record MailboxDto(Guid Id, MailboxProvider Provider, string EmailAddress, bool IsActive, DateTime? LastSyncedAt, string? LastSyncStatus);
    public record UpsertMailboxBody(MailboxProvider Provider, string EmailAddress, Guid? UserId, string? ImapHost, int? ImapPort, string? ImapUsername, string? ImapPassword, bool IsActive);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MailboxDto>>> List(CancellationToken ct)
        => Ok(await _db.MailboxConnections.AsNoTracking().Where(x => x.DeletedAt == null)
            .OrderBy(x => x.EmailAddress).Select(x => new MailboxDto(x.Id, x.Provider, x.EmailAddress, x.IsActive, x.LastSyncedAt, x.LastSyncStatus)).ToListAsync(ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<MailboxDto>> Create([FromBody] UpsertMailboxBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (!Enum.IsDefined(body.Provider) || string.IsNullOrWhiteSpace(body.EmailAddress)) throw AppException.Validation("Ο πάροχος και το email είναι υποχρεωτικά.");
        var userId = body.UserId ?? _current.UserId ?? throw AppException.Validation("Δεν βρέθηκε χρήστης για τη σύνδεση.");
        if (!await _db.Users.AnyAsync(x => x.Id == userId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Χρήστης");
        // A mailbox is identified by tenant + provider + address. Reusing an existing
        // row keeps OAuth refreshes idempotent and avoids duplicate inboxes.
        var existing = await _db.MailboxConnections.FirstOrDefaultAsync(x => x.Provider == body.Provider && x.EmailAddress == body.EmailAddress.Trim() && x.DeletedAt == null, ct);
        if (existing is null)
        {
            existing = new MailboxConnection { Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId, Provider = body.Provider, EmailAddress = body.EmailAddress.Trim() };
            _db.MailboxConnections.Add(existing);
        }
        existing.UserId = userId; existing.Provider = body.Provider; existing.EmailAddress = body.EmailAddress.Trim(); existing.IsActive = body.IsActive;
        existing.ImapHost = body.ImapHost?.Trim(); existing.ImapPort = body.ImapPort; existing.ImapUsername = body.ImapUsername?.Trim();
        if (!string.IsNullOrWhiteSpace(body.ImapPassword)) existing.ImapPasswordEncrypted = body.ImapPassword;
        await _db.SaveChangesAsync(ct);
        return Ok(new MailboxDto(existing.Id, existing.Provider, existing.EmailAddress, existing.IsActive, existing.LastSyncedAt, existing.LastSyncStatus));
    }

    public record ExchangeBody(string Code, string RedirectUri);
    [HttpPost("{id:guid}/oauth/exchange")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> Exchange(Guid id, [FromBody] ExchangeBody body, CancellationToken ct)
    {
        var mailbox = await _db.MailboxConnections.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Σύνδεση mailbox");
        if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.RedirectUri)) throw AppException.Validation("Ο κωδικός και η διεύθυνση επιστροφής είναι υποχρεωτικά.");
        await _syncer.ExchangeCodeAsync(mailbox.Id, body.Code.Trim(), body.RedirectUri.Trim(), ct);
        mailbox.IsActive = true; mailbox.LastSyncStatus = "authorized";
        await _db.SaveChangesAsync(ct);
        return Ok(new { authorized = true, mailboxId = mailbox.Id });
    }

    public record SyncDto(int Added, int Skipped, DateTime Since, DateTime Until);
    [HttpPost("{id:guid}/sync")]
    public async Task<ActionResult<SyncDto>> Sync(Guid id, [FromQuery] DateTime? since, CancellationToken ct)
    {
        var mailbox = await _db.MailboxConnections.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null && x.IsActive, ct) ?? throw AppException.NotFound("Σύνδεση mailbox");
        var from = since ?? mailbox.LastSyncedAt ?? DateTime.UtcNow.AddDays(-30);
        if (from > DateTime.UtcNow) throw AppException.Validation("Η αρχική ημερομηνία συγχρονισμού δεν μπορεί να είναι στο μέλλον.");
        var until = DateTime.UtcNow;
        try
        {
            var messages = await _syncer.FetchSinceAsync(mailbox.Id, from, ct);
            var existingIds = messages.Where(x => !string.IsNullOrWhiteSpace(x.MessageId)).Select(x => x.MessageId).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var already = await _db.InboundMails.Where(x => x.MailboxConnectionId == mailbox.Id && x.MessageId != null && existingIds.Contains(x.MessageId)).Select(x => x.MessageId!).ToListAsync(ct);
            var added = 0;
            foreach (var message in messages)
            {
                if (!string.IsNullOrWhiteSpace(message.MessageId) && already.Contains(message.MessageId, StringComparer.OrdinalIgnoreCase)) continue;
                var customerId = await _db.Customers.Where(x => x.Email != null && x.Email.ToLower() == message.FromAddress.ToLower() && x.DeletedAt == null).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
                _db.InboundMails.Add(new InboundMail { Id = Guid.NewGuid(), TenantId = mailbox.TenantId, MailboxConnectionId = mailbox.Id, MessageId = message.MessageId, ThreadId = message.ThreadId, FromAddress = message.FromAddress.Trim(), FromName = message.FromName?.Trim() ?? string.Empty, Subject = message.Subject?.Trim() ?? string.Empty, BodyText = message.BodyText, BodyHtml = message.BodyHtml, ReceivedAt = message.ReceivedAt, MatchedCustomerId = customerId });
                added++;
            }
            mailbox.LastSyncedAt = until; mailbox.LastSyncStatus = $"ok:{added}";
            await _db.SaveChangesAsync(ct);
            return Ok(new SyncDto(added, messages.Count - added, from, until));
        }
        catch
        {
            mailbox.LastSyncStatus = "failed";
            await _db.SaveChangesAsync(ct);
            throw;
        }
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<ActionResult> Messages(Guid id, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (page < 1) page = 1; pageSize = Math.Clamp(pageSize, 1, 100);
        if (!await _db.MailboxConnections.AnyAsync(x => x.Id == id && x.DeletedAt == null, ct)) throw AppException.NotFound("Σύνδεση mailbox");
        var query = _db.InboundMails.AsNoTracking().Where(x => x.MailboxConnectionId == id && x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.Subject.Contains(search) || x.FromAddress.Contains(search) || x.FromName.Contains(search));
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.ReceivedAt).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new { x.Id, x.MessageId, x.FromAddress, x.FromName, x.Subject, x.ReceivedAt, x.MatchedCustomerId, x.Ignored }).ToListAsync(ct);
        return Ok(new { page, pageSize, total, items });
    }
}

/// <summary>Producer/sub-agent hierarchy with cycle and tenant validation.</summary>
[ApiController]
[Route("api/producers/hierarchy")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Intelligence)]
public sealed class ProducerHierarchyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public ProducerHierarchyController(AppDbContext db, ICurrentUser current) { _db = db; _current = current; }
    public record LinkDto(Guid Id, Guid ProducerId, string Producer, Guid ParentProducerId, string ParentProducer, string Role, DateOnly EffectiveFrom, DateOnly? EffectiveTo);
    public record LinkBody(Guid ProducerId, Guid ParentProducerId, string Role, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LinkDto>>> List(CancellationToken ct)
        => Ok(await _db.ProducerHierarchyLinks.AsNoTracking().Include(x => x.Producer).Include(x => x.ParentProducer).Where(x => x.DeletedAt == null).OrderBy(x => x.Producer.Name).Select(x => new LinkDto(x.Id, x.ProducerId, x.Producer.Name, x.ParentProducerId, x.ParentProducer.Name, x.Role, x.EffectiveFrom, x.EffectiveTo)).ToListAsync(ct));

    [HttpPost]
    public async Task<ActionResult<LinkDto>> Create([FromBody] LinkBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (body.ProducerId == body.ParentProducerId) throw AppException.Validation("Ένας συνεργάτης δεν μπορεί να είναι γονέας του εαυτού του.");
        if (string.IsNullOrWhiteSpace(body.Role) || body.Role.Length > 20) throw AppException.Validation("Ο ρόλος είναι υποχρεωτικός και έως 20 χαρακτήρες.");
        var ids = await _db.Producers.Where(x => (x.Id == body.ProducerId || x.Id == body.ParentProducerId) && x.TenantId == tenantId && x.DeletedAt == null).Select(x => x.Id).ToListAsync(ct);
        if (ids.Count != 2) throw AppException.NotFound("Συνεργάτης");
        if (await CreatesCycle(body.ProducerId, body.ParentProducerId, ct)) throw AppException.Validation("Η σύνδεση δημιουργεί κύκλο στην ιεραρχία.");
        if (await _db.ProducerHierarchyLinks.AnyAsync(x => x.ProducerId == body.ProducerId && x.ParentProducerId == body.ParentProducerId && x.DeletedAt == null, ct)) throw new AppException("hierarchy_duplicate", "Η σύνδεση υπάρχει ήδη.", 409);
        var link = new ProducerHierarchyLink { Id = Guid.NewGuid(), TenantId = tenantId, ProducerId = body.ProducerId, ParentProducerId = body.ParentProducerId, Role = body.Role.Trim(), EffectiveFrom = body.EffectiveFrom == default ? DateOnly.FromDateTime(DateTime.UtcNow) : body.EffectiveFrom, EffectiveTo = body.EffectiveTo };
        _db.ProducerHierarchyLinks.Add(link); await _db.SaveChangesAsync(ct);
        return Ok(await ToDto(link.Id, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LinkDto>> Update(Guid id, [FromBody] LinkBody body, CancellationToken ct)
    {
        var link = await _db.ProducerHierarchyLinks.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Σύνδεση ιεραρχίας");
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerCount = await _db.Producers.CountAsync(x => (x.Id == body.ProducerId || x.Id == body.ParentProducerId) && x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (producerCount != 2) throw AppException.NotFound("Συνεργάτης");
        if (string.IsNullOrWhiteSpace(body.Role) || body.Role.Length > 20) throw AppException.Validation("Ο ρόλος είναι υποχρεωτικός και έως 20 χαρακτήρες.");
        if (body.ProducerId == body.ParentProducerId || await CreatesCycle(body.ProducerId, body.ParentProducerId, ct)) throw AppException.Validation("Η σύνδεση δημιουργεί κύκλο στην ιεραρχία.");
        if (await _db.ProducerHierarchyLinks.AnyAsync(x => x.Id != id && x.ProducerId == body.ProducerId && x.ParentProducerId == body.ParentProducerId && x.DeletedAt == null, ct)) throw new AppException("hierarchy_duplicate", "Η σύνδεση υπάρχει ήδη.", 409);
        link.ProducerId = body.ProducerId; link.ParentProducerId = body.ParentProducerId; link.Role = body.Role.Trim(); link.EffectiveFrom = body.EffectiveFrom == default ? DateOnly.FromDateTime(DateTime.UtcNow) : body.EffectiveFrom; link.EffectiveTo = body.EffectiveTo;
        await _db.SaveChangesAsync(ct); return Ok(await ToDto(id, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { var link = await _db.ProducerHierarchyLinks.FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct) ?? throw AppException.NotFound("Σύνδεση ιεραρχίας"); link.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent(); }

    private async Task<bool> CreatesCycle(Guid producerId, Guid parentId, CancellationToken ct)
    {
        var visited = new HashSet<Guid>(); var cursor = parentId;
        for (var i = 0; i < 100; i++)
        {
            if (cursor == producerId) return true;
            if (!visited.Add(cursor)) return true;
            var next = await _db.ProducerHierarchyLinks.Where(x => x.ProducerId == cursor && x.DeletedAt == null).Select(x => (Guid?)x.ParentProducerId).FirstOrDefaultAsync(ct);
            if (!next.HasValue) return false; cursor = next.Value;
        }
        return true;
    }
    private async Task<LinkDto> ToDto(Guid id, CancellationToken ct) => await _db.ProducerHierarchyLinks.AsNoTracking().Include(x => x.Producer).Include(x => x.ParentProducer).Where(x => x.Id == id).Select(x => new LinkDto(x.Id, x.ProducerId, x.Producer.Name, x.ParentProducerId, x.ParentProducer.Name, x.Role, x.EffectiveFrom, x.EffectiveTo)).SingleAsync(ct);
}

/// <summary>Commission split and clawback API used by the accounting screens.</summary>
[ApiController]
[Route("api/commissions/phase3")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public sealed class CommissionOperationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICommissionSplitter _splitter;
    private readonly ICurrentUser _current;
    public CommissionOperationsController(AppDbContext db, ICommissionSplitter splitter, ICurrentUser current) { _db = db; _splitter = splitter; _current = current; }
    public record SplitBody(Guid PolicyId, decimal CarrierCommission, string Currency);
    public record ClawbackBody(decimal RefundedCommission);

    [HttpPost("split")]
    public async Task<ActionResult<CommissionSplitOutput>> Split([FromBody] SplitBody body, CancellationToken ct)
    {
        if (body.CarrierCommission <= 0) throw AppException.Validation("Η προμήθεια πρέπει να είναι μεγαλύτερη από μηδέν.");
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (!await _db.Policies.AnyAsync(x => x.Id == body.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Συμβόλαιο");
        return Ok(await _splitter.SplitAsync(new CommissionSplitInput(body.PolicyId, Math.Round(body.CarrierCommission, 2), string.IsNullOrWhiteSpace(body.Currency) ? "EUR" : body.Currency.Trim().ToUpperInvariant()), ct));
    }

    [HttpPost("policies/{policyId:guid}/clawback")]
    public async Task<ActionResult> Clawback(Guid policyId, [FromBody] ClawbackBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (body.RefundedCommission <= 0) throw AppException.Validation("Το ποσό ανάκτησης πρέπει να είναι μεγαλύτερο από μηδέν.");
        if (!await _db.Policies.AnyAsync(x => x.Id == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)) throw AppException.NotFound("Συμβόλαιο");
        var applied = await _splitter.ApplyClawbackAsync(policyId, Math.Round(body.RefundedCommission, 2), ct);
        return applied ? Ok(new { applied = true }) : Conflict(new { code = "no_commission_to_clawback", message = "Δεν βρέθηκε ενεργή προμήθεια για ανάκτηση." });
    }

    [HttpGet("policies/{policyId:guid}")]
    public async Task<ActionResult> PolicySplits(Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var transactions = await _db.CommissionTransactions.AsNoTracking().Where(x => x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null).Select(x => new { x.Id, x.Amount, x.Currency, x.Status, x.TransactionDate }).ToListAsync(ct);
        var ids = transactions.Select(x => x.Id).ToList();
        var splits = await _db.CommissionSplits.AsNoTracking().Where(x => ids.Contains(x.ParentTransactionId) && x.DeletedAt == null).Select(x => new { x.Id, x.ParentTransactionId, x.RecipientUserId, x.RecipientProducerId, x.Role, x.Percentage, x.Amount, x.Currency, x.IsClawback, x.SettledOn }).ToListAsync(ct);
        return Ok(new { transactions, splits });
    }
}
