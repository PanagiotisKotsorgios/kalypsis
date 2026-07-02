using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Premium;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reconciliation;

// ============================================================================
// Producer reconciliation MVP. The producer (logged in via the portal) submits
// the commission amount they expected for a given policy. We compare against
// the most recent CommissionRunLine the agency recorded for that producer×policy
// and write a Notification to the agency admins if the numbers diverge.
//
// Available to every agency (previously gated by producer-reconciliation).
// ============================================================================

public record ProducerDeclarationDto(
    Guid Id,
    Guid PolicyId,
    string PolicyNumber,
    Guid ProducerId,
    string ProducerName,
    decimal ExpectedAmount,
    decimal? ExpectedPercent,
    decimal? RecordedAmount,
    decimal? DifferenceAmount,
    string ReconciliationStatus,
    string Currency,
    string? Notes,
    DateTime DeclaredAt);

public record CreateProducerDeclarationBody(
    Guid PolicyId,
    decimal ExpectedAmount,
    decimal? ExpectedPercent,
    string? Notes,
    string Currency = "EUR");

// ===== Producer-side: submit a declaration ==================================

public record CreateMyDeclarationCommand(CreateProducerDeclarationBody Body) : IRequest<ProducerDeclarationDto>;

public class CreateMyDeclarationHandler : IRequestHandler<CreateMyDeclarationCommand, ProducerDeclarationDto>
{
    private const decimal LargeDiffThreshold = 0.50m; // EUR — anything above this is "flagged"
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CreateMyDeclarationHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerDeclarationDto> Handle(CreateMyDeclarationCommand cmd, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var b = cmd.Body;
        if (b.ExpectedAmount < 0) throw new AppException("amount_invalid", "Το ποσό δεν μπορεί να είναι αρνητικό.", 400);

        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) throw AppException.NotFound("Producer");

        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Id == b.PolicyId
                                                                  && p.TenantId == tenantId
                                                                  && p.ProducerId == producerId, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var recorded = await _db.CommissionRunLines
            .Where(l => l.ProducerId == producerId && l.PolicyId == b.PolicyId && !l.IsOverCommission)
            .OrderByDescending(l => l.CommissionRun.Year)
            .ThenByDescending(l => l.CommissionRun.Month)
            .Select(l => (decimal?)l.CommissionAmount)
            .FirstOrDefaultAsync(ct);

        var diff = recorded.HasValue ? recorded.Value - b.ExpectedAmount : (decimal?)null;
        var status = ComputeStatus(recorded, b.ExpectedAmount);

        var declaration = new ProducerCommissionDeclaration
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProducerId = producerId.Value,
            PolicyId = policy.Id,
            ExpectedAmount = b.ExpectedAmount,
            ExpectedPercent = b.ExpectedPercent,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency,
            Notes = b.Notes,
            DeclaredAt = DateTime.UtcNow,
            RecordedAmount = recorded,
            DifferenceAmount = diff,
            ReconciliationStatus = status,
            CreatedAt = DateTime.UtcNow
        };
        _db.ProducerCommissionDeclarations.Add(declaration);

        // If there's a flag-worthy gap, notify all AgencyAdmin users of the tenant.
        if (status is "diff_large" or "missing")
        {
            var producerName = await _db.Producers.Where(p => p.Id == producerId).Select(p => p.Name).FirstOrDefaultAsync(ct) ?? "Συνεργάτης";
            var admins = await _db.Users.Where(u => u.TenantId == tenantId && u.Role == Role.AgencyAdmin && u.DeletedAt == null).Select(u => u.Id).ToListAsync(ct);
            var diffPct = recorded.HasValue && recorded.Value != 0
                ? Math.Abs((recorded.Value - b.ExpectedAmount) / recorded.Value) * 100m
                : (decimal?)null;
            var body = status == "missing"
                ? $"Ο συνεργάτης {producerName} δηλώνει αναμενόμενη προμήθεια {b.ExpectedAmount:0.00} {declaration.Currency} για το συμβόλαιο {policy.PolicyNumber}, αλλά δεν υπάρχει καταχωρημένη εκκαθάριση στο σύστημα."
                : $"Διαφορά προμήθειας για το συμβόλαιο {policy.PolicyNumber}. Καταχωρημένο: {recorded:0.00} · Δηλωμένο: {b.ExpectedAmount:0.00} {declaration.Currency} · Διαφορά: {diff:0.00}{(diffPct.HasValue ? $" ({diffPct:0.0}%)" : "")}. Παρακαλώ ελέγξτε τη σύμβαση.";
            foreach (var adminUserId in admins)
            {
                _db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = adminUserId,
                    Title = $"Έλεγχος προμήθειας · {policy.PolicyNumber}",
                    Body = body,
                    Category = "ProducerReconciliation",
                    Link = $"/app/producers",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var producerNameOut = await _db.Producers.Where(p => p.Id == producerId).Select(p => p.Name).FirstOrDefaultAsync(ct) ?? "";
        return new ProducerDeclarationDto(
            declaration.Id, policy.Id, policy.PolicyNumber, producerId.Value, producerNameOut,
            declaration.ExpectedAmount, declaration.ExpectedPercent, declaration.RecordedAmount,
            declaration.DifferenceAmount, declaration.ReconciliationStatus, declaration.Currency,
            declaration.Notes, declaration.DeclaredAt);
    }

    private static string ComputeStatus(decimal? recorded, decimal expected)
    {
        if (!recorded.HasValue) return "missing";
        var diff = Math.Abs(recorded.Value - expected);
        if (diff < 0.01m) return "match";
        if (diff < LargeDiffThreshold) return "diff_small";
        return "diff_large";
    }
}

