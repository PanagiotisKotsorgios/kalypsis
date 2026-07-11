using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Per-tenant data backup engine. Manual snapshots + auto-scheduled snapshots
/// with retention rules + GDPR right-to-erasure request log.
///
/// The compressed JSON archive lives on disk under
/// <c>{Storage__LocalRoot}/backups/{tenantId}/…</c> so we can stream large
/// payloads without loading them into RAM. The DB row is the manifest —
/// list / delete / download all work off it.
/// </summary>
[ApiController]
[Route("api/backups")]
[Authorize(Policy = "AgencyStaff")]
public class BackupsController : ControllerBase
{
    // Read endpoints (list + download + GET policy) are open to every
    // staff member of the γραφείο so employees can grab an ad-hoc copy of
    // yesterday's data when the admin's off. Write endpoints (POST create,
    // DELETE, PUT policy, POST restore) stay AgencyAdmin-only via the
    // per-action [Authorize] attributes below.
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    private readonly IFileStorage _storage;
    private readonly ITenantBackupService _service;

    public BackupsController(
        IAppDbContext db,
        ICurrentUser current,
        IDateTimeProvider clock,
        IFileStorage storage,
        ITenantBackupService service)
    {
        _db = db;
        _current = current;
        _clock = clock;
        _storage = storage;
        _service = service;
    }

    public record BackupDto(
        Guid Id,
        string FileName,
        long SizeBytes,
        string Kind,
        DateTime CreatedAt,
        string? CreatedByName,
        Dictionary<string, int>? Summary);

    public record BackupPolicyDto(
        bool Enabled,
        int FrequencyDays,
        int RetentionCount,
        DateTime? LastAutoBackupAt);

    public record UpsertBackupPolicyBody(bool Enabled, int FrequencyDays, int RetentionCount);

    // -------------------------------------------------------------------------
    // Backups
    // -------------------------------------------------------------------------

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BackupDto>>> List(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.TenantBackups
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return Ok(rows.Select(x => new BackupDto(
            x.Id, x.FileName, x.SizeBytes, x.Kind, x.CreatedAt, x.CreatedByName,
            DeserializeSummary(x.SummaryJson))).ToList());
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BackupDto>> Create(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var editorName = await ResolveEditorNameAsync(ct);
        var row = await _service.CreateAsync(tenantId, "Manual", _current.UserId, editorName, ct);
        return Ok(new BackupDto(
            row.Id, row.FileName, row.SizeBytes, row.Kind, row.CreatedAt, row.CreatedByName,
            DeserializeSummary(row.SummaryJson)));
    }

    // -------------------------------------------------------------------------
    // Restore
    // -------------------------------------------------------------------------

    public record RestorePreviewDto(Dictionary<string, int> Summary, string Warning);
    public record RestoreConfirmBody(bool IncludeInstructions);

    [HttpPost("{id:guid}/restore-preview")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RestorePreviewDto>> RestorePreview(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        try
        {
            var summary = await _service.ReadSummaryAsync(id, tenantId, ct);
            var total = 0;
            foreach (var v in summary.Values) total += v;
            var warning = total > 0
                ? $"Θα εισαχθούν / ενημερωθούν {total:N0} εγγραφές. Οι υπάρχουσες εγγραφές με το ίδιο id θα αντικατασταθούν."
                : "Δεν βρέθηκαν εγγραφές στο αντίγραφο.";
            return Ok(new RestorePreviewDto(summary, warning));
        }
        catch (InvalidOperationException e)
        {
            throw new AppException("backup_not_found", e.Message, 404);
        }
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RestoreResult>> Restore(
        Guid id,
        [FromBody] RestoreConfirmBody body,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        try
        {
            var result = await _service.RestoreAsync(
                id, tenantId,
                new RestoreOptions(IncludeInstructions: body.IncludeInstructions),
                ct);
            return Ok(result);
        }
        catch (InvalidOperationException e)
        {
            throw new AppException("backup_restore_failed", e.Message, 400);
        }
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.TenantBackups
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντίγραφο");

        var stream = await _storage.DownloadAsync(row.StoragePath, ct);
        return File(stream, "application/gzip", row.FileName);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.TenantBackups
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντίγραφο");

        try { await _storage.DeleteAsync(row.StoragePath, ct); }
        catch { /* file may have been removed manually; the DB row still gets tombstoned */ }

        row.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // Auto-backup policy
    // -------------------------------------------------------------------------

    [HttpGet("policy")]
    public async Task<ActionResult<BackupPolicyDto>> GetPolicy(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.TenantBackupPolicies
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (row is null)
            return Ok(new BackupPolicyDto(false, 7, 8, null));
        return Ok(new BackupPolicyDto(row.Enabled, row.FrequencyDays, row.RetentionCount, row.LastAutoBackupAt));
    }

    [HttpPut("policy")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BackupPolicyDto>> UpsertPolicy(
        [FromBody] UpsertBackupPolicyBody body,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var freq = Math.Clamp(body.FrequencyDays, 1, 90);
        var retention = Math.Clamp(body.RetentionCount, 1, 100);

        var row = await _db.TenantBackupPolicies
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (row is null)
        {
            row = new TenantBackupPolicy
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Enabled = body.Enabled,
                FrequencyDays = freq,
                RetentionCount = retention,
                LastEditedByUserId = _current.UserId,
                CreatedAt = _clock.UtcNow,
                UpdatedAt = _clock.UtcNow,
            };
            _db.TenantBackupPolicies.Add(row);
        }
        else
        {
            row.Enabled = body.Enabled;
            row.FrequencyDays = freq;
            row.RetentionCount = retention;
            row.LastEditedByUserId = _current.UserId;
            row.UpdatedAt = _clock.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new BackupPolicyDto(row.Enabled, row.FrequencyDays, row.RetentionCount, row.LastAutoBackupAt));
    }

    private async Task<string?> ResolveEditorNameAsync(CancellationToken ct)
    {
        if (!_current.UserId.HasValue) return null;
        var u = await _db.Users
            .Where(x => x.Id == _current.UserId.Value && x.DeletedAt == null)
            .Select(x => new { x.FirstName, x.LastName, x.Email })
            .FirstOrDefaultAsync(ct);
        if (u is null) return null;
        var full = $"{u.FirstName} {u.LastName}".Trim();
        return string.IsNullOrWhiteSpace(full) ? u.Email : full;
    }

    private static Dictionary<string, int>? DeserializeSummary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, int>>(json); }
        catch { return null; }
    }
}
