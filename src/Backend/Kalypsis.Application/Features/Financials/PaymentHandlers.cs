using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record PaymentDto(
    Guid Id, string Number, DateOnly PaidOn, BeneficiaryType BeneficiaryType,
    Guid? BeneficiaryInsuranceCompanyId, string? BeneficiaryInsuranceCompanyName,
    Guid? BeneficiaryProducerId, string? BeneficiaryProducerName,
    string? BeneficiaryName, PaymentMethod Method,
    decimal Amount, decimal CommissionsNetted, string Currency, string? Notes,
    string? TransactionReference, Guid? PolicyId, string? PolicyNumber);

public record PaymentBody(
    string Number, DateOnly PaidOn, BeneficiaryType BeneficiaryType,
    Guid? BeneficiaryInsuranceCompanyId, Guid? BeneficiaryProducerId, string? BeneficiaryName,
    PaymentMethod Method, decimal Amount, decimal CommissionsNetted, string Currency, string? Notes,
    string? TransactionReference, Guid? PolicyId);

public record ListPaymentsQuery(DateOnly? From, DateOnly? To, BeneficiaryType? Type) : IRequest<IReadOnlyList<PaymentDto>>;

/// <summary>
/// Expected obligations derived from the office's policies, less payments
/// already recorded. This intentionally does not depend on the Payments table
/// being populated, so an office can see what is still owed from day one.
/// </summary>
public record PaymentObligationsSummaryDto(
    decimal CompaniesDue,
    decimal CompaniesPaid,
    decimal CompaniesPending,
    decimal ProducersDue,
    decimal ProducersPaid,
    decimal ProducersPending,
    int CompanyPolicyCount,
    int ProducerPolicyCount,
    string Currency);

public record GetPaymentObligationsSummaryQuery() : IRequest<PaymentObligationsSummaryDto>;

public class GetPaymentObligationsSummaryHandler
    : IRequestHandler<GetPaymentObligationsSummaryQuery, PaymentObligationsSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetPaymentObligationsSummaryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PaymentObligationsSummaryDto> Handle(
        GetPaymentObligationsSummaryQuery _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Reuse the production-list calculator so the same commission rules,
        // manual overrides and office/producer split are used everywhere.
        var rows = await ProductionListBuilder.BuildRowsAsync(
            _db,
            tenantId,
            new ProductionFilters(
                From: null, To: null,
                InsuranceCompanyId: null, ProducerId: null,
                PolicyType: null, Status: null,
                VehicleUseCategory: null, CoverCode: null,
                GroupBy: null),
            ct);

        var eligible = rows.Where(row =>
            !string.Equals(row.Status, nameof(PolicyStatus.Draft), StringComparison.OrdinalIgnoreCase)
            && !string.Equals(row.Status, nameof(PolicyStatus.Cancelled), StringComparison.OrdinalIgnoreCase)
            && !string.Equals(row.Status, nameof(PolicyStatus.Prospect), StringComparison.OrdinalIgnoreCase))
            .ToList();

        // The carrier is paid the premium after the total commission supplied
        // by the carrier is netted. IncomingAgencyCommission is that total
        // commission (producer share + office remainder), while the producer
        // obligation is only the producer's calculated share.
        var companiesDue = eligible.Sum(row =>
            Math.Max(0m, row.Gross - row.IncomingAgencyCommission));
        var producersDue = eligible.Sum(row => row.PartnerCommission);
        var companyPolicyCount = eligible.Count(row =>
            row.Gross - row.IncomingAgencyCommission > 0m);
        var producerPolicyCount = eligible.Count(row => row.PartnerCommission > 0m);

        var paidByType = await _db.Payments
            .Where(payment => payment.DeletedAt == null
                && (payment.BeneficiaryType == BeneficiaryType.InsuranceCompany
                    || payment.BeneficiaryType == BeneficiaryType.Producer))
            .GroupBy(payment => payment.BeneficiaryType)
            .Select(group => new
            {
                Type = group.Key,
                // Payment.Amount is the gross instruction amount. The amount
                // actually leaving the office is after any commission netting.
                Amount = group.Sum(payment =>
                    Math.Max(0m, payment.Amount - payment.CommissionsNetted))
            })
            .ToListAsync(ct);

        var companiesPaid = paidByType
            .Where(x => x.Type == BeneficiaryType.InsuranceCompany)
            .Select(x => x.Amount)
            .FirstOrDefault();
        var producersPaid = paidByType
            .Where(x => x.Type == BeneficiaryType.Producer)
            .Select(x => x.Amount)
            .FirstOrDefault();

        return new PaymentObligationsSummaryDto(
            companiesDue,
            companiesPaid,
            Math.Max(0m, companiesDue - companiesPaid),
            producersDue,
            producersPaid,
            Math.Max(0m, producersDue - producersPaid),
            companyPolicyCount,
            producerPolicyCount,
            "EUR");
    }
}