// ===== Producer-side: list my declarations ===================================

public record ListMyDeclarationsQuery() : IRequest<IReadOnlyList<ProducerDeclarationDto>>;

public class ListMyDeclarationsHandler : IRequestHandler<ListMyDeclarationsQuery, IReadOnlyList<ProducerDeclarationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListMyDeclarationsHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ProducerDeclarationDto>> Handle(ListMyDeclarationsQuery _, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) return Array.Empty<ProducerDeclarationDto>();

        var rows = await _db.ProducerCommissionDeclarations
            .Include(d => d.Policy)
            .Include(d => d.Producer)
            .Where(d => d.ProducerId == producerId && d.DeletedAt == null)
            .OrderByDescending(d => d.DeclaredAt)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    private static ProducerDeclarationDto Map(ProducerCommissionDeclaration d) => new(
        d.Id, d.PolicyId, d.Policy?.PolicyNumber ?? "", d.ProducerId, d.Producer?.Name ?? "",
        d.ExpectedAmount, d.ExpectedPercent, d.RecordedAmount, d.DifferenceAmount,
        d.ReconciliationStatus, d.Currency, d.Notes, d.DeclaredAt);
}

// ===== Agency-side: list declarations (optionally filtered by producer) ====

public record ListAgencyDeclarationsQuery(Guid? ProducerId) : IRequest<IReadOnlyList<ProducerDeclarationDto>>;

public class ListAgencyDeclarationsHandler : IRequestHandler<ListAgencyDeclarationsQuery, IReadOnlyList<ProducerDeclarationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListAgencyDeclarationsHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ProducerDeclarationDto>> Handle(ListAgencyDeclarationsQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        try
        {
            var q = _db.ProducerCommissionDeclarations
                .Include(d => d.Policy)
                .Include(d => d.Producer)
                .Where(d => d.TenantId == tenantId && d.DeletedAt == null);
            if (r.ProducerId.HasValue) q = q.Where(d => d.ProducerId == r.ProducerId);

            var rows = await q.OrderByDescending(d => d.DeclaredAt).Take(500).ToListAsync(ct);

            return rows.Select(d => new ProducerDeclarationDto(
                d.Id, d.PolicyId, d.Policy?.PolicyNumber ?? "", d.ProducerId, d.Producer?.Name ?? "",
                d.ExpectedAmount, d.ExpectedPercent, d.RecordedAmount, d.DifferenceAmount,
                d.ReconciliationStatus, d.Currency, d.Notes, d.DeclaredAt)).ToList();
        }
        catch
        {
            // If the paired migration hasn't applied yet the table can be
            // missing on a partial deploy — treat as "no declarations" so the
            // page renders instead of the frontend flashing a red error.
            // The schema safety net will create it on the next boot.
            return Array.Empty<ProducerDeclarationDto>();
        }
    }
}
