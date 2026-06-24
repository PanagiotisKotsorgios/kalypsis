using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Branches;

public record BranchDto(Guid Id, string Code, string Name, string? Description, string? FieldsJson, string? CoveragesJson, bool IsActive);
public record BranchBody(string Code, string Name, string? Description, string? FieldsJson, string? CoveragesJson, bool IsActive);

public record ListBranchesQuery() : IRequest<IReadOnlyList<BranchDto>>;
public class ListBranchesQueryHandler : IRequestHandler<ListBranchesQuery, IReadOnlyList<BranchDto>>
{
    private readonly IAppDbContext _db;
    public ListBranchesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<BranchDto>> Handle(ListBranchesQuery _, CancellationToken ct)
    {
        var rows = await _db.Branches.OrderBy(b => b.Name).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static BranchDto Map(Branch b) => new(b.Id, b.Code, b.Name, b.Description, b.FieldsJson, b.CoveragesJson, b.IsActive);
}

public class BranchBodyValidator : AbstractValidator<BranchBody>
{
    public BranchBodyValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}

public record CreateBranchCommand(BranchBody Body) : IRequest<BranchDto>;
public class CreateBranchCommandValidator : AbstractValidator<CreateBranchCommand>
{ public CreateBranchCommandValidator() { RuleFor(x => x.Body).SetValidator(new BranchBodyValidator()); } }

public class CreateBranchCommandHandler : IRequestHandler<CreateBranchCommand, BranchDto>
{
    private readonly IAppDbContext _db;
    public CreateBranchCommandHandler(IAppDbContext db) => _db = db;
    public async Task<BranchDto> Handle(CreateBranchCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.Branches.AnyAsync(x => x.Code == b.Code, ct))
            throw new AppException("branch_code_taken",
                "Υπάρχει ήδη κλάδος με αυτόν τον κωδικό.", 409,
                title: "Κωδικός κλάδου σε χρήση",
                why: $"Ο κωδικός κλάδου «{b.Code}» χρησιμοποιείται ήδη. Οι κωδικοί κλάδων (π.χ. ΑΥΤ για αυτοκίνητα) πρέπει να είναι μοναδικοί ώστε να ξεχωρίζουν στα reports.",
                fix: "Επιλέξτε διαφορετικό κωδικό για τον νέο κλάδο. Δείτε την υπάρχουσα λίστα κλάδων για να αποφύγετε σύγκρουση.",
                fixLink: "/app/lookups/branches");
        var br = new Branch
        {
            Id = Guid.NewGuid(), Code = b.Code.Trim(), Name = b.Name.Trim(),
            Description = b.Description, FieldsJson = b.FieldsJson, CoveragesJson = b.CoveragesJson,
            IsActive = b.IsActive
        };
        _db.Branches.Add(br);
        await _db.SaveChangesAsync(ct);
        return ListBranchesQueryHandler.Map(br);
    }
}

public record UpdateBranchCommand(Guid Id, BranchBody Body) : IRequest<BranchDto>;
public class UpdateBranchCommandValidator : AbstractValidator<UpdateBranchCommand>
{ public UpdateBranchCommandValidator() { RuleFor(x => x.Body).SetValidator(new BranchBodyValidator()); } }

public class UpdateBranchCommandHandler : IRequestHandler<UpdateBranchCommand, BranchDto>
{
    private readonly IAppDbContext _db;
    public UpdateBranchCommandHandler(IAppDbContext db) => _db = db;
    public async Task<BranchDto> Handle(UpdateBranchCommand r, CancellationToken ct)
    {
        var br = await _db.Branches.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Branch");
        var b = r.Body;
        br.Code = b.Code.Trim(); br.Name = b.Name.Trim();
        br.Description = b.Description; br.FieldsJson = b.FieldsJson; br.CoveragesJson = b.CoveragesJson;
        br.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return ListBranchesQueryHandler.Map(br);
    }
}

public record DeleteBranchCommand(Guid Id) : IRequest<Unit>;
public class DeleteBranchCommandHandler : IRequestHandler<DeleteBranchCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteBranchCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteBranchCommand r, CancellationToken ct)
    {
        var br = await _db.Branches.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Branch");
        br.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
