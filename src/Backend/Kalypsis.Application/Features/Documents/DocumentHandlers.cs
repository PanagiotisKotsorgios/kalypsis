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
    private readonly FileUploadGate _gate;
    private readonly ICurrentUser _current;

    public UploadDocumentCommandHandler(IAppDbContext db, IFileStorage storage, FileUploadGate gate, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _gate = gate;
        _current = current;
    }

    public async Task<PolicyDocumentDto> Handle(UploadDocumentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var policy = await _db.Policies.IgnoreQueryFilters()
            .Include(p => p.Customer)
            .FirstOrDefaultAsync(p => p.Id == request.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Policy");

        var safeType = await _gate.InspectAsync(
            request.FileName, request.ContentType, request.SizeBytes, request.Content, FileUploadKind.Document, ct: ct);

        var key = $"documents/{tenantId}/{policy.Id}";
        var path = await _storage.UploadAsync(key, request.FileName, safeType, request.Content, ct);

        var doc = new PolicyDocument
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyId = policy.Id,
            DocumentType = request.Type,
            FileName = Path.GetFileName(request.FileName),
            StoragePath = path,
            MimeType = safeType,
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

/* ========= Preview (inline stream) ========= */

/// <summary>
/// Same shape as DownloadDocumentQuery but the API controller flips the
/// Content-Disposition header from `attachment` to `inline` so browsers
/// render PDF / images / plain text in an iframe instead of forcing a
/// download. Reusing DownloadDocumentQuery for the actual bytes keeps
/// the auth + tenant scoping logic in exactly one place.
/// </summary>
public record PreviewDocumentQuery(Guid Id) : IRequest<(Stream Stream, string FileName, string MimeType)>;

public class PreviewDocumentQueryHandler : IRequestHandler<PreviewDocumentQuery, (Stream Stream, string FileName, string MimeType)>
{
    private readonly IMediator _mediator;
    public PreviewDocumentQueryHandler(IMediator mediator) => _mediator = mediator;
    public Task<(Stream Stream, string FileName, string MimeType)> Handle(PreviewDocumentQuery request, CancellationToken ct)
        => _mediator.Send(new DownloadDocumentQuery(request.Id), ct);
}

/* ========= Replace (swap the file, keep the row + audit trail) ========= */

/// <summary>Replaces the underlying file for an existing document without
/// creating a new row. Keeps the same id / policy link so foreign keys and
/// customer-visible URLs stay valid. Storage: uploads under a new key so
/// old versions remain recoverable from cold storage if needed.</summary>
public record ReplaceDocumentCommand(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    Stream Content) : IRequest<PolicyDocumentDto>;

public class ReplaceDocumentCommandHandler : IRequestHandler<ReplaceDocumentCommand, PolicyDocumentDto>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _gate;
    private readonly ICurrentUser _current;

    public ReplaceDocumentCommandHandler(IAppDbContext db, IFileStorage storage, FileUploadGate gate, ICurrentUser current)
    {
        _db = db;
        _storage = storage;
        _gate = gate;
        _current = current;
    }

    public async Task<PolicyDocumentDto> Handle(ReplaceDocumentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var doc = await _db.PolicyDocuments.IgnoreQueryFilters()
            .Include(d => d.Policy).ThenInclude(p => p.Customer)
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.TenantId == tenantId && d.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Document");

        var safeType = await _gate.InspectAsync(
            request.FileName, request.ContentType, request.SizeBytes, request.Content, FileUploadKind.Document, ct: ct);

        var key = $"documents/{tenantId}/{doc.PolicyId}";
        var path = await _storage.UploadAsync(key, request.FileName, safeType, request.Content, ct);

        doc.FileName   = Path.GetFileName(request.FileName);
        doc.StoragePath = path;
        doc.MimeType   = safeType;
        doc.SizeBytes  = request.SizeBytes;
        doc.UpdatedAt  = DateTime.UtcNow;
        doc.UploadedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);

        return ListDocumentsQueryHandler.ToDto(doc);
    }
}

/* ========= Patch (rename + retag without re-uploading) ========= */

public record PatchDocumentCommand(
    Guid Id,
    string? FileName,
    DocumentType? DocumentType) : IRequest<PolicyDocumentDto>;

public class PatchDocumentCommandHandler : IRequestHandler<PatchDocumentCommand, PolicyDocumentDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public PatchDocumentCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDocumentDto> Handle(PatchDocumentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var doc = await _db.PolicyDocuments.IgnoreQueryFilters()
            .Include(d => d.Policy).ThenInclude(p => p.Customer)
            .FirstOrDefaultAsync(d => d.Id == request.Id && d.TenantId == tenantId && d.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Document");

        if (!string.IsNullOrWhiteSpace(request.FileName))
        {
            // Strip any path components and cap at 200 chars — the display
            // name only. Storage path is unaffected.
            var clean = Path.GetFileName(request.FileName.Trim());
            if (clean.Length > 200) clean = clean[..200];
            if (clean.Length > 0) doc.FileName = clean;
        }
        if (request.DocumentType.HasValue) doc.DocumentType = request.DocumentType.Value;
        doc.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ListDocumentsQueryHandler.ToDto(doc);
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
