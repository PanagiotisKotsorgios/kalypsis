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
}
