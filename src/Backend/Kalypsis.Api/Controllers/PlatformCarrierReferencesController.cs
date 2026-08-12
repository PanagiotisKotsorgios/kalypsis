using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// «Οδηγός παραμετρικών» per InsuranceCompany — the operator-facing reference
/// document (PDF / xlsx / …) uploaded once by the PlatformAdmin and consulted
/// by every signed-in agency user from the bridge preview's floating viewer.
/// Read endpoints open to any AgencyStaff; write endpoints locked to
/// PlatformAdmin so tenants can't overwrite each other's reference.
/// </summary>
[ApiController]
[Route("api/platform/carriers/{carrierId:guid}/reference")]
public class PlatformCarrierReferencesController : ControllerBase
{
    // Cap uploads at 16 MB to stay inside MySQL max_allowed_packet defaults
    // and keep the DB row single-round-trippable.
    private const long MaxUploadBytes = 16L * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public PlatformCarrierReferencesController(AppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public record ReferenceMetaDto(
        Guid Id, Guid InsuranceCompanyId, string FileName, string MimeType,
        long SizeBytes, DateTime? UpdatedAt);

    /// <summary>Metadata only — cheap to poll from the preview page to
    /// decide whether to show the «Οδηγός» button.</summary>
    [HttpGet("meta")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ReferenceMetaDto?>> GetMeta(Guid carrierId, CancellationToken ct)
    {
        var row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
            .Where(r => r.InsuranceCompanyId == carrierId && r.DeletedAt == null)
            .Select(r => new ReferenceMetaDto(
                r.Id, r.InsuranceCompanyId, r.FileName, r.MimeType, r.SizeBytes,
                r.UpdatedAt ?? r.CreatedAt))
            .FirstOrDefaultAsync(ct);
        return row is null ? NoContent() : Ok(row);
    }

    /// <summary>Serves the file inline — browsers with a native PDF viewer
    /// render it in the popup iframe; other MIME types get a download prompt
    /// through the same URL because we set `Content-Disposition: inline`.</summary>
    [HttpGet("download")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> Download(Guid carrierId, CancellationToken ct)
    {
        var row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.InsuranceCompanyId == carrierId && r.DeletedAt == null, ct);
        if (row is null) return NotFound();
        // Content-Disposition: inline so the browser tries to preview (PDF)
        // and falls back to a Save-As on unsupported MIME types (xlsx).
        var disp = $"inline; filename*=UTF-8''{Uri.EscapeDataString(row.FileName)}";
        Response.Headers["Content-Disposition"] = disp;
        return File(row.ContentBytes, row.MimeType);
    }

    /// <summary>Upsert the reference. PlatformAdmin only.</summary>
    [HttpPut]
    [Authorize(Policy = "PlatformAdmin")]
    [RequestSizeLimit(MaxUploadBytes + 1_048_576)]
    public async Task<ActionResult<ReferenceMetaDto>> Upload(Guid carrierId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("reference_empty", "Δεν στάλθηκε αρχείο.", 400);
        if (file.Length > MaxUploadBytes)
            throw new AppException("reference_too_large",
                $"Το αρχείο ξεπερνά το όριο των {MaxUploadBytes / (1024 * 1024)} MB.", 400);
        var carrierExists = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .AnyAsync(c => c.Id == carrierId && c.DeletedAt == null, ct);
        if (!carrierExists) throw AppException.NotFound("Ασφαλιστική εταιρία");

        using var ms = new MemoryStream((int)file.Length);
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();
        var now = DateTime.UtcNow;

        var row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.InsuranceCompanyId == carrierId, ct);
        if (row is null)
        {
            row = new PlatformCarrierReference
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = carrierId,
                FileName = SanitizeFileName(file.FileName),
                MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                SizeBytes = bytes.LongLength,
                ContentBytes = bytes,
                UpdatedByUserId = _current.UserId,
                CreatedAt = now,
            };
            _db.PlatformCarrierReferences.Add(row);
        }
        else
        {
            row.FileName = SanitizeFileName(file.FileName);
            row.MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
            row.SizeBytes = bytes.LongLength;
            row.ContentBytes = bytes;
            row.UpdatedByUserId = _current.UserId;
            row.DeletedAt = null;
            row.UpdatedAt = now;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new ReferenceMetaDto(row.Id, row.InsuranceCompanyId, row.FileName,
            row.MimeType, row.SizeBytes, row.UpdatedAt ?? row.CreatedAt));
    }

    [HttpDelete]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid carrierId, CancellationToken ct)
    {
        var row = await _db.PlatformCarrierReferences
            .FirstOrDefaultAsync(r => r.InsuranceCompanyId == carrierId && r.DeletedAt == null, ct);
        if (row is null) return NoContent();
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static string SanitizeFileName(string name)
    {
        var trimmed = (name ?? "reference").Trim();
        // Strip path separators from the browser-supplied name — some
        // browsers include the full filesystem path on old versions.
        foreach (var ch in Path.GetInvalidFileNameChars())
            trimmed = trimmed.Replace(ch, '_');
        return string.IsNullOrEmpty(trimmed) ? "reference" : trimmed;
    }
}
