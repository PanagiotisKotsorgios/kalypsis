using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Platform-wide backup scheduler configuration. ONE ROW in the whole
/// platform (enforced by <c>PlatformBackupSchedulerJob</c> reading
/// FirstOrDefault). SuperAdmin edits from /app/platform/backups →
/// Πρόγραμμα αντιγράφων.
///
/// Cadence:
///   • Daily      — one snapshot per day at <see cref="HourOfDayUtc"/>.
///   • Weekly     — one snapshot per week on <see cref="DayOfWeek"/> at that hour.
///   • Monthly    — one snapshot on <see cref="DayOfMonth"/> (1–28) at that hour.
///   • Disabled   — the job idles; manual backups still work.
///
/// Retention: keep every daily archive up to
/// <see cref="RetentionDaysDaily"/> days. On top of that, keep ONE archive
/// per month for the last <see cref="RetentionMonthsMonthly"/> months
/// (grandfather-father-son). Older files get soft-deleted + purged from
/// disk by the same job.
///
/// Notifications: when <see cref="NotifyEmail"/> is set, the job emails
/// a summary after every run — success or failure. Uses the platform's
/// Brevo integration (best-effort; a delivery failure never aborts the
/// backup itself).
/// </summary>
public class PlatformBackupSchedule : BaseEntity
{
    public bool Enabled { get; set; }

    /// <summary>«daily» / «weekly» / «monthly».</summary>
    public string Cadence { get; set; } = "daily";

    /// <summary>Hour (0-23) in UTC when the snapshot fires.</summary>
    public int HourOfDayUtc { get; set; } = 3;

    /// <summary>For weekly cadence: 0=Sun … 6=Sat. Ignored otherwise.</summary>
    public int DayOfWeek { get; set; } = 0;

    /// <summary>For monthly cadence: 1–28 (capped so it always fires,
    /// even in February). Ignored otherwise.</summary>
    public int DayOfMonth { get; set; } = 1;

    /// <summary>«full» → all platform + all tenants. «tenants» → tenant
    /// slices only. «platform» → platform-scoped tables only.</summary>
    public string Scope { get; set; } = "full";

    /// <summary>Days of daily-cadence archives to keep. Default 30.</summary>
    public int RetentionDaysDaily { get; set; } = 30;

    /// <summary>Months of monthly-cadence archives to keep on top of
    /// the daily window. Default 12 (grandfather-father-son).</summary>
    public int RetentionMonthsMonthly { get; set; } = 12;

    /// <summary>Optional email address that receives a summary after
    /// every run. Comma-separated for multiple recipients.</summary>
    public string? NotifyEmail { get; set; }

    /// <summary>Set to true after a successful run to make failure
    /// alerting louder — flips back to false when the next run succeeds.
    /// Read by the health endpoint so ops dashboards can flag «last
    /// scheduled backup failed».</summary>
    public bool LastRunFailed { get; set; }

    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public string? LastRunMessage { get; set; }
    public string? LastRunFileName { get; set; }
    public long LastRunSizeBytes { get; set; }
    public int LastRunDurationSeconds { get; set; }

    public Guid? LastEditedByUserId { get; set; }
}
