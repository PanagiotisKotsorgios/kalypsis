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
    string? TenantName,
    string? TenantLogoUrl = null,
    string? TenantBrandColorHex = null,
    string? TenantContactEmail = null,
    string? TenantContactPhone = null,
    string? TenantAddressLine = null);

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
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == u.TenantId)
            .Select(t => new { t.Name, t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone, t.AddressLine })
            .FirstOrDefaultAsync(ct);
        return new MyProfileDto(
            u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.PreferredLanguage, u.Role,
            u.TenantId == Guid.Empty ? null : u.TenantId,
            tenant?.Name, tenant?.LogoUrl, tenant?.BrandColorHex,
            tenant?.ContactEmail, tenant?.ContactPhone, tenant?.AddressLine);
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

        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == u.TenantId)
            .Select(t => new { t.Name, t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone, t.AddressLine })
            .FirstOrDefaultAsync(ct);
        return new MyProfileDto(
            u.Id, u.Email, u.FirstName, u.LastName, u.Phone, u.PreferredLanguage, u.Role,
            u.TenantId == Guid.Empty ? null : u.TenantId,
            tenant?.Name, tenant?.LogoUrl, tenant?.BrandColorHex,
            tenant?.ContactEmail, tenant?.ContactPhone, tenant?.AddressLine);
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
            throw new AppException("wrong_current_password",
                "Ο τρέχων κωδικός είναι λανθασμένος.", 400,
                title: "Λανθασμένος τρέχων κωδικός",
                why: "Ο κωδικός που πληκτρολογήσατε στο πεδίο «Τρέχων κωδικός» δεν ταιριάζει με τον τρέχοντα κωδικό σας. Η επαλήθευση γίνεται για ασφάλεια.",
                fix: "Δοκιμάστε ξανά τον τρέχοντα κωδικό. Αν τον έχετε ξεχάσει, αποσυνδεθείτε και χρησιμοποιήστε «Ξέχασα τον κωδικό μου» στη σελίδα εισόδου.",
                fixLink: "/login");

        u.PasswordHash = _hasher.Hash(request.Body.NewPassword);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
