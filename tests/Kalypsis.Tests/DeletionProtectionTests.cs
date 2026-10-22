using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public sealed class DeletionProtectionTests
{
    [Fact]
    public async Task Customer_without_history_is_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = NewCustomer(tenant, "C-EMPTY");
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        await new DeleteCustomerCommandHandler(db, current, clock)
            .Handle(new DeleteCustomerCommand(customer.Id), default);

        Assert.Equal(clock.UtcNow, customer.DeletedAt);
    }

    [Fact]
    public async Task Customer_with_history_returns_conflict_and_is_not_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = NewCustomer(tenant, "C-HISTORY");
        db.Customers.Add(customer);
        db.CommunicationLogs.Add(new CommunicationLog
        {
            Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customer.Id,
            Kind = CommunicationKind.Email, Direction = CommunicationDirection.Outbound,
            OccurredAt = clock.UtcNow, CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<AppException>(() =>
            new DeleteCustomerCommandHandler(db, current, clock)
                .Handle(new DeleteCustomerCommand(customer.Id), default));

        Assert.Equal(409, error.StatusCode);
        Assert.Equal("deletion_blocked_by_dependencies", error.Code);
        Assert.Contains("επικοινωνίες", error.Message);
        Assert.Null(customer.DeletedAt);
    }

    [Fact]
    public async Task Mixed_customer_selection_deletes_only_empty_records_and_preserves_policy_and_relationship_history()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var empty = NewCustomer(tenant, "C-EMPTY-SELECTED");
        var linked = NewCustomer(tenant, "C-POLICY-SELECTED");
        var family = NewCustomer(tenant, "C-FAMILY-SELECTED");
        var unselected = NewCustomer(tenant, "C-NOT-SELECTED");
        var policy = NewPolicy(tenant, linked.Id, null, clock.UtcNow);
        db.AddRange(empty, linked, family, unselected, policy);
        db.CustomerRelationships.Add(new CustomerRelationship
        {
            Id = Guid.NewGuid(), TenantId = tenant, CustomerId = unselected.Id,
            RelatedCustomerId = family.Id, RelationshipType = CustomerRelationshipType.Spouse, CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync();

        var handler = new DeleteCustomerCommandHandler(db, current, clock);
        await handler.Handle(new DeleteCustomerCommand(empty.Id), default);
        var policyError = await Assert.ThrowsAsync<AppException>(() => handler.Handle(new DeleteCustomerCommand(linked.Id), default));
        var familyError = await Assert.ThrowsAsync<AppException>(() => handler.Handle(new DeleteCustomerCommand(family.Id), default));

        Assert.Equal(clock.UtcNow, empty.DeletedAt);
        Assert.Equal(409, policyError.StatusCode);
        Assert.Contains("συμβόλαια", policyError.Message);
        Assert.Equal(409, familyError.StatusCode);
        Assert.Contains("οικογενειακές σχέσεις", familyError.Message);
        Assert.Null(linked.DeletedAt);
        Assert.Null(family.DeletedAt);
        Assert.Null(unselected.DeletedAt);
        Assert.Null(policy.DeletedAt);
        Assert.Equal(linked.Id, policy.CustomerId);
    }

    [Fact]
    public async Task Producer_with_policy_is_not_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = NewCustomer(tenant, "C-PRODUCER");
        var producer = new Producer { Id = Guid.NewGuid(), TenantId = tenant, Code = "P1", Name = "Partner", CreatedAt = clock.UtcNow };
        db.AddRange(customer, producer, NewPolicy(tenant, customer.Id, producer.Id, clock.UtcNow));
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<AppException>(() =>
            new DeleteProducerCommandHandler(db, current)
                .Handle(new DeleteProducerCommand(producer.Id), default));

        Assert.Equal(409, error.StatusCode);
        Assert.Contains("συμβόλαια", error.Message);
        Assert.Null(producer.DeletedAt);
    }

    [Fact]
    public async Task Policy_with_receipt_reports_blocker_and_is_not_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = NewCustomer(tenant, "C-POLICY");
        var policy = NewPolicy(tenant, customer.Id, null, clock.UtcNow);
        db.AddRange(customer, policy, new Receipt
        {
            Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customer.Id, PolicyId = policy.Id,
            Number = "R-1", ReceivedOn = DateOnly.FromDateTime(clock.UtcNow), Amount = 100,
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await new DeletePolicyHandler(db, current, clock)
            .Handle(new DeletePolicyCommand(policy.Id), default);

        Assert.False(result.Deleted);
        Assert.Contains(result.Blockers, x => x.Kind == "receipts");
        Assert.Null(policy.DeletedAt);
    }

    [Fact]
    public void Shared_guard_lists_every_dependency_in_one_actionable_conflict()
    {
        var error = Assert.Throws<AppException>(() => DeletionProtection.ThrowIfBlocked(
            "ασφαλιστικής εταιρείας «Demo»",
            [new("συμβόλαια", 2), new("παραγωγή", 4), new("κενές", 0)]));

        Assert.Equal(409, error.StatusCode);
        Assert.Contains("συμβόλαια: 2", error.Message);
        Assert.Contains("παραγωγή: 4", error.Message);
        Assert.DoesNotContain("κενές", error.Message);
    }

    [Fact]
    public async Task Insurance_company_with_production_is_not_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var customer = NewCustomer(tenant, "C-CARRIER");
        var company = new InsuranceCompany
        {
            Id = Guid.NewGuid(), TenantId = tenant, Code = "CARRIER", Name = "Carrier",
            IsActive = true, CreatedAt = clock.UtcNow
        };
        var policy = NewPolicy(tenant, customer.Id, null, clock.UtcNow);
        policy.InsuranceCompanyId = company.Id;
        db.AddRange(customer, company, policy);
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<AppException>(() =>
            CompanyController(db, current, clock).Delete(company.Id, default));

        Assert.Equal(409, error.StatusCode);
        Assert.Contains("συμβόλαια", error.Message);
        Assert.Null(company.DeletedAt);
    }

    [Fact]
    public async Task Empty_insurance_company_can_be_deleted()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current, clock);
        var company = new InsuranceCompany
        {
            Id = Guid.NewGuid(), TenantId = tenant, Code = "MISTAKE", Name = "Mistake",
            IsActive = true, CreatedAt = clock.UtcNow
        };
        db.InsuranceCompanies.Add(company);
        await db.SaveChangesAsync();

        var response = await CompanyController(db, current, clock).Delete(company.Id, default);

        Assert.IsType<NoContentResult>(response);
        Assert.Equal(clock.UtcNow, company.DeletedAt);
    }

    private static Customer NewCustomer(Guid tenant, string number) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, CustomerNumber = number,
        Type = CustomerType.Individual, FirstName = "Test", LastName = "User",
        CreatedAt = DateTime.UtcNow
    };

    private static Policy NewPolicy(Guid tenant, Guid customerId, Guid? producerId, DateTime now) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, CustomerId = customerId,
        InsuranceCompanyId = Guid.NewGuid(), ProducerId = producerId,
        PolicyNumber = $"POL-{Guid.NewGuid():N}", PolicyType = PolicyType.Auto,
        StartDate = DateOnly.FromDateTime(now), EndDate = DateOnly.FromDateTime(now.AddYears(1)),
        Premium = 100, CreatedAt = now
    };

    private static InsuranceCompaniesController CompanyController(
        Kalypsis.Infrastructure.Persistence.AppDbContext db, ICurrentUser current, IDateTimeProvider clock) =>
        new(new NoopMediator(), db, current, clock, new TestStorage(),
            new FileUploadGate(new SafeFiles(), new CleanAntivirus()));

    private sealed class TestStorage : IFileStorage
    {
        public Task<string> UploadAsync(string keyPrefix, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default) => Task.FromResult($"{keyPrefix}/{fileName}");
        public Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream());
        public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class SafeFiles : IFileSafetyService
    {
        public Task<FileSafetyResult> InspectAsync(string fileName, string? declaredContentType, Stream content, FileUploadKind kind, CancellationToken ct = default) => Task.FromResult(new FileSafetyResult(true, DetectedContentType: declaredContentType));
    }

    private sealed class CleanAntivirus : IAntivirusScanner
    {
        public bool IsEnabled => false;
        public Task<AntivirusScanResult> ScanAsync(Stream content, string fileName, CancellationToken ct = default) => Task.FromResult(AntivirusScanResult.AssumedClean);
    }

    private sealed class NoopMediator : IMediator
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default) => throw new InvalidOperationException();
        public Task<object?> Send(object request, CancellationToken ct = default) => throw new InvalidOperationException();
        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest => throw new InvalidOperationException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default) => throw new NotImplementedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Publish(object notification, CancellationToken ct = default) => Task.CompletedTask;
        public Task Publish<TNotification>(TNotification notification, CancellationToken ct = default) where TNotification : INotification => Task.CompletedTask;
    }
}
