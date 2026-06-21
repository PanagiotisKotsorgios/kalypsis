using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

/// <summary>
/// Mobile-only login. Only Role.Customer (client portal users) are allowed
/// through this endpoint; every other role is rejected even with valid creds.
/// </summary>
public record MobileLoginCommand(string Email, string Password) : IRequest<LoginResponse>;

public class MobileLoginCommandValidator : AbstractValidator<MobileLoginCommand>
{
    public MobileLoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
    }
}

public class MobileLoginCommandHandler : IRequestHandler<MobileLoginCommand, LoginResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IDateTimeProvider _clock;

    public MobileLoginCommandHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt, IDateTimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
    }

    public async Task<LoginResponse> Handle(MobileLoginCommand request, CancellationToken cancellationToken)
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
            await _db.SaveChangesAsync(cancellationToken);
            throw AppException.Unauthorized("Λανθασμένο email ή κωδικός.");
        }

        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;

        // Mobile app is client-portal only. Reject any non-Customer login here
        // so internal staff cannot accidentally authenticate against the public mobile API.
        if (user.Role != Role.Customer)
        {
            throw AppException.Forbidden("Η εφαρμογή είναι διαθέσιμη μόνο για πελάτες.");
        }

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
}
