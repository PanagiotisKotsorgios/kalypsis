using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Kalypsis.Tests;

public sealed class DesktopLicenseTrialTests
{
    private const string Installation = "trial-installation-000000000001";
    private const string Token = "trial-client-secret-for-tests-only-000000001";
    private static readonly DateTime Start = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static DesktopLicensesController Controller(AppDbContext db, FixedClock clock, string? token = Token)
    {
        var controller = new DesktopLicensesController(db, new ConfigurationBuilder().Build(), clock)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        if (token is not null) controller.Request.Headers["X-Kalypsis-Desktop-Token"] = token;
        return controller;
    }
    private static DesktopLicensesController.RegisterDesktopRequest Registration() =>
        new(Installation, "Trial Test Office", "Trial Tester", "desktop-trial@example.invalid", "2101234567", null, "Test PC", "Windows", "2.11.1");
    private static DesktopLicensesController.CheckDesktopRequest CheckBody() => new(Installation, null, null, "2.11.1");
    private static DesktopLicensesController.DesktopLicenseStatusResponse Status(ActionResult<DesktopLicensesController.DesktopLicenseStatusResponse> response) =>
        Assert.IsType<DesktopLicensesController.DesktopLicenseStatusResponse>(Assert.IsType<OkObjectResult>(response.Result).Value);

    [Fact]
    public async Task New_registration_grants_exactly_thirty_days_without_a_payment()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var status = Status(await Controller(db, clock).Register(Registration(), default));
        Assert.Equal("Trial", status.Status); Assert.True(status.CanUse); Assert.Equal(30, status.DaysRemaining);
        Assert.Equal(Start, status.AccessStartsAtUtc); Assert.Equal(Start.AddDays(30), status.AccessExpiresAtUtc);
        Assert.Contains("30 ημερών", status.Message);
        var row = Assert.Single(db.DesktopLicenses);
        Assert.Null(row.AccessExpiresAtUtc); Assert.Equal(Start.AddDays(30), row.TrialExpiresAtUtc);
        Assert.Empty(db.DesktopLicensePayments);
    }

    [Theory]
    [InlineData(0, true, 30)]
    [InlineData(29, true, 1)]
    [InlineData(30, false, 0)]
    [InlineData(31, false, 0)]
    public async Task Server_clock_enforces_trial_boundary_and_checks_never_extend_it(int days, bool usable, int remaining)
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var controller = Controller(db, clock);
        await controller.Register(Registration(), default);
        clock.UtcNow = Start.AddDays(days);
        var status = Status(await controller.Check(CheckBody(), default));
        Assert.Equal(usable, status.CanUse); Assert.Equal(remaining, status.DaysRemaining);
        Assert.Equal(usable ? "Trial" : "Expired", status.Status);
        Assert.Equal(Start.AddDays(30), status.AccessExpiresAtUtc);
        if (!usable) Assert.Contains("Επικοινωνήστε", status.Message);
    }

    [Fact]
    public async Task Registration_retry_and_changed_contact_details_do_not_reset_expired_trial()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var controller = Controller(db, clock);
        var first = Status(await controller.Register(Registration(), default));
        clock.UtcNow = Start.AddDays(31);
        var retry = Status(await controller.Register(Registration() with { Email = "changed@example.invalid" }, default));
        Assert.False(retry.CanUse); Assert.Equal(first.AccessExpiresAtUtc, retry.AccessExpiresAtUtc);
        Assert.Equal(first.RegistrationCode, retry.RegistrationCode); Assert.Single(db.DesktopLicenses);
    }

    [Fact]
    public async Task Wrong_or_missing_token_cannot_register_or_check_existing_installation()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        await Controller(db, clock).Register(Registration(), default);
        Assert.IsType<ConflictObjectResult>((await Controller(db, clock, new string('x', 40)).Register(Registration(), default)).Result);
        Assert.IsType<UnauthorizedObjectResult>((await Controller(db, clock, new string('x', 40)).Check(CheckBody(), default)).Result);
        Assert.IsType<UnauthorizedObjectResult>((await Controller(db, clock, null).Register(Registration(), default)).Result);
        Assert.Single(db.DesktopLicenses);
    }

    [Fact]
    public async Task Blocked_or_deleted_installations_cannot_re_register_for_fresh_access()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var controller = Controller(db, clock);
        await controller.Register(Registration(), default);
        var row = Assert.Single(db.DesktopLicenses); row.IsBlocked = true;
        await db.SaveChangesAsync();
        Assert.False(Status(await controller.Register(Registration(), default)).CanUse);
        row.DeletedAt = Start; await db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>((await controller.Register(Registration(), default)).Result);
        Assert.IsType<UnauthorizedObjectResult>((await controller.Check(CheckBody(), default)).Result);
        Assert.Single(db.DesktopLicenses.IgnoreQueryFilters());
    }

    [Fact]
    public async Task Paid_activation_works_after_trial_expiry_and_paid_expiry_does_not_fall_back_to_trial()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var controller = Controller(db, clock);
        await controller.Register(Registration(), default);
        var row = Assert.Single(db.DesktopLicenses);
        clock.UtcNow = Start.AddDays(31);
        row.AccessStartsAtUtc = clock.UtcNow; row.AccessExpiresAtUtc = clock.UtcNow.AddDays(365);
        await db.SaveChangesAsync();
        Assert.Equal("Active", Status(await controller.Check(CheckBody(), default)).Status);
        clock.UtcNow = Start.AddDays(2);
        row.AccessStartsAtUtc = Start; row.AccessExpiresAtUtc = Start.AddDays(1);
        await db.SaveChangesAsync();
        Assert.False(Status(await controller.Check(CheckBody(), default)).CanUse);
    }

    [Fact]
    public async Task Legacy_pending_records_are_not_silently_granted_a_trial()
    {
        var clock = TestScaffold.ClockAt(Start);
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var controller = Controller(db, clock);
        await controller.Register(Registration(), default);
        var row = Assert.Single(db.DesktopLicenses); row.TrialStartedAtUtc = row.TrialExpiresAtUtc = null;
        await db.SaveChangesAsync();
        var status = Status(await controller.Register(Registration(), default));
        Assert.Equal("PendingPayment", status.Status); Assert.False(status.CanUse);
    }

    [Fact]
    public void Trial_columns_match_the_migration_snapshot()
    {
        TestScaffold.EnsureEncryptorBooted();
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql(
            "Server=127.0.0.1;Database=metadata_only;User=test", new MySqlServerVersion(new Version(8, 4, 11))).Options,
            TestScaffold.PlatformAdmin(), TestScaffold.Clock);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot!.Model.FindEntityType(typeof(DesktopLicense).FullName!)!;
        foreach (var name in new[] { "TrialStartedAtUtc", "TrialExpiresAtUtc" })
        {
            Assert.True(snapshot.FindProperty(name)!.IsNullable);
            Assert.Equal(snapshot.FindProperty(name)!.GetColumnType(), db.Model.FindEntityType(typeof(DesktopLicense))!.FindProperty(name)!.GetColumnType());
        }
        Assert.Contains("20261023150000_AddDesktopLicenseTrial", db.GetService<IMigrationsAssembly>().Migrations.Keys);
    }
}
