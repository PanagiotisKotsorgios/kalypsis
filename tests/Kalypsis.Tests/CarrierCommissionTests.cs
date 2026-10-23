using Kalypsis.Api.Authorization;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Financials;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using System.Text.RegularExpressions;
using Xunit;

namespace Kalypsis.Tests;

public sealed class CarrierCommissionTests
{
    private static async Task<(AppDbContext Db, FakeUser User, Policy Policy)> Setup(bool producer = false)
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = user.TenantId!.Value,
            CustomerNumber = "C1", FirstName = "Test", LastName = "Customer" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = user.TenantId, Code = "TEST", Name = "Insurer" };
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = user.TenantId.Value,
            Customer = customer, CustomerId = customer.Id, InsuranceCompany = company, InsuranceCompanyId = company.Id,
            PolicyNumber = "POLICY", Premium = 134m, NetPremium = 100m, Currency = "EUR", Status = PolicyStatus.Active,
            PolicyType = PolicyType.Auto, PaidDirectlyToCarrier = true, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) };
        if (producer)
        {
            policy.Producer = new Producer { Id = Guid.NewGuid(), TenantId = user.TenantId.Value, Code = "P1", Name = "Producer" };
            policy.ProducerId = policy.Producer.Id;
        }
        db.Add(policy);
        db.CommissionRules.Add(new CommissionRule { Id = Guid.NewGuid(), TenantId = user.TenantId.Value,
            InsuranceCompanyId = company.Id, AgencyPercent = 16m, ProducerPercent = 10m,
            CommissionType = CommissionType.Percentage, EffectiveFrom = new(2020, 1, 1) });
        await db.SaveChangesAsync();
        return (db, user, policy);
    }
    private static async Task<CarrierCommissionBalanceDto> Balance(AppDbContext db, ICurrentUser user, Policy policy) =>
        Assert.Single(await CarrierCommissionLedger.BalancesAsync(db, user.TenantId!.Value, default, policy.Id));
    private static Task<CarrierCommissionReceiptDto> Save(AppDbContext db, ICurrentUser user, Guid policyId, Guid id, decimal amount, string? notes = null) =>
        new SaveCarrierCommissionReceiptHandler(db, user).Handle(new(id, new(policyId, new(2026, 6, 1), amount, notes)), default);

    [Theory]
    [InlineData(false, 16)]
    [InlineData(true, 6)]
    public async Task Rules_determine_the_offices_own_receivable_and_policy_card_equals_financial_workspace(bool producer, decimal expected)
    {
        var (db, user, policy) = await Setup(producer);
        await using var scope = db;
        var before = await Balance(db, user, policy);
        Assert.Equal(expected, before.Expected);
        Assert.Equal(expected, before.Outstanding);
        await Save(db, user, policy.Id, Guid.NewGuid(), 2m);
        var detail = await new GetPolicyDetailQueryHandler(db, user, new PolicyCommissionCalculator(db)).Handle(new(policy.Id), default);
        var listed = Assert.Single(await new ListCarrierCommissionBalancesHandler(db, user).Handle(new(), default));
        Assert.Equal(listed.Expected, detail.CarrierCommissionDue);
        Assert.Equal(listed.Received, detail.CarrierCommissionReceived);
        Assert.Equal(listed.Outstanding, detail.CarrierCommissionOutstanding);
        Assert.Equal(listed.Credit, detail.CarrierCommissionCredit);
        Assert.Equal(expected - 2m, detail.CarrierCommissionOutstanding);
        Assert.Equal(0m, detail.TotalReceived); // Not a customer receipt.
        Assert.Empty(db.Receipts);
        Assert.Empty(db.Payments);
    }

    [Fact]
    public async Task Partial_receipts_edit_void_and_retry_use_one_journal_and_keep_audit_without_double_counting_bridge_or_customer_receipts()
    {
        var (db, user, policy) = await Setup();
        await using var scope = db;
        db.FinancialMovements.AddRange(
            new FinancialMovement { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
                Kind = FinancialMovementKind.CommissionEarned, Amount = 16m, Currency = "EUR", MovementDate = new(2026, 1, 1) },
            new FinancialMovement { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
                Kind = FinancialMovementKind.CustomerCredit, Amount = 134m, Currency = "EUR", MovementDate = new(2026, 1, 1) });
        await db.SaveChangesAsync();
        Assert.Equal(0m, (await Balance(db, user, policy)).Received);
        var id = Guid.NewGuid();
        await Save(db, user, policy.Id, id, 5m, "BANK-123");
        await Save(db, user, policy.Id, id, 5m, "BANK-123");
        Assert.Single(db.FinancialMovements.Where(m => m.Kind == FinancialMovementKind.CarrierCommissionReceived));
        Assert.Equal(11m, (await Balance(db, user, policy)).Outstanding);
        var second = await Save(db, user, policy.Id, Guid.NewGuid(), 4m);
        Assert.Equal(7m, (await Balance(db, user, policy)).Outstanding);
        await Save(db, user, policy.Id, id, 8m);
        Assert.Equal(4m, (await Balance(db, user, policy)).Outstanding);
        await new DeleteCarrierCommissionReceiptHandler(db, user, TestScaffold.Clock).Handle(new(second.Id), default);
        Assert.Equal(8m, (await Balance(db, user, policy)).Outstanding);
        Assert.Single(await new ListCarrierCommissionReceiptsHandler(db, user).Handle(new(policy.Id), default));
        Assert.NotNull((await db.FinancialMovements.IgnoreQueryFilters().SingleAsync(m => m.Id == second.Id)).DeletedAt);
        Assert.Contains(db.AuditLogs, audit => audit.EntityId == id.ToString() && audit.Action == "Update");
        Assert.Contains(db.AuditLogs, audit => audit.EntityId == second.Id.ToString() && audit.Action == "Delete");
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, policy.Id, second.Id, 1m));
        var summary = await new GetFinancialSummaryQueryHandler(db).Handle(new(2026), default);
        Assert.Equal(142m, summary.TotalReceipts); // Actual 134 customer + 8 carrier, not 16 accrual.
    }

    [Fact]
    public async Task Overpayment_is_preserved_as_credit_and_parametric_changes_recalculate_due_without_rewriting_received_cash()
    {
        var (db, user, policy) = await Setup();
        await using var scope = db;
        await Save(db, user, policy.Id, Guid.NewGuid(), 20m);
        var paid = await Balance(db, user, policy);
        Assert.Equal(20m, paid.Received); Assert.Equal(0m, paid.Outstanding); Assert.Equal(4m, paid.Credit);
        (await db.CommissionRules.SingleAsync()).AgencyPercent = 25m;
        await db.SaveChangesAsync();
        var changed = await Balance(db, user, policy);
        Assert.Equal(25m, changed.Expected); Assert.Equal(20m, changed.Received); Assert.Equal(5m, changed.Outstanding);
        Assert.Equal(0m, changed.Credit);
    }

    [Theory]
    [InlineData(PolicyStatus.Prospect)]
    [InlineData(PolicyStatus.Draft)]
    [InlineData(PolicyStatus.Cancelled)]
    public async Task Non_production_policies_have_no_expected_receivable(PolicyStatus status)
    {
        var (db, user, policy) = await Setup();
        await using var scope = db;
        policy.Status = status; await db.SaveChangesAsync();
        Assert.Equal(0m, (await Balance(db, user, policy)).Expected);
        if (status != PolicyStatus.Cancelled) await Assert.ThrowsAsync<AppException>(() => Save(db, user, policy.Id, Guid.NewGuid(), 10m));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1.234)]
    [InlineData(1000000000000)]
    public async Task Invalid_amounts_cannot_be_recorded(decimal amount)
    {
        var (db, user, policy) = await Setup();
        await using var scope = db;
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, policy.Id, Guid.NewGuid(), amount));
        Assert.Empty(db.FinancialMovements);
    }

    [Fact]
    public async Task Company_currency_and_scope_are_taken_from_policy_and_other_tenants_or_financial_entry_types_are_inaccessible()
    {
        var (db, user, policy) = await Setup();
        await using var scope = db;
        var existingId = Guid.NewGuid();
        db.FinancialMovements.Add(new FinancialMovement { Id = existingId, TenantId = policy.TenantId,
            Kind = FinancialMovementKind.CustomerCredit, PolicyId = policy.Id, Amount = 134m, Currency = "EUR" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, policy.Id, existingId, 10m));
        await Assert.ThrowsAsync<AppException>(() => new DeleteCarrierCommissionReceiptHandler(db, user, TestScaffold.Clock).Handle(new(existingId), default));
        policy.Currency = "USD"; await db.SaveChangesAsync();
        var receipt = await Save(db, user, policy.Id, Guid.NewGuid(), 8m);
        var journal = await db.FinancialMovements.SingleAsync(m => m.Id == receipt.Id);
        Assert.Equal("USD", journal.Currency); Assert.Equal(policy.InsuranceCompanyId, journal.InsuranceCompanyId);
        Assert.Null(journal.CustomerId); Assert.Null(journal.ReceiptId); Assert.Null(journal.PaymentId);
        policy.Currency = "EUR"; await db.SaveChangesAsync();
        Assert.Equal(0m, (await Balance(db, user, policy)).Received); // Never silently convert currencies.
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, policy.Id, receipt.Id, 9m));
        Assert.Equal("USD", journal.Currency); Assert.Equal(8m, journal.Amount);
        var foreign = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var foreignDb = TestScaffold.NewDb(foreign, TestScaffold.Clock);
        await Assert.ThrowsAsync<AppException>(() => Save(foreignDb, foreign, policy.Id, Guid.NewGuid(), 8m));
        Assert.Empty(await CarrierCommissionLedger.BalancesAsync(foreignDb, foreign.TenantId!.Value, default));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Shared_database_isolates_other_offices_and_other_tenants_for_list_read_update_and_delete(bool otherTenant)
    {
        var storage = Guid.NewGuid().ToString("N");
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        var foreign = new OfficeUser(otherTenant ? Guid.NewGuid() : user.TenantId, Guid.NewGuid());
        Policy CreatePolicy(OfficeUser owner) => new() { Id = Guid.NewGuid(), TenantId = owner.TenantId!.Value,
            AgencyOfficeScopeId = owner.AgencyOfficeId, PolicyNumber = Guid.NewGuid().ToString(),
            Customer = new Customer { Id = Guid.NewGuid(), TenantId = owner.TenantId.Value, AgencyOfficeScopeId = owner.AgencyOfficeId, CustomerNumber = "C1" },
            InsuranceCompany = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = owner.TenantId, Code = "TEST", Name = "Insurer" },
            Status = PolicyStatus.Active, Premium = 100, NetPremium = 100, Currency = "EUR", StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) };
        var ownPolicy = CreatePolicy(user); var foreignPolicy = CreatePolicy(foreign); var foreignReceiptId = Guid.NewGuid();
        await using (var seed = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock, storage))
        {
            seed.AddRange(ownPolicy, foreignPolicy);
            await seed.SaveChangesAsync();
        }
        await using (var foreignDb = TestScaffold.NewDb(foreign, TestScaffold.Clock, storage))
            await Save(foreignDb, foreign, foreignPolicy.Id, foreignReceiptId, 10m);
        await using var db = TestScaffold.NewDb(user, TestScaffold.Clock, storage);
        var rows = await CarrierCommissionLedger.BalancesAsync(db, user.TenantId!.Value, default);
        Assert.Equal(ownPolicy.Id, Assert.Single(rows).PolicyId);
        await Assert.ThrowsAsync<AppException>(() => new ListCarrierCommissionReceiptsHandler(db, user).Handle(new(foreignPolicy.Id), default));
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, foreignPolicy.Id, Guid.NewGuid(), 10m));
        await Assert.ThrowsAsync<AppException>(() => Save(db, user, ownPolicy.Id, foreignReceiptId, 10m));
        await Assert.ThrowsAsync<AppException>(() => new DeleteCarrierCommissionReceiptHandler(db, user, TestScaffold.Clock).Handle(new(foreignReceiptId), default));
        var foreignMovement = await db.FinancialMovements.IgnoreQueryFilters().SingleAsync(m => m.Id == foreignReceiptId);
        Assert.Equal(10m, foreignMovement.Amount); Assert.Null(foreignMovement.DeletedAt);
        Assert.Equal(foreign.AgencyOfficeId, foreignMovement.AgencyOfficeScopeId);
    }

    private sealed record OfficeUser(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId => null; public Role? Role => Kalypsis.Domain.Enums.Role.AgencyAdmin;
        public string? Email => null; public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false; public bool IsImpersonating => false; public bool AgencyOfficeIsHeadquarters => false;
    }

    [Theory]
    [InlineData(Role.Customer)]
    [InlineData(Role.Producer)]
    public async Task Customer_and_producer_policy_views_do_not_expose_the_offices_new_carrier_balances(Role role)
    {
        var (db, staff, policy) = await Setup(producer: true);
        await using var scope = db;
        await Save(db, staff, policy.Id, Guid.NewGuid(), 2m);
        var user = new User { Id = Guid.NewGuid(), TenantId = policy.TenantId, Email = "viewer@example.test", Role = role,
            CustomerId = role == Role.Customer ? policy.CustomerId : null, ProducerId = role == Role.Producer ? policy.ProducerId : null };
        db.Users.Add(user); await db.SaveChangesAsync();
        var viewer = TestScaffold.AgencyStaff(policy.TenantId, user.Id, role);
        var detail = await new GetPolicyDetailQueryHandler(db, viewer, new PolicyCommissionCalculator(db)).Handle(new(policy.Id), default);
        Assert.Equal(0m, detail.CarrierCommissionDue); Assert.Equal(0m, detail.CarrierCommissionReceived);
        Assert.Equal(0m, detail.CarrierCommissionOutstanding); Assert.Equal(0m, detail.CarrierCommissionCredit);
    }

    [MySqlSchemaFact]
    public async Task Real_MySQL_roundtrips_remittance_amount_date_kind_audit_and_void_without_schema_changes()
    {
        TestScaffold.EnsureEncryptorBooted();
        var builder = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("KALYPSIS_TEST_MYSQL")!) { Database = "", Pooling = false };
        await using var admin = new MySqlConnection(builder.ConnectionString); await admin.OpenAsync();
        var database = "kalypsis_carrier_remittance_" + Guid.NewGuid().ToString("N");
        await using var create = admin.CreateCommand(); create.CommandText = $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4";
        await create.ExecuteNonQueryAsync();
        try
        {
            builder.Database = database;
            var user = TestScaffold.AgencyStaff(Guid.NewGuid());
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql(builder.ConnectionString,
                new MySqlServerVersion(new Version(8, 0, 36))).Options, user, TestScaffold.Clock);
            var script = db.Database.GenerateCreateScript();
            foreach (var table in new[] { "policies", "financial_movements", "audit_logs" })
            {
                var sql = Regex.Match(script, $@"CREATE TABLE `{table}` \([\s\S]*?;").Value;
                Assert.NotEmpty(sql);
                sql = Regex.Replace(sql, @"^[^\r\n]*\bFOREIGN KEY\b[^\r\n]*(?:\r?\n|$)", "", RegexOptions.Multiline);
                sql = Regex.Replace(sql, @",(\s*\))", "$1");
                await db.Database.ExecuteSqlRawAsync(sql);
            }
            var policy = new Policy { Id = Guid.NewGuid(), TenantId = user.TenantId!.Value, PolicyNumber = "SQL-TEST",
                CustomerId = Guid.NewGuid(), InsuranceCompanyId = Guid.NewGuid(), Status = PolicyStatus.Active,
                Currency = "EUR", Premium = 134m, NetPremium = 100m, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) };
            db.Policies.Add(policy); await db.SaveChangesAsync();
            var id = Guid.NewGuid();
            await Save(db, user, policy.Id, id, 5.25m, "Τραπεζική αναφορά TEST-1");
            db.ChangeTracker.Clear();
            var receipt = await db.FinancialMovements.SingleAsync();
            Assert.Equal(FinancialMovementKind.CarrierCommissionReceived, receipt.Kind);
            Assert.Equal(5.25m, receipt.Amount); Assert.Equal("EUR", receipt.Currency);
            Assert.Equal("Τραπεζική αναφορά TEST-1", receipt.Description);
            Assert.Equal(policy.InsuranceCompanyId, receipt.InsuranceCompanyId);
            await Save(db, user, policy.Id, id, 8.50m);
            await Save(db, user, policy.Id, id, 8.50m);
            Assert.Equal(1, await db.FinancialMovements.CountAsync());
            await new DeleteCarrierCommissionReceiptHandler(db, user, TestScaffold.Clock).Handle(new(id), default);
            Assert.Equal(0, await db.FinancialMovements.CountAsync());
            Assert.Equal(1, await db.FinancialMovements.IgnoreQueryFilters().CountAsync());
            Assert.Contains(await db.AuditLogs.ToListAsync(), audit => audit.EntityId == id.ToString() && audit.Action == "Delete");
        }
        finally
        {
            // The random test-owned database is the only database removed.
            await using var drop = admin.CreateCommand(); drop.CommandText = $"DROP DATABASE `{database}`"; await drop.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public void Api_requires_agency_staff_backoffice_financial_read_and_receipt_write_for_mutations()
    {
        var type = typeof(CarrierCommissionsController);
        Assert.Contains(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(), a => a.Policy == "AgencyStaff");
        Assert.NotEmpty(type.GetCustomAttributes(typeof(RequiresPackageAttribute), true));
        Assert.NotEmpty(type.GetCustomAttributes(typeof(RequirePermissionAttribute), true));
        foreach (var method in new[] { "Save", "Delete" }) Assert.NotEmpty(type.GetMethod(method)!.GetCustomAttributes(typeof(RequirePermissionAttribute), true));
    }
}
