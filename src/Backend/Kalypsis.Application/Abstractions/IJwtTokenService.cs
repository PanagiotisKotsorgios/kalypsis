using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Abstractions;

public record JwtTokens(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken, DateTime RefreshTokenExpiresAt);

public interface IJwtTokenService
{
    JwtTokens IssueTokens(User user);
    string HashRefreshToken(string refreshToken);
}
