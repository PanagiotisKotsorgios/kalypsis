using System.Globalization;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Integrations;

// ============================================================================
// Phase 4 stub implementations. Drop-in real providers replace the binding in
// DependencyInjection.cs without touching call sites.
// ============================================================================

/* ─────────────── Plate lookup ─────────────── */

public sealed class StubPlateLookupService : IPlateLookupService
{
    public Task<PlateLookupResult> LookupAsync(string plate, CancellationToken ct = default)
    {
        plate = (plate ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(plate))
            return Task.FromResult(new PlateLookupResult(false, plate, null, null, null, null, null, null, null, null, null, "empty plate"));

        // Deterministic fake data so dev UIs are stable.
        var seed = plate.Aggregate(0, (acc, c) => acc * 31 + c);
        var rng = new Random(seed);
        var makes = new[] { "Toyota", "VW", "Skoda", "Hyundai", "Citroen", "Peugeot", "Ford", "Nissan", "Kia", "Opel" };
        var models = new[] { "Corolla", "Polo", "Octavia", "i30", "C3", "208", "Focus", "Qashqai", "Ceed", "Astra" };
        return Task.FromResult(new PlateLookupResult(
            Found: true,
            Plate: plate,
            Make: makes[rng.Next(makes.Length)],
            Model: models[rng.Next(models.Length)],
            Year: 2010 + rng.Next(15),
            CcEngine: 1200 + rng.Next(800),
            Kw: 50 + rng.Next(70),
            VehicleType: "PassengerCar",
            UsageType: "Private",
            FuelType: rng.Next(2) == 0 ? "Petrol" : "Diesel",
            FirstRegistration: DateTime.UtcNow.AddYears(-rng.Next(15)).Date,
            ErrorMessage: null));
    }
}

/* ─────────────── Payment notice code generator ─────────────── */

/// <summary>
/// Generates Greek payment-notice codes. Datawise uses:
///   D + 12 digits (pre-issuance customer notice)
///   F + 9  digits (aggregated F-code basket)
///   R + 14 digits (renewal pay-then-issue)
///   W + 12 digits (new-business pay-then-issue)
/// Real implementations layer in the ISO 11649 RF creditor reference checksum
/// so the same code is bankable at any Greek bank.
/// </summary>
public sealed class StubPaymentNoticeCodeGenerator : IPaymentNoticeCodeGenerator
{
    public string Generate(PaymentNoticeKind kind)
    {
        var len = kind switch
        {
            PaymentNoticeKind.D => 12,
            PaymentNoticeKind.F => 9,
            PaymentNoticeKind.R => 14,
            PaymentNoticeKind.W => 12,
            _ => 12
        };
        var rng = Random.Shared;
        var digits = new char[len];
        for (var i = 0; i < len; i++) digits[i] = (char)('0' + rng.Next(10));
        return $"{kind}{new string(digits)}";
    }
}

/* ─────────────── Online payment gateways ─────────────── */

public abstract class StubOnlinePaymentGatewayBase : IOnlinePaymentGateway
{
    public abstract OnlinePaymentGatewayType Gateway { get; }
    protected abstract string ProviderHost { get; }

    public Task<CreatePaymentSessionResult> CreateSessionAsync(CreatePaymentSessionRequest req, CancellationToken ct = default)
    {
        var id = Guid.NewGuid().ToString("N");
        var url = $"https://{ProviderHost}.example.invalid/checkout/{id}" +
                  $"?amount={req.Amount.ToString(CultureInfo.InvariantCulture)}" +
                  $"&currency={req.Currency}&desc={Uri.EscapeDataString(req.Description)}";
        return Task.FromResult(new CreatePaymentSessionResult(true, url, id, null));
    }

    public Task HandleWebhookAsync(string rawPayload, IDictionary<string, string> headers, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}

public sealed class StubEposPiraeus : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.EposPiraeus; protected override string ProviderHost => "epos-piraeus"; }
public sealed class StubEposNbg : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.EposNbg; protected override string ProviderHost => "epos-nbg"; }
public sealed class StubEposAlpha : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.EposAlpha; protected override string ProviderHost => "epos-alpha"; }
public sealed class StubEposEurobank : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.EposEurobank; protected override string ProviderHost => "epos-eurobank"; }
public sealed class StubEpay : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.Epay; protected override string ProviderHost => "epay"; }
public sealed class StubDias : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.Dias; protected override string ProviderHost => "dias"; }
public sealed class StubVivaWallet : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.VivaWallet; protected override string ProviderHost => "viva-wallet"; }
public sealed class StubStripeCard : StubOnlinePaymentGatewayBase
{ public override OnlinePaymentGatewayType Gateway => OnlinePaymentGatewayType.StripeCard; protected override string ProviderHost => "stripe-card"; }

