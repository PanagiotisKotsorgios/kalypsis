using Kalypsis.Application.Common;
using Kalypsis.Application.Features.GreenCards;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Xunit;

namespace Kalypsis.Tests;

public sealed class PolicyLifecycleAndBalancesTests
{
    private static Policy Policy(Guid tenant, InsuranceCompany company, Customer customer, string number, int year, Policy? previous = null) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, InsuranceCompany = company, InsuranceCompanyId = company.Id,
        Customer = customer, CustomerId = customer.Id, PolicyNumber = number, Status = PolicyStatus.Active,
        PolicyType = PolicyType.Auto, StartDate = new(year, 1, 1), EndDate = new(year + 1, 1, 1),
        IssuedAt = new(year, 1, 1), Premium = 100, Currency = "EUR", VehicleRegistrationPlate = "ABC1234",
        RenewedFromPolicyId = previous?.Id
    };

    [Fact]
    public async Task History_contains_the_whole_real_chain_and_its_operations_not_unrelated_same_plate_policies()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Name = "Company" };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var initial = Policy(tenant, company, customer, "INITIAL", 2024);
        var renewal = Policy(tenant, company, customer, "RENEWAL", 2025, initial);
        var latest = Policy(tenant, company, customer, "LATEST", 2026, renewal);
        var unrelated = Policy(tenant, company, customer, "UNRELATED", 2023);
        db.Policies.AddRange(initial, renewal, latest, unrelated);
        db.PolicyEndorsements.Add(new PolicyEndorsement { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = initial.Id,
            EndorsementNumber = "PP1", IssuedAt = new(2024, 6, 1), EffectiveFrom = new(2024, 6, 1),
            Status = EndorsementStatus.Issued, PremiumDelta = 20, Description = "Additional coverage" });
        db.PolicyCancellations.Add(new PolicyCancellation { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = renewal.Id,
            CancellationNumber = "AK1", RequestedAt = new(2025, 7, 1), EffectiveFrom = new(2025, 7, 2),
            Status = PolicyCancellationStatus.Effective, RefundAmount = 30 });
        await db.SaveChangesAsync();

        var handler = new GetPolicyHistoryHandler(db, current);
        foreach (var selected in new[] { initial, renewal, latest })
        {
            var result = await handler.Handle(new(selected.Id), default);
            Assert.False(result.Incomplete); Assert.Equal(5, result.Entries.Count);
            Assert.Equal(new[] { "Initial", "Endorsement", "Renewal", "Cancellation", "Renewal" }, result.Entries.Select(e => e.Kind));
            Assert.DoesNotContain(result.Entries, e => e.PolicyId == unrelated.Id);
            Assert.Equal(-30, Assert.Single(result.Entries, e => e.Kind == "Cancellation").Amount);
            Assert.Equal("Company", result.Entries[0].Company);
            Assert.Contains("INITIAL", result.Entries.Single(e => e.Number == "RENEWAL").Description);
        }
    }

    [Fact]
    public async Task Missing_parent_does_not_invent_a_first_policy_or_guess_from_plate()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var policy = Policy(tenant, company, customer, "ORPHAN", 2026); policy.RenewedFromPolicyId = Guid.NewGuid();
        db.Policies.Add(policy); await db.SaveChangesAsync();
        var result = await new GetPolicyHistoryHandler(db, current).Handle(new(policy.Id), default);
        Assert.True(result.Incomplete); Assert.Equal("Renewal", Assert.Single(result.Entries).Kind);
    }

    [Fact]
    public async Task History_is_tenant_isolated_and_a_cyclic_link_terminates()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var first = Policy(tenant, company, customer, "A", 2025);
        var second = Policy(tenant, company, customer, "B", 2026, first); first.RenewedFromPolicyId = second.Id;
        db.Policies.AddRange(first, second); await db.SaveChangesAsync();
        var result = await new GetPolicyHistoryHandler(db, current).Handle(new(first.Id), default);
        Assert.True(result.Incomplete); Assert.Equal(2, result.Entries.Count);
        await Assert.ThrowsAsync<AppException>(() => new GetPolicyHistoryHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid())).Handle(new(first.Id), default));
    }

    [Fact]
    public async Task Customer_history_does_not_expose_another_customers_predecessor()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid(), role: Role.Customer); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var previousCustomer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var previous = Policy(tenant, company, previousCustomer, "PRIVATE", 2025);
        var selected = Policy(tenant, company, customer, "VISIBLE", 2026, previous);
        db.Users.Add(new User { Id = current.UserId!.Value, TenantId = tenant, CustomerId = customer.Id, Role = Role.Customer });
        db.Policies.AddRange(previous, selected); await db.SaveChangesAsync();
        var handler = new GetPolicyHistoryHandler(db, current);
        var result = await handler.Handle(new(selected.Id), default);
        Assert.True(result.Incomplete); Assert.Equal("VISIBLE", Assert.Single(result.Entries).Number);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(previous.Id), default));
    }

    [Theory]
    [InlineData("{\"make\":\" Toyota \",\"model\":\"Yaris\",\"vin\":\" VIN1 \"}", "Toyota Yaris", "VIN1")]
    [InlineData("{\"vehicle\":{\"make\":\"Ford\",\"model\":\"Focus\",\"vin\":\"VIN2\"}}", "Ford Focus", "VIN2")]
    [InlineData("broken", null, null)]
    [InlineData("[]", null, null)]
    [InlineData(null, null, null)]
    public void Green_card_defaults_handle_flat_nested_and_legacy_specs(string? json, string? name, string? vin)
    {
        var result = GreenCardVehicleDefaults.FromSpecs(json);
        Assert.Equal(name, result.MakeModel); Assert.Equal(vin, result.Vin);
    }

    [Fact]
    public async Task New_green_card_fetches_vehicle_defaults_and_preserves_manual_overrides()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, Type = CustomerType.Individual, FirstName = "Anna", LastName = "Test" };
        var policy = Policy(tenant, company, customer, "P1", 2026);
        policy.SpecsJson = """{"make":"Toyota","model":"Yaris","vin":"VIN1"}""";
        db.Policies.Add(policy); await db.SaveChangesAsync();
        var body = new GreenCardBody(null, null, new(2026, 1, 1), new(2026, 2, 1), null, null, null, null, null, null, null, null, null);
        var handler = new CreateGreenCardCommandHandler(db, current);
        var card = await handler.Handle(new(policy.Id, body), default);
        Assert.Equal("ABC1234", card.VehicleRegistrationPlate); Assert.Equal("Toyota Yaris", card.VehicleMakeModel);
        Assert.Equal("VIN1", card.VehicleVin); Assert.Equal("Anna Test", card.HolderName);
        var custom = await handler.Handle(new(policy.Id, body with { VehicleRegistrationPlate = "CUSTOM", VehicleMakeModel = "Other", VehicleVin = "VIN2" }), default);
        Assert.Equal("CUSTOM", custom.VehicleRegistrationPlate); Assert.Equal("Other", custom.VehicleMakeModel); Assert.Equal("VIN2", custom.VehicleVin);
        Assert.Equal("ABC1234", policy.VehicleRegistrationPlate);
    }

    [Fact]
    public async Task Producer_balances_are_separate_by_currency_and_exclude_drafts_cancelled_and_prospects()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant };
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Name = "Producer" }; db.Producers.Add(producer);
        foreach (var (status, currency, earned, hierarchy) in new[] {
            (PolicyStatus.Active, "EUR", 100m, HierarchyLevel.Producer), (PolicyStatus.Active, "USD", 50m, HierarchyLevel.Manager),
            (PolicyStatus.Draft, "EUR", 900m, HierarchyLevel.Producer), (PolicyStatus.Cancelled, "EUR", 900m, HierarchyLevel.Producer),
            (PolicyStatus.Prospect, "EUR", 900m, HierarchyLevel.Producer), (PolicyStatus.Active, "EUR", 900m, HierarchyLevel.Agency) })
        {
            var policy = Policy(tenant, company, customer, Guid.NewGuid().ToString(), 2026); policy.Status = status;
            db.Policies.Add(policy);
            db.PolicyCommissionSplits.Add(new PolicyCommissionSplit { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id,
                ProducerId = producer.Id, HierarchyLevel = hierarchy, GrossAmount = earned, NetAmount = earned, Currency = currency });
        }
        db.Payments.AddRange(new Payment { Id = Guid.NewGuid(), TenantId = tenant, Number = "PAY1", BeneficiaryType = BeneficiaryType.Producer,
            BeneficiaryProducerId = producer.Id, Amount = 40, Currency = "EUR", PaidOn = new(2026, 6, 1) },
            new Payment { Id = Guid.NewGuid(), TenantId = tenant, Number = "PAY2", BeneficiaryType = BeneficiaryType.Producer,
            BeneficiaryProducerId = producer.Id, Amount = 80, Currency = "USD", PaidOn = new(2026, 6, 1) });
        db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), TenantId = tenant, Amount = 40, ProducerId = producer.Id, Currency = "EUR" });
        await db.SaveChangesAsync();
        var result = await new GetProducerBalancesHandler(db, current).Handle(new(producer.Id), default);
        Assert.Equal(4, result.Entries.Count);
        var eur = Assert.Single(result.Currencies, b => b.Currency == "EUR"); Assert.Equal(100, eur.Earned); Assert.Equal(40, eur.Paid); Assert.Equal(60, eur.ToProducer); Assert.Equal(0, eur.FromProducer);
        var usd = Assert.Single(result.Currencies, b => b.Currency == "USD"); Assert.Equal(0, usd.ToProducer); Assert.Equal(30, usd.FromProducer);
        await Assert.ThrowsAsync<AppException>(() => new GetProducerBalancesHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid())).Handle(new(producer.Id), default));
    }
}
