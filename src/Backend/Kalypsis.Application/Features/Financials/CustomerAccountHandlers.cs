using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

/// <summary>
/// Read-only customer account view.  The source of truth is the existing
/// financial-movement journal: CustomerCharge increases what the customer
/// owes and CustomerCredit (receipt) decreases it.  This deliberately does
/// not create a second balance table, so the card cannot drift from receipts.
/// </summary>
public record CustomerAccountEntryDto(
    Guid Id, DateOnly Date, string Kind, decimal Amount, string Currency,
    string? Description, Guid? PolicyId, string? PolicyNumber);

public record CustomerAccountInstallmentDto(
    Guid Id, Guid PolicyId, string PolicyNumber, DateOnly DueDate, decimal Amount,
    DateOnly? PaidAt, bool IsOverdue, int DaysLate);

public record CustomerAccountMonthDto(
    int Year, int Month, decimal Charges, decimal Credits, decimal Balance);

internal sealed record CustomerInstallmentRow(
    Guid Id, Guid PolicyId, string PolicyNumber, DateOnly DueDate, decimal Amount, DateOnly? PaidAt);

public record CustomerAccountDto(
    Guid CustomerId, string CustomerName,
    decimal TotalCharges, decimal TotalCredits, decimal Balance,
    decimal OverdueAmount, int OverdueCount,
    int InstallmentCount, int PaidInstallmentCount, int OnTimePaymentCount,
    int LatePaymentCount, decimal OnTimeRatePercent,
    IReadOnlyList<CustomerAccountEntryDto> Entries,
    IReadOnlyList<CustomerAccountInstallmentDto> Installments,
    IReadOnlyList<CustomerAccountMonthDto> Monthly);

public record GetCustomerAccountQuery(Guid CustomerId, DateOnly? From = null, DateOnly? To = null)
    : IRequest<CustomerAccountDto>;

public record CustomerAccountListRowDto(
    Guid CustomerId, string CustomerName, decimal Charges, decimal Credits,
    decimal Balance, decimal OverdueAmount, int OverdueCount,
    int PaidInstallments, int LatePayments, decimal OnTimeRatePercent,
    DateOnly? LastPaymentDate, DateOnly? LastChargeDate);

public record ListCustomerAccountsQuery(
    DateOnly? From, DateOnly? To, bool OnlyDebtors, bool OnlyCreditors, bool OnlyOverdue)
    : IRequest<IReadOnlyList<CustomerAccountListRowDto>>;

internal static class CustomerAccountMath
{
    public static string Name(Domain.Entities.Customer c) => c.Type == CustomerType.Company
        ? c.CompanyName ?? c.CustomerNumber
        : $"{c.FirstName} {c.LastName}".Trim();

    public static bool IsCharge(FinancialMovementKind kind) => kind == FinancialMovementKind.CustomerCharge;
    public static bool IsCredit(FinancialMovementKind kind) => kind == FinancialMovementKind.CustomerCredit;
}

