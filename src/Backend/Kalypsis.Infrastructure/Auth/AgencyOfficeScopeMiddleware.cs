using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Auth;

/// <summary>
/// Resolves and validates the office context before controllers execute.
/// Agency users and office sub-administrators may only use their assigned
/// office. Agency admins may select any active office in their own tenant;
/// without a selection they keep their all-office view. A missing user
/// assignment is kept backwards compatible for legacy AgencyUser accounts by
/// falling back to the tenant headquarters.
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
            || !Enum.TryParse<Role>(context.User.FindFirst("role")?.Value, true, out var role))
        {
            await _next(context);
            return;
        }

        // Platform staff normally bypass office scoping. While viewing a
        // tenant through X-Impersonate-Tenant, however, the same office
        // selector used by an AgencyAdmin must work so support can inspect a
        // single office without accidentally showing the whole tenant.
        var impersonatedTenantRaw = context.Request.Headers["X-Impersonate-Tenant"].ToString();
        var platformImpersonating =
            (role == Role.PlatformAdmin || role == Role.PlatformEmployee)
            && Guid.TryParse(impersonatedTenantRaw, out _);
        var officeAwareRole = role == Role.AgencyUser
            || role == Role.AgencyOfficeAdmin
            || role == Role.AgencyAdmin
            || role == Role.Customer
            || platformImpersonating;
        if (!officeAwareRole)
        {
            await _next(context);
            return;
        }

        var tenantRaw = platformImpersonating
            ? impersonatedTenantRaw
            : context.User.FindFirst("tenantId")?.Value;
        var userRaw = context.User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(tenantRaw, out var tenantId) || !Guid.TryParse(userRaw, out var userId))
        {
            await _next(context);
            return;
        }

        // Customer accounts are permanently bound to the office that created
        // them. They cannot select an office with a header. Resolving this
        // assignment before the normal query filters means every portal query
        // is scoped to the customer's own office as well as their customer id.
        if (role == Role.Customer)
        {
            var customerAssignment = await db.Users
                .IgnoreQueryFilters()
                .Where(x => x.Id == userId && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => new { x.CustomerId, x.AgencyOfficeScopeId })
                .FirstOrDefaultAsync(context.RequestAborted);

            var customerOfficeId = customerAssignment?.AgencyOfficeScopeId;
            if (customerOfficeId is null && customerAssignment?.CustomerId is Guid customerId)
            {
                customerOfficeId = await db.Customers.IgnoreQueryFilters()
                    .Where(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null)
                    .Select(x => x.AgencyOfficeScopeId)
                    .FirstOrDefaultAsync(context.RequestAborted);
            }

            var customerOffice = customerOfficeId is Guid officeId
                ? await db.AgencyOffices.IgnoreQueryFilters()
                    .Where(x => x.Id == officeId && x.TenantId == tenantId && x.DeletedAt == null && x.IsActive)
                    .Select(x => new { x.Id, x.IsHeadquarters })
                    .FirstOrDefaultAsync(context.RequestAborted)
                : null;

            if (customerOffice is null)
            {
                customerOffice = await db.AgencyOffices.IgnoreQueryFilters()
                    .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.IsActive)
                    .OrderByDescending(x => x.IsHeadquarters)
                    .Select(x => new { x.Id, x.IsHeadquarters })
                    .FirstOrDefaultAsync(context.RequestAborted);
            }

            if (customerOffice is not null)
            {
                context.Items[OfficeIdItem] = customerOffice.Id;
                context.Items[IsHeadquartersItem] = customerOffice.IsHeadquarters;
            }

            await _next(context);
            return;
        }

        // Admins can see every office, but an explicitly selected office still
        // has to belong to their tenant. This prevents a forged header from
        // stamping new rows with another tenant's office id.
        if (role == Role.AgencyAdmin || platformImpersonating)
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

        var requiresExplicitOffice = role == Role.AgencyOfficeAdmin;

        // No offices configured yet: preserve the old single-office tenant
        // behaviour for legacy AgencyUser accounts. An office administrator
        // must always be assigned to one concrete office.
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

            if (requiresExplicitOffice)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "office_assignment_required",
                    message = "Ο υποδιαχειριστής πρέπει να έχει ανάθεση σε ένα ενεργό γραφείο."
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

        // AgencyUser and AgencyOfficeAdmin are single-office roles. If old
        // data contains more than one assignment, use the primary (or first)
        // assignment and ignore a forged/ambiguous office switch header.
        var requestedRaw = context.Request.Headers[OfficeHeader].ToString();
        var selected = role is Role.AgencyUser or Role.AgencyOfficeAdmin
            ? offices.FirstOrDefault(x => x.IsPrimary) ?? offices[0]
            : (Guid.TryParse(requestedRaw, out var requestedId)
                ? offices.FirstOrDefault(x => x.AgencyOfficeId == requestedId)
                : offices.FirstOrDefault(x => x.IsPrimary) ?? offices[0]);

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
