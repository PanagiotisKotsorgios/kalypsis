using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public class InsuranceCompany : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Country { get; set; }
    public string? Website { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Phase 8.7 — null = global carrier (visible to every tenant);
    /// non-null = tenant-specific carrier the agency added themselves
    /// (e.g. small regional carrier, or a niche provider).
    /// </summary>
    public Guid? TenantId { get; set; }

    // Additional contact / commercial metadata
    public string? AgentCode { get; set; }                   // the agency's contract code with this carrier
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? AfmVat { get; set; }
    public string? Notes { get; set; }

    /// <summary>
    /// Broker / πρακτορείο model: when this carrier distributes through a
    /// broker (e.g. Grand Cover/IW redistributing many sub-carriers), set
    /// ParentCompanyId to the broker's id. Each sub-carrier has its own
    /// parametrics (packages/coverages/uses); the broker carries the
    /// shared branch/use taxonomy. NO navigation property on purpose —
    /// EF would expect a relationship config in the snapshot and the
    /// runtime "pending model changes" check would refuse to migrate.
    /// </summary>
    public Guid? ParentCompanyId { get; set; }

    /// <summary>True for entries that act as a broker container — flips
    /// the frontend to render a sub-carrier picker instead of treating
    /// the row as a direct carrier.</summary>
    public bool IsBroker { get; set; }

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
}
