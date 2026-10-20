using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace Kalypsis.Tests;

public class CustomerDrivingProfileTests
{
    [Fact]
    public async Task Driving_facts_preserve_unknown_yes_no_and_survive_legacy_full_updates()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value,
            Type = CustomerType.Individual, FirstName = "Δοκιμή", LastName = "Πελάτη", CustomerNumber = "DRIVER-1" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var get = new GetCustomerQueryHandler(db, current);
        Assert.Null((await get.Handle(new(customer.Id), default)).HasDrivingLicense);
        var update = new UpdateCustomerDrivingFieldHandler(db, current);
        await update.Handle(new(customer.Id, new("hasDrivingLicense", true)), default);
        await update.Handle(new(customer.Id, new("isDriver", true)), default);
        await update.Handle(new(customer.Id, new("isNewDriver", false)), default);
        var loaded = await get.Handle(new(customer.Id), default);
        Assert.True(loaded.HasDrivingLicense);
        Assert.True(loaded.IsDriver);
        Assert.False(loaded.IsNewDriver);
        var full = new CreateCustomerRequest(CustomerType.Individual, "Νέο όνομα", customer.LastName,
            null, null, null, null, null, null, null, null, null, false);
        var saved = await new UpdateCustomerCommandHandler(db, current).Handle(new(customer.Id, full), default);
        Assert.True(saved.HasDrivingLicense);
        Assert.True(saved.IsDriver);
        Assert.False(saved.IsNewDriver);
        await update.Handle(new(customer.Id, new("isNewDriver", null)), default);
        Assert.Null((await get.Handle(new(customer.Id), default)).IsNewDriver);
        var history = await new CustomerHistoryHandler(db, current).Handle(new(customer.Id, null, null, null, null), default);
        Assert.Contains(history.Items.SelectMany(row => row.Changes ?? []), c => c.Field == "HasDrivingLicense" && c.After == "true");
        Assert.Contains(history.Items.SelectMany(row => row.Changes ?? []), c => c.Field == "IsNewDriver" && c.Before == "false" && c.After == null && c.AfterRecorded);
    }

    [Fact]
    public async Task Driving_updates_cannot_target_another_tenant_or_an_unapproved_field()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value, CustomerNumber = "DRIVER-2" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new UpdateCustomerDrivingFieldHandler(db, current)
            .Handle(new(customer.Id, new("status", true)), default));
        await Assert.ThrowsAsync<AppException>(() => new UpdateCustomerDrivingFieldHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid()))
            .Handle(new(customer.Id, new("hasDrivingLicense", true)), default));
        Assert.Null(customer.HasDrivingLicense);
        customer.HasDrivingLicense = true; customer.IsDriver = true; customer.IsNewDriver = false;
        await db.SaveChangesAsync();
        await new Kalypsis.Application.Features.Gdpr.AnonymizeCustomerHandler(db, current, TestScaffold.Clock).Handle(new(customer.Id), default);
        Assert.Null(customer.HasDrivingLicense);
        Assert.Null(customer.IsDriver);
        Assert.Null(customer.IsNewDriver);
    }

    [Fact]
    public void Migration_only_adds_nullable_flags_and_generates_mysql_sql_without_connecting()
    {
        var migration = new AddCustomerDrivingProfile();
        Assert.Equal(3, migration.UpOperations.Count);
        Assert.All(migration.UpOperations, op => {
            var column = Assert.IsType<Microsoft.EntityFrameworkCore.Migrations.Operations.AddColumnOperation>(op);
            Assert.Equal("customers", column.Table); Assert.True(column.IsNullable); Assert.Equal(typeof(bool), column.ClrType);
        });
        TestScaffold.EnsureEncryptorBooted();
        var options = new DbContextOptionsBuilder<Kalypsis.Infrastructure.Persistence.AppDbContext>()
            .UseMySql("Server=127.0.0.1;Database=kalypsis_test;User=test;Password=unused", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new Kalypsis.Infrastructure.Persistence.AppDbContext(options, TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock);
        var script = db.GetService<IMigrator>().GenerateScript("20261020120000_AddCustomerAdditionalCommunicationChannels", "20261020130000_AddCustomerDrivingProfile");
        foreach (var field in new[] { "HasDrivingLicense", "IsDriver", "IsNewDriver" }) Assert.Contains($"ADD `{field}` tinyint(1) NULL", script);
        Assert.DoesNotContain("UPDATE `customers`", script);
    }
}
