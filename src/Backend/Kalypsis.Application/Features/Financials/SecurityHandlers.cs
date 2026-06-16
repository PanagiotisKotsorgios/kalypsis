using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record SecurityDto(
    Guid Id, string Number, SecurityKind Kind, SecurityStatus Status,
    Guid CustomerId, string CustomerName,
    Guid? IssuingBankId, string? IssuingBankName,
    DateOnly IssueDate, DateOnly MaturityDate, DateOnly? PaidDate,
    decimal Amount, string Currency, string? Notes);

public record SecurityBody(
    string Number, SecurityKind Kind, SecurityStatus Status,
    Guid CustomerId, Guid? IssuingBankId,
    DateOnly IssueDate, DateOnly MaturityDate, DateOnly? PaidDate,
    decimal Amount, string Currency, string? Notes);

public record ListSecuritiesQuery(SecurityStatus? Status) : IRequest<IReadOnlyList<SecurityDto>>;

public class ListSecuritiesQueryHandler : IRequestHandler<ListSecuritiesQuery, IReadOnlyList<SecurityDto>>
{
    private readonly IAppDbContext _db;
    public ListSecuritiesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SecurityDto>> Handle(ListSecuritiesQuery r, CancellationToken ct)
    {
        var q = _db.Securities.Include(s => s.Customer).Include(s => s.IssuingBank).AsQueryable();
        if (r.Status.HasValue) q = q.Where(s => s.Status == r.Status);
        var rows = await q.OrderBy(s => s.MaturityDate).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static SecurityDto Map(Security s)
    {
        var name = s.Customer.Type == CustomerType.Individual
            ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
            : s.Customer.CompanyName ?? "—";
        return new SecurityDto(s.Id, s.Number, s.Kind, s.Status, s.CustomerId, name,
            s.IssuingBankId, s.IssuingBank?.BankName,
            s.IssueDate, s.MaturityDate, s.PaidDate, s.Amount, s.Currency, s.Notes);
    }
}

public class SecurityBodyValidator : AbstractValidator<SecurityBody>
{
    public SecurityBodyValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(40);
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.IssueDate).LessThanOrEqualTo(x => x.MaturityDate);
    }
}

public record CreateSecurityCommand(SecurityBody Body) : IRequest<SecurityDto>;
public class CreateSecurityCommandValidator : AbstractValidator<CreateSecurityCommand>
{ public CreateSecurityCommandValidator() { RuleFor(x => x.Body).SetValidator(new SecurityBodyValidator()); } }

public class CreateSecurityCommandHandler : IRequestHandler<CreateSecurityCommand, SecurityDto>
{
    private readonly IAppDbContext _db;
    public CreateSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<SecurityDto> Handle(CreateSecurityCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var s = new Security
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), Kind = b.Kind, Status = b.Status,
            CustomerId = b.CustomerId, IssuingBankId = b.IssuingBankId,
            IssueDate = b.IssueDate, MaturityDate = b.MaturityDate, PaidDate = b.PaidDate,
            Amount = b.Amount, Currency = b.Currency.ToUpperInvariant(), Notes = b.Notes
        };
        _db.Securities.Add(s);
        await _db.SaveChangesAsync(ct);
        s = await _db.Securities.Include(x => x.Customer).Include(x => x.IssuingBank).FirstAsync(x => x.Id == s.Id, ct);
        return ListSecuritiesQueryHandler.Map(s);
    }
}

public record UpdateSecurityCommand(Guid Id, SecurityBody Body) : IRequest<SecurityDto>;
public class UpdateSecurityCommandValidator : AbstractValidator<UpdateSecurityCommand>
{ public UpdateSecurityCommandValidator() { RuleFor(x => x.Body).SetValidator(new SecurityBodyValidator()); } }

public class UpdateSecurityCommandHandler : IRequestHandler<UpdateSecurityCommand, SecurityDto>
{
    private readonly IAppDbContext _db;
    public UpdateSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<SecurityDto> Handle(UpdateSecurityCommand r, CancellationToken ct)
    {
        var s = await _db.Securities.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Security");
        var b = r.Body;
        s.Number = b.Number.Trim(); s.Kind = b.Kind; s.Status = b.Status;
        s.CustomerId = b.CustomerId; s.IssuingBankId = b.IssuingBankId;
        s.IssueDate = b.IssueDate; s.MaturityDate = b.MaturityDate; s.PaidDate = b.PaidDate;
        s.Amount = b.Amount; s.Currency = b.Currency.ToUpperInvariant(); s.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        s = await _db.Securities.Include(x => x.Customer).Include(x => x.IssuingBank).FirstAsync(x => x.Id == s.Id, ct);
        return ListSecuritiesQueryHandler.Map(s);
    }
}

public record DeleteSecurityCommand(Guid Id) : IRequest<Unit>;
public class DeleteSecurityCommandHandler : IRequestHandler<DeleteSecurityCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteSecurityCommand r, CancellationToken ct)
    {
        var s = await _db.Securities.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Security");
        s.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
