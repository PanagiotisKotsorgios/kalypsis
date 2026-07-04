using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
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
    private (int usersDeleted, int tenantsDeleted) _wipeCounts;

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

        // Raw SQL wipe — routed through IAppDbContext.ExecuteRawSqlAsync so
        // this Application-layer handler doesn't need EF.Relational. Hard
        // delete with FK checks off. Soft-delete alone kept leaving the
        // rows in place and half the UI queries IgnoreQueryFilters so the
        // «wiped» users kept showing up in the AllUsers table.

        // ── 1. Identify what to KEEP: the superadmin user and any tenant
        //      that hosts them. Everything else — every other user, tenant,
        //      customer, policy, etc. — gets HARD-deleted below.
        var superAdminUserId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Email == superEmail)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync(ct);
        if (superAdminUserId is null)
            throw new InvalidOperationException(
                $"Ο superadmin με email {superEmail} δεν βρέθηκε. Αδυναμία εκκαθάρισης.");

        var superAdminTenantId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == superAdminUserId.Value)
            .Select(u => u.TenantId).FirstAsync(ct);

        // Which tables carry a TenantId column — all these get wiped fully.
        // Order irrelevant since FK checks are disabled during the delete.
        var tenantScopedTables = new[]
        {
            "customers", "customer_contacts", "customer_family_relationships",
            "customer_insurance_needs", "producers", "producer_commission_declarations",
            "policies", "policy_documents", "policy_covers", "policy_objects",
            "policy_installments", "policy_endorsements", "policy_cancellations",
            "policy_cover_adjustments", "receipts", "payments", "financial_movements",
            "securities", "bank_connections", "claims", "claim_victims",
            "settlement_payments", "friendly_settlements",
            "commission_rules", "commission_transactions", "commission_runs",
            "commission_run_lines", "over_commission_rules",
            "notifications", "communications", "consents",
            "agency_tasks", "appointments", "appointment_participants",
            "company_bridges", "bridge_runs", "company_bridge_runs",
            "insurance_companies", // wipe TENANT-scoped ones; keep universal below
            "company_parameter_items",
            "tariffs", "cover_notes", "credit_notes", "marketing_campaigns",
            "newsletter_subscribers", "email_templates", "email_deliveries",
            "documents", "editable_documents", "document_templates",
            "document_numbering_rules", "info_center_exports", "contact_export_logs",
            "reconciliation_links", "advance_payments",
            "tachy_payment_batches", "tachy_payment_lines",
            "sap_bridge_mappings", "period_locks", "default_value_rules",
            "custom_field_definitions", "custom_field_values",
            "movement_types", "bonus_malus_rules", "renewal_rules",
            "register_templates", "callerid_logs", "usae_submissions",
            "vehicle_models", "third_party_api_keys", "integration_settings",
            "audit_logs", "service_requests", "service_request_attachments",
            "workflow_rules", "workflow_rule_actions",
            "policy_applications", "pending_items", "quote_offers",
            "delivery_notes", "dias_codes",
            "production_goals", "saved_reports", "tenant_carrier_optins",
            "tenant_package_grants", "tenant_invoices", "tenant_invoice_lines",
            "branches", "agency_offices",
        };

        int rowsDeleted = 0;
        // FK checks off for the wipe. If a table doesn't exist (older schema)
        // the DELETE fails silently but doesn't stop the batch — we catch and
        // continue so a partial schema doesn't jam the whole operation.
        await _db.ExecuteRawSqlAsync("SET FOREIGN_KEY_CHECKS = 0;", ct);
        try
        {
            foreach (var table in tenantScopedTables)
            {
                try
                {
                    string sql;
                    if (table == "insurance_companies")
                    {
                        // Universal carriers (TenantId IS NULL) stay so the
                        // reseeded tenants can immediately write policies.
                        sql = $"DELETE FROM `{table}` WHERE `TenantId` IS NOT NULL";
                    }
                    else
                    {
                        sql = $"DELETE FROM `{table}`";
                    }
                    var count = await _db.ExecuteRawSqlAsync(sql, ct);
                    rowsDeleted += count;
                }
                catch { /* table missing / column missing → skip */ }
            }

            // Users — keep ONLY the superadmin. Everything else, including
            // any platform-level (TenantId = 00000000-…) client accounts, goes.
            var usersDeletedCount = await _db.ExecuteRawSqlAsync(
                "DELETE FROM `users` WHERE `Email` <> {0}", ct, superEmail);

            // Refresh tokens for those users are usually FK-cascaded, but be
            // explicit in case the constraint was defined without cascade.
            await _db.ExecuteRawSqlAsync(
                "DELETE FROM `refresh_tokens` WHERE `UserId` NOT IN (SELECT `Id` FROM `users`)", ct);
            try
            {
                await _db.ExecuteRawSqlAsync(
                    "DELETE FROM `two_factor_recovery_codes` WHERE `UserId` NOT IN (SELECT `Id` FROM `users`)", ct);
                await _db.ExecuteRawSqlAsync(
                    "DELETE FROM `password_reset_tokens` WHERE `UserId` NOT IN (SELECT `Id` FROM `users`)", ct);
            }
            catch { }

            // Tenants — keep only the one hosting superadmin (if any).
            int tenantsDeletedCount;
            if (superAdminTenantId != Guid.Empty)
            {
                tenantsDeletedCount = await _db.ExecuteRawSqlAsync(
                    "DELETE FROM `tenants` WHERE `Id` <> {0}", ct, superAdminTenantId);
            }
            else
            {
                tenantsDeletedCount = await _db.ExecuteRawSqlAsync(
                    "DELETE FROM `tenants`", ct);
            }

            // Stash the counts on the closure so the seed step below can echo
            // them in the response.
            _wipeCounts = (usersDeletedCount, tenantsDeletedCount);
        }
        finally
        {
            await _db.ExecuteRawSqlAsync("SET FOREIGN_KEY_CHECKS = 1;", ct);
        }

        // EF cache is now out of sync with the DB — clear tracked entities
        // so the seed step below doesn't try to reference deleted rows.
        _db.ClearChangeTracker();

        int usersDeleted = _wipeCounts.usersDeleted;
        int tenantsDeleted = _wipeCounts.tenantsDeleted;

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
