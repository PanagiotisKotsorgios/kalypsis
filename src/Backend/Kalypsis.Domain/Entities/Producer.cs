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

    /// <summary>
    /// Θέση του συνεργάτη στην ιεραρχία προμηθειών. Ένας απλός Producer έχει
    /// έναν Manager ως γονέα, ο Manager έναν Unit, κ.ο.κ. Το Agency (γραφείο)
    /// είναι πάντα η ρίζα. Νέες εγγραφές default σε <see cref="HierarchyLevel.Producer"/>.
    /// </summary>
    public HierarchyLevel HierarchyLevel { get; set; } = HierarchyLevel.Producer;

    /// <summary>
    /// Προϊστάμενος του συνεργάτη — self-referencing FK. Ο calculator ανεβαίνει
    /// αυτήν την αλυσίδα ώστε να βρει ποιοι πληρώνονται σε κάθε επίπεδο.
    /// Nullable ώστε ένας stand-alone Agency owner να μην απαιτεί κάτι πάνω από
    /// αυτόν.
    /// </summary>
    public Guid? ParentProducerId { get; set; }
    public Producer? ParentProducer { get; set; }

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
    public ICollection<CommissionRule> CommissionRules { get; set; } = new List<CommissionRule>();
}
