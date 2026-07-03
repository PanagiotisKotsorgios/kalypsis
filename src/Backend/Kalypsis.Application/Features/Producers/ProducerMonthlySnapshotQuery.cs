using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

/// <summary>
/// One-shot KPI snapshot the office can inspect on-screen or email straight
/// to the producer. Returns the numbers for a specific year/month, plus the
/// same numbers for the prior month so the UI/email can render deltas.
/// </summary>
public record ProducerMonthlySnapshotDto(
    Guid ProducerId, string ProducerName,
    int Year, int Month,
    int PoliciesWritten,   decimal PremiumWritten,   decimal CommissionEarned,
    int PoliciesPriorMonth, decimal PremiumPriorMonth, decimal CommissionPriorMonth,
    int RenewalsDue,        int CustomersCovered);

public record GetProducerMonthlySnapshotQuery(Guid ProducerId, int Year, int Month)
    : IRequest<ProducerMonthlySnapshotDto>;

public class GetProducerMonthlySnapshotQueryHandler
    : IRequestHandler<GetProducerMonthlySnapshotQuery, ProducerMonthlySnapshotDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetProducerMonthlySnapshotQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerMonthlySnapshotDto> Handle(GetProducerMonthlySnapshotQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producer = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == r.ProducerId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");

        var firstDay = new DateOnly(r.Year, r.Month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);
        var priorFirst = firstDay.AddMonths(-1);
        var priorLast = firstDay.AddDays(-1);
        var nextMonthEnd = firstDay.AddMonths(1).AddDays(-1);   // for the RenewalsDue lookahead

        // Current-month writeout.
        var currentMonthPolicies = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.ProducerId == r.ProducerId
                        && p.Status != PolicyStatus.Cancelled
                        && p.Status != PolicyStatus.Draft
                        && p.StartDate >= firstDay && p.StartDate <= lastDay)
            .Select(p => new { p.Premium })
            .ToListAsync(ct);
        var priorMonthPolicies = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.ProducerId == r.ProducerId
                        && p.Status != PolicyStatus.Cancelled
                        && p.Status != PolicyStatus.Draft
                        && p.StartDate >= priorFirst && p.StartDate <= priorLast)
            .Select(p => new { p.Premium })
            .ToListAsync(ct);

        decimal commissionMonth = 0m, commissionPrior = 0m;
        try
        {
            commissionMonth = await _db.CommissionRunLines
                .Where(l => l.TenantId == tenantId && l.DeletedAt == null
                            && l.ProducerId == r.ProducerId)
                .Join(_db.CommissionRuns, l => l.CommissionRunId, run => run.Id, (l, run) => new { l, run })
                .Where(x => x.run.Year == r.Year && x.run.Month == r.Month)
                .SumAsync(x => (decimal?)x.l.CommissionAmount, ct) ?? 0m;
            commissionPrior = await _db.CommissionRunLines
                .Where(l => l.TenantId == tenantId && l.DeletedAt == null
                            && l.ProducerId == r.ProducerId)
                .Join(_db.CommissionRuns, l => l.CommissionRunId, run => run.Id, (l, run) => new { l, run })
                .Where(x => x.run.Year == priorFirst.Year && x.run.Month == priorFirst.Month)
                .SumAsync(x => (decimal?)x.l.CommissionAmount, ct) ?? 0m;
        }
        catch { /* commission_runs table may be absent on a fresh install */ }

        // Renewals due in the CURRENT month (helpful in the snapshot even
        // though EndDate could be a prior month — filter to «next 30 days»
        // from today to keep the number actionable for the producer.).
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thirtyDaysOut = today.AddDays(30);
        var renewalsDue = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.ProducerId == r.ProducerId
                        && p.Status == PolicyStatus.Active
                        && p.EndDate >= today && p.EndDate <= thirtyDaysOut)
            .CountAsync(ct);

        var customersCovered = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.ProducerId == r.ProducerId
                        && (p.Status == PolicyStatus.Active || p.Status == PolicyStatus.PendingRenewal))
            .Select(p => p.CustomerId).Distinct().CountAsync(ct);

        return new ProducerMonthlySnapshotDto(
            producer.Id, producer.Name,
            r.Year, r.Month,
            currentMonthPolicies.Count, currentMonthPolicies.Sum(x => x.Premium), commissionMonth,
            priorMonthPolicies.Count,   priorMonthPolicies.Sum(x => x.Premium),   commissionPrior,
            renewalsDue, customersCovered);
    }
}
