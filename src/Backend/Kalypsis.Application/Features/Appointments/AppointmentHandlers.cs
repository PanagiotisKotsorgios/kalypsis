using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Appointments;

public record AppointmentDto(
    Guid Id, string Title, string? Description, string? Location,
    DateTime StartsAt, DateTime EndsAt, AppointmentStatus Status,
    Guid? AssignedToUserId, string? AssignedToUserName,
    Guid? CustomerId, string? CustomerName,
    Guid? PolicyId, string? PolicyNumber);

public record AppointmentBody(
    string Title, string? Description, string? Location,
    DateTime StartsAt, DateTime EndsAt,
    AppointmentStatus Status,
    Guid? AssignedToUserId, Guid? CustomerId, Guid? PolicyId);

public record ListAppointmentsQuery(DateTime? From, DateTime? To, Guid? UserId, Guid? CustomerId) : IRequest<IReadOnlyList<AppointmentDto>>;

public class ListAppointmentsQueryHandler : IRequestHandler<ListAppointmentsQuery, IReadOnlyList<AppointmentDto>>
{
    private readonly IAppDbContext _db;
    public ListAppointmentsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<AppointmentDto>> Handle(ListAppointmentsQuery r, CancellationToken ct)
    {
        var q = _db.Appointments
            .Include(a => a.AssignedToUser)
            .Include(a => a.Customer)
            .Include(a => a.Policy)
            .AsQueryable();

        if (r.From.HasValue) q = q.Where(a => a.EndsAt >= r.From.Value);
        if (r.To.HasValue) q = q.Where(a => a.StartsAt <= r.To.Value);
        if (r.UserId.HasValue) q = q.Where(a => a.AssignedToUserId == r.UserId);
        if (r.CustomerId.HasValue) q = q.Where(a => a.CustomerId == r.CustomerId);

        var rows = await q.OrderBy(a => a.StartsAt).Take(1000).ToListAsync(ct);
        return rows.Select(a => Map(a)).ToList();
    }

    internal static AppointmentDto Map(Appointment a)
    {
        var customerName = a.Customer is null ? null
            : a.Customer.Type == CustomerType.Individual
                ? $"{a.Customer.FirstName} {a.Customer.LastName}".Trim()
                : a.Customer.CompanyName;

        var userName = a.AssignedToUser is null ? null : $"{a.AssignedToUser.FirstName} {a.AssignedToUser.LastName}".Trim();

        return new AppointmentDto(
            a.Id, a.Title, a.Description, a.Location,
            a.StartsAt, a.EndsAt, a.Status,
            a.AssignedToUserId, userName,
            a.CustomerId, customerName,
            a.PolicyId, a.Policy?.PolicyNumber);
    }
}

public record CreateAppointmentCommand(AppointmentBody Body) : IRequest<AppointmentDto>;

public class AppointmentBodyValidator : AbstractValidator<AppointmentBody>
{
    public AppointmentBodyValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.StartsAt).LessThan(x => x.EndsAt).WithMessage("Η έναρξη πρέπει να είναι πριν τη λήξη.");
    }
}

public class CreateAppointmentCommandValidator : AbstractValidator<CreateAppointmentCommand>
{
    public CreateAppointmentCommandValidator() { RuleFor(x => x.Body).SetValidator(new AppointmentBodyValidator()); }
}

public class CreateAppointmentCommandHandler : IRequestHandler<CreateAppointmentCommand, AppointmentDto>
{
    private readonly IAppDbContext _db;
    public CreateAppointmentCommandHandler(IAppDbContext db) => _db = db;

    public async Task<AppointmentDto> Handle(CreateAppointmentCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var a = new Appointment
        {
            Id = Guid.NewGuid(),
            Title = b.Title.Trim(),
            Description = b.Description,
            Location = b.Location,
            StartsAt = b.StartsAt,
            EndsAt = b.EndsAt,
            Status = b.Status,
            AssignedToUserId = b.AssignedToUserId,
            CustomerId = b.CustomerId,
            PolicyId = b.PolicyId
        };
        _db.Appointments.Add(a);
        await _db.SaveChangesAsync(ct);

        a = await _db.Appointments
            .Include(x => x.AssignedToUser).Include(x => x.Customer).Include(x => x.Policy)
            .FirstAsync(x => x.Id == a.Id, ct);
        return ListAppointmentsQueryHandler.Map(a);
    }
}

public record UpdateAppointmentCommand(Guid Id, AppointmentBody Body) : IRequest<AppointmentDto>;

public class UpdateAppointmentCommandValidator : AbstractValidator<UpdateAppointmentCommand>
{
    public UpdateAppointmentCommandValidator() { RuleFor(x => x.Body).SetValidator(new AppointmentBodyValidator()); }
}

public class UpdateAppointmentCommandHandler : IRequestHandler<UpdateAppointmentCommand, AppointmentDto>
{
    private readonly IAppDbContext _db;
    public UpdateAppointmentCommandHandler(IAppDbContext db) => _db = db;

    public async Task<AppointmentDto> Handle(UpdateAppointmentCommand r, CancellationToken ct)
    {
        var a = await _db.Appointments.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Appointment");
        var b = r.Body;
        a.Title = b.Title.Trim();
        a.Description = b.Description;
        a.Location = b.Location;
        a.StartsAt = b.StartsAt;
        a.EndsAt = b.EndsAt;
        a.Status = b.Status;
        a.AssignedToUserId = b.AssignedToUserId;
        a.CustomerId = b.CustomerId;
        a.PolicyId = b.PolicyId;
        await _db.SaveChangesAsync(ct);

        a = await _db.Appointments
            .Include(x => x.AssignedToUser).Include(x => x.Customer).Include(x => x.Policy)
            .FirstAsync(x => x.Id == a.Id, ct);
        return ListAppointmentsQueryHandler.Map(a);
    }
}

public record DeleteAppointmentCommand(Guid Id) : IRequest<Unit>;

public class DeleteAppointmentCommandHandler : IRequestHandler<DeleteAppointmentCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteAppointmentCommandHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(DeleteAppointmentCommand r, CancellationToken ct)
    {
        var a = await _db.Appointments.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Appointment");
        a.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
