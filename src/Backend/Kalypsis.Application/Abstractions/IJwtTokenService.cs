using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Abstractions;

public record JwtTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken, DateTime RefreshTokenExpiresAt);

/// <summary>Subject (impersonator) metadata baked into impersonation tokens so the frontend can render "← exit impersonation" and the backend can audit.</summary>
public record ImpersonatorIdentity(Guid UserId, string Email);

public interface IJwtTokenService
{
    JwtTokens IssueTokens(User user);
    /// <summary>
    /// Mints a short-lived access token for the target user, with the original
    /// platform-admin's identity baked into the token claims. No refresh token —
    /// impersonation is intentionally a single browser session, not persistent.
    /// </summary>
    string IssueImpersonationAccessToken(User targetUser, ImpersonatorIdentity impersonator, int minutes = 30);
    string HashRefreshToken(string refreshToken);

    /// <summary>
    /// Mints a one-purpose 5-minute "2FA challenge" token. Carries the user id
    /// and a 2fa_pending=true claim. /auth/2fa/login is the only endpoint that
    /// accepts this token type — it cannot be used as a real session token.
    /// </summary>
    string IssueTwoFactorChallenge(User user, int minutes = 5);

    /// <summary>
    /// Validates a 2FA challenge token's signature, lifetime, and 2fa_pending
    /// claim. Returns the user id baked in the token, or null if invalid.
    /// </summary>
    Guid? ValidateTwoFactorChallenge(string challengeToken);
}
