using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Api.Authorization;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// The production-side working file for an insurance company. It is kept
/// separate from carrier parameterisation: folders, files, contacts and
/// office-defined fields belong to the tenant and never alter the catalogue.
/// </summary>
[ApiController]
[Route("api/insurance-companies/{companyId:guid}/workspace")]
[Authorize(Policy = "AgencyStaff")]
public sealed class InsuranceCompanyRecordsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _gate;
    private readonly IDateTimeProvider _clock;

    public InsuranceCompanyRecordsController(AppDbContext db, ICurrentUser current,
        IFileStorage storage, FileUploadGate gate, IDateTimeProvider clock)
    { _db = db; _current = current; _storage = storage; _gate = gate; _clock = clock; }

    public record FolderDto(Guid Id, string Name, string? Description, Guid? ParentFolderId,
        string Color, int DocumentCount, DateTime CreatedAt);
    public record DocumentDto(Guid Id, Guid? FolderId, string FileName, string MimeType,
        long SizeBytes, string Category, string? Description, string[] Tags,
        DateOnly? DocumentDate, DateOnly? ExpiresOn, bool IsConfidential,
        Guid? UploadedByUserId, DateTime CreatedAt);
    public record FieldDefinitionDto(Guid Id, string Key, string Label, string FieldType,
        string[] Options, bool IsRequired, bool IsActive, int SortOrder, string? Value);
    public record CategoryDto(Guid Id, string Name, string Color, bool IsActive, int SortOrder, int DocumentCount);
    public record ContactDto(Guid Id, string Name, string? Role, string? Department,
        string? Email, string? Phone, string? Mobile, string? Notes, string PreferredChannel,
        bool IsPrimary, bool IsActive);
    public record WorkspaceDto(IReadOnlyList<FolderDto> Folders,
        IReadOnlyList<DocumentDto> Documents, IReadOnlyList<FieldDefinitionDto> Fields,
        IReadOnlyList<CategoryDto> Categories, IReadOnlyList<ContactDto> Contacts);

    public record FolderBody(string Name, string? Description, Guid? ParentFolderId,
        string? Color, int SortOrder = 0);
    public record FieldBody(string Label, string Key, string FieldType,
        string[]? Options, bool IsRequired, int SortOrder = 0);
    public record CategoryBody(string Name, string? Color, int SortOrder = 0);
    public record ContactBody(string Name, string? Role, string? Department, string? Email,
        string? Phone, string? Mobile, string? Notes, string PreferredChannel = "Email",
        bool IsPrimary = false);

    private Guid TenantId => _current.TenantId ?? throw AppException.Forbidden();

    private async Task<InsuranceCompany> Company(Guid companyId, CancellationToken ct)
        => await _db.InsuranceCompanies.IgnoreQueryFilters()
               .FirstOrDefaultAsync(c => c.Id == companyId && c.DeletedAt == null
                   && (c.TenantId == null || c.TenantId == TenantId), ct)
           ?? throw AppException.NotFound("Ασφαλιστική εταιρεία");

    [HttpGet]
    [RequirePermission("documents.read")]
    public async Task<ActionResult<WorkspaceDto>> Workspace(Guid companyId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var folders = await _db.InsuranceCompanyFolders
            .Where(f => f.InsuranceCompanyId == companyId)
            .OrderBy(f => f.SortOrder).ThenBy(f => f.Name)
            .Select(f => new FolderDto(f.Id, f.Name, f.Description, f.ParentFolderId,
                f.Color, _db.InsuranceCompanyDocuments.Count(d => d.FolderId == f.Id), f.CreatedAt))
            .ToListAsync(ct);
        var docRows = await _db.InsuranceCompanyDocuments
            .Where(d => d.InsuranceCompanyId == companyId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct);
        var docs = docRows.Select(d => new DocumentDto(d.Id, d.FolderId, d.FileName, d.MimeType,
            d.SizeBytes, d.Category, d.Description, ParseTags(d.TagsJson),
            d.DocumentDate, d.ExpiresOn, d.IsConfidential, d.UploadedByUserId, d.CreatedAt)).ToList();
        var defs = await _db.InsuranceCompanyFieldDefinitions
            .Where(d => d.InsuranceCompanyId == companyId && d.IsActive)
            .OrderBy(d => d.SortOrder).ThenBy(d => d.Label)
            .Select(d => new
            {
                d.Id, d.Key, d.Label, d.FieldType, d.OptionsJson,
                d.IsRequired, d.IsActive, d.SortOrder,
                Value = _db.InsuranceCompanyFieldValues
                    .Where(v => v.DefinitionId == d.Id).Select(v => v.Value).FirstOrDefault()
            }).ToListAsync(ct);
        var categories = await _db.InsuranceCompanyCategories
            .Where(c => c.InsuranceCompanyId == companyId && c.IsActive)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Color, c.IsActive, c.SortOrder,
                _db.InsuranceCompanyDocuments.Count(d => d.InsuranceCompanyId == companyId && d.Category == c.Name)))
            .ToListAsync(ct);
        var contacts = await _db.InsuranceCompanyContacts
            .Where(c => c.InsuranceCompanyId == companyId && c.IsActive)
            .OrderByDescending(c => c.IsPrimary).ThenBy(c => c.Name)
            .Select(c => new ContactDto(c.Id, c.Name, c.Role, c.Department, c.Email, c.Phone,
                c.Mobile, c.Notes, c.PreferredChannel, c.IsPrimary, c.IsActive)).ToListAsync(ct);
        return Ok(new WorkspaceDto(folders, docs, defs.Select(d => new FieldDefinitionDto(
            d.Id, d.Key, d.Label, d.FieldType,
            string.IsNullOrWhiteSpace(d.OptionsJson) ? Array.Empty<string>() : JsonSerializer.Deserialize<string[]>(d.OptionsJson!)!,
            d.IsRequired, d.IsActive, d.SortOrder, d.Value)).ToList(), categories, contacts));
    }

    [HttpPost("folders")]
    [RequirePermission("documents.write")]
    public async Task<ActionResult<FolderDto>> CreateFolder(Guid companyId, [FromBody] FolderBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα φακέλου είναι υποχρεωτικό.");
        if (body.ParentFolderId.HasValue && !await _db.InsuranceCompanyFolders.AnyAsync(f => f.Id == body.ParentFolderId && f.InsuranceCompanyId == companyId, ct))
            throw AppException.Validation("Ο γονικός φάκελος δεν βρέθηκε.");
        var folder = new InsuranceCompanyFolder
        {
            Id = Guid.NewGuid(), InsuranceCompanyId = companyId, Name = body.Name.Trim(),
            Description = body.Description?.Trim(), ParentFolderId = body.ParentFolderId,
            Color = string.IsNullOrWhiteSpace(body.Color) ? "#0b2545" : body.Color.Trim(), SortOrder = body.SortOrder,
            CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanyFolders.Add(folder);
        await _db.SaveChangesAsync(ct);
        return Ok(new FolderDto(folder.Id, folder.Name, folder.Description, folder.ParentFolderId, folder.Color, 0, folder.CreatedAt));
    }

    [HttpPut("folders/{folderId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> UpdateFolder(Guid companyId, Guid folderId, [FromBody] FolderBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        var folder = await _db.InsuranceCompanyFolders.FirstOrDefaultAsync(f => f.Id == folderId && f.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Φάκελος");
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα φακέλου είναι υποχρεωτικό.");
        folder.Name = body.Name.Trim(); folder.Description = body.Description?.Trim(); folder.Color = string.IsNullOrWhiteSpace(body.Color) ? folder.Color : body.Color.Trim(); folder.SortOrder = body.SortOrder;
        if (body.ParentFolderId != folder.Id) folder.ParentFolderId = body.ParentFolderId;
        await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("folders/{folderId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> DeleteFolder(Guid companyId, Guid folderId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var folder = await _db.InsuranceCompanyFolders.FirstOrDefaultAsync(f => f.Id == folderId && f.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Φάκελος");
        var children = await _db.InsuranceCompanyFolders.Where(f => f.ParentFolderId == folderId).ToListAsync(ct);
        foreach (var child in children) child.ParentFolderId = folder.ParentFolderId;
        var docs = await _db.InsuranceCompanyDocuments.Where(d => d.FolderId == folderId).ToListAsync(ct);
        foreach (var doc in docs) doc.FolderId = folder.ParentFolderId;
        folder.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("categories")]
    [RequirePermission("documents.write")]
    public async Task<ActionResult<CategoryDto>> CreateCategory(Guid companyId, [FromBody] CategoryBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα κατηγορίας είναι υποχρεωτικό.");
        var name = body.Name.Trim();
        if (await _db.InsuranceCompanyCategories.AnyAsync(c => c.InsuranceCompanyId == companyId && c.IsActive && c.Name == name, ct))
            throw AppException.Validation("Υπάρχει ήδη αυτή η κατηγορία.");
        var category = new InsuranceCompanyCategory { Id = Guid.NewGuid(), InsuranceCompanyId = companyId, Name = name,
            Color = string.IsNullOrWhiteSpace(body.Color) ? "#1976d2" : body.Color.Trim(), SortOrder = body.SortOrder, CreatedAt = _clock.UtcNow };
        _db.InsuranceCompanyCategories.Add(category); await _db.SaveChangesAsync(ct);
        return Ok(new CategoryDto(category.Id, category.Name, category.Color, true, category.SortOrder, 0));
    }

    [HttpDelete("categories/{categoryId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> DeleteCategory(Guid companyId, Guid categoryId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var category = await _db.InsuranceCompanyCategories.FirstOrDefaultAsync(c => c.Id == categoryId && c.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Κατηγορία");
        category.IsActive = false; category.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("contacts")]
    [RequirePermission("documents.write")]
    public async Task<ActionResult<ContactDto>> CreateContact(Guid companyId, [FromBody] ContactBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα επαφής είναι υποχρεωτικό.");
        if (body.IsPrimary) await _db.InsuranceCompanyContacts.Where(c => c.InsuranceCompanyId == companyId && c.IsActive).ForEachAsync(c => c.IsPrimary = false, ct);
        var contact = new InsuranceCompanyContact { Id = Guid.NewGuid(), InsuranceCompanyId = companyId, Name = body.Name.Trim(), Role = body.Role?.Trim(), Department = body.Department?.Trim(), Email = body.Email?.Trim(), Phone = body.Phone?.Trim(), Mobile = body.Mobile?.Trim(), Notes = body.Notes?.Trim(), PreferredChannel = string.IsNullOrWhiteSpace(body.PreferredChannel) ? "Email" : body.PreferredChannel.Trim(), IsPrimary = body.IsPrimary, CreatedAt = _clock.UtcNow };
        _db.InsuranceCompanyContacts.Add(contact); await _db.SaveChangesAsync(ct); return Ok(ToContactDto(contact));
    }

    [HttpPut("contacts/{contactId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> UpdateContact(Guid companyId, Guid contactId, [FromBody] ContactBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        var contact = await _db.InsuranceCompanyContacts.FirstOrDefaultAsync(c => c.Id == contactId && c.InsuranceCompanyId == companyId, ct) ?? throw AppException.NotFound("Επαφή");
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα επαφής είναι υποχρεωτικό.");
        if (body.IsPrimary) await _db.InsuranceCompanyContacts.Where(c => c.InsuranceCompanyId == companyId && c.Id != contactId && c.IsActive).ForEachAsync(c => c.IsPrimary = false, ct);
        contact.Name = body.Name.Trim(); contact.Role = body.Role?.Trim(); contact.Department = body.Department?.Trim(); contact.Email = body.Email?.Trim(); contact.Phone = body.Phone?.Trim(); contact.Mobile = body.Mobile?.Trim(); contact.Notes = body.Notes?.Trim(); contact.PreferredChannel = string.IsNullOrWhiteSpace(body.PreferredChannel) ? "Email" : body.PreferredChannel.Trim(); contact.IsPrimary = body.IsPrimary;
        await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("contacts/{contactId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> DeleteContact(Guid companyId, Guid contactId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var contact = await _db.InsuranceCompanyContacts.FirstOrDefaultAsync(c => c.Id == contactId && c.InsuranceCompanyId == companyId, ct) ?? throw AppException.NotFound("Επαφή");
        contact.IsActive = false; contact.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("documents")]
    [RequirePermission("documents.write")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<DocumentDto>> UploadDocument(Guid companyId, [FromForm] Guid? folderId,
        [FromForm] string? category, [FromForm] string? description, [FromForm] string? tags,
        [FromForm] DateOnly? documentDate, [FromForm] DateOnly? expiresOn,
        [FromForm] bool isConfidential, IFormFile file, CancellationToken ct)
    {
        await Company(companyId, ct);
        if (file is null || file.Length == 0) throw AppException.Validation("Επιλέξτε αρχείο για ανέβασμα.");
        if (folderId.HasValue && !await _db.InsuranceCompanyFolders.AnyAsync(f => f.Id == folderId && f.InsuranceCompanyId == companyId, ct))
            throw AppException.Validation("Ο φάκελος δεν βρέθηκε.");
        await using var stream = file.OpenReadStream();
        var contentType = await _gate.InspectAsync(file.FileName, file.ContentType, file.Length, stream, FileUploadKind.Document, maxBytes: 50_000_000, ct);
        var key = await _storage.UploadAsync($"insurance-company/{TenantId:N}/{companyId:N}", file.FileName, contentType, stream, ct);
        string[] parsedTags;
        try { parsedTags = string.IsNullOrWhiteSpace(tags) ? Array.Empty<string>() : JsonSerializer.Deserialize<string[]>(tags!) ?? Array.Empty<string>(); }
        catch { parsedTags = tags!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(); }
        var doc = new InsuranceCompanyDocument
        {
            Id = Guid.NewGuid(), InsuranceCompanyId = companyId, FolderId = folderId,
            FileName = Path.GetFileName(file.FileName), StoragePath = key, MimeType = contentType,
            SizeBytes = file.Length, Category = string.IsNullOrWhiteSpace(category) ? "Γενικά" : category.Trim(),
            Description = description?.Trim(), TagsJson = JsonSerializer.Serialize(parsedTags),
            DocumentDate = documentDate, ExpiresOn = expiresOn, IsConfidential = isConfidential,
            UploadedByUserId = _current.UserId, CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanyDocuments.Add(doc); await _db.SaveChangesAsync(ct);
        return Ok(ToDocumentDto(doc, parsedTags));
    }

    [HttpGet("documents/{documentId:guid}/download")]
    [RequirePermission("documents.read")]
    public async Task<IActionResult> DownloadDocument(Guid companyId, Guid documentId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var doc = await _db.InsuranceCompanyDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Έγγραφο εταιρείας");
        var stream = await _storage.DownloadAsync(doc.StoragePath, ct);
        return File(stream, doc.MimeType, doc.FileName);
    }

    [HttpDelete("documents/{documentId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> DeleteDocument(Guid companyId, Guid documentId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var doc = await _db.InsuranceCompanyDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Έγγραφο εταιρείας");
        doc.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct);
        try { await _storage.DeleteAsync(doc.StoragePath, ct); } catch { /* DB tombstone remains authoritative */ }
        return NoContent();
    }

    [HttpPost("fields")]
    [RequirePermission("documents.write")]
    public async Task<ActionResult<FieldDefinitionDto>> CreateField(Guid companyId, [FromBody] FieldBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        if (string.IsNullOrWhiteSpace(body.Label) || string.IsNullOrWhiteSpace(body.Key)) throw AppException.Validation("Συμπληρώστε όνομα και κλειδί πεδίου.");
        var key = body.Key.Trim().ToLowerInvariant().Replace(' ', '-');
        if (await _db.InsuranceCompanyFieldDefinitions.AnyAsync(f => f.InsuranceCompanyId == companyId && f.Key == key && f.IsActive, ct))
            throw AppException.Validation("Υπάρχει ήδη πεδίο με αυτό το κλειδί.");
        var field = new InsuranceCompanyFieldDefinition
        {
            Id = Guid.NewGuid(), InsuranceCompanyId = companyId, Label = body.Label.Trim(), Key = key,
            FieldType = string.IsNullOrWhiteSpace(body.FieldType) ? "text" : body.FieldType.Trim(), OptionsJson = JsonSerializer.Serialize(body.Options ?? Array.Empty<string>()),
            IsRequired = body.IsRequired, IsActive = true, SortOrder = body.SortOrder, CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanyFieldDefinitions.Add(field); await _db.SaveChangesAsync(ct);
        return Ok(new FieldDefinitionDto(field.Id, field.Key, field.Label, field.FieldType, body.Options ?? Array.Empty<string>(), field.IsRequired, field.IsActive, field.SortOrder, null));
    }

    [HttpPut("fields/{definitionId:guid}/value")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> SetFieldValue(Guid companyId, Guid definitionId, [FromBody] FieldValueBody body, CancellationToken ct)
    {
        await Company(companyId, ct);
        var definition = await _db.InsuranceCompanyFieldDefinitions.FirstOrDefaultAsync(f => f.Id == definitionId && f.InsuranceCompanyId == companyId && f.IsActive, ct)
            ?? throw AppException.NotFound("Προσαρμόσιμο πεδίο");
        var value = await _db.InsuranceCompanyFieldValues.FirstOrDefaultAsync(v => v.DefinitionId == definition.Id && v.InsuranceCompanyId == companyId, ct);
        if (value is null) { value = new InsuranceCompanyFieldValue { Id = Guid.NewGuid(), InsuranceCompanyId = companyId, DefinitionId = definition.Id, CreatedAt = _clock.UtcNow }; _db.InsuranceCompanyFieldValues.Add(value); }
        value.Value = body.Value?.Trim(); await _db.SaveChangesAsync(ct); return NoContent();
    }

    public record FieldValueBody(string? Value);

    [HttpDelete("fields/{definitionId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> DeleteField(Guid companyId, Guid definitionId, CancellationToken ct)
    {
        await Company(companyId, ct);
        var field = await _db.InsuranceCompanyFieldDefinitions.FirstOrDefaultAsync(f => f.Id == definitionId && f.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Προσαρμόσιμο πεδίο");
        field.IsActive = false; field.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }

    private static string[] ParseTags(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    private static DocumentDto ToDocumentDto(InsuranceCompanyDocument d, string[] tags)
        => new(d.Id, d.FolderId, d.FileName, d.MimeType, d.SizeBytes, d.Category, d.Description, tags,
            d.DocumentDate, d.ExpiresOn, d.IsConfidential, d.UploadedByUserId, d.CreatedAt);

    private static ContactDto ToContactDto(InsuranceCompanyContact c)
        => new(c.Id, c.Name, c.Role, c.Department, c.Email, c.Phone, c.Mobile, c.Notes,
            c.PreferredChannel, c.IsPrimary, c.IsActive);
}
