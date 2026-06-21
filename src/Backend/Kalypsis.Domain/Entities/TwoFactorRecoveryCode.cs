using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One-time recovery code for TOTP 2FA — shown once on enrollment, hashed at rest.
/// </summary>
public class TwoFactorRecoveryCode : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime? UsedAt { get; set; }
}
