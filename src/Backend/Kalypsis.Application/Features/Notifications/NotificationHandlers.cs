using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Notifications;

public record ListMyNotificationsQuery(bool? Unread) : IRequest<IReadOnlyList<NotificationDto>>;

public class ListMyNotificationsQueryHandler : IRequestHandler<ListMyNotificationsQuery, IReadOnlyList<NotificationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListMyNotificationsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<NotificationDto>> Handle(ListMyNotificationsQuery request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var q = _db.Notifications.IgnoreQueryFilters()
            .Where(n => n.UserId == userId && n.DeletedAt == null);
        if (request.Unread == true) q = q.Where(n => !n.IsRead);

        return await q
            .OrderByDescending(n => n.CreatedAt)
            .Take(200)
            .Select(n => new NotificationDto(n.Id, n.Title, n.Body, n.Category, n.Link, n.IsRead, n.ReadAt, n.CreatedAt))
            .ToListAsync(ct);
    }
}

public record UnreadCountQuery() : IRequest<UnreadCountDto>;

public class UnreadCountQueryHandler : IRequestHandler<UnreadCountQuery, UnreadCountDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UnreadCountQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<UnreadCountDto> Handle(UnreadCountQuery request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var count = await _db.Notifications.IgnoreQueryFilters()
            .CountAsync(n => n.UserId == userId && n.DeletedAt == null && !n.IsRead, ct);
        return new UnreadCountDto(count);
    }
}

public record MarkReadCommand(Guid Id) : IRequest<Unit>;

public class MarkReadCommandHandler : IRequestHandler<MarkReadCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public MarkReadCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<Unit> Handle(MarkReadCommand request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var n = await _db.Notifications.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.UserId == userId, ct)
            ?? throw AppException.NotFound("Notification");

        if (!n.IsRead)
        {
            n.IsRead = true;
            n.ReadAt = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return Unit.Value;
    }
}

public record MarkAllReadCommand() : IRequest<Unit>;

public class MarkAllReadCommandHandler : IRequestHandler<MarkAllReadCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public MarkAllReadCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<Unit> Handle(MarkAllReadCommand request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var now = _clock.UtcNow;
        await _db.Notifications.IgnoreQueryFilters()
            .Where(n => n.UserId == userId && !n.IsRead && n.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true).SetProperty(n => n.ReadAt, now), ct);
        return Unit.Value;
    }
}