public sealed class GetCustomerAccountQueryHandler
    : IRequestHandler<GetCustomerAccountQuery, CustomerAccountDto>
{
    private readonly IAppDbContext _db;
    public GetCustomerAccountQueryHandler(IAppDbContext db) { _db = db; }

    public async Task<CustomerAccountDto> Handle(GetCustomerAccountQuery q, CancellationToken ct)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(x => x.Id == q.CustomerId, ct)
            ?? throw AppException.NotFound("Πελάτης");

        var movementsQuery = _db.FinancialMovements
            .Include(x => x.Policy)
            .Where(x => x.CustomerId == q.CustomerId);
        if (q.From.HasValue) movementsQuery = movementsQuery.Where(x => x.MovementDate >= q.From.Value);
        if (q.To.HasValue) movementsQuery = movementsQuery.Where(x => x.MovementDate <= q.To.Value);
        var movements = await movementsQuery
            .OrderByDescending(x => x.MovementDate).ThenByDescending(x => x.CreatedAt)
            .Take(2000).ToListAsync(ct);

        var policies = await _db.Policies
            .Where(x => x.CustomerId == q.CustomerId && x.DeletedAt == null)
            .Select(x => new { x.Id, x.PolicyNumber, x.Premium, x.StartDate, x.Status, x.PaidDirectlyToCarrier, x.PaymentPromisedOn, x.PaidOnCredit, x.Currency })
            .ToListAsync(ct);
        var policyIds = policies.Select(x => x.Id).ToList();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var installmentRows = policyIds.Count == 0
            ? new List<CustomerInstallmentRow>()
            : await _db.PolicyInstallments
                .Where(x => policyIds.Contains(x.PolicyId) && x.DeletedAt == null)
                .Select(x => new
                {
                    x.Id, x.PolicyId, PolicyNumber = x.Policy!.PolicyNumber, x.DueDate, x.Amount, x.PaidAt,
                    Direct = x.Policy.PaidDirectlyToCarrier
                })
                .Where(x => !x.Direct)
                .AsNoTracking().Select(x => new CustomerInstallmentRow(
                    x.Id, x.PolicyId, x.PolicyNumber, x.DueDate, x.Amount, x.PaidAt)).ToListAsync(ct);

        var installments = installmentRows.Select(x => (
            x.Id, x.PolicyId, x.PolicyNumber, x.DueDate, x.Amount, x.PaidAt)).ToList();

        // Manual policies do not always have a journal row yet (bridge imports
        // do).  Add a derived charge only when no charge exists for that policy;
        // this keeps a new manual contract visible in the customer's balance
        // without double-counting an imported contract.
        var chargedPolicyIds = movements.Where(x => CustomerAccountMath.IsCharge(x.Kind) && x.PolicyId.HasValue)
            .Select(x => x.PolicyId!.Value).ToHashSet();
        var syntheticPolicies = policies.Where(x => !x.PaidDirectlyToCarrier
                && !chargedPolicyIds.Contains(x.Id)
                && x.Status is not PolicyStatus.Draft and not PolicyStatus.Cancelled and not PolicyStatus.Prospect
                && (!q.From.HasValue || x.StartDate >= q.From.Value)
                && (!q.To.HasValue || x.StartDate <= q.To.Value))
            .ToList();
        var charges = movements.Where(x => CustomerAccountMath.IsCharge(x.Kind)).Sum(x => x.Amount)
            + syntheticPolicies.Sum(x => x.Premium);
        var credits = movements.Where(x => CustomerAccountMath.IsCredit(x.Kind)).Sum(x => x.Amount);
        var balance = charges - credits;
        var openInstallments = installments.Where(x => !x.PaidAt.HasValue).ToList();
        var overdueInstallments = openInstallments.Where(x => x.DueDate < today).ToList();

        // Annual policies can be marked “on credit” without generated
        // installments. Treat the promised date as one overdue obligation.
        var installmentPolicyIds = installments.Select(x => x.PolicyId).ToHashSet();
        var fallbackOverdue = policies.Where(x => !x.PaidDirectlyToCarrier && x.PaidOnCredit
                && x.PaymentPromisedOn.HasValue && x.PaymentPromisedOn.Value < today
                && !installmentPolicyIds.Contains(x.Id))
            .Select(x => (x.Id, x.PolicyNumber, x.PaymentPromisedOn!.Value, x.Premium))
            .ToList();

        var paidCount = installments.Count(x => x.PaidAt.HasValue);
        var onTime = installments.Count(x => x.PaidAt.HasValue && x.PaidAt!.Value <= x.DueDate);
        var late = installments.Count(x => x.PaidAt.HasValue && x.PaidAt!.Value > x.DueDate);
        var onTimeRate = paidCount == 0 ? 0m : Math.Round(onTime * 100m / paidCount, 2);
        var overdueAmount = overdueInstallments.Sum(x => x.Amount) + fallbackOverdue.Sum(x => x.Premium);
        var overdueCount = overdueInstallments.Count + fallbackOverdue.Count;

        var monthlyRows = movements.Select(x => new
        {
            x.MovementDate, x.Kind, x.Amount
        }).Concat(syntheticPolicies.Select(x => new
        {
            MovementDate = x.StartDate, Kind = FinancialMovementKind.CustomerCharge, Amount = x.Premium
        })).ToList();
        var monthly = monthlyRows.GroupBy(x => new { x.MovementDate.Year, x.MovementDate.Month })
            .OrderByDescending(x => x.Key.Year).ThenByDescending(x => x.Key.Month)
            .Select(g =>
            {
                var c = g.Where(x => CustomerAccountMath.IsCharge(x.Kind)).Sum(x => x.Amount);
                var cr = g.Where(x => CustomerAccountMath.IsCredit(x.Kind)).Sum(x => x.Amount);
                return new CustomerAccountMonthDto(g.Key.Year, g.Key.Month, c, cr, c - cr);
            }).ToList();

        return new CustomerAccountDto(
            q.CustomerId, CustomerAccountMath.Name(customer), charges, credits, balance,
            overdueAmount, overdueCount, installments.Count, paidCount, onTime, late, onTimeRate,
            movements.Select(x => new CustomerAccountEntryDto(
                x.Id, x.MovementDate, x.Kind.ToString(), x.Amount, x.Currency, x.Description,
                x.PolicyId, x.Policy?.PolicyNumber))
            .Concat(syntheticPolicies.Select(x => new CustomerAccountEntryDto(
                x.Id, x.StartDate, nameof(FinancialMovementKind.CustomerCharge), x.Premium,
                x.Currency, $"Αυτόματη χρέωση συμβολαίου {x.PolicyNumber}", x.Id, x.PolicyNumber)))
            .OrderByDescending(x => x.Date).ToList(),
            installments.Select(x => new CustomerAccountInstallmentDto(
                x.Id, x.PolicyId, x.PolicyNumber, x.DueDate, x.Amount, x.PaidAt,
                !x.PaidAt.HasValue && x.DueDate < today,
                x.PaidAt.HasValue ? Math.Max(0, x.PaidAt.Value.DayNumber - x.DueDate.DayNumber)
                                  : Math.Max(0, today.DayNumber - x.DueDate.DayNumber))).ToList(),
            monthly);
    }
}

