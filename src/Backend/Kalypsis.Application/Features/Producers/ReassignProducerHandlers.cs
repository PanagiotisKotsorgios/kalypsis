using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

// ============================================================================
// Reassign every policy / pending commission from one producer to another.
//
// What moves:
//   - Policy.ProducerId       (active and historic — the new partner now owns
//                              the renewal pipeline)
//   - Pending CommissionTransactions (Status = Pending)
//   - Pending CommissionRunLines in runs that are NOT yet Approved/Paid
//
// What stays with the original producer:
//   - Settled / paid CommissionTransactions and CommissionRunLines (audit
//     truth — they were earned by that person and any payout already issued
//     references their identity).
//   - CommissionRules (the new producer should have their own; we don't
//     silently grant them the old rate ladder).
//   - ProducerCommissionDeclarations (historical self-reports stay attached
//     to whoever made them).
//
// The handler writes ONE summary AuditLog row describing the move so the
// office has an undo-by-hand trail.
// ============================================================================

public record ReassignProducerPreviewQuery(Guid FromProducerId, Guid ToProducerId)
    : IRequest<ReassignProducerPreviewDto>;

public record ReassignProducerPreviewDto(
    Guid FromProducerId, string FromProducerName,
    Guid ToProducerId,   string ToProducerName,
    int PolicyCount,
    int DistinctCustomerCount,
    int PendingCommissionTransactionCount,
    decimal PendingCommissionTotal,
    int PendingCommissionRunLineCount,
    string Currency);

public class ReassignProducerPreviewHandler
    : IRequestHandler<ReassignProducerPreviewQuery, ReassignProducerPreviewDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ReassignProducerPreviewHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db; _current = current;
    }

    public async Task<ReassignProducerPreviewDto> Handle(ReassignProducerPreviewQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (q.FromProducerId == q.ToProducerId)
            throw new AppException("reassign_same",
                "Ο πηγαίος και ο νέος συνεργάτης δεν μπορούν να είναι ο ίδιος.", 400);

        var from = await _db.Producers.FirstOrDefaultAsync(p => p.Id == q.FromProducerId && p.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Πηγαίος συνεργάτης");
        var to = await _db.Producers.FirstOrDefaultAsync(p => p.Id == q.ToProducerId && p.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Νέος συνεργάτης");
        if (to.Status != ProducerStatus.Active)
            throw new AppException("target_not_active",
                "Ο νέος συνεργάτης πρέπει να είναι Ενεργός για να δεχτεί συμβόλαια.", 400);

        var policyCount = await _db.Policies
            .Where(p => p.ProducerId == q.FromProducerId && p.TenantId == tenantId && p.DeletedAt == null)
            .CountAsync(ct);

        var customerCount = await _db.Policies
            .Where(p => p.ProducerId == q.FromProducerId && p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => p.CustomerId).Distinct().CountAsync(ct);

        var pendingTxs = await _db.CommissionTransactions
            .Where(t => t.ProducerId == q.FromProducerId
                     && t.TenantId == tenantId
                     && t.DeletedAt == null
                     && t.Status == CommissionTransactionStatus.Pending)
            .ToListAsync(ct);

        var pendingRunLines = await _db.CommissionRunLines
            .Include(l => l.CommissionRun)
            .Where(l => l.ProducerId == q.FromProducerId
                     && l.TenantId == tenantId
                     && l.DeletedAt == null
                     && l.CommissionRun.Status == CommissionRunStatus.Draft)
            .CountAsync(ct);

        return new ReassignProducerPreviewDto(
            from.Id, from.Name, to.Id, to.Name,
            policyCount, customerCount,
            pendingTxs.Count,
            pendingTxs.Sum(t => t.Amount),
            pendingRunLines,
            pendingTxs.Select(t => t.Currency).FirstOrDefault() ?? "EUR");
    }
}

public record ReassignProducerCommand(Guid FromProducerId, Guid ToProducerId, string? Reason)
    : IRequest<ReassignProducerResultDto>;

public record ReassignProducerResultDto(
    int PoliciesMoved,
    int PendingCommissionsMoved,
    int PendingRunLinesMoved);

public class ReassignProducerHandler
    : IRequestHandler<ReassignProducerCommand, ReassignProducerResultDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ReassignProducerHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db; _current = current; _clock = clock;
    }

    public async Task<ReassignProducerResultDto> Handle(ReassignProducerCommand cmd, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (cmd.FromProducerId == cmd.ToProducerId)
            throw new AppException("reassign_same", "Ίδιος συνεργάτης πηγή και προορισμός.", 400);

        var from = await _db.Producers.FirstOrDefaultAsync(p => p.Id == cmd.FromProducerId && p.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Πηγαίος συνεργάτης");
        var to = await _db.Producers.FirstOrDefaultAsync(p => p.Id == cmd.ToProducerId && p.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Νέος συνεργάτης");
        if (to.Status != ProducerStatus.Active)
            throw new AppException("target_not_active",
                "Ο νέος συνεργάτης πρέπει να είναι Ενεργός.", 400);

        var now = _clock.UtcNow;

        var policies = await _db.Policies
            .Where(p => p.ProducerId == cmd.FromProducerId && p.TenantId == tenantId && p.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var p in policies)
        {
            p.ProducerId = to.Id;
            p.UpdatedAt = now;
        }

        var pendingTxs = await _db.CommissionTransactions
            .Where(t => t.ProducerId == cmd.FromProducerId
                     && t.TenantId == tenantId
                     && t.DeletedAt == null
                     && t.Status == CommissionTransactionStatus.Pending)
            .ToListAsync(ct);
        foreach (var t in pendingTxs)
        {
            t.ProducerId = to.Id;
            t.UpdatedAt = now;
        }

        var pendingLines = await _db.CommissionRunLines
            .Include(l => l.CommissionRun)
            .Where(l => l.ProducerId == cmd.FromProducerId
                     && l.TenantId == tenantId
                     && l.DeletedAt == null
                     && l.CommissionRun.Status == CommissionRunStatus.Draft)
            .ToListAsync(ct);
        foreach (var l in pendingLines)
        {
            l.ProducerId = to.Id;
            l.UpdatedAt = now;
        }

        // Notify all AgencyAdmin users — a bulk reassignment is a major event.
        var admins = await _db.Users
            .Where(u => u.TenantId == tenantId && u.Role == Role.AgencyAdmin && u.DeletedAt == null && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync(ct);
        foreach (var adminId in admins)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = adminId,
                Title = $"Μετακίνηση συνεργάτη · {from.Name} → {to.Name}",
                Body = $"{policies.Count} συμβόλαια, {pendingTxs.Count} εκκρεμείς προμήθειες μετακινήθηκαν από τον {from.Name} ({from.Code}) στον {to.Name} ({to.Code}).",
                Category = "ProducerReassignment",
                Link = $"/app/producers",
                CreatedAt = now
            });
        }

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            TenantId = tenantId,
            UserId = _current.UserId,
            EntityName = "Producer",
            EntityId = from.Id.ToString("N"),
            Action = "ProducerReassigned",
            Category = "Admin",
            Target = $"{from.Name} ({from.Code}) → {to.Name} ({to.Code})",
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                fromProducerId = from.Id,
                toProducerId = to.Id,
                policiesMoved = policies.Count,
                pendingTxsMoved = pendingTxs.Count,
                pendingLinesMoved = pendingLines.Count,
                reason = cmd.Reason
            })
        });

        await _db.SaveChangesAsync(ct);

        return new ReassignProducerResultDto(policies.Count, pendingTxs.Count, pendingLines.Count);
    }
}
