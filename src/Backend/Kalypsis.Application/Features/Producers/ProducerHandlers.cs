using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerDto(
    Guid Id, string Code, string Name, string? Email, string? Phone,
    ProducerStatus Status, int PolicyCount, DateTime CreatedAt);

public record CreateProducerBody(string Code, string Name, string? Email, string? Phone, ProducerStatus Status);
public record UpdateProducerBody(string Code, string Name, string? Email, string? Phone, ProducerStatus Status);

/* ========= List ========= */

public record ListProducersQuery() : IRequest<IReadOnlyList<ProducerDto>>;

public class ListProducersQueryHandler : IRequestHandler<ListProducersQuery, IReadOnlyList<ProducerDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListProducersQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ProducerDto>> Handle(ListProducersQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .OrderBy(p => p.Name)
            .Select(p => new ProducerDto(
                p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status,
                _db.Policies.IgnoreQueryFilters().Count(x => x.ProducerId == p.Id && x.DeletedAt == null),
                p.CreatedAt))
            .ToListAsync(ct);
        return rows;
    }
}

/* ========= Create ========= */

public record CreateProducerCommand(CreateProducerBody Body) : IRequest<ProducerDto>;

public class CreateProducerCommandValidator : AbstractValidator<CreateProducerCommand>
{
    public CreateProducerCommandValidator()
    {
        RuleFor(x => x.Body.Code).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Body.Name).NotEmpty().MaximumLength(200);
    }
}

public class CreateProducerCommandHandler : IRequestHandler<CreateProducerCommand, ProducerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerDto> Handle(CreateProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = request.Body;
        var code = b.Code.Trim().ToUpperInvariant();
        if (await _db.Producers.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenantId && p.Code == code && p.DeletedAt == null, ct))
            throw AppException.Conflict($"Παραγωγός με κωδικό {code} υπάρχει ήδη.");

        var p = new Producer
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Code = code, Name = b.Name.Trim(),
            Email = b.Email?.Trim().ToLowerInvariant(), Phone = b.Phone?.Trim(),
            Status = b.Status
        };
        _db.Producers.Add(p);
        await _db.SaveChangesAsync(ct);
        return new ProducerDto(p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status, 0, p.CreatedAt);
    }
}

/* ========= Update ========= */

public record UpdateProducerCommand(Guid Id, UpdateProducerBody Body) : IRequest<ProducerDto>;

public class UpdateProducerCommandHandler : IRequestHandler<UpdateProducerCommand, ProducerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerDto> Handle(UpdateProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραγωγός");

        var b = request.Body;
        p.Code = b.Code.Trim().ToUpperInvariant();
        p.Name = b.Name.Trim();
        p.Email = b.Email?.Trim().ToLowerInvariant();
        p.Phone = b.Phone?.Trim();
        p.Status = b.Status;
        await _db.SaveChangesAsync(ct);

        var count = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(x => x.ProducerId == p.Id && x.DeletedAt == null, ct);
        return new ProducerDto(p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status, count, p.CreatedAt);
    }
}

/* ========= Delete ========= */

public record DeleteProducerCommand(Guid Id) : IRequest<Unit>;

public class DeleteProducerCommandHandler : IRequestHandler<DeleteProducerCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραγωγός");
        p.DeletedAt = DateTime.UtcNow;
        p.Status = ProducerStatus.Terminated;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
