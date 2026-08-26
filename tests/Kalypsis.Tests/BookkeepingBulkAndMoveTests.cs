using System.Text;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Tests for the two follow-up features on top of the base bookkeeping
/// controller: folder drag-drop (move + cycle guard) and file
/// multi-select bulk operations (move / delete / status).
///
/// These run through the PlatformAdmin surface — the endpoints don't
/// exist on the tenant surface. Every test uses IgnoreQueryFilters
/// where it needs to peek across tenants.
/// </summary>
public class BookkeepingBulkAndMoveTests
{
    private static BookkeepingController AdminCtl(AppDbContext db,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
    {
        var admin = TestScaffold.PlatformAdmin();
        return new BookkeepingController(db, admin, clock,
            new NoopMediator(), NullLogger<BookkeepingController>.Instance);
    }

    // ── Folder move: happy path + cycle guard ─────────────────────────

    [Fact]
    public async Task AdminMoveFolder_Reparents_Successfully()
    {
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        var admin = TestScaffold.PlatformAdmin();
        using var db = TestScaffold.NewDb(admin, clock);

        var root = NewFolder(tenantId, "root", clock.UtcNow);
        var target = NewFolder(tenantId, "target", clock.UtcNow);
        db.BookkeepingFolders.AddRange(root, target);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        var res = await ctl.AdminMoveFolder(tenantId, root.Id,
            new BookkeepingController.MoveFolderBody(NewParentFolderId: target.Id, NewDisplayOrder: 3),
            default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var dto = Assert.IsType<BookkeepingController.FolderDto>(ok.Value);
        Assert.Equal(target.Id, dto.ParentFolderId);
        Assert.Equal(3, dto.DisplayOrder);
    }

    [Fact]
    public async Task AdminMoveFolder_ReparentUnderItself_Throws()
    {
        // Direct self-parent — the cycle guard should trip immediately.
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var f = NewFolder(tenantId, "a", clock.UtcNow);
        db.BookkeepingFolders.Add(f);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            ctl.AdminMoveFolder(tenantId, f.Id,
                new BookkeepingController.MoveFolderBody(f.Id, null), default));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task AdminMoveFolder_ReparentUnderDescendant_Throws()
    {
        // parent > child. Moving parent under child would create a cycle.
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var parent = NewFolder(tenantId, "parent", clock.UtcNow);
        var child = NewFolder(tenantId, "child", clock.UtcNow, parent.Id);
        db.BookkeepingFolders.AddRange(parent, child);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            ctl.AdminMoveFolder(tenantId, parent.Id,
                new BookkeepingController.MoveFolderBody(child.Id, null), default));
        Assert.Equal(400, ex.StatusCode);
    }

    // ── Bulk file operations ─────────────────────────────────────────

    [Fact]
    public async Task AdminBulkMoveFiles_MovesAll_ToTargetFolder()
    {
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);

        var source = NewFolder(tenantId, "source", clock.UtcNow);
        var target = NewFolder(tenantId, "target", clock.UtcNow);
        db.BookkeepingFolders.AddRange(source, target);
        var f1 = NewFile(tenantId, source.Id, "a.pdf", clock.UtcNow);
        var f2 = NewFile(tenantId, source.Id, "b.pdf", clock.UtcNow);
        db.BookkeepingFiles.AddRange(f1, f2);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        var res = await ctl.AdminBulkMoveFiles(tenantId,
            new BookkeepingController.MoveFilesBody(new[] { f1.Id, f2.Id }, target.Id), default);
        Assert.IsType<OkObjectResult>(res.Result);

        // Reload — both files now live under `target`.
        var refreshed = await db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync();
        Assert.All(refreshed, f => Assert.Equal(target.Id, f.FolderId));
    }

    [Fact]
    public async Task AdminBulkMoveFiles_SilentlyIgnores_ForeignTenantIds()
    {
        // A stale/hostile file id from a different tenant must NOT move.
        // Silent skip is the design choice, verified here.
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);

