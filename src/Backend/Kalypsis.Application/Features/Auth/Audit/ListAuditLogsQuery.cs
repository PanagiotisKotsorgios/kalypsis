using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Audit;

public record ListAuditLogsQuery(
    string? EntityName,
    string? Action,
    Guid? TenantId,
    Guid? UserId,
    string? Category = null,
    string? Search = null,
    DateTime? From = null,
    DateTime? To = null,
    int Page = 1,
    int PageSize = 50) : IRequest<AuditLogPageDto>;

public class ListAuditLogsQueryHandler : IRequestHandler<ListAuditLogsQuery, AuditLogPageDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTimeProvider _clock;

    public ListAuditLogsQueryHandler(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<AuditLogPageDto> Handle(ListAuditLogsQuery request, CancellationToken cancellationToken)
    {
        IQueryable<Kalypsis.Domain.Entities.AuditLog> scoped = _db.AuditLogs.IgnoreQueryFilters().AsNoTracking();

        // An agency manager can only inspect their own office. Platform users
        // retain the cross-tenant audit view, unless they are impersonating an
        // agency, where the normal tenant boundary still applies.
        if (!_currentUser.IsPlatformLevel || _currentUser.IsImpersonating)
        {
            var tenantId = _currentUser.TenantId ?? throw AppException.Forbidden();
            scoped = scoped.Where(a => a.TenantId == tenantId);
        }
        else if (request.TenantId.HasValue)
        {
            scoped = scoped.Where(a => a.TenantId == request.TenantId);
        }

        var todayStart = _clock.UtcNow.Date;
        var todayCount = await scoped.CountAsync(a => a.CreatedAt >= todayStart, cancellationToken);
        var todayEmployeeCount = await scoped
            .Where(a => a.CreatedAt >= todayStart && a.UserId != null)
            .Select(a => a.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var q = scoped;
        if (!string.IsNullOrWhiteSpace(request.EntityName))
        {
            var entityName = request.EntityName.Trim();
            q = q.Where(a => a.EntityName.Contains(entityName));
        }
        if (!string.IsNullOrWhiteSpace(request.Action))
            q = q.Where(a => a.Action == request.Action);
        if (request.UserId.HasValue)
            q = q.Where(a => a.UserId == request.UserId);
        if (!string.IsNullOrWhiteSpace(request.Category))
            q = q.Where(a => (a.Category ?? "Data") == request.Category);
        if (request.From.HasValue)
            q = q.Where(a => a.CreatedAt >= request.From.Value.Date);
        if (request.To.HasValue)
        {
            var exclusiveEnd = request.To.Value.Date.AddDays(1);
            q = q.Where(a => a.CreatedAt < exclusiveEnd);
        }
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            var matchingUsers = _db.Users.IgnoreQueryFilters()
                .Where(u => u.Email.Contains(term) || u.FirstName.Contains(term) || u.LastName.Contains(term))
                .Select(u => u.Id);
            q = q.Where(a => a.Action.Contains(term)
                || a.EntityName.Contains(term)
                || (a.Category ?? "").Contains(term)
                || (a.PagePath ?? "").Contains(term)
                || (a.Target ?? "").Contains(term)
                || (a.UserId.HasValue && matchingUsers.Contains(a.UserId.Value)));
        }

        var totalCount = await q.CountAsync(cancellationToken);
        var pageSize = Math.Clamp(request.PageSize, 10, 200);
        var page = Math.Max(request.Page, 1);
        var pages = Math.Max((int)Math.Ceiling(totalCount / (double)pageSize), 1);
        page = Math.Min(page, pages);

        var rows = await q
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                Category = a.Category ?? "Data",
                a.PagePath,
                a.Target,
                a.Metadata,
                a.OldValues,
                a.NewValues,
                a.IpAddress,
                a.UserAgent,
                a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(r => new AuditLogDto(r.Id, r.TenantId, r.TenantName, r.UserId, r.UserEmail,
                r.EntityName, r.EntityId, r.Action, r.Category, r.PagePath, r.Target, r.Metadata,
                r.OldValues, r.NewValues, r.IpAddress, r.UserAgent, r.CreatedAt))
            .ToList();

        return new AuditLogPageDto(items, totalCount, page, pageSize, todayCount, todayEmployeeCount);
    }
}
