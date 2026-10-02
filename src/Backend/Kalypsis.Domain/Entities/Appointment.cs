using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Appointment : TenantEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Location { get; set; }

    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;

    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }

    /// <summary>Optional producer/partner responsible for the appointment.</summary>
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }
}
