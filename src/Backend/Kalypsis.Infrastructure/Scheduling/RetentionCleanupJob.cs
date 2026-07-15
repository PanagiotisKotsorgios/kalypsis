using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// GDPR Άρθρο 5(1)(ε) — αρχή περιορισμού περιόδου διατήρησης.
///
/// Κάθε 24 ώρες σαρώνει τα journal-like tables και σβήνει εγγραφές που έχουν
/// υπερβεί τη δηλωμένη περίοδο διατήρησης της Πολιτικής Απορρήτου:
///
///   - AuditLog rows παλαιότερα από 12 μήνες
///   - Notification rows παλαιότερα από 6 μήνες που είναι διαβασμένα
///   - CommunicationLog rows παλαιότερα από 24 μήνες
///
/// Idempotent + rate-limited: το κάθε iteration δουλεύει σε batches για να
/// μην κρατά μεγάλες συναλλαγές. Η πρώτη εκτέλεση καθυστερεί 5 λεπτά ώστε
/// να ολοκληρωθεί ο seeder και να μην τραβήξει κύκλους στο boot.
/// </summary>
public class RetentionCleanupJob : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(5);

    private const int AuditLogRetentionMonths = 12;
    private const int NotificationRetentionMonths = 6;
    private const int CommunicationLogRetentionMonths = 24;

    private const int BatchSize = 500;

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<RetentionCleanupJob> _log;

    public RetentionCleanupJob(IServiceScopeFactory scopes, ILogger<RetentionCleanupJob> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(InitialDelay, stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Retention cleanup iteration failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();
        var now = clock.UtcNow;

        var auditCutoff = now.AddMonths(-AuditLogRetentionMonths);
        var notificationCutoff = now.AddMonths(-NotificationRetentionMonths);
        var communicationCutoff = now.AddMonths(-CommunicationLogRetentionMonths);

        var deletedAudit = await PurgeAuditAsync(db, auditCutoff, ct);
        var deletedNotifications = await PurgeNotificationsAsync(db, notificationCutoff, ct);
        var deletedCommunications = await PurgeCommunicationsAsync(db, communicationCutoff, ct);

        if (deletedAudit + deletedNotifications + deletedCommunications > 0)
        {
            _log.LogInformation(
                "Retention cleanup: pruned {Audit} AuditLog rows (>{AuditMonths}mo), " +
                "{Notif} Notification rows (>{NotifMonths}mo, read), " +
                "{Comm} CommunicationLog rows (>{CommMonths}mo).",
                deletedAudit, AuditLogRetentionMonths,
                deletedNotifications, NotificationRetentionMonths,
                deletedCommunications, CommunicationLogRetentionMonths);
        }
    }

    private static async Task<int> PurgeAuditAsync(AppDbContext db, DateTime cutoff, CancellationToken ct)
    {
        int total = 0;
        while (true)
        {
            var batch = await db.AuditLogs.IgnoreQueryFilters()
                .Where(a => a.CreatedAt < cutoff)
                .Take(BatchSize).ToListAsync(ct);
            if (batch.Count == 0) break;
            db.AuditLogs.RemoveRange(batch);
            total += await db.SaveChangesAsync(ct);
            if (batch.Count < BatchSize) break;
        }
        return total;
    }

    private static async Task<int> PurgeNotificationsAsync(AppDbContext db, DateTime cutoff, CancellationToken ct)
    {
        int total = 0;
        while (true)
        {
            var batch = await db.Notifications.IgnoreQueryFilters()
                .Where(n => n.ReadAt != null && n.CreatedAt < cutoff)
                .Take(BatchSize).ToListAsync(ct);
            if (batch.Count == 0) break;
            db.Notifications.RemoveRange(batch);
            total += await db.SaveChangesAsync(ct);
            if (batch.Count < BatchSize) break;
        }
        return total;
    }

    private static async Task<int> PurgeCommunicationsAsync(AppDbContext db, DateTime cutoff, CancellationToken ct)
    {
        int total = 0;
        while (true)
        {
            var batch = await db.CommunicationLogs.IgnoreQueryFilters()
                .Where(c => c.CreatedAt < cutoff)
                .Take(BatchSize).ToListAsync(ct);
            if (batch.Count == 0) break;
            db.CommunicationLogs.RemoveRange(batch);
            total += await db.SaveChangesAsync(ct);
            if (batch.Count < BatchSize) break;
        }
        return total;
    }
}
