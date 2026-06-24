using System.Text.Json;
using Kalypsis.Application.Abstractions;

namespace Kalypsis.Infrastructure.Carriers;

/// <summary>
/// Development stub used until the real partnership credentials are configured
/// for each carrier. Returns deterministic plausible quotes so end-to-end flows
/// can be developed and demo'd. Production swap-in: a `RealInteramericanCarrierAdapter`
/// in `Kalypsis.Carriers.Interamerican` that implements the same interface.
/// </summary>
public sealed class StubCarrierAdapter : ICarrierAdapter
{
    public string CarrierCode { get; }
    public string DisplayName { get; }
    public IReadOnlyList<string> SupportedProductTypes { get; }

    private readonly Random _rng;

    public StubCarrierAdapter(string carrierCode, string displayName,
        IReadOnlyList<string>? supportedProductTypes = null)
    {
        CarrierCode = carrierCode;
        DisplayName = displayName;
        SupportedProductTypes = supportedProductTypes
            ?? new[] { "Auto", "Home", "Health", "Life", "Business", "Travel", "Other" };
        // Seed RNG on carrier code so quotes per carrier are stable across calls.
        _rng = new Random(carrierCode.GetHashCode());
    }

    public Task<CarrierQuoteResult> GetQuoteAsync(CarrierQuoteRequest request, CancellationToken ct = default)
    {
        if (!SupportedProductTypes.Contains(request.ProductType))
        {
            return Task.FromResult(new CarrierQuoteResult(false, null, "EUR", null, null, null, null, null,
                $"{CarrierCode} does not underwrite {request.ProductType}."));
        }

        // Plausible premium per type — varies ±25% per carrier so multi-carrier comparison is meaningful.
        var baseline = request.ProductType switch
        {
            "Auto" => 380m, "Home" => 220m, "Health" => 520m, "Life" => 410m,
            "Business" => 980m, "Travel" => 55m, _ => 300m
        };
        var variance = (decimal)((_rng.NextDouble() * 0.5) - 0.25); // [-25%, +25%]
        var premium = Math.Round(baseline * (1m + variance), 2);

        var result = new CarrierQuoteResult(
            Success: true,
            Premium: premium,
            Currency: "EUR",
            Commission: Math.Round(premium * 0.15m, 2),
            CarrierProductCode: $"{CarrierCode}-{request.ProductType.ToUpperInvariant()}-STD",
            CoverageSummary: $"[STUB] Standard {request.ProductType} cover from {DisplayName}",
            ValidUntil: DateTime.UtcNow.AddDays(14),
            RawResponseRedacted: JsonSerializer.Serialize(new { stub = true, premium }),
            ErrorMessage: null);
        return Task.FromResult(result);
    }

    public Task<CarrierIssuanceResult> IssuePolicyAsync(CarrierIssuanceRequest request, CancellationToken ct = default)
    {
        var policyNumber = $"{CarrierCode[..Math.Min(3, CarrierCode.Length)]}-{DateTime.UtcNow:yyyyMM}-{_rng.Next(100000, 999999)}";
        return Task.FromResult(new CarrierIssuanceResult(
            Success: true,
            CarrierPolicyNumber: policyNumber,
            CarrierApplicationId: Guid.NewGuid().ToString("N")[..12],
            RawResponseRedacted: "[STUB] issued",
            ErrorMessage: null));
    }

    public Task<CarrierIssuanceResult> RenewPolicyAsync(CarrierRenewalRequest request, CancellationToken ct = default)
    {
        return Task.FromResult(new CarrierIssuanceResult(
            Success: true,
            CarrierPolicyNumber: request.CarrierPolicyNumber + "-R",
            CarrierApplicationId: Guid.NewGuid().ToString("N")[..12],
            RawResponseRedacted: "[STUB] renewed",
            ErrorMessage: null));
    }

    public Task<CarrierCancellationResult> CancelPolicyAsync(CarrierCancellationRequest request, CancellationToken ct = default)
        => Task.FromResult(new CarrierCancellationResult(true, 0m, null));

    public Task<IReadOnlyList<CarrierDocument>> FetchDocumentsAsync(string carrierPolicyNumber, CancellationToken ct = default)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes($"[STUB] PDF for policy {carrierPolicyNumber} from {DisplayName}");
        IReadOnlyList<CarrierDocument> docs = new[]
        {
            new CarrierDocument($"{carrierPolicyNumber}.pdf", "application/pdf", bytes, "PolicyCertificate")
        };
        return Task.FromResult(docs);
    }
}

public sealed class CarrierAdapterRegistry : ICarrierAdapterRegistry
{
    private readonly Dictionary<string, ICarrierAdapter> _byCode;
    public CarrierAdapterRegistry(IEnumerable<ICarrierAdapter> adapters)
    {
        _byCode = adapters.ToDictionary(a => a.CarrierCode, StringComparer.OrdinalIgnoreCase);
    }
    public IReadOnlyList<ICarrierAdapter> All => _byCode.Values.ToList();
    public ICarrierAdapter? Resolve(string carrierCode) => _byCode.GetValueOrDefault(carrierCode);
    public bool IsKnown(string carrierCode) => _byCode.ContainsKey(carrierCode);
}
