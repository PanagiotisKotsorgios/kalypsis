using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformPayments;

public record TenantPaymentDto(
    Guid TenantId, DateTime? PaidUntil, DateTime? LastPaidOn, string? Note);

public record ListTenantPaymentsQuery : IRequest<IReadOnlyList<TenantPaymentDto>>;
public class ListTenantPaymentsHandler
    : IRequestHandler<ListTenantPaymentsQuery, IReadOnlyList<TenantPaymentDto>>
{
    private readonly IAppDbContext _db;
    public ListTenantPaymentsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<TenantPaymentDto>> Handle(ListTenantPaymentsQuery _, CancellationToken ct)
    {
        var rows = await _db.TenantPaymentStatuses
            .Where(p => p.DeletedAt == null)
            .ToListAsync(ct);
        return rows.Select(p => new TenantPaymentDto(p.TenantId, p.PaidUntil, p.LastPaidOn, p.Note)).ToList();
    }
}

public record UpsertTenantPaymentCommand(
    Guid TenantId, DateTime? PaidUntil, DateTime? LastPaidOn, string? Note) : IRequest<TenantPaymentDto>;

public class UpsertTenantPaymentHandler
    : IRequestHandler<UpsertTenantPaymentCommand, TenantPaymentDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertTenantPaymentHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<TenantPaymentDto> Handle(UpsertTenantPaymentCommand r, CancellationToken ct)
    {
        // Guard: the tenant must exist. Otherwise a stray call from a
        // corrupted client cache would silently insert an orphan row.
        var tenantExists = await _db.Tenants.IgnoreQueryFilters()
            .AnyAsync(t => t.Id == r.TenantId && t.DeletedAt == null, ct);
        if (!tenantExists) throw AppException.NotFound("Tenant");

        var row = await _db.TenantPaymentStatuses
            .FirstOrDefaultAsync(p => p.TenantId == r.TenantId && p.DeletedAt == null, ct);
        if (row == null)
        {
            row = new TenantPaymentStatus { TenantId = r.TenantId };
            _db.TenantPaymentStatuses.Add(row);
        }
        row.PaidUntil = r.PaidUntil;
        row.LastPaidOn = r.LastPaidOn;
        row.Note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim();
        row.UpdatedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);
        return new TenantPaymentDto(row.TenantId, row.PaidUntil, row.LastPaidOn, row.Note);
    }
}

public record ClearTenantPaymentCommand(Guid TenantId) : IRequest;
public class ClearTenantPaymentHandler : IRequestHandler<ClearTenantPaymentCommand>
{
    private readonly IAppDbContext _db;
    public ClearTenantPaymentHandler(IAppDbContext db) => _db = db;
    public async Task Handle(ClearTenantPaymentCommand r, CancellationToken ct)
    {
        var row = await _db.TenantPaymentStatuses
            .FirstOrDefaultAsync(p => p.TenantId == r.TenantId && p.DeletedAt == null, ct);
        if (row == null) return;
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
