using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class ProducerCategoryTests
{
    private sealed record OfficeUser(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId { get; } = Guid.NewGuid();
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyAdmin;
        public string? Email => "staff@example.test";
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }
    private sealed class Hasher : IPasswordHasher
    {
        public string Hash(string value) => "test-hash";
        public bool Verify(string value, string hash) => false;
    }

    [Fact]
    public async Task Minimal_create_preserves_portal_credentials_and_prospect_email_does_not_create_access()
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var handler = new CreateProducerCommandHandler(db, user, new Hasher());
        var active = await handler.Handle(new(new("A", "Ενεργός", "active@example.test", null, ProducerStatus.Active)), default);
        Assert.Equal("active@example.test", active.PortalEmail); Assert.True(active.TemporaryPassword?.Length >= 8);
        Assert.Equal(active.Producer.Id, Assert.Single(db.Users).ProducerId);
        var prospect = await handler.Handle(new(new("B", "Πιθανός", "prospect@example.test", null, ProducerStatus.Prospect)), default);
        Assert.Null(prospect.PortalEmail); Assert.Null(prospect.TemporaryPassword); Assert.Single(db.Users);
    }

    [Fact]
    public async Task Empty_office_stays_empty_and_minimal_create_has_no_category_or_portal_without_email()
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var result = await new CreateProducerCommandHandler(db, user, new Hasher()).Handle(
            new(new("P-1", "Συνεργάτης", null, null, ProducerStatus.Active)), default);
        Assert.Null(result.Producer.CategoryId); Assert.Null(result.PortalEmail);
        Assert.Empty(db.ProducerCategories); Assert.Empty(db.Users);
        Assert.Equal(ProducerTier.None, result.Producer.Tier);
        Assert.Single(await new ListProducersQueryHandler(db, user).Handle(new(), default));
    }

    [Fact]
    public async Task Assignment_roundtrips_and_rename_is_live_without_changing_legacy_commission_tier()
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var category = new ProducerCategory { Id = Guid.NewGuid(), TenantId = user.TenantId!.Value, Code = "CUSTOM", Name = "Εξωτερικοί συνεργάτες" };
        db.ProducerCategories.Add(category); await db.SaveChangesAsync();
        var created = await new CreateProducerCommandHandler(db, user, new Hasher()).Handle(
            new(new("P-1", "Συνεργάτης", null, null, ProducerStatus.Active, Tier: ProducerTier.B, CategoryId: category.Id)), default);
        Assert.Equal(category.Id, created.Producer.CategoryId); Assert.Equal(category.Name, created.Producer.CategoryName);
        category.Name = "Νέα ονομασία"; await db.SaveChangesAsync();
        var listed = Assert.Single(await new ListProducersQueryHandler(db, user).Handle(new(), default));
        Assert.Equal(category.Name, listed.CategoryName); Assert.Equal(ProducerTier.B, listed.Tier);
        var detail = await new GetProducerDetailQueryHandler(db, user).Handle(new(created.Producer.Id), default);
        Assert.Equal(category.Id, detail.CategoryId); Assert.Equal(category.Name, detail.CategoryName);
        category.IsActive = false; await db.SaveChangesAsync();
        var update = new UpdateProducerCommandHandler(db, user);
        await update.Handle(new(created.Producer.Id, new("P-1", "Αλλαγή ονόματος", null, null, ProducerStatus.Active, Tier: ProducerTier.B, CategoryId: category.Id)), default);
        var cleared = await update.Handle(new(created.Producer.Id, new("P-1", "Αλλαγή ονόματος", null, null, ProducerStatus.Active, Tier: ProducerTier.B, CategoryId: null)), default);
        Assert.Null(cleared.CategoryId); Assert.Equal(ProducerTier.B, cleared.Tier);
    }

    [Theory]
    [InlineData("other-office")][InlineData("other-tenant")][InlineData("inactive")][InlineData("deleted")][InlineData("missing")]
    public async Task Unavailable_categories_are_rejected_before_any_producer_or_user_is_written(string kind)
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        var storage = Guid.NewGuid().ToString("N"); var categoryId = Guid.NewGuid();
        var owner = kind == "other-tenant" ? new OfficeUser(Guid.NewGuid(), Guid.NewGuid())
            : kind == "other-office" ? new OfficeUser(user.TenantId, Guid.NewGuid()) : user;
        using (var seed = TestScaffold.NewDb(owner, TestScaffold.Clock, storage))
        {
            if (kind != "missing") seed.ProducerCategories.Add(new ProducerCategory { Id = categoryId, TenantId = owner.TenantId!.Value,
                Code = "CAT", Name = "Κατηγορία", IsActive = kind != "inactive", DeletedAt = kind == "deleted" ? DateTime.UtcNow : null });
            await seed.SaveChangesAsync();
        }
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock, storage);
        await Assert.ThrowsAsync<AppException>(() => new CreateProducerCommandHandler(db, user, new Hasher()).Handle(
            new(new("P1", "Συνεργάτης", "new@example.test", null, ProducerStatus.Active, CategoryId: categoryId)), default));
        Assert.Empty(db.Producers); Assert.Empty(db.Users);
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = user.TenantId!.Value, Code = "OLD", Name = "Πριν", Tier = ProducerTier.C };
        db.Producers.Add(producer); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new UpdateProducerCommandHandler(db, user).Handle(
            new(producer.Id, new("OLD", "Μετά", null, null, ProducerStatus.Active, CategoryId: categoryId)), default));
        Assert.Equal("Πριν", producer.Name); Assert.Equal(ProducerTier.C, producer.Tier); Assert.Null(producer.CategoryId);
    }

    [Fact]
    public async Task Offices_manage_independent_empty_catalogues_and_may_reuse_category_codes()
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        var storage = Guid.NewGuid().ToString("N");
        using var firstDb = TestScaffold.NewDb(user, TestScaffold.Clock, storage);
        var first = new ProducerCategoriesController(firstDb);
        Assert.Empty(Assert.IsAssignableFrom<IReadOnlyList<ProducerCategoriesController.Dto>>(
            Assert.IsType<OkObjectResult>((await first.List(default)).Result).Value));
        await first.Create(new("SHARED", "Δίκτυο πρώτου γραφείου", 0, true), default);
        await Assert.ThrowsAsync<AppException>(() => first.Create(new("SHARED", "Διπλό", 0, true), default));
        await Assert.ThrowsAsync<AppException>(() => first.Create(new("", "Κενός κωδικός", 0, true), default));
        using var secondDb = TestScaffold.NewDb(new OfficeUser(user.TenantId, Guid.NewGuid()), TestScaffold.Clock, storage);
        var second = new ProducerCategoriesController(secondDb);
        Assert.Empty(Assert.IsAssignableFrom<IReadOnlyList<ProducerCategoriesController.Dto>>(
            Assert.IsType<OkObjectResult>((await second.List(default)).Result).Value));
        await second.Create(new("SHARED", "Δίκτυο δεύτερου γραφείου", 0, true), default);
        Assert.Equal("Δίκτυο πρώτου γραφείου", Assert.Single(firstDb.ProducerCategories).Name);
        Assert.Equal("Δίκτυο δεύτερου γραφείου", Assert.Single(secondDb.ProducerCategories).Name);
    }

    [Fact]
    public async Task Used_category_cannot_be_deleted_but_an_unused_one_can_and_office_lists_are_isolated()
    {
        var user = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var controller = new ProducerCategoriesController(db);
        var created = await controller.Create(new("OWN", "Δική μου", 0, true), default);
        var category = Assert.IsType<ProducerCategoriesController.Dto>(Assert.IsType<OkObjectResult>(created.Result).Value);
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = user.TenantId!.Value, Code = "P", Name = "Συνεργάτης", CategoryId = category.Id };
        db.Producers.Add(producer); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => controller.Delete(category.Id, default));
        Assert.Null(db.ProducerCategories.Single().DeletedAt);
        // History is protected even after the producer has been soft deleted.
        producer.DeletedAt = DateTime.UtcNow; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => controller.Delete(category.Id, default));
        producer.CategoryId = null; await db.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await controller.Delete(category.Id, default));
        Assert.Empty(db.ProducerCategories);
    }
}
