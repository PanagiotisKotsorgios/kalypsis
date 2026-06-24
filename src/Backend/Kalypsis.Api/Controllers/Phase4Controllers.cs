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

namespace Kalypsis.Api.Controllers.Phase4;

// ============================================================================
// Phase 4 — Datawise / WebInsurer parity controllers.
// Risk profiles, plate lookup, coverage options, pending items, payment
// notices (D/F/R/W), plafond/κουμπαράς, carrier orders, online payments,
// SMS/Viber sending, multi-quote email, backoffice bridges.
// ============================================================================

/* ─────────────── Risk profiles (Υπερτιμολόγηση) ─────────────── */

[ApiController]
[Route("api/risk-profiles")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class RiskProfilesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly IPlateLookupService _plateLookup;
    public RiskProfilesController(AppDbContext db, IDateTimeProvider clock, IPlateLookupService plateLookup)
    { _db = db; _clock = clock; _plateLookup = plateLookup; }

    public record ProfileDto(Guid Id, string ProductType, string Key, string Label, string InputsJson,
        Guid? CustomerId, DateTime? LastUsedAt, int TimesUsed);
    public record UpsertBody(string ProductType, string Key, string Label, string InputsJson, Guid? CustomerId);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProfileDto>>> List([FromQuery] string? productType, [FromQuery] string? search, CancellationToken ct)
    {
        var q = _db.RiskProfiles.Where(r => r.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(productType)) q = q.Where(r => r.ProductType == productType);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(r => r.Key.Contains(s) || r.Label.Contains(s));
        }
        return Ok(await q.OrderByDescending(r => r.LastUsedAt ?? r.CreatedAt)
            .Take(200)
            .Select(r => new ProfileDto(r.Id, r.ProductType, r.Key, r.Label, r.InputsJson, r.CustomerId, r.LastUsedAt, r.TimesUsed))
            .ToListAsync(ct));
    }

    [HttpGet("by-key")]
    public async Task<ActionResult<ProfileDto?>> ByKey([FromQuery] string productType, [FromQuery] string key, CancellationToken ct)
    {
        var r = await _db.RiskProfiles
            .Where(x => x.ProductType == productType && x.Key == key.ToUpper().Trim())
            .FirstOrDefaultAsync(ct);
        if (r is null) return NotFound();
        return Ok(new ProfileDto(r.Id, r.ProductType, r.Key, r.Label, r.InputsJson, r.CustomerId, r.LastUsedAt, r.TimesUsed));
    }

    [HttpPost]
    public async Task<ActionResult<ProfileDto>> Upsert([FromBody] UpsertBody body, CancellationToken ct)
    {
        try { _ = JsonDocument.Parse(body.InputsJson); }
        catch { return BadRequest(new { code = "invalid_json", message = "InputsJson is not valid JSON." }); }
        var normalisedKey = (body.Key ?? "").ToUpperInvariant().Trim();
        var existing = await _db.RiskProfiles
            .FirstOrDefaultAsync(r => r.ProductType == body.ProductType && r.Key == normalisedKey, ct);
        if (existing is null)
        {
            existing = new RiskProfile
            {
                Id = Guid.NewGuid(),
                ProductType = body.ProductType,
                Key = normalisedKey,
                Label = body.Label,
                InputsJson = body.InputsJson,
                CustomerId = body.CustomerId
            };
            _db.RiskProfiles.Add(existing);
        }
        else
        {
            existing.Label = body.Label;
            existing.InputsJson = body.InputsJson;
            existing.CustomerId = body.CustomerId;
        }
        existing.LastUsedAt = _clock.UtcNow;
        existing.TimesUsed += 1;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProfileDto(existing.Id, existing.ProductType, existing.Key, existing.Label,
            existing.InputsJson, existing.CustomerId, existing.LastUsedAt, existing.TimesUsed));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await _db.RiskProfiles.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();
        r.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("plate-lookup")]
    public async Task<ActionResult<PlateLookupResult>> Lookup([FromQuery] string plate, CancellationToken ct) =>
        Ok(await _plateLookup.LookupAsync(plate, ct));
}

/* ─────────────── Coverage options per carrier (roadside, legal, …) ─────────────── */