public class ListPaymentsQueryHandler : IRequestHandler<ListPaymentsQuery, IReadOnlyList<PaymentDto>>
{
    private readonly IAppDbContext _db;
    public ListPaymentsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PaymentDto>> Handle(ListPaymentsQuery r, CancellationToken ct)
    {
        var q = _db.Payments
            .Include(p => p.BeneficiaryInsuranceCompany)
            .Include(p => p.BeneficiaryProducer)
            .Include(p => p.Policy)
            .AsQueryable();
        if (r.From.HasValue) q = q.Where(x => x.PaidOn >= r.From);
        if (r.To.HasValue) q = q.Where(x => x.PaidOn <= r.To);
        if (r.Type.HasValue) q = q.Where(x => x.BeneficiaryType == r.Type);
        var rows = await q.OrderByDescending(x => x.PaidOn).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static PaymentDto Map(Payment p) => new(
        p.Id, p.Number, p.PaidOn, p.BeneficiaryType,
        p.BeneficiaryInsuranceCompanyId, p.BeneficiaryInsuranceCompany?.Name,
        p.BeneficiaryProducerId,
        p.BeneficiaryProducer?.Name,
        p.BeneficiaryName, p.Method, p.Amount, p.CommissionsNetted, p.Currency, p.Notes,
        p.TransactionReference, p.PolicyId, p.Policy?.PolicyNumber);
}

public class PaymentBodyValidator : AbstractValidator<PaymentBody>
{
    public PaymentBodyValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.CommissionsNetted).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}

public record CreatePaymentCommand(PaymentBody Body) : IRequest<PaymentDto>;
public class CreatePaymentCommandValidator : AbstractValidator<CreatePaymentCommand>
{ public CreatePaymentCommandValidator() { RuleFor(x => x.Body).SetValidator(new PaymentBodyValidator()); } }

public class CreatePaymentCommandHandler : IRequestHandler<CreatePaymentCommand, PaymentDto>
{
    private readonly IAppDbContext _db;
    public CreatePaymentCommandHandler(IAppDbContext db) => _db = db;
    public async Task<PaymentDto> Handle(CreatePaymentCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var p = new Payment
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), PaidOn = b.PaidOn,
            BeneficiaryType = b.BeneficiaryType,
            BeneficiaryInsuranceCompanyId = b.BeneficiaryInsuranceCompanyId,
            BeneficiaryProducerId = b.BeneficiaryProducerId,
            BeneficiaryName = b.BeneficiaryName,
            Method = b.Method,
            Amount = b.Amount,
            CommissionsNetted = b.CommissionsNetted,
            Currency = b.Currency.ToUpperInvariant(),
            Notes = b.Notes,
            TransactionReference = string.IsNullOrWhiteSpace(b.TransactionReference) ? null : b.TransactionReference.Trim(),
            PolicyId = b.PolicyId
        };
        _db.Payments.Add(p);

        var kind = b.BeneficiaryType switch
        {
            BeneficiaryType.InsuranceCompany => FinancialMovementKind.CompanyCharge,
            BeneficiaryType.Producer => FinancialMovementKind.PartnerCharge,
            _ => FinancialMovementKind.Adjustment
        };
        _db.FinancialMovements.Add(new FinancialMovement
        {
            Id = Guid.NewGuid(), MovementDate = b.PaidOn, Kind = kind,
            Amount = b.Amount, Currency = b.Currency.ToUpperInvariant(),
            InsuranceCompanyId = b.BeneficiaryInsuranceCompanyId,
            ProducerId = b.BeneficiaryProducerId,
            PolicyId = b.PolicyId,
            PaymentId = p.Id,
            Description = $"Πληρωμή #{b.Number}"
        });
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Payments
            .Include(x => x.BeneficiaryInsuranceCompany).Include(x => x.BeneficiaryProducer)
            .FirstAsync(x => x.Id == p.Id, ct);
        return ListPaymentsQueryHandler.Map(saved);
    }
}

public record DeletePaymentCommand(Guid Id) : IRequest<Unit>;
public class DeletePaymentCommandHandler : IRequestHandler<DeletePaymentCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeletePaymentCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeletePaymentCommand r, CancellationToken ct)
    {
        var p = await _db.Payments.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Payment");
        p.DeletedAt = DateTime.UtcNow;
        var related = await _db.FinancialMovements.Where(m => m.PaymentId == p.Id).ToListAsync(ct);
        foreach (var m in related) m.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
