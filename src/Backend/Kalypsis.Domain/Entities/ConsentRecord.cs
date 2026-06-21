using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One row per (customer, consent type) describing the latest state.
/// History is preserved via append-only — when the customer changes their mind
/// the existing row is closed (RevokedAt set) and a new row is inserted.
/// </summary>
public class ConsentRecord : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public ConsentType Type { get; set; }
    public bool Granted { get; set; }

    public DateTime GrantedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public ConsentMethod Method { get; set; }
    public string? IpAddress { get; set; }
    public string? Version { get; set; }
    public string? Notes { get; set; }
}
