using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

/// <summary>
/// PLATFORM-ADMIN ONLY. Wipes every tenant + user in the platform EXCEPT
/// the superadmin (identified by email) and the Kalypsis Platform tenant,
/// then re-seeds 5 fresh demo agencies with representative data — 2 large,
/// 3 small — plus sample producers, customers, policies, receipts, and
/// dummy bridge-run history for troubleshooting scenarios.
///
/// Universal (Kalypsis-managed) InsuranceCompanies are preserved so the
/// reseeded tenants can immediately start writing policies against ERGO /
/// Atlantic / Grand Cover / the rest without a re-import.
/// </summary>
public record WipeAndReseedDemoCommand(string SuperAdminEmail) : IRequest<WipeAndReseedDemoResult>;

public record WipeAndReseedDemoResult(
    int UsersDeleted,
    int TenantsDeleted,
    int TenantsCreated,
    int UsersCreated,
    int CustomersCreated,
    int ProducersCreated,
    int PoliciesCreated,
    int BridgeRunsCreated);

public class WipeAndReseedDemoCommandHandler
    : IRequestHandler<WipeAndReseedDemoCommand, WipeAndReseedDemoResult>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IDateTimeProvider _clock;

    public WipeAndReseedDemoCommandHandler(IAppDbContext db, IPasswordHasher hasher, IDateTimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _clock = clock;
    }

    public async Task<WipeAndReseedDemoResult> Handle(WipeAndReseedDemoCommand r, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var superEmail = r.SuperAdminEmail.Trim().ToLowerInvariant();

        // ── 1. Soft-delete every user and tenant that is NOT the superadmin
        //      or the Kalypsis Platform tenant. Universal carriers stay
        //      because they're TenantId = null; tenant-scoped policies /
        //      customers / receipts / etc. inherit the soft-delete via their
        //      tenant's cascade OR are marked deleted below explicitly.
        var keepTenantIds = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Code == "PLATFORM" || t.Name.StartsWith("Kalypsis"))
            .Select(t => t.Id).ToListAsync(ct);

        var otherTenantIds = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null && !keepTenantIds.Contains(t.Id))
            .Select(t => t.Id).ToListAsync(ct);

        int usersDeleted = 0;
        if (otherTenantIds.Count > 0)
        {
            var toDelete = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.DeletedAt == null && u.Email != superEmail
                            && otherTenantIds.Contains(u.TenantId))
                .ToListAsync(ct);
            foreach (var u in toDelete) { u.DeletedAt = now; u.IsActive = false; }
            usersDeleted = toDelete.Count;
        }

        int tenantsDeleted = 0;
        if (otherTenantIds.Count > 0)
        {
            var tenants = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => otherTenantIds.Contains(t.Id)).ToListAsync(ct);
            foreach (var t in tenants) { t.DeletedAt = now; t.IsActive = false; }
            tenantsDeleted = tenants.Count;
        }

        // Soft-delete tenant-scoped rows in bulk. We hit every table that
        // carries TenantId so the fresh seed doesn't collide on unique
        // (tenant, code) indexes.
        async Task WipeAsync<T>(IQueryable<T> q) where T : TenantEntity
        {
            var rows = await q.IgnoreQueryFilters()
                .Where(x => x.DeletedAt == null && otherTenantIds.Contains(x.TenantId))
                .ToListAsync(ct);
            foreach (var r in rows) r.DeletedAt = now;
        }
        if (otherTenantIds.Count > 0)
        {
            await WipeAsync(_db.Customers);
            await WipeAsync(_db.Producers);
            await WipeAsync(_db.Policies);
            await WipeAsync(_db.Receipts);
            await WipeAsync(_db.Payments);
            await WipeAsync(_db.Claims);
            await WipeAsync(_db.CommissionRules);
            await WipeAsync(_db.CommissionTransactions);
            await WipeAsync(_db.Notifications);
            await WipeAsync(_db.AgencyTasks);
            await WipeAsync(_db.CompanyBridges);
            await WipeAsync(_db.CompanyBridgeRuns);
        }
        await _db.SaveChangesAsync(ct);

        // ── 2. Prepare universal carrier lookup for the seeded policies.
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.TenantId == null && c.DeletedAt == null)
            .Take(20).ToListAsync(ct);

        // ── 3. Seed 5 tenants (2 large, 3 small) with representative data.
        var largeTenants = new[] { "Πρώτη Ασφαλιστική Α.Ε.", "Έξοδος Ασφαλειών" };
        var smallTenants = new[] { "Νέα Εποχή", "Alpha Insurance Consult", "Aegean Broker" };
        var tenantsCreated = 0;
        var usersCreated = 0;
        var customersCreated = 0;
        var producersCreated = 0;
        var policiesCreated = 0;
        var bridgeRunsCreated = 0;

        var rng = new Random(42);   // deterministic seeds keep testing predictable
        var pwd = _hasher.Hash("Passw0rd!");
        int tenantIndex = 0;
        foreach (var (name, size) in largeTenants.Select(n => (n, "large"))
                     .Concat(smallTenants.Select(n => (n, "small"))))
        {
            tenantIndex++;
            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = name,
                Code = $"DEMO{tenantIndex:00}",
                IsActive = true,
                DefaultCurrency = "EUR",
                DefaultPolicyDurationMonths = 12,
                CreatedAt = now,
                OnboardingCompletedAt = now
            };
            _db.Tenants.Add(tenant);
            tenantsCreated++;

            // Users: 1 admin + 1 staff per tenant.
            var adminUser = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Email = $"admin{tenantIndex}@kalypsis-demo.gr",
                PasswordHash = pwd,
                FirstName = "Admin",
                LastName = name.Split(' ')[0],
                Role = Role.AgencyAdmin,
                IsActive = true,
                CreatedAt = now
            };
            var staffUser = new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Email = $"staff{tenantIndex}@kalypsis-demo.gr",
                PasswordHash = pwd,
                FirstName = "Staff",
                LastName = name.Split(' ')[0],
                Role = Role.AgencyUser,
                IsActive = true,
                CreatedAt = now
            };
            _db.Users.AddRange(adminUser, staffUser);
            usersCreated += 2;

            // Producers: 5 for large tenants, 2 for small. Some shared names
            // (cross-tenant συνεργάτες) — matched by name in the report only.
            var producerCount = size == "large" ? 5 : 2;
            var producers = new List<Producer>();
            var sharedNames = new[] { "Γεώργιος Ιωάννου", "Μαρία Παπαδοπούλου", "Νίκος Δημητρίου" };
            for (int p = 1; p <= producerCount; p++)
            {
                var isShared = p <= 2 && (tenantIndex == 1 || tenantIndex == 3 || tenantIndex == 5);
                var producer = new Producer
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Code = $"PR{tenantIndex:00}{p:00}",
                    Name = isShared ? sharedNames[p - 1] : $"Συνεργάτης {tenantIndex}.{p}",
                    Email = $"producer{tenantIndex}.{p}@kalypsis-demo.gr",
                    Status = ProducerStatus.Active,
                    Tier = (ProducerTier)((p % 5) + 1),
                    CreatedAt = now
                };
                producers.Add(producer);
                _db.Producers.Add(producer);
                producersCreated++;
            }

            // Customers.
            var customerCount = size == "large" ? 40 : 12;
            var customers = new List<Customer>();
            var firstNames = new[] { "Γιώργος", "Ελένη", "Νίκος", "Μαρία", "Δημήτρης", "Άννα", "Χρήστος", "Σοφία" };
            var lastNames = new[] { "Παπαδόπουλος", "Ιωάννου", "Δημητρίου", "Νικολάου", "Παππάς", "Καραγιάννης" };
            for (int c = 1; c <= customerCount; c++)
            {
                var customer = new Customer
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    CustomerNumber = $"C{tenantIndex:00}-{c:0000}",
                    Type = c % 5 == 0 ? CustomerType.Company : CustomerType.Individual,
                    FirstName = c % 5 == 0 ? null : firstNames[rng.Next(firstNames.Length)],
                    LastName = c % 5 == 0 ? null : lastNames[rng.Next(lastNames.Length)],
                    CompanyName = c % 5 == 0 ? $"Επιχείρηση {tenantIndex}.{c} ΑΕ" : null,
                    Email = $"customer{tenantIndex}.{c}@example.com",
                    Phone = $"210{rng.Next(1000000, 9999999)}",
                    MobilePhone = $"69{rng.Next(10000000, 99999999)}",
                    VatNumber = rng.Next(100000000, 999999999).ToString(),
                    City = "Αθήνα",
                    CreatedAt = now.AddDays(-rng.Next(1, 400))
                };
                customers.Add(customer);
                _db.Customers.Add(customer);
                customersCreated++;
            }

            // Policies. Large tenants get ~2 policies per customer; small get 1.
            var policyCount = size == "large" ? customerCount * 2 : customerCount;
            for (int i = 0; i < policyCount; i++)
            {
                if (carriers.Count == 0) break;
                var customer = customers[rng.Next(customers.Count)];
                var producer = producers[rng.Next(producers.Count)];
                var carrier = carriers[rng.Next(carriers.Count)];
                var startOffset = rng.Next(-180, 300);
                var start = DateOnly.FromDateTime(_clock.UtcNow.AddDays(startOffset));
                var end = start.AddYears(1);
                var status = startOffset > 0 ? PolicyStatus.Draft
                    : (end < DateOnly.FromDateTime(_clock.UtcNow) ? PolicyStatus.Expired : PolicyStatus.Active);
                var type = (PolicyType)((i % 6) + 1);
                _db.Policies.Add(new Policy
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyNumber = $"DEMO-{tenant.Code}-{type.ToString().ToUpper()[..3]}-{i + 1:D4}",
                    CustomerId = customer.Id,
                    InsuranceCompanyId = carrier.Id,
                    ProducerId = producer.Id,
                    PolicyType = type,
                    Status = status,
                    StartDate = start,
                    EndDate = end,
                    Premium = rng.Next(150, 1800),
                    Currency = "EUR",
                    CreatedAt = now,
                    CreatedByUserId = adminUser.Id
                });
                policiesCreated++;
            }

            // Bridge run history — 3 runs per tenant with mixed statuses so
            // the operator has data for both success and troubleshooting
            // paths. Some flag their linked policies as bridge-matched,
            // others as unlinked (for the «missing πρωτασφαλιστήριο»
            // troubleshooting flow).
            for (int b = 0; b < 3; b++)
            {
                var carrier = carriers[rng.Next(carriers.Count)];
                var bridge = new CompanyBridge
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Name = $"{carrier.Name} import",
                    InsuranceCompanyId = carrier.Id,
                    Kind = CompanyBridgeKind.Manual,
                    IsActive = true,
                    AutoSync = false,
                    CreatedAt = now
                };
                _db.CompanyBridges.Add(bridge);
                var run = new CompanyBridgeRun
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    BridgeId = bridge.Id,
                    SourceFile = $"{carrier.Code}-{now.AddDays(-b * 30):yyyyMM}.xlsx",
                    StartedAt = now.AddDays(-b * 30),
                    CompletedAt = now.AddDays(-b * 30).AddMinutes(2),
                    Status = b == 0 ? "Completed" : b == 1 ? "Completed" : "Failed",
                    RowsTotal = rng.Next(50, 500),
                    RowsCreated = rng.Next(5, 30),
                    RowsSkipped = rng.Next(0, 10),
                    RowsFailed = b == 2 ? rng.Next(10, 30) : 0,
                    ErrorMessage = b == 2
                        ? "Πολλές γραμμές χωρίς αντίστοιχο πρωτασφαλιστήριο — για troubleshooting scenario."
                        : null,
                    CreatedAt = now.AddDays(-b * 30)
                };
                _db.CompanyBridgeRuns.Add(run);
                bridgeRunsCreated++;
            }
        }
        await _db.SaveChangesAsync(ct);

        return new WipeAndReseedDemoResult(
            usersDeleted, tenantsDeleted, tenantsCreated, usersCreated,
            customersCreated, producersCreated, policiesCreated, bridgeRunsCreated);
    }
}
