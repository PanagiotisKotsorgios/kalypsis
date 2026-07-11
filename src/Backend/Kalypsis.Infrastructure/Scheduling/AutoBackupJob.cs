using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Walks every tenant with an enabled <c>TenantBackupPolicy</c> on a short
/// interval, creates a fresh JSON archive when the policy's schedule is due,
/// and prunes older auto backups down to the retention count. Idempotent —
/// if an admin runs a manual backup in the same window we skip; if the
/// process restarts we resume from wherever LastAutoBackupAt was left.
/// </summary>
public class AutoBackupJob : BackgroundService
{
    // Hourly poll cadence. The finest schedule policy supports is
    // 1 day, so an hour of drift on when the auto-backup fires is fine.
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AutoBackupJob> _log;

    public AutoBackupJob(IServiceScopeFactory scopes, ILogger<AutoBackupJob> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give the API a minute to warm up before we start hitting the DB.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Auto-backup job iteration failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<ITenantBackupService>();

        var now = DateTime.UtcNow;
        var policies = await db.TenantBackupPolicies.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null && x.Enabled)
            .ToListAsync(ct);

        _log.LogDebug("Auto-backup: {Count} tenants have auto-backup enabled.", policies.Count);

        foreach (var policy in policies)
        {
            if (ct.IsCancellationRequested) return;

            // Due only if we've never run OR the interval has fully elapsed.
            var dueAfter = policy.LastAutoBackupAt?.AddDays(policy.FrequencyDays);
            if (dueAfter.HasValue && dueAfter.Value > now) continue;

            try
            {
                var backup = await service.CreateAsync(
                    policy.TenantId,
                    kind: "Auto",
                    createdByUserId: null,
                    createdByName: "Αυτόματο πρόγραμμα",
                    ct);

                policy.LastAutoBackupAt = now;
                policy.UpdatedAt = now;
                await db.SaveChangesAsync(ct);

                _log.LogInformation("Auto-backup created for tenant {TenantId}: {FileName} ({SizeKB} KB)",
                    policy.TenantId, backup.FileName, backup.SizeBytes / 1024);

                await PruneOldAutoBackupsAsync(db, policy.TenantId, policy.RetentionCount, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Auto-backup failed for tenant {TenantId}.", policy.TenantId);
            }
        }
    }

    /// <summary>
    /// Soft-deletes any «Auto» backup beyond the RetentionCount most recent.
    /// Manual backups are never pruned — the admin decides when to delete
    /// those. Storage cleanup on disk happens lazily via
    /// <see cref="IFileStorage.DeleteAsync"/>; if that throws we still
    /// tombstone the row so it disappears from the list.
    /// </summary>
    private async Task PruneOldAutoBackupsAsync(AppDbContext db, Guid tenantId, int retention, CancellationToken ct)
    {
        var toKeep = Math.Max(1, retention);
        var stale = await db.TenantBackups.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.Kind == "Auto")
            .OrderByDescending(x => x.CreatedAt)
            .Skip(toKeep)
            .ToListAsync(ct);
        if (stale.Count == 0) return;

        var storage = _scopes.CreateScope().ServiceProvider.GetRequiredService<IFileStorage>();
        var now = DateTime.UtcNow;
        foreach (var row in stale)
        {
            try { await storage.DeleteAsync(row.StoragePath, ct); }
            catch (Exception ex) { _log.LogWarning(ex, "Prune: could not delete file {Path}", row.StoragePath); }
            row.DeletedAt = now;
        }
        await db.SaveChangesAsync(ct);
        _log.LogInformation("Auto-backup pruned {Count} older archives for tenant {TenantId}", stale.Count, tenantId);
    }
}
