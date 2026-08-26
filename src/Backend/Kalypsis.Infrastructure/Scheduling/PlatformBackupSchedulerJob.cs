using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Platform-wide backup scheduler. Reads the singleton PlatformBackupSchedule
/// row every 10 minutes, fires a full backup when the cadence window opens,
/// and prunes archives past the retention policy.
///
/// Firing logic:
///   • Compute the next scheduled instant given cadence + hour + weekday /
///     day-of-month.
///   • If NOW ≥ that instant AND (LastRunAt is null OR LastRunAt was before
///     that instant), fire the backup.
///   • Persist LastRunAt so a restart on the same day doesn't double-fire.
///   • Compute the NEXT NextRunAt and stamp it so the UI can show it.
///
/// Retention: grandfather-father-son.
///   • Keep every archive from the last N days (daily window).
///   • Keep the earliest archive per month for the last M months.
///   • Everything else soft-deleted + purged from IFileStorage.
///
/// Notifications: BEST-EFFORT email via IEmailSender when NotifyEmail is
/// set. Delivery failure never aborts the backup itself.
/// </summary>
public class PlatformBackupSchedulerJob : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(10);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PlatformBackupSchedulerJob> _log;

    public PlatformBackupSchedulerJob(IServiceScopeFactory scopes,
        ILogger<PlatformBackupSchedulerJob> log)
    { _scopes = scopes; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Warm-up delay so the API is fully up before we start hitting DB.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Platform backup scheduler tick failed."); }

            try { await Task.Delay(PollInterval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var backupService = scope.ServiceProvider.GetRequiredService<IPlatformBackupService>();
        var storage = scope.ServiceProvider.GetRequiredService<IFileStorage>();
        var email = scope.ServiceProvider.GetService<IEmailSender>();

        var schedule = await db.PlatformBackupSchedules
            .FirstOrDefaultAsync(x => x.DeletedAt == null, ct);
        if (schedule is null || !schedule.Enabled)
        {
            _log.LogDebug("Platform backup schedule disabled or unset; idling.");
            return;
        }

        var now = DateTime.UtcNow;
        var due = ComputeNextRun(schedule, from: schedule.LastRunAt ?? DateTime.MinValue);

        // Stamp NextRunAt every tick so the UI stays in sync when the
        // admin edits cadence — even if we're not firing this tick.
        var nextAfterNow = ComputeNextRun(schedule, from: now);
        if (schedule.NextRunAt != nextAfterNow)
        {
            schedule.NextRunAt = nextAfterNow;
            await db.SaveChangesAsync(ct);
        }

        if (now < due) return;   // not time yet

        _log.LogInformation("Platform backup scheduler firing at {Now} (was due {Due}).", now, due);
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var row = await backupService.CreateAndExecuteAsync(
                scope: schedule.Scope,
                createdByName: "Αυτόματο πρόγραμμα",
                createdByUserId: null,
                ct);
            stopwatch.Stop();

            schedule.LastRunAt = now;
            schedule.LastRunFailed = false;
            schedule.LastRunMessage = row.Message ?? "OK";
            schedule.LastRunFileName = row.FileName;
            schedule.LastRunSizeBytes = row.SizeBytes;
            schedule.LastRunDurationSeconds = row.DurationSeconds;
            schedule.NextRunAt = ComputeNextRun(schedule, from: now);
            await db.SaveChangesAsync(ct);

            await PruneAsync(db, storage, schedule, ct);
            if (!string.IsNullOrWhiteSpace(schedule.NotifyEmail) && email is not null)
                await NotifyAsync(email, schedule, success: true, row.FileName, row.SizeBytes, row.Message, ct);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _log.LogError(ex, "Platform backup scheduler run failed.");
            schedule.LastRunAt = now;
            schedule.LastRunFailed = true;
            schedule.LastRunMessage = $"FAILED: {ex.Message}";
            schedule.LastRunDurationSeconds = (int)stopwatch.Elapsed.TotalSeconds;
            schedule.NextRunAt = ComputeNextRun(schedule, from: now);
            try { await db.SaveChangesAsync(ct); } catch { /* best-effort */ }
            if (!string.IsNullOrWhiteSpace(schedule.NotifyEmail) && email is not null)
            {
                try { await NotifyAsync(email, schedule, success: false, "", 0, ex.Message, ct); }
                catch { /* email failure on failure — swallow, we already logged */ }
            }
        }
    }

    /// <summary>Pure function — given a schedule + a starting instant, when
    /// is the next fire time? Public so the controller can preview
    /// «next run» on schedule updates without waiting for the poll.</summary>
    public static DateTime ComputeNextRun(PlatformBackupSchedule s, DateTime from)
    {
        var hour = Math.Clamp(s.HourOfDayUtc, 0, 23);
        switch ((s.Cadence ?? "daily").ToLowerInvariant())
        {
            case "weekly":
            {
                // Find the next occurrence of DayOfWeek at hour:00 UTC.
                var target = (DayOfWeek)Math.Clamp(s.DayOfWeek, 0, 6);
                var candidate = new DateTime(from.Year, from.Month, from.Day, hour, 0, 0, DateTimeKind.Utc);
                while (candidate <= from || candidate.DayOfWeek != target)
                    candidate = candidate.AddDays(1);
                return candidate;
            }
            case "monthly":
            {
                var day = Math.Clamp(s.DayOfMonth, 1, 28);   // 28 so Feb always fires
                var candidate = new DateTime(from.Year, from.Month, day, hour, 0, 0, DateTimeKind.Utc);
                if (candidate <= from) candidate = candidate.AddMonths(1);
                return candidate;
            }
            default:   // daily
            {
                var candidate = new DateTime(from.Year, from.Month, from.Day, hour, 0, 0, DateTimeKind.Utc);
                if (candidate <= from) candidate = candidate.AddDays(1);
                return candidate;
            }
        }
    }

    /// <summary>Grandfather-father-son retention. Keep everything in the
    /// last N days (daily window), plus the earliest archive per month
    /// for the last M months. Prune the rest (soft-delete row + delete file).</summary>
    private async Task PruneAsync(AppDbContext db, IFileStorage storage,
        PlatformBackupSchedule schedule, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var dailyCutoff = now.AddDays(-Math.Max(1, schedule.RetentionDaysDaily));
        var monthlyCutoff = now.AddMonths(-Math.Max(1, schedule.RetentionMonthsMonthly));

        var all = await db.PlatformBackups
            .Where(b => b.DeletedAt == null && b.Status == "Completed")
            .OrderBy(b => b.CreatedAt)
            .ToListAsync(ct);

        // Keep set:
        //   • Anything within the daily window.
        //   • ONE archive per (year, month) within the monthly window
        //     (the earliest one of each month).
        var keep = new HashSet<Guid>();
        foreach (var b in all.Where(b => b.CreatedAt >= dailyCutoff)) keep.Add(b.Id);
        var monthlyBuckets = all
            .Where(b => b.CreatedAt >= monthlyCutoff && b.CreatedAt < dailyCutoff)
            .GroupBy(b => new { b.CreatedAt.Year, b.CreatedAt.Month });
        foreach (var g in monthlyBuckets)
        {
            var earliest = g.OrderBy(b => b.CreatedAt).First();
            keep.Add(earliest.Id);
        }
        // Never prune something scheduler-created within the last 24h —
        // avoids racing our own current run.
        foreach (var b in all.Where(b => b.CreatedAt > now.AddDays(-1))) keep.Add(b.Id);

        var toPrune = all.Where(b => !keep.Contains(b.Id)).ToList();
        if (toPrune.Count == 0) return;

        foreach (var row in toPrune)
        {
            if (!string.IsNullOrEmpty(row.StoragePath))
            {
                try { await storage.DeleteAsync(row.StoragePath, ct); }
                catch (Exception ex) { _log.LogWarning(ex, "Prune: could not delete file {Path}", row.StoragePath); }
            }
            row.DeletedAt = now;
        }
        await db.SaveChangesAsync(ct);
        _log.LogInformation("Platform backup pruning: soft-deleted {Count} archives (daily-window={Days}d, monthly-window={Months}mo)",
            toPrune.Count, schedule.RetentionDaysDaily, schedule.RetentionMonthsMonthly);
    }

    private static async Task NotifyAsync(IEmailSender email, PlatformBackupSchedule s,
        bool success, string fileName, long sizeBytes, string? message, CancellationToken ct)
    {
        var subject = success
            ? $"Kalypsis backup OK — {fileName}"
            : $"Kalypsis backup FAILED — {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
        var body = $@"<p>Cadence: {s.Cadence} @ {s.HourOfDayUtc:00}:00 UTC</p>
<p>Scope: {s.Scope}</p>
<p>Status: {(success ? "OK" : "FAILED")}</p>
<p>File: {System.Net.WebUtility.HtmlEncode(fileName)}</p>
<p>Size: {sizeBytes / 1024} KB</p>
<p>Message: {System.Net.WebUtility.HtmlEncode(message ?? "")}</p>";
        foreach (var addr in (s.NotifyEmail ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            try { await email.SendAsync(new EmailMessage(addr, addr, subject, body), ct); }
            catch { /* per-recipient failure — swallow */ }
        }
    }
}
