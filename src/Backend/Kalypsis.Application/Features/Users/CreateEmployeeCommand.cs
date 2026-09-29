using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Users;

public record CreateEmployeeCommand(CreateEmployeeRequest Request) : IRequest<CreateEmployeeResponse>;

public class CreateEmployeeCommandValidator : AbstractValidator<CreateEmployeeCommand>
{
    public CreateEmployeeCommandValidator()
    {
        RuleFor(x => x.Request.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Request.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Request.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Request.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.Request.Role).Must(r => r == Role.AgencyAdmin || r == Role.AgencyUser || r == Role.AgencyOfficeAdmin)
            .WithMessage("Ο ρόλος πρέπει να είναι AgencyAdmin, AgencyOfficeAdmin ή AgencyUser.");
    }
}

public class CreateEmployeeCommandHandler : IRequestHandler<CreateEmployeeCommand, CreateEmployeeResponse>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IPasswordHasher _hasher;

    public CreateEmployeeCommandHandler(IAppDbContext db, ICurrentUser currentUser, IPasswordHasher hasher)
    {
        _db = db;
        _currentUser = currentUser;
        _hasher = hasher;
    }

    public async Task<CreateEmployeeResponse> Handle(CreateEmployeeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden("Δεν έχει οριστεί γραφείο.");

        // A sub-administrator can create employees only. Administrator and
        // sub-administrator accounts remain controlled by the tenant admin.
        if (_currentUser.Role == Role.AgencyOfficeAdmin
            && request.Request.Role != Role.AgencyUser)
            throw AppException.Forbidden("Ο Υποδιαχειριστής μπορεί να δημιουργεί μόνο υπαλλήλους του γραφείου του.");

        var requestedRole = request.Request.Role;
        Guid? officeId = _currentUser.AgencyOfficeId;
        if (requestedRole != Role.AgencyAdmin && officeId is null)
        {
            officeId = await _db.AgencyOffices
                .Where(o => o.TenantId == tenantId && o.DeletedAt == null && o.IsActive)
                .OrderByDescending(o => o.IsHeadquarters)
                .ThenBy(o => o.Name)
                .Select(o => (Guid?)o.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (officeId is null)
                throw new AppException("office_required", "Δεν υπάρχει ενεργό γραφείο για την ανάθεση του χρήστη.", 400);
        }

        var email = request.Request.Email.Trim().ToLowerInvariant();

        var emailExists = await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, cancellationToken);
        if (emailExists) throw new AppException("user_email_taken",
            $"Ο χρήστης με email '{email}' υπάρχει ήδη.", 409,
            title: "Email σε χρήση",
            why: $"Το email {email} χρησιμοποιείται από άλλον χρήστη — μπορεί να είναι σε άλλο γραφείο ή να ανήκει σε παραγωγό/πελάτη.",
            fix: "Χρησιμοποιήστε διαφορετική διεύθυνση email για τον νέο υπάλληλο (π.χ. προσθέστε αύξοντα αριθμό ή χρησιμοποιήστε email του τμήματος).",
            fixLink: "/app/users");

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            PasswordHash = _hasher.Hash(request.Request.Password),
            FirstName = request.Request.FirstName.Trim(),
            LastName = request.Request.LastName.Trim(),
            Phone = request.Request.Phone?.Trim(),
            Role = requestedRole,
            AgencyOfficeScopeId = requestedRole == Role.AgencyAdmin ? null : officeId,
            IsActive = true,
            PreferredLanguage = "el"
        };
        _db.Users.Add(user);
        if (requestedRole != Role.AgencyAdmin && officeId is Guid assignedOfficeId)
        {
            _db.UserAgencyOffices.Add(new UserAgencyOffice
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = user.Id,
                AgencyOfficeId = assignedOfficeId,
                IsPrimary = true
            });
        }
        await _db.SaveChangesAsync(cancellationToken);

        return new CreateEmployeeResponse(new UserDto(
            user.Id, user.Email, user.FirstName, user.LastName, user.Phone,
            user.Role, user.IsActive, user.CreatedAt, user.LastLoginAt));
    }
}
