using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class CompanyDocumentMoveTests
{
    [Fact]
    public async Task Move_PersistsFolderAndPreservesFileMetadata_ThenAllowsRemovingFolder()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Company", Code = "C1" };
        var folder = new InsuranceCompanyFolder { Id = Guid.NewGuid(), TenantId = tenantId, InsuranceCompanyId = company.Id, Name = "Contracts" };
        var file = new InsuranceCompanyDocument
        {
            Id = Guid.NewGuid(), TenantId = tenantId, InsuranceCompanyId = company.Id,
            FileName = "agreement.pdf", StoragePath = "original-storage-key", MimeType = "application/pdf",
            SizeBytes = 4321, Category = "Συμβάσεις", IsConfidential = true, TagsJson = "[\"original\"]"
        };
        db.InsuranceCompanies.Add(company);
        db.InsuranceCompanyFolders.Add(folder);
        db.InsuranceCompanyDocuments.Add(file);
        await db.SaveChangesAsync();
        // Moving changes the database relation only and never reads or rewrites
        // stored file content; storage/upload dependencies are deliberately absent.
        var controller = new InsuranceCompanyRecordsController(db, user, null!, null!, clock);

        Assert.IsType<NoContentResult>(await controller.MoveDocument(company.Id, file.Id,
            new InsuranceCompanyRecordsController.MoveDocumentBody(folder.Id), default));
        db.ChangeTracker.Clear();
        var moved = await db.InsuranceCompanyDocuments.SingleAsync();
        Assert.Equal(folder.Id, moved.FolderId);
        Assert.Equal("original-storage-key", moved.StoragePath);
        Assert.Equal("agreement.pdf", moved.FileName);
        Assert.Equal(4321, moved.SizeBytes);
        Assert.True(moved.IsConfidential);
        Assert.Equal("Συμβάσεις", moved.Category);
        Assert.Equal("[\"original\"]", moved.TagsJson);

        await controller.MoveDocument(company.Id, file.Id,
            new InsuranceCompanyRecordsController.MoveDocumentBody(null), default);
        db.ChangeTracker.Clear();
        Assert.Null((await db.InsuranceCompanyDocuments.SingleAsync()).FolderId);
    }

    [Theory]
    [InlineData("another-company")]
    [InlineData("another-tenant")]
    [InlineData("deleted-folder")]
    [InlineData("missing-folder")]
    public async Task Move_RejectsInvalidDestination_WithoutChangingOriginalFolder(string scenario)
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        var databaseName = Guid.NewGuid().ToString("N");
        using var db = TestScaffold.NewDb(user, clock, databaseName);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Company", Code = "C1" };
        var source = new InsuranceCompanyFolder { Id = Guid.NewGuid(), TenantId = tenantId, InsuranceCompanyId = company.Id, Name = "Source" };
        var target = new InsuranceCompanyFolder
        {
            Id = Guid.NewGuid(), TenantId = scenario == "another-tenant" ? Guid.NewGuid() : tenantId,
            InsuranceCompanyId = scenario == "another-company" ? Guid.NewGuid() : company.Id,
            Name = "Target", DeletedAt = scenario == "deleted-folder" ? clock.UtcNow : null
        };
        var file = new InsuranceCompanyDocument { Id = Guid.NewGuid(), TenantId = tenantId, InsuranceCompanyId = company.Id, FolderId = source.Id, FileName = "test.pdf" };
        db.InsuranceCompanies.Add(company);
        db.InsuranceCompanyFolders.Add(source);
        if (scenario == "another-tenant")
        {
            using var foreignDb = TestScaffold.NewDb(TestScaffold.AgencyStaff(target.TenantId), clock, databaseName);
            foreignDb.InsuranceCompanyFolders.Add(target);
            await foreignDb.SaveChangesAsync();
        }
        else if (scenario != "missing-folder") db.InsuranceCompanyFolders.Add(target);
        db.InsuranceCompanyDocuments.Add(file);
        await db.SaveChangesAsync();
        var controller = new InsuranceCompanyRecordsController(db, user, null!, null!, clock);

        await Assert.ThrowsAsync<AppException>(() => controller.MoveDocument(company.Id, file.Id,
            new InsuranceCompanyRecordsController.MoveDocumentBody(target.Id), default));
        db.ChangeTracker.Clear();
        Assert.Equal(source.Id, (await db.InsuranceCompanyDocuments.SingleAsync()).FolderId);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Move_RejectsForeignOrDeletedDocument(bool foreignTenant)
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        var databaseName = Guid.NewGuid().ToString("N");
        using var db = TestScaffold.NewDb(user, clock, databaseName);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Company", Code = "C1" };
        var file = new InsuranceCompanyDocument
        {
            Id = Guid.NewGuid(), InsuranceCompanyId = company.Id, FileName = "test.pdf",
            TenantId = foreignTenant ? Guid.NewGuid() : tenantId, DeletedAt = foreignTenant ? null : clock.UtcNow
        };
        db.InsuranceCompanies.Add(company);
        if (foreignTenant)
        {
            using var foreignDb = TestScaffold.NewDb(TestScaffold.AgencyStaff(file.TenantId), clock, databaseName);
            foreignDb.InsuranceCompanyDocuments.Add(file);
            await foreignDb.SaveChangesAsync();
        }
        else db.InsuranceCompanyDocuments.Add(file);
        await db.SaveChangesAsync();
        var controller = new InsuranceCompanyRecordsController(db, user, null!, null!, clock);

        var error = await Assert.ThrowsAsync<AppException>(() => controller.MoveDocument(company.Id, file.Id,
            new InsuranceCompanyRecordsController.MoveDocumentBody(null), default));
        Assert.Equal(404, error.StatusCode);
    }
}
