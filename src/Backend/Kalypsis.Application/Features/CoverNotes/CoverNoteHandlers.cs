using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CoverNotes;

public record CoverNoteDto(
    Guid Id, string Number, Guid CustomerId, string CustomerName,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    PolicyType PolicyType, DateOnly ValidFrom, DateOnly ValidUntil,
    decimal? EstimatedPremium, string Currency, CoverNoteStatus Status,
    Guid? ConvertedToPolicyId, string? Subject, string? Notes);

public record CoverNoteBody(
    string Number, Guid CustomerId, Guid? InsuranceCompanyId,
    PolicyType PolicyType, DateOnly ValidFrom, DateOnly ValidUntil,
    decimal? EstimatedPremium, string Currency, CoverNoteStatus Status,
    string? Subject, string? Notes);

public record ListCoverNotesQuery(CoverNoteStatus? Status) : IRequest<IReadOnlyList<CoverNoteDto>>;
public class ListCoverNotesQueryHandler : IRequestHandler<ListCoverNotesQuery, IReadOnlyList<CoverNoteDto>>
{
    private readonly IAppDbContext _db;
    public ListCoverNotesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CoverNoteDto>> Handle(ListCoverNotesQuery r, CancellationToken ct)
    {
        var q = _db.CoverNotes.Include(c => c.Customer).Include(c => c.InsuranceCompany).AsQueryable();
        if (r.Status.HasValue) q = q.Where(c => c.Status == r.Status);
        var rows = await q.OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static CoverNoteDto Map(CoverNote c)
    {
        var name = c.Customer.Type == CustomerType.Individual
            ? $"{c.Customer.FirstName} {c.Customer.LastName}".Trim()
            : c.Customer.CompanyName ?? "—";
        return new CoverNoteDto(c.Id, c.Number, c.CustomerId, name,
            c.InsuranceCompanyId, c.InsuranceCompany?.Name, c.PolicyType,
            c.ValidFrom, c.ValidUntil, c.EstimatedPremium, c.Currency, c.Status,
            c.ConvertedToPolicyId, c.Subject, c.Notes);
    }
}

public class CoverNoteBodyValidator : AbstractValidator<CoverNoteBody>
{
    public CoverNoteBodyValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(80);
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.ValidFrom).LessThanOrEqualTo(x => x.ValidUntil);
    }
}

public record CreateCoverNoteCommand(CoverNoteBody Body) : IRequest<CoverNoteDto>;
public class CreateCoverNoteCommandValidator : AbstractValidator<CreateCoverNoteCommand>
{ public CreateCoverNoteCommandValidator() { RuleFor(x => x.Body).SetValidator(new CoverNoteBodyValidator()); } }

public class CreateCoverNoteCommandHandler : IRequestHandler<CreateCoverNoteCommand, CoverNoteDto>
{
    private readonly IAppDbContext _db;
    public CreateCoverNoteCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CoverNoteDto> Handle(CreateCoverNoteCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var c = new CoverNote
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), CustomerId = b.CustomerId,
            InsuranceCompanyId = b.InsuranceCompanyId, PolicyType = b.PolicyType,
            ValidFrom = b.ValidFrom, ValidUntil = b.ValidUntil,
            EstimatedPremium = b.EstimatedPremium, Currency = b.Currency.ToUpperInvariant(),
            Status = b.Status, Subject = b.Subject, Notes = b.Notes
        };
        _db.CoverNotes.Add(c);
        await _db.SaveChangesAsync(ct);
        c = await _db.CoverNotes.Include(x => x.Customer).Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == c.Id, ct);
        return ListCoverNotesQueryHandler.Map(c);
    }
}

public record UpdateCoverNoteCommand(Guid Id, CoverNoteBody Body) : IRequest<CoverNoteDto>;
public class UpdateCoverNoteCommandValidator : AbstractValidator<UpdateCoverNoteCommand>
{ public UpdateCoverNoteCommandValidator() { RuleFor(x => x.Body).SetValidator(new CoverNoteBodyValidator()); } }

public class UpdateCoverNoteCommandHandler : IRequestHandler<UpdateCoverNoteCommand, CoverNoteDto>
{
    private readonly IAppDbContext _db;
    public UpdateCoverNoteCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CoverNoteDto> Handle(UpdateCoverNoteCommand r, CancellationToken ct)
    {
        var c = await _db.CoverNotes.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("CoverNote");
        var b = r.Body;
        c.Number = b.Number.Trim(); c.CustomerId = b.CustomerId;
        c.InsuranceCompanyId = b.InsuranceCompanyId; c.PolicyType = b.PolicyType;
        c.ValidFrom = b.ValidFrom; c.ValidUntil = b.ValidUntil;
        c.EstimatedPremium = b.EstimatedPremium; c.Currency = b.Currency.ToUpperInvariant();
        c.Status = b.Status; c.Subject = b.Subject; c.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        c = await _db.CoverNotes.Include(x => x.Customer).Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == c.Id, ct);
        return ListCoverNotesQueryHandler.Map(c);
    }
}

public record DeleteCoverNoteCommand(Guid Id) : IRequest<Unit>;
public class DeleteCoverNoteCommandHandler : IRequestHandler<DeleteCoverNoteCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCoverNoteCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCoverNoteCommand r, CancellationToken ct)
    {
        var c = await _db.CoverNotes.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("CoverNote");
        c.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
