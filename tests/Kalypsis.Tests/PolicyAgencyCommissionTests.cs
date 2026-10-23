using Kalypsis.Application.Features.Financials;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Xunit;

namespace Kalypsis.Tests;

public sealed class PolicyAgencyCommissionTests
{
    private static async Task<(AppDbContext Db, FakeUser Current, Policy Policy)> Setup(decimal premium = 100m)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var tenant = current.TenantId!.Value;
        var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Test", LastName = "Customer" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Name = "Test company", Code = "TEST" };
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, Customer = customer, CustomerId = customer.Id,
            InsuranceCompany = company, InsuranceCompanyId = company.Id, PolicyNumber = "AGENCY-INCOME",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Currency = "EUR", Premium = premium,
            StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1)
        };
        db.Policies.Add(policy);
        db.PolicyCommissionSplits.Add(new PolicyCommissionSplit
        {
            Id = Guid.NewGuid(), TenantId = tenant, Policy = policy, PolicyId = policy.Id,
            HierarchyLevel = HierarchyLevel.Agency, Percent = 16m, GrossAmount = 16m, NetAmount = 16m, Currency = "EUR"
        });
        await db.SaveChangesAsync();
        return (db, current, policy);
    }

    private static Task<PolicyDetailDto> Detail(AppDbContext db, FakeUser current, Policy policy) =>
        new GetPolicyDetailQueryHandler(db, current, new PolicyCommissionCalculator(db)).Handle(new(policy.Id), default);

    private static Task<ReceiptDto> Receive(AppDbContext db, FakeUser current, Policy policy, decimal amount, string currency = "EUR") =>
        new CreateReceiptCommandHandler(db, current).Handle(new(new ReceiptBody(
            Guid.NewGuid().ToString("N"), new(2026, 6, 1), policy.CustomerId, policy.Id,
            PaymentMethod.Cash, amount, currency, null, null)), default);

    [Theory]
    [InlineData(0, 0)]
    [InlineData(25, 4)]
    [InlineData(50, 8)]
    [InlineData(66.67, 10.67)]
    [InlineData(100, 16)]
    [InlineData(150, 16)]
    public async Task Office_income_follows_actual_receipts_and_never_exceeds_its_commission(decimal receipt, decimal expectedIncome)
    {
        var (db, current, policy) = await Setup();
        await using var scope = db;
        if (receipt > 0) await Receive(db, current, policy, receipt);
        var detail = await Detail(db, current, policy);
        Assert.Equal(16m, detail.AgencyCommissionExpected);
        Assert.Equal(expectedIncome, detail.AgencyCommissionReceived);
        Assert.Equal(16m - expectedIncome, detail.AgencyCommissionOutstanding);
        Assert.Equal(100m, detail.CarrierDue);
        Assert.Equal(0m, detail.CarrierPaid);
        Assert.Equal(100m, detail.CarrierOutstanding);
    }

    [Fact]
    public async Task Bridge_commission_is_not_a_receipt_and_is_not_counted_twice_after_collection()
    {
        var (db, current, policy) = await Setup();
        await using var scope = db;
        db.FinancialMovements.Add(new FinancialMovement
        {
            Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
            Kind = FinancialMovementKind.CommissionEarned, MovementDate = new(2026, 1, 1), Amount = 16m, Currency = "EUR"
        });
        await db.SaveChangesAsync();
        var before = await Detail(db, current, policy);
        Assert.Equal(16m, before.BridgeAgencyCommissionAmount);
        Assert.Equal(0m, before.AgencyCommissionReceived);
        await Receive(db, current, policy, 100m);
        var after = await Detail(db, current, policy);
        Assert.Equal(16m, after.AgencyCommissionReceived);
        Assert.Equal(0m, after.AgencyCommissionOutstanding);
        Assert.Single(db.FinancialMovements.Where(x => x.Kind == FinancialMovementKind.CommissionEarned));
    }

    [Fact]
    public async Task Several_receipts_updates_and_removed_receipts_recalculate_income_from_the_remaining_collections()
    {
        var (db, current, policy) = await Setup();
        await using var scope = db;
        var first = await Receive(db, current, policy, 25m);
        var second = await Receive(db, current, policy, 75m);
        Assert.Equal(16m, (await Detail(db, current, policy)).AgencyCommissionReceived);
        await new UpdateReceiptCommandHandler(db, current).Handle(new(second.Id, new ReceiptBody(
            second.Number, second.ReceivedOn, second.CustomerId, second.PolicyId, second.Method, 25m, "EUR", null, null)), default);
        Assert.Equal(8m, (await Detail(db, current, policy)).AgencyCommissionReceived);
        (await db.Receipts.FindAsync(first.Id))!.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        Assert.Equal(4m, (await Detail(db, current, policy)).AgencyCommissionReceived);
    }

    [Fact]
    public async Task Receipts_in_another_currency_or_without_a_policy_link_do_not_recognise_commission()
    {
        var (db, current, policy) = await Setup();
        await using var scope = db;
        await Receive(db, current, policy, 100m, "USD");
        await new CreateReceiptCommandHandler(db, current).Handle(new(new ReceiptBody(
            "UNASSIGNED", new(2026, 6, 1), policy.CustomerId, null, PaymentMethod.Cash, 100m, "EUR", null, null)), default);
        var detail = await Detail(db, current, policy);
        Assert.Equal(0m, detail.TotalReceived);
        Assert.Equal(0m, detail.AgencyCommissionReceived);
    }

    [Fact]
    public async Task Collection_ratio_uses_the_gross_premium_while_preserving_the_configured_commission_amount()
    {
        var (db, current, policy) = await Setup(200m);
        await using var scope = db;
        policy.NetPremium = 100m;
        await db.SaveChangesAsync();
        await Receive(db, current, policy, 100m);
        Assert.Equal(8m, (await Detail(db, current, policy)).AgencyCommissionReceived);
    }

    [Fact]
    public async Task Zero_premium_does_not_divide_by_zero_or_invent_collected_income()
    {
        var (db, current, policy) = await Setup(0m);
        await using var scope = db;
        Assert.Equal(0m, (await Detail(db, current, policy)).AgencyCommissionReceived);
    }
}
