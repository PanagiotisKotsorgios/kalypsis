using Kalypsis.Application.Common;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.Communications;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class CustomerWorkspaceTests
{
    private static Customer Customer(Guid tenant, string number = "TEST-1") =>
        new() { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = number, FirstName = "Δοκιμή", LastName = "Πελάτη" };

    private static CreateCommunicationBody Body(Guid? policy = null) =>
        new(CommunicationKind.Phone, CommunicationDirection.Outbound, CommunicationOutcome.Resolved,
            TestScaffold.Clock.UtcNow, 90, "Ενημέρωση πελάτη", "Σημειώσεις δοκιμής", policy);

    [Fact]
    public async Task Communication_create_update_delete_preserves_customer_and_author()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = Customer(tenant);
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var created = await new CreateCommunicationHandler(db, current, clock)
            .Handle(new(customer.Id, Body()), default);
        var handler = new UpdateCommunicationHandler(db, current, clock);
        var updated = await handler.Handle(new UpdateCommunicationCommand(customer.Id, created.Id,
            Body() with { Subject = "Νέο θέμα", Body = "Νέες σημειώσεις" }), default);
        Assert.Equal("Νέο θέμα", updated.Subject);
        Assert.Equal(created.UserId, updated.UserId);
        Assert.Equal(customer.Id, updated.CustomerId);
        await handler.Handle(new DeleteCommunicationCommand(customer.Id, created.Id), default);
        Assert.Empty(await new ListCommunicationsHandler(db, current).Handle(new(customer.Id, null), default));
        Assert.NotNull((await db.CommunicationLogs.IgnoreQueryFilters().SingleAsync()).DeletedAt);
        Assert.Single(await db.Customers.ToListAsync());
        var history = await new CustomerHistoryHandler(db, current).Handle(new(customer.Id, null, "communication", null, null), default);
        Assert.Contains(history.Items, r => r.Title == "Διαγραφή");
    }

    [Fact]
    public async Task Communication_cannot_be_changed_or_deleted_through_another_customer()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var first = Customer(tenant);
        var other = Customer(tenant, "TEST-2");
        db.Customers.AddRange(first, other);
        await db.SaveChangesAsync();
        var log = await new CreateCommunicationHandler(db, current, clock).Handle(new(first.Id, Body()), default);
        var handler = new UpdateCommunicationHandler(db, current, clock);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new UpdateCommunicationCommand(other.Id, log.Id, Body()), default));
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new DeleteCommunicationCommand(other.Id, log.Id), default));
        Assert.Single(await db.CommunicationLogs.ToListAsync());
    }

    [Fact]
    public async Task Communication_and_history_reject_other_tenant()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        var database = Guid.NewGuid().ToString();
        Guid customerId;
        Guid communicationId;
        await using (var source = TestScaffold.NewDb(current, clock, database))
        {
            var customer = Customer(tenant);
            source.Customers.Add(customer);
            await source.SaveChangesAsync();
            customerId = customer.Id;
            communicationId = (await new CreateCommunicationHandler(source, current, clock).Handle(new(customerId, Body()), default)).Id;
        }
        var foreign = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(foreign, clock, database);
        var handler = new UpdateCommunicationHandler(db, foreign, clock);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new UpdateCommunicationCommand(customerId, communicationId, Body()), default));
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new DeleteCommunicationCommand(customerId, communicationId), default));
        await Assert.ThrowsAsync<AppException>(() => new CustomerHistoryHandler(db, foreign).Handle(new(customerId, null, null, null, null), default));
    }

    [Fact]
    public async Task Communication_cannot_link_another_customers_policy()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = Customer(tenant);
        var other = Customer(tenant, "TEST-2");
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, CustomerId = other.Id, PolicyNumber = "OTHER" };
        db.Customers.AddRange(customer, other);
        db.Policies.Add(policy);
        await db.SaveChangesAsync();
        var create = new CreateCommunicationHandler(db, current, clock);
        await Assert.ThrowsAsync<AppException>(() => create.Handle(new(customer.Id, Body(policy.Id)), default));
        var log = await create.Handle(new(customer.Id, Body()), default);
        await Assert.ThrowsAsync<AppException>(() => new UpdateCommunicationHandler(db, current, clock)
            .Handle(new UpdateCommunicationCommand(customer.Id, log.Id, Body(policy.Id)), default));
        Assert.Null((await db.CommunicationLogs.SingleAsync()).RelatedPolicyId);
    }

    [Fact]
    public void Communication_validation_rejects_blank_subject_invalid_enum_and_negative_duration()
    {
        var validator = new UpdateCommunicationValidator();
        Assert.False(validator.Validate(new UpdateCommunicationCommand(Guid.NewGuid(), Guid.NewGuid(), Body() with { Subject = "" })).IsValid);
        Assert.False(validator.Validate(new UpdateCommunicationCommand(Guid.NewGuid(), Guid.NewGuid(), Body() with { Kind = (CommunicationKind)999 })).IsValid);
        Assert.False(validator.Validate(new UpdateCommunicationCommand(Guid.NewGuid(), Guid.NewGuid(), Body() with { DurationSeconds = -1 })).IsValid);
        Assert.True(validator.Validate(new UpdateCommunicationCommand(Guid.NewGuid(), Guid.NewGuid(), Body())).IsValid);
    }

    [Fact]
    public async Task History_has_customer_changes_policies_endorsements_and_filtered_pagination()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = Customer(tenant);
        var other = Customer(tenant, "OTHER");
        db.Customers.AddRange(customer, other);
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customer.Id, PolicyNumber = "POL-TEST" };
        db.Policies.Add(policy);
        db.PolicyEndorsements.Add(new() { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, EndorsementNumber = "PP-TEST", Description = "Αλλαγή κάλυψης" });
        await db.SaveChangesAsync();
        clock.UtcNow = clock.UtcNow.AddHours(1);
        customer.FirstName = "Αλλαγμένο";
        await db.SaveChangesAsync();
        var handler = new CustomerHistoryHandler(db, current);
        var result = await handler.Handle(new(customer.Id, null, null, null, null), default);
        Assert.Contains(result.Items, r => r.Kind == "customer" && r.Title == "Ενημέρωση");
        Assert.Contains(result.Items, r => r.Kind == "policy" && r.Reference == "POL-TEST");
        Assert.Contains(result.Items, r => r.Kind == "endorsement" && r.Reference == "PP-TEST");
        Assert.DoesNotContain(result.Items, r => r.Reference == "OTHER");
        Assert.DoesNotContain(result.Items, r => r.Details?.Contains("Αλλαγμένο") == true);
        var filtered = await handler.Handle(new(customer.Id, "PP-TEST", "endorsement", null, null, 999), default);
        Assert.Single(filtered.Items);
        Assert.Equal(1, filtered.Page);
        var empty = await handler.Handle(new(customer.Id, null, null, clock.UtcNow.AddDays(1), null), default);
        Assert.Empty(empty.Items);
    }

    [Fact]
    public async Task History_denies_user_without_policy_read_permission()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant, role: Role.AgencyUser);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = Customer(tenant);
        db.Customers.Add(customer);
        db.Users.Add(new() { Id = current.UserId!.Value, TenantId = tenant, Email = "workspace-test@example.test",
            Role = Role.AgencyUser, PermissionsJson = "[\"customers.read\"]" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new CustomerHistoryHandler(db, current)
            .Handle(new(customer.Id, null, null, null, null), default));
    }

    [Fact]
    public async Task Archived_history_remains_office_scoped_and_live_communications_hide_deleted_records()
    {
        var tenant = Guid.NewGuid();
        var office = Guid.NewGuid();
        var otherOffice = Guid.NewGuid();
        var seedUser = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        var database = Guid.NewGuid().ToString();
        Guid customerId;
        await using (var seed = TestScaffold.NewDb(seedUser, clock, database))
        {
            var customer = Customer(tenant);
            customer.AgencyOfficeScopeId = office;
            customerId = customer.Id;
            seed.Customers.Add(customer);
            seed.CommunicationLogs.AddRange(
                new() { Id = Guid.NewGuid(), TenantId = tenant, AgencyOfficeScopeId = office, CustomerId = customerId,
                    Kind = CommunicationKind.Note, Subject = "Αρχειοθετημένη επικοινωνία", OccurredAt = clock.UtcNow, DeletedAt = clock.UtcNow },
                new() { Id = Guid.NewGuid(), TenantId = tenant, AgencyOfficeScopeId = otherOffice, CustomerId = customerId,
                    Kind = CommunicationKind.Note, Subject = "Άλλο γραφείο", OccurredAt = clock.UtcNow });
            await seed.SaveChangesAsync();
        }
        var current = new ScopedUser(seedUser.UserId, tenant, office);
        await using var db = TestScaffold.NewDb(current, clock, database);
        var history = await new CustomerHistoryHandler(db, current).Handle(new(customerId, null, "communication", null, null), default);
        Assert.Contains(history.Items, r => r.Title == "Αρχειοθετημένη επικοινωνία");
        Assert.DoesNotContain(history.Items, r => r.Title == "Άλλο γραφείο");
        Assert.Empty(await new ListCommunicationsHandler(db, current).Handle(new(customerId, null), default));
    }

    private sealed record ScopedUser(Guid? UserId, Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyAdmin;
        public string? Email => "test@example.test";
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }
}
