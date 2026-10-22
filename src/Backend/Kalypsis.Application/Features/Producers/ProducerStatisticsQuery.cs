using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerStatisticOption(string Value, string Label);
public record ProducerMonthlyStatistic(string Month, int Policies, decimal Premium, decimal RecordedCommissions);
public record ProducerStatisticGroup(string Key, string Name, int Policies, decimal Premium);
public record ProducerStatisticsDto(Guid ProducerId, DateOnly From, DateOnly To, string DateField, string Currency,
    IReadOnlyList<string> Currencies, IReadOnlyList<ProducerStatisticOption> Carriers,
    int TotalPolicies, int ActivePolicies, int RenewedPolicies, int CancelledPolicies, int Customers, int Claims,
    decimal Premium, decimal? NetPremium, decimal RecordedCommissions,
    IReadOnlyList<ProducerMonthlyStatistic> Monthly, IReadOnlyList<ProducerStatisticGroup> ByCarrier,
    IReadOnlyList<ProducerStatisticGroup> ByType, IReadOnlyList<ProducerStatisticGroup> ByStatus);
public record GetProducerStatisticsQuery(Guid ProducerId, DateOnly From, DateOnly To, string DateField = "start",
    string? Currency = null, Guid? InsuranceCompanyId = null, PolicyType? PolicyType = null) : IRequest<ProducerStatisticsDto>;

