using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Tenants;

public record TenantDto(
    Guid Id,
    string Name,
    string Code,
    bool IsActive,
    SubscriptionPlan SubscriptionPlan,
    DateTime CreatedAt,
    int UserCount,
    int CustomerCount);

public record CreateTenantRequest(
    string Name,
    string Code,
    SubscriptionPlan SubscriptionPlan,
    string AdminEmail,
    string AdminFirstName,
    string AdminLastName,
    string? AdminPhone,
    string AdminPassword);

public record CreateTenantResponse(TenantDto Tenant, Guid AdminUserId, string AdminEmail);
