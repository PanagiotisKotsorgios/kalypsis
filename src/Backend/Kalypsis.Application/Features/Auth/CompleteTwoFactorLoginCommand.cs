using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

// ============================================================================
// Second step of the 2FA login flow.
//
// 1) /auth/login  → if user has TOTP, returns RequiresTwoFactor=true + a 5-min
//                  ChallengeToken (no access/refresh tokens).
// 2) /auth/2fa/login(challenge, code) → if code valid, returns real tokens.
//
// Brute-force defense: each invalid code attempt on a given user counts toward
// the same FailedLoginAttempts counter password failures do, so the same
// lockout (5 fails → 30 min) applies. Recovery codes are accepted in place of
// the TOTP code and are single-use.
// ============================================================================

public record CompleteTwoFactorLoginRequest(string ChallengeToken, string Code);

public record CompleteTwoFactorLoginCommand(
    string ChallengeToken,
    string Code,
    string? IpAddress,
    string? UserAgent) : IRequest<LoginResponse>;

public class CompleteTwoFactorLoginHandler : IRequestHandler<CompleteTwoFactorLoginCommand, LoginResponse>
{
    private readonly IAppDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly ITotpService _totp;
    private readonly IDateTimeProvider _clock;

    public CompleteTwoFactorLoginHandler(
        IAppDbContext db, IJwtTokenService jwt, ITotpService totp, IDateTimeProvider clock)
    {
        _db = db; _jwt = jwt; _totp = totp; _clock = clock;
    }

    public async Task<LoginResponse> Handle(CompleteTwoFactorLoginCommand request, CancellationToken ct)
    {
        var userId = _jwt.ValidateTwoFactorChallenge(request.ChallengeToken)
            ?? throw AppException.Unauthorized("Μη έγκυρο ή ληγμένο challenge token.");

        var user = await _db.Users.IgnoreQueryFilters()
            .Include(u => u.RecoveryCodes)
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, ct)
            ?? throw AppException.Unauthorized("Άκυρη συνεδρία.");

        if (!user.IsActive)
            throw AppException.Unauthorized("Ο λογαριασμός δεν είναι ενεργός.");

        if (user.LockedUntil is not null && user.LockedUntil > _clock.UtcNow)
            throw AppException.Unauthorized("Ο λογαριασμός είναι κλειδωμένος.");

        if (!user.TwoFactorEnabled || string.IsNullOrEmpty(user.TotpSecret))
            throw AppException.Unauthorized("Δεν απαιτείται 2FA για αυτόν τον λογαριασμό.");

        var code = (request.Code ?? "").Trim();
        if (code.Length == 0)
            throw new AppException("2fa_code_required", "Συμπληρώστε τον κωδικό 2FA.", 400);

        // Recovery code path (single-use). Stored codes are pre-hashed; ITotpService
        // verifies a typed value against a hash. We iterate unused rows.
        bool ok = false;
        if (code.Length >= 10 && code.Length <= 32)
        {
            foreach (var rc in user.RecoveryCodes.Where(r => r.UsedAt == null).ToList())
            {
                if (_totp.VerifyRecoveryCode(code, rc.CodeHash))
                {
                    rc.UsedAt = _clock.UtcNow;
                    ok = true;
                    break;
                }
            }
        }
        if (!ok)
        {
            ok = _totp.VerifyCode(user.TotpSecret, code);
        }

        if (!ok)
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockedUntil = _clock.UtcNow.AddMinutes(30);
                user.FailedLoginAttempts = 0;
            }
            await _db.SaveChangesAsync(ct);
            throw AppException.Unauthorized("Λανθασμένος κωδικός 2FA.");
        }

        // Success — same flow as a regular login: reset counters, mint tokens, audit.
        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;

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

        user.LastLoginAt = _clock.UtcNow;
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = _clock.UtcNow,
            TenantId = user.TenantId == Guid.Empty ? null : user.TenantId,
            UserId = user.Id,
            EntityName = "Authentication",
            EntityId = user.Id.ToString("N"),
            Action = "Login2FA",
            Category = "Authentication",
            PagePath = "/login",
            IpAddress = string.IsNullOrWhiteSpace(request.IpAddress) ? null : request.IpAddress!.Trim(),
            UserAgent = string.IsNullOrWhiteSpace(request.UserAgent) ? null : request.UserAgent!.Trim()
        });
        await _db.SaveChangesAsync(ct);

        var dto = new AuthenticatedUserDto(
            user.Id,
            user.TenantId == Guid.Empty ? null : user.TenantId,
            tenantInfo?.Name,
            user.Email, user.FirstName, user.LastName,
            user.Role, user.PreferredLanguage,
            PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson),
            tenantInfo?.LogoUrl, tenantInfo?.BrandColorHex);

        return new LoginResponse(
            tokens.AccessToken, tokens.AccessTokenExpiresAt,
            tokens.RefreshToken, tokens.RefreshTokenExpiresAt,
            dto);
    }
}