public sealed class OnlinePaymentGatewayRegistry : IOnlinePaymentGatewayRegistry
{
    private readonly Dictionary<OnlinePaymentGatewayType, IOnlinePaymentGateway> _byType;
    public OnlinePaymentGatewayRegistry(IEnumerable<IOnlinePaymentGateway> all)
    {
        _byType = all.ToDictionary(a => a.Gateway);
        All = all.ToList();
    }
    public IOnlinePaymentGateway Resolve(OnlinePaymentGatewayType type) =>
        _byType.TryGetValue(type, out var a) ? a : throw new InvalidOperationException($"Gateway {type} not registered.");
    public IReadOnlyList<IOnlinePaymentGateway> All { get; }
}

/* ─────────────── Viber ─────────────── */

public sealed class StubViberSender : IViberSender
{
    private readonly ILogger<StubViberSender> _log;
    public StubViberSender(ILogger<StubViberSender> log) => _log = log;
    public Task<ViberResult> SendAsync(ViberMessage message, CancellationToken ct = default)
    {
        _log.LogInformation("[STUB Viber] {To}: {Body}", message.ToPhone, message.Body);
        return Task.FromResult(new ViberResult(true, $"VB-{Guid.NewGuid():N}", null));
    }
    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}

/* ─────────────── Plafond service ─────────────── */

