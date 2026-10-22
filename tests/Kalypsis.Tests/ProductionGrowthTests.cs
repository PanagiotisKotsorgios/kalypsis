using Kalypsis.Api.Authorization;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class ProductionGrowthTests
{
    [Theory]
    [InlineData(PolicyStatus.Active, -1, 1, true)]
    [InlineData(PolicyStatus.Active, 0, 0, true)]
    [InlineData(PolicyStatus.Active, 1, 10, false)]
    [InlineData(PolicyStatus.Active, -10, -1, false)]
    [InlineData(PolicyStatus.PendingRenewal, -10, 10, true)]
    [InlineData(PolicyStatus.Renewed, -10, 10, true)]
    [InlineData(PolicyStatus.Undelivered, -10, 10, true)]
    [InlineData(PolicyStatus.Renewed, -10, -1, false)]
    [InlineData(PolicyStatus.Cancelled, -10, 10, false)]
    [InlineData(PolicyStatus.Expired, -10, 10, false)]
    [InlineData(PolicyStatus.Prospect, -10, 10, false)]
    [InlineData(PolicyStatus.Draft, -10, 10, false)]
    [InlineData(PolicyStatus.AwaitingIssue, -10, 10, false)]
    public async Task Dates_and_statuses_agree_between_customer_card_and_growth_without_mutating_records(PolicyStatus status, int start, int end, bool insured)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var clock = TestScaffold.Clock;
        var today = DateOnly.FromDateTime(clock.UtcNow);
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = Customer(current.TenantId!.Value,"C-DATES");
        var need = Need(customer,"Home","Κύρια κατοικία");
        var policy = Policy(customer,PolicyType.Home,status); policy.StartDate = today.AddDays(start); policy.EndDate = today.AddDays(end);
        db.AddRange(customer,need,policy); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        var growth = Assert.Single(await new GetProductionGrowthHandler(db,current,clock).Handle(new(),default));
        var profile = await new GetCustomerFamilyProfileHandler(db,current,clock).Handle(new(customer.Id),default);
        Assert.Equal(!insured,growth.IsOpportunity); Assert.Equal(insured ? 1 : 0,growth.ActivePolicyCount);
        Assert.Equal(insured ? "ActivePolicy" : "Uncovered",growth.CoverageState);
        Assert.Equal(insured ? 0 : 1,profile.Opportunities.Count);
        Assert.Equal(status,(await db.Policies.SingleAsync()).Status);
        Assert.False((await db.CustomerInsuranceNeeds.SingleAsync()).IsInsured);
        Assert.All(db.ChangeTracker.Entries(),entry=>Assert.Equal(EntityState.Unchanged,entry.State));
    }

    [Fact]
    public async Task Office_list_reuses_customer_card_opportunities_without_duplicating_family_members()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var parent = Customer(tenant, "C-PARENT");
        var child = Customer(tenant, "C-CHILD");
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Code = "P1", Name = "Συνεργάτης" };
        var home = Need(parent, "Home", "Κατοικία", priority: 5);
        var car = Need(parent, "Vehicle", "Όχημα");
        var health = Need(child, "Health", "Υγεία", insured: true);
        var life = Need(child, "Life", "Ζωή");
        var auto = Policy(parent, PolicyType.Auto, PolicyStatus.Active, producer.Id);
        var expired = Policy(parent, PolicyType.Home, PolicyStatus.Expired, producer.Id);
        db.AddRange(parent, child, producer, home, car, health, life, auto, expired,
            Relation(parent, child), Relation(child, parent));
        await db.SaveChangesAsync();

        var rows = await new GetProductionGrowthHandler(db, current, TestScaffold.Clock).Handle(new(), default);
        var profile = await new GetCustomerFamilyProfileHandler(db, current, TestScaffold.Clock).Handle(new(parent.Id), default);

        Assert.Equal(4, rows.Count);
        Assert.Equal(rows.Count, rows.Select(r => r.Id).Distinct().Count());
        Assert.Equal(profile.Opportunities.Select(o => o.NeedTitle).Order(), rows.Where(r => r.IsOpportunity).Select(r => r.NeedTitle).Order());
        Assert.Equal(home.Id, rows[0].NeedId);
        Assert.Equal("ActivePolicy", rows.Single(r => r.NeedId == car.Id).CoverageState);
        Assert.Equal("DeclaredInsured", rows.Single(r => r.NeedId == health.Id).CoverageState);
        Assert.Equal("Uncovered", rows.Single(r => r.NeedId == home.Id).CoverageState);
        Assert.All(rows.Where(r => r.CustomerId == parent.Id), row =>
        {
            Assert.Contains("Vehicle", row.AssetKinds);
            Assert.Contains("Auto", row.ActivePolicyTypes);
            Assert.Single(row.Producers);
            Assert.Equal(producer.Id, row.Producers[0].Id);
            Assert.Single(row.Family);
            Assert.Equal(child.Id, row.Family[0].CustomerId);
        });
        Assert.True(health.IsInsured);
        Assert.Null(parent.DeletedAt);
        Assert.Equal(4, await db.CustomerInsuranceNeeds.CountAsync());
    }

    [Fact]
    public async Task Unknown_customers_and_multiple_assets_are_preserved_without_invented_sales_proposals()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var empty = Customer(tenant, "NO-NEEDS");
        var owner = Customer(tenant, "OWNER");
        var first = Need(owner, "Home", "Κατοικία Α");
        var second = Need(owner, "Home", "Κατοικία Β");
        var unavailable = Need(owner, "Vehicle", "Δεν διαθέτει όχημα");
        unavailable.HasAsset = false;
        db.AddRange(empty, owner, first, second, unavailable);
        await db.SaveChangesAsync();
        var rows = await new GetProductionGrowthHandler(db, current, TestScaffold.Clock).Handle(new(), default);
        var unknown = Assert.Single(rows, r => r.CustomerId == empty.Id);
        Assert.Null(unknown.NeedId);
        Assert.Null(unknown.HasAsset);
        Assert.False(unknown.IsOpportunity);
        Assert.Equal("Unknown", unknown.CoverageState);
        Assert.Equal(2, rows.Count(r => r.IsOpportunity));
        Assert.Equal("NoAsset", rows.Single(r => r.NeedId == unavailable.Id).CoverageState);
        Assert.DoesNotContain("Vehicle", rows.First(r => r.CustomerId == owner.Id).AssetKinds);
    }

    [Fact]
    public async Task Tenant_office_and_deleted_data_never_leak_into_the_growth_list_or_coverage_decisions()
    {
        var tenant = Guid.NewGuid();
        var otherTenant = Guid.NewGuid();
        var office = Guid.NewGuid();
        var otherOffice = Guid.NewGuid();
        var database = $"growth-{Guid.NewGuid()}";
        Guid targetId;
        await using (var seed = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock, database))
        {
            var target = Customer(tenant, "VISIBLE"); target.AgencyOfficeScopeId = office; targetId = target.Id;
            var elsewhere = Customer(tenant, "OTHER-OFFICE"); elsewhere.AgencyOfficeScopeId = otherOffice;
            var foreign = Customer(otherTenant, "OTHER-TENANT"); foreign.AgencyOfficeScopeId = office;
            var deleted = Customer(tenant, "DELETED"); deleted.AgencyOfficeScopeId = office; deleted.DeletedAt = TestScaffold.Clock.UtcNow;
            seed.AddRange(target, elsewhere, foreign, deleted);
            foreach (var person in new[] { target, elsewhere, foreign, deleted })
            {
                var need = Need(person, "Home", person.CustomerNumber);
                need.AgencyOfficeScopeId = person.AgencyOfficeScopeId;
                seed.Add(need);
            }
            var archivedNeed = Need(target, "Life", "DELETED-NEED"); archivedNeed.AgencyOfficeScopeId = office; archivedNeed.DeletedAt = TestScaffold.Clock.UtcNow;
            var hiddenPolicy = Policy(target, PolicyType.Home, PolicyStatus.Active); hiddenPolicy.AgencyOfficeScopeId = otherOffice;
            seed.AddRange(archivedNeed, hiddenPolicy);
            await seed.SaveChangesAsync();
        }
        var current = new OfficeUser(tenant, office);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, database);
        var rows = await new GetProductionGrowthHandler(db, current, TestScaffold.Clock).Handle(new(), default);
        var visible = Assert.Single(rows);
        Assert.Equal(targetId, visible.CustomerId);
        Assert.Equal("VISIBLE", visible.NeedTitle);
        Assert.True(visible.IsOpportunity);
        Assert.Empty(visible.ActivePolicyTypes);
    }

    [Fact]
    public void Endpoint_uses_existing_staff_and_customer_read_permissions()
    {
        var type = typeof(ProductionGrowthController);
        Assert.Equal("AgencyStaff", Assert.Single(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
        Assert.Equal("customers.read", Assert.Single(type.GetCustomAttributes(typeof(RequirePermissionAttribute), true).Cast<RequirePermissionAttribute>()).Code);
    }

    private static Customer Customer(Guid tenant, string number) => new()
    { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = number, Type = CustomerType.Individual, Status = CustomerStatus.Active, FirstName = "Δοκιμή", LastName = number, City = "Αθήνα" };
    private static CustomerInsuranceNeed Need(Customer customer, string kind, string title, bool insured = false, int priority = 3) => new()
    { Id = Guid.NewGuid(), TenantId = customer.TenantId, CustomerId = customer.Id, Kind = kind, Title = title, HasAsset = true, IsInsured = insured, Priority = priority };
    private static Policy Policy(Customer customer, PolicyType type, PolicyStatus status, Guid? producer = null) => new()
    { Id = Guid.NewGuid(), TenantId = customer.TenantId, CustomerId = customer.Id, InsuranceCompanyId = Guid.NewGuid(), PolicyNumber = $"P-{Guid.NewGuid()}", PolicyType = type, Status = status, ProducerId = producer, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) };
    private static CustomerRelationship Relation(Customer from, Customer to) => new()
    { Id = Guid.NewGuid(), TenantId = from.TenantId, CustomerId = from.Id, RelatedCustomerId = to.Id, RelationshipType = CustomerRelationshipType.Child };
    private sealed record OfficeUser(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId => Guid.Parse("79755964-3caf-43b4-84a8-3db2bf83d01e");
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyAdmin;
        public string Email => "test@example.test";
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }
}
