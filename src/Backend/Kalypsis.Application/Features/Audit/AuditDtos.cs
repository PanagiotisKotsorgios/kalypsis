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
    string? OldValues,
    string? NewValues,
    DateTime CreatedAt);
