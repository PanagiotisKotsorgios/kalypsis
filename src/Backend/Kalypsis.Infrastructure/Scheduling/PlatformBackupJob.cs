using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Two responsibilities on a single 2-minute cadence:
///   1. Pick up SuperAdmin-queued rows (Status = "InProgress" with empty
///      StoragePath) and run them through the backup service so the create
///      endpoint returns immediately + the bytes appear moments later.
///   2. Auto-daily snapshot — if no successful platform backup exists in the
///      last 24h, kick off a fresh "full" one so the operator always has a
///      recent restore point without touching the UI.
///
/// Idempotent: on restart it re-scans "InProgress" rows and continues; if a
/// row is in-flight from another worker the concurrency check (single-node
/// setup) is enough. When we scale to N nodes, replace this with a proper
/// leader-election or a queued job runner.
/// </summary>
public class PlatformBackupJob : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan DailyThreshold = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PlatformBackupJob> _log;

    public PlatformBackupJob(IServiceScopeFactory scopes, ILogger<PlatformBackupJob> log)
    { _scopes = scopes; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Warm-up delay — let migrations + seeding finish before we hit the DB.
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunPendingAsync(stoppingToken);
                await MaybeCreateDailySnapshotAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Platform-backup job iteration failed."); }

            try { await Task.Delay(PollInterval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    /// <summary>
    /// Picks up any manifest row queued by the operator (Status=InProgress,
    /// empty StoragePath) and executes it. Rows created by the scheduler
    /// itself go through CreateAndExecuteAsync inline; this path handles
    /// operator-initiated backups from the SuperAdmin UI.
    /// </summary>
    private async Task RunPendingAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IPlatformBackupService>();

        var pending = await db.PlatformBackups
            .Where(b => b.DeletedAt == null && b.Status == "InProgress" && b.StoragePath == "")
            .OrderBy(b => b.CreatedAt)
            .Take(3)
            .Select(b => b.Id)
            .ToListAsync(ct);

        foreach (var id in pending)
        {
            if (ct.IsCancellationRequested) return;
            try
            {
                _log.LogInformation("Executing queued platform backup #{Id}", id);
                await service.ExecuteAsync(id, ct);
            }
            catch (Exception ex)
            { _log.LogError(ex, "Queued platform backup #{Id} failed", id); }
        }
    }

    /// <summary>
    /// Ensures we have at least one Completed backup within the last 24h. Runs
    /// exactly once per day per fleet — if the last successful snapshot is
    /// older than the threshold, kick off a new one; else no-op.
    /// </summary>
    private async Task MaybeCreateDailySnapshotAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IPlatformBackupService>();

        var since = DateTime.UtcNow - DailyThreshold;
        var hasRecent = await db.PlatformBackups.AnyAsync(
            b => b.DeletedAt == null && b.Status == "Completed" && b.CreatedAt >= since, ct);
        if (hasRecent) return;

        _log.LogInformation("No successful platform backup in last 24h — creating daily snapshot");
        try
        {
            await service.CreateAndExecuteAsync("full", "Αυτόματο daily snapshot", null, ct);
        }
        catch (Exception ex)
        { _log.LogError(ex, "Auto-daily platform snapshot failed"); }
    }
}
