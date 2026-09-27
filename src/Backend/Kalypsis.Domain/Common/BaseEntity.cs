namespace Kalypsis.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public abstract class TenantEntity : BaseEntity
{
    public Guid TenantId { get; set; }

    /// <summary>
    /// The office that owns this row.  This is deliberately nullable so the
    /// rollout is non-destructive: rows created before multi-office scoping
    /// remain valid and are treated as legacy headquarters data only in the
    /// headquarters context.  New rows are stamped by AppDbContext.
    /// </summary>
    public Guid? AgencyOfficeScopeId { get; set; }
}
