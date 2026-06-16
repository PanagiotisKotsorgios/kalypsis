using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record FinancialMovementDto(
    Guid Id, DateOnly MovementDate, FinancialMovementKind Kind,
    decimal Amount, string Currency, string? Description,
    Guid? PolicyId, string? PolicyNumber,
    Guid? CustomerId, string? CustomerName,
    Guid? ProducerId, string? ProducerName,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    Guid? ReceiptId, Guid? PaymentId);

public record ListFinancialMovementsQuery(DateOnly? From, DateOnly? To, FinancialMovementKind? Kind, Guid? CustomerId, Guid? ProducerId, Guid? InsuranceCompanyId)
    : IRequest<IReadOnlyList<FinancialMovementDto>>;

public class ListFinancialMovementsQueryHandler : IRequestHandler<ListFinancialMovementsQuery, IReadOnlyList<FinancialMovementDto>>
{
    private readonly IAppDbContext _db;
    public ListFinancialMovementsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<FinancialMovementDto>> Handle(ListFinancialMovementsQuery r, CancellationToken ct)
    {
        var q = _db.FinancialMovements
            .Include(m => m.Policy).Include(m => m.Customer)
            .Include(m => m.Producer).Include(m => m.InsuranceCompany)
            .AsQueryable();

        if (r.From.HasValue) q = q.Where(m => m.MovementDate >= r.From);
        if (r.To.HasValue) q = q.Where(m => m.MovementDate <= r.To);
        if (r.Kind.HasValue) q = q.Where(m => m.Kind == r.Kind);
        if (r.CustomerId.HasValue) q = q.Where(m => m.CustomerId == r.CustomerId);
        if (r.ProducerId.HasValue) q = q.Where(m => m.ProducerId == r.ProducerId);
        if (r.InsuranceCompanyId.HasValue) q = q.Where(m => m.InsuranceCompanyId == r.InsuranceCompanyId);

        var rows = await q.OrderByDescending(m => m.MovementDate).ThenByDescending(m => m.CreatedAt).Take(2000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    private static FinancialMovementDto Map(FinancialMovement m)
    {
        string? customerName = m.Customer is null ? null
            : m.Customer.Type == CustomerType.Individual
                ? $"{m.Customer.FirstName} {m.Customer.LastName}".Trim()
                : m.Customer.CompanyName;
        return new FinancialMovementDto(
            m.Id, m.MovementDate, m.Kind, m.Amount, m.Currency, m.Description,
            m.PolicyId, m.Policy?.PolicyNumber,
            m.CustomerId, customerName,
            m.ProducerId, m.Producer?.Name,
            m.InsuranceCompanyId, m.InsuranceCompany?.Name,
            m.ReceiptId, m.PaymentId);
    }
}

public record GetFinancialSummaryQuery(int Year) : IRequest<FinancialSummaryDto>;
public record FinancialSummaryDto(int Year, decimal TotalReceipts, decimal TotalPayments, decimal CommissionsEarned, decimal PartnerCharges, decimal CompanyCharges, IReadOnlyList<MonthBucket> Monthly);
public record MonthBucket(int Month, decimal Receipts, decimal Payments);

public class GetFinancialSummaryQueryHandler : IRequestHandler<GetFinancialSummaryQuery, FinancialSummaryDto>
{
    private readonly IAppDbContext _db;
    public GetFinancialSummaryQueryHandler(IAppDbContext db) => _db = db;

    public async Task<FinancialSummaryDto> Handle(GetFinancialSummaryQuery r, CancellationToken ct)
    {
        var year = r.Year;
        var first = new DateOnly(year, 1, 1);
        var last = new DateOnly(year, 12, 31);

        var rows = await _db.FinancialMovements
            .Where(m => m.MovementDate >= first && m.MovementDate <= last)
            .Select(m => new { m.MovementDate, m.Kind, m.Amount })
            .ToListAsync(ct);

        decimal sum(FinancialMovementKind kind) => rows.Where(x => x.Kind == kind).Sum(x => x.Amount);

        var monthly = Enumerable.Range(1, 12).Select(m =>
        {
            var monthRows = rows.Where(x => x.MovementDate.Month == m).ToList();
            return new MonthBucket(m,
                monthRows.Where(x => x.Kind == FinancialMovementKind.CustomerCredit).Sum(x => x.Amount),
                monthRows.Where(x => x.Kind == FinancialMovementKind.PartnerCharge || x.Kind == FinancialMovementKind.CompanyCharge).Sum(x => x.Amount));
        }).ToList();

        return new FinancialSummaryDto(
            year,
            sum(FinancialMovementKind.CustomerCredit),
            sum(FinancialMovementKind.PartnerCharge) + sum(FinancialMovementKind.CompanyCharge),
            sum(FinancialMovementKind.CommissionEarned),
            sum(FinancialMovementKind.PartnerCharge),
            sum(FinancialMovementKind.CompanyCharge),
            monthly);
    }
}
