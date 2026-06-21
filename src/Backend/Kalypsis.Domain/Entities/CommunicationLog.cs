using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One row per recorded interaction between the agency and a customer.
/// Drives the unified customer timeline.
/// </summary>
public class CommunicationLog : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid? UserId { get; set; }                 // user that logged the interaction
    public User? User { get; set; }

    public CommunicationKind Kind { get; set; }
    public CommunicationDirection Direction { get; set; } = CommunicationDirection.Internal;
    public CommunicationOutcome Outcome { get; set; } = CommunicationOutcome.None;

    public DateTime OccurredAt { get; set; }
    public int? DurationSeconds { get; set; }         // calls / meetings

    public string Subject { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? RelatedPolicyNumber { get; set; }

    public Guid? RelatedPolicyId { get; set; }
    public Policy? RelatedPolicy { get; set; }
}
