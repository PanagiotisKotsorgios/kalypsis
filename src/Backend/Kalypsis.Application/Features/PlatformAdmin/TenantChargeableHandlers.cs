using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

// Superadmin-only CRUD for per-tenant ad-hoc charges (training hours,
// migration, custom dev). All endpoints treat the row as owned by the
// platform, not the tenant, so tenant users never see them until they
// appear on an invoice.

public record TenantChargeableDto(
    Guid Id, Guid TenantId,
    string ServiceCode, string Description, string UnitLabel,
    decimal UnitPrice, decimal Quantity, decimal LineTotal,
    DateTime PerformedOn, string? Notes,
    bool Invoiced, Guid? InvoiceLineId,
    DateTime? PaidAt, string? PaidReference,
    DateTime CreatedAt);

public record UpsertTenantChargeableBody(
    Guid? Id, Guid TenantId,
    string ServiceCode, string Description, string UnitLabel,
    decimal UnitPrice, decimal Quantity,
    DateTime PerformedOn, string? Notes);

/* ========= List (per tenant) ========= */

public record ListTenantChargeablesQuery(Guid TenantId) : IRequest<IReadOnlyList<TenantChargeableDto>>;

public class ListTenantChargeablesHandler
    : IRequestHandler<ListTenantChargeablesQuery, IReadOnlyList<TenantChargeableDto>>
{
    private readonly IAppDbContext _db;
    public ListTenantChargeablesHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<TenantChargeableDto>> Handle(ListTenantChargeablesQuery r, CancellationToken ct)
    {
        try
        {
            var rows = await _db.TenantChargeables.IgnoreQueryFilters()
                .Where(x => x.TenantId == r.TenantId && x.DeletedAt == null)
                .OrderByDescending(x => x.PerformedOn)
                .ThenByDescending(x => x.CreatedAt)
                .ToListAsync(ct);
            return rows.Select(x => new TenantChargeableDto(
                x.Id, x.TenantId, x.ServiceCode, x.Description, x.UnitLabel,
                x.UnitPrice, x.Quantity, x.LineTotal,
                x.PerformedOn, x.Notes,
                x.InvoiceLineId.HasValue, x.InvoiceLineId,
                x.PaidAt, x.PaidReference,
                x.CreatedAt)).ToList();
        }
        catch { return Array.Empty<TenantChargeableDto>(); }
    }
}

/* ========= Upsert ========= */

public record UpsertTenantChargeableCommand(UpsertTenantChargeableBody Body)
    : IRequest<TenantChargeableDto>;

public class UpsertTenantChargeableHandler
    : IRequestHandler<UpsertTenantChargeableCommand, TenantChargeableDto>
{
    private readonly IAppDbContext _db;
    public UpsertTenantChargeableHandler(IAppDbContext db) => _db = db;

    public async Task<TenantChargeableDto> Handle(UpsertTenantChargeableCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (b.TenantId == Guid.Empty) throw new AppException("bad_tenant", "TenantId required", 400);
        if (string.IsNullOrWhiteSpace(b.ServiceCode)) throw new AppException("bad_code", "ServiceCode required", 400);
        if (string.IsNullOrWhiteSpace(b.Description)) throw new AppException("bad_desc", "Description required", 400);
        if (b.UnitPrice < 0 || b.Quantity <= 0) throw new AppException("bad_amounts", "Invalid price or quantity", 400);

        TenantChargeable? row = null;
        if (b.Id.HasValue)
        {
            row = await _db.TenantChargeables.IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Id == b.Id.Value && x.DeletedAt == null, ct);
            if (row is null) throw AppException.NotFound("Χρέωση");
            if (row.InvoiceLineId.HasValue)
                throw new AppException("already_invoiced",
                    "Η χρέωση έχει ήδη τιμολογηθεί και δεν μπορεί να αλλάξει.", 409);
        }
        else
        {
            row = new TenantChargeable { Id = Guid.NewGuid(), TenantId = b.TenantId };
            _db.TenantChargeables.Add(row);
        }

        row.ServiceCode = b.ServiceCode.Trim();
        row.Description = b.Description.Trim();
        row.UnitLabel = string.IsNullOrWhiteSpace(b.UnitLabel) ? "flat" : b.UnitLabel.Trim();
        row.UnitPrice = decimal.Round(b.UnitPrice, 2);
        row.Quantity = decimal.Round(b.Quantity, 2);
        row.LineTotal = decimal.Round(row.UnitPrice * row.Quantity, 2);
        row.PerformedOn = b.PerformedOn == default ? DateTime.UtcNow : b.PerformedOn;
        row.Notes = string.IsNullOrWhiteSpace(b.Notes) ? null : b.Notes.Trim();

        await _db.SaveChangesAsync(ct);

        return new TenantChargeableDto(
            row.Id, row.TenantId, row.ServiceCode, row.Description, row.UnitLabel,
            row.UnitPrice, row.Quantity, row.LineTotal,
            row.PerformedOn, row.Notes,
            row.InvoiceLineId.HasValue, row.InvoiceLineId,
            row.PaidAt, row.PaidReference,
            row.CreatedAt);
    }
}