[ApiController]
[Route("api/carriers/coverage-options")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.FrontOffice)]
public class CoverageOptionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public CoverageOptionsController(AppDbContext db) => _db = db;

    public record OptionDto(Guid Id, Guid CarrierConnectionId, string Code, string Name, string? ProductType, CoverageTier? Tier, decimal AddonPremium, bool IsActive);
    public record UpsertBody(Guid CarrierConnectionId, string Code, string Name, string? ProductType, CoverageTier? Tier, decimal AddonPremium, bool IsActive);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OptionDto>>> List([FromQuery] Guid? carrierConnectionId, CancellationToken ct)
    {
        var q = _db.CoverageOptions.Where(o => o.DeletedAt == null);
        if (carrierConnectionId.HasValue) q = q.Where(o => o.CarrierConnectionId == carrierConnectionId.Value);
        return Ok(await q.OrderBy(o => o.CarrierConnectionId).ThenBy(o => o.Code)
            .Select(o => new OptionDto(o.Id, o.CarrierConnectionId, o.Code, o.Name, o.ProductType, o.Tier, o.AddonPremium, o.IsActive))
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<ActionResult<OptionDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
    {
        var o = new CoverageOption
        {
            Id = Guid.NewGuid(),
            CarrierConnectionId = body.CarrierConnectionId,
            Code = body.Code,
            Name = body.Name,
            ProductType = body.ProductType,
            Tier = body.Tier,
            AddonPremium = body.AddonPremium,
            IsActive = body.IsActive
        };
        _db.CoverageOptions.Add(o);
        await _db.SaveChangesAsync(ct);
        return Ok(new OptionDto(o.Id, o.CarrierConnectionId, o.Code, o.Name, o.ProductType, o.Tier, o.AddonPremium, o.IsActive));
    }
}

/* ─────────────── Pending items (Εκκρεμότητες) ─────────────── */

[ApiController]
[Route("api/applications/{applicationId:guid}/pending-items")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class PendingItemsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public PendingItemsController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record ItemDto(Guid Id, string Description, string? Category, DateTime CreatedAt, DateTime? ResolvedAt);
    public record CreateBody(string Description, string? Category);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ItemDto>>> List(Guid applicationId, CancellationToken ct) =>
        Ok(await _db.PendingItems
            .Where(p => p.PolicyApplicationId == applicationId && p.DeletedAt == null)
            .OrderBy(p => p.ResolvedAt).ThenBy(p => p.CreatedAt)
            .Select(p => new ItemDto(p.Id, p.Description, p.Category, p.CreatedAt, p.ResolvedAt))
            .ToListAsync(ct));

    [HttpPost]
    public async Task<ActionResult<ItemDto>> Create(Guid applicationId, [FromBody] CreateBody body, CancellationToken ct)
    {
        var p = new PendingItem
        {
            Id = Guid.NewGuid(),
            PolicyApplicationId = applicationId,
            Description = body.Description,
            Category = body.Category
        };
        _db.PendingItems.Add(p);
        await _db.SaveChangesAsync(ct);
        return Ok(new ItemDto(p.Id, p.Description, p.Category, p.CreatedAt, p.ResolvedAt));
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<ActionResult> Resolve(Guid applicationId, Guid id, CancellationToken ct)
    {
        var p = await _db.PendingItems.FirstOrDefaultAsync(x => x.Id == id && x.PolicyApplicationId == applicationId, ct);
        if (p is null) return NotFound();
        p.ResolvedAt = _clock.UtcNow;
        p.ResolvedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

/* ─────────────── Payment notices (D/F/R/W codes) ─────────────── */

[ApiController]
[Route("api/payment-notices")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class PaymentNoticesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly IPaymentNoticeCodeGenerator _codes;
    public PaymentNoticesController(AppDbContext db, IDateTimeProvider clock, IPaymentNoticeCodeGenerator codes)
    { _db = db; _clock = clock; _codes = codes; }

    public record NoticeDto(Guid Id, PaymentNoticeKind Kind, string Code, PaymentNoticeStatus Status,
        decimal Amount, string Currency, Guid? PolicyId, Guid? PolicyApplicationId, Guid? ProducerId,
        Guid? CustomerId, DateTime IssuedAt, DateTime? DueAt, DateTime? PaidAt);
    public record CreateBody(PaymentNoticeKind Kind, decimal Amount, string Currency,
        Guid? PolicyId, Guid? PolicyApplicationId, Guid? ProducerId, Guid? CustomerId,
        DateTime? DueAt, string? Notes, IReadOnlyList<LineBody>? Lines);
    public record LineBody(Guid? PolicyId, Guid? InstallmentId, Guid? PolicyApplicationId, decimal Amount, string? Description);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NoticeDto>>> List(
        [FromQuery] PaymentNoticeKind? kind,
        [FromQuery] PaymentNoticeStatus? status,
        [FromQuery] Guid? producerId,
        [FromQuery] Guid? customerId,
        CancellationToken ct)
    {
        var q = _db.PaymentNotices.Where(n => n.DeletedAt == null);
        if (kind.HasValue) q = q.Where(n => n.Kind == kind.Value);
        if (status.HasValue) q = q.Where(n => n.Status == status.Value);
        if (producerId.HasValue) q = q.Where(n => n.ProducerId == producerId.Value);
        if (customerId.HasValue) q = q.Where(n => n.CustomerId == customerId.Value);
        return Ok(await q.OrderByDescending(n => n.IssuedAt).Take(500)
            .Select(n => new NoticeDto(n.Id, n.Kind, n.Code, n.Status, n.Amount, n.Currency,
                n.PolicyId, n.PolicyApplicationId, n.ProducerId, n.CustomerId,
                n.IssuedAt, n.DueAt, n.PaidAt))
            .ToListAsync(ct));
    }

    [HttpGet("by-code/{code}")]
    public async Task<ActionResult<NoticeDto?>> ByCode(string code, CancellationToken ct)
    {
        var n = await _db.PaymentNotices.FirstOrDefaultAsync(x => x.Code == code, ct);
        if (n is null) return NotFound();
        return Ok(new NoticeDto(n.Id, n.Kind, n.Code, n.Status, n.Amount, n.Currency,
            n.PolicyId, n.PolicyApplicationId, n.ProducerId, n.CustomerId, n.IssuedAt, n.DueAt, n.PaidAt));
    }

    [HttpPost]
    public async Task<ActionResult<NoticeDto>> Create([FromBody] CreateBody body, CancellationToken ct)
    {
        var notice = new PaymentNotice
        {
            Id = Guid.NewGuid(),
            Kind = body.Kind,
            Code = _codes.Generate(body.Kind),
            Status = PaymentNoticeStatus.Open,
            Amount = body.Amount,
            Currency = body.Currency,
            PolicyId = body.PolicyId,
            PolicyApplicationId = body.PolicyApplicationId,
            ProducerId = body.ProducerId,
            CustomerId = body.CustomerId,
            IssuedAt = _clock.UtcNow,
            DueAt = body.DueAt,
            Notes = body.Notes
        };
        foreach (var l in body.Lines ?? Array.Empty<LineBody>())
        {
            notice.Lines.Add(new PaymentNoticeLine
            {
                Id = Guid.NewGuid(),
                PaymentNoticeId = notice.Id,
                PolicyId = l.PolicyId,
                InstallmentId = l.InstallmentId,
                PolicyApplicationId = l.PolicyApplicationId,
                Amount = l.Amount,
                Description = l.Description
            });
        }
        _db.PaymentNotices.Add(notice);
        await _db.SaveChangesAsync(ct);
        return Ok(new NoticeDto(notice.Id, notice.Kind, notice.Code, notice.Status, notice.Amount, notice.Currency,
            notice.PolicyId, notice.PolicyApplicationId, notice.ProducerId, notice.CustomerId,
            notice.IssuedAt, notice.DueAt, notice.PaidAt));
    }

    [HttpPost("{id:guid}/mark-paid")]
    public async Task<ActionResult> MarkPaid(Guid id, [FromQuery] string? reference, CancellationToken ct)
    {
        var n = await _db.PaymentNotices.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (n is null) return NotFound();
        n.Status = PaymentNoticeStatus.Paid;
        n.PaidAt = _clock.UtcNow;
        n.PaymentReference = reference;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Print-Pay basket: take a set of installment ids, aggregate them into a
    /// single F-code notice for the producer, and lock those installments to it.
    /// </summary>
    public record BasketBody(Guid ProducerId, IReadOnlyList<Guid> InstallmentIds);

    [HttpPost("basket/print-pay")]
    public async Task<ActionResult<NoticeDto>> Basket([FromBody] BasketBody body, CancellationToken ct)
    {
        var installments = await _db.Installments
            .Where(i => body.InstallmentIds.Contains(i.Id))
            .ToListAsync(ct);
        if (installments.Count == 0) return BadRequest(new { code = "no_installments" });

        var total = installments.Sum(i => i.Amount - i.PaidAmount);
        var notice = new PaymentNotice
        {
            Id = Guid.NewGuid(),
            Kind = PaymentNoticeKind.F,
            Code = _codes.Generate(PaymentNoticeKind.F),
            Status = PaymentNoticeStatus.Open,
            Amount = total,
            Currency = "EUR",
            ProducerId = body.ProducerId,
            IssuedAt = _clock.UtcNow,
            DueAt = _clock.UtcNow.AddDays(7)
        };
        foreach (var inst in installments)
        {
            notice.Lines.Add(new PaymentNoticeLine
            {
                Id = Guid.NewGuid(),
                PaymentNoticeId = notice.Id,
                PolicyId = inst.PolicyId,
                InstallmentId = inst.Id,
                Amount = inst.Amount - inst.PaidAmount,
                Description = $"Installment #{inst.SequenceNumber}"
            });
        }
        _db.PaymentNotices.Add(notice);
        await _db.SaveChangesAsync(ct);
        return Ok(new NoticeDto(notice.Id, notice.Kind, notice.Code, notice.Status, notice.Amount, notice.Currency,
            null, null, notice.ProducerId, null, notice.IssuedAt, notice.DueAt, null));
    }
}

/* ─────────────── Plafond (Πλαφόν / Κουμπαράς) ─────────────── */

[ApiController]
[Route("api/plafond")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.FrontOffice)]
public class PlafondController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPlafondService _svc;
    public PlafondController(AppDbContext db, IPlafondService svc) { _db = db; _svc = svc; }

    public record PlafondDto(Guid Id, Guid ProducerId, PlafondRegime Regime, decimal CreditLimit, decimal CurrentBalance,
        int GraceDays, bool IsLocked, DateTime? LockedAt, string? LockReason);
    public record SetBody(Guid ProducerId, PlafondRegime Regime, decimal CreditLimit, int GraceDays);
    public record TopupBody(Guid ProducerId, decimal Amount, string Reference);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlafondDto>>> List(CancellationToken ct) =>
        Ok(await _db.ProducerPlafonds.OrderByDescending(p => p.CurrentBalance < 0).ThenBy(p => p.Producer!.Name)
            .Select(p => new PlafondDto(p.Id, p.ProducerId, p.Regime, p.CreditLimit, p.CurrentBalance,
                p.GraceDays, p.IsLocked, p.LockedAt, p.LockReason))
            .ToListAsync(ct));

    [HttpPost("configure")]
    public async Task<ActionResult<PlafondDto>> Configure([FromBody] SetBody body, CancellationToken ct)
    {
        var producer = await _db.Producers.FirstOrDefaultAsync(p => p.Id == body.ProducerId, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
        var p = await _db.ProducerPlafonds.FirstOrDefaultAsync(x => x.ProducerId == body.ProducerId, ct);
        if (p is null)
        {
            p = new ProducerPlafond
            {
                Id = Guid.NewGuid(),
                TenantId = producer.TenantId,
                ProducerId = body.ProducerId,
                CurrentBalance = 0m
            };
            _db.ProducerPlafonds.Add(p);
        }
        p.Regime = body.Regime;
        p.CreditLimit = body.CreditLimit;
        p.GraceDays = body.GraceDays;
        await _db.SaveChangesAsync(ct);
        return Ok(new PlafondDto(p.Id, p.ProducerId, p.Regime, p.CreditLimit, p.CurrentBalance, p.GraceDays,
            p.IsLocked, p.LockedAt, p.LockReason));
    }

    [HttpPost("topup")]
    public async Task<ActionResult> Topup([FromBody] TopupBody body, CancellationToken ct)
    {
        await _svc.CreditAsync(body.ProducerId, body.Amount, body.Reference, ct);
        return NoContent();
    }

    [HttpPost("{producerId:guid}/lock")]
    public async Task<ActionResult> Lock(Guid producerId, [FromQuery] string reason, CancellationToken ct)
    {
        await _svc.LockAsync(producerId, reason ?? "Manual lock", ct);
        return NoContent();
    }

    [HttpPost("{producerId:guid}/unlock")]
    public async Task<ActionResult> Unlock(Guid producerId, CancellationToken ct)
    {
        await _svc.UnlockAsync(producerId, ct);
        return NoContent();
    }

    [HttpGet("{producerId:guid}/koumparas")]
    public async Task<ActionResult> KoumparasLedger(Guid producerId, CancellationToken ct) =>
        Ok(await _db.KoumparasLines.Where(k => k.ProducerId == producerId)
            .OrderByDescending(k => k.OccurredAt).Take(500).ToListAsync(ct));
}

/* ─────────────── Carrier orders (Παραγγελία) ─────────────── */

[ApiController]
[Route("api/carrier-orders")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class CarrierOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public CarrierOrdersController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record OrderDto(Guid Id, Guid ProducerId, string CarrierCode, string OperationType,
        Guid? PolicyId, Guid? PolicyApplicationId, string InstructionsText, CarrierOrderStatus Status,
        DateTime SubmittedAt, DateTime? CompletedAt, string? ResultFileKey, decimal? ChargedAmount);
    public record SubmitBody(Guid ProducerId, string CarrierCode, string OperationType,
        Guid? PolicyId, Guid? PolicyApplicationId, string InstructionsText);
    public record CompleteBody(string? ResultFileKey, string? ResultNotes, decimal? ChargedAmount);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> List([FromQuery] CarrierOrderStatus? status, CancellationToken ct)
    {
        var q = _db.CarrierOrders.Where(o => o.DeletedAt == null);
        if (status.HasValue) q = q.Where(o => o.Status == status.Value);
        return Ok(await q.OrderByDescending(o => o.SubmittedAt).Take(500)
            .Select(o => new OrderDto(o.Id, o.ProducerId, o.CarrierCode, o.OperationType,
                o.PolicyId, o.PolicyApplicationId, o.InstructionsText, o.Status, o.SubmittedAt,
                o.CompletedAt, o.ResultFileKey, o.ChargedAmount))
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<ActionResult<OrderDto>> Submit([FromBody] SubmitBody body, CancellationToken ct)
    {
        var o = new CarrierOrder
        {
            Id = Guid.NewGuid(),
            ProducerId = body.ProducerId,
            CarrierCode = body.CarrierCode,
            OperationType = body.OperationType,
            PolicyId = body.PolicyId,
            PolicyApplicationId = body.PolicyApplicationId,
            InstructionsText = body.InstructionsText,
            Status = CarrierOrderStatus.Submitted,
            SubmittedAt = _clock.UtcNow
        };
        _db.CarrierOrders.Add(o);
        await _db.SaveChangesAsync(ct);
        return Ok(new OrderDto(o.Id, o.ProducerId, o.CarrierCode, o.OperationType, o.PolicyId, o.PolicyApplicationId,
            o.InstructionsText, o.Status, o.SubmittedAt, o.CompletedAt, o.ResultFileKey, o.ChargedAmount));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult> Complete(Guid id, [FromBody] CompleteBody body, CancellationToken ct)
    {
        var o = await _db.CarrierOrders.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();
        o.Status = CarrierOrderStatus.Completed;
        o.CompletedAt = _clock.UtcNow;
        o.CompletedByUserId = _current.UserId;
        o.ResultFileKey = body.ResultFileKey;
        o.ResultNotes = body.ResultNotes;
        o.ChargedAmount = body.ChargedAmount;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

/* ─────────────── Online payments (e-pos / ePay / DIAS / Viva / Stripe) ─────────────── */

[ApiController]
[Route("api/online-payments")]
[RequiresPackage(PackageCode.Integrations)]
public class OnlinePaymentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IOnlinePaymentGatewayRegistry _gateways;
    private readonly IDateTimeProvider _clock;
    public OnlinePaymentsController(AppDbContext db, IOnlinePaymentGatewayRegistry gateways, IDateTimeProvider clock)
    { _db = db; _gateways = gateways; _clock = clock; }

    public record GatewayDto(OnlinePaymentGatewayType Gateway, bool Configured);
    public record CreateBody(OnlinePaymentGatewayType Gateway, decimal Amount, string Currency, string Description,
        string SuccessUrl, string CancelUrl, string? CustomerEmail,
        Guid? PaymentNoticeId, Guid? PolicyId, Guid? InstallmentId, Guid? CustomerId);

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("gateways")]
    public async Task<ActionResult<IReadOnlyList<GatewayDto>>> Gateways(CancellationToken ct)
    {
        var result = new List<GatewayDto>();
        foreach (var g in _gateways.All)
            result.Add(new GatewayDto(g.Gateway, await g.IsConfiguredAsync(ct)));
        return Ok(result);
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpPost("sessions")]
    public async Task<ActionResult> Create([FromBody] CreateBody body, CancellationToken ct)
    {
        var gateway = _gateways.Resolve(body.Gateway);
        var result = await gateway.CreateSessionAsync(new CreatePaymentSessionRequest(
            body.Amount, body.Currency, body.Description, body.SuccessUrl, body.CancelUrl,
            body.CustomerEmail, body.PaymentNoticeId, body.PolicyId, body.InstallmentId), ct);
        if (!result.Success) return BadRequest(new { code = "gateway_failure", message = result.ErrorMessage });

        var session = new OnlinePaymentSession
        {
            Id = Guid.NewGuid(),
            Gateway = body.Gateway,
            Status = OnlinePaymentSessionStatus.Created,
            Amount = body.Amount,
            Currency = body.Currency,
            ExternalSessionId = result.ExternalSessionId,
            CheckoutUrl = result.CheckoutUrl,
            PaymentNoticeId = body.PaymentNoticeId,
            PolicyId = body.PolicyId,
            InstallmentId = body.InstallmentId,
            CustomerId = body.CustomerId,
            CreatedExternallyAt = _clock.UtcNow
        };
        _db.OnlinePaymentSessions.Add(session);
        await _db.SaveChangesAsync(ct);
        return Ok(new { sessionId = session.Id, checkoutUrl = result.CheckoutUrl });
    }

    [AllowAnonymous]
    [HttpPost("webhook/{gateway}")]
    public async Task<ActionResult> Webhook(OnlinePaymentGatewayType gateway, CancellationToken ct)
    {
        using var sr = new StreamReader(Request.Body);
        var raw = await sr.ReadToEndAsync(ct);
        var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
        await _gateways.Resolve(gateway).HandleWebhookAsync(raw, headers, ct);
        return Ok();
    }
}

/* ─────────────── SMS / Viber sending ─────────────── */

[ApiController]
[Route("api/messaging")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public class MessagingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISmsSender _sms;
    private readonly IViberSender _viber;
    private readonly IDateTimeProvider _clock;
    public MessagingController(AppDbContext db, ISmsSender sms, IViberSender viber, IDateTimeProvider clock)
    { _db = db; _sms = sms; _viber = viber; _clock = clock; }

    public record SendSmsBody(string ToPhone, string Body, Guid? CustomerId, Guid? PolicyId);
    public record SendViberBody(string ToPhone, string Body, string? ImageUrl, Guid? CustomerId, Guid? PolicyId);

    [HttpPost("sms")]
    public async Task<ActionResult> SendSms([FromBody] SendSmsBody body, CancellationToken ct)
    {
        var result = await _sms.SendAsync(new SmsMessage(body.ToPhone, body.Body), ct);
        var log = new SmsLog
        {
            Id = Guid.NewGuid(),
            Provider = "stub",
            ToNumber = body.ToPhone,
            Body = body.Body,
            Status = result.Success ? "Sent" : "Failed",
            FailureReason = result.ErrorMessage,
            CustomerId = body.CustomerId,
            PolicyId = body.PolicyId,
            QueuedAt = _clock.UtcNow,
            DeliveredAt = result.Success ? _clock.UtcNow : null
        };
        _db.SmsLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return Ok(new { success = result.Success, logId = log.Id });
    }

    [HttpPost("viber")]
    public async Task<ActionResult> SendViber([FromBody] SendViberBody body, CancellationToken ct)
    {
        var result = await _viber.SendAsync(new ViberMessage(body.ToPhone, body.Body, body.ImageUrl), ct);
        var log = new ViberLog
        {
            Id = Guid.NewGuid(),
            Provider = "stub",
            ToNumber = body.ToPhone,
            Body = body.Body,
            ProviderMessageId = result.ProviderMessageId,
            Status = result.Success ? "Sent" : "Failed",
            FailureReason = result.ErrorMessage,
            CustomerId = body.CustomerId,
            PolicyId = body.PolicyId,
            QueuedAt = _clock.UtcNow,
            DeliveredAt = result.Success ? _clock.UtcNow : null
        };
        _db.ViberLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return Ok(new { success = result.Success, logId = log.Id });
    }

    [HttpGet("sms")]
    public async Task<ActionResult> SmsLogs(CancellationToken ct) =>
        Ok(await _db.SmsLogs.OrderByDescending(l => l.QueuedAt).Take(200).ToListAsync(ct));

    [HttpGet("viber")]
    public async Task<ActionResult> ViberLogs(CancellationToken ct) =>
        Ok(await _db.ViberLogs.OrderByDescending(l => l.QueuedAt).Take(200).ToListAsync(ct));
}

/* ─────────────── Multi-quote email + PDF ─────────────── */

[ApiController]
[Route("api/quotes")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class QuoteDeliveryController : ControllerBase
{
    private readonly IQuoteDelivery _delivery;
    public QuoteDeliveryController(IQuoteDelivery delivery) => _delivery = delivery;

    public record EmailBody(string[] Recipients, string? Subject, string? Body);

    [HttpPost("{id:guid}/email")]
    public async Task<ActionResult> Email(Guid id, [FromBody] EmailBody body, CancellationToken ct)
    {
        await _delivery.EmailAsync(new DeliverQuoteRequest(id, body.Recipients ?? Array.Empty<string>(),
            body.Subject, body.Body), ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<ActionResult> Pdf(Guid id, CancellationToken ct)
    {
        var bytes = await _delivery.RenderPdfAsync(id, ct);
        return File(bytes, "application/octet-stream", $"quote-{id}.csv");
    }
}

/* ─────────────── Backoffice bridges (BlueByte / ALIS / OneSoft) ─────────────── */

[ApiController]
[Route("api/backoffice-bridges")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class BackofficeBridgesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBackofficeBridgeRegistry _registry;
    public BackofficeBridgesController(AppDbContext db, IBackofficeBridgeRegistry registry)
    { _db = db; _registry = registry; }

    public record BridgeDto(BackofficeBridge Bridge, bool Configured);
    public record PushBody(BackofficeBridge Bridge, Guid Id);

    [HttpGet("registered")]
    public async Task<ActionResult<IReadOnlyList<BridgeDto>>> Registered(CancellationToken ct)
    {
        var result = new List<BridgeDto>();
        foreach (var b in _registry.All)
            result.Add(new BridgeDto(b.Bridge, await b.IsConfiguredAsync(ct)));
        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct) =>
        Ok(await _db.BackofficeBridgeConnections.OrderBy(b => b.Bridge).ToListAsync(ct));

    [HttpPost("push-policy")]
    public async Task<ActionResult> PushPolicy([FromBody] PushBody body, CancellationToken ct) =>
        Ok(await _registry.Resolve(body.Bridge).PushPolicyAsync(body.Id, ct));

    [HttpPost("push-receipt")]
    public async Task<ActionResult> PushReceipt([FromBody] PushBody body, CancellationToken ct) =>
        Ok(await _registry.Resolve(body.Bridge).PushReceiptAsync(body.Id, ct));
}
