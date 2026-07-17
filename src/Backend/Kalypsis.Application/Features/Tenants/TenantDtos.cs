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
    int CustomerCount,
    // Count of enabled TenantPackageGrant rows — 0 means the tenant sees only
    // the package-free items in the sidebar (Οδηγίες / Backups / Legal) and
    // will complain that the app is empty. SuperAdmin uses this to spot
    // tenants that never had packages assigned.
    int PackageCount = 0);

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
