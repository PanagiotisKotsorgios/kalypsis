using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Authorization;

/// <summary>
/// Returns 403 when the current user's effective permission set (User.PermissionsJson
/// falling back to role defaults via PermissionCatalog) does not include the required
/// code. PlatformAdmin / PlatformEmployee bypass the check — they need to be able to
/// support and impersonate everywhere.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    public string Code { get; }
    public RequirePermissionAttribute(string code) => Code = code;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var current = context.HttpContext.RequestServices.GetService(typeof(ICurrentUser)) as ICurrentUser;
        if (current is null || !current.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        if (current.IsPlatformLevel) return;

        var db = context.HttpContext.RequestServices.GetService(typeof(IAppDbContext)) as IAppDbContext;
        if (db is null) { context.Result = new ForbidResult(); return; }
        if (current.UserId is null) { context.Result = new ForbidResult(); return; }

        var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == current.UserId.Value);
        if (user is null) { context.Result = new ForbidResult(); return; }

        var effective = PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson);
        if (!effective.Contains(Code))
        {
            context.Result = new ObjectResult(new { code = "forbidden", message = $"Missing permission: {Code}" }) { StatusCode = 403 };
        }
    }
}
