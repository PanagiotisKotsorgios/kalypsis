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

    /// <summary>
    /// Resolve which carrier's reference to serve for an incoming id.
    /// Handles the tenant-copy vs global-catalog mismatch: the PlatformAdmin
    /// uploaded against the global «Ασφαλιστικές (Platform)» row, but the
    /// operator's bridge preview passes the tenant-owned copy's id. Walk
    /// three fallbacks:
    ///   1. exact id
    ///   2. this carrier's ParentCompanyId (broker → parent)
    ///   3. global-catalog carrier with the same Code (case-insensitive)
    /// Returns the target reference row or null.
    /// </summary>
    private async Task<PlatformCarrierReference?> ResolveReferenceAsync(Guid carrierId, CancellationToken ct)
    {
        var row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.InsuranceCompanyId == carrierId && r.DeletedAt == null, ct);
        if (row is not null) return row;

        // Fallback 1: parent carrier (sub-carrier under a broker → look at broker's ref)
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == carrierId && c.DeletedAt == null, ct);
        if (carrier is null) return null;

        if (carrier.ParentCompanyId is Guid parentId)
        {
            row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.InsuranceCompanyId == parentId && r.DeletedAt == null, ct);
            if (row is not null) return row;
        }

        // Fallback 2: any global-catalog (TenantId=null) carrier with the same Code.
        // Catches the common case where the operator's tile is the tenant-owned
        // copy but the PlatformAdmin uploaded against the identical-code global row.
        if (!string.IsNullOrWhiteSpace(carrier.Code))
        {
            var code = carrier.Code;
            var globalId = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.TenantId == null && c.DeletedAt == null
                    && c.Code == code && c.Id != carrierId)
                .Select(c => (Guid?)c.Id)
                .FirstOrDefaultAsync(ct);
            if (globalId is Guid gid)
            {
                row = await _db.PlatformCarrierReferences.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(r => r.InsuranceCompanyId == gid && r.DeletedAt == null, ct);
                if (row is not null) return row;
            }
        }

        // Fallback 3: fuzzy name overlap against every carrier that has a
        // reference uploaded. Small set (usually < 20), safe to scan.
        // Handles the «Grand Cover (IW)» vs «GRAND_COVER» family cases and
        // works even if the operator's tenant carrier has a slightly renamed
        // twin ("ERGO HELLAS" vs "ERGO"). Matches when either name contains
        // a >=4-char token from the other (whole-word slot).
        if (!string.IsNullOrWhiteSpace(carrier.Name))
        {
            var mine = Normalise(carrier.Name);
            var candidates = await (from r in _db.PlatformCarrierReferences.IgnoreQueryFilters()
                                    where r.DeletedAt == null
                                    join c in _db.InsuranceCompanies.IgnoreQueryFilters()
                                       on r.InsuranceCompanyId equals c.Id
                                    where c.DeletedAt == null
                                    select new { Ref = r, TheirName = c.Name, TheirCode = c.Code })
                                    .ToListAsync(ct);
            foreach (var cand in candidates)
            {
                if (NameOverlap(mine, Normalise(cand.TheirName ?? "")))
                    return cand.Ref;
                if (!string.IsNullOrWhiteSpace(cand.TheirCode)
                    && NameOverlap(mine, Normalise(cand.TheirCode)))
                    return cand.Ref;
            }
        }
        return null;
    }

    /// <summary>Strip punctuation + collapse whitespace + uppercase so
    /// «Grand Cover (IW)» and «GRAND COVER IW» compare equal.</summary>
    private static string Normalise(string s) => new string(
        (s ?? "").ToUpperInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : ' ')
            .ToArray())
        .Trim();

    /// <summary>Any 4+ char whole token appearing in both strings counts as
    /// overlap — "GRAND COVER IW" vs "GRAND_COVER" share "GRAND" and "COVER".</summary>
    private static bool NameOverlap(string a, string b)
    {
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) return false;
        var aTokens = a.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 4).ToHashSet();
        if (aTokens.Count == 0) return false;
        var bTokens = b.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 4).ToHashSet();
        return aTokens.Overlaps(bTokens);
    }

    /// <summary>Metadata only — cheap to poll from the preview page to
    /// decide whether to show the «Οδηγός» button.</summary>
    [HttpGet("meta")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ReferenceMetaDto?>> GetMeta(Guid carrierId, CancellationToken ct)
    {
        var row = await ResolveReferenceAsync(carrierId, ct);
        if (row is null) return NoContent();
        return Ok(new ReferenceMetaDto(
            row.Id, row.InsuranceCompanyId, row.FileName, row.MimeType, row.SizeBytes,
            row.UpdatedAt ?? row.CreatedAt));
    }

    /// <summary>Serves the file inline — browsers with a native PDF viewer
    /// render it in the popup iframe; other MIME types get a download prompt
    /// through the same URL because we set `Content-Disposition: inline`.</summary>
    [HttpGet("download")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> Download(Guid carrierId, CancellationToken ct)
    {
        var row = await ResolveReferenceAsync(carrierId, ct);
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
