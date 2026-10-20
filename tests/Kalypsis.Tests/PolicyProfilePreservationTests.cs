using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Xunit;

namespace Kalypsis.Tests;

public class PolicyProfilePreservationTests
{
    [Fact]
    public async Task Unchanged_carrier_mappings_do_not_rewrite_nested_vehicle_specs()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = "PROFILE-1", FirstName = "Test", LastName = "Customer" };
        var carrier = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Code = "PROFILE", Name = "Test carrier" };
        var raw = "{\"vehicle\":{\"make\":\"Toyota\",\"flags\":[true,false]},\"coverCode\":\"C1\",\"packageCode\":\"P1\"}";
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customer.Id, Customer = customer,
            InsuranceCompanyId = carrier.Id, InsuranceCompany = carrier, PolicyNumber = "PROFILE-1", PolicyType = PolicyType.Other,
            CarrierBranchCode = "CUSTOM", CarrierCoverageCode = "C1", CarrierPackageCode = "P1", CarrierUseCode = "RAW-USE",
            Status = PolicyStatus.Prospect, StartDate = new DateOnly(2026, 1, 1), EndDate = new DateOnly(2026, 12, 31),
            Premium = 100m, NetPremium = 75m, VatAmount = 25m, SpecialCommissionPercent = 12m, Currency = "EUR", SpecsJson = raw };
        db.Customers.Add(customer); db.InsuranceCompanies.Add(carrier); db.Policies.Add(policy); await db.SaveChangesAsync();
        await new UpdatePolicyCommandHandler(db, current, null!).Handle(new(policy.Id, new UpdatePolicyBody(
            carrier.Id, null, "CUSTOM", policy.StartDate, policy.EndDate, 120m, "EUR", PolicyStatus.Prospect,
            NetPremium: 75m, VatAmount: 25m, SpecialCommissionPercent: 12m, VehicleUseCategory: "RAW-USE", CoverCode: "C1", PackageCode: "P1")), default);
        Assert.Equal(raw, policy.SpecsJson);
        Assert.Equal("CUSTOM", policy.CarrierBranchCode); Assert.Equal("RAW-USE", policy.CarrierUseCode);
        Assert.Equal("C1", policy.CarrierCoverageCode); Assert.Equal("P1", policy.CarrierPackageCode);
        Assert.Equal(75m, policy.NetPremium); Assert.Equal(25m, policy.VatAmount); Assert.Equal(12m, policy.SpecialCommissionPercent);
        var detail = await new GetPolicyDetailQueryHandler(db, current, null!).Handle(new(policy.Id), default);
        Assert.Equal("CUSTOM", detail.CarrierBranchCode); Assert.Equal("P1", detail.CarrierPackageCode); Assert.Equal("C1", detail.CarrierCoverageCode);
    }
}
