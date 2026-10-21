using System.Text;
using ClosedXML.Excel;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Xunit;

namespace Kalypsis.Tests;

public sealed class ProductionExportProjectionTests
{
    [Theory]
    [InlineData("csv", null)]
    [InlineData("xlsx", null)]
    [InlineData("pdf", null)]
    [InlineData("csv", "policyNumber,gross,net,vat,partner,agency")]
    [InlineData("xlsx", "policyNumber,gross,net,vat,partner,agency")]
    public async Task Exports_use_filtered_records_and_omit_insurance_tax_even_for_legacy_callers(string format, string? columns)
    {
        var tenantId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenantId);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Γραφείο εξαγωγής", Code = "OFFICE" });
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenantId, CustomerNumber = "C1", Type = CustomerType.Individual, FirstName = "Άννα", LastName = "Δοκιμή" };
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenantId, Code = "INS", Name = "Ασφαλιστική" };
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenantId, Code = "P1", Name = "Συνεργάτης φίλτρου" };
        db.Customers.Add(customer); db.InsuranceCompanies.Add(company); db.Producers.Add(producer);
        foreach (var (number, start) in new[] { ("VISIBLE-POLICY", new DateOnly(2026, 1, 1)), ("HIDDEN-POLICY", new DateOnly(2024, 1, 1)) })
            db.Policies.Add(new Policy {
                Id = Guid.NewGuid(), TenantId = tenantId, PolicyNumber = number, CustomerId = customer.Id, Customer = customer,
                InsuranceCompanyId = company.Id, InsuranceCompany = company, ProducerId = producer.Id, Producer = producer,
                PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, StartDate = start, EndDate = start.AddYears(1),
                Premium = 100m, NetPremium = 80m, VatAmount = 20m, Currency = "EUR"
            });
        await db.SaveChangesAsync();
        var filter = new ProductionFilters(new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), null, producer.Id, null, null, null, null, "producer");
        var result = await new ExportProductionListHandler(db, current).Handle(new ExportProductionListQuery(filter, format, columns), default);
        Assert.NotEmpty(result.Content);
        if (format == "csv")
        {
            var text = Encoding.UTF8.GetString(result.Content);
            Assert.Contains("Γραφείο εξαγωγής", text); Assert.Contains("VISIBLE-POLICY", text);
            Assert.DoesNotContain("HIDDEN-POLICY", text); Assert.DoesNotContain("Φόρος ασφαλίστρων", text); Assert.DoesNotContain("VAT", text);
            Assert.Contains("Συνεργάτης φίλτρου", text);
        }
        else if (format == "xlsx")
        {
            using var stream = new MemoryStream(result.Content);
            using var workbook = new XLWorkbook(stream);
            var text = string.Join("|", workbook.Worksheets.First().CellsUsed().Select(cell => cell.GetString()));
            Assert.Contains("VISIBLE-POLICY", text); Assert.DoesNotContain("HIDDEN-POLICY", text);
            Assert.DoesNotContain("Φόρος ασφαλίστρων", text); Assert.DoesNotContain("VAT", text);
        }
        else Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(result.Content.Take(8).ToArray()));
        Assert.All(db.Policies, policy => Assert.Equal(20m, policy.VatAmount));
    }
}
