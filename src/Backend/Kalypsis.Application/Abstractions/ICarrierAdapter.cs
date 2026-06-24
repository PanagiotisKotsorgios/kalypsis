namespace Kalypsis.Application.Abstractions;

/// <summary>
/// One-of-N carrier adapter. Each Greek carrier (Interamerican, Ethniki, Eurolife,
/// ERGO, Allianz, NN, Generali, Interlife, …) implements this against their own
/// REST/SOAP/portal contract. The rest of the system only sees this normalised
/// surface — quotes / applications / policies stay carrier-agnostic.
///
/// Production adapters live in <c>Kalypsis.Carriers.{CarrierCode}</c> projects.
/// Until partnership credentials exist, every code is served by <c>StubCarrierAdapter</c>
/// which returns plausible dev data — every endpoint round-trips without errors.
/// </summary>
public interface ICarrierAdapter
{
    /// <summary>Stable upper-snake-case identifier — must match the seeded InsuranceCompany.Code.</summary>
    string CarrierCode { get; }
    string DisplayName { get; }
    IReadOnlyList<string> SupportedProductTypes { get; }

    Task<CarrierQuoteResult> GetQuoteAsync(CarrierQuoteRequest request, CancellationToken ct = default);

    /// <summary>Bind a quote: send the formal application + receive policy number.</summary>
    Task<CarrierIssuanceResult> IssuePolicyAsync(CarrierIssuanceRequest request, CancellationToken ct = default);

    /// <summary>Roll an existing policy forward into a new period.</summary>
    Task<CarrierIssuanceResult> RenewPolicyAsync(CarrierRenewalRequest request, CancellationToken ct = default);

    /// <summary>Cancel a policy mid-term (pro-rata or short-rate as carrier requires).</summary>
    Task<CarrierCancellationResult> CancelPolicyAsync(CarrierCancellationRequest request, CancellationToken ct = default);

    /// <summary>Fetch the carrier-generated documents (certificate, terms, schedule).</summary>
    Task<IReadOnlyList<CarrierDocument>> FetchDocumentsAsync(string carrierPolicyNumber, CancellationToken ct = default);
}

public record CarrierQuoteRequest(
    string ProductType,
    string RiskInputsJson,
    string? AgentCode = null);

public record CarrierQuoteResult(
    bool Success,
    decimal? Premium,
    string Currency,
    decimal? Commission,
    string? CarrierProductCode,
    string? CoverageSummary,
    DateTime? ValidUntil,
    string? RawResponseRedacted,
    string? ErrorMessage);

public record CarrierIssuanceRequest(
    string ProductType,
    string CarrierProductCode,
    string CustomerName,
    string? CustomerVat,
    string RiskInputsJson,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal AcceptedPremium,
    string? AgentCode = null);

public record CarrierIssuanceResult(
    bool Success,
    string? CarrierPolicyNumber,
    string? CarrierApplicationId,
    string? RawResponseRedacted,
    string? ErrorMessage);

public record CarrierRenewalRequest(string CarrierPolicyNumber, DateOnly NewStartDate, DateOnly NewEndDate);

public record CarrierCancellationRequest(string CarrierPolicyNumber, DateOnly CancellationDate, string? Reason);
public record CarrierCancellationResult(bool Success, decimal? Refund, string? ErrorMessage);

public record CarrierDocument(string FileName, string MimeType, byte[] Bytes, string? CategoryHint);

/// <summary>
/// DI lookup: every registered adapter is keyed by <see cref="ICarrierAdapter.CarrierCode"/>.
/// </summary>
public interface ICarrierAdapterRegistry
{
    IReadOnlyList<ICarrierAdapter> All { get; }
    ICarrierAdapter? Resolve(string carrierCode);
    bool IsKnown(string carrierCode);
}
