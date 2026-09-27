using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Auth;

/// <summary>
/// Resolves and validates the office context before controllers execute.
/// Agency users may only select an office assigned to them. Agency admins may
/// select any active office in their own tenant; without a selection they keep
/// their all-office view. A missing user assignment is kept backwards
/// compatible by falling back to the tenant headquarters.
/// </summary>
public sealed class AgencyOfficeScopeMiddleware
{
    public const string OfficeHeader = "X-Agency-Office";
    public const string OfficeIdItem = "Kalypsis.AgencyOfficeId";
    public const string IsHeadquartersItem = "Kalypsis.AgencyOfficeIsHeadquarters";

    private readonly RequestDelegate _next;

    public AgencyOfficeScopeMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        if (!context.Request.Path.StartsWithSegments("/api")
            || context.User?.Identity?.IsAuthenticated != true
            || !Enum.TryParse<Role>(context.User.FindFirst("role")?.Value, true, out var role)
            || (role != Role.AgencyUser && role != Role.AgencyAdmin))
        {
            await _next(context);
            return;
        }

        var tenantRaw = context.User.FindFirst("tenantId")?.Value;
        var userRaw = context.User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId) || !Guid.TryParse(userRaw, out var userId))
        {
            await _next(context);
            return;
        }

        // Admins can see every office, but an explicitly selected office still
        // has to belong to their tenant. This prevents a forged header from
        // stamping new rows with another tenant's office id.
        if (role == Role.AgencyAdmin)
        {
            var adminRequestedRaw = context.Request.Headers[OfficeHeader].ToString();
            if (Guid.TryParse(adminRequestedRaw, out var adminRequestedId))
            {
                var selectedAdminOffice = await db.AgencyOffices
                    .IgnoreQueryFilters()
                    .Where(x => x.Id == adminRequestedId
                        && x.TenantId == tenantId
                        && x.DeletedAt == null
                        && x.IsActive)
                    .Select(x => new { x.Id, x.IsHeadquarters })
                    .FirstOrDefaultAsync(context.RequestAborted);
                if (selectedAdminOffice is null)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        code = "office_access_denied",
                        message = "Δεν έχετε πρόσβαση στο επιλεγμένο υποκατάστημα."
                    }, context.RequestAborted);
                    return;
                }

                context.Items[OfficeIdItem] = selectedAdminOffice.Id;
                context.Items[IsHeadquartersItem] = selectedAdminOffice.IsHeadquarters;
            }

            await _next(context);
            return;
        }

        // Ignore the office filter while resolving the user's assignment.  The
        // tenant predicate remains explicit and is never client-controlled.
        var offices = await db.UserAgencyOffices
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.UserId == userId && x.DeletedAt == null)
            .Join(db.AgencyOffices.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null),
                assignment => assignment.AgencyOfficeId,
                office => office.Id,
                (assignment, office) => new { assignment, office })
            .Where(x => x.office.IsActive)
            .Select(x => new { x.assignment.AgencyOfficeId, x.assignment.IsPrimary, x.office.IsHeadquarters })
            .ToListAsync(context.RequestAborted);

        // No offices configured yet: preserve the old single-office tenant
        // behaviour.  Once an office exists, every AgencyUser is scoped.
        if (offices.Count == 0)
        {
            var hasAssignment = await db.UserAgencyOffices.IgnoreQueryFilters()
                .AnyAsync(x => x.TenantId == tenantId && x.UserId == userId && x.DeletedAt == null,
                    context.RequestAborted);
            if (hasAssignment)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "office_assignment_required",
                    message = "Ο χρήστης δεν έχει ανάθεση σε ενεργό υποκατάστημα."
                }, context.RequestAborted);
                return;
            }

            // Existing users often pre-date office assignments.  Put them in
            // the headquarters context automatically instead of locking them
            // out; this does not modify any user or business data.
            var fallback = await db.AgencyOffices.IgnoreQueryFilters()
                .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.IsActive)
                .OrderByDescending(x => x.IsHeadquarters)
                .Select(x => new { AgencyOfficeId = x.Id, IsHeadquarters = x.IsHeadquarters })
                .FirstOrDefaultAsync(context.RequestAborted);
            if (fallback is null)
            {
                // No offices configured at all: preserve the pre-office tenant
                // behaviour until the administrator creates the first one.
                await _next(context);
                return;
            }

            context.Items[OfficeIdItem] = fallback.AgencyOfficeId;
            context.Items[IsHeadquartersItem] = fallback.IsHeadquarters;
            await _next(context);
            return;
        }

        var requestedRaw = context.Request.Headers[OfficeHeader].ToString();
        var selected = Guid.TryParse(requestedRaw, out var requestedId)
            ? offices.FirstOrDefault(x => x.AgencyOfficeId == requestedId)
            : offices.FirstOrDefault(x => x.IsPrimary) ?? offices[0];

        if (selected is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                code = "office_access_denied",
                message = "Δεν έχετε πρόσβαση στο επιλεγμένο υποκατάστημα."
            }, context.RequestAborted);
            return;
        }

        context.Items[OfficeIdItem] = selected.AgencyOfficeId;
        context.Items[IsHeadquartersItem] = selected.IsHeadquarters;
        await _next(context);
    }
}
