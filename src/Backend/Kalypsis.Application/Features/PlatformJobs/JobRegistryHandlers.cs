using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformJobs;

/*
 * The real background jobs are IHostedService implementations registered
 * in Infrastructure.DependencyInjection; the runtime job list is fixed in
 * code. This registry exposes the metadata to the SuperAdmin and lets them
 * override cron + enabled per job — the override rows live in
 * platform_job_overrides and are read on next tick.
 */

public record JobDto(
    string JobKey, string Name, string Category,
    string CronBaseline, string? CronOverride,
    bool Enabled, string Description);

// Baseline registry — the code-side jobs. When we add a new BackgroundService
// we add a row here so it becomes visible in the SuperAdmin UI. This is the
// only place the frontend and backend both agree on the job list.
internal static class JobCatalog
{
    public record Row(string JobKey, string Name, string Category, string DefaultCron, string Description);

    public static readonly IReadOnlyList<Row> All = new List<Row>
    {
        new("renewal-reminders",     "Renewal reminders",       "notifications", "0 8 * * *",
            "Στέλνει reminders για επικείμενες ανανεώσεις (D-30, D-15, D-3)."),
        new("daily-backup",          "Daily backup",            "housekeeping",  "0 3 * * *",
            "Δημιουργεί καθημερινό backup της βάσης και συγχρονίζει με off-site S3."),
        new("commission-scheduler",  "Commission scheduler",    "billing",       "0 1 1 * *",
            "Δημιουργεί μηνιαία εκκαθαριστικά προμηθειών και τα σφραγίζει."),
        new("maintenance-scan",      "Maintenance scan",        "housekeeping",  "*/15 * * * *",
            "Ελέγχει flags maintenance/launch gate και ενημερώνει PlatformSetting."),
        new("failed-payment-retry",  "Failed-payment retry",    "billing",       "0 */6 * * *",
            "Ξανα-δοκιμάζει αποτυχημένες πληρωμές. Warn = >5 αποτυχίες σε 6h."),
        new("retention-cleanup",     "Retention cleanup",        "housekeeping",  "0 4 * * 0",
            "Εφαρμόζει το Data Retention Schedule — soft-delete + anonymization."),
        new("mydata-submit",         "MyDATA submit",           "integrations",  "0 2 * * *",
            "Στέλνει τιμολόγια στο ΑΑΔΕ MyDATA."),
        new("audit-archive",         "Audit archive",           "housekeeping",  "0 5 1 * *",
            "Παγιώνει audit logs > 12 μηνών σε cold storage."),
        new("email-digest",          "Weekly email digest",      "notifications", "0 9 * * 1",
            "Εβδομαδιαίο digest σε AgencyAdmins."),
        new("kepyo-generator",       "ΚΕΠΥΟ generator",         "reports",       "0 6 15 * *",
            "Δημιουργεί ΚΕΠΥΟ αναφορά μηνιαίως."),
        new("marketing-campaigns",   "Marketing campaigns",     "notifications", "*/10 * * * *",
            "Δρομολογεί προγραμματισμένες marketing καμπάνιες."),
        new("producer-snapshots",    "Producer monthly snapshot", "reports",     "0 3 1 * *",
            "Παγιώνει μηνιαία στοιχεία παραγωγής ανά producer για ιστορικές αναφορές."),
    };
}

public record ListJobsQuery : IRequest<IReadOnlyList<JobDto>>;
public class ListJobsHandler : IRequestHandler<ListJobsQuery, IReadOnlyList<JobDto>>
{
    private readonly IAppDbContext _db;
    public ListJobsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<JobDto>> Handle(ListJobsQuery _, CancellationToken ct)
    {
        var overrides = await _db.PlatformJobOverrides
            .Where(o => o.DeletedAt == null)
            .ToListAsync(ct);
        var overrideMap = overrides.ToDictionary(o => o.JobKey);

        return JobCatalog.All.Select(row =>
        {
            var ov = overrideMap.GetValueOrDefault(row.JobKey);
            return new JobDto(
                row.JobKey, row.Name, row.Category,
                row.DefaultCron, ov?.CronOverride,
                ov?.Enabled ?? true,
                row.Description);
        }).ToList();
    }
}

public record UpsertJobOverrideCommand(string JobKey, string? CronOverride, bool Enabled) : IRequest<JobDto>;

public class UpsertJobOverrideValidator : AbstractValidator<UpsertJobOverrideCommand>
{
    public UpsertJobOverrideValidator()
    {
        RuleFor(x => x.JobKey).NotEmpty();
    }
}

public class UpsertJobOverrideHandler : IRequestHandler<UpsertJobOverrideCommand, JobDto>
{
    private readonly IAppDbContext _db;
    public UpsertJobOverrideHandler(IAppDbContext db) => _db = db;
    public async Task<JobDto> Handle(UpsertJobOverrideCommand r, CancellationToken ct)
    {
        var known = JobCatalog.All.FirstOrDefault(j => j.JobKey == r.JobKey)
            ?? throw AppException.NotFound("Job");

        var ov = await _db.PlatformJobOverrides
            .FirstOrDefaultAsync(x => x.JobKey == r.JobKey && x.DeletedAt == null, ct);
        if (ov == null)
        {
            ov = new PlatformJobOverride { JobKey = r.JobKey };
            _db.PlatformJobOverrides.Add(ov);
        }
        ov.CronOverride = string.IsNullOrWhiteSpace(r.CronOverride) ? null : r.CronOverride.Trim();
        ov.Enabled = r.Enabled;
        await _db.SaveChangesAsync(ct);

        return new JobDto(known.JobKey, known.Name, known.Category,
            known.DefaultCron, ov.CronOverride, ov.Enabled, known.Description);
    }
}

public record TriggerJobCommand(string JobKey) : IRequest;
public class TriggerJobHandler : IRequestHandler<TriggerJobCommand>
{
    public Task Handle(TriggerJobCommand r, CancellationToken ct)
    {
        // Placeholder — actual trigger will publish a message to the
        // background scheduler in a follow-up. Returning success here lets
        // the SuperAdmin UI record the intent + banner while we wire up the
        // real trigger.
        _ = JobCatalog.All.FirstOrDefault(j => j.JobKey == r.JobKey)
            ?? throw AppException.NotFound("Job");
        return Task.CompletedTask;
    }
}
