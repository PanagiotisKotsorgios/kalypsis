using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public class CompanyProspectTests
{
    private static InsuranceCompaniesController.UpsertCompanyBody Body(bool broker = false, bool? prospect = null) =>
        new("Εταιρεία δοκιμής", "POTENTIAL", "Ελλάδα", null, true, null, null, null, null, null, null,
            CreateBridge: false, InstallZeroCommissionDefaults: false, IsBroker: broker, IsProspect: prospect);

    [Theory]
    [InlineData(false)][InlineData(true)]
    public async Task Prospective_company_or_broker_roundtrips_and_legacy_updates_preserve_its_state(bool broker)
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var controller = new InsuranceCompaniesController(null!, db, user, TestScaffold.Clock, null!, null!);
        var created = Assert.IsType<InsuranceCompaniesController.InsuranceCompanyExtendedDto>(Assert.IsType<OkObjectResult>(
            (await controller.Create(Body(broker, true), default)).Result).Value);
        Assert.True(created.IsProspect); Assert.Equal(broker, created.IsBroker); Assert.True(created.IsActive);
        Assert.True(db.InsuranceCompanies.Single().IsProspect);
        Assert.Empty(db.CompanyBridges); Assert.Empty(db.CommissionRules);
        var list = Assert.IsAssignableFrom<IReadOnlyList<InsuranceCompaniesController.InsuranceCompanyExtendedDto>>(
            Assert.IsType<OkObjectResult>((await controller.List(default)).Result).Value);
        Assert.True(Assert.Single(list).IsProspect);
        var profile = Assert.IsType<InsuranceCompaniesController.CarrierProfileDto>(Assert.IsType<OkObjectResult>(
            (await controller.GetProfile(created.Id, default)).Result).Value);
        Assert.True(profile.IsProspect);
        // An older client omitting this optional field must not confirm cooperation accidentally.
        var oldUpdate = Assert.IsType<InsuranceCompaniesController.InsuranceCompanyExtendedDto>(Assert.IsType<OkObjectResult>(
            (await controller.Update(created.Id, Body(broker) with { Name = "Νέα επωνυμία" }, default)).Result).Value);
        Assert.True(oldUpdate.IsProspect);
        var confirmed = Assert.IsType<InsuranceCompaniesController.InsuranceCompanyExtendedDto>(Assert.IsType<OkObjectResult>(
            (await controller.Update(created.Id, Body(broker, false), default)).Result).Value);
        Assert.False(confirmed.IsProspect); Assert.True(confirmed.IsActive);
    }

    [Fact]
    public async Task Ordinary_creation_is_not_prospective_and_another_tenant_cannot_change_it()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var controller = new InsuranceCompaniesController(null!, db, user, TestScaffold.Clock, null!, null!);
        var created = Assert.IsType<InsuranceCompaniesController.InsuranceCompanyExtendedDto>(Assert.IsType<OkObjectResult>(
            (await controller.Create(Body(), default)).Result).Value);
        Assert.False(created.IsProspect);
        var outsider = new InsuranceCompaniesController(null!, db, TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock, null!, null!);
        Assert.IsType<ForbidResult>((await outsider.Update(created.Id, Body(prospect: true), default)).Result);
        Assert.False(db.InsuranceCompanies.Single().IsProspect);
    }
}
