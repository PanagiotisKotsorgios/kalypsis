using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class PolicyNumberEditTests
{
    private static async Task<(AppDbContext Db, FakeUser Current, Policy Policy, string Store)> Setup()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var store = Guid.NewGuid().ToString("N");
        var db = TestScaffold.NewDb(current, TestScaffold.Clock, store);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value,
            CustomerNumber = "C-1", FirstName = "Test", LastName = "Customer" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = current.TenantId, Code = "INS", Name = "Insurer" };
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = current.TenantId.Value, PolicyNumber = "OLD-001",
            Customer = customer, CustomerId = customer.Id, InsuranceCompany = company, InsuranceCompanyId = company.Id,
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 134m, NetPremium = 100m, VatAmount = 34m,
            Currency = "EUR", StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1), VehicleRegistrationPlate = "ABC1234",
            CarrierCoverageCode = "COVER", CarrierPackageCode = "PACKAGE", SpecsJson = "{\"vehicle\":{\"vin\":\"KEEP\"}}" };
        db.Policies.Add(policy); await db.SaveChangesAsync();
        return (db, current, policy, store);
    }
    private static UpdatePolicyBody Body(Policy policy, string? number) => new(policy.InsuranceCompanyId, policy.ProducerId,
        policy.PolicyType.ToString(), policy.StartDate, policy.EndDate, policy.Premium, policy.Currency, policy.Status,
        NetPremium: policy.NetPremium, VatAmount: policy.VatAmount, CoverCode: policy.CarrierCoverageCode,
        PackageCode: policy.CarrierPackageCode, VehicleRegistrationPlate: policy.VehicleRegistrationPlate, PolicyNumber: number);
    private static Task<PolicyDto> Update(AppDbContext db, ICurrentUser current, Policy policy, string? number) =>
        new UpdatePolicyCommandHandler(db, current, new PolicyCommissionCalculator(db)).Handle(new(policy.Id, Body(policy, number)), default);

    [Fact]
    public async Task Renaming_preserves_identity_related_history_money_specs_and_records_old_and_new_number_in_audit()
    {
        var (db, current, policy, _) = await Setup();
        await using var scope = db;
        var receipt = new Receipt { Id = Guid.NewGuid(), TenantId = policy.TenantId, Number = "R1", PolicyId = policy.Id,
            CustomerId = policy.CustomerId, Amount = 20m, Currency = "EUR", ReceivedOn = new(2026, 6, 1) };
        var movement = new FinancialMovement { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
            InsuranceCompanyId = policy.InsuranceCompanyId, Kind = FinancialMovementKind.CarrierCommissionReceived, Amount = 5m, Currency = "EUR" };
        var renewal = new Policy { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyNumber = "RENEWAL", RenewedFromPolicyId = policy.Id,
            CustomerId = policy.CustomerId, InsuranceCompanyId = policy.InsuranceCompanyId, StartDate = new(2027, 1, 1), EndDate = new(2028, 1, 1) };
        db.AddRange(receipt, movement, renewal); await db.SaveChangesAsync();
        var originalId = policy.Id; var raw = policy.SpecsJson;

        var result = await Update(db, current, policy, "  NEW-000123  ");

        Assert.Equal(originalId, result.Id); Assert.Equal("NEW-000123", result.PolicyNumber);
        Assert.Equal(originalId, receipt.PolicyId); Assert.Equal(originalId, movement.PolicyId); Assert.Equal(originalId, renewal.RenewedFromPolicyId);
        Assert.Equal(20m, receipt.Amount); Assert.Equal(5m, movement.Amount);
        Assert.Equal(134m, policy.Premium); Assert.Equal(100m, policy.NetPremium); Assert.Equal(34m, policy.VatAmount);
        Assert.Equal(raw, policy.SpecsJson); Assert.Equal("COVER", policy.CarrierCoverageCode); Assert.Equal("PACKAGE", policy.CarrierPackageCode);
        Assert.Contains(db.AuditLogs, audit => audit.EntityId == originalId.ToString() && audit.Action == "Update"
            && audit.OldValues!.Contains("OLD-001") && audit.NewValues!.Contains("NEW-000123"));
        db.ChangeTracker.Clear();
        Assert.Equal("NEW-000123", (await db.Policies.SingleAsync(p => p.Id == originalId)).PolicyNumber);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Existing_numbers_in_other_offices_or_recycle_bin_are_rejected_before_mutating_the_policy(bool deleted)
    {
        var (db, current, policy, _) = await Setup();
        await using var scope = db;
        db.Policies.Add(new Policy { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyNumber = "TAKEN",
            AgencyOfficeScopeId = Guid.NewGuid(), DeletedAt = deleted ? DateTime.UtcNow : null,
            CustomerId = policy.CustomerId, InsuranceCompanyId = policy.InsuranceCompanyId });
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<AppException>(() => Update(db, current, policy, " TAKEN "));
        Assert.Equal(409, error.StatusCode); Assert.Equal("duplicate_policy_number", error.Code);
        Assert.Equal("OLD-001", policy.PolicyNumber);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Empty_number_is_rejected_and_omission_from_older_clients_preserves_it(string invalid)
    {
        var (db, current, policy, _) = await Setup();
        await using var scope = db;
        await Assert.ThrowsAsync<AppException>(() => Update(db, current, policy, invalid));
        await Assert.ThrowsAsync<AppException>(() => Update(db, current, policy, new string('X', 65)));
        Assert.Equal("OLD-001", policy.PolicyNumber);
        Assert.Equal("OLD-001", (await Update(db, current, policy, null)).PolicyNumber);
        Assert.Equal("OLD-001", (await Update(db, current, policy, "OLD-001")).PolicyNumber);
    }

    [Fact]
    public async Task Number_namespace_is_per_tenant_but_another_tenants_policy_cannot_be_renamed()
    {
        var (db, current, policy, store) = await Setup();
        await using var scope = db;
        var foreign = new Policy { Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), PolicyNumber = "SHARED" };
        await using (var seed = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock, store))
        { seed.Policies.Add(foreign); await seed.SaveChangesAsync(); }
        Assert.Equal("SHARED", (await Update(db, current, policy, "SHARED")).PolicyNumber);
        await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyCommandHandler(db, current, new PolicyCommissionCalculator(db))
            .Handle(new(foreign.Id, Body(policy, "FORBIDDEN")), default));
        Assert.Equal("SHARED", (await db.Policies.IgnoreQueryFilters().SingleAsync(p => p.Id == foreign.Id)).PolicyNumber);
    }

    [Fact]
    public async Task Concurrent_number_conflict_returns_actionable_error_and_keeps_persisted_original_unchanged()
    {
        var (setup, current, policy, store) = await Setup();
        await using var setupScope = setup;
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(store).Options;
        await using var db = new RacingDb(options, current);
        var loaded = await db.Policies.SingleAsync();
        db.BeforeSave = async () =>
        {
            await using var other = TestScaffold.NewDb(current, TestScaffold.Clock, store);
            other.Policies.Add(new Policy { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyNumber = "RACE",
                CustomerId = policy.CustomerId, InsuranceCompanyId = policy.InsuranceCompanyId });
            await other.SaveChangesAsync();
        };
        var error = await Assert.ThrowsAsync<AppException>(() => Update(db, current, loaded, "RACE"));
        Assert.Equal(409, error.StatusCode); Assert.Equal("duplicate_policy_number", error.Code);
        db.ChangeTracker.Clear();
        Assert.Equal("OLD-001", (await db.Policies.SingleAsync(p => p.Id == policy.Id)).PolicyNumber);
    }
    private sealed class RacingDb(DbContextOptions<AppDbContext> options, ICurrentUser current) : AppDbContext(options, current, TestScaffold.Clock)
    {
        public Func<Task>? BeforeSave;
        public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            if (BeforeSave is { } race) { BeforeSave = null; await race(); throw new DbUpdateException("Simulated concurrent unique-index conflict"); }
            return await base.SaveChangesAsync(ct);
        }
    }
}
