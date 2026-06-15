using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public class Notification : TenantEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Link { get; set; }

    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
