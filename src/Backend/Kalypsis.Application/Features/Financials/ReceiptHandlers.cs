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
    PaymentMethod Method, decimal Amount, string Currency, string? Notes,
    string? TransactionReference);

public record ReceiptBody(
    string Number, DateOnly ReceivedOn, Guid CustomerId, Guid? PolicyId,
    PaymentMethod Method, decimal Amount, string Currency, string? Notes,
    string? TransactionReference);

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
            r.PolicyId, r.Policy?.PolicyNumber, r.Method, r.Amount, r.Currency, r.Notes,
            r.TransactionReference);
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
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customerExists = await _db.Customers
            .AnyAsync(x => x.Id == b.CustomerId && x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (!customerExists) throw AppException.NotFound("Ξ ΞµΞ»Ξ¬Ο„Ξ·Ο‚");
        if (b.PolicyId.HasValue)
        {
            var policyCustomerId = await _db.Policies
                .Where(x => x.Id == b.PolicyId.Value && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => (Guid?)x.CustomerId)
                .FirstOrDefaultAsync(ct);
            if (!policyCustomerId.HasValue) throw AppException.NotFound("Ξ£Ο…ΞΌΞ²ΞΏΞ»Ξ±Ξ―ΞΏ");
            if (policyCustomerId.Value != b.CustomerId)
                throw AppException.Validation("Η είσπραξη πρέπει να συνδέεται με τον πελάτη του συμβολαίου.");
        }
        var rc = new Receipt
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), ReceivedOn = b.ReceivedOn,
            CustomerId = b.CustomerId, PolicyId = b.PolicyId, Method = b.Method,
            Amount = b.Amount, Currency = b.Currency.ToUpperInvariant(), Notes = b.Notes,
            RecordedByUserId = _current.UserId,
            TransactionReference = string.IsNullOrWhiteSpace(b.TransactionReference) ? null : b.TransactionReference.Trim()
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

/// <summary>
/// Updates an existing receipt while keeping its linked cash movement in sync.
/// Receipt edits are intentionally handled server-side so customer/policy
/// ownership and financial totals cannot be changed by a client-only form.
/// </summary>
public record UpdateReceiptCommand(Guid Id, ReceiptBody Body) : IRequest<ReceiptDto>;
public class UpdateReceiptCommandValidator : AbstractValidator<UpdateReceiptCommand>
{ public UpdateReceiptCommandValidator() { RuleFor(x => x.Body).SetValidator(new ReceiptBodyValidator()); } }

public class UpdateReceiptCommandHandler : IRequestHandler<UpdateReceiptCommand, ReceiptDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateReceiptCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ReceiptDto> Handle(UpdateReceiptCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = r.Body;
        var receipt = await _db.Receipts
            .Include(x => x.Customer)
            .Include(x => x.Policy)
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Receipt");

        var customerExists = await _db.Customers
            .AnyAsync(x => x.Id == b.CustomerId && x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (!customerExists) throw AppException.NotFound("Customer");
        if (b.PolicyId.HasValue)
        {
            var policyCustomerId = await _db.Policies
                .Where(x => x.Id == b.PolicyId.Value && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => (Guid?)x.CustomerId)
                .FirstOrDefaultAsync(ct);
            if (!policyCustomerId.HasValue) throw AppException.NotFound("Policy");
            if (policyCustomerId.Value != b.CustomerId)
                throw AppException.Validation("Η είσπραξη πρέπει να συνδέεται με τον πελάτη του συμβολαίου.");
        }

        receipt.Number = b.Number.Trim();
        receipt.ReceivedOn = b.ReceivedOn;
        receipt.CustomerId = b.CustomerId;
        receipt.PolicyId = b.PolicyId;
        receipt.Method = b.Method;
        receipt.Amount = b.Amount;
        receipt.Currency = b.Currency.ToUpperInvariant();
        receipt.Notes = b.Notes;
        receipt.TransactionReference = string.IsNullOrWhiteSpace(b.TransactionReference) ? null : b.TransactionReference.Trim();

        var movements = await _db.FinancialMovements
            .Where(m => m.ReceiptId == receipt.Id && m.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var movement in movements)
        {
            movement.MovementDate = b.ReceivedOn;
            movement.Amount = b.Amount;
            movement.Currency = b.Currency.ToUpperInvariant();
            movement.CustomerId = b.CustomerId;
            movement.PolicyId = b.PolicyId;
            movement.Description = $"Είσπραξη #{b.Number.Trim()}";
        }

        await _db.SaveChangesAsync(ct);
        var saved = await _db.Receipts.Include(x => x.Customer).Include(x => x.Policy)
            .FirstAsync(x => x.Id == receipt.Id, ct);
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
        DeletionProtection.ThrowIfBlocked($"είσπραξης «{rc.Number}»", new[]
        {
            new DeletionBlocker("οικονομικές κινήσεις", await _db.FinancialMovements.CountAsync(x => x.ReceiptId == rc.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("πιστωτικά", await _db.CreditNotes.CountAsync(x => x.AppliedToReceiptId == rc.Id && x.DeletedAt == null, ct)),
        });

        rc.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
