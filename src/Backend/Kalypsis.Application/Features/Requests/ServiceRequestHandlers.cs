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
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId, ct)
                ?? throw AppException.NotFound("Χρήστης");
            customerId = user.CustomerId
                ?? throw AppException.Forbidden("Ο λογαριασμός δεν είναι συνδεδεμένος με πελάτη.");
        }
        else
        {
            customerId = request.Body.CustomerId
                ?? throw new AppException("customer_required",
                    "Πρέπει να ορίσετε πελάτη.", 400,
                    title: "Λείπει ο πελάτης",
                    why: "Κάθε αίτημα/εργασία πρέπει να συνδέεται με συγκεκριμένο πελάτη ώστε να φαίνεται στο ιστορικό του και να ευθύνεται κάποιος για παρακολούθηση.",
                    fix: "Επιλέξτε πελάτη από το dropdown ή πατήστε «+ Νέος πελάτης» αν είναι πρώτη φορά.",
                    fixLink: "/app/customers");
        }

        var count = await _db.ServiceRequests
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
        _db.ServiceRequestMessages.Add(new ServiceRequestMessage
        {
            Id = Guid.NewGuid(), TenantId = tenantId, ServiceRequestId = sr.Id,
            AuthorRole = "Customer", Body = sr.Description, CreatedAt = sr.CreatedAt
        });
        await _db.SaveChangesAsync(ct);

        return await Project(_db, sr.Id, ct);
    }

    internal static async Task<ServiceRequestDto> Project(IAppDbContext db, Guid id, CancellationToken ct)
    {
        var sr = await db.ServiceRequests
            .Include(s => s.Customer)
            .Include(s => s.Attachments)
            .Include(s => s.Messages)
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
            sr.IsRead,
            sr.ReadAt,
            sr.ArchivedAt,
            sr.Attachments
                .Where(a => a.DeletedAt == null)
                .OrderBy(a => a.CreatedAt)
                .Select(a => new ServiceRequestAttachmentDto(a.Id, a.Category, a.FileName, a.MimeType, a.SizeBytes, a.CreatedAt))
                .ToList(),
            sr.Messages
                .Where(m => m.DeletedAt == null)
                .OrderBy(m => m.CreatedAt)
                .Select(m => new ServiceRequestMessageDto(m.Id, m.AuthorRole, m.Body, m.CreatedAt))
                .ToList());
    }
}

/* ========== List ========== */

public record ListServiceRequestsQuery(
    ServiceRequestStatus? Status,
    ServiceRequestType? Type,
    bool IncludeArchived = false,
    bool? IsRead = null,
    DateTime? From = null,
    DateTime? To = null,
    string? Search = null,
    string? Sort = null) : IRequest<IReadOnlyList<ServiceRequestDto>>;

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
            .Include(s => s.Customer)
            .Include(s => s.Attachments)
            .Include(s => s.Messages)
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null);

        if (!request.IncludeArchived) q = q.Where(s => s.ArchivedAt == null);
        if (request.IsRead.HasValue) q = q.Where(s => s.IsRead == request.IsRead.Value);
        if (request.From.HasValue) q = q.Where(s => s.CreatedAt >= request.From.Value);
        if (request.To.HasValue) q = q.Where(s => s.CreatedAt < request.To.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            q = q.Where(s => s.RequestNumber.Contains(term)
                || s.Subject.Contains(term)
                || s.Description.Contains(term)
                || (s.Customer.FirstName != null && s.Customer.FirstName.Contains(term))
                || (s.Customer.LastName != null && s.Customer.LastName.Contains(term))
                || (s.Customer.CompanyName != null && s.Customer.CompanyName.Contains(term)));
        }

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.CustomerId)
                .FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<ServiceRequestDto>();
            q = q.Where(s => s.CustomerId == customerId);
        }

        if (request.Status.HasValue) q = q.Where(s => s.Status == request.Status.Value);
        if (request.Type.HasValue) q = q.Where(s => s.Type == request.Type.Value);

        q = request.Sort?.ToLowerInvariant() switch
        {
            "oldest" => q.OrderBy(s => s.CreatedAt),
            "status" => q.OrderBy(s => s.Status).ThenByDescending(s => s.CreatedAt),
            "unread" => q.OrderBy(s => s.IsRead).ThenByDescending(s => s.CreatedAt),
            _ => q.OrderByDescending(s => s.CreatedAt)
        };
        var rows = await q.Take(500).ToListAsync(ct);
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
        var sr = await _db.ServiceRequests
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

public record MarkServiceRequestReadCommand(Guid Id, bool IsRead) : IRequest<ServiceRequestDto>;

public sealed class MarkServiceRequestReadCommandHandler : IRequestHandler<MarkServiceRequestReadCommand, ServiceRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public MarkServiceRequestReadCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ServiceRequestDto> Handle(MarkServiceRequestReadCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sr = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Service request");
        sr.IsRead = request.IsRead;
        sr.ReadAt = request.IsRead ? _clock.UtcNow : null;
        await _db.SaveChangesAsync(ct);
        return await CreateServiceRequestCommandHandler.Project(_db, sr.Id, ct);
    }
}

public record ArchiveServiceRequestCommand(Guid Id, bool Archived) : IRequest<ServiceRequestDto>;

public sealed class ArchiveServiceRequestCommandHandler : IRequestHandler<ArchiveServiceRequestCommand, ServiceRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ArchiveServiceRequestCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ServiceRequestDto> Handle(ArchiveServiceRequestCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sr = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Service request");
        sr.ArchivedAt = request.Archived ? _clock.UtcNow : null;
        await _db.SaveChangesAsync(ct);
        return await CreateServiceRequestCommandHandler.Project(_db, sr.Id, ct);
    }
}

public record DeleteServiceRequestCommand(Guid Id) : IRequest;

public sealed class DeleteServiceRequestCommandHandler : IRequestHandler<DeleteServiceRequestCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public DeleteServiceRequestCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task Handle(DeleteServiceRequestCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sr = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Service request");
        sr.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

public record ReplyToServiceRequestCommand(Guid Id, ReplyToServiceRequestBody Body) : IRequest<ServiceRequestDto>;

public sealed class ReplyToServiceRequestCommandHandler : IRequestHandler<ReplyToServiceRequestCommand, ServiceRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ReplyToServiceRequestCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ServiceRequestDto> Handle(ReplyToServiceRequestCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var message = request.Body.Message?.Trim();
        if (string.IsNullOrWhiteSpace(message)) throw new AppException("message_required", "Το μήνυμα απάντησης είναι υποχρεωτικό.", 400);
        if (message.Length > 4000) throw new AppException("message_too_long", "Το μήνυμα είναι πολύ μεγάλο.", 400);
        var sr = await _db.ServiceRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Service request");
        sr.IsRead = true;
        sr.ReadAt = _clock.UtcNow;
        if (request.Body.Status.HasValue) sr.Status = request.Body.Status.Value;
        _db.ServiceRequestMessages.Add(new ServiceRequestMessage
        {
            Id = Guid.NewGuid(), TenantId = tenantId, ServiceRequestId = sr.Id,
            AuthorRole = "Agency", AuthorUserId = _current.UserId, Body = message, CreatedAt = _clock.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return await CreateServiceRequestCommandHandler.Project(_db, sr.Id, ct);
    }
}
