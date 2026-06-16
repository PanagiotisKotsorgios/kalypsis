using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record BankConnectionDto(Guid Id, string BankName, string? Iban, string? Bic, string? AccountName, bool IsActive, string? Notes, DateTime? LastSyncedAt);
public record BankConnectionBody(string BankName, string? Iban, string? Bic, string? AccountName, bool IsActive, string? Notes);

public record ListBankConnectionsQuery() : IRequest<IReadOnlyList<BankConnectionDto>>;
public class ListBankConnectionsQueryHandler : IRequestHandler<ListBankConnectionsQuery, IReadOnlyList<BankConnectionDto>>
{
    private readonly IAppDbContext _db;
    public ListBankConnectionsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<BankConnectionDto>> Handle(ListBankConnectionsQuery _, CancellationToken ct)
    {
        var rows = await _db.BankConnections.OrderBy(b => b.BankName).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static BankConnectionDto Map(BankConnection b) =>
        new(b.Id, b.BankName, b.Iban, b.Bic, b.AccountName, b.IsActive, b.Notes, b.LastSyncedAt);
}

public class BankConnectionBodyValidator : AbstractValidator<BankConnectionBody>
{
    public BankConnectionBodyValidator()
    {
        RuleFor(x => x.BankName).NotEmpty().MaximumLength(200);
        When(x => !string.IsNullOrWhiteSpace(x.Iban), () => RuleFor(x => x.Iban!).MaximumLength(40));
    }
}

public record CreateBankConnectionCommand(BankConnectionBody Body) : IRequest<BankConnectionDto>;
public class CreateBankConnectionCommandValidator : AbstractValidator<CreateBankConnectionCommand>
{ public CreateBankConnectionCommandValidator() { RuleFor(x => x.Body).SetValidator(new BankConnectionBodyValidator()); } }

public class CreateBankConnectionCommandHandler : IRequestHandler<CreateBankConnectionCommand, BankConnectionDto>
{
    private readonly IAppDbContext _db;
    public CreateBankConnectionCommandHandler(IAppDbContext db) => _db = db;
    public async Task<BankConnectionDto> Handle(CreateBankConnectionCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var bc = new BankConnection
        {
            Id = Guid.NewGuid(), BankName = b.BankName.Trim(),
            Iban = b.Iban?.Trim(), Bic = b.Bic?.Trim(),
            AccountName = b.AccountName?.Trim(),
            IsActive = b.IsActive, Notes = b.Notes
        };
        _db.BankConnections.Add(bc);
        await _db.SaveChangesAsync(ct);
        return ListBankConnectionsQueryHandler.Map(bc);
    }
}

public record UpdateBankConnectionCommand(Guid Id, BankConnectionBody Body) : IRequest<BankConnectionDto>;
public class UpdateBankConnectionCommandValidator : AbstractValidator<UpdateBankConnectionCommand>
{ public UpdateBankConnectionCommandValidator() { RuleFor(x => x.Body).SetValidator(new BankConnectionBodyValidator()); } }

public class UpdateBankConnectionCommandHandler : IRequestHandler<UpdateBankConnectionCommand, BankConnectionDto>
{
    private readonly IAppDbContext _db;
    public UpdateBankConnectionCommandHandler(IAppDbContext db) => _db = db;
    public async Task<BankConnectionDto> Handle(UpdateBankConnectionCommand r, CancellationToken ct)
    {
        var bc = await _db.BankConnections.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Bank");
        var b = r.Body;
        bc.BankName = b.BankName.Trim();
        bc.Iban = b.Iban?.Trim(); bc.Bic = b.Bic?.Trim();
        bc.AccountName = b.AccountName?.Trim();
        bc.IsActive = b.IsActive; bc.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        return ListBankConnectionsQueryHandler.Map(bc);
    }
}

public record SyncBankConnectionCommand(Guid Id) : IRequest<BankConnectionDto>;
public class SyncBankConnectionCommandHandler : IRequestHandler<SyncBankConnectionCommand, BankConnectionDto>
{
    private readonly IAppDbContext _db;
    public SyncBankConnectionCommandHandler(IAppDbContext db) => _db = db;
    public async Task<BankConnectionDto> Handle(SyncBankConnectionCommand r, CancellationToken ct)
    {
        var bc = await _db.BankConnections.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Bank");
        bc.LastSyncedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ListBankConnectionsQueryHandler.Map(bc);
    }
}

public record DeleteBankConnectionCommand(Guid Id) : IRequest<Unit>;
public class DeleteBankConnectionCommandHandler : IRequestHandler<DeleteBankConnectionCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteBankConnectionCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteBankConnectionCommand r, CancellationToken ct)
    {
        var bc = await _db.BankConnections.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Bank");
        bc.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
