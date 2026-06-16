using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Profile;

public record MyProfileDto(
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    string PreferredLanguage,
    Role Role,
    Guid? TenantId,
    string? TenantName);

public record UpdateProfileBody(string FirstName, string LastName, string? Phone, string PreferredLanguage);
public record ChangePasswordBody(string CurrentPassword, string NewPassword);

/* ========= Get profile ========= */

public record GetMyProfileQuery() : IRequest<MyProfileDto>;

public class GetMyProfileQueryHandler : IRequestHandler<GetMyProfileQuery, MyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetMyProfileQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<MyProfileDto> Handle(GetMyProfileQuery request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == userId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");
        var tenantName = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == u.TenantId).Select(t => t.Name).FirstOrDefaultAsync(ct);
        return new MyProfileDto(u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.PreferredLanguage, u.Role,
            u.TenantId == Guid.Empty ? null : u.TenantId, tenantName);
    }
}

/* ========= Update profile ========= */

public record UpdateMyProfileCommand(UpdateProfileBody Body) : IRequest<MyProfileDto>;

public class UpdateMyProfileCommandValidator : AbstractValidator<UpdateMyProfileCommand>
{
    public UpdateMyProfileCommandValidator()
    {
        RuleFor(x => x.Body.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Body.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Body.PreferredLanguage).NotEmpty().MaximumLength(8);
    }
}

public class UpdateMyProfileCommandHandler : IRequestHandler<UpdateMyProfileCommand, MyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateMyProfileCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<MyProfileDto> Handle(UpdateMyProfileCommand request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == userId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        u.FirstName = request.Body.FirstName.Trim();
        u.LastName = request.Body.LastName.Trim();
        u.Phone = request.Body.Phone?.Trim();
        u.PreferredLanguage = request.Body.PreferredLanguage.Trim();
        await _db.SaveChangesAsync(ct);

        var tenantName = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == u.TenantId).Select(t => t.Name).FirstOrDefaultAsync(ct);
        return new MyProfileDto(u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.PreferredLanguage, u.Role,
            u.TenantId == Guid.Empty ? null : u.TenantId, tenantName);
    }
}

/* ========= Change password ========= */

public record ChangeMyPasswordCommand(ChangePasswordBody Body) : IRequest<Unit>;

public class ChangeMyPasswordCommandValidator : AbstractValidator<ChangeMyPasswordCommand>
{
    public ChangeMyPasswordCommandValidator()
    {
        RuleFor(x => x.Body.CurrentPassword).NotEmpty();
        RuleFor(x => x.Body.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public class ChangeMyPasswordCommandHandler : IRequestHandler<ChangeMyPasswordCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IPasswordHasher _hasher;
    public ChangeMyPasswordCommandHandler(IAppDbContext db, ICurrentUser current, IPasswordHasher hasher)
    { _db = db; _current = current; _hasher = hasher; }

    public async Task<Unit> Handle(ChangeMyPasswordCommand request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == userId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        if (!_hasher.Verify(request.Body.CurrentPassword, u.PasswordHash))
            throw AppException.Validation("Ο τρέχων κωδικός είναι λανθασμένος.");

        u.PasswordHash = _hasher.Hash(request.Body.NewPassword);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
