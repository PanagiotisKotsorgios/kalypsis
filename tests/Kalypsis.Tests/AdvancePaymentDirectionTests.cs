using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Phase13;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class AdvancePaymentDirectionTests
{
    [Fact]
    public void Migration_preserves_legacy_values_and_model_protects_concurrent_balance_updates()
    {
        var migration = new Kalypsis.Infrastructure.Persistence.Migrations.AddAdvancePaymentDirection();
        var sql = migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.SqlOperation>().Select(operation => operation.Sql).ToList();
        Assert.Contains(sql, command => command.Contains("ADD COLUMN `Direction` varchar(12) CHARACTER SET utf8mb4 NULL"));
        Assert.All(sql, command => Assert.EndsWith(";", command));
        Assert.DoesNotContain(sql, command => command.Contains("UPDATE ") || command.Contains("DELETE ") || command.Contains("DEFAULT 'Incoming'"));
        using var db = TestScaffold.NewDb(TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock);
        var entity = db.Model.FindEntityType(typeof(AdvancePayment))!;
        Assert.True(entity.FindProperty(nameof(AdvancePayment.AllocatedAmount))!.IsConcurrencyToken);
        Assert.True(entity.FindProperty(nameof(AdvancePayment.Direction))!.IsConcurrencyToken);
    }

    private static (Customer Customer, Producer Producer, InsuranceCompany Company, Policy Policy) Seed(AppDbContext db, Guid tenant)
    {
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, Type = CustomerType.Individual, FirstName = "Anna", LastName = "Test" };
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Name = "Producer" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Name = "Company" };
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "POL1", CustomerId = customer.Id, Customer = customer,
            InsuranceCompanyId = company.Id, InsuranceCompany = company, ProducerId = producer.Id, Producer = producer,
            Premium = 100, Currency = "EUR", Status = PolicyStatus.Active };
        db.Policies.Add(policy);
        return (customer, producer, company, policy);
    }

    private static AdvancePaymentBody Body(Guid customer, string? direction = "Incoming", decimal amount = 100) =>
        new("AD-" + Guid.NewGuid().ToString("N")[..8], new(2026, 10, 21), "Customer", customer, null, null, amount, "EUR", "BankTransfer", null, null, direction);

    [Theory]
    [InlineData("Incoming", "Customer")]
    [InlineData("Outgoing", "Customer")]
    [InlineData("Incoming", "Producer")]
    [InlineData("Outgoing", "Producer")]
    [InlineData("Incoming", "Carrier")]
    [InlineData("Outgoing", "Carrier")]
    public async Task Direction_is_explicit_and_independent_of_party(string direction, string party)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var body = Body(seed.Customer.Id, direction) with { PartyType = party, ProducerId = seed.Producer.Id, InsuranceCompanyId = seed.Company.Id };
        var result = await new CreateAdvancePaymentHandler(db).Handle(new(body), default);
        Assert.Equal(direction, result.Direction); Assert.Equal(100, result.Amount); Assert.Equal(0, result.AllocatedAmount);
        Assert.Equal(party == "Customer" ? seed.Customer.Id : (Guid?)null, result.CustomerId);
        Assert.Equal(party == "Producer" ? seed.Producer.Id : (Guid?)null, result.ProducerId);
        Assert.Equal(party == "Carrier" ? seed.Company.Id : (Guid?)null, result.InsuranceCompanyId);
        Assert.Empty(db.Receipts); Assert.Empty(db.Payments); Assert.Empty(db.FinancialMovements);
    }

    [Theory]
    [InlineData(null, 100)] [InlineData("", 100)] [InlineData("Unknown", 100)]
    [InlineData("Incoming", -1)] [InlineData("Outgoing", 0)] [InlineData("Incoming", 1.001)]
    public async Task Invalid_direction_or_amount_does_not_create_a_record(string? direction, double amount)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id, direction, (decimal)amount)), default));
        Assert.Empty(db.AdvancePayments);
    }

    [Fact]
    public async Task Legacy_rows_stay_unclassified_and_can_be_classified_without_losing_allocations()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value);
        var legacy = new AdvancePayment { Id = Guid.NewGuid(), TenantId = current.TenantId.Value, Number = "OLD", PartyType = "Customer", CustomerId = seed.Customer.Id,
            Amount = 100, AllocatedAmount = 40, Status = "PartiallyAllocated", Currency = "EUR" };
        db.AdvancePayments.Add(legacy);
        db.ReconciliationLinks.Add(new ReconciliationLink { Id = Guid.NewGuid(), TenantId = current.TenantId.Value, SourceType = "Advance", SourceId = legacy.Id,
            TargetType = "Policy", TargetId = seed.Policy.Id, Amount = 40, Currency = "EUR" }); await db.SaveChangesAsync();
        var before = Assert.Single(await new ListAdvancePaymentsHandler(db).Handle(new(null, null, "Unspecified"), default));
        Assert.Null(before.Direction); Assert.Single(before.Allocations);
        await Assert.ThrowsAsync<AppException>(() => new AllocateAdvanceHandler(db).Handle(new(legacy.Id, seed.Policy.Id, 10), default));
        await new SetAdvanceDirectionHandler(db).Handle(new(legacy.Id, "Incoming"), default);
        Assert.Equal(40, legacy.AllocatedAmount); Assert.Equal(100, legacy.Amount); Assert.Single(db.ReconciliationLinks);
        Assert.Empty(await new ListAdvancePaymentsHandler(db).Handle(new(null, null, "Unspecified"), default));
        await Assert.ThrowsAsync<AppException>(() => new SetAdvanceDirectionHandler(db).Handle(new(legacy.Id, "Outgoing"), default));
    }

    [Theory]
    [InlineData("Incoming")]
    [InlineData("Outgoing")]
    public async Task Allocation_updates_only_available_amount_and_links_never_duplicate_cash_movements(string direction)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var advance = await new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id, direction)), default);
        var handler = new AllocateAdvanceHandler(db);
        var first = await handler.Handle(new(advance.Id, seed.Policy.Id, 30), default);
        Assert.Equal("PartiallyAllocated", first.Status); Assert.Equal(30, first.AllocatedAmount); Assert.Equal(direction, first.Direction);
        var last = await handler.Handle(new(advance.Id, seed.Policy.Id, 70), default);
        Assert.Equal("FullyAllocated", last.Status); Assert.Equal(100, Assert.Single(last.Allocations).Amount);
        Assert.Single(db.ReconciliationLinks); Assert.Empty(db.Receipts); Assert.Empty(db.Payments); Assert.Empty(db.FinancialMovements);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(advance.Id, seed.Policy.Id, .01m), default));
    }

    [Theory]
    [InlineData("Incoming", "Customer")]
    [InlineData("Outgoing", "Customer")]
    [InlineData("Incoming", "Producer")]
    [InlineData("Outgoing", "Producer")]
    [InlineData("Incoming", "Carrier")]
    [InlineData("Outgoing", "Carrier")]
    public async Task Partial_advance_can_be_split_across_policies_without_settling_whole_debts(string direction, string party)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value);
        seed.Policy.Premium = 1000;
        var second = new Policy { Id = Guid.NewGuid(), TenantId = current.TenantId.Value, PolicyNumber = "POL2",
            CustomerId = seed.Customer.Id, Customer = seed.Customer, InsuranceCompanyId = seed.Company.Id, InsuranceCompany = seed.Company,
            ProducerId = seed.Producer.Id, Producer = seed.Producer, Premium = 2000, Currency = "EUR", Status = PolicyStatus.Active };
        db.Policies.Add(second); await db.SaveChangesAsync();
        var body = Body(seed.Customer.Id, direction, 125.55m) with { PartyType = party, ProducerId = seed.Producer.Id, InsuranceCompanyId = seed.Company.Id };
        var advance = await new CreateAdvancePaymentHandler(db).Handle(new(body), default);
        var handler = new AllocateAdvanceHandler(db);
        var first = await handler.Handle(new(advance.Id, seed.Policy.Id, 25.25m), default);
        Assert.Equal("PartiallyAllocated", first.Status);
        Assert.Equal(100.30m, first.Amount - first.AllocatedAmount);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(advance.Id, second.Id, 100.31m), default));
        var last = await handler.Handle(new(advance.Id, second.Id, 100.30m), default);
        Assert.Equal("FullyAllocated", last.Status);
        Assert.Equal(125.55m, last.Allocations.Sum(row => row.Amount));
        Assert.Equal(2, last.Allocations.Count);
        Assert.Equal(1000, seed.Policy.Premium); Assert.Equal(2000, second.Premium);
        Assert.Equal(PolicyStatus.Active, seed.Policy.Status);
        Assert.Empty(db.Receipts); Assert.Empty(db.Payments); Assert.Empty(db.FinancialMovements);
    }

    [Fact]
    public async Task List_filters_and_cross_tenant_access_are_enforced()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var name = Guid.NewGuid().ToString(); using var db = TestScaffold.NewDb(current, TestScaffold.Clock, name);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var incoming = await new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id)), default);
        await new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id, "Outgoing")), default);
        Assert.Equal("Incoming", Assert.Single(await new ListAdvancePaymentsHandler(db).Handle(new(null, null, "Incoming"), default)).Direction);
        Assert.Equal("Outgoing", Assert.Single(await new ListAdvancePaymentsHandler(db).Handle(new(null, null, "Outgoing"), default)).Direction);
        using var foreign = TestScaffold.NewDb(TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock, name);
        Assert.Empty(await new ListAdvancePaymentsHandler(foreign).Handle(new(null, null), default));
        await Assert.ThrowsAsync<AppException>(() => new CreateAdvancePaymentHandler(foreign).Handle(new(Body(seed.Customer.Id)), default));
        await Assert.ThrowsAsync<AppException>(() => new SetAdvanceDirectionHandler(foreign).Handle(new(incoming.Id, "Outgoing"), default));
        await Assert.ThrowsAsync<AppException>(() => new AllocateAdvanceHandler(foreign).Handle(new(incoming.Id, seed.Policy.Id, 10), default));
    }

    [Fact]
    public async Task Allocation_blocks_wrong_party_currency_overallocation_refunded_and_generic_endpoint_bypass()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var advance = await new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id)), default);
        var handler = new AllocateAdvanceHandler(db);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(advance.Id, seed.Policy.Id, 101), default));
        seed.Policy.CustomerId = Guid.NewGuid(); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(advance.Id, seed.Policy.Id, 10), default));
        seed.Policy.CustomerId = seed.Customer.Id; seed.Policy.Currency = "USD"; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(advance.Id, seed.Policy.Id, 10), default));
        seed.Policy.Currency = "EUR"; var stored = await db.AdvancePayments.SingleAsync(); stored.Status = "Refunded"; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new LinkReconciliationHandler(db).Handle(new(new("Advance", advance.Id, "Policy", seed.Policy.Id, 10, "EUR")), default));
        Assert.Empty(db.ReconciliationLinks); Assert.Equal(0, stored.AllocatedAmount);
    }

    [Fact]
    public async Task Only_outgoing_producer_advances_link_to_their_finalised_commission_runs()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value; var seed = Seed(db, tenant);
        foreach (var status in new[] { CommissionRunStatus.Finalised, CommissionRunStatus.Draft })
        {
            var run = new CommissionRun { Id = Guid.NewGuid(), TenantId = tenant, Year = 2026, Month = 10, Title = status.ToString(), Status = status, Currency = "EUR" };
            db.CommissionRuns.Add(run); db.CommissionRunLines.Add(new CommissionRunLine { Id = Guid.NewGuid(), TenantId = tenant, CommissionRunId = run.Id,
                ProducerId = seed.Producer.Id, PolicyId = seed.Policy.Id, InsuranceCompanyId = seed.Company.Id, CommissionAmount = 100, Currency = "EUR" });
        }
        await db.SaveChangesAsync();
        var body = Body(seed.Customer.Id, "Outgoing") with { PartyType = "Producer", ProducerId = seed.Producer.Id };
        var advance = await new CreateAdvancePaymentHandler(db).Handle(new(body), default);
        var runTarget = Assert.Single(await new GetAdvanceCommissionRunsHandler(db).Handle(new(advance.Id), default));
        var allocated = await new AllocateAdvanceHandler(db).Handle(new(advance.Id, runTarget.Id, 50, "CommissionRun"), default);
        Assert.Equal("CommissionRun", Assert.Single(allocated.Allocations).TargetType); Assert.Null(allocated.Allocations[0].PolicyId);
        var incoming = await new CreateAdvancePaymentHandler(db).Handle(new(body with { Number = "INCOMING", Direction = "Incoming" }), default);
        Assert.Empty(await new GetAdvanceCommissionRunsHandler(db).Handle(new(incoming.Id), default));
        await Assert.ThrowsAsync<AppException>(() => new AllocateAdvanceHandler(db).Handle(new(incoming.Id, runTarget.Id, 10, "CommissionRun"), default));
        Assert.Empty(db.Payments); Assert.Empty(db.FinancialMovements);
    }

    [Fact]
    public async Task Concurrent_allocation_of_the_same_advance_is_rejected_instead_of_spending_it_twice()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var name = Guid.NewGuid().ToString(); using var db = TestScaffold.NewDb(current, TestScaffold.Clock, name);
        var seed = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var advance = await new CreateAdvancePaymentHandler(db).Handle(new(Body(seed.Customer.Id)), default);
        using var second = TestScaffold.NewDb(current, TestScaffold.Clock, name);
        await second.AdvancePayments.SingleAsync(); // Read the original balance before another request commits.
        await new AllocateAdvanceHandler(db).Handle(new(advance.Id, seed.Policy.Id, 60), default);
        var error = await Assert.ThrowsAsync<AppException>(() => new AllocateAdvanceHandler(second).Handle(new(advance.Id, seed.Policy.Id, 60), default));
        Assert.Contains("άλλαξε", error.Message);
        db.ChangeTracker.Clear(); Assert.Equal(60, (await db.AdvancePayments.SingleAsync()).AllocatedAmount);
    }
}
