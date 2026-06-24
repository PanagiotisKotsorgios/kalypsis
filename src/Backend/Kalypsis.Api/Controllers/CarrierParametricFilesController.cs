using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 10.2 — Carrier parametric files.
///
/// Two endpoints groups:
///   /api/platform/parametric-files     (PlatformAdmin)  — upload broadcast files per carrier
///   /api/parametric-files              (AgencyStaff)    — list+install/uninstall on this tenant
/// </summary>
[ApiController]
[Route("api")]
public class CarrierParametricFilesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public CarrierParametricFilesController(AppDbContext db, IFileStorage storage, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _storage = storage; _current = current; _clock = clock; }

    public record ParametricFileDto(
        Guid Id, Guid? TenantId, bool IsBroadcast,
        string InsuranceCompanyCode, string InsuranceCompanyName, string Kind,
        string Version, DateOnly? EffectiveFrom, DateOnly? EffectiveTo,
        string? OriginalFileName, long? FileSizeBytes, string? FileContentType,
        bool IsActive, Guid? BroadcastFileId, DateTime? InstalledAt,
        string? ChangelogNotes, DateTime CreatedAt);

    /* ============ PLATFORMADMIN: BROADCAST ============ */

    /// <summary>List all broadcast files (no tenant), grouped by carrier+kind.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/parametric-files")]
    public async Task<ActionResult<IReadOnlyList<ParametricFileDto>>> ListBroadcast(CancellationToken ct) =>
        Ok(await _db.CarrierParametricFiles
            .Where(f => f.TenantId == null && f.DeletedAt == null)
            .OrderBy(f => f.InsuranceCompanyName).ThenByDescending(f => f.Version)
            .Select(f => Map(f, true)).ToListAsync(ct));

    public record UploadBroadcastBody(
        string InsuranceCompanyCode, string InsuranceCompanyName, string Kind,
        string Version, DateOnly? EffectiveFrom, DateOnly? EffectiveTo, string? ChangelogNotes);

    [Authorize(Policy = "PlatformAdmin")]
    [RequestSizeLimit(50_000_000)]
    [HttpPost("platform/parametric-files/upload")]
    public async Task<ActionResult<ParametricFileDto>> UploadBroadcast(
        [FromForm] UploadBroadcastBody body, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("no_file_selected",
                "Δεν επιλέξατε αρχείο για ανέβασμα.", 400,
                title: "Κενό αρχείο",
                why: "Πατήσατε «Ανέβασμα» χωρίς να έχετε επιλέξει αρχείο, ή το αρχείο που διαλέξατε έχει μηδενικό μέγεθος.",
                fix: "Πατήστε «Επιλογή αρχείου» και διαλέξτε το παραμετρικό αρχείο της εταιρείας από τον δίσκο σας.");

        var carrierCode = body.InsuranceCompanyCode.Trim().ToUpperInvariant();
        // Deactivate previous broadcast versions for this (carrier, kind)
        await _db.CarrierParametricFiles
            .Where(f => f.TenantId == null && f.InsuranceCompanyCode == carrierCode
                && f.Kind == body.Kind && f.IsActive && f.DeletedAt == null)
            .ForEachAsync(f => f.IsActive = false, ct);

        using var stream = file.OpenReadStream();
        var key = await _storage.UploadAsync(
            $"parametric/{carrierCode.ToLowerInvariant()}/{body.Kind.ToLowerInvariant()}",
            file.FileName, file.ContentType, stream, ct);

        var entity = new CarrierParametricFile
        {
            Id = Guid.NewGuid(),
            TenantId = null,
            InsuranceCompanyCode = carrierCode,
            InsuranceCompanyName = body.InsuranceCompanyName.Trim(),
            Kind = body.Kind.Trim(),
            Version = body.Version.Trim(),
            EffectiveFrom = body.EffectiveFrom,
            EffectiveTo = body.EffectiveTo,
            FileKey = key,
            OriginalFileName = file.FileName,
            FileSizeBytes = file.Length,
            FileContentType = file.ContentType,
            IsActive = true,
            ChangelogNotes = body.ChangelogNotes,
            UploadedByUserId = _current.UserId,
            CreatedAt = _clock.UtcNow
        };
        _db.CarrierParametricFiles.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Ok(Map(entity, true));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/parametric-files/{id:guid}/download")]
    public async Task<IActionResult> DownloadBroadcast(Guid id, CancellationToken ct)
    {
        var f = await _db.CarrierParametricFiles
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό αρχείο");
        if (string.IsNullOrEmpty(f.FileKey)) return NotFound();
        var stream = await _storage.DownloadAsync(f.FileKey, ct);
        return File(stream, f.FileContentType ?? "application/octet-stream", f.OriginalFileName ?? "parametric");
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpDelete("platform/parametric-files/{id:guid}")]
    public async Task<ActionResult> DeleteBroadcast(Guid id, CancellationToken ct)
    {
        var f = await _db.CarrierParametricFiles
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό αρχείο");
        f.DeletedAt = _clock.UtcNow;
        f.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /* ============ AGENCY: CATALOG + INSTALL ============ */

    /// <summary>
    /// Catalog shown to AgencyAdmin: for each carrier (by code), the latest
    /// broadcast version available + whether the tenant has it installed.
    /// </summary>
    [Authorize(Policy = "AgencyAdmin")]
    [HttpGet("parametric-files/catalog")]
    public async Task<ActionResult<IReadOnlyList<object>>> Catalog(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var broadcasts = await _db.CarrierParametricFiles.IgnoreQueryFilters()
            .Where(f => f.TenantId == null && f.IsActive && f.DeletedAt == null)
            .OrderBy(f => f.InsuranceCompanyName).ThenBy(f => f.Kind).ToListAsync(ct);

        var installed = await _db.CarrierParametricFiles
            .Where(f => f.TenantId == tenantId && f.IsActive && f.DeletedAt == null)
            .ToListAsync(ct);
        var installedByBroadcastId = installed
            .Where(i => i.BroadcastFileId.HasValue)
            .ToDictionary(i => i.BroadcastFileId!.Value);

        return Ok(broadcasts.Select(b => (object)new
        {
            broadcastId = b.Id,
            insuranceCompanyCode = b.InsuranceCompanyCode,
            insuranceCompanyName = b.InsuranceCompanyName,
            kind = b.Kind,
            version = b.Version,
            effectiveFrom = b.EffectiveFrom,
            effectiveTo = b.EffectiveTo,
            originalFileName = b.OriginalFileName,
            fileSizeBytes = b.FileSizeBytes,
            changelogNotes = b.ChangelogNotes,
            isInstalled = installedByBroadcastId.ContainsKey(b.Id),
            installedAt = installedByBroadcastId.TryGetValue(b.Id, out var inst) ? inst.InstalledAt : null,
            installedVersion = installedByBroadcastId.TryGetValue(b.Id, out var inst2) ? inst2.Version : null,
            isOutdated = installed.Any(i =>
                i.InsuranceCompanyCode == b.InsuranceCompanyCode &&
                i.Kind == b.Kind &&
                i.BroadcastFileId != b.Id)
        }).ToList());
    }

    /// <summary>Install (or re-install) a broadcast file's content into this tenant.</summary>
    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("parametric-files/install/{broadcastId:guid}")]
    public async Task<ActionResult<ParametricFileDto>> Install(Guid broadcastId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var b = await _db.CarrierParametricFiles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == broadcastId && x.TenantId == null && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό αρχείο");

        // Deactivate any prior tenant install of the same carrier+kind
        await _db.CarrierParametricFiles
            .Where(f => f.TenantId == tenantId && f.InsuranceCompanyCode == b.InsuranceCompanyCode
                && f.Kind == b.Kind && f.IsActive && f.DeletedAt == null)
            .ForEachAsync(f => f.IsActive = false, ct);

        var tenantCopy = new CarrierParametricFile
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InsuranceCompanyCode = b.InsuranceCompanyCode,
            InsuranceCompanyName = b.InsuranceCompanyName,
            Kind = b.Kind,
            Version = b.Version,
            EffectiveFrom = b.EffectiveFrom,
            EffectiveTo = b.EffectiveTo,
            FileKey = b.FileKey,                // share the same storage object — broadcast files are immutable
            OriginalFileName = b.OriginalFileName,
            FileSizeBytes = b.FileSizeBytes,
            FileContentType = b.FileContentType,
            IsActive = true,
            BroadcastFileId = b.Id,
            InstalledAt = _clock.UtcNow,
            UploadedByUserId = _current.UserId,
            ChangelogNotes = b.ChangelogNotes,
            CreatedAt = _clock.UtcNow
        };
        _db.CarrierParametricFiles.Add(tenantCopy);
        await _db.SaveChangesAsync(ct);
        return Ok(Map(tenantCopy, false));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("parametric-files/uninstall/{installedId:guid}")]
    public async Task<ActionResult> Uninstall(Guid installedId, CancellationToken ct)
    {
        var f = await _db.CarrierParametricFiles
            .FirstOrDefaultAsync(x => x.Id == installedId && x.TenantId == _current.TenantId, ct)
            ?? throw AppException.NotFound("Εγκατεστημένο αρχείο");
        f.IsActive = false;
        f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("parametric-files/installed")]
    public async Task<ActionResult<IReadOnlyList<ParametricFileDto>>> ListInstalled(CancellationToken ct) =>
        Ok(await _db.CarrierParametricFiles
            .Where(f => f.TenantId == _current.TenantId && f.IsActive && f.DeletedAt == null)
            .OrderBy(f => f.InsuranceCompanyName).ThenBy(f => f.Kind)
            .Select(f => Map(f, false)).ToListAsync(ct));

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("parametric-files/{id:guid}/download")]
    public async Task<IActionResult> DownloadInstalled(Guid id, CancellationToken ct)
    {
        var f = await _db.CarrierParametricFiles
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == _current.TenantId, ct)
            ?? throw AppException.NotFound("Παραμετρικό αρχείο");
        if (string.IsNullOrEmpty(f.FileKey)) return NotFound();
        var stream = await _storage.DownloadAsync(f.FileKey, ct);
        return File(stream, f.FileContentType ?? "application/octet-stream", f.OriginalFileName ?? "parametric");
    }

    private static ParametricFileDto Map(CarrierParametricFile f, bool isBroadcast) => new(
        f.Id, f.TenantId, isBroadcast,
        f.InsuranceCompanyCode, f.InsuranceCompanyName, f.Kind,
        f.Version, f.EffectiveFrom, f.EffectiveTo,
        f.OriginalFileName, f.FileSizeBytes, f.FileContentType,
        f.IsActive, f.BroadcastFileId, f.InstalledAt,
        f.ChangelogNotes, f.CreatedAt);
}