/* ========= Mark as paid / unpaid ========= */

public record SetChargeablePaidBody(bool Paid, string? Reference);

public record SetChargeablePaidCommand(Guid Id, bool Paid, string? Reference) : IRequest<Unit>;

public class SetChargeablePaidHandler : IRequestHandler<SetChargeablePaidCommand, Unit>
{
    private readonly IAppDbContext _db;
    public SetChargeablePaidHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(SetChargeablePaidCommand r, CancellationToken ct)
    {
        var row = await _db.TenantChargeables.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρέωση");
        if (r.Paid)
        {
            row.PaidAt = DateTime.UtcNow;
            row.PaidReference = string.IsNullOrWhiteSpace(r.Reference) ? null : r.Reference.Trim();
        }
        else
        {
            row.PaidAt = null;
            row.PaidReference = null;
        }
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Delete ========= */

public record DeleteTenantChargeableCommand(Guid Id) : IRequest<Unit>;

public class DeleteTenantChargeableHandler : IRequestHandler<DeleteTenantChargeableCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteTenantChargeableHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(DeleteTenantChargeableCommand r, CancellationToken ct)
    {
        var row = await _db.TenantChargeables.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρέωση");
        if (row.InvoiceLineId.HasValue)
            throw new AppException("already_invoiced",
                "Η χρέωση έχει ήδη τιμολογηθεί και δεν διαγράφεται.", 409);
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Summary per tenant (used by billing dashboard) ========= */

public record TenantChargeableSummaryDto(
    Guid TenantId,
    decimal PendingTotal, int PendingCount,
    decimal InvoicedTotal, int InvoicedCount,
    decimal PaidTotal, int PaidCount);

public record GetTenantChargeableSummaryQuery(Guid TenantId) : IRequest<TenantChargeableSummaryDto>;

public class GetTenantChargeableSummaryHandler
    : IRequestHandler<GetTenantChargeableSummaryQuery, TenantChargeableSummaryDto>
{
    private readonly IAppDbContext _db;
    public GetTenantChargeableSummaryHandler(IAppDbContext db) => _db = db;

    public async Task<TenantChargeableSummaryDto> Handle(GetTenantChargeableSummaryQuery r, CancellationToken ct)
    {
        try
        {
            var rows = await _db.TenantChargeables.IgnoreQueryFilters()
                .Where(x => x.TenantId == r.TenantId && x.DeletedAt == null)
                .Select(x => new { x.LineTotal, x.InvoiceLineId, x.PaidAt })
                .ToListAsync(ct);
            var invoiced = rows.Where(x => x.InvoiceLineId.HasValue).ToList();
            var paid = rows.Where(x => x.PaidAt.HasValue && !x.InvoiceLineId.HasValue).ToList();
            var pending = rows.Where(x => !x.InvoiceLineId.HasValue && !x.PaidAt.HasValue).ToList();
            return new TenantChargeableSummaryDto(
                r.TenantId,
                pending.Sum(x => x.LineTotal), pending.Count,
                invoiced.Sum(x => x.LineTotal), invoiced.Count,
                paid.Sum(x => x.LineTotal), paid.Count);
        }
        catch
        {
            return new TenantChargeableSummaryDto(r.TenantId, 0, 0, 0, 0, 0, 0);
        }
    }
}
