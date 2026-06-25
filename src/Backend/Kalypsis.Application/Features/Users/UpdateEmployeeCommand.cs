using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Users;

public record UpdateEmployeeRequest(
    string FirstName, string LastName,
    string? Phone, Role Role, bool IsActive);

public record UpdateEmployeeCommand(Guid Id, UpdateEmployeeRequest Body) : IRequest<UserDto>;

public class UpdateEmployeeHandler : IRequestHandler<UpdateEmployeeCommand, UserDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateEmployeeHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<UserDto> Handle(UpdateEmployeeCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        if (u.Role != Role.AgencyAdmin && u.Role != Role.AgencyUser)
            throw AppException.Forbidden();

        u.FirstName = c.Body.FirstName.Trim();
        u.LastName  = c.Body.LastName.Trim();
        u.Phone     = string.IsNullOrWhiteSpace(c.Body.Phone) ? null : c.Body.Phone.Trim();
        // Only allow promoting/demoting between the two agency roles.
        if (c.Body.Role == Role.AgencyAdmin || c.Body.Role == Role.AgencyUser)
            u.Role = c.Body.Role;
        u.IsActive  = c.Body.IsActive;
        u.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return new UserDto(u.Id, u.Email, u.FirstName, u.LastName, u.Phone,
            u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
    }
}

public record DeleteEmployeeCommand(Guid Id) : IRequest<Unit>;

public class DeleteEmployeeHandler : IRequestHandler<DeleteEmployeeCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteEmployeeHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteEmployeeCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var u = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        if (u.Role != Role.AgencyAdmin && u.Role != Role.AgencyUser)
            throw AppException.Forbidden();

        // Don't let an admin delete themselves — there must always be at least
        // one active admin in the tenant.
        if (u.Id == _current.UserId)
            throw new AppException("self_delete_forbidden",
                "Δεν μπορείτε να διαγράψετε τον λογαριασμό σας από εδώ.", 400,
                title: "Μη επιτρεπτή ενέργεια",
                why: "Πρέπει να παραμένει τουλάχιστον ένας ενεργός Διαχειριστής Γραφείου.",
                fix: "Αναθέστε τον ρόλο σε άλλον χρήστη πρώτα και ζητήστε από εκείνον να σας αφαιρέσει.");

        if (u.Role == Role.AgencyAdmin)
        {
            var otherAdmins = await _db.Users.IgnoreQueryFilters()
                .CountAsync(x => x.TenantId == tenantId && x.DeletedAt == null
                              && x.Role == Role.AgencyAdmin && x.Id != u.Id, ct);
            if (otherAdmins == 0)
                throw new AppException("last_admin_forbidden",
                    "Δεν μπορείτε να διαγράψετε τον μοναδικό Διαχειριστή Γραφείου.", 400,
                    title: "Δεν επιτρέπεται",
                    why: "Πρέπει να παραμένει τουλάχιστον ένας ενεργός Διαχειριστής.",
                    fix: "Δημιουργήστε ή προβιβάστε άλλον χρήστη σε Διαχειριστή πρώτα.");
        }

        u.DeletedAt = DateTime.UtcNow;
        u.IsActive  = false;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
