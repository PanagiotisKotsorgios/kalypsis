using Kalypsis.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Audit;

public record ListAuditLogsQuery(
    string? EntityName,
    string? Action,
    Guid? TenantId,
    Guid? UserId,
    int Take = 200) : IRequest<IReadOnlyList<AuditLogDto>>;

public class ListAuditLogsQueryHandler : IRequestHandler<ListAuditLogsQuery, IReadOnlyList<AuditLogDto>>
{
    private readonly IAppDbContext _db;
    public ListAuditLogsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AuditLogDto>> Handle(ListAuditLogsQuery request, CancellationToken cancellationToken)
    {
        var q = _db.AuditLogs.IgnoreQueryFilters().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(request.EntityName))
            q = q.Where(a => a.EntityName == request.EntityName);
        if (!string.IsNullOrWhiteSpace(request.Action))
            q = q.Where(a => a.Action == request.Action);
        if (request.TenantId.HasValue)
            q = q.Where(a => a.TenantId == request.TenantId);
        if (request.UserId.HasValue)
            q = q.Where(a => a.UserId == request.UserId);

        var take = Math.Clamp(request.Take, 1, 1000);

        var rows = await q
            .OrderByDescending(a => a.CreatedAt)
            .Take(take)
            .Select(a => new
            {
                a.Id,
                a.TenantId,
                TenantName = a.TenantId == null ? null : _db.Tenants.IgnoreQueryFilters()
                    .Where(t => t.Id == a.TenantId)
                    .Select(t => t.Name)
                    .FirstOrDefault(),
                a.UserId,
                UserEmail = a.UserId == null ? null : _db.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == a.UserId)
                    .Select(u => u.Email)
                    .FirstOrDefault(),
                a.EntityName,
                a.EntityId,
                a.Action,
                a.OldValues,
                a.NewValues,
                a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AuditLogDto(r.Id, r.TenantId, r.TenantName, r.UserId, r.UserEmail,
                r.EntityName, r.EntityId, r.Action, r.OldValues, r.NewValues, r.CreatedAt))
            .ToList();
    }
}
