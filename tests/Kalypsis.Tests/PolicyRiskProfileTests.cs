using System.Text.Json;
using System.Text.Json.Nodes;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public class PolicyRiskProfileTests
{
    private static Policy NewPolicy(Guid tenant, PolicyType type = PolicyType.Auto) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "RISK-1", PolicyType = type,
        Status = PolicyStatus.Active, StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1), Premium = 100,
        Currency = "EUR", SpecsJson = "{\"vehicle\":{\"make\":\"Toyota\",\"vin\":\"OLD\",\"future\":[true,7]},\"packageCode\":\"BASIC\",\"carrier\":{\"keep\":1}}"
    };

    [Fact]
    public void PartialUpdates_PreserveCarrierVehicleAndBeneficiaryData_AndClearOnlyRequestedFields()
    {
        var policy = NewPolicy(Guid.NewGuid());
        var cover = Guid.NewGuid();
        var beneficiaries = JsonSerializer.Serialize(new[] { new PolicyRiskProfile.Beneficiary(Guid.NewGuid(), "Μαρία", "Σύζυγος", 60), new PolicyRiskProfile.Beneficiary(Guid.NewGuid(), "Νίκος", "Τέκνο", 40) });
        PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["vehicle:vin"] = "NEW", ["beneficiaries"] = beneficiaries, ["coverDeductible:" + cover] = "150", ["otherChargesAmount"] = "0" }, new HashSet<Guid> { cover });
        var root = JsonNode.Parse(policy.SpecsJson!)!;
        Assert.Equal("Toyota", root["vehicle"]!["make"]!.ToString());
        Assert.Equal("NEW", root["vehicle"]!["vin"]!.ToString());
        Assert.Equal(7, root["vehicle"]!["future"]![1]!.GetValue<int>());
        Assert.Equal("BASIC", root["packageCode"]!.ToString());
        Assert.Equal(1, root["carrier"]!["keep"]!.GetValue<int>());
        Assert.Equal(0, policy.OtherChargesAmount);
        var values = PolicyRiskProfile.Read(policy);
        Assert.Equal("150", values["coverDeductible:" + cover]);
        Assert.Contains("Μαρία", JsonSerializer.Deserialize<PolicyRiskProfile.Beneficiary[]>(values["beneficiaries"], new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!.Select(row => row.Name));
        PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["vehicle:vin"] = "", ["otherChargesAmount"] = "" }, new HashSet<Guid>());
        Assert.Equal("", PolicyRiskProfile.Read(policy)["vehicle:vin"]);
        Assert.Null(policy.OtherChargesAmount);
        Assert.Equal(values["beneficiaries"], PolicyRiskProfile.Read(policy)["beneficiaries"]);
    }

    [Theory]
    [InlineData(PolicyType.Auto, "vehicle:year", "2026.5")]
    [InlineData(PolicyType.Auto, "health:heightCm", "180")]
    [InlineData(PolicyType.Home, "property:areaSqm", "-1")]
    [InlineData(PolicyType.Home, "property:alarm", "yes")]
    [InlineData(PolicyType.Health, "health:heightCm", "999")]
    [InlineData(PolicyType.Health, "health:smoker", "maybe")]
    [InlineData(PolicyType.Auto, "premium", "999")]
    [InlineData(PolicyType.Auto, "beneficiaries", "[null]")]
    public void InvalidUpdates_AreAtomicAndDoNotChangeMoneyOrJson(PolicyType type, string key, string value)
    {
        var policy = NewPolicy(Guid.NewGuid(), type);
        var before = policy.SpecsJson;
        Assert.Throws<AppException>(() => PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["vatAmount"] = "25", [key] = value }, new HashSet<Guid>()));
        Assert.Null(policy.VatAmount); Assert.Equal(before, policy.SpecsJson); Assert.Null(policy.MedicalExamsNotes);
    }

    [Fact]
    public void BeneficiaryShares_RejectTotalsOver100_AndForeignOrDeletedCoverageIds()
    {
        var policy = NewPolicy(Guid.NewGuid());
        var rows = new[] { new PolicyRiskProfile.Beneficiary(Guid.NewGuid(), "Ένας", null, 70), new PolicyRiskProfile.Beneficiary(Guid.NewGuid(), "Δύο", null, 40) };
        Assert.Throws<AppException>(() => PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["beneficiaries"] = JsonSerializer.Serialize(rows) }, new HashSet<Guid>()));
        Assert.Throws<AppException>(() => PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["coverDeductible:" + Guid.NewGuid()] = "50" }, new HashSet<Guid>()));
        foreach (var invalid in new[] { "bad JSON", "[]", "null" })
        {
            policy.SpecsJson = invalid;
            Assert.Throws<AppException>(() => PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["vehicle:make"] = "New" }, new HashSet<Guid>()));
            Assert.Equal(invalid, policy.SpecsJson);
        }
    }

    [Fact]
    public async Task MedicalData_UsesEncryptedExistingColumn_IsRedactedFromNewAuditEntries_AndPreservesLegacyNotes()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(current.TenantId!.Value, PolicyType.Health);
        policy.MedicalExamsNotes = "CONFIDENTIAL medical examination";
        db.Policies.Add(policy); await db.SaveChangesAsync();
        PolicyRiskProfile.Apply(policy, new Dictionary<string, string> { ["health:heightCm"] = "180", ["health:smoker"] = "false", ["health:exclusions"] = "CONFIDENTIAL exclusion" }, new HashSet<Guid>());
        await db.SaveChangesAsync();
        Assert.DoesNotContain("CONFIDENTIAL", policy.SpecsJson!);
        var values = PolicyRiskProfile.Read(policy);
        Assert.Equal("CONFIDENTIAL medical examination", values["health:medicalHistory"]);
        Assert.Equal("false", values["health:smoker"]);
        var converter = db.Model.FindEntityType(typeof(Policy))!.FindProperty(nameof(Policy.MedicalExamsNotes))!.GetValueConverter()!;
        var encrypted = Assert.IsType<string>(converter.ConvertToProvider(policy.MedicalExamsNotes));
        Assert.DoesNotContain("CONFIDENTIAL", encrypted);
        Assert.Equal(policy.MedicalExamsNotes, converter.ConvertFromProvider(encrypted));
        Assert.Equal("Legacy plaintext", converter.ConvertFromProvider("Legacy plaintext"));
        var logs = db.AuditLogs.Where(row => row.EntityName == nameof(Policy)).ToArray();
        Assert.NotEmpty(logs);
        foreach (var audit in logs)
        {
            Assert.DoesNotContain("CONFIDENTIAL", (audit.NewValues ?? "") + audit.OldValues);
        }
        policy.PolicyType = PolicyType.Auto;
        Assert.DoesNotContain(PolicyRiskProfile.Read(policy).Keys, key => key.StartsWith("health:"));
    }

    [Fact]
    public async Task RiskEndpoint_RejectsAnotherTenantsPolicy()
    {
        var other = TestScaffold.AgencyStaff(Guid.NewGuid());
        var database = Guid.NewGuid().ToString("N");
        var policy = NewPolicy(other.TenantId!.Value);
        using (var seed = TestScaffold.NewDb(other, TestScaffold.Clock, database)) { seed.Policies.Add(policy); await seed.SaveChangesAsync(); }
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock, database);
        var controller = new PolicyRiskProfileController(db, current);
        Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => controller.Get(policy.Id, default))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => controller.Update(policy.Id, new(new() { ["vehicle:make"] = "Other" }), default))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => controller.Claims(policy.Id, default))).StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PolicyholderContacts_UseTheActualLinkedPerson_OrInsuredWhenTheyAreTheSame(bool separateParty)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var insured = new Customer { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Ασφαλισμένος", Email = "insured@example.gr", VatNumber = "111111111", Phone = "2101111111" };
        var party = new Customer { Id = Guid.NewGuid(), TenantId = tenant, FirstName = "Συμβαλλόμενος", Email = "party@example.gr", VatNumber = "222222222", MobilePhone = "6902222222" };
        var carrier = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Name = "Ασφαλιστική" };
        var policy = NewPolicy(tenant);
        policy.Customer = insured; policy.CustomerId = insured.Id;
        policy.InsuranceCompany = carrier; policy.InsuranceCompanyId = carrier.Id;
        if (separateParty) { policy.ContractPartyCustomer = party; policy.ContractPartyCustomerId = party.Id; }
        db.Customers.AddRange(insured, party); db.InsuranceCompanies.Add(carrier); db.Policies.Add(policy); await db.SaveChangesAsync();
        var detail = await new GetPolicyDetailQueryHandler(db, current, null!).Handle(new(policy.Id), default);
        Assert.Equal(separateParty ? party.Email : insured.Email, detail.ContractPartyEmail);
        Assert.Equal(separateParty ? party.VatNumber : insured.VatNumber, detail.ContractPartyVat);
        Assert.Equal(separateParty ? party.MobilePhone : insured.Phone, detail.ContractPartyPhone);
        Assert.Equal(insured.Email, detail.CustomerEmail);
    }

    [Fact]
    public async Task ClaimSummary_UsesRecordedPaymentsAndLatestReservePerCurrency_NotApprovedAmountsOrSumOfPastReserves()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(tenant);
        var claim = new Claim { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, ClaimNumber = "CL-1", IncidentDate = new(2026, 1, 1), ReportedDate = new(2026, 1, 2), ApprovedAmount = 999, Status = ClaimStatus.Approved };
        db.Policies.Add(policy); db.Claims.Add(claim);
        db.ClaimIndemnities.AddRange(new ClaimIndemnity { TenantId = tenant, ClaimId = claim.Id, Amount = 10, Currency = "EUR" }, new ClaimIndemnity { TenantId = tenant, ClaimId = claim.Id, Amount = 20, Currency = "EUR" },
            new ClaimIndemnity { TenantId = tenant, ClaimId = Guid.NewGuid(), Amount = 1000, Currency = "EUR" });
        db.ClaimProvisions.AddRange(new ClaimProvision { TenantId = tenant, ClaimId = claim.Id, Currency = "EUR", EvaluationDate = new(2026, 1, 1), ReserveAmount = 100 },
            new ClaimProvision { TenantId = tenant, ClaimId = claim.Id, Currency = "EUR", EvaluationDate = new(2026, 2, 1), ReserveAmount = 70 },
            new ClaimProvision { TenantId = tenant, ClaimId = claim.Id, Currency = "USD", EvaluationDate = new(2026, 2, 1), ReserveAmount = 50 });
        await db.SaveChangesAsync();
        var response = await new PolicyRiskProfileController(db, current).Claims(policy.Id, default);
        var rows = Assert.IsAssignableFrom<IReadOnlyList<PolicyRiskProfileController.ClaimSummary>>(Assert.IsType<OkObjectResult>(response.Result).Value);
        var row = Assert.Single(rows);
        Assert.Equal(999, row.ApprovedAmount);
        var euro = Assert.Single(row.Amounts, amount => amount.Currency == "EUR");
        Assert.Equal(30, euro.Paid); Assert.Equal(70, euro.Reserve);
        var usd = Assert.Single(row.Amounts, amount => amount.Currency == "USD");
        Assert.Null(usd.Paid); Assert.Equal(50, usd.Reserve);
    }
}
