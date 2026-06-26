using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record LoginCommand(
    string Email,
    string Password,
    string? IpAddress = null,
    string? UserAgent = null) : IRequest<LoginResponse>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IDateTimeProvider _clock;

    public LoginCommandHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt, IDateTimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Email == email && u.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            throw AppException.Unauthorized("Λανθασμένο email ή κωδικός.");
        }

        if (user.LockedUntil is not null && user.LockedUntil > _clock.UtcNow)
        {
            AddAuthenticationAudit(user, "LoginBlocked", request);
            await _db.SaveChangesAsync(cancellationToken);
            var minutes = (int)Math.Ceiling((user.LockedUntil.Value - _clock.UtcNow).TotalMinutes);
            throw AppException.Unauthorized($"Ο λογαριασμός είναι κλειδωμένος. Δοκιμάστε ξανά σε {minutes} λεπτά.");
        }

        if (!user.IsActive || !_hasher.Verify(request.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockedUntil = _clock.UtcNow.AddMinutes(30);
                user.FailedLoginAttempts = 0;
            }
            AddAuthenticationAudit(user, "LoginFailed", request);
            await _db.SaveChangesAsync(cancellationToken);
            throw AppException.Unauthorized("Λανθασμένο email ή κωδικός.");
        }

        // Successful login — reset the lockout counter.
        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;

        var tenantInfo = user.TenantId == Guid.Empty
            ? null
            : await _db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Id == user.TenantId)
                .Select(t => new { t.Name, t.LogoUrl, t.BrandColorHex })
                .FirstOrDefaultAsync(cancellationToken);

        var tokens = _jwt.IssueTokens(user);

        _db.RefreshTokens.Add(new Domain.Entities.RefreshToken
        {
            UserId = user.Id,
            TokenHash = _jwt.HashRefreshToken(tokens.RefreshToken),
            ExpiresAt = tokens.RefreshTokenExpiresAt
        });

        user.LastLoginAt = _clock.UtcNow;
        AddAuthenticationAudit(user, "Login", request);
        await _db.SaveChangesAsync(cancellationToken);

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

    private void AddAuthenticationAudit(User user, string action, LoginCommand request)
    {
        if (user.Role is not (Role.AgencyAdmin or Role.AgencyUser or Role.PlatformAdmin or Role.PlatformEmployee))
            return;

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = _clock.UtcNow,
            TenantId = user.TenantId == Guid.Empty ? null : user.TenantId,
            UserId = user.Id,
            EntityName = "Authentication",
            EntityId = user.Id.ToString("N"),
            Action = action,
            Category = "Authentication",
            PagePath = "/login",
            Target = "Σύνδεση BackOffice",
            Metadata = "{\"source\":\"web\"}",
            IpAddress = Trim(request.IpAddress, 64),
            UserAgent = Trim(request.UserAgent, 512)
        });
    }

    private static string? Trim(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
