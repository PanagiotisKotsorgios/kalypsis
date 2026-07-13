using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Reports;

/// <summary>
/// One row of the production report, keyed by whatever dimension the caller
/// grouped on (month / carrier / producer / branch). Money fields are in the
/// tenant's default currency — we deliberately don't mix currencies in the
/// aggregate because premium-vs-commission arithmetic in the UI would need
/// FX conversion to make sense.
/// </summary>
public record ProductionReportRow(
    string GroupKey,
    string GroupLabel,
    int PolicyCount,
    int NewCount,
    int RenewalCount,
    decimal GrossPremium,
    decimal NetPremium,
    decimal AgencyCommission,
    decimal ProducerCommission);

public record ProductionReportDto(
    IReadOnlyList<ProductionReportRow> Rows,
    ProductionReportRow Totals,
    string GroupBy,
    DateOnly? From,
    DateOnly? To);

public record GetProductionReportQuery(
    DateOnly? From,
    DateOnly? To,
    Guid? CarrierId,
    Guid? ProducerId,
    PolicyType? PolicyType,
    string GroupBy,
    bool IncludeCancelled
) : IRequest<ProductionReportDto>;

public class GetProductionReportQueryHandler
    : IRequestHandler<GetProductionReportQuery, ProductionReportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public GetProductionReportQueryHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ProductionReportDto> Handle(GetProductionReportQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Default window: current calendar year — matches how offices
        // request "ετήσια παραγωγή" in day-to-day speech.
        var today = DateOnly.FromDateTime(_clock.UtcNow.Date);
        var from = request.From ?? new DateOnly(today.Year, 1, 1);
        var to = request.To ?? new DateOnly(today.Year, 12, 31);

        // Base query — the office's own policies, using StartDate as the
        // "production date" (when the cover begins), which is the reading
        // Greek brokerages default to for annual production reports. We
        // exclude Draft rows (they are not yet issued) and, unless asked,
        // Cancelled rows too — those distort the totals.
        var policies = _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.Status != PolicyStatus.Draft
                && p.StartDate >= from && p.StartDate <= to);

        if (!request.IncludeCancelled)
            policies = policies.Where(p => p.Status != PolicyStatus.Cancelled);
        if (request.CarrierId is Guid cid)
            policies = policies.Where(p => p.InsuranceCompanyId == cid);
        if (request.ProducerId is Guid pid)
            policies = policies.Where(p => p.ProducerId == pid);
        if (request.PolicyType is PolicyType pt)
            policies = policies.Where(p => p.PolicyType == pt);

        // Pull the flat detail rows in one round-trip and aggregate in
        // memory. Grouping by string keys on the server via EF's translation
        // of DateOnly formatting is fragile across providers — safer to do
        // it here where the tenant's row count is bounded (typical office:
        // low thousands per year).
        var carrierNames = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var producerNames = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .ToDictionaryAsync(p => p.Id, p => p.Name, ct);

        var flat = await policies
            .Select(p => new {
                p.Id, p.PolicyNumber,
                p.StartDate,
                p.InsuranceCompanyId,
                p.ProducerId,
                p.PolicyType,
                p.Premium,
                NetPremium = p.NetPremium ?? p.Premium,
                IsRenewal = p.RenewedFromPolicyId != null,
            })
            .ToListAsync(ct);

        // Commission splits for the same window — grouped by policy so we
        // can attribute the agency vs producer share back to each policy row
        // during aggregation. Producer commission = sum of every non-Agency
        // level (Producer / Manager / Unit / Assistant).
        var policyIds = flat.Select(f => f.Id).ToList();
        var splits = policyIds.Count == 0
            ? new Dictionary<Guid, (decimal agency, decimal producer)>()
            : (await _db.PolicyCommissionSplits.IgnoreQueryFilters()
                .Where(s => s.TenantId == tenantId && s.DeletedAt == null && policyIds.Contains(s.PolicyId))
                .Select(s => new { s.PolicyId, s.HierarchyLevel, s.GrossAmount })
                .ToListAsync(ct))
              .GroupBy(x => x.PolicyId)
              .ToDictionary(
                g => g.Key,
                g => (
                    agency: g.Where(x => x.HierarchyLevel == HierarchyLevel.Agency).Sum(x => x.GrossAmount),
                    producer: g.Where(x => x.HierarchyLevel != HierarchyLevel.Agency).Sum(x => x.GrossAmount)));

        // Group into report rows. The label formatter varies per dimension
        // — months as "yyyy-MM", carriers/producers by resolved name.
        var enriched = flat.Select(f => new {
            f,
            Agency = splits.TryGetValue(f.Id, out var s) ? s.agency : 0m,
            Producer = splits.TryGetValue(f.Id, out var s2) ? s2.producer : 0m,
        }).ToList();

        IEnumerable<IGrouping<(string key, string label), (dynamic row, decimal agency, decimal producer)>> groups;
        var groupBy = (request.GroupBy ?? "month").ToLowerInvariant();
        switch (groupBy)
        {
            case "carrier":
                groups = enriched
                    .Select(x => (row: (dynamic)x.f, agency: x.Agency, producer: x.Producer,
                        key: x.f.InsuranceCompanyId.ToString(),
                        label: carrierNames.TryGetValue(x.f.InsuranceCompanyId, out var n) ? n : "—"))
                    .GroupBy(x => (x.key, x.label), x => (x.row, x.agency, x.producer));
                break;
            case "producer":
                groups = enriched
                    .Select(x => {
                        var key = (x.f.ProducerId ?? Guid.Empty).ToString();
                        var label = x.f.ProducerId is Guid pid2 && producerNames.TryGetValue(pid2, out var pn)
                            ? pn : "Χωρίς συνεργάτη";
                        return (row: (dynamic)x.f, agency: x.Agency, producer: x.Producer, key, label);
                    })
                    .GroupBy(x => (x.key, x.label), x => (x.row, x.agency, x.producer));
                break;
            case "branch":
                groups = enriched
                    .Select(x => (row: (dynamic)x.f, agency: x.Agency, producer: x.Producer,
                        key: x.f.PolicyType.ToString(),
                        label: x.f.PolicyType.ToString()))
                    .GroupBy(x => (x.key, x.label), x => (x.row, x.agency, x.producer));
                break;
            default: // month
                groups = enriched
                    .Select(x => {
                        var key = x.f.StartDate.ToString("yyyy-MM");
                        return (row: (dynamic)x.f, agency: x.Agency, producer: x.Producer, key, label: key);
                    })
                    .GroupBy(x => (x.key, x.label), x => (x.row, x.agency, x.producer));
                break;
        }

        var rows = groups
            .Select(g => new ProductionReportRow(
                g.Key.key,
                g.Key.label,
                PolicyCount:       g.Count(),
                NewCount:          g.Count(x => !(bool)x.row.IsRenewal),
                RenewalCount:      g.Count(x =>  (bool)x.row.IsRenewal),
                GrossPremium:      g.Sum(x => (decimal)x.row.Premium),
                NetPremium:        g.Sum(x => (decimal)x.row.NetPremium),
                AgencyCommission:  g.Sum(x => x.agency),
                ProducerCommission:g.Sum(x => x.producer)))
            .OrderBy(r => r.GroupKey)
            .ToList();

        var totals = new ProductionReportRow(
            GroupKey: "TOTAL",
            GroupLabel: "Σύνολο",
            PolicyCount:       rows.Sum(r => r.PolicyCount),
            NewCount:          rows.Sum(r => r.NewCount),
            RenewalCount:      rows.Sum(r => r.RenewalCount),
            GrossPremium:      rows.Sum(r => r.GrossPremium),
            NetPremium:        rows.Sum(r => r.NetPremium),
            AgencyCommission:  rows.Sum(r => r.AgencyCommission),
            ProducerCommission:rows.Sum(r => r.ProducerCommission));

        return new ProductionReportDto(rows, totals, groupBy, from, to);
    }
}
