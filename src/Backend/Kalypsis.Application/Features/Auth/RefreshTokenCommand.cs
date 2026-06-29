using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

// ============================================================================
// Refresh-token rotation with reuse detection.
//
// Every successful refresh:
//   - revokes the presented token (single-use)
//   - issues a brand-new access + refresh pair
//   - links old.ReplacedByTokenHash → new (audit trail)
//
// If the client presents a token that is ALREADY revoked, that's evidence
// someone stole a token. We revoke EVERY refresh token for the user — both
// the attacker and the legitimate session are kicked out and forced to log
// in again from scratch. This is the "compromised-family" kill switch from
// OAuth refresh-token best practices.
// ============================================================================

public record RefreshTokenRequest(string RefreshToken);

public record RefreshTokenCommand(string RefreshToken) : IRequest<LoginResponse>;

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(2048);
    }
}

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, LoginResponse>
{
    private readonly IAppDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly IDateTimeProvider _clock;

    public RefreshTokenCommandHandler(IAppDbContext db, IJwtTokenService jwt, IDateTimeProvider clock)
    {
        _db = db;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<LoginResponse> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var presentedHash = _jwt.HashRefreshToken(request.RefreshToken);
        var now = _clock.UtcNow;

        var record = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == presentedHash, ct);

        if (record is null)
            throw AppException.Unauthorized("Μη έγκυρο refresh token.");

        // === Reuse detection ===
        // If the token was already revoked but is being presented again, an
        // attacker is on the loose. Revoke every refresh token belonging to
        // this user — both legitimate and stolen sessions get killed.
        if (record.RevokedAt is not null)
        {
            await KillAllSessionsAsync(record.UserId, now, "refresh_token_reuse_detected", ct);
            throw AppException.Unauthorized(
                "Εντοπίστηκε επανάχρηση token. Όλες οι ενεργές συνεδρίες ακυρώθηκαν για ασφάλεια.");
        }

        if (record.ExpiresAt < now)
            throw AppException.Unauthorized("Το refresh token έχει λήξει. Συνδεθείτε ξανά.");

        var user = record.User;
        if (user is null || !user.IsActive || user.DeletedAt is not null)
            throw AppException.Unauthorized("Ο λογαριασμός δεν είναι ενεργός.");

        if (user.LockedUntil is not null && user.LockedUntil > now)
            throw AppException.Unauthorized("Ο λογαριασμός είναι κλειδωμένος.");

        // Issue the rotated pair.
        var tokens = _jwt.IssueTokens(user);
        var newHash = _jwt.HashRefreshToken(tokens.RefreshToken);

        // Mark the presented token as spent.
        record.RevokedAt = now;
        record.ReplacedByTokenHash = newHash;
        record.UpdatedAt = now;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAt = tokens.RefreshTokenExpiresAt,
            CreatedAt = now
        });

        var tenantInfo = user.TenantId == Guid.Empty
            ? null
            : await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.Id == user.TenantId)
                .Select(t => new { t.Name, t.LogoUrl, t.BrandColorHex })
                .FirstOrDefaultAsync(ct);

        await _db.SaveChangesAsync(ct);

        var dto = new AuthenticatedUserDto(
            user.Id,
            user.TenantId == Guid.Empty ? null : user.TenantId,
            tenantInfo?.Name,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Role,
            user.PreferredLanguage,
            PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson),
            tenantInfo?.LogoUrl,
            tenantInfo?.BrandColorHex);

        return new LoginResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            tokens.RefreshTokenExpiresAt,
            dto);
    }

    private async Task KillAllSessionsAsync(Guid userId, DateTime now, string reason, CancellationToken ct)
    {
        var all = await _db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var t in all)
        {
            t.RevokedAt = now;
            t.UpdatedAt = now;
        }
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            UserId = userId,
            EntityName = "Authentication",
            EntityId = userId.ToString("N"),
            Action = reason,
            Category = "Security",
            Target = "Refresh token family revoked"
        });
        await _db.SaveChangesAsync(ct);
    }
}

// ============================================================================
// Logout — explicitly revoke the presented refresh token.
// ============================================================================

public record LogoutCommand(string? RefreshToken, Guid? UserId) : IRequest<Unit>;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly IDateTimeProvider _clock;

    public LogoutCommandHandler(IAppDbContext db, IJwtTokenService jwt, IDateTimeProvider clock)
    {
        _db = db;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<Unit> Handle(LogoutCommand request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            var presentedHash = _jwt.HashRefreshToken(request.RefreshToken);
            var record = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == presentedHash, ct);
            if (record is not null && record.RevokedAt is null)
            {
                record.RevokedAt = now;
                record.UpdatedAt = now;
                await _db.SaveChangesAsync(ct);
            }
        }
        return Unit.Value;
    }
}

// ============================================================================
// Helper: revoke every active refresh token for a user. Called by password
// reset / password change so a stolen session can't outlive the credential.
// ============================================================================

public static class RefreshTokenRevoker
{
    public static async Task RevokeAllForUserAsync(IAppDbContext db, Guid userId, DateTime now, string reason, CancellationToken ct)
    {
        var all = await db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var t in all)
        {
            t.RevokedAt = now;
            t.UpdatedAt = now;
        }
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            UserId = userId,
            EntityName = "Authentication",
            EntityId = userId.ToString("N"),
            Action = reason,
            Category = "Security",
            Target = "All sessions invalidated"
        });
    }
}
