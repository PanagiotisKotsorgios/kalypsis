using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Requests;

/* ========== Create ========== */

public record CreateServiceRequestCommand(CreateServiceRequestBody Body) : IRequest<ServiceRequestDto>;

public class CreateServiceRequestCommandValidator : AbstractValidator<CreateServiceRequestCommand>
{
    public CreateServiceRequestCommandValidator()
    {
        RuleFor(x => x.Body.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Body.Description).NotEmpty().MaximumLength(4000);
        When(x => x.Body.Type == ServiceRequestType.AccidentReport, () =>
        {
            RuleFor(x => x.Body.IncidentDate).NotNull();
            RuleFor(x => x.Body.IncidentLocation).NotEmpty();
        });
    }
}

public class CreateServiceRequestCommandHandler : IRequestHandler<CreateServiceRequestCommand, ServiceRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CreateServiceRequestCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ServiceRequestDto> Handle(CreateServiceRequestCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        Guid customerId;
        if (_current.Role == Role.Customer)
        {
            // Customer: lookup the linked Customer record via user.CustomerId
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var user = await _db.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Id == userId, ct)
                ?? throw AppException.NotFound("Χρήστης");
            customerId = user.CustomerId
                ?? throw AppException.Forbidden("Ο λογαριασμός δεν είναι συνδεδεμένος με πελάτη.");
        }
        else
        {
            customerId = request.Body.CustomerId
                ?? throw AppException.Validation("Πρέπει να ορίσετε πελάτη.");
        }

        var count = await _db.ServiceRequests.IgnoreQueryFilters()
            .CountAsync(s => s.TenantId == tenantId, ct);
        var number = $"SR-{(count + 1):D6}";

        var sr = new ServiceRequest
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RequestNumber = number,
            CustomerId = customerId,
            Type = request.Body.Type,
            Status = ServiceRequestStatus.Submitted,
            Subject = request.Body.Subject.Trim(),
            Description = request.Body.Description.Trim(),
            RelatedPolicyId = request.Body.RelatedPolicyId,
            IncidentDate = request.Body.IncidentDate,
            IncidentLocation = request.Body.IncidentLocation?.Trim(),
            OtherPartyInfo = request.Body.OtherPartyInfo?.Trim()
        };
        _db.ServiceRequests.Add(sr);
        await _db.SaveChangesAsync(ct);

        return await Project(_db, sr.Id, ct);
    }

    internal static async Task<ServiceRequestDto> Project(IAppDbContext db, Guid id, CancellationToken ct)
    {
        var sr = await db.ServiceRequests.IgnoreQueryFilters()
            .Include(s => s.Customer)
            .Include(s => s.Attachments)
            .FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("Service request");

        return ToDto(sr);
    }

    internal static ServiceRequestDto ToDto(ServiceRequest sr)
    {
        var display = sr.Customer is null
            ? string.Empty
            : sr.Customer.Type == CustomerType.Individual
                ? $"{sr.Customer.FirstName} {sr.Customer.LastName}".Trim()
                : sr.Customer.CompanyName ?? "—";

        return new ServiceRequestDto(
            sr.Id,
            sr.RequestNumber,
            sr.CustomerId,
            display,
            sr.Type,
            sr.Status,
            sr.Subject,
            sr.Description,
            sr.RelatedPolicyId,
            sr.IncidentDate,
            sr.IncidentLocation,
            sr.OtherPartyInfo,
            sr.AgencyNotes,
            sr.CreatedAt,
            sr.ResolvedAt,
            sr.Attachments
                .Where(a => a.DeletedAt == null)
                .OrderBy(a => a.CreatedAt)
                .Select(a => new ServiceRequestAttachmentDto(a.Id, a.Category, a.FileName, a.MimeType, a.SizeBytes, a.CreatedAt))
                .ToList());
    }
}

/* ========== List ========== */

public record ListServiceRequestsQuery(ServiceRequestStatus? Status, ServiceRequestType? Type) : IRequest<IReadOnlyList<ServiceRequestDto>>;

public class ListServiceRequestsQueryHandler : IRequestHandler<ListServiceRequestsQuery, IReadOnlyList<ServiceRequestDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListServiceRequestsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ServiceRequestDto>> Handle(ListServiceRequestsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.ServiceRequests
            .IgnoreQueryFilters()
            .Include(s => s.Customer)
            .Include(s => s.Attachments)
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId)
                .Select(u => u.CustomerId)
                .FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<ServiceRequestDto>();
            q = q.Where(s => s.CustomerId == customerId);
        }

        if (request.Status.HasValue) q = q.Where(s => s.Status == request.Status.Value);
        if (request.Type.HasValue) q = q.Where(s => s.Type == request.Type.Value);

        var rows = await q.OrderByDescending(s => s.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(CreateServiceRequestCommandHandler.ToDto).ToList();
    }
}

/* ========== Update status / notes ========== */

public record UpdateServiceRequestStatusCommand(Guid Id, UpdateServiceRequestStatusBody Body) : IRequest<ServiceRequestDto>;

public class UpdateServiceRequestStatusCommandHandler : IRequestHandler<UpdateServiceRequestStatusCommand, ServiceRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public UpdateServiceRequestStatusCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<ServiceRequestDto> Handle(UpdateServiceRequestStatusCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sr = await _db.ServiceRequests.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Service request");

        sr.Status = request.Body.Status;
        sr.AgencyNotes = request.Body.AgencyNotes?.Trim();
        sr.AssignedToUserId = request.Body.AssignedToUserId;
        if (request.Body.Status is ServiceRequestStatus.Resolved or ServiceRequestStatus.Closed
            && sr.ResolvedAt is null)
        {
            sr.ResolvedAt = _clock.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return await CreateServiceRequestCommandHandler.Project(_db, sr.Id, ct);
    }
}
