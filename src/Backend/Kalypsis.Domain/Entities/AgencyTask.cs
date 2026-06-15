using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class AgencyTask : TenantEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public AgencyTaskStatus Status { get; set; } = AgencyTaskStatus.Open;
    public AgencyTaskPriority Priority { get; set; } = AgencyTaskPriority.Normal;

    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }

    public DateTime? DueAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
