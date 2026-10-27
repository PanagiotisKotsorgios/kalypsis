using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

public sealed class DesktopSyncFinancialParityTests
{
    [Fact]
    public async Task Full_snapshot_includes_customer_household_and_asset_collections()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var controller = new DesktopSyncController(db, user, NullLogger<DesktopSyncController>.Instance);
        var response = await controller.Sync(new DesktopSyncController.SyncRequest(
            "parity-test", null, "last_write_wins", "keep_both",
            JsonSerializer.SerializeToElement(new { })), CancellationToken.None);
        var root = JsonSerializer.SerializeToElement(
            Assert.IsType<OkObjectResult>(response.Result).Value);
        Assert.Equal(6, root.GetProperty("version").GetInt32());
        var data = root.GetProperty("data");
        foreach (var key in new[]
        {
            "producerCardEntries", "claimInvolvedParties", "emailTemplates",
            "overCommissionStatements", "generalFinancialEntries", "advancePayments",
            "creditNotes", "partyLedgerEntries", "ledgerAllocations"
            , "customerRelationships", "customerFamilyMembers", "customerAssets", "customerInsuranceNeeds", "customerContacts"
        })
            Assert.Equal(JsonValueKind.Array, data.GetProperty(key).ValueKind);
    }

    [Fact]
    public void Household_and_needs_references_follow_customer_identity_mapping()
    {
        var desktopCustomer = Guid.NewGuid();
        var cloudCustomer = Guid.NewGuid();
        var desktopRelative = Guid.NewGuid();
        var cloudRelative = Guid.NewGuid();
        var node = JsonNode.Parse(JsonSerializer.Serialize(new
        {
            customerRelationships = new[] { new { Id = Guid.NewGuid(), CustomerId = desktopCustomer, RelatedCustomerId = desktopRelative } },
            customerFamilyMembers = new[] { new { Id = Guid.NewGuid(), CustomerId = desktopCustomer, FullName = "Relative" } },
            customerAssets = new[] { new { Id = Guid.NewGuid(), CustomerId = desktopCustomer, AssetKind = "House" } },
            customerInsuranceNeeds = new[] { new { Id = Guid.NewGuid(), CustomerId = desktopCustomer, Kind = "Home" } },
            customerContacts = new[] { new { Id = Guid.NewGuid(), CustomerId = desktopCustomer, FullName = "Relative Person" } },
        }))!.AsObject();
        var rewrite = typeof(DesktopSyncController).GetMethod("RewriteReferences", BindingFlags.Static | BindingFlags.NonPublic)!;
        rewrite.Invoke(null, [node, new Dictionary<Guid, Guid>(), new Dictionary<Guid, Guid>(),
            new Dictionary<Guid, Guid> { [desktopCustomer] = cloudCustomer, [desktopRelative] = cloudRelative }]);
        foreach (var collection in new[] { "customerRelationships", "customerFamilyMembers", "customerAssets", "customerInsuranceNeeds", "customerContacts" })
            Assert.Equal(cloudCustomer.ToString(), node[collection]![0]!["CustomerId"]!.ToString());
        Assert.Equal(cloudRelative.ToString(), node["customerRelationships"]![0]!["RelatedCustomerId"]!.ToString());
    }

    [Fact]
    public async Task Full_pull_contains_family_member_asset_need_and_contact_values()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var customerId = Guid.NewGuid();
        var member = new CustomerFamilyMember { TenantId = user.TenantId!.Value, CustomerId = customerId, FullName = "Maria Test", Relation = "Child", MobilePhone = "6900000000" };
        db.CustomerFamilyMembers.Add(member);
        db.CustomerAssets.Add(new CustomerAsset { TenantId = user.TenantId.Value, CustomerId = customerId, FamilyMemberId = member.Id, AssetKind = "House", City = "Patras", AreaSquareMeters = 90 });
        db.CustomerInsuranceNeeds.Add(new CustomerInsuranceNeed { TenantId = user.TenantId.Value, CustomerId = customerId, Kind = "Home", Title = "House policy", Priority = 4 });
        db.CustomerContacts.Add(new CustomerContact { TenantId = user.TenantId.Value, CustomerId = customerId, FirstName = "Nikos", LastName = "Test", MobilePhone = "6911111111" });
        await db.SaveChangesAsync();
        var controller = new DesktopSyncController(db, user, NullLogger<DesktopSyncController>.Instance);
        var response = await controller.Sync(new DesktopSyncController.SyncRequest(
            "parity-test", null, "last_write_wins", "keep_both", JsonSerializer.SerializeToElement(new { })), CancellationToken.None);
        var root = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(response.Result).Value);
        var data = root.GetProperty("data");
        Assert.Equal("Maria Test", data.GetProperty("customerFamilyMembers")[0].GetProperty("FullName").GetString());
        Assert.Equal("Patras", data.GetProperty("customerAssets")[0].GetProperty("City").GetString());
        Assert.Equal(90, data.GetProperty("customerAssets")[0].GetProperty("AreaSquareMeters").GetDecimal());
        Assert.Equal("House policy", data.GetProperty("customerInsuranceNeeds")[0].GetProperty("Title").GetString());
        Assert.Equal("6911111111", data.GetProperty("customerContacts")[0].GetProperty("MobilePhone").GetString());
    }

    [Fact]
    public async Task Desktop_household_rows_are_saved_without_creating_customers_for_name_only_members()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var customerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var payload = JsonSerializer.SerializeToElement(new
        {
            customers = new[] { new { Id = customerId, CustomerNumber = "SYNC-FAMILY-1", Type = "Individual", FirstName = "Nikos", LastName = "Test" } },
            customerFamilyMembers = new[] { new { Id = memberId, CustomerId = customerId, FullName = "Maria Test", Relation = "Child", MobilePhone = "6900000000" } },
            customerAssets = new[] { new { Id = Guid.NewGuid(), CustomerId = customerId, FamilyMemberId = memberId, AssetKind = "House", City = "Patras", AreaSquareMeters = 90m } },
            customerInsuranceNeeds = new[] { new { Id = Guid.NewGuid(), CustomerId = customerId, Kind = "Home", Title = "Home policy", Priority = 4 } },
            customerContacts = new[] { new { Id = Guid.NewGuid(), CustomerId = customerId, Kind = "Work", FullName = "Eleni Office", Label = "Accountant", MobilePhone = "6911111111" } }
        });
        var controller = new DesktopSyncController(db, user, NullLogger<DesktopSyncController>.Instance);
        var result = await controller.Sync(new DesktopSyncController.SyncRequest(
            "parity-test", null, "last_write_wins", "keep_both", payload), CancellationToken.None);
        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single(db.Customers);
        Assert.Equal("Maria Test", Assert.Single(db.CustomerFamilyMembers).FullName);
        Assert.Equal(memberId, Assert.Single(db.CustomerAssets).FamilyMemberId);
        Assert.Equal("Home policy", Assert.Single(db.CustomerInsuranceNeeds).Title);
        var contact = Assert.Single(db.CustomerContacts);
        Assert.Equal("Eleni", contact.FirstName);
        Assert.Equal("Office", contact.LastName);
        Assert.Equal("Accountant", contact.Role);
        Assert.Equal("6911111111", contact.MobilePhone);
    }

    private static JsonElement Normalize<T>(object value) =>
        (JsonElement)typeof(DesktopSyncController)
            .GetMethod("NormalizeDesktopRow", BindingFlags.Static | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(T))
            .Invoke(null, [JsonSerializer.SerializeToElement(value)])!;

    [Fact]
    public void Desktop_financial_names_and_dates_map_to_cloud_shape()
    {
        var advance = Normalize<AdvancePayment>(new
        {
            Number = "ADV-1", PartyKind = "Producer", SettledAmount = 12m,
            Method = "BankTransfer", ReceivedOn = "2026-10-25T00:00:00"
        });
        Assert.Equal("Producer", advance.GetProperty("PartyType").GetString());
        Assert.Equal(12m, advance.GetProperty("AllocatedAmount").GetDecimal());
        Assert.Equal("BankTransfer", advance.GetProperty("PaymentMethod").GetString());
        Assert.Equal("2026-10-25", advance.GetProperty("ReceivedOn").GetString());

        var credit = Normalize<CreditNote>(new
        {
            Number = "CR-1", Date = "2026-10-25T00:00:00", Reason = "Διόρθωση"
        });
        Assert.Equal("CR-1", credit.GetProperty("CreditNoteNumber").GetString());
        Assert.Equal("2026-10-25", credit.GetProperty("IssuedAt").GetString());
        Assert.Equal("Manual", credit.GetProperty("Kind").GetString());

        var entry = Normalize<GeneralFinancialEntry>(new
        {
            Direction = "Income", CounterpartyName = "Office", DocumentNumber = "DOC-1"
        });
        Assert.Equal("Income", entry.GetProperty("Kind").GetString());
        Assert.Equal("Office", entry.GetProperty("Counterparty").GetString());
        Assert.Equal("DOC-1", entry.GetProperty("Reference").GetString());
    }

    [Fact]
    public void Desktop_contact_name_and_role_are_preserved_in_web_fields()
    {
        var contact = Normalize<CustomerContact>(new
        {
            FullName = "Maria Papadopoulou", Label = "Accountant", MobilePhone = "6900000000"
        });
        Assert.Equal("Maria", contact.GetProperty("FirstName").GetString());
        Assert.Equal("Papadopoulou", contact.GetProperty("LastName").GetString());
        Assert.Equal("Accountant", contact.GetProperty("Role").GetString());
        Assert.Equal("6900000000", contact.GetProperty("MobilePhone").GetString());
    }

    [Fact]
    public async Task Desktop_financial_update_keeps_cloud_only_links()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var entry = new GeneralFinancialEntry
        {
            TenantId = user.TenantId!.Value,
            Kind = "Expense", Category = "Office", Amount = 20m,
            EntryDate = new DateTime(2026, 10, 20),
            Subcategory = "Rent", PolicyId = Guid.NewGuid(),
            Counterparty = "Old"
        };
        db.GeneralFinancialEntries.Add(entry);
        await db.SaveChangesAsync();
        var controller = new DesktopSyncController(db, user, NullLogger<DesktopSyncController>.Instance);
        var payload = JsonSerializer.SerializeToElement(new
        {
            generalFinancialEntries = new[]
            {
                new { entry.Id, Direction = "Expense", Category = "Office", Amount = 30m,
                    CounterpartyName = "New" }
            }
        });
        var method = typeof(DesktopSyncController).GetMethod("UpsertAsync", BindingFlags.NonPublic | BindingFlags.Instance)!
            .MakeGenericMethod(typeof(GeneralFinancialEntry));
        var count = await (Task<int>)method.Invoke(controller,
            [payload, "generalFinancialEntries", user.TenantId.Value, "keep_both", new List<string>(), CancellationToken.None])!;
        Assert.Equal(1, count);
        await db.SaveChangesAsync();
        Assert.Equal(30m, entry.Amount);
        Assert.Equal("New", entry.Counterparty);
        Assert.Equal("Rent", entry.Subcategory);
        Assert.NotNull(entry.PolicyId);
    }

    [Fact]
    public void Desktop_party_ledger_remaps_the_party_by_kind()
    {
        var desktopCustomer = Guid.NewGuid();
        var cloudCustomer = Guid.NewGuid();
        var node = JsonNode.Parse(JsonSerializer.Serialize(new
        {
            partyLedgerEntries = new[] { new { Id = Guid.NewGuid(), PartyKind = "Customer", PartyId = desktopCustomer } }
        }))!.AsObject();
        var method = typeof(DesktopSyncController).GetMethod("RewriteReferences", BindingFlags.Static | BindingFlags.NonPublic)!;
        method.Invoke(null, [node, new Dictionary<Guid, Guid>(), new Dictionary<Guid, Guid>(),
            new Dictionary<Guid, Guid> { [desktopCustomer] = cloudCustomer }]);
        Assert.Equal(cloudCustomer.ToString(), node["partyLedgerEntries"]![0]!["PartyId"]!.ToString());
    }
}
