using Kalypsis.Api.Controllers.Phase3;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using System.Text.Json;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Carriers;
using Kalypsis.Infrastructure.Commissions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Kalypsis.Tests;

public sealed class Phase3CompletionTests
{
    [Fact]
    public async Task Carrier_issue_is_idempotent_and_binds_policy()
    {
        var tenant = Guid.NewGuid(); var user = Guid.NewGuid(); var customerId = Guid.NewGuid(); var carrierId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant, user);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = customerId, TenantId = tenant, CustomerNumber = "C-1", FirstName = "Demo", LastName = "Client", Type = CustomerType.Individual };
        var carrier = new InsuranceCompany { Id = carrierId, Code = "DEMO", Name = "Demo Carrier" };
        var quote = new Quote { Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customerId, Customer = customer, QuoteNumber = "Q-1", ProductType = "Auto", RiskInputsJson = "{}", Status = QuoteStatus.Quoted };
        var offer = new QuoteOffer { Id = Guid.NewGuid(), TenantId = tenant, QuoteId = quote.Id, Quote = quote, CarrierCode = "DEMO", Premium = 120m, Currency = "EUR", CarrierProductCode = "DEMO-AUTO" };
        quote.Offers.Add(offer);
        db.Customers.Add(customer); db.InsuranceCompanies.Add(carrier); db.Quotes.Add(quote); await db.SaveChangesAsync();
        var controller = new CarrierOperationsController(db, new CarrierAdapterRegistry(new[] { new StubCarrierAdapter("DEMO", "Demo", new[] { "Auto" }) }), current, new TestStorage(), TestScaffold.Clock);

        var first = Assert.IsType<OkObjectResult>((await controller.Issue(new CarrierOperationsController.IssueBody(quote.Id, offer.Id, new DateOnly(2026, 9, 1), new DateOnly(2027, 9, 1), null), default)).Result);
        var firstDto = Assert.IsType<CarrierOperationsController.LifecycleResult>(first.Value);
        var second = Assert.IsType<OkObjectResult>((await controller.Issue(new CarrierOperationsController.IssueBody(quote.Id, offer.Id, new DateOnly(2026, 9, 1), new DateOnly(2027, 9, 1), null), default)).Result);
        var secondDto = Assert.IsType<CarrierOperationsController.LifecycleResult>(second.Value);

        Assert.Equal("Issued", firstDto.Status); Assert.Equal(firstDto.PolicyId, secondDto.PolicyId);
        Assert.Equal(1, db.Policies.Count()); Assert.Equal(1, db.PolicyApplications.Count());
        var cancelled = await controller.Cancel(firstDto.PolicyId!.Value, new CarrierOperationsController.CancelBody(new DateOnly(2026, 10, 1), "Αίτημα πελάτη"), default);
        Assert.IsType<OkObjectResult>(cancelled.Result); Assert.Equal(PolicyStatus.Cancelled, db.Policies.Single().Status); Assert.Single(db.PolicyCancellations);
    }

    [Fact]
    public async Task Quote_fanout_honours_explicit_carrier_enablement()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.CarrierConnections.Add(new CarrierConnection { Id = Guid.NewGuid(), TenantId = tenant, CarrierCode = "DEMO", Status = CarrierAdapterStatus.Disabled }); await db.SaveChangesAsync();
        var controller = new Kalypsis.Api.Controllers.Phase3.QuotesController(new CarrierAdapterRegistry(new[] { new StubCarrierAdapter("DEMO", "Demo", new[] { "Auto" }) }), db, TestScaffold.Clock, current);
        var disabled = Assert.IsType<OkObjectResult>((await controller.Create(new Kalypsis.Api.Controllers.Phase3.QuotesController.CreateQuoteBody("Auto", "{}", null, null), default)).Result);
        Assert.Empty(Assert.IsType<Kalypsis.Api.Controllers.Phase3.QuotesController.QuoteResponse>(disabled.Value).Offers);
        db.CarrierConnections.Single().Status = CarrierAdapterStatus.Enabled; await db.SaveChangesAsync();
        var enabled = Assert.IsType<OkObjectResult>((await controller.Create(new Kalypsis.Api.Controllers.Phase3.QuotesController.CreateQuoteBody("Auto", "{}", null, null), default)).Result);
        Assert.Single(Assert.IsType<Kalypsis.Api.Controllers.Phase3.QuotesController.QuoteResponse>(enabled.Value).Offers);
    }

    [Fact]
    public async Task MyData_create_calculates_totals_and_submit_is_persisted()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var client = new FakeMyDataClient();
        var controller = new MyDataInvoiceController(db, client, current);
        var body = new MyDataInvoiceController.CreateInvoiceBody("100", "A", new DateOnly(2026, 8, 26), null, "", "Demo", "1.1", new[]
        {
            new MyDataInvoiceController.InvoiceLineBody("Υπηρεσία", 2, 10, 24, null)
        });
        var created = Assert.IsType<OkObjectResult>((await controller.Create(body, default)).Result);
        var dto = Assert.IsType<MyDataInvoiceController.InvoiceDto>(created.Value);
        Assert.Equal(20m, dto.NetAmount); Assert.Equal(4.8m, dto.VatAmount); Assert.Equal(24.8m, dto.GrossAmount);
        var submitted = Assert.IsType<OkObjectResult>((await controller.Submit(dto.Id, default)).Result);
        var submittedDto = Assert.IsType<MyDataInvoiceController.InvoiceDto>(submitted.Value);
        Assert.Equal(MyDataInvoiceStatus.Accepted, submittedDto.Status); Assert.Equal("MARK-1", submittedDto.Mark);
        Assert.Equal(MyDataInvoiceStatus.Accepted, db.MyDataInvoices.Single().Status);
    }

    [Fact]
    public async Task Installment_payment_tracks_partial_and_final_payment()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var installment = new Installment { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = Guid.NewGuid(), SequenceNumber = 1, DueDate = new DateOnly(2026, 9, 1), Amount = 100m };
        db.Installments.Add(installment); await db.SaveChangesAsync();
        var controller = new BillingCompletionController(db, current);
        var partial = Assert.IsType<OkObjectResult>((await controller.AddPayment(installment.Id, new BillingCompletionController.PaymentBody(40m, new DateOnly(2026, 9, 2), "Card", "p1"), default)).Result);
        Assert.NotNull(partial.Value); Assert.Equal(40m, db.Installments.Single().PaidAmount);
        await controller.AddPayment(installment.Id, new BillingCompletionController.PaymentBody(60m, new DateOnly(2026, 9, 3), "Card", "p2"), default);
        Assert.Equal(InstallmentStatus.Paid, db.Installments.Single().Status); Assert.Equal(2, db.InstallmentPayments.Count());
    }

    [Fact]
    public async Task Hierarchy_rejects_cycles_and_exposes_created_link()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var parent = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Name = "Manager", Code = "M" };
        var child = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Name = "Agent", Code = "A" };
        db.Producers.AddRange(parent, child); await db.SaveChangesAsync();
        var controller = new ProducerHierarchyController(db, current);
        var created = await controller.Create(new ProducerHierarchyController.LinkBody(child.Id, parent.Id, "Manager", new DateOnly(2026, 8, 26), null), default);
        Assert.IsType<OkObjectResult>(created.Result);
        var ex = await Assert.ThrowsAsync<AppException>(() => controller.Create(new ProducerHierarchyController.LinkBody(parent.Id, child.Id, "Manager", new DateOnly(2026, 8, 26), null), default));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task Commission_split_and_clawback_are_recorded()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant); using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = "C-1", Type = CustomerType.Individual };
        var carrier = new InsuranceCompany { Id = Guid.NewGuid(), Code = "DEMO", Name = "Demo" };
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "P-1", CustomerId = customer.Id, Customer = customer, InsuranceCompanyId = carrier.Id, InsuranceCompany = carrier, PolicyType = PolicyType.Auto, Status = PolicyStatus.Active };
        db.Customers.Add(customer); db.InsuranceCompanies.Add(carrier); db.Policies.Add(policy); await db.SaveChangesAsync();
        var controller = new CommissionOperationsController(db, new CommissionSplitter(db, TestScaffold.Clock), current);
        var result = Assert.IsType<OkObjectResult>((await controller.Split(new CommissionOperationsController.SplitBody(policy.Id, 100m, "EUR"), default)).Result);
        Assert.NotNull(result.Value); Assert.Equal(3, db.CommissionSplits.Count());
        var clawback = await controller.Clawback(policy.Id, new CommissionOperationsController.ClawbackBody(25m), default);
        Assert.IsType<OkObjectResult>(clawback);
        Assert.Equal(6, db.CommissionSplits.Count()); Assert.Equal(-25m, db.CommissionSplits.Where(x => x.IsClawback).Sum(x => x.Amount));
    }

    [Fact]
    public async Task Workflow_engine_creates_task_and_tags_customer()
    {
        var tenant = Guid.NewGuid(); var user = Guid.NewGuid(); var customerId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant, user); var clock = TestScaffold.Clock; var database = Guid.NewGuid().ToString("N");
        var services = new ServiceCollection();
        services.AddSingleton<ICurrentUser>(current); services.AddSingleton<IDateTimeProvider>(clock);
        services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(database));
        services.AddLogging(); services.AddHttpClient(); services.AddScoped<IWorkflowEngine, Kalypsis.Infrastructure.Workflows.WorkflowEngine>();
        using var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        db.Customers.Add(new Customer { Id = customerId, TenantId = tenant, CustomerNumber = "C-1", FirstName = "Demo", Type = CustomerType.Individual });
        var rule = new WorkflowRule { Id = Guid.NewGuid(), TenantId = tenant, Name = "Birthday", TriggerEvent = WorkflowEvent.CustomerBirthday, IsActive = true };
        rule.Actions.Add(new WorkflowRuleAction { Id = Guid.NewGuid(), TenantId = tenant, RuleId = rule.Id, Action = WorkflowAction.CreateTask, Order = 1, PayloadJson = "{\"title\":\"Επικοινωνία πελάτη\",\"priority\":\"High\"}" });
        rule.Actions.Add(new WorkflowRuleAction { Id = Guid.NewGuid(), TenantId = tenant, RuleId = rule.Id, Action = WorkflowAction.TagCustomer, Order = 2, PayloadJson = "{\"tag\":\"Γενέθλια\"}" });
        db.WorkflowRules.Add(rule); await db.SaveChangesAsync();
        await provider.GetRequiredService<IWorkflowEngine>().FireAsync(new WorkflowFireRequest(WorkflowEvent.CustomerBirthday, new Dictionary<string, object?> { ["tenantId"] = tenant, ["userId"] = user, ["customerId"] = customerId, ["entityRef"] = $"Customer:{customerId}" }), default);
        db.ChangeTracker.Clear();
        Assert.Equal(new[] { "Γενέθλια" }, JsonSerializer.Deserialize<string[]>(db.Customers.Single().TagsJson!));
        Assert.Equal("Επικοινωνία πελάτη", db.AgencyTasks.Single().Title); Assert.Equal(AgencyTaskPriority.High, db.AgencyTasks.Single().Priority);
        Assert.True(db.WorkflowExecutions.Single().Success);
    }

    private sealed class FakeMyDataClient : IMyDataClient
    {
        public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(true);
        public Task<MyDataSubmitResult> SubmitInvoiceAsync(MyDataSubmitRequest request, CancellationToken ct = default) => Task.FromResult(new MyDataSubmitResult(true, "MARK-1", "UID-1", null));
        public Task<MyDataSubmitResult> CancelInvoiceAsync(string mark, CancellationToken ct = default) => Task.FromResult(new MyDataSubmitResult(true, "CANCEL-1", "UID-1", null));
    }

    private sealed class TestStorage : IFileStorage
    {
        public Task<string> UploadAsync(string keyPrefix, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default) => Task.FromResult($"{keyPrefix}/{fileName}");
        public Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream());
        public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
