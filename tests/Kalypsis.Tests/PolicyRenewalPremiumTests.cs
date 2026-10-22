using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class PolicyRenewalPremiumTests
{
    private static Policy Source(Guid tenant, decimal? net = 75m) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "PREVIOUS", PolicyType = PolicyType.Auto,
        Customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = "C-1" },
        InsuranceCompany = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Code = "INS", Name = "Insurer" },
        Status = PolicyStatus.Active, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1),
        Premium = 100m, NetPremium = net, Currency = "EUR"
    };

    [Theory]
    [InlineData(120.5, 90.25, 90.25)]
    [InlineData(0, 0d, 0)]
    [InlineData(100, null, 75)]
    public async Task Renewal_persists_edited_gross_and_net_without_changing_previous_premiums(double gross, double? net, double expectedNet)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var source = Source(current.TenantId!.Value);
        source.CustomerId = source.Customer.Id; source.InsuranceCompanyId = source.InsuranceCompany.Id;
        db.Policies.Add(source); await db.SaveChangesAsync();

        var body = new RenewPolicyBody(new(2027, 1, 1), new(2028, 1, 1), (decimal)gross,
            NetPremium: net.HasValue ? (decimal)net.Value : null);
        var result = await new RenewPolicyCommandHandler(db, current).Handle(new(source.Id, body), default);
        db.ChangeTracker.Clear();
        var renewed = await db.Policies.SingleAsync(p => p.Id == result.Id);
        var previous = await db.Policies.SingleAsync(p => p.Id == source.Id);
        Assert.Equal((decimal)gross, renewed.Premium); Assert.Equal((decimal)expectedNet, renewed.NetPremium);
        Assert.Equal(renewed.NetPremium, result.NetPremium); Assert.Equal(source.Id, renewed.RenewedFromPolicyId);
        Assert.Equal(100m, previous.Premium); Assert.Equal(75m, previous.NetPremium);
        Assert.Equal(PolicyStatus.Renewed, previous.Status);
        var list = await new ListPoliciesQueryHandler(db, current).Handle(new(null, null, null, null), default);
        Assert.Equal(renewed.NetPremium, Assert.Single(list, p => p.Id == renewed.Id).NetPremium);
    }

    [Fact]
    public async Task Legacy_source_without_net_premium_does_not_invent_a_net_amount()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var source = Source(current.TenantId!.Value, null);
        source.CustomerId = source.Customer.Id; source.InsuranceCompanyId = source.InsuranceCompany.Id;
        db.Policies.Add(source); await db.SaveChangesAsync();
        var result = await new RenewPolicyCommandHandler(db, current).Handle(new(source.Id,
            new(new(2027, 1, 1), new(2028, 1, 1), 100m)), default);
        Assert.Null(result.NetPremium);
        Assert.Null((await db.Policies.SingleAsync(p => p.Id == result.Id)).NetPremium);
    }

    [Theory]
    [InlineData(-1, 50d, false)]
    [InlineData(100, -1d, false)]
    [InlineData(0, 0d, true)]
    [InlineData(100, null, true)]
    public void Renewal_validates_both_premiums(double gross, double? net, bool expected)
    {
        var command = new RenewPolicyCommand(Guid.NewGuid(), new(new(2027, 1, 1), new(2028, 1, 1), (decimal)gross,
            NetPremium: net.HasValue ? (decimal)net.Value : null));
        Assert.Equal(expected, new RenewPolicyCommandValidator().Validate(command).IsValid);
    }

    [Fact]
    public async Task Renewal_cannot_read_source_premiums_from_another_tenant()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var source = Source(current.TenantId!.Value);
        source.CustomerId = source.Customer.Id; source.InsuranceCompanyId = source.InsuranceCompany.Id;
        db.Policies.Add(source); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new RenewPolicyCommandHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid()))
            .Handle(new(source.Id, new(new(2027, 1, 1), new(2028, 1, 1), 100m, NetPremium: 80m)), default));
        Assert.Single(await db.Policies.ToListAsync()); Assert.Equal(PolicyStatus.Active, source.Status);
    }
}
