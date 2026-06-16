using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Tasks;

public record AgencyTaskDto(
    Guid Id,
    string Title,
    string? Description,
    AgencyTaskStatus Status,
    AgencyTaskPriority Priority,
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    Guid? CustomerId,
    string? CustomerDisplay,
    Guid? PolicyId,
    string? PolicyNumber,
    DateTime? DueAt,
    DateTime? CompletedAt,
    DateTime CreatedAt);

public record CreateAgencyTaskBody(
    string Title,
    string? Description,
    AgencyTaskPriority Priority,
    Guid? AssignedToUserId,
    Guid? CustomerId,
    Guid? PolicyId,
    DateTime? DueAt);

public record UpdateAgencyTaskBody(
    string Title,
    string? Description,
    AgencyTaskStatus Status,
    AgencyTaskPriority Priority,
    Guid? AssignedToUserId,
    Guid? CustomerId,
    Guid? PolicyId,
    DateTime? DueAt);

internal static class TaskProjection
{
    public static AgencyTaskDto ToDto(AgencyTask t, string? assignedName, string? customerDisplay, string? policyNumber) =>
        new(t.Id, t.Title, t.Description, t.Status, t.Priority, t.AssignedToUserId, assignedName,
            t.CustomerId, customerDisplay, t.PolicyId, policyNumber, t.DueAt, t.CompletedAt, t.CreatedAt);
}

/* ========= List ========= */

public record ListTasksQuery(AgencyTaskStatus? Status, Guid? AssignedToUserId) : IRequest<IReadOnlyList<AgencyTaskDto>>;

public class ListTasksQueryHandler : IRequestHandler<ListTasksQuery, IReadOnlyList<AgencyTaskDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListTasksQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<AgencyTaskDto>> Handle(ListTasksQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.AgencyTasks.IgnoreQueryFilters()
            .Include(t => t.AssignedToUser)
            .Include(t => t.Customer)
            .Include(t => t.Policy)
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null);

        if (request.Status.HasValue) q = q.Where(t => t.Status == request.Status.Value);
        if (request.AssignedToUserId.HasValue) q = q.Where(t => t.AssignedToUserId == request.AssignedToUserId.Value);

        var rows = await q.OrderBy(t => t.Status).ThenBy(t => t.DueAt ?? DateTime.MaxValue).Take(500).ToListAsync(ct);
        return rows.Select(t =>
        {
            var assigned = t.AssignedToUser is null ? null : $"{t.AssignedToUser.FirstName} {t.AssignedToUser.LastName}".Trim();
            var customer = t.Customer is null
                ? null
                : t.Customer.Type == CustomerType.Individual
                    ? $"{t.Customer.FirstName} {t.Customer.LastName}".Trim()
                    : t.Customer.CompanyName;
            var policyNumber = t.Policy?.PolicyNumber;
            return TaskProjection.ToDto(t, assigned, customer, policyNumber);
        }).ToList();
    }
}

/* ========= Create / Update / Delete ========= */

public record CreateAgencyTaskCommand(CreateAgencyTaskBody Body) : IRequest<AgencyTaskDto>;

public class CreateAgencyTaskCommandValidator : AbstractValidator<CreateAgencyTaskCommand>
{
    public CreateAgencyTaskCommandValidator()
    {
        RuleFor(x => x.Body.Title).NotEmpty().MaximumLength(200);
    }
}

public class CreateAgencyTaskCommandHandler : IRequestHandler<CreateAgencyTaskCommand, AgencyTaskDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateAgencyTaskCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<AgencyTaskDto> Handle(CreateAgencyTaskCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = new AgencyTask
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Body.Title.Trim(),
            Description = request.Body.Description?.Trim(),
            Status = AgencyTaskStatus.Open,
            Priority = request.Body.Priority,
            AssignedToUserId = request.Body.AssignedToUserId,
            CustomerId = request.Body.CustomerId,
            PolicyId = request.Body.PolicyId,
            DueAt = request.Body.DueAt
        };
        _db.AgencyTasks.Add(t);
        await _db.SaveChangesAsync(ct);
        return await Reload(_db, t.Id, ct);
    }

    internal static async Task<AgencyTaskDto> Reload(IAppDbContext db, Guid id, CancellationToken ct)
    {
        var t = await db.AgencyTasks.IgnoreQueryFilters()
            .Include(x => x.AssignedToUser).Include(x => x.Customer).Include(x => x.Policy)
            .FirstAsync(x => x.Id == id, ct);
        var assigned = t.AssignedToUser is null ? null : $"{t.AssignedToUser.FirstName} {t.AssignedToUser.LastName}".Trim();
        var customer = t.Customer is null
            ? null
            : t.Customer.Type == CustomerType.Individual
                ? $"{t.Customer.FirstName} {t.Customer.LastName}".Trim()
                : t.Customer.CompanyName;
        return TaskProjection.ToDto(t, assigned, customer, t.Policy?.PolicyNumber);
    }
}

public record UpdateAgencyTaskCommand(Guid Id, UpdateAgencyTaskBody Body) : IRequest<AgencyTaskDto>;

public class UpdateAgencyTaskCommandHandler : IRequestHandler<UpdateAgencyTaskCommand, AgencyTaskDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public UpdateAgencyTaskCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<AgencyTaskDto> Handle(UpdateAgencyTaskCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.AgencyTasks.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Εργασία");

        var b = request.Body;
        t.Title = b.Title.Trim();
        t.Description = b.Description?.Trim();
        if (t.Status != b.Status && b.Status == AgencyTaskStatus.Completed) t.CompletedAt = _clock.UtcNow;
        if (b.Status != AgencyTaskStatus.Completed) t.CompletedAt = null;
        t.Status = b.Status;
        t.Priority = b.Priority;
        t.AssignedToUserId = b.AssignedToUserId;
        t.CustomerId = b.CustomerId;
        t.PolicyId = b.PolicyId;
        t.DueAt = b.DueAt;
        await _db.SaveChangesAsync(ct);
        return await CreateAgencyTaskCommandHandler.Reload(_db, t.Id, ct);
    }
}

public record DeleteAgencyTaskCommand(Guid Id) : IRequest<Unit>;

public class DeleteAgencyTaskCommandHandler : IRequestHandler<DeleteAgencyTaskCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteAgencyTaskCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteAgencyTaskCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.AgencyTasks.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Εργασία");
        t.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
