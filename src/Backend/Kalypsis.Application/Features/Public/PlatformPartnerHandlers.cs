using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

public record PartnerDto(Guid Id, string Name, string? LogoUrl, string? Url, int DisplayOrder, bool IsActive);

public record PartnerBody(string Name, string? LogoUrl, string? Url, int DisplayOrder, bool IsActive);

/* ========= Public — active list for the landing strip ========= */

public record GetPublicPartnersQuery() : IRequest<IReadOnlyList<PartnerDto>>;
public class GetPublicPartnersQueryHandler : IRequestHandler<GetPublicPartnersQuery, IReadOnlyList<PartnerDto>>
{
    private readonly IAppDbContext _db;
    public GetPublicPartnersQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PartnerDto>> Handle(GetPublicPartnersQuery _, CancellationToken ct)
    {
        var rows = await _db.PlatformPartners
            .Where(p => p.IsActive && p.DeletedAt == null)
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync(ct);
        return rows.Select(p => new PartnerDto(p.Id, p.Name, p.LogoUrl, p.Url, p.DisplayOrder, p.IsActive)).ToList();
    }
}

/* ========= Superadmin CRUD ========= */

public record ListPartnersQuery() : IRequest<IReadOnlyList<PartnerDto>>;
public class ListPartnersQueryHandler : IRequestHandler<ListPartnersQuery, IReadOnlyList<PartnerDto>>
{
    private readonly IAppDbContext _db;
    public ListPartnersQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PartnerDto>> Handle(ListPartnersQuery _, CancellationToken ct)
    {
        var rows = await _db.PlatformPartners
            .Where(p => p.DeletedAt == null)
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync(ct);
        return rows.Select(p => new PartnerDto(p.Id, p.Name, p.LogoUrl, p.Url, p.DisplayOrder, p.IsActive)).ToList();
    }
}

public class PartnerBodyValidator : AbstractValidator<PartnerBody>
{
    public PartnerBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        When(x => !string.IsNullOrWhiteSpace(x.LogoUrl), () => RuleFor(x => x.LogoUrl!).MaximumLength(500));
        When(x => !string.IsNullOrWhiteSpace(x.Url), () => RuleFor(x => x.Url!).MaximumLength(500));
    }
}

public record CreatePartnerCommand(PartnerBody Body) : IRequest<PartnerDto>;
public class CreatePartnerCommandValidator : AbstractValidator<CreatePartnerCommand>
{ public CreatePartnerCommandValidator() { RuleFor(x => x.Body).SetValidator(new PartnerBodyValidator()); } }

public class CreatePartnerCommandHandler : IRequestHandler<CreatePartnerCommand, PartnerDto>
{
    private readonly IAppDbContext _db;
    public CreatePartnerCommandHandler(IAppDbContext db) => _db = db;
    public async Task<PartnerDto> Handle(CreatePartnerCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var p = new PlatformPartner
        {
            Id = Guid.NewGuid(),
            Name = b.Name.Trim(),
            LogoUrl = string.IsNullOrWhiteSpace(b.LogoUrl) ? null : b.LogoUrl.Trim(),
            Url = string.IsNullOrWhiteSpace(b.Url) ? null : b.Url.Trim(),
            DisplayOrder = b.DisplayOrder,
            IsActive = b.IsActive
        };
        _db.PlatformPartners.Add(p);
        await _db.SaveChangesAsync(ct);
        return new PartnerDto(p.Id, p.Name, p.LogoUrl, p.Url, p.DisplayOrder, p.IsActive);
    }
}

public record UpdatePartnerCommand(Guid Id, PartnerBody Body) : IRequest<PartnerDto>;
public class UpdatePartnerCommandValidator : AbstractValidator<UpdatePartnerCommand>
{ public UpdatePartnerCommandValidator() { RuleFor(x => x.Body).SetValidator(new PartnerBodyValidator()); } }

public class UpdatePartnerCommandHandler : IRequestHandler<UpdatePartnerCommand, PartnerDto>
{
    private readonly IAppDbContext _db;
    public UpdatePartnerCommandHandler(IAppDbContext db) => _db = db;
    public async Task<PartnerDto> Handle(UpdatePartnerCommand r, CancellationToken ct)
    {
        var p = await _db.PlatformPartners.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Partner");
        var b = r.Body;
        p.Name = b.Name.Trim();
        p.LogoUrl = string.IsNullOrWhiteSpace(b.LogoUrl) ? null : b.LogoUrl.Trim();
        p.Url = string.IsNullOrWhiteSpace(b.Url) ? null : b.Url.Trim();
        p.DisplayOrder = b.DisplayOrder;
        p.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return new PartnerDto(p.Id, p.Name, p.LogoUrl, p.Url, p.DisplayOrder, p.IsActive);
    }
}

public record DeletePartnerCommand(Guid Id) : IRequest<Unit>;
public class DeletePartnerCommandHandler : IRequestHandler<DeletePartnerCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeletePartnerCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeletePartnerCommand r, CancellationToken ct)
    {
        var p = await _db.PlatformPartners.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Partner");
        p.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
