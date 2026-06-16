using System.Security.Claims;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace Kalypsis.Infrastructure.Auth;

public sealed class HttpContextCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpContextCurrentUser(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var raw = Principal?.FindFirstValue("sub") ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public Guid? TenantId
    {
        get
        {
            // PlatformAdmin / PlatformEmployee can scope themselves into a single
            // tenant by sending X-Impersonate-Tenant. All downstream queries then
            // honour the existing tenant filter as if the user were inside that
            // tenant.
            if (IsPlatformLevel)
            {
                var imp = _accessor.HttpContext?.Request.Headers["X-Impersonate-Tenant"].ToString();
                if (!string.IsNullOrWhiteSpace(imp) && Guid.TryParse(imp, out var impId))
                    return impId;
            }

            var raw = Principal?.FindFirstValue("tenantId");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public bool IsImpersonating
    {
        get
        {
            if (!IsPlatformLevel) return false;
            var imp = _accessor.HttpContext?.Request.Headers["X-Impersonate-Tenant"].ToString();
            return !string.IsNullOrWhiteSpace(imp) && Guid.TryParse(imp, out _);
        }
    }

    public Role? Role
    {
        get
        {
            var raw = Principal?.FindFirstValue("role") ?? Principal?.FindFirstValue(ClaimTypes.Role);
            return Enum.TryParse<Role>(raw, out var r) ? r : null;
        }
    }

    public string? Email => Principal?.FindFirstValue("email") ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public bool IsPlatformLevel => Role is Domain.Enums.Role.PlatformAdmin or Domain.Enums.Role.PlatformEmployee;
}
