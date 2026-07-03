using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Auth;

public record LoginRequest(string Email, string Password);

public record AuthenticatedUserDto(
    Guid UserId,
    Guid? TenantId,
    string? TenantName,
    string Email,
    string FirstName,
    string LastName,
    Role Role,
    string PreferredLanguage,
    string[] Permissions,
    string? TenantLogoUrl = null,
    string? TenantBrandColorHex = null);

public record LoginResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    AuthenticatedUserDto User,
    // When TwoFactorEnabled, the first login call returns RequiresTwoFactor=true,
    // empty access/refresh tokens, and a short-lived ChallengeToken. The client
    // then POSTs the TOTP code + challenge to /api/auth/2fa/login to get real tokens.
    bool RequiresTwoFactor = false,
    string? ChallengeToken = null,
    // When the tenant has enabled the email-code gate, the first login
    // call returns RequiresEmailCode=true + a challenge. The client then
    // asks the user for the 6-digit code they just received via email
    // and POSTs it to /api/auth/email-code-login with the challenge.
    bool RequiresEmailCode = false);