public sealed class ListCustomerAccountsQueryHandler
    : IRequestHandler<ListCustomerAccountsQuery, IReadOnlyList<CustomerAccountListRowDto>>
{
    private readonly IAppDbContext _db;
    public ListCustomerAccountsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CustomerAccountListRowDto>> Handle(ListCustomerAccountsQuery q, CancellationToken ct)
    {
        var movementQuery = _db.FinancialMovements
            .Where(x => x.CustomerId.HasValue);
        if (q.From.HasValue) movementQuery = movementQuery.Where(x => x.MovementDate >= q.From.Value);
        if (q.To.HasValue) movementQuery = movementQuery.Where(x => x.MovementDate <= q.To.Value);
        var movements = await movementQuery.AsNoTracking().ToListAsync(ct);
        var customers = await _db.Customers.AsNoTracking().ToDictionaryAsync(x => x.Id, ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var policies = await _db.Policies
            .Where(x => x.DeletedAt == null && x.Status != PolicyStatus.Draft
                && x.Status != PolicyStatus.Cancelled && x.Status != PolicyStatus.Prospect)
            .Select(x => new { x.Id, x.CustomerId, x.Premium, x.StartDate, x.PaidDirectlyToCarrier })
            .AsNoTracking().ToListAsync(ct);
        var chargedPolicyIds = movements.Where(x => x.PolicyId.HasValue && CustomerAccountMath.IsCharge(x.Kind))
            .Select(x => x.PolicyId!.Value).ToHashSet();
        var synthetic = policies.Where(x => !x.PaidDirectlyToCarrier && !chargedPolicyIds.Contains(x.Id)
                && (!q.From.HasValue || x.StartDate >= q.From.Value)
                && (!q.To.HasValue || x.StartDate <= q.To.Value)).ToList();
        var installments = await _db.PolicyInstallments
            .Where(x => x.DeletedAt == null)
            .Select(x => new { x.PolicyId, x.Amount, x.DueDate, x.PaidAt, x.Policy!.CustomerId, x.Policy.PaidDirectlyToCarrier })
            .Where(x => !x.PaidDirectlyToCarrier).AsNoTracking().ToListAsync(ct);

        var movementGroups = movements.Where(x => x.CustomerId.HasValue)
            .GroupBy(x => x.CustomerId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var customerIds = movementGroups.Keys.Concat(policies.Select(x => x.CustomerId)).Distinct().ToList();
        var result = customerIds.Select(customerId =>
        {
            var rows = movementGroups.GetValueOrDefault(customerId) ?? new List<Kalypsis.Domain.Entities.FinancialMovement>();
            var charges = rows.Where(x => CustomerAccountMath.IsCharge(x.Kind)).Sum(x => x.Amount)
                + synthetic.Where(x => x.CustomerId == customerId).Sum(x => x.Premium);
            var credits = rows.Where(x => CustomerAccountMath.IsCredit(x.Kind)).Sum(x => x.Amount);
            var customerInstallments = installments.Where(x => x.CustomerId == customerId).ToList();
            var openOverdue = customerInstallments
                .Where(x => !x.PaidAt.HasValue && x.DueDate < today)
                .ToList();
            var overdue = openOverdue.Sum(x => x.Amount);
            var paidInstallments = customerInstallments.Count(x => x.PaidAt.HasValue);
            var latePayments = customerInstallments.Count(x => x.PaidAt.HasValue && x.PaidAt!.Value > x.DueDate);
            var onTimePayments = customerInstallments.Count(x => x.PaidAt.HasValue && x.PaidAt!.Value <= x.DueDate);
            var onTimeRate = paidInstallments == 0
                ? 0m
                : Math.Round(onTimePayments * 100m / paidInstallments, 2);
            var lastPaymentDate = rows
                .Where(x => CustomerAccountMath.IsCredit(x.Kind))
                .Select(x => (DateOnly?)x.MovementDate)
                .OrderByDescending(x => x)
                .FirstOrDefault();
            var lastChargeDate = rows
                .Where(x => CustomerAccountMath.IsCharge(x.Kind))
                .Select(x => (DateOnly?)x.MovementDate)
                .Concat(synthetic.Where(x => x.CustomerId == customerId).Select(x => (DateOnly?)x.StartDate))
                .OrderByDescending(x => x)
                .FirstOrDefault();
            var balance = charges - credits;
            var customer = customers.GetValueOrDefault(customerId);
            return new CustomerAccountListRowDto(customerId,
                customer is null ? "—" : CustomerAccountMath.Name(customer),
                charges, credits, balance, overdue,
                openOverdue.Count, paidInstallments, latePayments, onTimeRate,
                lastPaymentDate, lastChargeDate);
        }).ToList();

        return result.Where(x => (!q.OnlyDebtors || x.Balance > 0m)
                              && (!q.OnlyCreditors || x.Balance < 0m)
                              && (!q.OnlyOverdue || x.OverdueAmount > 0m))
            .OrderByDescending(x => x.Balance).ThenBy(x => x.CustomerName).ToList();
    }
}
