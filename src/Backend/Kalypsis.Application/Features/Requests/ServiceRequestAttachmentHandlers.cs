using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Requests;

public record UploadAttachmentCommand(
    Guid ServiceRequestId,
    AttachmentCategory Category,
    string FileName,
    string ContentType,
    long SizeBytes,
    Stream Content) : IRequest<ServiceRequestAttachmentDto>;

public class UploadAttachmentCommandHandler : IRequestHandler<UploadAttachmentCommand, ServiceRequestAttachmentDto>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _gate;
    private readonly ICurrentUser _current;

    public UploadAttachmentCommandHandler(IAppDbContext db, IFileStorage storage, FileUploadGate gate, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _gate = gate;
        _current = current;
    }

    public async Task<ServiceRequestAttachmentDto> Handle(UploadAttachmentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sr = await _db.ServiceRequests.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == request.ServiceRequestId && s.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Service request");

        // Customers can only attach to their own requests.
        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId != sr.CustomerId) throw AppException.Forbidden();
        }

        var safeType = await _gate.InspectAsync(
            request.FileName, request.ContentType, request.SizeBytes, request.Content, FileUploadKind.Document, ct: ct);

        var key = $"requests/{tenantId}/{sr.Id}";
        var path = await _storage.UploadAsync(key, request.FileName, safeType, request.Content, ct);

        var att = new ServiceRequestAttachment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ServiceRequestId = sr.Id,
            Category = request.Category,
            FileName = Path.GetFileName(request.FileName),
            StoragePath = path,
            MimeType = safeType,
            SizeBytes = request.SizeBytes,
            UploadedByUserId = _current.UserId
        };
        _db.ServiceRequestAttachments.Add(att);
        await _db.SaveChangesAsync(ct);

        return new ServiceRequestAttachmentDto(att.Id, att.Category, att.FileName, att.MimeType, att.SizeBytes, att.CreatedAt);
    }
}

public record DownloadAttachmentQuery(Guid AttachmentId) : IRequest<(Stream Content, string FileName, string MimeType)>;

public class DownloadAttachmentQueryHandler : IRequestHandler<DownloadAttachmentQuery, (Stream Content, string FileName, string MimeType)>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public DownloadAttachmentQueryHandler(IAppDbContext db, IFileStorage storage, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _current = current;
    }

    public async Task<(Stream Content, string FileName, string MimeType)> Handle(DownloadAttachmentQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var att = await _db.ServiceRequestAttachments.IgnoreQueryFilters()
            .Include(a => a.ServiceRequest)
            .FirstOrDefaultAsync(a => a.Id == request.AttachmentId && a.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Attachment");

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId != att.ServiceRequest.CustomerId) throw AppException.Forbidden();
        }

        var stream = await _storage.DownloadAsync(att.StoragePath, ct);
        return (stream, att.FileName, att.MimeType);
    }
}
