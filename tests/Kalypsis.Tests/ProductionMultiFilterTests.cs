using System.Text;
using ClosedXML.Excel;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Binders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

public sealed class ProductionMultiFilterTests
{
    private static readonly ProductionFilters Empty = new(null, null, null, null, null, null, null, null, null);

    [Fact]
    public async Task Multi_filter_predicates_translate_to_MySQL_without_connecting_to_a_database()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); TestScaffold.EnsureEncryptorBooted();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=translation_only;User=test", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new AppDbContext(options, current, TestScaffold.Clock);
        var query = await ProductionMultiFilters.ApplyAsync(db, db.Policies.Where(p => p.TenantId == current.TenantId),
            Empty with { ProducerIds = [Guid.NewGuid(), Guid.NewGuid()], PolicyTypes = ["Auto", "CUSTOM"],
                Statuses = [PolicyStatus.Active, PolicyStatus.Expired], VehicleUseCategories = ["EIX", "CUSTOM_USE"] }, default);
        var sql = query.ToQueryString();
        Assert.Contains("SELECT", sql); Assert.Contains("ProducerId", sql); Assert.Contains("CarrierBranchCode", sql); Assert.Contains("CarrierUseCode", sql);
    }

    [Fact]
    public async Task Repeated_query_parameters_bind_as_multiple_company_ids_in_ASP_NET()
    {
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var context = new DefaultHttpContext(); context.Request.QueryString = new QueryString($"?insuranceCompanyIds={ids[0]}&insuranceCompanyIds={ids[1]}");
        var metadata = new EmptyModelMetadataProvider().GetMetadataForType(typeof(Guid[]));
        var binding = DefaultModelBindingContext.CreateBindingContext(new ActionContext { HttpContext = context },
            new QueryStringValueProvider(BindingSource.Query, context.Request.Query, System.Globalization.CultureInfo.InvariantCulture),
            metadata, new BindingInfo(), "insuranceCompanyIds");
        var binder = new ArrayModelBinder<Guid>(new SimpleTypeModelBinder(typeof(Guid), NullLoggerFactory.Instance), NullLoggerFactory.Instance);
        await binder.BindModelAsync(binding);
        Assert.True(binding.Result.IsModelSet); Assert.Equal(ids, Assert.IsType<Guid[]>(binding.Result.Model));
    }

    private static (InsuranceCompany[] Companies, Producer[] Producers, Policy[] Policies) Seed(AppDbContext db, Guid tenant)
    {
        db.Tenants.Add(new Tenant { Id = tenant, Code = "MULTI", Name = "Γραφείο πολλαπλών επιλογών" });
        var companies = Enumerable.Range(1, 3).Select(i => new InsuranceCompany { Id = Guid.NewGuid(), TenantId = tenant, Name = "Company " + i, Code = "C" + i }).ToArray();
        var producers = Enumerable.Range(1, 3).Select(i => new Producer { Id = Guid.NewGuid(), TenantId = tenant, Name = "Producer " + i, Code = "P" + i }).ToArray();
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = "C1", Type = CustomerType.Individual, FirstName = "Anna", LastName = "Test" };
        var policies = new List<Policy>();
        for (var carrier = 0; carrier < 3; carrier++) for (var producer = 0; producer < 3; producer++)
        {
            policies.Add(new Policy { Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = $"POL-{carrier}-{producer}",
                Customer = customer, CustomerId = customer.Id, InsuranceCompany = companies[carrier], InsuranceCompanyId = companies[carrier].Id,
                Producer = producers[producer], ProducerId = producers[producer].Id,
                PolicyType = producer == 1 ? PolicyType.Home : PolicyType.Auto,
                Status = producer == 1 ? PolicyStatus.Expired : PolicyStatus.Active,
                VehicleUseCategory = VehicleUseCategory.EIX, CarrierBranchCode = carrier == 1 ? "CUSTOM_BRANCH" : null,
                CarrierUseCode = carrier == 1 ? "CUSTOM_USE" : null, CarrierCoverageCode = carrier == 1 ? "FIRE, GLASS" : "FIRE",
                CarrierPackageCode = carrier == 1 ? "PREMIUM" : "BASIC",
                StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1), Premium = 100, NetPremium = 80, Currency = "EUR" });
        }
        db.Policies.AddRange(policies); return (companies, producers, policies.ToArray());
    }

    [Fact]
    public async Task Multiple_companies_and_producers_are_OR_within_a_field_AND_between_fields_without_duplicates()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var data = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var filters = Empty with { InsuranceCompanyIds = [data.Companies[0].Id, data.Companies[1].Id, data.Companies[0].Id], ProducerIds = [data.Producers[0].Id, data.Producers[1].Id], GroupBy = "producer" };
        var result = await new GetProductionListHandler(db, current).Handle(new(filters), default);
        Assert.Equal(4, result.Count); Assert.Equal(400, result.Grand.Gross); Assert.Equal(2, result.Groups.Count);
        Assert.Equal(4, result.Rows.Select(row => row.PolicyId).Distinct().Count());
        Assert.DoesNotContain(result.Rows, row => row.InsuranceCompany == "Company 3" || row.Producer == "Producer 3");
    }

    [Fact]
    public async Task Multiple_branches_statuses_uses_packages_and_covers_combine_in_one_filter()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var data = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var filters = Empty with { PolicyTypes = ["Home", "CUSTOM_BRANCH"], Statuses = [PolicyStatus.Active, PolicyStatus.Expired],
            VehicleUseCategories = ["EIX", "CUSTOM_USE"], CoverCodes = ["fire", "GLASS"], PackageCodes = ["BASIC", "PREMIUM"] };
        var result = await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, filters, default);
        Assert.Equal(5, result.Count); // Whole custom-code company (3) + Home in the other two companies.
        var strict = await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, filters with { Statuses = [PolicyStatus.Expired] }, default);
        Assert.Equal(3, strict.Count); Assert.All(strict, row => Assert.Equal("Expired", row.Status));
    }

    [Fact]
    public async Task Normalized_and_legacy_coverages_match_any_selected_cover_with_no_row_duplication()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var data = Seed(db, current.TenantId!.Value);
        db.PolicyCovers.Add(new PolicyCover { Id = Guid.NewGuid(), TenantId = current.TenantId.Value, PolicyId = data.Policies[0].Id, CoverCode = "LEGAL", CoverName = "Legal" });
        data.Policies[8].SpecsJson = """{"coverCode":"LEGACY, EXTRA"}""";
        await db.SaveChangesAsync();
        var rows = await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, Empty with { CoverCodes = ["legal", "GLASS", "legacy"] }, default);
        Assert.Equal(5, rows.Count); Assert.Contains(rows, row => row.PolicyId == data.Policies[0].Id); Assert.Contains(rows, row => row.PolicyId == data.Policies[8].Id);
        Assert.Equal(rows.Count, rows.Select(row => row.PolicyId).Distinct().Count());
    }

    [Fact]
    public async Task Every_selected_broker_includes_its_subcompanies_and_legacy_single_filters_still_work()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var data = Seed(db, current.TenantId!.Value);
        data.Companies[0].IsBroker = true; data.Companies[1].ParentCompanyId = data.Companies[0].Id;
        await db.SaveChangesAsync();
        var rows = await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, Empty with { InsuranceCompanyIds = [data.Companies[0].Id, data.Companies[2].Id] }, default);
        Assert.Equal(9, rows.Count);
        var single = Empty with { InsuranceCompanyId = data.Companies[1].Id, ProducerId = data.Producers[0].Id, Status = PolicyStatus.Active };
        Assert.Equal("POL-1-0", Assert.Single(await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, single, default)).PolicyNumber);
        Assert.Empty(await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, Empty with { InsuranceCompanyIds = [Guid.NewGuid()] }, default));
    }

    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    public async Task Exports_use_exactly_the_same_multi_selection_as_the_table(string format)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var data = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        var filters = Empty with { InsuranceCompanyIds = [data.Companies[0].Id, data.Companies[1].Id], ProducerIds = [data.Producers[0].Id, data.Producers[1].Id], GroupBy = "producer" };
        var table = await new GetProductionListHandler(db, current).Handle(new(filters), default);
        var file = await new ExportProductionListHandler(db, current).Handle(new(filters, format, "policyNumber,gross,net"), default);
        string text;
        if (format == "csv") text = Encoding.UTF8.GetString(file.Content);
        else { using var stream = new MemoryStream(file.Content); using var workbook = new XLWorkbook(stream); text = string.Join("|", workbook.Worksheets.First().CellsUsed().Select(cell => cell.GetString())); }
        foreach (var policy in data.Policies)
            if (table.Rows.Any(row => row.PolicyId == policy.Id)) Assert.Contains(policy.PolicyNumber, text);
            else Assert.DoesNotContain(policy.PolicyNumber, text);
    }

    [Fact]
    public async Task Multi_filters_keep_tenant_isolation_and_do_not_rewrite_policy_data()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var name = Guid.NewGuid().ToString(); using var db = TestScaffold.NewDb(current, TestScaffold.Clock, name);
        var data = Seed(db, current.TenantId!.Value); await db.SaveChangesAsync();
        using var foreign = TestScaffold.NewDb(TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock, name);
        Assert.Empty(await ProductionListBuilder.BuildRowsAsync(foreign, Guid.NewGuid(), Empty with { InsuranceCompanyIds = data.Companies.Select(company => company.Id).ToArray() }, default));
        await ProductionListBuilder.BuildRowsAsync(db, current.TenantId.Value, Empty with { CoverCodes = ["FIRE", "GLASS"] }, default);
        Assert.All(db.Policies, policy => { Assert.Equal(100, policy.Premium); Assert.Equal(80, policy.NetPremium); });
    }
}
