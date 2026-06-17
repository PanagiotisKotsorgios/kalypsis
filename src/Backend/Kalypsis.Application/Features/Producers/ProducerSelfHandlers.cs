using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerSelfSummaryDto(
    Guid ProducerId, string Name, ProducerStatus Status,
    int ActivePolicies, int PoliciesMtd, int PoliciesYtd,
    decimal PremiumMtd, decimal PremiumYtd,
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
        var activePolicies = await myPolicies.CountAsync(p => p.Status == PolicyStatus.Active, ct);

        var mtdPolicies = await myPolicies.Where(p => p.StartDate >= monthStart && p.StartDate <= today).CountAsync(ct);
        var ytdPolicies = await myPolicies.Where(p => p.StartDate >= yearStart && p.StartDate <= today).CountAsync(ct);

        var premiumMtd = await myPolicies.Where(p => p.StartDate >= monthStart && p.StartDate <= today)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0;
        var premiumYtd = await myPolicies.Where(p => p.StartDate >= yearStart && p.StartDate <= today)
            .SumAsync(p => (decimal?)p.Premium, ct) ?? 0;

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
            activePolicies, mtdPolicies, ytdPolicies,
            premiumMtd, premiumYtd, commissionMtd, commissionYtd, overCommissionYtd,
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