        var folderA = NewFolder(tenantA, "A", clock.UtcNow);
        var folderB = NewFolder(tenantB, "B", clock.UtcNow);
        var targetA = NewFolder(tenantA, "target-A", clock.UtcNow);
        var fileB = NewFile(tenantB, folderB.Id, "b.pdf", clock.UtcNow);
        db.BookkeepingFolders.AddRange(folderA, folderB, targetA);
        db.BookkeepingFiles.Add(fileB);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        var res = await ctl.AdminBulkMoveFiles(tenantA,
            new BookkeepingController.MoveFilesBody(new[] { fileB.Id }, targetA.Id), default);
        Assert.IsType<OkObjectResult>(res.Result);

        // fileB must still be under folderB, not moved into tenantA's target.
        var after = await db.BookkeepingFiles.IgnoreQueryFilters()
            .FirstAsync(f => f.Id == fileB.Id);
        Assert.Equal(folderB.Id, after.FolderId);
    }

    [Fact]
    public async Task AdminBulkDeleteFiles_SoftDeletes_All()
    {
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var folder = NewFolder(tenantId, "f", clock.UtcNow);
        db.BookkeepingFolders.Add(folder);
        var files = Enumerable.Range(1, 5).Select(i => NewFile(tenantId, folder.Id, $"f{i}.pdf", clock.UtcNow)).ToList();
        db.BookkeepingFiles.AddRange(files);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        await ctl.AdminBulkDeleteFiles(tenantId,
            new BookkeepingController.BulkFilesBody(files.Select(f => f.Id).ToList()), default);

        var remaining = await db.BookkeepingFiles.CountAsync();     // filter includes soft-delete
        Assert.Equal(0, remaining);
        var softDeleted = await db.BookkeepingFiles.IgnoreQueryFilters()
            .CountAsync(x => x.DeletedAt != null);
        Assert.Equal(5, softDeleted);
    }

    [Fact]
    public async Task AdminBulkStatus_UpdatesAll_ToRequestedStatus()
    {
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var folder = NewFolder(tenantId, "f", clock.UtcNow);
        db.BookkeepingFolders.Add(folder);
        var f1 = NewFile(tenantId, folder.Id, "1.pdf", clock.UtcNow);
        var f2 = NewFile(tenantId, folder.Id, "2.pdf", clock.UtcNow);
        db.BookkeepingFiles.AddRange(f1, f2);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        await ctl.AdminBulkStatus(tenantId,
            new BookkeepingController.BulkStatusBody(new[] { f1.Id, f2.Id }, "processed"), default);

        var statuses = await db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId).Select(x => x.Status).ToListAsync();
        Assert.All(statuses, s => Assert.Equal("processed", s));
    }

    [Fact]
    public async Task AdminBulkStatus_RejectsInvalidStatus()
    {
        var tenantId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), clock);
        var folder = NewFolder(tenantId, "f", clock.UtcNow);
        db.BookkeepingFolders.Add(folder);
        var f1 = NewFile(tenantId, folder.Id, "1.pdf", clock.UtcNow);
        db.BookkeepingFiles.Add(f1);
        await db.SaveChangesAsync();

        var ctl = AdminCtl(db, clock);
        await Assert.ThrowsAsync<AppException>(() =>
            ctl.AdminBulkStatus(tenantId,
                new BookkeepingController.BulkStatusBody(new[] { f1.Id }, "banana"), default));
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static BookkeepingFolder NewFolder(Guid tenantId, string name, DateTime now,
        Guid? parent = null) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Name = name,
        ParentFolderId = parent,
        CreatedAt = now,
    };

    private static BookkeepingFile NewFile(Guid tenantId, Guid folderId, string name, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        FolderId = folderId,
        FileName = name,
        MimeType = "application/pdf",
        SizeBytes = 100,
        ContentBytes = Encoding.UTF8.GetBytes("seed-bytes"),
        UploadedBy = "admin",
        UploadedByUserId = Guid.NewGuid(),
        Status = "pending",
        CreatedAt = now,
    };

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
