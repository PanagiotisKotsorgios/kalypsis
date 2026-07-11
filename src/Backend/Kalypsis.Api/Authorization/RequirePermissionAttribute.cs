using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Authorization;

/// <summary>
/// Marks a controller or action as requiring a specific permission code from
/// <see cref="PermissionCatalog"/>. The check reads the current user's
/// effective permissions (custom override, falling back to role defaults)
/// and returns 403 with a structured payload the frontend recognises if the
/// user doesn't hold the code.
///
/// Semantics:
///  * AgencyAdmin always passes (holds every permission by definition).
///  * PlatformAdmin / PlatformEmployee always pass (support access).
///  * Multiple attributes on the same action mean ANY-OF: as soon as one
///    passes, subsequent [RequirePermission] attributes short-circuit.
///  * The effective permission set is cached per request in HttpContext.Items
///    so a controller with class-level + method-level attributes only hits
///    the DB once.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    public string Code { get; }
    public RequirePermissionAttribute(string code) => Code = code;

    // Sentinel keys stashed in HttpContext.Items. Prefixed so they can't
    // collide with anything else on the request.
    private const string EffectiveSetKey = "Kalypsis.RequirePermission.EffectiveSet";
    private const string PermissionOkKey = "Kalypsis.RequirePermission.Ok";

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Any earlier [RequirePermission] on this action already passed
        // (any-of semantics) — nothing more to do.
        if (context.HttpContext.Items.TryGetValue(PermissionOkKey, out var already) && already is true)
            return;

        var current = context.HttpContext.RequestServices.GetService(typeof(ICurrentUser)) as ICurrentUser;
        if (current is null || !current.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Platform staff NOT impersonating bypass every check.
        if (current.IsPlatformLevel && !current.IsImpersonating)
        {
            context.HttpContext.Items[PermissionOkKey] = true;
            return;
        }

        // AgencyAdmin holds every permission — mirrors
        // PermissionCatalog.RoleDefaults[AgencyAdmin] = All on the frontend.
        if (current.Role == Role.AgencyAdmin)
        {
            context.HttpContext.Items[PermissionOkKey] = true;
            return;
        }

        if (current.UserId is null) { context.Result = new ForbidResult(); return; }

        HashSet<string> effective;
        if (context.HttpContext.Items.TryGetValue(EffectiveSetKey, out var cached) && cached is HashSet<string> hs)
        {
            effective = hs;
        }
        else
        {
            var db = context.HttpContext.RequestServices.GetService(typeof(IAppDbContext)) as IAppDbContext;
            if (db is null) { context.Result = new ForbidResult(); return; }
            var user = await db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == current.UserId.Value && u.DeletedAt == null)
                .Select(u => new { u.Role, u.PermissionsJson })
                .FirstOrDefaultAsync(context.HttpContext.RequestAborted);
            if (user is null) { context.Result = new ForbidResult(); return; }
            var arr = PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson);
            effective = new HashSet<string>(arr, StringComparer.Ordinal);
            context.HttpContext.Items[EffectiveSetKey] = effective;
        }

        if (effective.Contains(Code))
        {
            context.HttpContext.Items[PermissionOkKey] = true;
            return;
        }

        // Note: DO NOT mark PermissionOkKey here; a later [RequirePermission]
        // on the same action may still succeed (any-of). If NO attribute
        // passes, the last one's Result stays and the request is denied.
        context.Result = new ObjectResult(new
        {
            code = "permission_denied",
            message = "Δεν έχετε πρόσβαση σε αυτή τη λειτουργία. Ζητήστε από τον διαχειριστή του γραφείου να σας δώσει δικαιώματα.",
            requiredPermission = Code
        })
        { StatusCode = 403 };
    }
}
