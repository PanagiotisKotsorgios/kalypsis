using FluentValidation;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Phase11;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class ClaimSupportEditingTests
{
    private static GarageBody Garage(string? code = null, string name = " Συνεργείο ") =>
        new(code, name, null, null, " Αθήνα ", null, "2101234567", "info@example.gr", null, true, null, true, " Notes ");

    private static async Task<Claim> SeedClaim(AppDbContext db, Guid tenant, string number)
    {
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = number,
            Customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = number },
            InsuranceCompany = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Code = number, Name = number },
            Premium = 100, Currency = "EUR", StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1) };
        policy.CustomerId = policy.Customer.Id; policy.InsuranceCompanyId = policy.InsuranceCompany.Id;
        var claim = new Claim { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, Policy = policy,
            ClaimNumber = number, IncidentDate = new(2026, 1, 2), ReportedDate = new(2026, 1, 3) };
        db.Claims.Add(claim); await db.SaveChangesAsync(); return claim;
    }

    private static ClaimIndemnityBody Payment(Guid claim, string number = "IND-1") =>
        new(claim, number, new(2026, 2, 1), 100m, "EUR", "Customer", "Πελάτης", null, "BankTransfer", "REF", "Notes");

    [Fact]
    public async Task Garage_can_be_created_without_a_manual_code_and_appears_in_the_real_list()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var handler = new CreateGarageHandler(db, current);
        var first = await handler.Handle(new(Garage()), default);
        var second = await handler.Handle(new(Garage("")), default);
        Assert.StartsWith("G-", first.Code); Assert.NotEqual(first.Code, second.Code);
        Assert.Equal("Συνεργείο", first.Name); Assert.Equal("Αθήνα", first.City); Assert.Equal("Notes", first.Notes);
        Assert.Contains(await new ListGaragesHandler(db).Handle(new(), default), row => row.Id == first.Id);
        var updated = await new UpdateGarageHandler(db, current).Handle(new(first.Id, Garage(first.Code, "Νέο όνομα")), default);
        Assert.Equal(first.Code, updated.Code); Assert.Equal("Νέο όνομα", updated.Name);
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(Garage($" {first.Code} ")), default));
        Assert.Equal(2, await db.Garages.CountAsync());
    }

    [Fact]
    public async Task Garage_invalid_input_and_deleted_duplicate_codes_return_errors_without_creating_rows()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var handler = new CreateGarageHandler(db, current);
        foreach (var body in new[] { Garage(name: ""), Garage() with { Email = "bad" }, Garage() with { Phone = "letters" }, Garage() with { Afm = "123" } })
            await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(new(body), default));
        Assert.Empty(await db.Garages.ToListAsync());
        var created = await handler.Handle(new(Garage("MANUAL")), default);
        var entity = await db.Garages.SingleAsync(); entity.DeletedAt = DateTime.UtcNow; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(Garage(" MANUAL ")), default));
        await Assert.ThrowsAsync<AppException>(() => new UpdateGarageHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid())).Handle(new(created.Id, Garage("OTHER")), default));
        Assert.Equal("MANUAL", entity.Code);
    }

    [Fact]
    public async Task Indemnity_edit_persists_all_fields_on_the_same_record_and_refreshes_claim_totals()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var claim = await SeedClaim(db, current.TenantId!.Value, "CLAIM-1");
        var create = new CreateClaimIndemnityHandler(db, current);
        var initial = await create.Handle(new(Payment(claim.Id)), default);
        var before = await db.ClaimIndemnities.SingleAsync(); var createdAt = before.CreatedAt;
        var body = Payment(claim.Id) with { Amount = 45.75m, Currency = " usd ", PaidOn = new(2026, 3, 5), PayeeName = " Νέος δικαιούχος ",
            PaymentMethod = "Card", Reference = " NEWREF ", Notes = " Edited " };
        var saved = await new UpdateClaimIndemnityHandler(db, current).Handle(new(initial.Id, body), default);
        Assert.Equal(initial.Id, saved.Id); Assert.Equal("CLAIM-1", saved.ClaimNumber); Assert.Equal(45.75m, saved.Amount);
        Assert.Equal("USD", saved.Currency); Assert.Equal("Νέος δικαιούχος", saved.PayeeName);
        Assert.Equal("NEWREF", saved.Reference); Assert.Equal("Edited", saved.Notes); Assert.Equal("Card", saved.PaymentMethod);
        db.ChangeTracker.Clear();
        var persisted = await db.ClaimIndemnities.SingleAsync();
        Assert.Equal(createdAt, persisted.CreatedAt); Assert.Equal(body.PaidOn, persisted.PaidOn);
        Assert.Equal(45.75m, await db.ClaimIndemnities.Where(row => row.ClaimId == claim.Id).SumAsync(row => row.Amount));
        Assert.Equal(saved.Amount, Assert.Single(await new ListClaimIndemnitiesHandler(db).Handle(new(claim.Id), default)).Amount);
    }

    [Fact]
    public async Task Indemnity_links_are_tenant_checked_and_same_tenant_changes_return_current_labels()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        var store = Guid.NewGuid().ToString("N");
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, store);
        var foreignUser = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var foreignDb = TestScaffold.NewDb(foreignUser, TestScaffold.Clock, store);
        var foreignClaim = await SeedClaim(foreignDb, foreignUser.TenantId!.Value, "FOREIGN");
        var foreignGarage = await new CreateGarageHandler(foreignDb, foreignUser).Handle(new(Garage()), default);
        var claim = await SeedClaim(db, tenant, "CL-1"); var otherClaim = await SeedClaim(db, tenant, "CL-2");
        var garage = await new CreateGarageHandler(db, current).Handle(new(Garage()), default);
        var initial = await new CreateClaimIndemnityHandler(db, current).Handle(new(Payment(claim.Id)), default);
        var update = new UpdateClaimIndemnityHandler(db, current);
        var saved = await update.Handle(new(initial.Id, Payment(otherClaim.Id) with { PayeeType = "Garage", GarageId = garage.Id }), default);
        Assert.Equal("CL-2", saved.ClaimNumber); Assert.Equal(garage.Name, saved.GarageName); Assert.Null(saved.PayeeName);
        await Assert.ThrowsAsync<AppException>(() => update.Handle(new(initial.Id, Payment(Guid.NewGuid())), default));
        await Assert.ThrowsAsync<AppException>(() => update.Handle(new(initial.Id, Payment(foreignClaim.Id)), default));
        await Assert.ThrowsAsync<AppException>(() => update.Handle(new(initial.Id, Payment(otherClaim.Id) with { PayeeType = "Garage", GarageId = foreignGarage.Id }), default));
        await Assert.ThrowsAsync<AppException>(() => update.Handle(new(initial.Id, Payment(otherClaim.Id) with { PayeeType = "Garage", GarageId = Guid.NewGuid() }), default));
        await Assert.ThrowsAsync<AppException>(() => new UpdateClaimIndemnityHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid())).Handle(new(initial.Id, Payment(claim.Id)), default));
        var cleared = await update.Handle(new(initial.Id, Payment(otherClaim.Id)), default);
        Assert.Null(cleared.GarageId); Assert.Null(cleared.GarageName);
    }

    [Fact]
    public async Task Indemnity_duplicate_and_invalid_updates_leave_original_values_unchanged()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var claim = await SeedClaim(db, current.TenantId!.Value, "CL-1");
        var create = new CreateClaimIndemnityHandler(db, current);
        var first = await create.Handle(new(Payment(claim.Id)), default);
        await create.Handle(new(Payment(claim.Id, "IND-2")), default);
        var update = new UpdateClaimIndemnityHandler(db, current);
        await Assert.ThrowsAsync<AppException>(() => update.Handle(new(first.Id, Payment(claim.Id, " IND-2 ")), default));
        foreach (var body in new[] { Payment(claim.Id) with { Amount = 0 }, Payment(claim.Id) with { Amount = -1 }, Payment(claim.Id) with { Currency = "EURO" },
            Payment(claim.Id) with { PayeeType = "bad" }, Payment(claim.Id) with { PayeeType = "Garage" }, Payment(claim.Id) with { PaymentMethod = "bad" }, Payment(claim.Id) with { PaidOn = default } })
            await Assert.ThrowsAsync<ValidationException>(() => update.Handle(new(first.Id, body), default));
        Assert.Equal(100m, (await db.ClaimIndemnities.SingleAsync(row => row.Id == first.Id)).Amount);
        Assert.Equal(2, await db.ClaimIndemnities.CountAsync());
        Assert.Equal("AgencyStaff", Assert.Single(typeof(ClaimIndemnitiesController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
        Assert.Equal("AgencyAdmin", Assert.Single(typeof(GaragesController).GetMethod("Create")!.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>()).Policy);
    }

    [Fact]
    public async Task Net_only_cover_create_edit_delete_never_replaces_policy_or_imported_gross()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var claim = await SeedClaim(db, tenant, "CL-1"); var policy = claim.Policy;
        var cover = new PolicyCover { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, CoverCode = "FIRE", GrossPremium = 120, NetPremium = 80 };
        db.PolicyCovers.Add(cover); await db.SaveChangesAsync();
        var controller = new PolicyExtensionsController(db, current, TestScaffold.Clock);
        var body = new PolicyExtensionsController.CoverBody(null, "FIRE", "Fire", null, 70m, 50000m, 10m, 6m);
        await controller.UpdateCover(policy.Id, cover.Id, body, default);
        Assert.Equal(120m, cover.GrossPremium); Assert.Equal(70m, cover.NetPremium); Assert.Equal(100m, policy.Premium);
        await controller.CreateCover(policy.Id, body with { CoverCode = "GLASS" }, default);
        var added = await db.PolicyCovers.SingleAsync(row => row.CoverCode == "GLASS");
        Assert.Equal(0m, added.GrossPremium); Assert.Equal(100m, policy.Premium);
        await controller.DeleteCover(policy.Id, added.Id, default); Assert.Equal(100m, policy.Premium);
        await controller.UpdateCover(policy.Id, cover.Id, body with { GrossPremium = 150m }, default);
        Assert.Equal(150m, cover.GrossPremium); Assert.Equal(150m, policy.Premium);
    }
}
