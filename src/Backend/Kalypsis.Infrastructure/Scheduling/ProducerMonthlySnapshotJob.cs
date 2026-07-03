using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Once per hour, checks whether it's the 1st of the month between 07:00
/// and 09:00 UTC and — if it hasn't already — emits a monthly-KPI in-app
/// notification to every producer's linked user in every tenant, plus one
/// summary notification to each AgencyAdmin. The snapshot copy is derived
/// from the same numbers <see cref="Kalypsis.Application.Features.Producers.GetProducerMonthlySnapshotQueryHandler"/>
/// serves on-demand, so the operator and the auto-email always agree.
///
/// Idempotent — the notification's Link embeds `#snapshot:{year}-{month}`
/// so a duplicate run in the same window skips silently.
/// </summary>
public class ProducerMonthlySnapshotJob : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ProducerMonthlySnapshotJob> _log;

    public ProducerMonthlySnapshotJob(IServiceScopeFactory scopes, ILogger<ProducerMonthlySnapshotJob> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Producer monthly snapshot job iteration failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        // Only fire on the 1st of the month between 07:00 and 09:00 UTC —
        // the hourly cadence means we'd trigger at most twice per month,
        // and the idempotency guard collapses that to one row.
        if (now.Day != 1 || now.Hour < 7 || now.Hour > 9) return;

        // Report on the month that JUST ENDED.
        var report = new DateTime(now.Year, now.Month, 1).AddMonths(-1);
        var year = report.Year;
        var month = report.Month;
        var firstDay = new DateOnly(year, month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var producers = await db.Producers.IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null && p.Status == ProducerStatus.Active)
            .Select(p => new { p.Id, p.TenantId, p.Name })
            .ToListAsync(ct);

        foreach (var producer in producers)
        {
            var link = $"/app/producers/{producer.Id}#snapshot:{year}-{month:00}";
            var already = await db.Notifications
                .AnyAsync(n => n.TenantId == producer.TenantId && n.Link == link, ct);
            if (already) continue;

            var monthPolicies = await db.Policies
                .Where(p => p.TenantId == producer.TenantId && p.DeletedAt == null
                            && p.ProducerId == producer.Id
                            && p.Status != PolicyStatus.Cancelled
                            && p.Status != PolicyStatus.Draft
                            && p.StartDate >= firstDay && p.StartDate <= lastDay)
                .Select(p => new { p.Premium })
                .ToListAsync(ct);
            var count = monthPolicies.Count;
            var premium = monthPolicies.Sum(x => x.Premium);
            if (count == 0) continue; // nothing to celebrate — skip

            var title = $"Μηνιαία σύνοψη {month:00}/{year}";
            var body = $"Παραγωγή {producer.Name}: {count} συμβόλαια · {premium:0.00} € ασφάλιστρα. " +
                       "Δείτε λεπτομέρειες στο προφίλ του συνεργάτη.";

            // Producer's own portal user, if any.
            var producerUserId = await db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == producer.TenantId && u.DeletedAt == null && u.ProducerId == producer.Id)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync(ct);
            if (producerUserId.HasValue)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = producer.TenantId,
                    UserId = producerUserId.Value,
                    Title = title,
                    Body = body,
                    Category = "producer-snapshot",
                    Link = link
                });
            }
            // One summary row to each AgencyAdmin so the office also sees who moved needle.
            var adminIds = await db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == producer.TenantId && u.DeletedAt == null && u.Role == Role.AgencyAdmin)
                .Select(u => u.Id)
                .ToListAsync(ct);
            foreach (var aid in adminIds)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = producer.TenantId,
                    UserId = aid,
                    Title = title,
                    Body = body,
                    Category = "producer-snapshot",
                    Link = link
                });
            }
        }
        await db.SaveChangesAsync(ct);
        _log.LogInformation("Producer monthly snapshot emitted for {Year}-{Month:00}.", year, month);
    }
}
