using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Public documentation reader + PlatformAdmin editor. Serves the tree of
/// «Οδηγίες Χρήσης» sections stored in documentation_sections, plus the
/// screenshots the PlatformAdmin uploads via documentation_assets. Nothing
/// here is tenant-scoped — the documentation is shared across every γραφείο.
/// </summary>
[ApiController]
[Route("api/documentation")]
public class DocumentationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly IDateTimeProvider _clock;

    public DocumentationController(AppDbContext db, ICurrentUser current,
        IFileStorage storage, IDateTimeProvider clock)
    { _db = db; _current = current; _storage = storage; _clock = clock; }

    public record SectionDto(
        Guid Id, string Slug, string? ParentSlug, string Title,
        string BodyHtml, string? Keywords, int DisplayOrder, bool IsPublished);

    public record SaveSectionBody(
        string Slug, string? ParentSlug, string Title,
        string BodyHtml, string? Keywords, int DisplayOrder, bool IsPublished);

    public record AssetDto(Guid Id, string FileName, string ContentType, long SizeBytes, string Url);

    /// <summary>
    /// Public read — returns the entire tree of PUBLISHED sections ordered
    /// by DisplayOrder within each parent. No auth required so /documentation
    /// (the public marketing page) can render without a login.
    /// </summary>
    [HttpGet("sections")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<SectionDto>>> ListPublic(CancellationToken ct)
    {
        var rows = await _db.DocumentationSections
            .Where(s => s.IsPublished)
            .OrderBy(s => s.ParentSlug ?? "").ThenBy(s => s.DisplayOrder)
            .Select(s => new SectionDto(s.Id, s.Slug, s.ParentSlug, s.Title,
                s.BodyHtml, s.Keywords, s.DisplayOrder, s.IsPublished))
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Superadmin — returns EVERY section including drafts.</summary>
    [HttpGet("sections/all")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<SectionDto>>> ListAll(CancellationToken ct)
    {
        var rows = await _db.DocumentationSections
            .OrderBy(s => s.ParentSlug ?? "").ThenBy(s => s.DisplayOrder)
            .Select(s => new SectionDto(s.Id, s.Slug, s.ParentSlug, s.Title,
                s.BodyHtml, s.Keywords, s.DisplayOrder, s.IsPublished))
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("sections")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<SectionDto>> Create([FromBody] SaveSectionBody body, CancellationToken ct)
    {
        Validate(body);
        var slugTaken = await _db.DocumentationSections.AnyAsync(s => s.Slug == body.Slug, ct);
        if (slugTaken) throw new AppException("slug_taken", "Το slug χρησιμοποιείται ήδη.", 409);
        var s = new DocumentationSection
        {
            Id = Guid.NewGuid(),
            Slug = body.Slug.Trim(),
            ParentSlug = string.IsNullOrWhiteSpace(body.ParentSlug) ? null : body.ParentSlug.Trim(),
            Title = body.Title.Trim(),
            BodyHtml = body.BodyHtml ?? "",
            Keywords = body.Keywords?.Trim(),
            DisplayOrder = body.DisplayOrder,
            IsPublished = body.IsPublished,
            CreatedAt = _clock.UtcNow,
        };
        _db.DocumentationSections.Add(s);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpPut("sections/{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<SectionDto>> Update(Guid id, [FromBody] SaveSectionBody body, CancellationToken ct)
    {
        Validate(body);
        var s = await _db.DocumentationSections.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Ενότητα");
        if (s.Slug != body.Slug)
        {
            var slugTaken = await _db.DocumentationSections.AnyAsync(x => x.Slug == body.Slug && x.Id != id, ct);
            if (slugTaken) throw new AppException("slug_taken", "Το slug χρησιμοποιείται ήδη.", 409);
        }
        s.Slug = body.Slug.Trim();
        s.ParentSlug = string.IsNullOrWhiteSpace(body.ParentSlug) ? null : body.ParentSlug.Trim();
        s.Title = body.Title.Trim();
        s.BodyHtml = body.BodyHtml ?? "";
        s.Keywords = body.Keywords?.Trim();
        s.DisplayOrder = body.DisplayOrder;
        s.IsPublished = body.IsPublished;
        s.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    [HttpDelete("sections/{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var s = await _db.DocumentationSections.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Ενότητα");
        s.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /* ============================== ASSETS ============================== */

    [HttpPost("assets")]
    [Authorize(Policy = "PlatformAdmin")]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<ActionResult<AssetDto>> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("file_required", "Επιλέξτε αρχείο.", 400);
        if (file.Length > 10 * 1024 * 1024)
            throw new AppException("file_too_large", "Μέγιστο μέγεθος αρχείου: 10 MB.", 400);
        var ct2 = file.ContentType?.ToLowerInvariant() ?? "";
        if (!ct2.StartsWith("image/"))
            throw new AppException("image_only", "Δεκτά μόνο αρχεία εικόνας.", 400);

        await using var stream = file.OpenReadStream();
        var path = await _storage.UploadAsync("documentation", file.FileName, file.ContentType!, stream, ct);
        var a = new DocumentationAsset
        {
            Id = Guid.NewGuid(),
            FileName = file.FileName,
            ContentType = file.ContentType!,
            SizeBytes = file.Length,
            StoragePath = path,
            UploadedByUserId = _current.UserId,
            CreatedAt = _clock.UtcNow,
        };
        _db.DocumentationAssets.Add(a);
        await _db.SaveChangesAsync(ct);
        return Ok(ToAssetDto(a));
    }

    [HttpGet("assets/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var a = await _db.DocumentationAssets.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Αρχείο");
        var s = await _storage.DownloadAsync(a.StoragePath, ct);
        Response.Headers.CacheControl = "public, max-age=3600";
        return File(s, a.ContentType, a.FileName);
    }

    [HttpGet("assets")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<AssetDto>>> ListAssets(CancellationToken ct)
    {
        var rows = await _db.DocumentationAssets
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AssetDto(a.Id, a.FileName, a.ContentType, a.SizeBytes, $"/api/documentation/assets/{a.Id}"))
            .ToListAsync(ct);
        return Ok(rows);
    }

    private static void Validate(SaveSectionBody b)
    {
        if (string.IsNullOrWhiteSpace(b.Slug)) throw new AppException("slug_required", "Το slug είναι υποχρεωτικό.", 400);
        if (string.IsNullOrWhiteSpace(b.Title)) throw new AppException("title_required", "Ο τίτλος είναι υποχρεωτικός.", 400);
        if (!System.Text.RegularExpressions.Regex.IsMatch(b.Slug, @"^[a-z0-9-]+$"))
            throw new AppException("slug_invalid", "Το slug μπορεί να περιέχει μόνο πεζά λατινικά, αριθμούς και παύλες.", 400);
    }

    private static SectionDto ToDto(DocumentationSection s) =>
        new(s.Id, s.Slug, s.ParentSlug, s.Title, s.BodyHtml, s.Keywords, s.DisplayOrder, s.IsPublished);

    private static AssetDto ToAssetDto(DocumentationAsset a) =>
        new(a.Id, a.FileName, a.ContentType, a.SizeBytes, $"/api/documentation/assets/{a.Id}");
}
