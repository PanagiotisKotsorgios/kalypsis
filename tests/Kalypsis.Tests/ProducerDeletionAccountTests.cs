using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class ProducerDeletionAccountTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Newly_created_producer_can_be_deleted_with_creation_audit_and_optional_automatic_login(bool withEmail)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var created = await new CreateProducerCommandHandler(db, current, new Hasher()).Handle(
            new(new("NEW", "New partner", withEmail ? "new@example.test" : null, null, ProducerStatus.Active)), default);
        var producer = await db.Producers.SingleAsync();
        var audit = new AuditLog { Id = Guid.NewGuid(), TenantId = current.TenantId,
            EntityName = "Producer", EntityId = producer.Id.ToString(), Action = "Create", NewValues = "original audit" };
        db.AuditLogs.Add(audit);
        var user = withEmail ? await db.Users.SingleAsync() : null;
        var session = user is null ? null : Session(user);
        var previouslyRevoked = user is null ? null : Session(user);
        if (session is not null) db.RefreshTokens.Add(session);
        if (previouslyRevoked is not null)
        {
            previouslyRevoked.RevokedAt = TestScaffold.Clock.UtcNow;
            db.RefreshTokens.Add(previouslyRevoked);
        }
        await db.SaveChangesAsync();

        await new DeleteProducerCommandHandler(db, current).Handle(new(created.Producer.Id), default);

        // Read persisted state rather than just the handler's tracked objects.
        db.ChangeTracker.Clear();
        var deleted = await db.Producers.IgnoreQueryFilters().SingleAsync();
        Assert.NotNull(deleted.DeletedAt);
        Assert.Equal(ProducerStatus.Terminated, deleted.Status);
        var retainedAudit = await db.AuditLogs.SingleAsync(a => a.Id == audit.Id);
        Assert.Equal("original audit", retainedAudit.NewValues);
        Assert.Equal("Create", retainedAudit.Action);
        Assert.Equal(producer.Id.ToString(), retainedAudit.EntityId);
        if (withEmail)
        {
            var retainedUser = await db.Users.SingleAsync();
            Assert.Null(retainedUser.ProducerId);
            Assert.Null(retainedUser.DeletedAt);
            Assert.False(retainedUser.IsActive);
            Assert.Equal(Role.Producer, retainedUser.Role);
            Assert.NotNull((await db.RefreshTokens.SingleAsync(t => t.Id == session!.Id)).RevokedAt);
            Assert.Equal(TestScaffold.Clock.UtcNow,
                (await db.RefreshTokens.SingleAsync(t => t.Id == previouslyRevoked!.Id)).RevokedAt);
        }
        else Assert.Empty(db.Users);
    }

    [Theory]
    [InlineData(Role.AgencyAdmin)]
    [InlineData(Role.AgencyOfficeAdmin)]
    [InlineData(Role.AgencyUser)]
    public async Task Linked_office_staff_is_detached_without_disabling_account_permissions_or_session(Role role)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var producer = Partner(current.TenantId!.Value);
        var user = Login(producer, role);
        user.PermissionsJson = "[\"customers.read\"]";
        var session = Session(user);
        db.AddRange(producer, user, session);
        await db.SaveChangesAsync();

        await new DeleteProducerCommandHandler(db, current).Handle(new(producer.Id), default);

        Assert.Null(user.ProducerId);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletedAt);
        Assert.Equal(role, user.Role);
        Assert.Equal("[\"customers.read\"]", user.PermissionsJson);
        Assert.Null(session.RevokedAt);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Customer_login_promoted_to_producer_is_restored_without_changing_activation_state(bool active)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var producer = Partner(current.TenantId!.Value);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = producer.TenantId,
            CustomerNumber = "CUSTOMER", FirstName = "Test", LastName = "Customer" };
        var user = Login(producer, Role.Producer);
        user.CustomerId = customer.Id;
        user.IsActive = active;
        var session = Session(user);
        db.AddRange(producer, customer, user, session);
        await db.SaveChangesAsync();

        await new DeleteProducerCommandHandler(db, current).Handle(new(producer.Id), default);

        Assert.Null(user.ProducerId);
        Assert.Equal(customer.Id, user.CustomerId);
        Assert.Equal(Role.Customer, user.Role);
        Assert.Equal(active, user.IsActive);
        Assert.Null(customer.DeletedAt);
        Assert.NotNull(session.RevokedAt);
    }

    [Theory]
    [InlineData("policy")]
    [InlineData("payment")]
    [InlineData("hierarchy")]
    public async Task Substantive_links_still_block_deletion_before_any_login_or_session_changes(string dependency)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var producer = Partner(current.TenantId!.Value);
        var user = Login(producer, Role.Producer);
        var session = Session(user);
        db.AddRange(producer, user, session);
        if (dependency == "policy") db.Policies.Add(new Policy { Id = Guid.NewGuid(), TenantId = producer.TenantId,
            ProducerId = producer.Id, CustomerId = Guid.NewGuid(), InsuranceCompanyId = Guid.NewGuid(),
            PolicyNumber = "LINKED", Premium = 100, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) });
        else if (dependency == "payment") db.Payments.Add(new Payment { Id = Guid.NewGuid(), TenantId = producer.TenantId,
            BeneficiaryProducerId = producer.Id, Amount = 10 });
        else db.Producers.Add(new Producer { Id = Guid.NewGuid(), TenantId = producer.TenantId,
            Code = "CHILD", Name = "Child", ParentProducerId = producer.Id });
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<AppException>(() =>
            new DeleteProducerCommandHandler(db, current).Handle(new(producer.Id), default));

        Assert.Equal(409, error.StatusCode);
        Assert.Equal("deletion_blocked_by_dependencies", error.Code);
        Assert.Null(producer.DeletedAt);
        Assert.Equal(ProducerStatus.Active, producer.Status);
        Assert.Equal(producer.Id, user.ProducerId);
        Assert.True(user.IsActive);
        Assert.Equal(Role.Producer, user.Role);
        Assert.Null(session.RevokedAt);
    }

    [Fact]
    public async Task Another_tenants_login_and_session_are_never_modified()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var storage = Guid.NewGuid().ToString("N");
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, storage);
        var producer = Partner(current.TenantId!.Value);
        var foreignCurrent = TestScaffold.AgencyStaff(Guid.NewGuid());
        var foreignProducer = Partner(foreignCurrent.TenantId!.Value);
        var foreignUser = Login(foreignProducer, Role.Producer);
        var session = Session(foreignUser);
        await using (var seed = TestScaffold.NewDb(foreignCurrent, TestScaffold.Clock, storage))
        {
            seed.AddRange(foreignProducer, foreignUser, session);
            await seed.SaveChangesAsync();
        }
        db.Producers.Add(producer);
        await db.SaveChangesAsync();

        await new DeleteProducerCommandHandler(db, current).Handle(new(producer.Id), default);

        var retainedUser = await db.Users.IgnoreQueryFilters().SingleAsync(u => u.Id == foreignUser.Id);
        Assert.Equal(foreignProducer.Id, retainedUser.ProducerId);
        Assert.True(retainedUser.IsActive);
        Assert.Null((await db.RefreshTokens.SingleAsync(t => t.Id == session.Id)).RevokedAt);
    }

    private static Producer Partner(Guid tenant) => new() { Id = Guid.NewGuid(), TenantId = tenant,
        Code = "PARTNER", Name = "Partner", Status = ProducerStatus.Active };
    private static User Login(Producer producer, Role role) => new() { Id = Guid.NewGuid(), TenantId = producer.TenantId,
        ProducerId = producer.Id, Role = role, Email = "login@example.test", PasswordHash = "test-hash", IsActive = true };
    private static RefreshToken Session(User user) => new() { Id = Guid.NewGuid(), UserId = user.Id,
        TokenHash = Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddDays(1) };
    private sealed class Hasher : IPasswordHasher
    {
        public string Hash(string value) => "test-hash";
        public bool Verify(string value, string hash) => false;
    }
}
