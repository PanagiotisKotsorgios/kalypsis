using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Documents;

/* ========= List ========= */

public record ListDocumentsQuery(Guid? PolicyId, Guid? CustomerId) : IRequest<IReadOnlyList<PolicyDocumentDto>>;

public class ListDocumentsQueryHandler : IRequestHandler<ListDocumentsQuery, IReadOnlyList<PolicyDocumentDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListDocumentsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<PolicyDocumentDto>> Handle(ListDocumentsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.PolicyDocuments
            .IgnoreQueryFilters()
            .Include(d => d.Policy).ThenInclude(p => p.Customer)
            .Where(d => d.TenantId == tenantId && d.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<PolicyDocumentDto>();
            q = q.Where(d => d.Policy.CustomerId == customerId);
        }

        if (request.PolicyId.HasValue) q = q.Where(d => d.PolicyId == request.PolicyId.Value);
        if (request.CustomerId.HasValue) q = q.Where(d => d.Policy.CustomerId == request.CustomerId.Value);

        var rows = await q.OrderByDescending(d => d.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    internal static PolicyDocumentDto ToDto(PolicyDocument d)
    {
        var c = d.Policy?.Customer;
        var display = c is null
            ? string.Empty
            : c.Type == CustomerType.Individual
                ? $"{c.FirstName} {c.LastName}".Trim()
                : c.CompanyName ?? "—";

        return new PolicyDocumentDto(
            d.Id,
            d.PolicyId,
            d.Policy?.PolicyNumber ?? string.Empty,
            c?.Id ?? Guid.Empty,
            display,
            d.DocumentType,
            d.FileName,
            d.MimeType,
            d.SizeBytes,
            d.CreatedAt);
    }
}

/* ========= Upload ========= */

public record UploadDocumentCommand(
    Guid PolicyId,
    DocumentType Type,
    string FileName,
    string ContentType,
    long SizeBytes,
    Stream Content) : IRequest<PolicyDocumentDto>;

public class UploadDocumentCommandHandler : IRequestHandler<UploadDocumentCommand, PolicyDocumentDto>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public UploadDocumentCommandHandler(IAppDbContext db, IFileStorage storage, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _current = current;
    }

    public async Task<PolicyDocumentDto> Handle(UploadDocumentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var policy = await _db.Policies.IgnoreQueryFilters()
            .Include(p => p.Customer)
            .FirstOrDefaultAsync(p => p.Id == request.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Policy");

        var key = $"documents/{tenantId}/{policy.Id}";
        var path = await _storage.UploadAsync(key, request.FileName, request.ContentType, request.Content, ct);

        var doc = new PolicyDocument
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyId = policy.Id,
            DocumentType = request.Type,
            FileName = Path.GetFileName(request.FileName),
            StoragePath = path,
            MimeType = string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType,
            SizeBytes = request.SizeBytes,
            UploadedByUserId = _current.UserId
        };
        _db.PolicyDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);

        return ListDocumentsQueryHandler.ToDto(new PolicyDocument
        {
            Id = doc.Id, TenantId = tenantId, PolicyId = doc.PolicyId,
            DocumentType = doc.DocumentType, FileName = doc.FileName,
            MimeType = doc.MimeType, SizeBytes = doc.SizeBytes,
            CreatedAt = doc.CreatedAt, Policy = policy
        });
    }
}

/* ========= Download ========= */

public record DownloadDocumentQuery(Guid Id) : IRequest<(Stream Stream, string FileName, string MimeType)>;

public class DownloadDocumentQueryHandler : IRequestHandler<DownloadDocumentQuery, (Stream Stream, string FileName, string MimeType)>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public DownloadDocumentQueryHandler(IAppDbContext db, IFileStorage storage, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _current = current;
    }

    public async Task<(Stream Stream, string FileName, string MimeType)> Handle(DownloadDocumentQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var doc = await _db.PolicyDocuments.IgnoreQueryFilters()
            .Include(d => d.Policy)
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.TenantId == tenantId && d.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Document");

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId != doc.Policy.CustomerId) throw AppException.Forbidden();
        }

        var stream = await _storage.DownloadAsync(doc.StoragePath, ct);
        return (stream, doc.FileName, doc.MimeType);
    }
}

/* ========= Delete ========= */

public record DeleteDocumentCommand(Guid Id) : IRequest<Unit>;

public class DeleteDocumentCommandHandler : IRequestHandler<DeleteDocumentCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public DeleteDocumentCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<Unit> Handle(DeleteDocumentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var doc = await _db.PolicyDocuments.IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.TenantId == tenantId && d.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Document");

        doc.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
