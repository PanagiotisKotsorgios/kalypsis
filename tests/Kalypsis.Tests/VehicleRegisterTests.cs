using System.Text.Json;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class VehicleRegisterTests
{
    private static Customer Owner(Guid tenant, string name = "Μαρία") => new() {
        Id = Guid.NewGuid(), TenantId = tenant, Type = CustomerType.Individual, FirstName = name,
        LastName = "Δοκιμή", CustomerNumber = Guid.NewGuid().ToString(), VatNumber = "123456789",
    };
    private static Policy Policy(Customer owner, string plate, int year = 2026, string? specs = null) => new() {
        Id = Guid.NewGuid(), TenantId = owner.TenantId, Customer = owner, CustomerId = owner.Id,
        PolicyNumber = Guid.NewGuid().ToString(), InsuranceCompanyId = Guid.NewGuid(),
        VehicleRegistrationPlate = plate, StartDate = new(year, 1, 1), EndDate = new(year + 1, 1, 1),
        PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 100, SpecsJson = specs,
        VehicleUseCategory = VehicleUseCategory.EIX,
    };

    [Fact]
    public async Task Renewals_collapse_to_one_vehicle_with_latest_owner_and_specs_and_all_history_ids()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var oldOwner = Owner(current.TenantId!.Value, "Προηγούμενος"); var owner = Owner(current.TenantId.Value);
        var old = Policy(oldOwner, "ΑΒΧ-1234", 2025, "{\"make\":\"Toyota\",\"model\":\"Yaris\"}");
        var latest = Policy(owner, " ABX 1234 ", 2026, "{\"make\":\"Toyota\",\"model\":\"Yaris\",\"year\":2022,\"vin\":\"VIN123\",\"fuelType\":\"Βενζίνη\",\"engineCapacity\":1490}");
        db.AddRange(oldOwner, owner, old, latest); await db.SaveChangesAsync();
        var row = Assert.Single(await new VehicleRegisterQueryHandler(db, current).Handle(new(), default));
        Assert.Equal("ABX1234", row.Id); Assert.Equal(latest.Id, row.PrimaryPolicyId);
        Assert.Equal(new[] { latest.Id, old.Id }, row.PolicyIds);
        Assert.Equal("Toyota", row.Make); Assert.Equal("2022", row.Year); Assert.Equal("1490", row.EngineCapacity);
        Assert.Equal("VIN123", row.Vin); Assert.Equal("EIX", row.Use);
        var main = Assert.Single(row.Owners); Assert.Equal("Μαρία Δοκιμή", main.Name); Assert.Equal(owner.Id, main.CustomerId);
        Assert.Equal(2, await db.Policies.CountAsync());
        Assert.Equal("ΑΒΧ-1234", old.VehicleRegistrationPlate);
        Assert.DoesNotContain("premium", JsonSerializer.Serialize(row), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("startDate", JsonSerializer.Serialize(row), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Explicit_coowners_and_shares_are_not_replaced_by_the_policyholder()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var owner = Owner(current.TenantId!.Value);
        var policy = Policy(owner, "ABC1234", specs: "{\"vehicleOwnership\":[{\"name\":\"Ελένη\",\"vatNumber\":\"987654321\",\"percentage\":60},{\"name\":\"Μαρία Δοκιμή\",\"vatNumber\":\"123456789\",\"percentage\":40}]}");
        db.AddRange(owner, policy); await db.SaveChangesAsync();
        var row = Assert.Single(await new VehicleRegisterQueryHandler(db, current).Handle(new(), default));
        Assert.Equal(2, row.Owners.Length);
        Assert.Equal("Ελένη", row.Owners[0].Name); Assert.Equal(60, row.Owners[0].Percentage); Assert.Null(row.Owners[0].CustomerId);
        Assert.Equal(owner.Id, row.Owners[1].CustomerId); Assert.Equal(40, row.Owners[1].Percentage);
    }

    [Fact]
    public async Task Register_is_not_capped_at_500_and_ignores_deleted_foreign_and_empty_records()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var databaseName = Guid.NewGuid().ToString();
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, databaseName);
        var owner = Owner(current.TenantId!.Value); var foreignOwner = Owner(Guid.NewGuid(), "Ξένος");
        var policies = Enumerable.Range(0, 520).Select(index => Policy(owner, $"ABC{index:0000}")).ToArray();
        var deleted = Policy(owner, "DELETED"); deleted.DeletedAt = DateTime.UtcNow;
        db.Add(owner); db.AddRange(policies);
        db.AddRange(deleted, Policy(owner, "   "), Policy(owner, "---"));
        await db.SaveChangesAsync();
        await using (var foreignDb = TestScaffold.NewDb(TestScaffold.AgencyStaff(foreignOwner.TenantId), TestScaffold.Clock, databaseName))
        {
            foreignDb.AddRange(foreignOwner, Policy(foreignOwner, "FOREIGN"));
            await foreignDb.SaveChangesAsync();
        }
        var rows = await new VehicleRegisterQueryHandler(db, current).Handle(new(), default);
        Assert.Equal(520, rows.Count);
        Assert.All(rows, row => Assert.StartsWith("ABC", row.Plate));
    }

    [Theory]
    [InlineData("{broken")]
    [InlineData("[]")]
    [InlineData("null")]
    public async Task Legacy_malformed_specs_do_not_hide_the_vehicle(string raw)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var owner = Owner(current.TenantId!.Value); var policy = Policy(owner, "ABC1234", specs: raw);
        db.AddRange(owner, policy); await db.SaveChangesAsync();
        var row = Assert.Single(await new VehicleRegisterQueryHandler(db, current).Handle(new(), default));
        Assert.Null(row.Make); Assert.Equal(owner.Id, Assert.Single(row.Owners).CustomerId);
        Assert.Equal(raw, policy.SpecsJson);
    }

    [Theory]
    [InlineData(Role.Customer)]
    [InlineData(Role.Producer)]
    public async Task Limited_roles_only_see_their_own_vehicle_and_history(Role role)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid(), role: role);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var owner = Owner(current.TenantId!.Value); var other = Owner(current.TenantId.Value, "Άλλος");
        var producerId = Guid.NewGuid();
        var user = new User { Id = current.UserId!.Value, TenantId = current.TenantId.Value, Role = role,
            CustomerId = role == Role.Customer ? owner.Id : null, ProducerId = role == Role.Producer ? producerId : null };
        var visible = Policy(owner, "ABC1234"); visible.ProducerId = producerId;
        var hidden = Policy(other, "ABC1234"); hidden.ProducerId = Guid.NewGuid();
        db.AddRange(owner, other, user, visible, hidden); await db.SaveChangesAsync();
        var row = Assert.Single(await new VehicleRegisterQueryHandler(db, current).Handle(new(), default));
        Assert.Equal(new[] { visible.Id }, row.PolicyIds);
        Assert.Equal(owner.Id, Assert.Single(row.Owners).CustomerId);
    }
}
