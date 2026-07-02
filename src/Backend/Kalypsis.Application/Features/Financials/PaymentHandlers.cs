using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
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
