using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A manually created green card attached to one policy.  The generated PDF is
/// stored through PolicyDocument so it follows the existing document retention,
/// preview and download rules.
/// </summary>
public class GreenCard : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public Guid? PolicyDocumentId { get; set; }
    public PolicyDocument? PolicyDocument { get; set; }

    public string CardNumber { get; set; } = string.Empty;
    public GreenCardStatus Status { get; set; } = GreenCardStatus.Draft;
    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidTo { get; set; }

    public string HolderName { get; set; } = string.Empty;
    public string InsuredName { get; set; } = string.Empty;
    public string VehicleRegistrationPlate { get; set; } = string.Empty;
    public string? VehicleMakeModel { get; set; }
    public string? VehicleVin { get; set; }

    /// <summary>Comma separated country codes/names as entered by the office.</summary>
    public string? Territories { get; set; }
    public string? IssuingOffice { get; set; }
    public string? DeliveryMethod { get; set; }
    public string? Notes { get; set; }
    public DateTime? IssuedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
}
