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
    bool IsImpersonating { get; }
    /// <summary>Office selected for this request, when the tenant is office-scoped.</summary>
    Guid? AgencyOfficeId { get; }
    /// <summary>Whether the selected office is the tenant headquarters.</summary>
    bool AgencyOfficeIsHeadquarters { get; }
}
