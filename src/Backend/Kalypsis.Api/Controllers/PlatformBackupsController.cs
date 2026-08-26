using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.PlatformBackups;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Scheduling;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/backups")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformBackupsController : ControllerBase
{
    private readonly IMediator _m;
    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly IPlatformBackupService _backups;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public PlatformBackupsController(IMediator m, AppDbContext db, IFileStorage storage,
        IPlatformBackupService backups, ICurrentUser current, IDateTimeProvider clock)
    { _m = m; _db = db; _storage = storage; _backups = backups; _current = current; _clock = clock; }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformBackupDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListPlatformBackupsQuery(), ct));

    public record CreateBody(bool Db, bool Uploads, bool Logs, bool Config);

    [HttpPost("create")]
    public async Task<ActionResult<PlatformBackupDto>> Create([FromBody] CreateBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreatePlatformBackupCommand(body.Db, body.Uploads, body.Logs, body.Config), ct));

    /// <summary>Run a full-platform backup NOW (synchronously — waits for
    /// the archive to finish writing so the UI can show the fresh row on
    /// return). Delete-safe: creates a new PlatformBackup manifest, runs
    /// the archive, updates the row to Completed. Files land under
    /// {Storage:LocalRoot}/platform-backups/*.json.gz.</summary>
    [HttpPost("run-now")]
    public async Task<ActionResult<object>> RunNow(CancellationToken ct)
    {
        var row = await _backups.CreateAndExecuteAsync(
            scope: "full",
            createdByName: _current.Email ?? "SuperAdmin",
            createdByUserId: _current.UserId,
            ct);
        return Ok(new {
            id = row.Id, fileName = row.FileName, sizeBytes = row.SizeBytes,
            status = row.Status, durationSeconds = row.DurationSeconds,
            message = row.Message,
        });
    }

    /// <summary>Soft-delete a platform backup manifest AND remove the
    /// underlying file from IFileStorage. Storage errors don't block the
    /// tombstone — the DB row still disappears from the list.</summary>
    [HttpDelete("{id:guid}")]
    [RequiresAdminOtp("platform-backup.delete", TargetFromRoute = "id")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await _db.PlatformBackups
            .FirstOrDefaultAsync(b => b.Id == id && b.DeletedAt == null, ct);
        if (row is null) return NotFound();
        if (!string.IsNullOrEmpty(row.StoragePath))
        {
            try { await _storage.DeleteAsync(row.StoragePath, ct); }
            catch { /* file already gone — tombstone the row anyway */ }
        }
        row.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Scheduler configuration ─────────────────────────────────────

    public record ScheduleDto(
        bool Enabled, string Cadence, int HourOfDayUtc, int DayOfWeek, int DayOfMonth,
        string Scope, int RetentionDaysDaily, int RetentionMonthsMonthly,
        string? NotifyEmail, DateTime? LastRunAt, DateTime? NextRunAt,
        bool LastRunFailed, string? LastRunMessage, string? LastRunFileName,
        long LastRunSizeBytes, int LastRunDurationSeconds);

    public record UpsertScheduleBody(
        bool Enabled, string Cadence, int HourOfDayUtc, int DayOfWeek, int DayOfMonth,
        string Scope, int RetentionDaysDaily, int RetentionMonthsMonthly,
        string? NotifyEmail);

    /// <summary>Read the singleton PlatformBackupSchedule row. Returns
    /// sensible defaults when nothing is configured yet — the UI can
    /// render the form pre-populated.</summary>
    [HttpGet("schedule")]
    public async Task<ActionResult<ScheduleDto>> GetSchedule(CancellationToken ct)
    {
        var s = await _db.PlatformBackupSchedules
            .FirstOrDefaultAsync(x => x.DeletedAt == null, ct);
        if (s is null)
            return Ok(new ScheduleDto(false, "daily", 3, 0, 1, "full", 30, 12,
                null, null, null, false, null, null, 0, 0));
        return Ok(ToDto(s));
    }

    [HttpPut("schedule")]
    public async Task<ActionResult<ScheduleDto>> UpsertSchedule(
        [FromBody] UpsertScheduleBody body, CancellationToken ct)
    {
        var allowedCadences = new HashSet<string> { "daily", "weekly", "monthly" };
        if (!allowedCadences.Contains((body.Cadence ?? "").ToLowerInvariant()))
            throw AppException.Validation("Cadence πρέπει να είναι daily / weekly / monthly.");
        var allowedScopes = new HashSet<string> { "full", "tenants", "platform" };
        if (!allowedScopes.Contains((body.Scope ?? "").ToLowerInvariant()))
            throw AppException.Validation("Scope πρέπει να είναι full / tenants / platform.");

        var s = await _db.PlatformBackupSchedules.FirstOrDefaultAsync(x => x.DeletedAt == null, ct);
        if (s is null)
        {
            s = new PlatformBackupSchedule
            {
                Id = Guid.NewGuid(),
                CreatedAt = _clock.UtcNow,
            };
            _db.PlatformBackupSchedules.Add(s);
        }
        s.Enabled = body.Enabled;
        s.Cadence = body.Cadence!.ToLowerInvariant();
        s.HourOfDayUtc = Math.Clamp(body.HourOfDayUtc, 0, 23);
        s.DayOfWeek = Math.Clamp(body.DayOfWeek, 0, 6);
        s.DayOfMonth = Math.Clamp(body.DayOfMonth, 1, 28);
        s.Scope = body.Scope!.ToLowerInvariant();
        s.RetentionDaysDaily = Math.Clamp(body.RetentionDaysDaily, 1, 365);
        s.RetentionMonthsMonthly = Math.Clamp(body.RetentionMonthsMonthly, 0, 60);
        s.NotifyEmail = string.IsNullOrWhiteSpace(body.NotifyEmail) ? null : body.NotifyEmail.Trim();
        s.LastEditedByUserId = _current.UserId;
        s.UpdatedAt = _clock.UtcNow;
        s.NextRunAt = PlatformBackupSchedulerJob.ComputeNextRun(s, _clock.UtcNow);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(s));
    }

    /// <summary>Storage-persistence health probe. Returns whether the
    /// platform storage root sits inside the container filesystem — a
    /// classic footgun where Coolify redeploys wipe backups because the
    /// operator forgot to mount a persistent volume. UI shows a red
    /// warning when persistent=false.</summary>
    [HttpGet("storage-health")]
    public ActionResult<object> StorageHealth(
        [FromServices] Microsoft.Extensions.Configuration.IConfiguration cfg)
    {
        var root = cfg["Storage:LocalRoot"];
        var configured = !string.IsNullOrWhiteSpace(root);
        // Heuristic: "persistent" if the operator set an absolute path
        // OUTSIDE AppContext.BaseDirectory. Sitting inside the app dir
        // means every container recreate loses the files.
        var appDir = System.IO.Path.GetFullPath(AppContext.BaseDirectory);
        var full = configured ? System.IO.Path.GetFullPath(root!) : appDir;
        var persistent = configured && !full.StartsWith(appDir, StringComparison.Ordinal);
        return Ok(new {
            configured, persistent, root = full,
            warning = persistent
                ? null
                : "Το Storage:LocalRoot βρίσκεται μέσα στο container filesystem. Τα backups θα ΧΑΘΟΥΝ σε κάθε redeploy. Ρυθμίστε ένα mounted volume (π.χ. /data/uploads) και επανεκκινήστε.",
        });
    }

    private static ScheduleDto ToDto(PlatformBackupSchedule s)
        => new(s.Enabled, s.Cadence, s.HourOfDayUtc, s.DayOfWeek, s.DayOfMonth,
            s.Scope, s.RetentionDaysDaily, s.RetentionMonthsMonthly, s.NotifyEmail,
            s.LastRunAt, s.NextRunAt, s.LastRunFailed, s.LastRunMessage,
            s.LastRunFileName, s.LastRunSizeBytes, s.LastRunDurationSeconds);

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult<PlatformBackupDto>> Restore(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new RestorePlatformBackupCommand(id), ct));

    [HttpPost("import")]
    [RequestSizeLimit(2L * 1024 * 1024 * 1024)]   // 2 GB cap on the frontend upload
    public async Task<ActionResult<PlatformBackupDto>> Import(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Επιλέξτε αρχείο zip." });
        return Ok(await _m.Send(new ImportBackupZipCommand(file.FileName, file.Length), ct));
    }

    /// <summary>
    /// Streams the gzipped JSON archive back to the SuperAdmin. Only Completed
    /// rows are downloadable — InProgress and Failed rows have no bytes.
    /// </summary>
    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var row = await _db.PlatformBackups
            .FirstOrDefaultAsync(b => b.Id == id && b.DeletedAt == null, ct);
        if (row == null) return NotFound();
        if (row.Status != "Completed" || string.IsNullOrEmpty(row.StoragePath))
            return BadRequest(new { code = "not_ready", message = "Το backup δεν έχει ολοκληρωθεί ακόμη." });

        try
        {
            var stream = await _storage.DownloadAsync(row.StoragePath, ct);
            return File(stream, "application/gzip", row.FileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { code = "file_missing", message = "Το αρχείο δεν βρέθηκε στο storage." });
        }
    }
}
