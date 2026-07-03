using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

/// <summary>
/// Step 2 of the email-code login flow: exchange the challenge token +
/// the 6-digit code the user just entered from their email for real
/// session tokens. Rate-limited via User.PendingLoginCodeAttempts —
/// after 5 wrong tries the pending code is cleared and the user must
/// restart the login.
/// </summary>
public record CompleteEmailCodeLoginCommand(
    string ChallengeToken,
    string Code,
    string? IpAddress = null,
    string? UserAgent = null) : IRequest<LoginResponse>;

public class CompleteEmailCodeLoginHandler : IRequestHandler<CompleteEmailCodeLoginCommand, LoginResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IDateTimeProvider _clock;

    public CompleteEmailCodeLoginHandler(IAppDbContext db, IPasswordHasher hasher,
        IJwtTokenService jwt, IDateTimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<LoginResponse> Handle(CompleteEmailCodeLoginCommand r, CancellationToken ct)
    {
        var userId = _jwt.ValidateTwoFactorChallenge(r.ChallengeToken)
            ?? throw AppException.Unauthorized("Το challenge token είναι άκυρο ή έχει λήξει.");

        var user = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, ct)
            ?? throw AppException.Unauthorized("Ο χρήστης δεν βρέθηκε.");

        if (string.IsNullOrEmpty(user.PendingLoginCodeHash)
            || user.PendingLoginCodeExpiresAt is null
            || user.PendingLoginCodeExpiresAt < _clock.UtcNow)
        {
            user.PendingLoginCodeHash = null;
            user.PendingLoginCodeExpiresAt = null;
            user.PendingLoginCodeAttempts = 0;
            await _db.SaveChangesAsync(ct);
            throw AppException.Unauthorized("Ο κωδικός έληξε — ζητήστε νέο.");
        }

        if (user.PendingLoginCodeAttempts >= 5)
        {
            user.PendingLoginCodeHash = null;
            user.PendingLoginCodeExpiresAt = null;
            user.PendingLoginCodeAttempts = 0;
            await _db.SaveChangesAsync(ct);
            throw AppException.Unauthorized("Πάρα πολλές αποτυχημένες προσπάθειες — ξεκινήστε τη σύνδεση από την αρχή.");
        }

        var codeOk = _hasher.Verify(r.Code.Trim(), user.PendingLoginCodeHash);
        if (!codeOk)
        {
            user.PendingLoginCodeAttempts++;
            await _db.SaveChangesAsync(ct);
            throw AppException.Unauthorized("Λανθασμένος κωδικός.");
        }

        // Success — clear the pending code, issue real tokens.
        user.PendingLoginCodeHash = null;
        user.PendingLoginCodeExpiresAt = null;
        user.PendingLoginCodeAttempts = 0;
        user.LastLoginAt = _clock.UtcNow;

        var tenantInfo = user.TenantId == Guid.Empty
            ? null
            : await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.Id == user.TenantId)
                .Select(t => new { t.Name, t.LogoUrl, t.BrandColorHex })
                .FirstOrDefaultAsync(ct);

        var tokens = _jwt.IssueTokens(user);
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = _jwt.HashRefreshToken(tokens.RefreshToken),
            ExpiresAt = tokens.RefreshTokenExpiresAt
        });
        await _db.SaveChangesAsync(ct);

        var dto = new AuthenticatedUserDto(
            user.Id,
            user.TenantId == Guid.Empty ? null : user.TenantId,
            tenantInfo?.Name,
            user.Email, user.FirstName, user.LastName, user.Role, user.PreferredLanguage,
            PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson),
            tenantInfo?.LogoUrl, tenantInfo?.BrandColorHex);

        return new LoginResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            tokens.RefreshTokenExpiresAt,
            dto);
    }
}
