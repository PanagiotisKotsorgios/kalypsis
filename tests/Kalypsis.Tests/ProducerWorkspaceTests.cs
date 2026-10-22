using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public class ProducerWorkspaceTests
{
    [Fact]
    public async Task Statistics_ApplyAllFiltersToTheSameRealRecords_AndKeepCurrenciesAndCommissionsSeparate()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value;
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Code = "P1", Name = "Συνεργάτης", Status = ProducerStatus.Active };
        var other = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Code = "OTHER", Status = ProducerStatus.Active };
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, Status = CustomerStatus.Active };
        var prospectCustomer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, Status = CustomerStatus.Prospect };
        var a = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Code = "A", Name = "Ασφαλιστική Α" };
        var b = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Code = "B", Name = "Ασφαλιστική Β" };
        Policy Policy(string number, decimal premium, int month, PolicyStatus status, InsuranceCompany carrier, PolicyType type, string currency = "EUR") => new()
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = number, ProducerId = producer.Id, Producer = producer,
            CustomerId = customer.Id, Customer = customer, InsuranceCompanyId = carrier.Id, InsuranceCompany = carrier,
            Premium = premium, NetPremium = premium * .8m, StartDate = new(2026, month, 10), EndDate = new(2027, month, 10),
            IssuedAt = new(2026, month, 1), CreatedAt = new DateTime(2026, month, 3, 10, 0, 0, DateTimeKind.Utc), Status = status, PolicyType = type, Currency = currency
        };
        var january = Policy("JAN", 100, 1, PolicyStatus.Active, a, PolicyType.Auto);
        january.IssuedAt = new(2025, 12, 28); january.CreatedAt = new(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var february = Policy("FEB", 200, 2, PolicyStatus.Renewed, b, PolicyType.Home); february.RenewedFromPolicyId = january.Id; february.NetPremium = null;
        var cancelled = Policy("CANCEL", 500, 2, PolicyStatus.Cancelled, b, PolicyType.Auto);
        var usd = Policy("USD", 900, 1, PolicyStatus.Active, a, PolicyType.Auto, "USD");
        var prospect = Policy("PROSPECT", 9999, 1, PolicyStatus.Prospect, a, PolicyType.Auto);
        var draft = Policy("DRAFT", 9999, 1, PolicyStatus.Draft, a, PolicyType.Auto);
        var wrongCustomer = Policy("WRONG-CUSTOMER", 9999, 1, PolicyStatus.Active, a, PolicyType.Auto); wrongCustomer.Customer = prospectCustomer; wrongCustomer.CustomerId = prospectCustomer.Id;
        var wrongProducer = Policy("WRONG-PRODUCER", 9999, 1, PolicyStatus.Active, a, PolicyType.Auto); wrongProducer.Producer = other; wrongProducer.ProducerId = other.Id;
        db.Policies.AddRange(january, february, cancelled, usd, prospect, draft, wrongCustomer, wrongProducer);
        foreach (var (policy, value, currency, level) in new[] { (january, 15m, "EUR", HierarchyLevel.Producer), (february, 30m, "EUR", HierarchyLevel.Producer),
            (cancelled, 50m, "EUR", HierarchyLevel.Producer), (january, 400m, "USD", HierarchyLevel.Producer), (january, 999m, "EUR", HierarchyLevel.Agency) })
            db.PolicyCommissionSplits.Add(new PolicyCommissionSplit { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, ProducerId = producer.Id, HierarchyLevel = level, GrossAmount = value, Currency = currency });
        db.CommissionTransactions.Add(new CommissionTransaction { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = january.Id, ProducerId = producer.Id, Amount = 15, Currency = "EUR" });
        db.Claims.Add(new Claim { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = january.Id, ClaimNumber = "CL1", IncidentDate = new(2026, 1, 1), ReportedDate = new(2026, 1, 2) });
        await db.SaveChangesAsync();
        var handler = new GetProducerStatisticsHandler(db, current);
        var request = new GetProducerStatisticsQuery(producer.Id, new(2026, 1, 1), new(2026, 2, 28));
        var result = await handler.Handle(request, default);
        Assert.Equal("EUR", result.Currency); Assert.Equal(new[] { "EUR", "USD" }, result.Currencies);
        Assert.Equal(3, result.TotalPolicies); Assert.Equal(300, result.Premium); Assert.Null(result.NetPremium); Assert.Equal(45, result.RecordedCommissions);
        Assert.Equal(1, result.ActivePolicies); Assert.Equal(1, result.CancelledPolicies); Assert.Equal(1, result.RenewedPolicies); Assert.Equal(1, result.Customers); Assert.Equal(1, result.Claims);
        Assert.Equal(result.TotalPolicies, result.Monthly.Sum(row => row.Policies)); Assert.Equal(result.TotalPolicies, result.ByCarrier.Sum(row => row.Policies));
        Assert.Equal(result.TotalPolicies, result.ByType.Sum(row => row.Policies)); Assert.Equal(result.TotalPolicies, result.ByStatus.Sum(row => row.Policies));
        Assert.Equal(result.Premium, result.Monthly.Sum(row => row.Premium)); Assert.Equal(result.Premium, result.ByCarrier.Sum(row => row.Premium));
        Assert.Equal(result.RecordedCommissions, result.Monthly.Sum(row => row.RecordedCommissions));
        var filtered = await handler.Handle(request with { InsuranceCompanyId = a.Id, PolicyType = PolicyType.Auto }, default);
        Assert.Equal(1, filtered.TotalPolicies); Assert.Equal(100, filtered.Premium); Assert.Equal(15, filtered.RecordedCommissions); Assert.Equal(80, filtered.NetPremium);
        var dollars = await handler.Handle(request with { Currency = "USD" }, default);
        Assert.Equal(1, dollars.TotalPolicies); Assert.Equal(900, dollars.Premium); Assert.Equal(0, dollars.RecordedCommissions);
        var issued = await handler.Handle(request with { DateField = "issued" }, default);
        Assert.Equal(2, issued.TotalPolicies); Assert.Equal(200, issued.Premium); Assert.Equal(30, issued.RecordedCommissions);
        Assert.Equal(0, issued.Monthly[0].Policies);
        var created = await handler.Handle(request with { DateField = "created" }, default);
        Assert.Equal(2, created.TotalPolicies); Assert.Equal(200, created.Premium);
        producer.Status = ProducerStatus.Prospect; await db.SaveChangesAsync();
        Assert.Equal(0, (await handler.Handle(request, default)).TotalPolicies);
        await Assert.ThrowsAsync<AppException>(() => new GetProducerStatisticsHandler(db, TestScaffold.AgencyStaff(Guid.NewGuid())).Handle(request, default));
        foreach (var invalid in new[] { request with { To = new(2025, 1, 1) }, request with { DateField = "invalid" }, request with { Currency = "EURO" }, request with { From = new(1900, 1, 1) } })
            await Assert.ThrowsAsync<AppException>(() => handler.Handle(invalid, default));
    }

    [Fact]
    public async Task ContactFields_PersistAcrossContexts_ValidateValues_AndNeverRewriteProducerDetails()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var tenant = current.TenantId!.Value; var database = Guid.NewGuid().ToString("N");
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Code = "P1", Name = "Συνεργάτης", Notes = "Σημειώσεις", AdditionalInfoJson = "{\"legacy\":true}", Email = "base@example.gr" };
        Guid fieldId;
        using (var db = TestScaffold.NewDb(current, TestScaffold.Clock, database))
        {
            db.Producers.Add(producer); await db.SaveChangesAsync();
            var controller = new ProducerWorkspaceController(db, current, TestScaffold.Clock, null!);
            var result = await controller.AddContactField(producer.Id, new("Γραμματεία", "Email", " secretary@example.gr "), default);
            var field = Assert.IsType<ProducerWorkspaceController.ContactFieldDto>(Assert.IsType<OkObjectResult>(result.Result).Value); fieldId = field.Id;
            Assert.Equal("secretary@example.gr", field.Value);
            Assert.Equal("base@example.gr", producer.Email); Assert.Equal("{\"legacy\":true}", producer.AdditionalInfoJson); Assert.Equal("Σημειώσεις", producer.Notes);
            foreach (var body in new[] { new ProducerWorkspaceController.ContactFieldBody("Email", "Email", "bad email"), new("Phone", "Phone", "abc123"), new("Site", "Url", "javascript:alert(1)"), new("Unknown", "Unknown", "text") })
                await Assert.ThrowsAsync<AppException>(() => controller.AddContactField(producer.Id, body, default));
            Assert.Single(db.CustomFieldValues);
        }
        using (var db = TestScaffold.NewDb(current, TestScaffold.Clock, database))
        {
            var controller = new ProducerWorkspaceController(db, current, TestScaffold.Clock, null!);
            var result = await controller.ContactFields(producer.Id, default);
            var rows = Assert.IsAssignableFrom<IReadOnlyList<ProducerWorkspaceController.ContactFieldDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
            Assert.Equal(fieldId, Assert.Single(rows).Id);
            await controller.SaveContactField(producer.Id, fieldId, new("new@example.gr"), default);
            Assert.Equal("new@example.gr", db.CustomFieldValues.Single().Value);
            await Assert.ThrowsAsync<AppException>(() => controller.SaveContactField(Guid.NewGuid(), fieldId, new("stolen@example.gr"), default));
            await Assert.ThrowsAsync<AppException>(() => new ProducerWorkspaceController(db, TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock, null!).ContactFields(producer.Id, default));
            await controller.RemoveContactField(producer.Id, fieldId, default);
            Assert.Empty(db.CustomFieldValues); Assert.Empty(db.CustomFieldDefinitions);
            await Assert.ThrowsAsync<AppException>(() => controller.SaveContactField(producer.Id, fieldId, new("deleted@example.gr"), default));
        }
    }
}
