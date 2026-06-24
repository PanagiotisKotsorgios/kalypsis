using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-tenant configuration for a carrier integration. The secret material is
/// stored encrypted (via the application-level encrypted-fields helper) so even
/// a DB dump doesn't leak credentials.
/// </summary>
public class CarrierConnection : TenantEntity
{
    public string CarrierCode { get; set; } = string.Empty;     // INTERAMERICAN / ETHNIKI / EUROLIFE / ERGO / ALLIANZ / NN / GENERALI / INTERLIFE
    public CarrierAdapterStatus Status { get; set; } = CarrierAdapterStatus.Disabled;
    public string? BaseUrl { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecretEncrypted { get; set; }
    public string? AgentCode { get; set; }
    public string? AuthMode { get; set; }                       // OAuth2 / ApiKey / Basic / mTLS
    public DateTime? LastSuccessfulCallAt { get; set; }
    public string? Notes { get; set; }
}

public class CarrierOperationLog : TenantEntity
{
    public Guid? CarrierConnectionId { get; set; }
    public CarrierConnection? CarrierConnection { get; set; }

    public string CarrierCode { get; set; } = string.Empty;
    public CarrierOperation Operation { get; set; }
    public string? CorrelationId { get; set; }                  // ties together a multi-call workflow
    public int? StatusCode { get; set; }
    public bool Success { get; set; }
    public int DurationMs { get; set; }
    public string? RequestSummary { get; set; }                 // redacted, payloads NEVER stored raw
    public string? ResponseSummary { get; set; }
    public string? ErrorMessage { get; set; }
}

public class Quote : TenantEntity
{
    public string QuoteNumber { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string ProductType { get; set; } = string.Empty;     // Auto / Home / Health / Life / Business / Travel / Other
    public QuoteStatus Status { get; set; } = QuoteStatus.Draft;

    /// <summary>Free-form JSON with the risk inputs (vehicle plate, year, bonus-malus,
    /// property sqm + address, covered persons, etc). Shape is determined by ProductType.</summary>
    public string RiskInputsJson { get; set; } = "{}";

    public Guid? SelectedOfferId { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public ICollection<QuoteOffer> Offers { get; set; } = new List<QuoteOffer>();
}

public class QuoteOffer : TenantEntity
{
    public Guid QuoteId { get; set; }
    public Quote Quote { get; set; } = null!;

    public string CarrierCode { get; set; } = string.Empty;
    public string? CarrierProductCode { get; set; }             // e.g. INTERAMERICAN-AUTO-FULL-KASKO
    public decimal Premium { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal? Commission { get; set; }
    public string? CoverageSummary { get; set; }                // bullet list, plain text
    public string? RawResponseRedacted { get; set; }            // sanitised carrier payload for ops
    public DateTime? ValidUntil { get; set; }
    public bool Selected { get; set; }
}

/// <summary>
/// Quote → Application bridges the gap before a Policy is actually written.
/// Tracks what was sent to the carrier, what was returned, the issued policy
/// number (after binding), and any document attachments.
/// </summary>
public class PolicyApplication : TenantEntity
{
    public string ApplicationNumber { get; set; } = string.Empty;
    public Guid QuoteId { get; set; }
    public Quote Quote { get; set; } = null!;

    public Guid SelectedOfferId { get; set; }
    public QuoteOffer SelectedOffer { get; set; } = null!;

    public string Status { get; set; } = "Submitted";           // Submitted / Approved / Rejected / Bound
    public string? CarrierApplicationId { get; set; }
    public string? CarrierResponseRedacted { get; set; }
    public Guid? IssuedPolicyId { get; set; }
    public Policy? IssuedPolicy { get; set; }
}
