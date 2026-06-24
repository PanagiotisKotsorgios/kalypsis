using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Kalypsis.Api.Authorization;

/// <summary>
/// Marks a controller or action as requiring a specific Kalypsis package. If
/// the current tenant doesn't have that package enabled, the request is
/// rejected with HTTP 403 + a structured payload the frontend recognises and
/// converts to the "package not licensed" screen.
///
/// Platform-level users (PlatformAdmin / PlatformEmployee) bypass the check
/// UNLESS they are impersonating a tenant — when impersonating they're scoped
/// to that tenant's package set, so they see exactly what the tenant sees.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequiresPackageAttribute : Attribute, IAsyncAuthorizationFilter
{
    public PackageCode Package { get; }

    public RequiresPackageAttribute(PackageCode package) => Package = package;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var sp = context.HttpContext.RequestServices;
        var current = sp.GetRequiredService<ICurrentUser>();
        var pkgService = sp.GetRequiredService<IPackageService>();

        // Anonymous endpoints never carry a tenant — let the [Authorize] layer
        // handle them. If somehow we got here unauthenticated, deny.
        if (!current.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Platform staff NOT impersonating: skip the check entirely. They
        // operate above the tenant context.
        if (current.IsPlatformLevel && !current.IsImpersonating)
            return;

        var tenantId = current.TenantId;
        if (tenantId is null)
        {
            context.Result = new ObjectResult(new
            {
                code = "no_tenant",
                message = "No tenant context for this request."
            })
            { StatusCode = 403 };
            return;
        }

        var ok = await pkgService.HasAsync(tenantId.Value, Package, context.HttpContext.RequestAborted);
        if (!ok)
        {
            context.Result = new ObjectResult(new
            {
                code = "package_not_licensed",
                message = "Αυτή η λειτουργία δεν περιλαμβάνεται στο πακέτο σας.",
                requiredPackage = Package.ToString()
            })
            { StatusCode = 403 };
        }
    }
}
