using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Auth;

public record LoginCommand(string Email, string Password) : IRequest<LoginResponse>;

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

        if (user is null || !user.IsActive || !_hasher.Verify(request.Password, user.PasswordHash))
        {
            throw AppException.Unauthorized("Λανθασμένο email ή κωδικός.");
        }

        var tenantName = user.TenantId == Guid.Empty
            ? null
            : await _db.Tenants
                .IgnoreQueryFilters()
                .Where(t => t.Id == user.TenantId)
                .Select(t => t.Name)
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
            tenantName,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Role,
            user.PreferredLanguage);

        return new LoginResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            tokens.RefreshTokenExpiresAt,
            dto);
    }
}
