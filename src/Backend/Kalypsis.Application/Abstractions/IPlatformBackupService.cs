using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Full-platform backup engine. Produces one aggregate JSON archive per run
/// containing every tenant's payload plus platform-scoped tables (settings,
/// contractors, tickets, etc.). Different from <see cref="ITenantBackupService"/>
/// which only handles a single tenant. Both write to disk under
/// <c>{Storage__LocalRoot}/platform-backups/…</c>.
/// </summary>
public interface IPlatformBackupService
{
    /// <summary>
    /// Executes a backup for the given manifest row. The row must already
    /// exist in <c>platform_backups</c> in "InProgress" state — the caller
    /// (create endpoint OR the scheduler) creates it first, then invokes
    /// this method to do the actual bytes-to-disk work.
    /// </summary>
    Task<PlatformBackup> ExecuteAsync(Guid backupId, CancellationToken ct);

    /// <summary>
    /// One-shot convenience for the scheduler — creates the manifest row +
    /// executes in a single call. Used for auto-daily snapshots.
    /// </summary>
    Task<PlatformBackup> CreateAndExecuteAsync(
        string scope,
        string createdByName,
        Guid? createdByUserId,
        CancellationToken ct);
}
