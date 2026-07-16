using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformBackups;

/*
 * Full-platform backups — SuperAdmin-triggered. Distinct from tenant
 * backups which are the JSON-per-tenant flow. The actual DB dump / zip
 * work happens in Infrastructure; the handlers here manage the manifest
 * rows and expose enough surface for the frontend to drive create + list
 * + restore intents.
 */

public record PlatformBackupDto(
    Guid Id, string FileName, long SizeBytes, string Scope, string Status,
    string? Message, int DurationSeconds,
    DateTime TakenAt, string? CreatedByName);

public record ListPlatformBackupsQuery : IRequest<IReadOnlyList<PlatformBackupDto>>;

public class ListPlatformBackupsHandler
    : IRequestHandler<ListPlatformBackupsQuery, IReadOnlyList<PlatformBackupDto>>
{
    private readonly IAppDbContext _db;
    public ListPlatformBackupsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PlatformBackupDto>> Handle(ListPlatformBackupsQuery _, CancellationToken ct)
    {
        var rows = await _db.PlatformBackups
            .Where(b => b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt)
            .Take(60)
            .ToListAsync(ct);
        return rows.Select(b => new PlatformBackupDto(
            b.Id, b.FileName, b.SizeBytes, b.Scope, b.Status, b.Message, b.DurationSeconds,
            b.CreatedAt, b.CreatedByName
        )).ToList();
    }
}

/// <summary>
/// Registers the SuperAdmin's intent to create a full-platform backup and
/// writes a manifest row in "InProgress" state. Actual dump + upload runs
/// out-of-band (see AutoBackupJob / a future PlatformBackupService); this
/// endpoint returns immediately so the UI can show the queued row.
/// </summary>
public record CreatePlatformBackupCommand(bool Db, bool Uploads, bool Logs, bool Config)
    : IRequest<PlatformBackupDto>;

public class CreatePlatformBackupHandler
    : IRequestHandler<CreatePlatformBackupCommand, PlatformBackupDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreatePlatformBackupHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<PlatformBackupDto> Handle(CreatePlatformBackupCommand r, CancellationToken ct)
    {
        var scopes = new List<string>();
        if (r.Db) scopes.Add("db");
        if (r.Uploads) scopes.Add("uploads");
        if (r.Logs) scopes.Add("logs");
        if (r.Config) scopes.Add("config");
        if (scopes.Count == 0)
            throw AppException.Validation("Επιλέξτε τουλάχιστον έναν τομέα (db/uploads/logs/config).");

        var scope = scopes.Count == 4 ? "full" : string.Join("+", scopes);
        var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd-HHmm");
        var fileName = scope == "full"
            ? $"kalypsis-full-{stamp}.zip"
            : $"kalypsis-{scope}-{stamp}.zip";

        var row = new PlatformBackup
        {
            FileName = fileName,
            StoragePath = $"platform-backups/{fileName}",
            SizeBytes = 0,
            Scope = scope,
            Status = "InProgress",
            Message = "Queued — the backup runner will pick this up on the next tick.",
            DurationSeconds = 0,
            CreatedByUserId = _current.UserId,
            CreatedByName = _current.Email
        };
        _db.PlatformBackups.Add(row);
        await _db.SaveChangesAsync(ct);

        return new PlatformBackupDto(
            row.Id, row.FileName, row.SizeBytes, row.Scope, row.Status, row.Message, row.DurationSeconds,
            row.CreatedAt, row.CreatedByName);
    }
}

/// <summary>
/// Records the SuperAdmin's intent to restore from a specific backup.
/// Guarded — the handler only writes a follow-up manifest row indicating a
/// restore was requested. The Ops team validates + kicks off the actual
/// restore on the box.
/// </summary>
public record RestorePlatformBackupCommand(Guid BackupId) : IRequest<PlatformBackupDto>;

public class RestorePlatformBackupHandler
    : IRequestHandler<RestorePlatformBackupCommand, PlatformBackupDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public RestorePlatformBackupHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<PlatformBackupDto> Handle(RestorePlatformBackupCommand r, CancellationToken ct)
    {
        var src = await _db.PlatformBackups.FirstOrDefaultAsync(b => b.Id == r.BackupId && b.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Backup");

        // Restore is destructive — we don't do it inline. Create a follow-up
        // manifest with the intent so the Ops team can pick it up + audit
        // shows a paper trail of who requested what.
        var request = new PlatformBackup
        {
            FileName = $"RESTORE-REQUEST-{src.FileName}",
            StoragePath = src.StoragePath,
            SizeBytes = 0,
            Scope = src.Scope,
            Status = "RestoreRequested",
            Message = $"Restore requested by {_current.Email ?? "SuperAdmin"} at {DateTime.UtcNow:O}. Original backup: {src.Id}",
            CreatedByUserId = _current.UserId,
            CreatedByName = _current.Email
        };
        _db.PlatformBackups.Add(request);
        await _db.SaveChangesAsync(ct);

        return new PlatformBackupDto(
            request.Id, request.FileName, request.SizeBytes, request.Scope, request.Status,
            request.Message, request.DurationSeconds, request.CreatedAt, request.CreatedByName);
    }
}

/// <summary>
/// Frontend uploads a zip; we register a placeholder manifest so the row
/// shows up as "AwaitingRestore". Actual byte processing happens
/// asynchronously in a follow-up.
/// </summary>
public record ImportBackupZipCommand(string FileName, long SizeBytes) : IRequest<PlatformBackupDto>;

public class ImportBackupZipHandler : IRequestHandler<ImportBackupZipCommand, PlatformBackupDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ImportBackupZipHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<PlatformBackupDto> Handle(ImportBackupZipCommand r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.FileName))
            throw AppException.Validation("Απαιτείται όνομα αρχείου.");
        var row = new PlatformBackup
        {
            FileName = r.FileName,
            StoragePath = $"platform-imports/{DateTime.UtcNow:yyyyMMdd-HHmmss}-{r.FileName}",
            SizeBytes = r.SizeBytes,
            Scope = "imported",
            Status = "AwaitingRestore",
            Message = $"Uploaded by {_current.Email ?? "SuperAdmin"}. Pending validation before restore.",
            CreatedByUserId = _current.UserId,
            CreatedByName = _current.Email
        };
        _db.PlatformBackups.Add(row);
        await _db.SaveChangesAsync(ct);
        return new PlatformBackupDto(
            row.Id, row.FileName, row.SizeBytes, row.Scope, row.Status, row.Message, row.DurationSeconds,
            row.CreatedAt, row.CreatedByName);
    }
}
