using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public class AuditLog : BaseEntity
{
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }

    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Broad, searchable activity family (for example Authentication, Data,
    /// Navigation, Search, Click or Form). Existing audit rows are treated as
    /// Data when this field is null.
    /// </summary>
    public string? Category { get; set; }

    /// <summary>Application path where a client-side activity happened.</summary>
    public string? PagePath { get; set; }

    /// <summary>Human-readable, privacy-safe target of a UI interaction.</summary>
    public string? Target { get; set; }

    /// <summary>
    /// Optional structured, non-sensitive context. It must never contain field
    /// values, passwords, tokens, uploaded file contents or search text.
    /// </summary>
    public string? Metadata { get; set; }

    public string? OldValues { get; set; }
    public string? NewValues { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
