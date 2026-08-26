using System.Text;
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
/// Tests for POST /api/bookkeeping/files/move — the tenant-side
/// endpoint that backs the drag-and-drop-file-onto-folder UX.
/// Covers happy path, cross-tenant target, cross-tenant file id
/// (silently skipped, matching admin bulk-move semantics), and
/// the no-op case (file already in target folder).
/// </summary>
public class BookkeepingTenantFileMoveTests
{
    private static BookkeepingController Ctl(Kalypsis.Infrastructure.Persistence.AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
        => new(db, current, clock, new NoopMediator(),
            NullLogger<BookkeepingController>.Instance);

    [Fact]
    public async Task MoveOwnFiles_MovesToTargetFolder()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);

        var source = NewFolder(tenantId, "source", clock.UtcNow);
        var target = NewFolder(tenantId, "target", clock.UtcNow);
        db.BookkeepingFolders.AddRange(source, target);
        var f1 = NewFile(tenantId, source.Id, "a.pdf", clock.UtcNow);
        var f2 = NewFile(tenantId, source.Id, "b.pdf", clock.UtcNow);
        db.BookkeepingFiles.AddRange(f1, f2);
        await db.SaveChangesAsync();

        var res = await Ctl(db, user, clock).MoveOwnFiles(
            new BookkeepingController.MoveFilesBody(new[] { f1.Id, f2.Id }, target.Id), default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        // Both files now under target
        var after = await db.BookkeepingFiles
            .Where(x => x.TenantId == tenantId).ToListAsync();
        Assert.All(after, f => Assert.Equal(target.Id, f.FolderId));
    }

    [Fact]
    public async Task MoveOwnFiles_NoOpWhenAlreadyInTarget_ReturnsZeroMoved()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var folder = NewFolder(tenantId, "here", clock.UtcNow);
        db.BookkeepingFolders.Add(folder);
        var f = NewFile(tenantId, folder.Id, "x.pdf", clock.UtcNow);
        db.BookkeepingFiles.Add(f);
        await db.SaveChangesAsync();

        var res = await Ctl(db, user, clock).MoveOwnFiles(
            new BookkeepingController.MoveFilesBody(new[] { f.Id }, folder.Id), default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        // Response.moved == 0. Reflect out the anonymous property.
        var moved = (int)ok.Value!.GetType().GetProperty("moved")!.GetValue(ok.Value)!;
        Assert.Equal(0, moved);
    }

    [Fact]
    public async Task MoveOwnFiles_EmptyList_ReturnsZero()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);

        var res = await Ctl(db, user, clock).MoveOwnFiles(
            new BookkeepingController.MoveFilesBody(Array.Empty<Guid>(), Guid.NewGuid()), default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var moved = (int)ok.Value!.GetType().GetProperty("moved")!.GetValue(ok.Value)!;
        Assert.Equal(0, moved);
    }

    [Fact]
    public async Task MoveOwnFiles_CrossTenantTarget_Rejected()
    {
        // Tenant A tries to drop their file into Tenant B's folder.
        // Target-folder lookup is tenant-scoped → NotFound.
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        var userA = TestScaffold.AgencyStaff(tenantA);
        var userB = TestScaffold.AgencyStaff(tenantB);
        using var dbA = TestScaffold.NewDb(userA, clock, name: "shared-file-move");
        using var dbB = TestScaffold.NewDb(userB, clock, name: "shared-file-move");

        var mineFolder = NewFolder(tenantA, "mine", clock.UtcNow);
        var mineFile = NewFile(tenantA, mineFolder.Id, "mine.pdf", clock.UtcNow);
        dbA.BookkeepingFolders.Add(mineFolder);
        dbA.BookkeepingFiles.Add(mineFile);
        await dbA.SaveChangesAsync();

        var theirsFolder = NewFolder(tenantB, "theirs", clock.UtcNow);
        dbB.BookkeepingFolders.Add(theirsFolder);
        await dbB.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Ctl(dbA, userA, clock).MoveOwnFiles(
                new BookkeepingController.MoveFilesBody(new[] { mineFile.Id }, theirsFolder.Id), default));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task MoveOwnFiles_ForeignFileIds_SilentlySkipped()
    {
        // Tenant A drops a file id belonging to Tenant B into their
        // own folder. Query filter drops the foreign id, moved=0.
        // No leak — the foreign file stays put in Tenant B's folder.
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        var userA = TestScaffold.AgencyStaff(tenantA);
        var userB = TestScaffold.AgencyStaff(tenantB);
        using var dbA = TestScaffold.NewDb(userA, clock, name: "shared-file-move-b");
        using var dbB = TestScaffold.NewDb(userB, clock, name: "shared-file-move-b");

        var folderA = NewFolder(tenantA, "A", clock.UtcNow);
        dbA.BookkeepingFolders.Add(folderA); await dbA.SaveChangesAsync();
        var folderB = NewFolder(tenantB, "B", clock.UtcNow);
        var fileB = NewFile(tenantB, folderB.Id, "b.pdf", clock.UtcNow);
        dbB.BookkeepingFolders.Add(folderB);
        dbB.BookkeepingFiles.Add(fileB);
        await dbB.SaveChangesAsync();

        var res = await Ctl(dbA, userA, clock).MoveOwnFiles(
            new BookkeepingController.MoveFilesBody(new[] { fileB.Id }, folderA.Id), default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var moved = (int)ok.Value!.GetType().GetProperty("moved")!.GetValue(ok.Value)!;
        Assert.Equal(0, moved);
        var stillTheirs = await dbB.BookkeepingFiles.IgnoreQueryFilters()
            .FirstAsync(x => x.Id == fileB.Id);
        Assert.Equal(folderB.Id, stillTheirs.FolderId);
    }

    private static BookkeepingFolder NewFolder(Guid tenantId, string name, DateTime now)
        => new() { Id = Guid.NewGuid(), TenantId = tenantId, Name = name, CreatedAt = now };

    private static BookkeepingFile NewFile(Guid tenantId, Guid folderId, string name, DateTime now)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FolderId = folderId,
            FileName = name,
            MimeType = "application/pdf",
            SizeBytes = 100,
            ContentBytes = Encoding.UTF8.GetBytes("seed"),
            UploadedBy = "tenant",
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
