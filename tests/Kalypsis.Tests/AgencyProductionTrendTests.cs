using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Reports;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class AgencyProductionTrendTests
{
    private static Policy Policy(Guid tenant, DateOnly date, decimal premium, PolicyStatus status = PolicyStatus.Active,
        Guid? office = null, bool deleted = false) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = Guid.NewGuid().ToString(),
        CustomerId = Guid.NewGuid(), InsuranceCompanyId = Guid.NewGuid(),
        StartDate = date, EndDate = date.AddMonths(12), Premium = premium,
        Status = status, AgencyOfficeScopeId = office, DeletedAt = deleted ? DateTime.UtcNow : null
    };

    [Fact]
    public async Task Exact_days_and_calendar_months_exclude_cancelled_prospects_deleted_and_other_tenants()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var tenant = current.TenantId!.Value;
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Policies.AddRange(
            Policy(tenant, new(2024, 1, 14), 900), Policy(tenant, new(2024, 1, 15), 100.25m),
            Policy(tenant, new(2024, 1, 16), 25.75m, PolicyStatus.Renewed),
            Policy(tenant, new(2024, 3, 10), 50), Policy(tenant, new(2024, 3, 11), 900),
            Policy(tenant, new(2024, 2, 1), 900, PolicyStatus.Cancelled),
            Policy(tenant, new(2024, 2, 1), 900, PolicyStatus.Prospect),
            Policy(tenant, new(2024, 2, 1), 900, deleted: true));
        await db.SaveChangesAsync();
        var result = await new GetAgencyProductionTrendQueryHandler(db, current)
            .Handle(new(new(2024, 1, 15), new(2024, 3, 10)), default);
        Assert.Equal(new[] { "2024-01", "2024-02", "2024-03" }, result.Select(x => x.Label));
        Assert.Equal(new[] { 126m, 0m, 50m }, result.Select(x => x.Value));
        Assert.Equal(8, db.Policies.IgnoreQueryFilters().Count());
    }

    [Fact]
    public async Task Ten_years_are_available_and_empty_months_remain_zero()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Policies.Add(Policy(current.TenantId!.Value, new(2017, 1, 1), 40));
        await db.SaveChangesAsync();
        var result = await new GetAgencyProductionTrendQueryHandler(db, current)
            .Handle(new(new(2017, 1, 1), new(2026, 12, 31)), default);
        Assert.Equal(120, result.Count); Assert.Equal("2017-01", result[0].Label);
        Assert.Equal("2026-12", result[^1].Label); Assert.Equal(40m, result.Sum(x => x.Value));
        Assert.Equal(119, result.Count(x => x.Value == 0));
    }

    [Theory]
    [InlineData("2026-02-01", "2026-01-31")]
    [InlineData("2016-12-01", "2026-12-31")]
    [InlineData("0001-01-01", "0001-01-01")]
    public async Task Invalid_or_unbounded_ranges_are_rejected(string from, string to)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var error = await Assert.ThrowsAsync<AppException>(() => new GetAgencyProductionTrendQueryHandler(db, current)
            .Handle(new(DateOnly.Parse(from), DateOnly.Parse(to)), default));
        Assert.Equal(400, error.StatusCode);
    }

    [Fact]
    public async Task Tenant_and_office_scope_cannot_be_bypassed()
    {
        var tenant = Guid.NewGuid(); var office = Guid.NewGuid(); var name = Guid.NewGuid().ToString();
        var current = TestScaffold.AgencyStaff(tenant);
        await using var seed = TestScaffold.NewDb(current, TestScaffold.Clock, name);
        seed.Policies.AddRange(Policy(tenant, new(2026, 1, 1), 100, office: office),
            Policy(tenant, new(2026, 1, 1), 900, office: Guid.NewGuid()));
        await seed.SaveChangesAsync();
        var otherCurrent = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var other = TestScaffold.NewDb(otherCurrent, TestScaffold.Clock, name);
        other.Policies.Add(Policy(otherCurrent.TenantId!.Value, new(2026, 1, 1), 200));
        await other.SaveChangesAsync();
        var scoped = new OfficeUser(tenant, office);
        await using var db = TestScaffold.NewDb(scoped, TestScaffold.Clock, name);
        var query = new GetAgencyProductionTrendQuery(new(2026, 1, 1), new(2026, 1, 31));
        var result = await new GetAgencyProductionTrendQueryHandler(db, scoped).Handle(query, default);
        Assert.Equal(100m, Assert.Single(result).Value);
        var otherResult = await new GetAgencyProductionTrendQueryHandler(other, otherCurrent).Handle(query, default);
        Assert.Equal(200m, Assert.Single(otherResult).Value);
        var error = await Assert.ThrowsAsync<AppException>(() => new GetAgencyProductionTrendQueryHandler(db, TestScaffold.PlatformAdmin()).Handle(query, default));
        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public void Calendar_month_aggregation_translates_to_MySql_without_connecting()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); TestScaffold.EnsureEncryptorBooted();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=translation_only;User=test", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new AppDbContext(options, current, TestScaffold.Clock);
        var from = new DateOnly(2020, 1, 15); var to = new DateOnly(2026, 10, 23);
        var sql = db.Policies.AsNoTracking().Where(p => p.TenantId == current.TenantId && p.DeletedAt == null
                && p.Status != PolicyStatus.Cancelled && p.Status != PolicyStatus.Prospect && p.StartDate >= from && p.StartDate <= to)
            .GroupBy(p => new { p.StartDate.Year, p.StartDate.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, Total = g.Sum(p => p.Premium) }).ToQueryString();
        foreach (var token in new[] { "GROUP BY", "SUM(", "YEAR", "MONTH", "StartDate", "TenantId" })
            Assert.Contains(token, sql, StringComparison.OrdinalIgnoreCase);
    }

    private sealed record OfficeUser(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId => Guid.NewGuid();
        public string Email => "office@example.com";
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyUser;
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }
}
