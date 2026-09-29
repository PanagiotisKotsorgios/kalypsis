using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Once per hour, find policies that are about to expire on one of the trigger days
/// (90/60/30/15/7 ahead, plus 7/15/30 days overdue follow-ups) and create an in-app
/// Notification row for the assigned advisor + the customer's portal user if any.
/// Idempotent — each (policy, milestone-day) emits at most one notification.
/// </summary>
public class PolicyRenewalReminderJob : BackgroundService
{
    private static readonly int[] BeforeDays = { 90, 60, 30, 15, 7 };
    private static readonly int[] AfterDays = { 7, 15, 30 };
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PolicyRenewalReminderJob> _log;

    public PolicyRenewalReminderJob(IServiceScopeFactory scopes, ILogger<PolicyRenewalReminderJob> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Delay first run so the seeder has finished.
        try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _log.LogError(ex, "Renewal reminder job iteration failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();
        var today = DateOnly.FromDateTime(clock.UtcNow);

        // Build the set of (offset days, target date) milestones we should check.
        var milestones = new List<(int Offset, DateOnly Target, bool Before)>();
        foreach (var d in BeforeDays) milestones.Add((d, today.AddDays(d), Before: true));
        foreach (var d in AfterDays) milestones.Add((-d, today.AddDays(-d), Before: false));

        foreach (var milestone in milestones)
        {
            var policies = await db.Policies.IgnoreQueryFilters()
                .Where(p => p.DeletedAt == null
                            && (p.Status == PolicyStatus.Active || p.Status == PolicyStatus.PendingRenewal)
                            && p.EndDate == milestone.Target)
                .Select(p => new { p.Id, p.TenantId, p.PolicyNumber, p.CustomerId, p.EndDate, p.PolicyType, p.Status })
                .ToListAsync(ct);

            if (policies.Count == 0) continue;

            foreach (var p in policies)
            {
                var category = milestone.Before ? "renewal-due" : "renewal-overdue";
                var link = $"/app/policies/{p.Id}";
                // Idempotent key — embed the milestone in the link so we can detect "already emitted".
                var marker = milestone.Before ? $"d-{milestone.Offset}" : $"d+{-milestone.Offset}";
                var dedupeLink = $"{link}#renewal:{marker}";

                var already = await db.Notifications
                    .AnyAsync(n => n.TenantId == p.TenantId && n.Link == dedupeLink, ct);
                if (already) continue;

                // Prefer an EmailTemplate tagged for this trigger if the tenant
                // set one; falls back to the built-in Greek copy below.
                var triggerCode = milestone.Before
                    ? milestone.Offset switch
                    {
                        30 => "renewal-30d",
                        7  => "renewal-7d",
                        0  => "renewal-0d",
                        _  => null
                    }
                    : "expired";
                var template = triggerCode is null ? null : await db.EmailTemplates.IgnoreQueryFilters()
                    .Where(t => t.TenantId == p.TenantId && t.DeletedAt == null
                                && t.IsActive && t.PolicyTrigger == triggerCode)
                    .OrderByDescending(t => t.Language == "el")
                    .FirstOrDefaultAsync(ct);

                string title, body;
                if (template is not null)
                {
                    // Poor-man's Scriban — just swap the couple of placeholders
                    // we actually use in the reminder templates. Anything more
                    // elaborate belongs in a proper renderer, not here.
                    title = template.Subject
                        .Replace("{{policyNumber}}", p.PolicyNumber)
                        .Replace("{{daysToExpiry}}", milestone.Offset.ToString());
                    body = (template.BodyPlain ?? template.BodyHtml)
                        .Replace("{{policyNumber}}", p.PolicyNumber)
                        .Replace("{{daysToExpiry}}", milestone.Offset.ToString());
                }
                else
                {
                    var built = BuildCopy(p.PolicyNumber, milestone.Offset, milestone.Before);
                    title = built.Title;
                    body = built.Body;
                }

                // Notify the customer user (Customer portal) if linked.
                var customerUserId = await db.Users.IgnoreQueryFilters()
                    .Where(u => u.TenantId == p.TenantId && u.CustomerId == p.CustomerId && u.DeletedAt == null)
                    .Select(u => (Guid?)u.Id)
                    .FirstOrDefaultAsync(ct);
                if (customerUserId.HasValue)
                {
                    db.Notifications.Add(new Notification
                    {
                        Id = Guid.NewGuid(),
                        TenantId = p.TenantId,
                        UserId = customerUserId.Value,
                        Title = title,
                        Body = body,
                        Category = category,
                        Link = dedupeLink
                    });
                }

                // Notify agency staff (every AgencyAdmin/AgencyUser in the tenant).
                var staff = await db.Users.IgnoreQueryFilters()
                    .Where(u => u.TenantId == p.TenantId && u.DeletedAt == null
                                && (u.Role == Role.AgencyAdmin || u.Role == Role.AgencyOfficeAdmin || u.Role == Role.AgencyUser))
                    .Select(u => u.Id)
                    .ToListAsync(ct);
                foreach (var sid in staff)
                {
                    db.Notifications.Add(new Notification
                    {
                        Id = Guid.NewGuid(),
                        TenantId = p.TenantId,
                        UserId = sid,
                        Title = title,
                        Body = body,
                        Category = category,
                        Link = dedupeLink
                    });
                }
            }
            await db.SaveChangesAsync(ct);
            _log.LogInformation("Renewal reminders emitted: {Count} policies at offset {Offset}d.",
                policies.Count, milestone.Offset);
        }

        await RunCustomerPaymentRemindersAsync(db, today, ct);
    }

    /// <summary>
    /// Payment follow-up is intentionally in the same hourly worker as renewal
    /// reminders.  It covers both generated instalments and annual policies
    /// marked «on credit» with a promised payment date.  Direct-to-carrier
    /// policies are excluded because the office is not collecting that money.
    /// A stable link marker makes the notification idempotent.
    /// </summary>
    private async Task RunCustomerPaymentRemindersAsync(AppDbContext db, DateOnly today, CancellationToken ct)
    {
        var overdue = await db.PolicyInstallments.IgnoreQueryFilters()
            .Where(i => i.DeletedAt == null && i.PaidAt == null && i.DueDate < today
                && i.Policy != null && i.Policy.DeletedAt == null
                && !i.Policy.PaidDirectlyToCarrier
                && (i.Policy.Status == PolicyStatus.Active || i.Policy.Status == PolicyStatus.PendingRenewal))
            .Select(i => new
            {
                i.Id, i.TenantId, i.PolicyId, i.Policy!.PolicyNumber,
                i.Policy.CustomerId, i.Amount, i.DueDate,
                CustomerName = i.Policy.Customer.Type == CustomerType.Company
                    ? i.Policy.Customer.CompanyName
                    : (i.Policy.Customer.FirstName + " " + i.Policy.Customer.LastName)
            })
            .ToListAsync(ct);

        // Annual / single policies do not have PolicyInstallment rows. Keep a
        // separate fallback so their explicit promised date still triggers a
        // useful reminder without inventing a schedule.
        var fallback = await db.Policies.IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null && p.PaidOnCredit && p.PaymentPromisedOn < today
                && p.PaymentPromisedOn != null && !p.PaidDirectlyToCarrier
                && (p.Status == PolicyStatus.Active || p.Status == PolicyStatus.PendingRenewal)
                && !db.PolicyInstallments.IgnoreQueryFilters().Any(i => i.PolicyId == p.Id && i.DeletedAt == null))
            .Select(p => new
            {
                p.Id, p.TenantId, p.PolicyNumber, p.CustomerId, Amount = p.Premium,
                DueDate = p.PaymentPromisedOn!.Value,
                CustomerName = p.Customer.Type == CustomerType.Company
                    ? p.Customer.CompanyName
                    : (p.Customer.FirstName + " " + p.Customer.LastName)
            })
            .ToListAsync(ct);

        var staffByTenant = await db.Users.IgnoreQueryFilters()
            .Where(u => u.DeletedAt == null && u.IsActive && u.Role == Role.AgencyAdmin)
            .GroupBy(u => u.TenantId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(u => u.Id).ToList(), ct);

        foreach (var item in overdue.Select(x => (x.Id, x.TenantId, x.PolicyId, x.PolicyNumber, x.CustomerId, x.Amount, x.DueDate, x.CustomerName))
            .Concat(fallback.Select(x => (x.Id, x.TenantId, x.Id, x.PolicyNumber, x.CustomerId, x.Amount, x.DueDate, x.CustomerName))))
        {
            if (!staffByTenant.TryGetValue(item.TenantId, out var staff)) continue;
            var link = $"/app/customers/{item.CustomerId}#payment-overdue:{item.Item1:N}";
            if (await db.Notifications.IgnoreQueryFilters().AnyAsync(n => n.TenantId == item.TenantId && n.Link == link, ct))
                continue;

            var name = string.IsNullOrWhiteSpace(item.CustomerName) ? "Πελάτης" : item.CustomerName.Trim();
            var title = "Ληξιπρόθεσμη πληρωμή πελάτη";
            var body = $"Ο/Η {name} έχει ανεξόφλητο ποσό {item.Amount:N2} € για το συμβόλαιο {item.PolicyNumber}. Ημερομηνία εξόφλησης: {item.DueDate:dd/MM/yyyy}.";
            foreach (var userId in staff)
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(), TenantId = item.TenantId, UserId = userId,
                    Title = title, Body = body, Category = "customer-payment-overdue", Link = link
                });
            }
        }

        if (overdue.Count > 0 || fallback.Count > 0)
            await db.SaveChangesAsync(ct);
        _log.LogInformation("Customer payment reminders checked: {Installments} instalments, {Annual} annual credit policies.", overdue.Count, fallback.Count);
    }

    private static (string Title, string Body) BuildCopy(string policyNumber, int offsetDays, bool before)
    {
        if (before)
        {
            return offsetDays switch
            {
                >= 60 => ("Επερχόμενη λήξη συμβολαίου",
                          $"Το συμβόλαιο {policyNumber} λήγει σε {offsetDays} ημέρες. Καλό είναι να ξεκινήσει η προετοιμασία της ανανέωσης."),
                30 => ("Ανανέωση εντός 30 ημερών",
                       $"Το συμβόλαιο {policyNumber} λήγει σε 30 ημέρες."),
                15 => ("Άμεση ανανέωση",
                       $"Το συμβόλαιο {policyNumber} λήγει σε 15 ημέρες."),
                7 => ("Επείγον — λήξη σε 7 ημέρες",
                      $"Το συμβόλαιο {policyNumber} λήγει σε 7 ημέρες."),
                _ => ("Επερχόμενη λήξη συμβολαίου",
                      $"Το συμβόλαιο {policyNumber} λήγει σε {offsetDays} ημέρες."),
            };
        }
        return ("Συμβόλαιο εκτός κάλυψης",
                $"Το συμβόλαιο {policyNumber} έληξε πριν {-offsetDays} ημέρες χωρίς ανανέωση.");
    }
}
