using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>Saved customer/producer audience owned by one insurance office.</summary>
public class CrmGroup : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string EntityType { get; set; } = "Customer"; // Customer / Producer
    public string? Description { get; set; }
    public bool IsDynamic { get; set; }
    /// <summary>
    /// Optional future smart-filter definition. The first release keeps
    /// membership explicit; this JSON lets us add smart groups without
    /// changing the public contract later.
    /// </summary>
    public string? FilterJson { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<CrmGroupMember> Members { get; set; } = new List<CrmGroupMember>();
}

/// <summary>One customer or producer membership in a CRM group.</summary>
public class CrmGroupMember : TenantEntity
{
    public Guid GroupId { get; set; }
    public Guid EntityId { get; set; }
    public string EntityType { get; set; } = "Customer";
    public CrmGroup? Group { get; set; }
}

/// <summary>Communication timeline entry for a producer/partner.</summary>
public class ProducerCommunicationLog : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer Producer { get; set; } = null!;
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public Kalypsis.Domain.Enums.CommunicationKind Kind { get; set; }
    public Kalypsis.Domain.Enums.CommunicationDirection Direction { get; set; } = Kalypsis.Domain.Enums.CommunicationDirection.Internal;
    public Kalypsis.Domain.Enums.CommunicationOutcome Outcome { get; set; } = Kalypsis.Domain.Enums.CommunicationOutcome.None;
    public DateTime OccurredAt { get; set; }
    public int? DurationSeconds { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? Body { get; set; }
}
