using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerSelfSummaryDto(
    Guid ProducerId, string Name, ProducerStatus Status,
    int ActivePolicies, int ProspectPolicies, int ProspectCustomers,
    int PoliciesMtd, int PoliciesYtd,
    decimal PremiumMtd, decimal PremiumYtd,
    decimal ExpectedCommissionThisMonth, decimal ExpectedNetCommissionThisMonth,
    decimal CommissionMtd, decimal CommissionYtd,
    decimal OverCommissionYtd,
    int CustomersServed);

public record GetProducerSelfSummaryQuery() : IRequest<ProducerSelfSummaryDto>;

public class GetProducerSelfSummaryQueryHandler : IRequestHandler<GetProducerSelfSummaryQuery, ProducerSelfSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetProducerSelfSummaryQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerSelfSummaryDto> Handle(GetProducerSelfSummaryQuery _, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) throw AppException.NotFound("Producer");

        var producer = await _db.Producers.FirstOrDefaultAsync(p => p.Id == producerId, ct)
            ?? throw AppException.NotFound("Producer");

        var now = DateTime.UtcNow;
        var monthStart = new DateOnly(now.Year, now.Month, 1);
        var yearStart = new DateOnly(now.Year, 1, 1);
        var today = DateOnly.FromDateTime(now);

        var myPolicies = _db.Policies.Where(p => p.ProducerId == producerId);
        var activeBook = myPolicies.Where(p => p.Status == PolicyStatus.Active);
        var activePolicies = await activeBook.CountAsync(ct);
        var prospectPolicies = await myPolicies.CountAsync(p => p.Status == PolicyStatus.Prospect, ct);
        var prospectCustomers = await myPolicies
            .Where(p => p.Status == PolicyStatus.Prospect)
            .Select(p => p.CustomerId)
            .Distinct()
            .CountAsync(ct);

        var mtdPolicies = await activeBook.Where(p => p.StartDate >= monthStart && p.StartDate <= today).CountAsync(ct);
        var ytdPolicies = await activeBook.Where(p => p.StartDate >= yearStart && p.StartDate <= today).CountAsync(ct);

        var premiumMtd = await activeBook.Where(p => p.StartDate >= monthStart && p.StartDate <= today)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0;
        var premiumYtd = await activeBook.Where(p => p.StartDate >= yearStart && p.StartDate <= today)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0;

        // This is the forward-looking amount for the next commission run,
        // calculated from the current commission matrices of active policies.
        // It is deliberately separate from CommissionMtd, which is the amount
        // already generated in an actual commission run.
        var expectedCommission = await _db.PolicyCommissionSplits
            .Where(s => s.ProducerId == producerId && s.Policy.Status == PolicyStatus.Active)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Gross = g.Sum(x => x.GrossAmount),
                Net = g.Sum(x => x.NetAmount)
            })
            .FirstOrDefaultAsync(ct);
        var expectedCommissionThisMonth = expectedCommission?.Gross ?? 0m;
        var expectedNetCommissionThisMonth = expectedCommission?.Net ?? 0m;

        var commissionLines = _db.CommissionRunLines.Where(l => l.ProducerId == producerId);
        var commissionMtd = await commissionLines
            .Where(l => l.CommissionRun.Year == now.Year && l.CommissionRun.Month == now.Month && !l.IsOverCommission)
            .SumAsync(l => (decimal?)l.CommissionAmount, ct) ?? 0;
        var commissionYtd = await commissionLines
            .Where(l => l.CommissionRun.Year == now.Year && !l.IsOverCommission)
            .SumAsync(l => (decimal?)l.CommissionAmount, ct) ?? 0;
        var overCommissionYtd = await commissionLines
            .Where(l => l.CommissionRun.Year == now.Year && l.IsOverCommission)
            .SumAsync(l => (decimal?)l.CommissionAmount, ct) ?? 0;

        var customersServed = await myPolicies.Select(p => p.CustomerId).Distinct().CountAsync(ct);

        return new ProducerSelfSummaryDto(
            producer.Id, producer.Name, producer.Status,
            activePolicies, prospectPolicies, prospectCustomers, mtdPolicies, ytdPolicies,
            premiumMtd, premiumYtd, expectedCommissionThisMonth, expectedNetCommissionThisMonth,
            commissionMtd, commissionYtd, overCommissionYtd,
            customersServed);
    }
}

