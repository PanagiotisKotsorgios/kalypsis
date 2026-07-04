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
    int BridgeRunsCreated,
    int EndorsementsCreated = 0,
    int CancellationsCreated = 0,
    int ClaimsCreated = 0,
    int ReceiptsCreated = 0,
    int PaymentsCreated = 0,
    int TasksCreated = 0,
    int AppointmentsCreated = 0,
    int NotificationsCreated = 0,
    int CommunicationsCreated = 0,
    int CommissionRulesCreated = 0,
    int CommissionRunsCreated = 0);

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
        var endorsementsCreated = 0;
        var cancellationsCreated = 0;
        var claimsCreated = 0;
        var receiptsCreated = 0;
        var paymentsCreated = 0;
        var tasksCreated = 0;
        var appointmentsCreated = 0;
        var notificationsCreated = 0;
        var communicationsCreated = 0;
        var commissionRulesCreated = 0;
        var commissionRunsCreated = 0;

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
            var policies = new List<Policy>(policyCount);
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
                var policy = new Policy
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
                };
                _db.Policies.Add(policy);
                policies.Add(policy);
                policiesCreated++;
            }

            // ── Extra data per policy — makes every sidebar section feel alive ──
            var activePolicies = policies.Where(p => p.Status == PolicyStatus.Active).ToList();

            // Endorsements (πρόσθετες πράξεις) — one per ~10 active policies
            var endorsementTypes = Enum.GetValues<EndorsementType>();
            var endorsementCount = size == "large" ? Math.Max(activePolicies.Count / 8, 6) : Math.Max(activePolicies.Count / 6, 2);
            for (int e = 0; e < endorsementCount && activePolicies.Count > 0; e++)
            {
                var p = activePolicies[rng.Next(activePolicies.Count)];
                var eff = p.StartDate.AddDays(rng.Next(30, 240));
                var pd = rng.Next(-50, 200);
                _db.PolicyEndorsements.Add(new PolicyEndorsement
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyId = p.Id,
                    EndorsementNumber = $"PP-{tenant.Code}-{2026}-{e + 1:D5}",
                    Type = endorsementTypes[rng.Next(endorsementTypes.Length)],
                    Status = e % 3 == 0 ? EndorsementStatus.Issued : EndorsementStatus.Draft,
                    IssuedAt = eff,
                    EffectiveFrom = eff,
                    Description = $"Πρόσθετη πράξη επί του συμβολαίου {p.PolicyNumber}.",
                    CarrierReference = $"C-REF-{rng.Next(1000, 9999)}",
                    PremiumDelta = pd,
                    CommissionDelta = decimal.Round(pd * 0.15m, 2),
                    Currency = "EUR",
                    CreatedByUserId = adminUser.Id,
                    CreatedAt = now.AddDays(-rng.Next(1, 90))
                });
                endorsementsCreated++;
            }

            // Cancellations (ακυρώσεις)
            var cancellationCount = size == "large" ? 5 : 1;
            for (int cIx = 0; cIx < cancellationCount && policies.Count > 0; cIx++)
            {
                var p = policies[rng.Next(policies.Count)];
                var refund = decimal.Round(p.Premium * 0.35m, 2);
                _db.PolicyCancellations.Add(new PolicyCancellation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyId = p.Id,
                    CancellationNumber = $"AK-{tenant.Code}-{2026}-{cIx + 1:D5}",
                    Status = cIx == 0 ? PolicyCancellationStatus.Effective : PolicyCancellationStatus.Submitted,
                    ReasonText = "Αίτημα πελάτη — μετακόμιση στο εξωτερικό.",
                    RequestedAt = DateOnly.FromDateTime(now.AddDays(-rng.Next(5, 120))),
                    EffectiveFrom = DateOnly.FromDateTime(now.AddDays(-rng.Next(1, 30))),
                    RefundMethod = "ProRata",
                    RefundAmount = refund,
                    PenaltyAmount = decimal.Round(p.Premium * 0.05m, 2),
                    CommissionClawback = decimal.Round(refund * 0.15m, 2),
                    Currency = "EUR",
                    CreatedByUserId = adminUser.Id,
                    CreatedAt = now
                });
                cancellationsCreated++;
            }

            // Claims (ζημιές)
            var claimStatuses = new[] { ClaimStatus.Reported, ClaimStatus.UnderReview, ClaimStatus.Approved, ClaimStatus.Paid, ClaimStatus.Closed };
            var claimCount = size == "large" ? 18 : 4;
            for (int cl = 0; cl < claimCount && activePolicies.Count > 0; cl++)
            {
                var p = activePolicies[rng.Next(activePolicies.Count)];
                var incident = p.StartDate.AddDays(rng.Next(1, 300));
                var claimed = rng.Next(300, 4500);
                var status = claimStatuses[rng.Next(claimStatuses.Length)];
                _db.Claims.Add(new Claim
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyId = p.Id,
                    ClaimNumber = $"CL-{tenant.Code}-{2026}-{cl + 1:D5}",
                    IncidentDate = incident,
                    ReportedDate = incident.AddDays(rng.Next(1, 10)),
                    Status = status,
                    ClaimedAmount = claimed,
                    ApprovedAmount = status == ClaimStatus.Approved || status == ClaimStatus.Paid
                        ? claimed * (0.75m + (decimal)rng.NextDouble() * 0.25m) : null,
                    Description = "Ατύχημα κατά τη μεταφορά — υλικές ζημιές.",
                    AffectsBonusMalus = rng.Next(0, 2) == 0,
                    LiabilityPercent = rng.Next(0, 101),
                    IsFriendlySettlement = rng.Next(0, 3) == 0,
                    CreatedAt = now.AddDays(-rng.Next(1, 180))
                });
                claimsCreated++;
            }

            // Receipts — 1 per active policy on average
            var receiptCount = size == "large" ? activePolicies.Count : (int)(activePolicies.Count * 0.7);
            for (int rc = 0; rc < receiptCount && activePolicies.Count > 0; rc++)
            {
                var p = activePolicies[rng.Next(activePolicies.Count)];
                _db.Receipts.Add(new Receipt
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Number = $"R-{tenant.Code}-{rc + 1:D5}",
                    ReceivedOn = DateOnly.FromDateTime(now.AddDays(-rng.Next(1, 180))),
                    CustomerId = p.CustomerId,
                    PolicyId = p.Id,
                    Method = (PaymentMethod)(rng.Next(1, 5)),
                    Amount = decimal.Round(p.Premium * (0.5m + (decimal)rng.NextDouble() * 0.5m), 2),
                    Currency = "EUR",
                    Notes = rc % 4 == 0 ? "Μερική πληρωμή" : null,
                    TransactionReference = $"TX-{rng.Next(100000, 999999)}",
                    CreatedAt = now
                });
                receiptsCreated++;
            }

            // Payments — a few to carriers per tenant
            var paymentCount = size == "large" ? 12 : 4;
            for (int pm = 0; pm < paymentCount && carriers.Count > 0; pm++)
            {
                var carrier = carriers[rng.Next(carriers.Count)];
                var amount = rng.Next(500, 5000);
                _db.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Number = $"P-{tenant.Code}-{pm + 1:D5}",
                    PaidOn = DateOnly.FromDateTime(now.AddDays(-rng.Next(5, 120))),
                    BeneficiaryType = BeneficiaryType.InsuranceCompany,
                    BeneficiaryInsuranceCompanyId = carrier.Id,
                    Method = PaymentMethod.BankTransfer,
                    Amount = amount,
                    CommissionsNetted = decimal.Round(amount * 0.15m, 2),
                    Currency = "EUR",
                    TransactionReference = $"BANK-{rng.Next(10000000, 99999999)}",
                    CreatedAt = now
                });
                paymentsCreated++;
            }

            // Tasks — assorted per tenant
            var taskCount = size == "large" ? 15 : 5;
            var taskTitles = new[] {
                "Ανανέωση συμβολαίου", "Επικοινωνία με πελάτη", "Παράδοση εγγράφου",
                "Έλεγχος ζημιάς", "Ενημέρωση παραμετρικών", "Αποστολή προσφοράς",
                "Follow-up μετά από ραντεβού", "Οικονομική εκκαθάριση"
            };
            for (int ts = 0; ts < taskCount; ts++)
            {
                var due = now.AddDays(rng.Next(-30, 60));
                _db.AgencyTasks.Add(new AgencyTask
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Title = taskTitles[rng.Next(taskTitles.Length)],
                    Description = "Εργασία που δημιουργήθηκε αυτόματα κατά το reseed.",
                    Status = due < now ? AgencyTaskStatus.Open : AgencyTaskStatus.Open,
                    Priority = (AgencyTaskPriority)(rng.Next(1, 4)),
                    AssignedToUserId = rng.Next(0, 2) == 0 ? adminUser.Id : staffUser.Id,
                    CustomerId = customers.Count > 0 ? customers[rng.Next(customers.Count)].Id : null,
                    DueAt = due,
                    CreatedAt = now
                });
                tasksCreated++;
            }

            // Appointments — a few upcoming
            var apptCount = size == "large" ? 8 : 3;
            for (int a = 0; a < apptCount && customers.Count > 0; a++)
            {
                var starts = now.AddDays(rng.Next(1, 30)).AddHours(rng.Next(9, 17));
                var customer = customers[rng.Next(customers.Count)];
                _db.Appointments.Add(new Appointment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Title = $"Ραντεβού με {(customer.Type == CustomerType.Individual ? $"{customer.FirstName} {customer.LastName}" : customer.CompanyName)}",
                    Description = "Συζήτηση για ανανέωση/πρόταση νέων καλύψεων.",
                    Location = "Γραφείο",
                    StartsAt = starts,
                    EndsAt = starts.AddHours(1),
                    Status = AppointmentStatus.Scheduled,
                    CustomerId = customer.Id,
                    CreatedAt = now
                });
                appointmentsCreated++;
            }

            // Communications — call/email log per some customers
            var commKinds = Enum.GetValues<CommunicationKind>();
            var commCount = size == "large" ? 20 : 6;
            for (int cm = 0; cm < commCount && customers.Count > 0; cm++)
            {
                var customer = customers[rng.Next(customers.Count)];
                _db.CommunicationLogs.Add(new CommunicationLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    CustomerId = customer.Id,
                    Kind = commKinds[rng.Next(commKinds.Length)],
                    Direction = (CommunicationDirection)rng.Next(0, 3),
                    Outcome = (CommunicationOutcome)rng.Next(0, 4),
                    OccurredAt = now.AddDays(-rng.Next(1, 180)).AddHours(rng.Next(9, 18)),
                    Subject = "Ενημέρωση για την κατάσταση συμβολαίου",
                    Body = "Συνομιλία με τον πελάτη σχετικά με την ανανέωση του συμβολαίου.",
                    CreatedAt = now
                });
                communicationsCreated++;
            }

            // Notifications — a few unread items for the admin
            var notifCount = size == "large" ? 12 : 5;
            var notifCategories = new[] { "renewal-due", "renewal-overdue", "producer-snapshot", "system", "claim-update" };
            for (int nt = 0; nt < notifCount; nt++)
            {
                var category = notifCategories[rng.Next(notifCategories.Length)];
                _db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    UserId = adminUser.Id,
                    Title = category switch
                    {
                        "renewal-due" => "Επερχόμενη ανανέωση συμβολαίου",
                        "renewal-overdue" => "Καθυστερημένη ανανέωση",
                        "producer-snapshot" => "Μηνιαία σύνοψη παραγωγής",
                        "claim-update" => "Ενημέρωση ζημιάς",
                        _ => "Ενημέρωση συστήματος"
                    },
                    Body = "Δείτε τις λεπτομέρειες στο σχετικό συμβόλαιο.",
                    Category = category,
                    Link = "/app",
                    CreatedAt = now.AddDays(-rng.Next(1, 30))
                });
                notificationsCreated++;
            }

            // Commission rules — one flat rule per policy type
            var policyTypes = new[] { PolicyType.Auto, PolicyType.Home, PolicyType.Health, PolicyType.Life, PolicyType.Business };
            foreach (var pt in policyTypes)
            {
                _db.CommissionRules.Add(new CommissionRule
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyType = pt,
                    CommissionType = CommissionType.Percentage,
                    Value = pt == PolicyType.Auto ? 12m : pt == PolicyType.Home ? 15m : 10m,
                    AgencyPercent = pt == PolicyType.Auto ? 12m : pt == PolicyType.Home ? 15m : 10m,
                    ProducerPercent = pt == PolicyType.Auto ? 8m : pt == PolicyType.Home ? 10m : 7m,
                    EffectiveFrom = DateOnly.FromDateTime(new DateTime(2026, 1, 1)),
                    CreatedAt = now
                });
                commissionRulesCreated++;
            }

            // Commission runs — one for last month
            var lastMonth = now.AddMonths(-1);
            var run2 = new CommissionRun
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Title = $"Εκκαθάριση {lastMonth:MM/yyyy}",
                Year = lastMonth.Year,
                Month = lastMonth.Month,
                Status = CommissionRunStatus.Finalised,
                Currency = "EUR",
                GeneratedAt = lastMonth.AddDays(5),
                FinalisedAt = lastMonth.AddDays(10),
                GeneratedByUserId = adminUser.Id,
                TotalPremium = rng.Next(15000, 60000),
                TotalCommission = rng.Next(2000, 8000),
                LineCount = rng.Next(20, 80),
                CreatedAt = now
            };
            _db.CommissionRuns.Add(run2);
            commissionRunsCreated++;

            // Bridge run history — 6 runs per tenant (was 3). Larger variety
            // of success + warning + intentional-error scenarios so every
            // troubleshooting path has real data behind it:
            //   Run 0 (Success) — all rows matched to existing policies.
            //   Run 1 (Warnings) — few unmatched premiums (small drift).
            //   Run 2 (Failed) — ~30% γραμμές χωρίς πρωτασφαλιστήριο (unlinked).
            //   Run 3 (Success) — smaller monthly increment.
            //   Run 4 (Warnings) — 3 rows with mismatched producer, needs manual review.
            //   Run 5 (Failed) — corrupt sheet, most rows rejected.
            var bridgeScenarios = new[]
            {
                ("Completed", 100, 5, 0, (string?)null,
                    "Ολοκληρώθηκε επιτυχώς — όλα τα ασφαλιστήρια ενημερώθηκαν."),
                ("Completed", 80, 20, 2,
                    "Προειδοποιήσεις: 2 γραμμές με μικρή απόκλιση ασφαλίστρου.",
                    "Ολοκληρώθηκε με προειδοποιήσεις — ελέγξτε τις γραμμές με μικρή απόκλιση."),
                ("Failed", 40, 15, 20,
                    "Πολλές γραμμές χωρίς αντίστοιχο πρωτασφαλιστήριο — πρέπει να αντιστοιχιστούν χειροκίνητα από τη σελίδα «Γέφυρες».",
                    "Απέτυχε: ~30% γραμμών δεν έχουν πρωτασφαλιστήριο. Χειροκίνητη διαλογή απαιτείται."),
                ("Completed", 60, 8, 0, null, "Μηνιαία ενημέρωση — μικρότερος όγκος γραμμών."),
                ("Completed", 45, 12, 3,
                    "Προειδοποιήσεις: 3 γραμμές με διαφορετικό συνεργάτη από τον καταχωρημένο.",
                    "Ολοκληρώθηκε με προειδοποιήσεις — 3 γραμμές δείχνουν διαφορετικό συνεργάτη."),
                ("Failed", 15, 5, 40,
                    "Το αρχείο περιέχει κατεστραμμένες γραμμές. Ελέγξτε την πηγή και ανεβάστε ξανά.",
                    "Απέτυχε: το αρχείο είναι κατεστραμμένο. Επικοινωνήστε με την εταιρία για νέο export.")
            };
            for (int b = 0; b < bridgeScenarios.Length; b++)
            {
                var carrier = carriers[rng.Next(carriers.Count)];
                var bridge = new CompanyBridge
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Name = $"{carrier.Name} import #{b + 1}",
                    InsuranceCompanyId = carrier.Id,
                    Kind = CompanyBridgeKind.Manual,
                    IsActive = true,
                    AutoSync = false,
                    CreatedAt = now
                };
                _db.CompanyBridges.Add(bridge);
                var (status, created, skipped, failed, errorMsg, _) = bridgeScenarios[b];
                var run = new CompanyBridgeRun
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    BridgeId = bridge.Id,
                    SourceFile = $"{carrier.Code}-{now.AddDays(-b * 20):yyyyMM}.xlsx",
                    StartedAt = now.AddDays(-b * 20),
                    CompletedAt = now.AddDays(-b * 20).AddMinutes(rng.Next(1, 5)),
                    Status = status,
                    RowsTotal = created + skipped + failed,
                    RowsCreated = created,
                    RowsSkipped = skipped,
                    RowsFailed = failed,
                    ErrorMessage = errorMsg,
                    CreatedAt = now.AddDays(-b * 20)
                };
                _db.CompanyBridgeRuns.Add(run);
                bridgeRunsCreated++;
            }
        }
        await _db.SaveChangesAsync(ct);

        return new WipeAndReseedDemoResult(
            usersDeleted, tenantsDeleted, tenantsCreated, usersCreated,
            customersCreated, producersCreated, policiesCreated, bridgeRunsCreated,
            endorsementsCreated, cancellationsCreated, claimsCreated,
            receiptsCreated, paymentsCreated,
            tasksCreated, appointmentsCreated, notificationsCreated,
            communicationsCreated, commissionRulesCreated, commissionRunsCreated);
    }
}