public sealed class PlafondService : IPlafondService
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    public PlafondService(AppDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    private async Task<ProducerPlafond> EnsureAsync(Guid producerId, CancellationToken ct)
    {
        var p = await _db.ProducerPlafonds.FirstOrDefaultAsync(x => x.ProducerId == producerId, ct);
        if (p is null)
        {
            var producer = await _db.Producers.FirstOrDefaultAsync(x => x.Id == producerId, ct)
                ?? throw AppException.NotFound("Συνεργάτης");
            p = new ProducerPlafond
            {
                Id = Guid.NewGuid(),
                TenantId = producer.TenantId,
                ProducerId = producerId,
                Regime = PlafondRegime.TypoPlirono,
                CreditLimit = 0m,
                CurrentBalance = 0m,
                GraceDays = 15
            };
            _db.ProducerPlafonds.Add(p);
            await _db.SaveChangesAsync(ct);
        }
        return p;
    }

    public async Task<PlafondCheckResult> CheckAsync(Guid producerId, decimal amount, CancellationToken ct = default)
    {
        var p = await EnsureAsync(producerId, ct);
        if (p.IsLocked) return new PlafondCheckResult(false, 0m, p.LockReason ?? "Locked");
        var available = p.CreditLimit + p.CurrentBalance;     // negative balance = partner owes
        if (available - amount < 0)
            return new PlafondCheckResult(false, available, "Insufficient plafond.");
        return new PlafondCheckResult(true, available, null);
    }

    public async Task DebitAsync(Guid producerId, decimal amount, string reference, Guid? paymentNoticeId, CancellationToken ct = default)
    {
        var p = await EnsureAsync(producerId, ct);
        p.CurrentBalance -= amount;
        if (p.Regime == PlafondRegime.Koumparas)
        {
            _db.KoumparasLines.Add(new KoumparasLine
            {
                Id = Guid.NewGuid(),
                TenantId = p.TenantId,
                ProducerId = producerId,
                OccurredAt = _clock.UtcNow,
                Amount = -amount,
                Reference = reference,
                PaymentNoticeId = paymentNoticeId
            });
        }
        // Auto-lock if the partner blew past credit limit
        if (p.CreditLimit + p.CurrentBalance < 0)
        {
            p.IsLocked = true;
            p.LockedAt = _clock.UtcNow;
            p.LockReason = "Auto-lock: over credit limit";
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task CreditAsync(Guid producerId, decimal amount, string reference, CancellationToken ct = default)
    {
        var p = await EnsureAsync(producerId, ct);
        p.CurrentBalance += amount;
        if (p.Regime == PlafondRegime.Koumparas)
        {
            _db.KoumparasLines.Add(new KoumparasLine
            {
                Id = Guid.NewGuid(),
                TenantId = p.TenantId,
                ProducerId = producerId,
                OccurredAt = _clock.UtcNow,
                Amount = amount,
                Reference = reference
            });
        }
        // Auto-unlock if balance recovered
        if (p.IsLocked && p.CreditLimit + p.CurrentBalance >= 0)
        {
            p.IsLocked = false;
            p.LockReason = null;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task LockAsync(Guid producerId, string reason, CancellationToken ct = default)
    {
        var p = await EnsureAsync(producerId, ct);
        p.IsLocked = true;
        p.LockedAt = _clock.UtcNow;
        p.LockReason = reason;
        await _db.SaveChangesAsync(ct);
    }
    public async Task UnlockAsync(Guid producerId, CancellationToken ct = default)
    {
        var p = await EnsureAsync(producerId, ct);
        p.IsLocked = false;
        p.LockReason = null;
        await _db.SaveChangesAsync(ct);
    }
}

/* ─────────────── Backoffice bridges (BlueByte / ALIS / OneSoft) ─────────────── */

public abstract class StubBackofficeBridgeBase : IBackofficeBridgeAdapter
{
    public abstract BackofficeBridge Bridge { get; }
    protected readonly ILogger<StubBackofficeBridgeBase> Log;
    protected StubBackofficeBridgeBase(ILogger<StubBackofficeBridgeBase> log) => Log = log;

    public Task<BridgePushResult> PushPolicyAsync(Guid policyId, CancellationToken ct = default)
    {
        Log.LogInformation("[STUB {Bridge}] push policy {PolicyId}", Bridge, policyId);
        return Task.FromResult(new BridgePushResult(true, $"{Bridge}-POL-{policyId.ToString("N")[..10]}", null));
    }
    public Task<BridgePushResult> PushReceiptAsync(Guid receiptId, CancellationToken ct = default)
    {
        Log.LogInformation("[STUB {Bridge}] push receipt {ReceiptId}", Bridge, receiptId);
        return Task.FromResult(new BridgePushResult(true, $"{Bridge}-REC-{receiptId.ToString("N")[..10]}", null));
    }
    public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(false);
}
public sealed class StubBlueByteBridge : StubBackofficeBridgeBase
{ public StubBlueByteBridge(ILogger<StubBackofficeBridgeBase> log) : base(log) { } public override BackofficeBridge Bridge => BackofficeBridge.BlueByte; }
public sealed class StubAlisBridge : StubBackofficeBridgeBase
{ public StubAlisBridge(ILogger<StubBackofficeBridgeBase> log) : base(log) { } public override BackofficeBridge Bridge => BackofficeBridge.Alis; }
public sealed class StubOneSoftBridge : StubBackofficeBridgeBase
{ public StubOneSoftBridge(ILogger<StubBackofficeBridgeBase> log) : base(log) { } public override BackofficeBridge Bridge => BackofficeBridge.OneSoft; }

public sealed class BackofficeBridgeRegistry : IBackofficeBridgeRegistry
{
    private readonly Dictionary<BackofficeBridge, IBackofficeBridgeAdapter> _by;
    public BackofficeBridgeRegistry(IEnumerable<IBackofficeBridgeAdapter> all)
    {
        _by = all.ToDictionary(a => a.Bridge);
        All = all.ToList();
    }
    public IBackofficeBridgeAdapter Resolve(BackofficeBridge bridge) =>
        _by.TryGetValue(bridge, out var a) ? a : throw new InvalidOperationException($"Bridge {bridge} not registered.");
    public IReadOnlyList<IBackofficeBridgeAdapter> All { get; }
}

/* ─────────────── Quote delivery (PDF + email) ─────────────── */

public sealed class QuoteDelivery : IQuoteDelivery
{
    private readonly AppDbContext _db;
    private readonly IEmailSender _email;
    public QuoteDelivery(AppDbContext db, IEmailSender email) { _db = db; _email = email; }

    public async Task<byte[]> RenderPdfAsync(Guid quoteId, CancellationToken ct = default)
    {
        // Datawise multi-quote PDF — for now we emit a CSV-shaped byte payload
        // that any production printer can replace with a real PDF. The structure
        // (offers ordered by premium) is already correct.
        var quote = await _db.Quotes.FirstOrDefaultAsync(x => x.Id == quoteId, ct)
            ?? throw AppException.NotFound("Quote");
        var offers = await _db.QuoteOffers.Where(o => o.QuoteId == quoteId).OrderBy(o => o.Premium).ToListAsync(ct);

        using var ms = new MemoryStream();
        using var sw = new StreamWriter(ms);
        sw.WriteLine($"Kalypsis Multi-Quote — {quote.QuoteNumber}");
        sw.WriteLine($"Product: {quote.ProductType}");
        sw.WriteLine();
        sw.WriteLine("Carrier,Premium,Commission,ProductCode,ValidUntil");
        foreach (var o in offers)
            sw.WriteLine($"{o.CarrierCode},{o.Premium},{o.Commission},{o.CarrierProductCode},{o.ValidUntil:O}");
        sw.Flush();
        return ms.ToArray();
    }

    public async Task EmailAsync(DeliverQuoteRequest req, CancellationToken ct = default)
    {
        var pdf = await RenderPdfAsync(req.QuoteId, ct);
        var subject = req.CustomSubject ?? "Η ασφαλιστική σας προσφορά από Kalypsis";
        var body = req.CustomBody ?? "Παρακαλώ δείτε συνημμένη την προσφορά μας. Με εκτίμηση, η ομάδα σας.";
        foreach (var to in req.Recipients)
        {
            await _email.SendAsync(new EmailMessage(to, to, subject, body, body), ct);
        }
        _ = pdf; // attachment hand-off: real impl wires this through EmailSender's attachments overload.
    }
}
