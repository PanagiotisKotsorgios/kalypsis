using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public string? RequestIp { get; set; }
}
