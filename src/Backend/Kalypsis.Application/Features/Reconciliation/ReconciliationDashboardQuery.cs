using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reconciliation;

// ============================================================================
// Reconciliation dashboard — monthly grand totals of policy premium billed,
// receipts collected, and commissions earned, plus the outstanding gap. Used
// by AgencyAdmin to spot months where collections lag behind billed premium
// or where commissions look off relative to what was written.
// ============================================================================

public record MonthlyReconciliationRow(
    int Year, int Month,
    decimal PolicyPremiumBilled,   // Σ Policy.Premium for policies STARTING this month
    decimal ReceiptsCollected,     // Σ Receipt.Amount RECEIVED this month
    decimal CommissionsPaidToProducers, // Σ CommissionRunLine.CommissionAmount finalised this month
    decimal Outstanding,           // PolicyPremiumBilled − ReceiptsCollected
    int PolicyCount,
    int ReceiptCount);

public record ReconciliationDashboardDto(
    int Year,
    decimal YearPremiumBilled,
    decimal YearReceiptsCollected,
    decimal YearCommissionsPaid,
    decimal YearOutstanding,
    IReadOnlyList<MonthlyReconciliationRow> Months);

public record GetReconciliationDashboardQuery(int Year)
    : IRequest<ReconciliationDashboardDto>;

public class GetReconciliationDashboardQueryHandler
    : IRequestHandler<GetReconciliationDashboardQuery, ReconciliationDashboardDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetReconciliationDashboardQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ReconciliationDashboardDto> Handle(GetReconciliationDashboardQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var first = new DateOnly(r.Year, 1, 1);
        var last  = new DateOnly(r.Year, 12, 31);

        // Policy premium billed, grouped by StartDate month. Keeping this
        // client-side after a single fetch since 12k policies × 12 months
        // is way cheaper than a per-month roundtrip.
        var policyRows = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.StartDate >= first && p.StartDate <= last)
            .Select(p => new { p.StartDate, p.Premium })
            .ToListAsync(ct);

        var receiptRows = await _db.Receipts
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null
                        && x.ReceivedOn >= first && x.ReceivedOn <= last)
            .Select(x => new { x.ReceivedOn, x.Amount })
            .ToListAsync(ct);

        // Commission lines finalised this month — use CommissionRun.FinalisedAt
        // as the date so unpaid drafts don't inflate the numbers.
        List<(DateOnly When, decimal Amount)> commissionRows = new();
        try
        {
            commissionRows = await (from l in _db.CommissionRunLines
                                    join run in _db.CommissionRuns on l.CommissionRunId equals run.Id
                                    where l.TenantId == tenantId && l.DeletedAt == null
                                          && run.FinalisedAt.HasValue
                                          && run.FinalisedAt.Value.Year == r.Year
                                    select new { When = DateOnly.FromDateTime(run.FinalisedAt!.Value), l.CommissionAmount })
                .ToListAsync(ct)
                .ContinueWith(t => t.Result.Select(x => (x.When, x.CommissionAmount)).ToList(), ct);
        }
        catch { /* commission_runs might be absent on a bare install */ }

        var months = new List<MonthlyReconciliationRow>(12);
        for (int m = 1; m <= 12; m++)
        {
            var premium = policyRows.Where(p => p.StartDate.Month == m).Sum(p => p.Premium);
            var count = policyRows.Count(p => p.StartDate.Month == m);
            var received = receiptRows.Where(x => x.ReceivedOn.Month == m).Sum(x => x.Amount);
            var receiptCount = receiptRows.Count(x => x.ReceivedOn.Month == m);
            var commission = commissionRows.Where(x => x.When.Month == m).Sum(x => x.Amount);
            months.Add(new MonthlyReconciliationRow(
                r.Year, m, premium, received, commission,
                Outstanding: premium - received,
                PolicyCount: count,
                ReceiptCount: receiptCount));
        }

        return new ReconciliationDashboardDto(
            r.Year,
            YearPremiumBilled: months.Sum(x => x.PolicyPremiumBilled),
            YearReceiptsCollected: months.Sum(x => x.ReceiptsCollected),
            YearCommissionsPaid: months.Sum(x => x.CommissionsPaidToProducers),
            YearOutstanding: months.Sum(x => x.Outstanding),
            Months: months);
    }
}
