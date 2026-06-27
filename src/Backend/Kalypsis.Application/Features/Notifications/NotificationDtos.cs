namespace Kalypsis.Application.Features.Notifications;

public record NotificationDto(
    Guid Id,
    string Title,
    string Body,
    string? Category,
    string? Link,
    bool IsRead,
    DateTime? ReadAt,
    DateTime CreatedAt);

public record UnreadCountDto(int Count);

public record DeletedNotificationsDto(int Count);
