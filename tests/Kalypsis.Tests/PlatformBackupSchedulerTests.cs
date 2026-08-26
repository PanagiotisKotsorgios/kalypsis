using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Scheduling;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Cadence math for PlatformBackupSchedulerJob.ComputeNextRun. Pure
/// function — no DB, no services. Covers the three cadences + the
/// «from is exactly on the hour» edge (must advance to NEXT slot,
/// not fire on the same instant twice).
/// </summary>
public class PlatformBackupSchedulerTests
{
    // ── Daily ────────────────────────────────────────────────────────

    [Fact]
    public void Daily_BeforeHour_ReturnsToday()
    {
        var s = new PlatformBackupSchedule { Cadence = "daily", HourOfDayUtc = 3 };
        var from = new DateTime(2026, 8, 26, 1, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 8, 26, 3, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void Daily_AtHour_AdvancesToTomorrow()
    {
        // Firing at 03:00; if we ask at exactly 03:00, must move to 03:00
        // the NEXT day — otherwise we'd re-fire in the same tick.
        var s = new PlatformBackupSchedule { Cadence = "daily", HourOfDayUtc = 3 };
        var from = new DateTime(2026, 8, 26, 3, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 8, 27, 3, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void Daily_AfterHour_AdvancesToTomorrow()
    {
        var s = new PlatformBackupSchedule { Cadence = "daily", HourOfDayUtc = 3 };
        var from = new DateTime(2026, 8, 26, 5, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 8, 27, 3, 0, 0, DateTimeKind.Utc), next);
    }

    // ── Weekly ───────────────────────────────────────────────────────

    [Fact]
    public void Weekly_FromMondayForSunday_LandsOnSunday()
    {
        var s = new PlatformBackupSchedule { Cadence = "weekly", HourOfDayUtc = 4, DayOfWeek = 0 /*Sun*/ };
        // 2026-08-24 is a Monday.
        var from = new DateTime(2026, 8, 24, 12, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(DayOfWeek.Sunday, next.DayOfWeek);
        Assert.Equal(4, next.Hour);
        Assert.True(next > from);
    }

    // ── Monthly ──────────────────────────────────────────────────────

    [Fact]
    public void Monthly_BeforeDay_ReturnsThisMonth()
    {
        var s = new PlatformBackupSchedule { Cadence = "monthly", HourOfDayUtc = 6, DayOfMonth = 15 };
        var from = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 8, 15, 6, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void Monthly_AfterDay_AdvancesToNextMonth()
    {
        var s = new PlatformBackupSchedule { Cadence = "monthly", HourOfDayUtc = 6, DayOfMonth = 15 };
        var from = new DateTime(2026, 8, 20, 0, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 9, 15, 6, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void Monthly_DayOfMonth_ClampsTo28_ForFebruary()
    {
        // Guard: February has 28-29 days. DayOfMonth capped to 28 in the
        // computation so a user typing "31" still fires every month.
        var s = new PlatformBackupSchedule { Cadence = "monthly", HourOfDayUtc = 6, DayOfMonth = 31 };
        var from = new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(28, next.Day);
        Assert.Equal(1, next.Month);   // still January
    }

    // ── Default: unknown cadence falls back to daily ─────────────────

    [Fact]
    public void UnknownCadence_FallsBackTo_Daily()
    {
        var s = new PlatformBackupSchedule { Cadence = "banana", HourOfDayUtc = 3 };
        var from = new DateTime(2026, 8, 26, 1, 0, 0, DateTimeKind.Utc);
        var next = PlatformBackupSchedulerJob.ComputeNextRun(s, from);
        Assert.Equal(new DateTime(2026, 8, 26, 3, 0, 0, DateTimeKind.Utc), next);
    }
}
