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
            var raw = Principal?.FindFirstValue("tenantId");
            return Guid.TryParse(raw, out var id) ? id : null;
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
