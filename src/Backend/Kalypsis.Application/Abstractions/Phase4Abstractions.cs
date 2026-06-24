using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Abstractions;

// ============================================================================
// Phase 4 — Datawise parity abstractions.
// Stubs live in Kalypsis.Infrastructure; production swap-in replaces the
// binding in DependencyInjection.cs without touching the call sites.
// ============================================================================

/* ─────────────── Plate lookup / vehicle registry ─────────────── */

public record PlateLookupResult(
    bool Found,
    string? Plate,
    string? Make,
    string? Model,
    int? Year,
    int? CcEngine,
    int? Kw,
    string? VehicleType,                        // car / motorcycle / truck
    string? UsageType,
    string? FuelType,
    DateTime? FirstRegistration,
    string? ErrorMessage);

/// <summary>
/// Vehicle plate registry lookup. Real implementations call ΥΠΟΥΡΓΕΙΟ
/// ΥΠΟΔΟΜΩΝ / ΑΑΔΕ vehicle data services or commercial aggregators.
/// </summary>
public interface IPlateLookupService
{
    Task<PlateLookupResult> LookupAsync(string plate, CancellationToken ct = default);
}

/* ─────────────── Payment notice code generator ─────────────── */

/// <summary>
/// Generates the four Datawise code formats:
/// D-codes for pre-issuance customer notices,
/// F-codes for aggregated partner-to-broker bulk settlements,
/// R-codes for renewal pay-then-issue,
/// W-codes for new-business pay-then-issue.
/// Real implementations follow each bank's RF / ISO 11649 creditor reference
/// format so customers can pay at any Greek bank branch or e-banking.
/// </summary>
public interface IPaymentNoticeCodeGenerator
{
    string Generate(PaymentNoticeKind kind);
}

/* ─────────────── Online payment gateways ─────────────── */

public record CreatePaymentSessionRequest(
    decimal Amount,
    string Currency,
    string Description,
    string SuccessUrl,
    string CancelUrl,
    string? CustomerEmail,
    Guid? PaymentNoticeId,
    Guid? PolicyId,
    Guid? InstallmentId);

public record CreatePaymentSessionResult(
    bool Success,
    string? CheckoutUrl,
    string? ExternalSessionId,
    string? ErrorMessage);

/// <summary>
/// Pluggable online payment provider (e-pos / ePay / DIAS / Viva / Stripe).
/// Each provider implementation is registered keyed by
/// <see cref="OnlinePaymentGatewayType"/> so callers can pick which one to use
/// per session.
/// </summary>
public interface IOnlinePaymentGateway
{
    OnlinePaymentGatewayType Gateway { get; }
    Task<CreatePaymentSessionResult> CreateSessionAsync(CreatePaymentSessionRequest req, CancellationToken ct = default);
    Task HandleWebhookAsync(string rawPayload, IDictionary<string, string> headers, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

public interface IOnlinePaymentGatewayRegistry
{
    IOnlinePaymentGateway Resolve(OnlinePaymentGatewayType type);
    IReadOnlyList<IOnlinePaymentGateway> All { get; }
}

/* ─────────────── Viber business messaging ─────────────── */

public record ViberMessage(string ToPhone, string Body, string? ImageUrl = null);
public record ViberResult(bool Success, string? ProviderMessageId = null, string? ErrorMessage = null);

public interface IViberSender
{
    Task<ViberResult> SendAsync(ViberMessage message, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

/* ─────────────── Plafond / Κουμπαράς service ─────────────── */

public record PlafondCheckResult(bool Allowed, decimal AvailableCredit, string? Reason);

public interface IPlafondService
{
    Task<PlafondCheckResult> CheckAsync(Guid producerId, decimal amount, CancellationToken ct = default);
    Task DebitAsync(Guid producerId, decimal amount, string reference, Guid? paymentNoticeId, CancellationToken ct = default);
    Task CreditAsync(Guid producerId, decimal amount, string reference, CancellationToken ct = default);
    Task LockAsync(Guid producerId, string reason, CancellationToken ct = default);
    Task UnlockAsync(Guid producerId, CancellationToken ct = default);
}

/* ─────────────── Backoffice bridges (BlueByte / ALIS / OneSoft) ─────────────── */

public record BridgePushResult(bool Success, string? ExternalReference, string? ErrorMessage);

public interface IBackofficeBridgeAdapter
{
    BackofficeBridge Bridge { get; }
    Task<BridgePushResult> PushPolicyAsync(Guid policyId, CancellationToken ct = default);
    Task<BridgePushResult> PushReceiptAsync(Guid receiptId, CancellationToken ct = default);
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
}

public interface IBackofficeBridgeRegistry
{
    IBackofficeBridgeAdapter Resolve(BackofficeBridge bridge);
    IReadOnlyList<IBackofficeBridgeAdapter> All { get; }
}

/* ─────────────── Quote delivery (multi-quote email / PDF) ─────────────── */

public record DeliverQuoteRequest(
    Guid QuoteId,
    string[] Recipients,
    string? CustomSubject,
    string? CustomBody);

public interface IQuoteDelivery
{
    Task<byte[]> RenderPdfAsync(Guid quoteId, CancellationToken ct = default);
    Task EmailAsync(DeliverQuoteRequest req, CancellationToken ct = default);
}
