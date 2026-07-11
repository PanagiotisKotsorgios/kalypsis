using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Shared backup engine used by both the manual endpoint (BackupsController)
/// and the auto-backup hosted service (AutoBackupJob). Reads all
/// tenant-scoped domain data, serialises it to JSON, compresses with gzip
/// and writes to disk under <c>{Storage__LocalRoot}/backups/{tenantId}/…</c>.
/// Returns the persisted manifest row.
/// </summary>
public interface ITenantBackupService
{
    Task<TenantBackup> CreateAsync(
        Guid tenantId,
        string kind,
        Guid? createdByUserId,
        string? createdByName,
        CancellationToken ct);

    /// <summary>
    /// Restore preview — reads a backup archive by id and returns the
    /// per-domain row counts. Non-destructive.
    /// </summary>
    Task<Dictionary<string, int>> ReadSummaryAsync(Guid backupId, Guid tenantId, CancellationToken ct);

    /// <summary>
    /// Import rows from a backup archive back into the current tenant.
    /// UPSERTs by primary key. Runs under a transaction.
    /// </summary>
    Task<RestoreResult> RestoreAsync(Guid backupId, Guid tenantId, RestoreOptions options, CancellationToken ct);
}

public record RestoreOptions(bool IncludeInstructions = true);

public record RestoreResult(
    int Customers, int Policies, int Claims, int Receipts, int Payments,
    int Tasks, int Appointments, int Producers, int Carriers, int Instructions,
    int TotalRows, string Message);
