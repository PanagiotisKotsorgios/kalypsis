using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Tenant-side drag-and-drop reparent. Backend endpoint under test is
/// PATCH /api/bookkeeping/folders/{id}/move. Mirrors the admin-side
/// cycle guard + tenant isolation.
/// </summary>
public class BookkeepingTenantFolderMoveTests
{
    private static BookkeepingController Ctl(Kalypsis.Infrastructure.Persistence.AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
    {
        return new BookkeepingController(db, current, clock,
            new NoopMediator(), NullLogger<BookkeepingController>.Instance);
    }

    [Fact]
    public async Task MoveOwnFolder_Reparents_UnderTarget()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var root = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "root", CreatedAt = clock.UtcNow };
        var target = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "target", CreatedAt = clock.UtcNow };
        db.BookkeepingFolders.AddRange(root, target);
        await db.SaveChangesAsync();

        var res = await Ctl(db, user, clock).MoveOwnFolder(root.Id,
            new BookkeepingController.MoveFolderBody(target.Id, null), default);
        var dto = ((res.Result as OkObjectResult)!.Value as BookkeepingController.FolderDto)!;
        Assert.Equal(target.Id, dto.ParentFolderId);
    }

    [Fact]
    public async Task MoveOwnFolder_ToRoot_SetsParentNull()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var parent = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "p", CreatedAt = clock.UtcNow };
        var child = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "c", ParentFolderId = parent.Id, CreatedAt = clock.UtcNow };
        db.BookkeepingFolders.AddRange(parent, child);
        await db.SaveChangesAsync();

        var res = await Ctl(db, user, clock).MoveOwnFolder(child.Id,
            new BookkeepingController.MoveFolderBody(null, null), default);
        var dto = ((res.Result as OkObjectResult)!.Value as BookkeepingController.FolderDto)!;
        Assert.Null(dto.ParentFolderId);
    }

    [Fact]
    public async Task MoveOwnFolder_UnderSelf_Rejected()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var f = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "x", CreatedAt = clock.UtcNow };
        db.BookkeepingFolders.Add(f); await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Ctl(db, user, clock).MoveOwnFolder(f.Id,
                new BookkeepingController.MoveFolderBody(f.Id, null), default));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task MoveOwnFolder_UnderDescendant_Rejected()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var p = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "parent", CreatedAt = clock.UtcNow };
        var c = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantId, Name = "child", ParentFolderId = p.Id, CreatedAt = clock.UtcNow };
        db.BookkeepingFolders.AddRange(p, c); await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Ctl(db, user, clock).MoveOwnFolder(p.Id,
                new BookkeepingController.MoveFolderBody(c.Id, null), default));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task MoveOwnFolder_CrossTenantParent_Rejected()
    {
        // Tenant A tries to move their folder under a folder owned by
        // Tenant B. Must be rejected as NotFound — never silently ignored.
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        var userA = TestScaffold.AgencyStaff(tenantA);
        var userB = TestScaffold.AgencyStaff(tenantB);
        using var dbA = TestScaffold.NewDb(userA, clock, name: "shared-db");
        using var dbB = TestScaffold.NewDb(userB, clock, name: "shared-db");

        var mine = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantA, Name = "mine", CreatedAt = clock.UtcNow };
        var theirs = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantB, Name = "theirs", CreatedAt = clock.UtcNow };
        dbA.BookkeepingFolders.Add(mine); await dbA.SaveChangesAsync();
        dbB.BookkeepingFolders.Add(theirs); await dbB.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Ctl(dbA, userA, clock).MoveOwnFolder(mine.Id,
                new BookkeepingController.MoveFolderBody(theirs.Id, null), default));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task MoveOwnFolder_OtherTenantsFolder_Rejected()
    {
        // Tenant A tries to move Tenant B's folder — the folder id
        // is filtered out by the tenant query filter, so the endpoint
        // returns 404 rather than exposing that the folder exists.
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        var userA = TestScaffold.AgencyStaff(tenantA);
        var userB = TestScaffold.AgencyStaff(tenantB);
        using var dbA = TestScaffold.NewDb(userA, clock, name: "shared-db-b");
        using var dbB = TestScaffold.NewDb(userB, clock, name: "shared-db-b");
        var theirs = new BookkeepingFolder { Id = Guid.NewGuid(), TenantId = tenantB, Name = "theirs", CreatedAt = clock.UtcNow };
        dbB.BookkeepingFolders.Add(theirs); await dbB.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Ctl(dbA, userA, clock).MoveOwnFolder(theirs.Id,
                new BookkeepingController.MoveFolderBody(null, null), default));
        Assert.Equal(404, ex.StatusCode);
    }

    private sealed class NoopMediator : IMediator
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default)
            => throw new InvalidOperationException();
        public Task<object?> Send(object request, CancellationToken ct = default)
            => throw new InvalidOperationException();
        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest
            => throw new InvalidOperationException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default)
            => throw new NotImplementedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default)
            => throw new NotImplementedException();
        public Task Publish(object notification, CancellationToken ct = default) => Task.CompletedTask;
        public Task Publish<TNotification>(TNotification notification, CancellationToken ct = default)
            where TNotification : INotification => Task.CompletedTask;
    }
}