public record ProducerRunLineDto(
    Guid RunId, string RunTitle, int Year, int Month, CommissionRunStatus RunStatus,
    Guid LineId, string PolicyNumber, string InsuranceCompanyName,
    PolicyType PolicyType, decimal Premium, decimal RatePercent, decimal CommissionAmount,
    bool IsOverCommission, int OverCommissionLevel, string? OnBehalfOfProducerName);

public record GetProducerSelfCommissionsQuery(int? Year) : IRequest<IReadOnlyList<ProducerRunLineDto>>;

public class GetProducerSelfCommissionsQueryHandler : IRequestHandler<GetProducerSelfCommissionsQuery, IReadOnlyList<ProducerRunLineDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetProducerSelfCommissionsQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ProducerRunLineDto>> Handle(GetProducerSelfCommissionsQuery r, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
        if (producerId is null) return Array.Empty<ProducerRunLineDto>();

        var q = _db.CommissionRunLines
            .Include(l => l.Policy)
            .Include(l => l.InsuranceCompany)
            .Include(l => l.CommissionRun)
            .Include(l => l.OnBehalfOfProducer)
            .Where(l => l.ProducerId == producerId);
        if (r.Year.HasValue) q = q.Where(l => l.CommissionRun.Year == r.Year);

        var rows = await q.OrderByDescending(l => l.CommissionRun.Year)
            .ThenByDescending(l => l.CommissionRun.Month)
            .Take(1000).ToListAsync(ct);

        return rows.Select(l => new ProducerRunLineDto(
            l.CommissionRunId, l.CommissionRun.Title, l.CommissionRun.Year, l.CommissionRun.Month, l.CommissionRun.Status,
            l.Id, l.Policy.PolicyNumber, l.InsuranceCompany.Name, l.PolicyType,
            l.Premium, l.RatePercent, l.CommissionAmount,
            l.IsOverCommission, l.OverCommissionLevel, l.OnBehalfOfProducer?.Name)).ToList();
    }
}

/// <summary>
/// A read-only monthly view for the producer portal. Values are read from the
/// materialised PolicyCommissionSplits that the office's commission rules
/// produced when each policy was saved; this never exposes the office rule,
/// the agency share, or another producer's book.
/// </summary>
public record ProducerSelfProductionRowDto(
    Guid PolicyId,
    string PolicyNumber,
    string CustomerName,
    string InsuranceCompanyName,
    PolicyType PolicyType,
    PolicyStatus Status,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Premium,
    bool HasCommissionEstimate,
    decimal CommissionRatePercent,
    decimal ExpectedGrossCommission,
    decimal TaxWithholding,
    decimal ExpectedNetCommission);

public record ProducerSelfProductionDto(
    int Year,
    int Month,
    int PolicyCount,
    decimal TotalPremium,
    decimal ExpectedGrossCommission,
    decimal TotalTaxWithholding,
    decimal ExpectedNetCommission,
    IReadOnlyList<ProducerSelfProductionRowDto> Rows);

public record GetProducerSelfProductionQuery(
    int? Year,
    int? Month,
    PolicyType? PolicyType,
    PolicyStatus? Status) : IRequest<ProducerSelfProductionDto>;

