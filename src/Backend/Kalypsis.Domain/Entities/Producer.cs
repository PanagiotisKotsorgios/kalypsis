using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Producer : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public ProducerStatus Status { get; set; } = ProducerStatus.Active;
    /// <summary>
    /// Commission tier (Α/Β/Γ/Δ/Ε). Used by the parametrizer so the agency can
    /// declare a single commission rule per category instead of repeating it
    /// for each individual partner.
    /// </summary>
    public ProducerTier Tier { get; set; } = ProducerTier.None;

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
    public ICollection<CommissionRule> CommissionRules { get; set; } = new List<CommissionRule>();
}
