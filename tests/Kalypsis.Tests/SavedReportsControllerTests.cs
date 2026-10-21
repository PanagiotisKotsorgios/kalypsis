using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class SavedReportsControllerTests
{
    [Fact]
    public async Task Owner_Can_Edit_Name_Sharing_And_Filter_Criteria_Without_Creating_A_Duplicate()
    {
        var tenantId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId, ownerId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var report = new SavedReport
        {
            Id = Guid.NewGuid(), TenantId = tenantId, OwnerUserId = ownerId,
            Entity = "production-lists", Name = "Αρχικό", FiltersJson = "{\"statuses\":[\"Active\"]}",
            IsShared = false, CreatedAt = clock.UtcNow.AddDays(-1),
        };
        db.SavedReports.Add(report);
        await db.SaveChangesAsync();

        clock.UtcNow = clock.UtcNow.AddMinutes(5);
        var controller = new SavedReportsController(db, user, clock);
        var result = await controller.Update(report.Id,
            new SavedReportsController.UpdateBody("Νέο όνομα", "{\"producerIds\":[\"p1\",\"p2\"]}", true), default);

        var saved = await db.SavedReports.SingleAsync();
        Assert.Equal("Νέο όνομα", saved.Name);
        Assert.Equal("{\"producerIds\":[\"p1\",\"p2\"]}", saved.FiltersJson);
        Assert.True(saved.IsShared);
        Assert.Equal(clock.UtcNow, saved.UpdatedAt);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<SavedReportsController.ReportDto>(ok.Value);
        Assert.Equal(report.Id, dto.Id);
    }

    [Fact]
    public async Task User_Cannot_Edit_Another_Users_Shared_Filter()
    {
        var tenantId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(user, clock);
        var report = new SavedReport
        {
            Id = Guid.NewGuid(), TenantId = tenantId, OwnerUserId = Guid.NewGuid(),
            Entity = "production-lists", Name = "Κοινό", FiltersJson = "{}",
            IsShared = true, CreatedAt = clock.UtcNow,
        };
        db.SavedReports.Add(report);
        await db.SaveChangesAsync();

        var controller = new SavedReportsController(db, user, clock);
        var error = await Assert.ThrowsAsync<AppException>(() => controller.Update(report.Id,
            new SavedReportsController.UpdateBody("Παραβίαση", "{}", false), default));

        Assert.Equal(404, error.StatusCode);
        Assert.Equal("Κοινό", (await db.SavedReports.SingleAsync()).Name);
    }
}
