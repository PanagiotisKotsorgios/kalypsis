using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record ReceiptDto(
    Guid Id, string Number, DateOnly ReceivedOn,
    Guid CustomerId, string CustomerName,
    Guid? PolicyId, string? PolicyNumber,
    PaymentMethod Method, decimal Amount, string Currency, string? Notes);

public record ReceiptBody(
    string Number, DateOnly ReceivedOn, Guid CustomerId, Guid? PolicyId,
    PaymentMethod Method, decimal Amount, string Currency, string? Notes);

public record ListReceiptsQuery(DateOnly? From, DateOnly? To, Guid? CustomerId) : IRequest<IReadOnlyList<ReceiptDto>>;

public class ListReceiptsQueryHandler : IRequestHandler<ListReceiptsQuery, IReadOnlyList<ReceiptDto>>
{
    private readonly IAppDbContext _db;
    public ListReceiptsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ReceiptDto>> Handle(ListReceiptsQuery r, CancellationToken ct)
    {
        var q = _db.Receipts.Include(x => x.Customer).Include(x => x.Policy).AsQueryable();
        if (r.From.HasValue) q = q.Where(x => x.ReceivedOn >= r.From);
        if (r.To.HasValue) q = q.Where(x => x.ReceivedOn <= r.To);
        if (r.CustomerId.HasValue) q = q.Where(x => x.CustomerId == r.CustomerId);
        var rows = await q.OrderByDescending(x => x.ReceivedOn).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static ReceiptDto Map(Receipt r)
    {
        var name = r.Customer.Type == CustomerType.Individual
            ? $"{r.Customer.FirstName} {r.Customer.LastName}".Trim()
            : r.Customer.CompanyName ?? "—";
        return new ReceiptDto(r.Id, r.Number, r.ReceivedOn, r.CustomerId, name,
            r.PolicyId, r.Policy?.PolicyNumber, r.Method, r.Amount, r.Currency, r.Notes);
    }
}

public class ReceiptBodyValidator : AbstractValidator<ReceiptBody>
{
    public ReceiptBodyValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(40);
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}

public record CreateReceiptCommand(ReceiptBody Body) : IRequest<ReceiptDto>;
public class CreateReceiptCommandValidator : AbstractValidator<CreateReceiptCommand>
{ public CreateReceiptCommandValidator() { RuleFor(x => x.Body).SetValidator(new ReceiptBodyValidator()); } }

public class CreateReceiptCommandHandler : IRequestHandler<CreateReceiptCommand, ReceiptDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateReceiptCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }
    public async Task<ReceiptDto> Handle(CreateReceiptCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var rc = new Receipt
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), ReceivedOn = b.ReceivedOn,
            CustomerId = b.CustomerId, PolicyId = b.PolicyId, Method = b.Method,
            Amount = b.Amount, Currency = b.Currency.ToUpperInvariant(), Notes = b.Notes,
            RecordedByUserId = _current.UserId
        };
        _db.Receipts.Add(rc);

        _db.FinancialMovements.Add(new FinancialMovement
        {
            Id = Guid.NewGuid(),
            MovementDate = b.ReceivedOn,
            Kind = FinancialMovementKind.CustomerCredit,
            Amount = b.Amount,
            Currency = b.Currency.ToUpperInvariant(),
            CustomerId = b.CustomerId,
            PolicyId = b.PolicyId,
            ReceiptId = rc.Id,
            Description = $"Είσπραξη #{b.Number}"
        });
        await _db.SaveChangesAsync(ct);

        var saved = await _db.Receipts.Include(x => x.Customer).Include(x => x.Policy).FirstAsync(x => x.Id == rc.Id, ct);
        return ListReceiptsQueryHandler.Map(saved);
    }
}

public record DeleteReceiptCommand(Guid Id) : IRequest<Unit>;
public class DeleteReceiptCommandHandler : IRequestHandler<DeleteReceiptCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteReceiptCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteReceiptCommand r, CancellationToken ct)
    {
        var rc = await _db.Receipts.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Receipt");
        rc.DeletedAt = DateTime.UtcNow;

        var related = await _db.FinancialMovements.Where(m => m.ReceiptId == rc.Id).ToListAsync(ct);
        foreach (var m in related) m.DeletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
