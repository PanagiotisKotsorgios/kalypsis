using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

public record GetAgencyProductionTrendQuery(DateOnly From, DateOnly To) : IRequest<IReadOnlyList<SeriesPoint>>;

public class GetAgencyProductionTrendQueryHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<GetAgencyProductionTrendQuery, IReadOnlyList<SeriesPoint>>
{
    public async Task<IReadOnlyList<SeriesPoint>> Handle(GetAgencyProductionTrendQuery request, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var firstMonth = new DateOnly(request.From.Year, request.From.Month, 1);
        var lastMonth = new DateOnly(request.To.Year, request.To.Month, 1);
        var count = (lastMonth.Year - firstMonth.Year) * 12 + lastMonth.Month - firstMonth.Month + 1;
        if (request.From == default || request.To == default || request.From > request.To || count > 120)
            throw AppException.Validation("Επιλέξτε έγκυρη περίοδο έως 120 μήνες, με την ημερομηνία «Από» πριν από την «Έως».");

        // Keep office query filters and aggregate on the server in one query.
        var totals = await db.Policies.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.Status != PolicyStatus.Cancelled && p.Status != PolicyStatus.Prospect
                && p.StartDate >= request.From && p.StartDate <= request.To)
            .GroupBy(p => new { p.StartDate.Year, p.StartDate.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Total = g.Sum(p => p.Premium) })
            .ToListAsync(ct);
        var byMonth = totals.ToDictionary(x => (x.Year, x.Month), x => x.Total);
        // Zero means a queried month without production, not a forecast.
        // Partial boundary months respect the exact selected days.
        return Enumerable.Range(0, count).Select(index =>
        {
            var month = firstMonth.AddMonths(index);
            return new SeriesPoint(month.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                byMonth.GetValueOrDefault((month.Year, month.Month)));
        }).ToList();
    }
}
