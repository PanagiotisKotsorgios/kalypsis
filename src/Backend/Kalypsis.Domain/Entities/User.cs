using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class User : TenantEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public Role Role { get; set; }
    public string PreferredLanguage { get; set; } = "el";

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public DateTime? LastLoginAt { get; set; }

    /// <summary>Track failed login attempts to power lockout after N consecutive failures.</summary>
    public int FailedLoginAttempts { get; set; }
    /// <summary>If set and in the future, login is rejected even with correct credentials.</summary>
    public DateTime? LockedUntil { get; set; }

    /// <summary>TOTP secret, Base32-encoded. When non-null and TwoFactorEnabled, 2FA is enforced.</summary>
    public string? TotpSecret { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public DateTime? TwoFactorEnabledAt { get; set; }
    public ICollection<TwoFactorRecoveryCode> RecoveryCodes { get; set; } = new List<TwoFactorRecoveryCode>();

    /// <summary>
    /// Email-code 2FA: on successful password check, a 6-digit code is
    /// generated + emailed via Brevo and stored here (BCrypt hash). The
    /// login response returns a challenge token; the client must POST the
    /// code with the challenge to receive the actual session tokens.
    /// Enabled via PlatformSetting `require_email_login_code` (global) or
    /// a future per-user opt-in.
    /// </summary>
    public string? PendingLoginCodeHash { get; set; }
    public DateTime? PendingLoginCodeExpiresAt { get; set; }
    public int PendingLoginCodeAttempts { get; set; }

    /// <summary>
    /// Per-user opt-in for email-code 2FA. When true, every successful
    /// password login triggers the 6-digit Brevo email challenge even if
    /// PlatformSetting.RequireEmailLoginCode is off. Toggled from the
    /// user's profile page (Ρυθμίσεις → 2FA).
    /// </summary>
    public bool EmailLoginCodeEnabled { get; set; }

    /// <summary>
    /// JSON array of permission codes the agency admin has granted this user
    /// (e.g. ["customers.read","customers.write","commissions.run"]). Null /
    /// empty means use the role defaults.
    /// </summary>
    public string? PermissionsJson { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }
}
