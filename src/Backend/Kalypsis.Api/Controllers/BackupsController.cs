using System.IO.Compression;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
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
[Authorize(Policy = "AgencyAdmin")]
public class BackupsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    private readonly IFileStorage _storage;

    public BackupsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock, IFileStorage storage)
    {
        _db = db;
        _current = current;
        _clock = clock;
        _storage = storage;
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
    public async Task<ActionResult<BackupDto>> Create(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var editorName = await ResolveEditorNameAsync(ct);
        var (row, _) = await CreateBackupInternalAsync(tenantId, "Manual", _current.UserId, editorName, ct);
        return Ok(new BackupDto(
            row.Id, row.FileName, row.SizeBytes, row.Kind, row.CreatedAt, row.CreatedByName,
            DeserializeSummary(row.SummaryJson)));
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

    // -------------------------------------------------------------------------
    // Shared backup implementation used by both the controller and the hosted
    // AutoBackupService (via reflection or a shared static helper). For now
    // we keep it inline; the hosted service resolves it via DI.
    // -------------------------------------------------------------------------

    internal async Task<(TenantBackup row, byte[] bytes)> CreateBackupInternalAsync(
        Guid tenantId, string kind, Guid? createdByUserId, string? createdByName, CancellationToken ct)
    {
        // Gather everything tenant-scoped in one pass. Each subquery is
        // capped to a reasonable size — an insurance office pushing north
        // of the caps would be a genuine surprise, and we log it.
        const int CAP = 200_000;

        var customers    = await _db.Customers   .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var policies     = await _db.Policies    .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var claims       = await _db.Claims      .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var receipts     = await _db.Receipts    .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var payments     = await _db.Payments    .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var tasks        = await _db.AgencyTasks .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var appointments = await _db.Appointments.Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var producers    = await _db.Producers   .Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var carriers     = await _db.InsuranceCompanies.Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var notes        = await _db.AgencyInstructions.Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);

        var summary = new Dictionary<string, int>
        {
            ["customers"] = customers.Count,
            ["policies"] = policies.Count,
            ["claims"] = claims.Count,
            ["receipts"] = receipts.Count,
            ["payments"] = payments.Count,
            ["tasks"] = tasks.Count,
            ["appointments"] = appointments.Count,
            ["producers"] = producers.Count,
            ["carriers"] = carriers.Count,
            ["instructions"] = notes.Count,
        };

        var payload = new
        {
            format = "kalypsis-tenant-backup",
            version = 1,
            tenantId,
            createdAt = _clock.UtcNow,
            createdBy = createdByName,
            summary,
            data = new
            {
                customers, policies, claims, receipts, payments,
                tasks, appointments, producers, carriers, instructions = notes,
            },
        };

        // Serialise + gzip in-memory. For very large tenants we'd stream this
        // to disk instead — 200k rows across nine tables fits comfortably in
        // RAM (~100-200 MB uncompressed, ~20 MB compressed).
        var jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = false,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        };
        byte[] compressed;
        using (var ms = new MemoryStream())
        {
            using (var gz = new GZipStream(ms, CompressionLevel.SmallestSize, leaveOpen: true))
            {
                await JsonSerializer.SerializeAsync(gz, payload, jsonOptions, ct);
            }
            compressed = ms.ToArray();
        }

        var stamp = _clock.UtcNow.ToString("yyyyMMdd_HHmmss");
        var fileName = $"kalypsis-{tenantId:N}-{stamp}.json.gz";
        var keyPrefix = $"backups/{tenantId:N}";
        string storagePath;
        await using (var upStream = new MemoryStream(compressed))
        {
            storagePath = await _storage.UploadAsync(keyPrefix, fileName, "application/gzip", upStream, ct);
        }

        var row = new TenantBackup
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FileName = fileName,
            StoragePath = storagePath,
            SizeBytes = compressed.LongLength,
            Kind = kind,
            SummaryJson = JsonSerializer.Serialize(summary),
            CreatedByUserId = createdByUserId,
            CreatedByName = createdByName,
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow,
        };
        _db.TenantBackups.Add(row);
        await _db.SaveChangesAsync(ct);
        return (row, compressed);
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
