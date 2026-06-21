using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.EmailTemplates;

public record EmailTemplateDto(
    Guid Id, string Code, string Name, string Subject,
    string BodyHtml, string? BodyPlain, string Language, bool IsSystem, bool IsActive);

public record UpsertEmailTemplateBody(
    string Code, string Name, string Subject, string BodyHtml, string? BodyPlain, string Language, bool IsActive);

public class UpsertEmailTemplateBodyValidator : AbstractValidator<UpsertEmailTemplateBody>
{
    public UpsertEmailTemplateBodyValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.BodyHtml).NotEmpty();
        RuleFor(x => x.Language).NotEmpty().MaximumLength(8);
    }
}

public record ListEmailTemplatesQuery() : IRequest<IReadOnlyList<EmailTemplateDto>>;
public record CreateEmailTemplateCommand(UpsertEmailTemplateBody Body) : IRequest<EmailTemplateDto>;
public record UpdateEmailTemplateCommand(Guid Id, UpsertEmailTemplateBody Body) : IRequest<EmailTemplateDto>;
public record DeleteEmailTemplateCommand(Guid Id) : IRequest<Unit>;

public class ListEmailTemplatesHandler : IRequestHandler<ListEmailTemplatesQuery, IReadOnlyList<EmailTemplateDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListEmailTemplatesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<EmailTemplateDto>> Handle(ListEmailTemplatesQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        return await _db.EmailTemplates
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null)
            .OrderBy(t => t.Name)
            .Select(t => new EmailTemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain, t.Language, t.IsSystem, t.IsActive))
            .ToListAsync(ct);
    }
}

public class CreateEmailTemplateHandler : IRequestHandler<CreateEmailTemplateCommand, EmailTemplateDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateEmailTemplateHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<EmailTemplateDto> Handle(CreateEmailTemplateCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = new EmailTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = request.Body.Code.Trim(),
            Name = request.Body.Name.Trim(),
            Subject = request.Body.Subject.Trim(),
            BodyHtml = request.Body.BodyHtml,
            BodyPlain = request.Body.BodyPlain,
            Language = request.Body.Language.Trim().ToLowerInvariant(),
            IsActive = request.Body.IsActive
        };
        _db.EmailTemplates.Add(t);
        await _db.SaveChangesAsync(ct);
        return new EmailTemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain, t.Language, t.IsSystem, t.IsActive);
    }
}

public class UpdateEmailTemplateHandler : IRequestHandler<UpdateEmailTemplateCommand, EmailTemplateDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateEmailTemplateHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<EmailTemplateDto> Handle(UpdateEmailTemplateCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.EmailTemplates.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Πρότυπο");
        t.Name = request.Body.Name.Trim();
        t.Subject = request.Body.Subject.Trim();
        t.BodyHtml = request.Body.BodyHtml;
        t.BodyPlain = request.Body.BodyPlain;
        t.IsActive = request.Body.IsActive;
        // Code + language are stable identifiers — don't allow changing here.
        await _db.SaveChangesAsync(ct);
        return new EmailTemplateDto(t.Id, t.Code, t.Name, t.Subject, t.BodyHtml, t.BodyPlain, t.Language, t.IsSystem, t.IsActive);
    }
}

public class DeleteEmailTemplateHandler : IRequestHandler<DeleteEmailTemplateCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public DeleteEmailTemplateHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(DeleteEmailTemplateCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.EmailTemplates.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Πρότυπο");
        if (t.IsSystem) throw AppException.Forbidden("Δεν διαγράφεται το σύστημα πρότυπο.");
        t.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