public sealed class GetProducerStatisticsHandler(IAppDbContext db, ICurrentUser current) : IRequestHandler<GetProducerStatisticsQuery, ProducerStatisticsDto>
{
    public async Task<ProducerStatisticsDto> Handle(GetProducerStatisticsQuery request, CancellationToken ct)
    {
        if (request.From.Year < 1900 || request.To.Year > 9998 || request.To < request.From || request.To.DayNumber - request.From.DayNumber > 366 * 20)
            throw AppException.Validation("Επιλέξτε έγκυρη περίοδο έως 20 έτη, με την ημερομηνία Από πριν από την Έως.");
        if (request.DateField is not ("start" or "issued" or "created")) throw AppException.Validation("Επιλέξτε πεδίο ημερομηνίας.");
        if (request.PolicyType.HasValue && !Enum.IsDefined(request.PolicyType.Value)) throw AppException.Validation("Μη έγκυρος κλάδος.");
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var producer = await db.Producers.AsNoTracking().FirstOrDefaultAsync(row => row.Id == request.ProducerId && row.TenantId == tenant && row.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
        var all = await db.Policies.AsNoTracking()
            .Where(row => row.ProducerId == producer.Id && row.TenantId == tenant && row.DeletedAt == null
                && producer.Status != ProducerStatus.Prospect && row.Status != PolicyStatus.Prospect && row.Status != PolicyStatus.Draft
                && row.Customer.Status != CustomerStatus.Prospect)
            .Select(row => new { row.Id, row.CustomerId, row.InsuranceCompanyId,
                Company = row.InsuranceCompany != null ? row.InsuranceCompany.Name : "Δεν έχει οριστεί", row.PolicyType, row.Status,
                row.StartDate, row.IssuedAt, row.CreatedAt, row.RenewedFromPolicyId, row.Premium, row.NetPremium, row.Currency })
            .ToListAsync(ct);
        static string Code(string? value) => string.IsNullOrWhiteSpace(value) ? "EUR" : value.Trim().ToUpperInvariant();
        var currencies = all.Select(row => Code(row.Currency)).Distinct().OrderBy(value => value).ToArray();
        var currency = string.IsNullOrWhiteSpace(request.Currency) ? currencies.Contains("EUR") ? "EUR" : currencies.FirstOrDefault() ?? "EUR" : Code(request.Currency);
        if (currency.Length != 3 || currency.Any(character => character is < 'A' or > 'Z')) throw AppException.Validation("Επιλέξτε έγκυρο νόμισμα.");
        var rows = all.Select(row => new { Policy = row, Date = request.DateField switch { "issued" => row.IssuedAt, "created" => DateOnly.FromDateTime(row.CreatedAt), _ => (DateOnly?)row.StartDate } })
            .Where(row => row.Date.HasValue && row.Date >= request.From && row.Date <= request.To && Code(row.Policy.Currency) == currency
                && (!request.InsuranceCompanyId.HasValue || row.Policy.InsuranceCompanyId == request.InsuranceCompanyId)
                && (!request.PolicyType.HasValue || row.Policy.PolicyType == request.PolicyType)).ToList();
        var eligible = rows.Where(row => row.Policy.Status != PolicyStatus.Cancelled).ToList();
        var eligibleIds = eligible.Select(row => row.Policy.Id).ToArray();
        var ids = rows.Select(row => row.Policy.Id).ToArray();
        var splits = await db.PolicyCommissionSplits.AsNoTracking().Where(row => row.TenantId == tenant && row.DeletedAt == null
            && row.ProducerId == producer.Id && row.HierarchyLevel != HierarchyLevel.Agency && eligibleIds.Contains(row.PolicyId))
            .Select(row => new { row.PolicyId, row.GrossAmount, row.Currency }).ToListAsync(ct);
        var commission = splits.Where(row => Code(row.Currency) == currency).GroupBy(row => row.PolicyId).ToDictionary(group => group.Key, group => group.Sum(row => row.GrossAmount));
        var claims = await db.Claims.CountAsync(row => row.TenantId == tenant && row.DeletedAt == null && ids.Contains(row.PolicyId), ct);
        var monthly = new List<ProducerMonthlyStatistic>();
        for (var month = new DateOnly(request.From.Year, request.From.Month, 1); month <= request.To; month = month.AddMonths(1))
        {
            var group = rows.Where(row => row.Date!.Value.Year == month.Year && row.Date.Value.Month == month.Month).ToArray();
            monthly.Add(new(month.ToString("yyyy-MM"), group.Length, group.Where(row => row.Policy.Status != PolicyStatus.Cancelled).Sum(row => row.Policy.Premium),
                group.Sum(row => commission.GetValueOrDefault(row.Policy.Id))));
        }
        return new(producer.Id, request.From, request.To, request.DateField, currency, currencies,
            all.GroupBy(row => row.InsuranceCompanyId).Select(group => new ProducerStatisticOption(group.Key.ToString(), group.First().Company)).OrderBy(row => row.Label).ToArray(),
            rows.Count, rows.Count(row => row.Policy.Status == PolicyStatus.Active), rows.Count(row => row.Policy.RenewedFromPolicyId.HasValue),
            rows.Count(row => row.Policy.Status == PolicyStatus.Cancelled), rows.Select(row => row.Policy.CustomerId).Distinct().Count(), claims,
            eligible.Sum(row => row.Policy.Premium), eligible.Any(row => !row.Policy.NetPremium.HasValue) ? null : eligible.Sum(row => row.Policy.NetPremium ?? 0), commission.Values.Sum(), monthly,
            rows.GroupBy(row => row.Policy.InsuranceCompanyId).Select(group => new ProducerStatisticGroup(group.Key.ToString(), group.First().Policy.Company, group.Count(), group.Where(row => row.Policy.Status != PolicyStatus.Cancelled).Sum(row => row.Policy.Premium))).OrderByDescending(row => row.Premium).ToArray(),
            rows.GroupBy(row => row.Policy.PolicyType).Select(group => new ProducerStatisticGroup(group.Key.ToString(), group.Key.ToString(), group.Count(), group.Where(row => row.Policy.Status != PolicyStatus.Cancelled).Sum(row => row.Policy.Premium))).OrderByDescending(row => row.Premium).ToArray(),
            rows.GroupBy(row => row.Policy.Status).Select(group => new ProducerStatisticGroup(group.Key.ToString(), group.Key.ToString(), group.Count(), group.Where(row => row.Policy.Status != PolicyStatus.Cancelled).Sum(row => row.Policy.Premium))).ToArray());
    }
}
