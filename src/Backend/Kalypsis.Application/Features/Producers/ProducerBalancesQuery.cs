using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerBalanceCurrency(string Currency, decimal Earned, decimal Paid, decimal ToProducer, decimal FromProducer);
public record ProducerBalanceEntry(string Id, DateOnly Date, string Kind, string Reference, string? PolicyNumber, decimal Earned, decimal Paid, string Currency);
public record ProducerBalancesDto(Guid ProducerId, IReadOnlyList<ProducerBalanceCurrency> Currencies, IReadOnlyList<ProducerBalanceEntry> Entries);
public record GetProducerBalancesQuery(Guid ProducerId) : IRequest<ProducerBalancesDto>;

public sealed class GetProducerBalancesHandler(IAppDbContext db, ICurrentUser current) : IRequestHandler<GetProducerBalancesQuery, ProducerBalancesDto>
{
    public async Task<ProducerBalancesDto> Handle(GetProducerBalancesQuery request, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        if (!await db.Producers.AnyAsync(p => p.Id == request.ProducerId && p.TenantId == tenantId && p.DeletedAt == null, ct))
            throw AppException.NotFound("Συνεργάτης");
        // Reuse the statement's commission basis. Do not count generated financial
        // movement mirrors as well, or the same payment/accrual would appear twice.
        var commissions = await db.PolicyCommissionSplits
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null && s.ProducerId == request.ProducerId && s.HierarchyLevel != HierarchyLevel.Agency)
            .Join(db.Policies.Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.Status != PolicyStatus.Draft && p.Status != PolicyStatus.Cancelled && p.Status != PolicyStatus.Prospect),
                split => split.PolicyId, policy => policy.Id,
                (split, policy) => new { split.Id, policy.StartDate, policy.PolicyNumber, split.GrossAmount, split.Currency })
            .ToListAsync(ct);
        var payments = await db.Payments
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null && p.BeneficiaryType == BeneficiaryType.Producer && p.BeneficiaryProducerId == request.ProducerId)
            .Select(p => new { p.Id, p.PaidOn, p.Number, PolicyNumber = p.Policy != null ? p.Policy.PolicyNumber : null, p.Amount, p.Currency })
            .ToListAsync(ct);
        var entries = commissions.Select(c => new ProducerBalanceEntry("commission:" + c.Id, c.StartDate, "Commission", c.PolicyNumber, c.PolicyNumber, c.GrossAmount, 0, Currency(c.Currency)))
            .Concat(payments.Select(p => new ProducerBalanceEntry("payment:" + p.Id, p.PaidOn, "Payment", p.Number, p.PolicyNumber, 0, p.Amount, Currency(p.Currency))))
            .OrderByDescending(row => row.Date).ThenBy(row => row.Id).ToList();
        var balances = entries.GroupBy(row => row.Currency).Select(group =>
        {
            var earned = group.Sum(row => row.Earned);
            var paid = group.Sum(row => row.Paid);
            return new ProducerBalanceCurrency(group.Key, earned, paid, Math.Max(0, earned - paid), Math.Max(0, paid - earned));
        }).OrderBy(row => row.Currency).ToList();
        return new ProducerBalancesDto(request.ProducerId, balances, entries);
    }

    private static string Currency(string? currency) => string.IsNullOrWhiteSpace(currency) ? "EUR" : currency.Trim().ToUpperInvariant();
}
