namespace Kalypsis.Application.Features.Audit;

public record AuditLogDto(
    Guid Id,
    Guid? TenantId,
    string? TenantName,
    Guid? UserId,
    string? UserEmail,
    string EntityName,
    string EntityId,
    string Action,
    string Category,
    string? PagePath,
    string? Target,
    string? Metadata,
    string? OldValues,
    string? NewValues,
    string? IpAddress,
    string? UserAgent,
    DateTime CreatedAt);

public record AuditLogPageDto(
    IReadOnlyList<AuditLogDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TodayCount,
    int TodayEmployeeCount);

public record UiActivityEventDto(
    string? Category,
    string? Action,
    string? PagePath,
    string? Target);