public class GetProducerSelfProductionQueryHandler
    : IRequestHandler<GetProducerSelfProductionQuery, ProducerSelfProductionDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetProducerSelfProductionQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerSelfProductionDto> Handle(GetProducerSelfProductionQuery request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var year = request.Year ?? now.Year;
        var month = request.Month ?? now.Month;
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
            throw new AppException("producer_production_invalid_period", "Επιλέξτε έγκυρο μήνα και έτος.", 400);

        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerId = await _db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.ProducerId)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Συνεργάτης");

        var periodStart = new DateOnly(year, month, 1);
        var periodEnd = periodStart.AddMonths(1);

        // Prospects are intentionally kept in the normal "Συμβόλαια" area.
        // This is the issued-production list and therefore does not promise a
        // commission for a potential policy.
        var policiesQuery = _db.Policies
            .AsNoTracking()
            .Where(p => p.ProducerId == producerId
                && p.StartDate >= periodStart
                && p.StartDate < periodEnd
                && p.Status != PolicyStatus.Prospect);

        if (request.PolicyType.HasValue)
            policiesQuery = policiesQuery.Where(p => p.PolicyType == request.PolicyType.Value);
        if (request.Status.HasValue)
            policiesQuery = policiesQuery.Where(p => p.Status == request.Status.Value);

        var policies = await policiesQuery
            .OrderByDescending(p => p.StartDate)
            .ThenBy(p => p.PolicyNumber)
            .Select(p => new
            {
                p.Id,
                p.PolicyNumber,
                CustomerName = p.Customer.Type == CustomerType.Company
                    ? p.Customer.CompanyName
                    : (p.Customer.FirstName + " " + p.Customer.LastName).Trim(),
                InsuranceCompanyName = p.InsuranceCompany.Name,
                p.PolicyType,
                p.Status,
                p.StartDate,
                p.EndDate,
                p.Premium,
                p.SpecialCommissionPercent
            })
            .ToListAsync(ct);

        // A policy-level producer percentage is authoritative even when its
        // materialised split was created before the override was entered (or
        // before commission rules existed). Use the tenant withholding rate
        // for this read-side fallback so the producer portal is immediately
        // correct without requiring the office to open every policy drawer.
        var defaultWithholdingPercent = await _db.Tenants
            .Where(t => t.Id == tenantId)
            .Select(t => (decimal?)t.DefaultTaxWithholdingPercent)
            .FirstOrDefaultAsync(ct) ?? 20m;

        var policyIds = policies.Select(p => p.Id).ToArray();
        var estimates = policyIds.Length == 0
            ? new Dictionary<Guid, ProducerCommissionEstimate>()
            : await _db.PolicyCommissionSplits
                .AsNoTracking()
                .Where(s => s.ProducerId == producerId && policyIds.Contains(s.PolicyId))
                .GroupBy(s => s.PolicyId)
                .Select(g => new ProducerCommissionEstimate(
                    g.Key,
                    g.Sum(x => x.Percent),
                    g.Sum(x => x.GrossAmount),
                    g.Sum(x => x.TaxWithholdingAmount),
                    g.Sum(x => x.NetAmount)))
                .ToDictionaryAsync(x => x.PolicyId, ct);

        var rows = policies.Select(policy =>
        {
            var hasEstimate = estimates.TryGetValue(policy.Id, out var estimate);
            estimate ??= ProducerCommissionEstimate.Empty;

            if (policy.SpecialCommissionPercent.HasValue)
            {
                var manualPercent = Math.Max(0m, policy.SpecialCommissionPercent.Value);
                var gross = Math.Round(policy.Premium * manualPercent / 100m, 2);
                var withheld = Math.Round(gross * defaultWithholdingPercent / 100m, 2);
                estimate = new ProducerCommissionEstimate(
                    policy.Id, manualPercent, gross, withheld, gross - withheld);
                hasEstimate = true;
            }

            return new ProducerSelfProductionRowDto(
                policy.Id,
                policy.PolicyNumber,
                policy.CustomerName ?? string.Empty,
                policy.InsuranceCompanyName,
                policy.PolicyType,
                policy.Status,
                policy.StartDate,
                policy.EndDate,
                policy.Premium,
                hasEstimate,
                estimate.RatePercent,
                estimate.GrossAmount,
                estimate.TaxWithholding,
                estimate.NetAmount);
        }).ToList();

        return new ProducerSelfProductionDto(
            year,
            month,
            rows.Count,
            rows.Sum(x => x.Premium),
            rows.Sum(x => x.ExpectedGrossCommission),
            rows.Sum(x => x.TaxWithholding),
            rows.Sum(x => x.ExpectedNetCommission),
            rows);
    }

    private sealed record ProducerCommissionEstimate(
        Guid PolicyId,
        decimal RatePercent,
        decimal GrossAmount,
        decimal TaxWithholding,
        decimal NetAmount)
    {
        public static readonly ProducerCommissionEstimate Empty = new(Guid.Empty, 0m, 0m, 0m, 0m);
    }
}
