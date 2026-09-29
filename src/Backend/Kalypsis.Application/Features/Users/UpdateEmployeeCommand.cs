using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Auth;
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

        if (u.Role != Role.AgencyAdmin && u.Role != Role.AgencyUser && u.Role != Role.AgencyOfficeAdmin)
            throw AppException.Forbidden();

        if (_current.Role == Role.AgencyOfficeAdmin)
        {
            if (u.Role != Role.AgencyUser || c.Body.Role != Role.AgencyUser || !await IsInCurrentOffice(u, ct))
                throw AppException.Forbidden("Ο Υποδιαχειριστής μπορεί να διαχειρίζεται μόνο υπαλλήλους του γραφείου του.");
        }

        var isSelf = u.Id == _current.UserId;
        // Privilege-escalation / self-lockout guards: don't let an admin
        // demote, deactivate, or rename their OWN role through this endpoint.
        // They must do it through a different admin.
        if (isSelf && c.Body.Role != u.Role)
            throw new AppException("self_role_change_forbidden",
                "Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.", 400,
                title: "Μη επιτρεπτή ενέργεια",
                why: "Για να αποφεύγεται το lock-out του τελευταίου admin, η αλλαγή ρόλου γίνεται από διαφορετικό Διαχειριστή.");
        if (isSelf && !c.Body.IsActive)
            throw new AppException("self_deactivate_forbidden",
                "Δεν μπορείτε να απενεργοποιήσετε τον δικό σας λογαριασμό.", 400);

        // If we're DEMOTING an AgencyAdmin to AgencyUser, ensure another admin
        // exists — otherwise the tenant ends up with no administrator.
        if (u.Role == Role.AgencyAdmin
            && c.Body.Role == Role.AgencyUser)
        {
            var otherAdmins = await _db.Users.IgnoreQueryFilters()
                .CountAsync(x => x.TenantId == tenantId && x.DeletedAt == null
                              && x.IsActive
                              && x.Role == Role.AgencyAdmin && x.Id != u.Id, ct);
            if (otherAdmins == 0)
                throw new AppException("last_admin_demote_forbidden",
                    "Δεν μπορείτε να υποβιβάσετε τον μοναδικό Διαχειριστή.", 400,
                    title: "Δεν επιτρέπεται",
                    why: "Πρέπει να παραμένει τουλάχιστον ένας ενεργός Διαχειριστής Γραφείου.",
                    fix: "Προβιβάστε άλλον χρήστη σε Διαχειριστή πρώτα.");
        }

        u.FirstName = c.Body.FirstName.Trim();
        u.LastName  = c.Body.LastName.Trim();
        u.Phone     = string.IsNullOrWhiteSpace(c.Body.Phone) ? null : c.Body.Phone.Trim();
        // Only agency roles are accepted. Office sub-administrators can only
        // be assigned to one office and may never be created by a sub-admin.
        if (c.Body.Role == Role.AgencyAdmin || c.Body.Role == Role.AgencyUser || c.Body.Role == Role.AgencyOfficeAdmin)
            u.Role = c.Body.Role;
        else
            throw AppException.Validation("Μη έγκυρος ρόλος χρήστη.");

        if (u.Role == Role.AgencyAdmin)
        {
            u.AgencyOfficeScopeId = null;
            var existingAssignments = await _db.UserAgencyOffices
                .Where(a => a.UserId == u.Id && a.DeletedAt == null)
                .ToListAsync(ct);
            foreach (var assignment in existingAssignments) assignment.DeletedAt = DateTime.UtcNow;
        }
        else
        {
            var officeId = _current.Role == Role.AgencyOfficeAdmin
                ? _current.AgencyOfficeId
                : u.AgencyOfficeScopeId ?? _current.AgencyOfficeId;
            if (officeId is null)
            {
                officeId = await _db.UserAgencyOffices
                    .Where(a => a.UserId == u.Id && a.DeletedAt == null && a.IsPrimary)
                    .Select(a => (Guid?)a.AgencyOfficeId)
                    .FirstOrDefaultAsync(ct);
            }
            if (officeId is null)
                throw new AppException("office_required", "Ο χρήστης πρέπει να ανήκει σε ενεργό γραφείο.", 400);
            u.AgencyOfficeScopeId = officeId;
            var assignments = await _db.UserAgencyOffices
                .Where(a => a.UserId == u.Id && a.DeletedAt == null)
                .ToListAsync(ct);
            foreach (var assignment in assignments)
            {
                assignment.IsPrimary = assignment.AgencyOfficeId == officeId;
            }
            if (!assignments.Any(a => a.AgencyOfficeId == officeId))
            {
                _db.UserAgencyOffices.Add(new Kalypsis.Domain.Entities.UserAgencyOffice
                {
                    Id = Guid.NewGuid(), TenantId = tenantId, UserId = u.Id,
                    AgencyOfficeId = officeId.Value, IsPrimary = true
                });
            }
        }
        u.IsActive  = c.Body.IsActive;
        u.UpdatedAt = DateTime.UtcNow;

        // Role / activation change invalidates open sessions so the change takes
        // effect on the affected user's next request rather than at access-token
        // expiry. (Self-changes are already blocked above.)
        if (!isSelf)
        {
            await RefreshTokenRevoker.RevokeAllForUserAsync(
                _db, u.Id, DateTime.UtcNow, "employee_role_or_status_changed", ct);
        }

        await _db.SaveChangesAsync(ct);
        return new UserDto(u.Id, u.Email, u.FirstName, u.LastName, u.Phone,
            u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);
    }

    private async Task<bool> IsInCurrentOffice(Kalypsis.Domain.Entities.User user, CancellationToken ct)
    {
        if (_current.AgencyOfficeId is not Guid officeId) return false;
        if (user.AgencyOfficeScopeId is Guid scopedOffice && scopedOffice != officeId) return false;
        if (user.AgencyOfficeScopeId == officeId) return true;
        return await _db.UserAgencyOffices.AnyAsync(a => a.UserId == user.Id
            && a.AgencyOfficeId == officeId && a.DeletedAt == null, ct);
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

        if (u.Role != Role.AgencyAdmin && u.Role != Role.AgencyUser && u.Role != Role.AgencyOfficeAdmin)
            throw AppException.Forbidden();

        if (_current.Role == Role.AgencyOfficeAdmin
            && (u.Role != Role.AgencyUser || !await IsInCurrentOffice(u, ct)))
            throw AppException.Forbidden("Ο Υποδιαχειριστής μπορεί να διαγράφει μόνο υπαλλήλους του γραφείου του.");

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

        var now = DateTime.UtcNow;
        u.DeletedAt = now;
        u.IsActive  = false;
        // Kill open sessions so the soft-deleted user can't keep using the app
        // until their current access token happens to expire.
        await RefreshTokenRevoker.RevokeAllForUserAsync(_db, u.Id, now, "employee_deleted", ct);
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }

    private async Task<bool> IsInCurrentOffice(Kalypsis.Domain.Entities.User user, CancellationToken ct)
    {
        if (_current.AgencyOfficeId is not Guid officeId) return false;
        if (user.AgencyOfficeScopeId is Guid scopedOffice && scopedOffice != officeId) return false;
        if (user.AgencyOfficeScopeId == officeId) return true;
        return await _db.UserAgencyOffices.AnyAsync(a => a.UserId == user.Id
            && a.AgencyOfficeId == officeId && a.DeletedAt == null, ct);
    }
}
