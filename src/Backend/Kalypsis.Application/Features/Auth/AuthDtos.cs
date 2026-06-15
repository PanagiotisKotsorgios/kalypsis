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
    string PreferredLanguage);

public record LoginResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    AuthenticatedUserDto User);
