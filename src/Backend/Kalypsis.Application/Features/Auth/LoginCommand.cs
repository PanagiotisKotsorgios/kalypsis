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
    private readonly IEmailSender _email;

    public LoginCommandHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt,
        IDateTimeProvider clock, IEmailSender email)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _clock = clock;
        _email = email;
    }

    // A pre-computed BCrypt hash of a constant value. We run Verify against it
    // when the user doesn't exist so the response time matches an existing-but-
    // wrong-password attempt — kills the email-enumeration timing oracle.
    private const string DummyHash = "$2a$12$8sZ4lW0r1Z3Y9c2Q9b1aOuPjGlPmDdJ7c2WdHk0aZ1xL5gQ.OABBy";

    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Email == email && u.DeletedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            // Burn the same CPU time a real verify would take so the attacker
            // can't tell "no such email" from "wrong password" by timing.
            _hasher.Verify(request.Password, DummyHash);
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

        // 2FA gate. If the user has TOTP enrolled, the password alone isn't enough:
        // we issue a short-lived (5 min) "challenge token" instead of real session
        // tokens. The client must POST /api/auth/2fa/login with the challenge +
        // a valid TOTP code (or a recovery code) to receive the actual tokens.
        if (user.TwoFactorEnabled && !string.IsNullOrEmpty(user.TotpSecret))
        {
            var challenge = _jwt.IssueTwoFactorChallenge(user);
            AddAuthenticationAudit(user, "LoginRequires2FA", request);
            await _db.SaveChangesAsync(cancellationToken);
            return new LoginResponse(
                AccessToken: string.Empty,
                AccessTokenExpiresAt: _clock.UtcNow,
                RefreshToken: string.Empty,
                RefreshTokenExpiresAt: _clock.UtcNow,
                User: new AuthenticatedUserDto(user.Id, null, null, user.Email, user.FirstName, user.LastName,
                    user.Role, user.PreferredLanguage, Array.Empty<string>()),
                RequiresTwoFactor: true,
                ChallengeToken: challenge);
        }

        // Email-code 2FA gate — enabled globally via the
        // PlatformSetting.RequireEmailLoginCode toggle in Ρυθμίσεις.
        // Generates a random 6-digit code, hashes + stores it with a 10-min
        // expiry on the user row, then delivers it via IEmailSender (Brevo
        // when configured). Client submits the code with the challenge to
        // receive tokens.
        var requireEmailCode = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(s => s.Id).Select(s => (bool?)s.RequireEmailLoginCode)
            .FirstOrDefaultAsync(cancellationToken) ?? false;
        if (requireEmailCode)
        {
            var code = new Random().Next(100000, 1_000_000).ToString("D6");
            user.PendingLoginCodeHash = _hasher.Hash(code);
            user.PendingLoginCodeExpiresAt = _clock.UtcNow.AddMinutes(10);
            user.PendingLoginCodeAttempts = 0;
            var challenge = _jwt.IssueTwoFactorChallenge(user);
            AddAuthenticationAudit(user, "LoginRequiresEmailCode", request);
            await _db.SaveChangesAsync(cancellationToken);
            // Fire the email — swallow failures so a temporary Brevo outage
            // still leaves the user free to try again (the code is stored).
            try
            {
                await _email.SendAsync(new EmailMessage(
                    ToEmail: user.Email,
                    ToName: $"{user.FirstName} {user.LastName}".Trim(),
                    Subject: "Κωδικός σύνδεσης Kalypsis",
                    HtmlBody: $"<p>Ο κωδικός σύνδεσής σας είναι:</p>" +
                              $"<h1 style=\"letter-spacing: 6px; font-family: monospace;\">{code}</h1>" +
                              "<p>Ισχύει για 10 λεπτά. Αν δεν κάνατε προσπάθεια σύνδεσης, αγνοήστε αυτό το μήνυμα.</p>",
                    TextBody: $"Ο κωδικός σύνδεσής σας είναι: {code}\nΙσχύει για 10 λεπτά."),
                    cancellationToken);
            }
            catch { /* delivered on next retry; user can request a new code from the frontend */ }
            return new LoginResponse(
                AccessToken: string.Empty,
                AccessTokenExpiresAt: _clock.UtcNow,
                RefreshToken: string.Empty,
                RefreshTokenExpiresAt: _clock.UtcNow,
                User: new AuthenticatedUserDto(user.Id, null, null, user.Email, user.FirstName, user.LastName,
                    user.Role, user.PreferredLanguage, Array.Empty<string>()),
                RequiresTwoFactor: false,
                ChallengeToken: challenge,
                RequiresEmailCode: true);
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
