using System.Text.RegularExpressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MySqlConnector;
using Xunit;

namespace Kalypsis.Tests;

public sealed class CustomerCreationNumberTests
{
    [Fact]
    public async Task Creation_uses_highest_number_including_deleted_and_other_offices_without_reading_other_tenants()
    {
        var current = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
        var storage = Guid.NewGuid().ToString("N");
        await using (var seed = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock, storage))
        {
            seed.Customers.AddRange(
                Customer(current, "C-000001"),
                Customer(current, "C-000003", deleted: true),
                Customer(new OfficeUser(current.TenantId, Guid.NewGuid()), "C-000042"),
                Customer(current, "DEMO-999999"),
                Customer(current, "C-imported"),
                Customer(new OfficeUser(Guid.NewGuid(), Guid.NewGuid()), "C-999999"));
            await seed.SaveChangesAsync();
        }
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, storage);

        var first = await Handler(db, current).Handle(new(Request()), default);
        var second = await Handler(db, current).Handle(new(Request() with { Status = CustomerStatus.Prospect }), default);

        Assert.Equal("C-000043", first.Customer.CustomerNumber);
        Assert.Equal("C-000044", second.Customer.CustomerNumber);
        Assert.Equal(CustomerStatus.Prospect, second.Customer.Status);
        Assert.Null(first.PortalEmail);
        Assert.Equal(current.AgencyOfficeId, (await db.Customers.SingleAsync(c => c.Id == first.Customer.Id)).AgencyOfficeScopeId);
        Assert.Equal(8, await db.Customers.IgnoreQueryFilters().CountAsync());
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task First_customer_starts_at_one_and_numbers_continue_above_six_digits()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var first = await Handler(db, current).Handle(new(Request()), default);
        Assert.Equal("C-000001", first.Customer.CustomerNumber);
        db.Customers.Add(new Customer { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value,
            CustomerNumber = "C-999999", FirstName = "Existing" });
        await db.SaveChangesAsync();
        Assert.Equal("C-1000000", (await Handler(db, current).Handle(new(Request()), default)).Customer.CustomerNumber);
    }

    [MySqlSchemaFact]
    public async Task Real_MySQL_reproduces_old_duplicate_then_creates_after_deletion_and_retries_a_concurrent_number()
    {
        TestScaffold.EnsureEncryptorBooted();
        var builder = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("KALYPSIS_TEST_MYSQL")!)
            { Database = "", Pooling = false };
        await using var admin = new MySqlConnection(builder.ConnectionString);
        await admin.OpenAsync();
        var database = "kalypsis_customer_numbers_" + Guid.NewGuid().ToString("N");
        await using var create = admin.CreateCommand();
        create.CommandText = $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4";
        await create.ExecuteNonQueryAsync();
        try
        {
            builder.Database = database;
            var current = new OfficeUser(Guid.NewGuid(), Guid.NewGuid());
            DbContextOptions<AppDbContext> Options(SaveChangesInterceptor? interceptor = null)
            {
                var options = new DbContextOptionsBuilder<AppDbContext>().UseMySql(builder.ConnectionString,
                    new MySqlServerVersion(new Version(8, 0, 36)));
                if (interceptor is not null) options.AddInterceptors(interceptor);
                return options.Options;
            }
            await using (var schema = new AppDbContext(Options(), TestScaffold.PlatformAdmin(), TestScaffold.Clock))
            {
                // Only these two tables are needed. Preserve real mapped columns
                // and the production unique index; omit unrelated external FKs.
                var script = schema.Database.GenerateCreateScript();
                foreach (var table in new[] { "customers", "audit_logs" })
                {
                    var statement = Regex.Match(script, $@"CREATE TABLE `{table}` \([\s\S]*?;").Value;
                    Assert.NotEmpty(statement);
                    statement = Regex.Replace(statement, @",\s*CONSTRAINT [^\r\n]* FOREIGN KEY[^\r\n]*", "");
                    await schema.Database.ExecuteSqlRawAsync(statement);
                }
                await schema.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX `IX_customers_TenantId_CustomerNumber` ON `customers` (`TenantId`, `CustomerNumber`)");
                schema.Customers.AddRange(Customer(current, "C-000002"), Customer(current, "C-000003", deleted: true),
                    Customer(new OfficeUser(current.TenantId, Guid.NewGuid()), "C-000004"));
                await schema.SaveChangesAsync();
            }
            await using (var db = new AppDbContext(Options(), current, TestScaffold.Clock))
            {
                // Old implementation: one visible customer -> C-000002, already taken.
                var oldCandidate = "C-" + (await db.Customers.CountAsync() + 1).ToString("D6");
                Assert.Equal("C-000002", oldCandidate);
                db.Customers.Add(Customer(current, oldCandidate));
                var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
                Assert.Equal(1062, Assert.IsType<MySqlException>(error.InnerException).Number);
                db.ChangeTracker.Clear();

                var created = await Handler(db, current).Handle(new(Request()), default);
                Assert.Equal("C-000005", created.Customer.CustomerNumber);
                Assert.Equal(4, await db.Customers.IgnoreQueryFilters().CountAsync());
            }
            // Both requests reach SaveChanges with the same candidate. MySQL's
            // actual unique index rejects one and the handler retries that row.
            var barrier = new TwoCreationsBarrier();
            await using var left = new AppDbContext(Options(barrier), current, TestScaffold.Clock);
            await using var right = new AppDbContext(Options(barrier), current, TestScaffold.Clock);
            var results = await Task.WhenAll(Handler(left, current).Handle(new(Request()), default),
                Handler(right, current).Handle(new(Request()), default));
            Assert.Equal(new[] { "C-000006", "C-000007" }, results.Select(r => r.Customer.CustomerNumber).Order().ToArray());
            Assert.Equal(6, await left.Customers.IgnoreQueryFilters().CountAsync());
            Assert.Equal(2, await left.AuditLogs.CountAsync(a => a.EntityName == nameof(Customer)
                && a.Action == "Create" && (a.EntityId == results[0].Customer.Id.ToString() || a.EntityId == results[1].Customer.Id.ToString())));
        }
        finally
        {
            // Never touch application databases: this random database is test-owned.
            await using var drop = admin.CreateCommand();
            drop.CommandText = $"DROP DATABASE `{database}`";
            await drop.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Unrelated_database_errors_are_not_retried_or_disguised_as_number_conflicts()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        var interceptor = new FailingSave();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(interceptor).Options;
        TestScaffold.EnsureEncryptorBooted();
        await using var db = new AppDbContext(options, current, TestScaffold.Clock);
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() => Handler(db, current).Handle(new(Request()), default));
        Assert.Same(interceptor.Error, exception);
        Assert.Equal(1, interceptor.Attempts);
        Assert.Empty(await db.Customers.IgnoreQueryFilters().ToListAsync());
    }

    private sealed class TwoCreationsBarrier : SaveChangesInterceptor
    {
        private int _arrivals;
        private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<Customer>().Any(e => e.State == EntityState.Added))
            {
                var arrival = Interlocked.Increment(ref _arrivals);
                if (arrival == 2) _ready.TrySetResult();
                if (arrival <= 2) await _ready.Task.WaitAsync(TimeSpan.FromSeconds(20), ct);
            }
            return result;
        }
    }
    private sealed class FailingSave : SaveChangesInterceptor
    {
        public readonly DbUpdateException Error = new("unrelated failure");
        public int Attempts;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken ct = default)
        {
            Attempts++;
            throw Error;
        }
    }
    private sealed record OfficeUser(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId => null;
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyAdmin;
        public string? Email => null;
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }
    private static Customer Customer(OfficeUser current, string number, bool deleted = false) => new()
    {
        Id = Guid.NewGuid(), TenantId = current.TenantId!.Value, AgencyOfficeScopeId = current.AgencyOfficeId,
        CustomerNumber = number, Type = CustomerType.Individual, FirstName = "Test", LastName = "Customer",
        DeletedAt = deleted ? TestScaffold.Clock.UtcNow : null
    };
    private static CreateCustomerRequest Request() => new(CustomerType.Individual, "Νέος", "Πελάτης",
        null, null, null, null, null, null, null, null, null, false);
    private static CreateCustomerCommandHandler Handler(AppDbContext db, ICurrentUser current) => new(db, current, new Hasher(), new Packages());
    private sealed class Hasher : IPasswordHasher
    {
        public string Hash(string value) => "test-only";
        public bool Verify(string value, string hash) => false;
    }
    private sealed class Packages : IPackageService
    {
        public Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default) => Task.FromResult(true);
        public Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task GrantAllDefaultsAsync(Guid tenantId, Guid? enabledByUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public void InvalidateCache(Guid tenantId) { }
    }
}
