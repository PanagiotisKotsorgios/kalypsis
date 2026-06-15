using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Abstractions;

public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid? TenantId { get; }
    Role? Role { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
    bool IsPlatformLevel { get; }
}
