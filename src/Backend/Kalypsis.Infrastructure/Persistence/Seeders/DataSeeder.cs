using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DataSeeder");

        await db.Database.MigrateAsync(cancellationToken);

        // Schema safety net: some migrations in this project ship without a
        // Designer.cs companion, and earlier deploys may have missed them. To
        // guarantee the columns / tables the running code references actually
        // exist, run a tiny set of idempotent ALTER/CREATE statements directly
        // through information_schema. This is belt-and-braces alongside the
        // EF migration; if EF already added everything, these are no-ops.
        try { await EnsureSchemaSafetyAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "EnsureSchemaSafetyAsync failed — continuing boot."); }

        // NOTE on insurance-company seeding: we deliberately do NOT seed the
        // old list of demo carriers (Allianz/ERGO/NN/Generali/...) anymore.
        // Every carrier in the system must have real παραμετρικά (branches,
        // uses, coverages, packages) for its dropdowns to be usable. Today
        // only Grand Cover (IW) ships with a seed dump; future carriers come
        // in via the platform-admin bulk importer (POST /api/platform/
        // company-parameters/import/{insuranceCompanyId}). See
        // CompanyParameterImportController.
        // Order matters: cleanup FIRST (so any leftover duplicates get
        // collapsed onto one canonical broker), then seeder (which finds the
        // canonical broker, refills missing subs, resurrects soft-deleted
        // subs, ensures their ParentCompanyId points at the canonical row),
        // then cleanup AGAIN (sweeps anything new the seeder might have
        // left dangling — usually a no-op).
        try { await CleanupNonGrandCoverGlobalsAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "CleanupNonGrandCoverGlobalsAsync (pre-seed) failed — continuing boot."); }

        try { await GrandCoverSeeder.SeedAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "GrandCoverSeeder failed — continuing boot without IW seed."); }

        try { await CleanupNonGrandCoverGlobalsAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "CleanupNonGrandCoverGlobalsAsync (post-seed) failed — continuing boot."); }

        // Runs *after* cleanup so the ATLANTIC global carrier row it needs
        // is guaranteed to exist. Seeds the official παραμετρικά extracted
        // from the ΠΑΡΑΜΕΤΡΙΚΑ.zip pack: 20 κλάδοι + 104 χρήσεις + 2648
        // καλύψεις attached to ATLANTIC.
        try { await AtlanticSeeder.SeedAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "AtlanticSeeder failed — continuing boot without Atlantic παραμετρικά."); }

        // Same idea for ERGO: seeds branches + ~450 coverage codes extracted
        // from ERGO's «Κωδικοποίηση και περιγραφή» PDF, keyed off the ERGO
        // global carrier row.
        try { await ErgoSeeder.SeedAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "ErgoSeeder failed — continuing boot without ERGO παραμετρικά."); }

        var seedEmail = (config["Seed:PlatformAdminEmail"] ?? "superadmin@kalypsis.gr").ToLowerInvariant();
        var seedPassword = config["Seed:PlatformAdminPassword"] ?? "Kalypsis@2026!";
        var seedFirstName = config["Seed:PlatformAdminFirstName"] ?? "Super";
        var seedLastName = config["Seed:PlatformAdminLastName"] ?? "Admin";

        var platformTenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Code == "PLATFORM", cancellationToken);
        if (platformTenant is null)
        {
            platformTenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Kalypsis Platform",
                Code = "PLATFORM",
                IsActive = true,
                SubscriptionPlan = SubscriptionPlan.Enterprise,
                LogoUrl = "/static/kalypsis-logo.jpg",
                BrandColorHex = "#0B2545",
                ContactEmail = "info@mykalypsis.gr",
                ContactPhone = "+30 210 600 0000",
                AddressLine = "Λ. Κηφισίας 268, 152 32 Χαλάνδρι, Αθήνα"
            };
            db.Tenants.Add(platformTenant);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded platform tenant.");
        }
        else if (string.IsNullOrEmpty(platformTenant.LogoUrl) ||
                 (platformTenant.LogoUrl?.StartsWith("https://kalypsis.gr") ?? false))
        {
            // Backfill branding on the existing platform tenant so the mobile app has something to show.
            platformTenant.LogoUrl = "/static/kalypsis-logo.jpg";
            platformTenant.BrandColorHex = "#0B2545";
            platformTenant.ContactEmail = "info@mykalypsis.gr";
            platformTenant.ContactPhone = "+30 210 600 0000";
            platformTenant.AddressLine = "Λ. Κηφισίας 268, 152 32 Χαλάνδρι, Αθήνα";
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Backfilled platform tenant branding.");
        }

        var adminExists = await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Role == Role.PlatformAdmin, cancellationToken);
        if (!adminExists)
        {
            var admin = new User
            {
                Id = Guid.NewGuid(),
                TenantId = platformTenant.Id,
                Email = seedEmail,
                PasswordHash = hasher.Hash(seedPassword),
                FirstName = seedFirstName,
                LastName = seedLastName,
                Role = Role.PlatformAdmin,
                IsActive = true,
                PreferredLanguage = "el"
            };
            db.Users.Add(admin);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded platform admin {Email}.", seedEmail);
        }
        else
        {
            logger.LogInformation("Platform admin already exists; skipping admin seed.");
        }

        await SeedTestCustomerAsync(db, hasher, platformTenant.Id, logger, cancellationToken);

        await BackfillPackageGrantsAsync(db, logger, cancellationToken);
    }

    /// <summary>
    /// Phase 5 backfill — every tenant that exists when the package layer goes
    /// live gets all five packages enabled by default. The superadmin can then
    /// disable individual packages per tenant from <c>/app/tenants/{id}</c>.
    /// New tenants created after this point also get all five via the tenant
    /// creation flow (handled in <c>TenantsController.Create</c>).
    /// Idempotent — only inserts grants that are missing.
    /// </summary>
    private static async Task BackfillPackageGrantsAsync(
        AppDbContext db, ILogger logger, CancellationToken cancellationToken)
    {
        var tenants = await db.Tenants.IgnoreQueryFilters().Select(t => t.Id).ToListAsync(cancellationToken);
        var all = Enum.GetValues<PackageCode>();
        // We include soft-deleted rows because the (TenantId, Package) unique
        // index in MySQL is NOT filtered — re-inserting would violate it.
        var existing = await db.TenantPackageGrants.IgnoreQueryFilters()
            .Select(g => new { g.TenantId, g.Package })
            .ToListAsync(cancellationToken);
        var existingSet = existing.Select(e => (e.TenantId, e.Package)).ToHashSet();

        var inserted = 0;
        foreach (var tenantId in tenants)
        {
            foreach (var pkg in all)
            {
                if (existingSet.Contains((tenantId, pkg))) continue;
                db.TenantPackageGrants.Add(new TenantPackageGrant
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Package = pkg,
                    EnabledAt = DateTime.UtcNow,
                    Notes = "Backfill — Phase 5 rollout"
                });
                inserted++;
            }
        }
        if (inserted > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Backfilled {Count} package grants across {Tenants} tenants.", inserted, tenants.Count);
        }
    }

    /// <summary>
    /// Seeds a Customer entity + matching User (Role.Customer) on the platform tenant
    /// so the mobile client-portal app has a known account to log in with during development.
    /// Idempotent — skips if the user already exists.
    /// </summary>
    private static async Task SeedTestCustomerAsync(
        AppDbContext db,
        IPasswordHasher hasher,
        Guid platformTenantId,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        const string email = "client@example.com";
        const string password = "Kalypsis@2026!";
        const string customerNumber = "CLIENT-DEMO";

        var existingUser = await db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.Email == email, cancellationToken);
        if (existingUser)
        {
            logger.LogInformation("Test customer user already exists; skipping.");
            return;
        }

        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == platformTenantId && c.CustomerNumber == customerNumber, cancellationToken);
        if (customer is null)
        {
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                TenantId = platformTenantId,
                CustomerNumber = customerNumber,
                Type = CustomerType.Individual,
                FirstName = "Δημήτρης",
                LastName = "Παπαδόπουλος",
                Email = email,
                Phone = "+30 6900000000",
                City = "Αθήνα"
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded test customer record {Number}.", customerNumber);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = platformTenantId,
            Email = email,
            PasswordHash = hasher.Hash(password),
            FirstName = customer.FirstName ?? "Demo",
            LastName = customer.LastName ?? "Client",
            Role = Role.Customer,
            CustomerId = customer.Id,
            IsActive = true,
            PreferredLanguage = "el"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Seeded test customer user {Email} (password: {Password}).", email, password);
    }

    /// <summary>
    /// Nuclear, raw-SQL cleanup. Runs on every boot, fully idempotent.
    /// EF change-tracking is bypassed so this works even if any row has a
    /// stale FK or a soft-delete state the model wouldn't normally read.
    ///
    ///   1. Force the Grand Cover broker row back to (DeletedAt=NULL, IsActive=1).
    ///   2. Force every direct child of the broker back to (DeletedAt=NULL, IsActive=1).
    ///   3. Soft-delete EVERY other InsuranceCompany row across the entire DB
    ///      (global + every tenant). The platform is single-broker for now.
    ///   4. Soft-delete every CompanyParameterItem with Source LIKE 'Kalypsis defaults%'.
    /// </summary>
    public static async Task CleanupNonGrandCoverGlobalsAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        // (0) Force-mark every row with Code='GRAND_COVER' OR IsBroker=1 as a
        // global, active broker — so we don't lose any of them yet.
        var pinned = await db.Database.ExecuteSqlRawAsync(@"
            UPDATE `insurance_companies`
            SET `DeletedAt` = NULL, `IsActive` = 1, `IsBroker` = 1, `TenantId` = NULL, `ParentCompanyId` = NULL
            WHERE `Code` = 'GRAND_COVER' OR `IsBroker` = 1", ct);
        logger.LogInformation("Cleanup: pinned {Count} broker candidate row(s).", pinned);

        // (1) Pick ONE canonical broker. Prefer the row with the most existing
        // direct subs; tie-break by oldest CreatedAt then smallest Id. This
        // beats picking randomly because the canonical row is the one that
        // already has the IW subcompanies attached.
        var canonicalBrokerId = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.IsBroker && c.ParentCompanyId == null && c.DeletedAt == null)
            .Select(c => new {
                c.Id,
                c.CreatedAt,
                SubCount = db.InsuranceCompanies.IgnoreQueryFilters()
                    .Count(s => s.ParentCompanyId == c.Id && s.DeletedAt == null)
            })
            .OrderByDescending(x => x.SubCount)
            .ThenBy(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(ct);

        if (canonicalBrokerId is null)
        {
            logger.LogWarning("Cleanup: no broker found, GrandCoverSeeder probably failed.");
            return;
        }
        var canonical = canonicalBrokerId.Value;
        logger.LogInformation("Cleanup: canonical broker id = {Id}", canonical);

        // (2) Re-parent every sub of *any* broker row to the canonical broker.
        // This catches duplicate brokers whose subs would otherwise orphan.
        var reparented = await db.Database.ExecuteSqlRawAsync($@"
            UPDATE `insurance_companies`
            SET `ParentCompanyId` = '{canonical}'
            WHERE `ParentCompanyId` IS NOT NULL
              AND `ParentCompanyId` <> '{canonical}'
              AND `ParentCompanyId` IN (
                SELECT `Id` FROM (
                    SELECT `Id` FROM `insurance_companies` WHERE `IsBroker` = 1
                ) AS b
              )", ct);
        logger.LogInformation("Cleanup: reparented {Count} sub-rows to canonical broker.", reparented);

        // (3) Force-undelete subs of the canonical broker.
        var subsResurrected = await db.Database.ExecuteSqlRawAsync($@"
            UPDATE `insurance_companies`
            SET `DeletedAt` = NULL, `IsActive` = 1
            WHERE `ParentCompanyId` = '{canonical}'", ct);
        logger.LogInformation("Cleanup: resurrected {Count} broker-sub row(s).", subsResurrected);

        // (4) Soft-delete every row that isn't the canonical broker, one of
        // its subs, or a *whitelisted standalone carrier we ship a bridge
        // parser for*. This kills the demo carriers and duplicate Grand
        // Cover broker copies while keeping ERGO alive alongside GC.
        var carrierWhitelistCsv = "'ERGO','ATLANTIC'"; // extend when a new bridge lands
        var deletedCarriers = await db.Database.ExecuteSqlRawAsync($@"
            UPDATE `insurance_companies`
            SET `DeletedAt` = UTC_TIMESTAMP(6), `IsActive` = 0
            WHERE `DeletedAt` IS NULL
              AND `Id` <> '{canonical}'
              AND (`ParentCompanyId` IS NULL OR `ParentCompanyId` <> '{canonical}')
              AND `Code` NOT IN ({carrierWhitelistCsv})", ct);
        logger.LogInformation("Cleanup: soft-deleted {Count} non-canonical carrier row(s) across all tenants.", deletedCarriers);

        // (4.5) Dedupe + normalise every whitelisted standalone carrier code.
        //
        // For each Code in the whitelist we pick ONE canonical row (oldest
        // CreatedAt, tie-broken by smallest Id — same rule the broker uses),
        // force it to (DeletedAt=NULL, IsActive=1, TenantId=NULL, ParentCompanyId=NULL,
        // IsBroker=0), then soft-delete every other row with the same Code
        // and re-route their CompanyParameterItems to the canonical row.
        // This is idempotent — running twice yields the same single row.
        var whitelistedCodes = new[] { "ERGO", "ATLANTIC" };
        foreach (var wcode in whitelistedCodes)
        {
            var canonicalWlId = await db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.Code == wcode)
                .OrderBy(c => c.CreatedAt)
                .ThenBy(c => c.Id)
                .Select(c => (Guid?)c.Id)
                .FirstOrDefaultAsync(ct);

            if (canonicalWlId is null)
            {
                // No row exists at all — seed a fresh one.
                var displayName = wcode switch
                {
                    "ERGO"     => "ERGO Hellas",
                    "ATLANTIC" => "Ατλαντική Ένωση",
                    _          => wcode
                };
                db.InsuranceCompanies.Add(new InsuranceCompany
                {
                    Id = Guid.NewGuid(),
                    TenantId = null,
                    Name = displayName,
                    Code = wcode,
                    Country = "GR",
                    IsActive = true,
                    IsBroker = false,
                    ParentCompanyId = null
                });
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Cleanup: seeded {Code} global carrier row.", wcode);
                continue;
            }

            var canonicalWl = canonicalWlId.Value;

            // Promote the canonical row to a clean global carrier.
            var promoted = await db.Database.ExecuteSqlRawAsync($@"
                UPDATE `insurance_companies`
                SET `DeletedAt` = NULL, `IsActive` = 1, `TenantId` = NULL,
                    `ParentCompanyId` = NULL, `IsBroker` = 0
                WHERE `Id` = '{canonicalWl}'", ct);
            logger.LogInformation("Cleanup: promoted canonical {Code} row {Id} ({Rows} row(s) updated).",
                wcode, canonicalWl, promoted);

            // Re-route CompanyParameterItem rows attached to any DUPLICATE
            // row of this code to the canonical row before we delete the
            // duplicates.
            var paramsMoved = await db.Database.ExecuteSqlRawAsync($@"
                UPDATE `company_parameter_items`
                SET `InsuranceCompanyId` = '{canonicalWl}'
                WHERE `DeletedAt` IS NULL
                  AND `InsuranceCompanyId` IN (
                    SELECT `Id` FROM (
                        SELECT `Id` FROM `insurance_companies`
                        WHERE `Code` = '{wcode}' AND `Id` <> '{canonicalWl}'
                    ) AS d
                  )", ct);
            if (paramsMoved > 0)
                logger.LogInformation("Cleanup: moved {Count} param row(s) from duplicate {Code} rows to canonical.",
                    paramsMoved, wcode);

            // Soft-delete every OTHER row with this Code (any tenant, any state).
            var dupesRemoved = await db.Database.ExecuteSqlRawAsync($@"
                UPDATE `insurance_companies`
                SET `DeletedAt` = UTC_TIMESTAMP(6), `IsActive` = 0
                WHERE `Code` = '{wcode}' AND `Id` <> '{canonicalWl}' AND `DeletedAt` IS NULL", ct);
            if (dupesRemoved > 0)
                logger.LogInformation("Cleanup: soft-deleted {Count} duplicate {Code} row(s).",
                    dupesRemoved, wcode);
        }

        // (5) Re-route any CompanyParameterItem rows that were attached to a
        // duplicate broker. Without this their data would be invisible
        // because the carrier they point to is now soft-deleted.
        var paramsRouted = await db.Database.ExecuteSqlRawAsync($@"
            UPDATE `company_parameter_items`
            SET `InsuranceCompanyId` = '{canonical}'
            WHERE `DeletedAt` IS NULL
              AND `InsuranceCompanyId` IN (
                SELECT `Id` FROM (
                    SELECT `Id` FROM `insurance_companies`
                    WHERE `IsBroker` = 1 AND `Id` <> '{canonical}' AND `DeletedAt` IS NOT NULL
                ) AS d
              )", ct);
        logger.LogInformation("Cleanup: re-routed {Count} parametric row(s) from duplicate brokers.", paramsRouted);

        // (4) Soft-delete polluting Kalypsis defaults rows everywhere.
        var deletedParams = await db.Database.ExecuteSqlRawAsync(@"
            UPDATE `company_parameter_items`
            SET `DeletedAt` = UTC_TIMESTAMP(6), `IsActive` = 0
            WHERE `DeletedAt` IS NULL
              AND (`Source` = 'Kalypsis defaults' OR `Source` LIKE 'Kalypsis defaults%')", ct);
        logger.LogInformation("Cleanup: soft-deleted {Count} «Kalypsis defaults» παραμετρικά row(s).", deletedParams);
    }

    /// <summary>
    /// Idempotent schema safety net. For every column the running code requires
    /// but an earlier deploy may have missed (because of a Designer-less
    /// migration EF couldn't discover), check INFORMATION_SCHEMA and ALTER the
    /// table if necessary. Same for missing tables. This is BELT-AND-BRACES on
    /// top of MigrateAsync — when migrations work, every check below is a no-op.
    /// </summary>
    private static async Task EnsureSchemaSafetyAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync(ct);
        var dbName = conn.Database;

        // --- insurance_companies.IsBroker / ParentCompanyId ----------------
        await EnsureColumnAsync(db, logger, dbName,
            table: "insurance_companies", column: "IsBroker",
            addSql: "ALTER TABLE `insurance_companies` ADD COLUMN `IsBroker` tinyint(1) NOT NULL DEFAULT 0", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "insurance_companies", column: "ParentCompanyId",
            addSql: "ALTER TABLE `insurance_companies` ADD COLUMN `ParentCompanyId` char(36) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "insurance_companies", column: "ExcludedBranchCodesJson",
            addSql: "ALTER TABLE `insurance_companies` ADD COLUMN `ExcludedBranchCodesJson` longtext NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "insurance_companies", indexName: "IX_insurance_companies_ParentCompanyId",
            addSql: "CREATE INDEX `IX_insurance_companies_ParentCompanyId` ON `insurance_companies` (`ParentCompanyId`)", ct);

        // --- TenantPackageGrants.PremiumFeaturesJson -----------------------
        await EnsureColumnAsync(db, logger, dbName,
            table: "TenantPackageGrants", column: "PremiumFeaturesJson",
            addSql: "ALTER TABLE `TenantPackageGrants` ADD COLUMN `PremiumFeaturesJson` longtext NULL", ct);

        // --- policies.PaymentCollectionMethod (τρόπος είσπραξης) ----------
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "PaymentCollectionMethod",
            addSql: "ALTER TABLE `policies` ADD COLUMN `PaymentCollectionMethod` varchar(64) NULL", ct);

        // platform_settings: email-code login toggle
        await EnsureColumnAsync(db, logger, dbName,
            table: "platform_settings", column: "RequireEmailLoginCode",
            addSql: "ALTER TABLE `platform_settings` ADD COLUMN `RequireEmailLoginCode` tinyint(1) NOT NULL DEFAULT 0", ct);

        // users: email-code 2FA columns
        await EnsureColumnAsync(db, logger, dbName,
            table: "users", column: "PendingLoginCodeHash",
            addSql: "ALTER TABLE `users` ADD COLUMN `PendingLoginCodeHash` varchar(200) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "users", column: "PendingLoginCodeExpiresAt",
            addSql: "ALTER TABLE `users` ADD COLUMN `PendingLoginCodeExpiresAt` datetime(6) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "users", column: "PendingLoginCodeAttempts",
            addSql: "ALTER TABLE `users` ADD COLUMN `PendingLoginCodeAttempts` int NOT NULL DEFAULT 0", ct);

        // email_templates: policy-trigger + SMS body columns
        await EnsureColumnAsync(db, logger, dbName,
            table: "email_templates", column: "PolicyTrigger",
            addSql: "ALTER TABLE `email_templates` ADD COLUMN `PolicyTrigger` varchar(40) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "email_templates", column: "SmsBody",
            addSql: "ALTER TABLE `email_templates` ADD COLUMN `SmsBody` varchar(1000) NULL", ct);

        // policies: VAT / tax breakdown columns (Καθαρό, ΦΠΑ, χαρτόσημο, etc.)
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "NetPremium",
            addSql: "ALTER TABLE `policies` ADD COLUMN `NetPremium` decimal(14,2) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "VatAmount",
            addSql: "ALTER TABLE `policies` ADD COLUMN `VatAmount` decimal(14,2) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "StampDutyAmount",
            addSql: "ALTER TABLE `policies` ADD COLUMN `StampDutyAmount` decimal(14,2) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "InsuranceContributionAmount",
            addSql: "ALTER TABLE `policies` ADD COLUMN `InsuranceContributionAmount` decimal(14,2) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "OtherChargesAmount",
            addSql: "ALTER TABLE `policies` ADD COLUMN `OtherChargesAmount` decimal(14,2) NULL", ct);

        // --- receipts / payments: TransactionReference + payments.PolicyId ---
        // Ship 2026-07-02. Belt-and-braces so the /api/insurance-companies and
        // financials endpoints keep working even when the paired EF migration
        // was skipped for whatever reason (partial deploy, aborted boot).
        await EnsureColumnAsync(db, logger, dbName,
            table: "receipts", column: "TransactionReference",
            addSql: "ALTER TABLE `receipts` ADD COLUMN `TransactionReference` varchar(80) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "payments", column: "TransactionReference",
            addSql: "ALTER TABLE `payments` ADD COLUMN `TransactionReference` varchar(80) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "payments", column: "PolicyId",
            addSql: "ALTER TABLE `payments` ADD COLUMN `PolicyId` char(36) NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "payments", indexName: "IX_payments_PolicyId",
            addSql: "CREATE INDEX `IX_payments_PolicyId` ON `payments` (`PolicyId`)", ct);

        // --- producer_commission_declarations table ---------------------
        // Producer reconciliation: producer-side self-reported expected
        // commissions with diff vs recorded runs. Missing table would make
        // /api/producer-reconciliation return 500 for every agency.
        await EnsureTableAsync(db, logger, dbName,
            table: "producer_commission_declarations",
            createSql: @"CREATE TABLE IF NOT EXISTS `producer_commission_declarations` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ProducerId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `ExpectedAmount` decimal(14,2) NOT NULL,
                `ExpectedPercent` decimal(7,2) NULL,
                `Currency` varchar(3) NOT NULL,
                `Notes` varchar(1000) NULL,
                `DeclaredAt` datetime(6) NOT NULL,
                `RecordedAmount` decimal(14,2) NULL,
                `DifferenceAmount` decimal(14,2) NULL,
                `ReconciliationStatus` varchar(40) NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_producer_commission_declarations_TenantId` (`TenantId`),
                KEY `IX_producer_commission_declarations_ProducerId` (`ProducerId`),
                KEY `IX_producer_commission_declarations_PolicyId` (`PolicyId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- tenant_carrier_optins table ---------------------------------
        // Per-tenant opt-in against the universal carrier catalog. Referenced
        // by /api/insurance-companies on every page load — if it's missing
        // EVERY tenant sees an empty catalog. Highest-priority safety net.
        await EnsureTableAsync(db, logger, dbName,
            table: "tenant_carrier_optins",
            createSql: @"CREATE TABLE IF NOT EXISTS `tenant_carrier_optins` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `InsuranceCompanyId` char(36) NOT NULL,
                `EnabledAt` datetime(6) NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_tenant_carrier_optins_InsuranceCompanyId` (`InsuranceCompanyId`),
                UNIQUE KEY `IX_tenant_carrier_optins_TenantId_InsuranceCompanyId` (`TenantId`, `InsuranceCompanyId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- customers.DriverLicense* columns -----------------------------
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "DriverLicenseNumber",
            addSql: "ALTER TABLE `customers` ADD COLUMN `DriverLicenseNumber` varchar(64) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "DriverLicenseClass",
            addSql: "ALTER TABLE `customers` ADD COLUMN `DriverLicenseClass` varchar(16) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "DriverLicenseIssueDate",
            addSql: "ALTER TABLE `customers` ADD COLUMN `DriverLicenseIssueDate` date NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "DriverLicenseExpiryDate",
            addSql: "ALTER TABLE `customers` ADD COLUMN `DriverLicenseExpiryDate` date NULL", ct);

        // --- policy_objects table -----------------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "policy_objects",
            createSql: @"CREATE TABLE IF NOT EXISTS `policy_objects` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `ObjectKind` varchar(64) NOT NULL,
                `FbcLinkCode` varchar(32) NULL,
                `Identifier` varchar(128) NULL,
                `Description` varchar(512) NULL,
                `Characteristic` varchar(128) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_policy_objects_PolicyId` (`PolicyId`),
                KEY `IX_policy_objects_TenantId_PolicyId` (`TenantId`, `PolicyId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- policy_covers table ------------------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "policy_covers",
            createSql: @"CREATE TABLE IF NOT EXISTS `policy_covers` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `PolicyObjectId` char(36) NULL,
                `CoverCode` varchar(32) NOT NULL,
                `CoverName` varchar(200) NULL,
                `GrossPremium` decimal(14,2) NOT NULL DEFAULT 0,
                `NetPremium` decimal(14,2) NOT NULL DEFAULT 0,
                `CoverageAmount` decimal(18,2) NULL,
                `CommissionPercent` decimal(7,4) NULL,
                `AgencyCommissionPercent` decimal(7,4) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_policy_covers_PolicyId` (`PolicyId`),
                KEY `IX_policy_covers_PolicyObjectId` (`PolicyObjectId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);
        // Old policy_covers rows on already-migrated DBs won't have the
        // per-cover commission columns from the create statement above.
        await EnsureColumnAsync(db, logger, dbName,
            table: "policy_covers", column: "CommissionPercent",
            addSql: "ALTER TABLE `policy_covers` ADD COLUMN `CommissionPercent` decimal(7,4) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policy_covers", column: "AgencyCommissionPercent",
            addSql: "ALTER TABLE `policy_covers` ADD COLUMN `AgencyCommissionPercent` decimal(7,4) NULL", ct);

        // commission_rules.RateSource: which source (rule vs bridge) wins
        // when both agency/producer % are available for a cover.
        await EnsureColumnAsync(db, logger, dbName,
            table: "commission_rules", column: "RateSource",
            addSql: "ALTER TABLE `commission_rules` ADD COLUMN `RateSource` int NOT NULL DEFAULT 1", ct);

        // policy_cover_adjustments: audit trail of bridge-triggered %
        // changes so the operator can see why a producer's commission
        // dropped on a specific cover.
        await EnsureTableAsync(db, logger, dbName,
            table: "policy_cover_adjustments",
            createSql: @"CREATE TABLE IF NOT EXISTS `policy_cover_adjustments` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `PolicyCoverId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `OldAgencyPercent` decimal(7,4) NULL,
                `NewAgencyPercent` decimal(7,4) NULL,
                `OldProducerPercent` decimal(7,4) NULL,
                `NewProducerPercent` decimal(7,4) NULL,
                `AgencyAmountDelta` decimal(14,2) NOT NULL DEFAULT 0,
                `ProducerAmountDelta` decimal(14,2) NOT NULL DEFAULT 0,
                `Reason` varchar(1000) NULL,
                `SourceBridgeRunId` char(36) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_policy_cover_adjustments_PolicyCoverId` (`PolicyCoverId`),
                KEY `IX_policy_cover_adjustments_TenantId_PolicyId` (`TenantId`, `PolicyId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- saved_reports table ------------------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "saved_reports",
            createSql: @"CREATE TABLE IF NOT EXISTS `saved_reports` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `OwnerUserId` char(36) NOT NULL,
                `Entity` varchar(64) NOT NULL,
                `Name` varchar(200) NOT NULL,
                `FiltersJson` longtext NOT NULL,
                `IsShared` tinyint(1) NOT NULL DEFAULT 0,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_saved_reports_TenantId_OwnerUserId_Entity` (`TenantId`, `OwnerUserId`, `Entity`),
                KEY `IX_saved_reports_TenantId_Entity_IsShared` (`TenantId`, `Entity`, `IsShared`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- policy_installments table ------------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "policy_installments",
            createSql: @"CREATE TABLE IF NOT EXISTS `policy_installments` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `Ordinal` int NOT NULL,
                `DueDate` date NOT NULL,
                `Amount` decimal(14,2) NOT NULL,
                `Currency` varchar(3) NOT NULL DEFAULT 'EUR',
                `PaidAt` date NULL,
                `PaidVia` varchar(64) NULL,
                `ReceiptReference` varchar(128) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_policy_installments_PolicyId` (`PolicyId`),
                KEY `IX_policy_installments_TenantId_DueDate_PaidAt` (`TenantId`, `DueDate`, `PaidAt`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- producer_commission_declarations table ------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "producer_commission_declarations",
            createSql: @"CREATE TABLE IF NOT EXISTS `producer_commission_declarations` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ProducerId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `ExpectedAmount` decimal(14,2) NOT NULL,
                `ExpectedPercent` decimal(7,2) NULL,
                `Currency` varchar(3) CHARACTER SET utf8mb4 NOT NULL,
                `Notes` varchar(1000) CHARACTER SET utf8mb4 NULL,
                `DeclaredAt` datetime(6) NOT NULL,
                `RecordedAmount` decimal(14,2) NULL,
                `DifferenceAmount` decimal(14,2) NULL,
                `ReconciliationStatus` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_pcd_policy` (`PolicyId`),
                KEY `IX_pcd_tenant_producer` (`TenantId`,`ProducerId`)
            ) CHARACTER SET=utf8mb4", ct);
    }

    private static async Task<bool> ColumnExistsAsync(AppDbContext db, string dbName, string table, string column, CancellationToken ct)
    {
        var sql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                  "WHERE TABLE_SCHEMA = {0} AND TABLE_NAME = {1} AND COLUMN_NAME = {2}";
        var count = await db.Database.SqlQueryRaw<long>(sql, dbName, table, column).ToListAsync(ct);
        return count.FirstOrDefault() > 0;
    }

    private static async Task EnsureColumnAsync(AppDbContext db, ILogger logger, string dbName, string table, string column, string addSql, CancellationToken ct)
    {
        if (!await ColumnExistsAsync(db, dbName, table, column, ct))
        {
            await db.Database.ExecuteSqlRawAsync(addSql, ct);
            logger.LogWarning("Schema safety net: added {Table}.{Column}", table, column);
        }
    }

    private static async Task EnsureIndexAsync(AppDbContext db, ILogger logger, string dbName, string table, string indexName, string addSql, CancellationToken ct)
    {
        var sql = "SELECT COUNT(*) FROM information_schema.STATISTICS " +
                  "WHERE TABLE_SCHEMA = {0} AND TABLE_NAME = {1} AND INDEX_NAME = {2}";
        var count = await db.Database.SqlQueryRaw<long>(sql, dbName, table, indexName).ToListAsync(ct);
        if ((count.FirstOrDefault()) == 0)
        {
            try
            {
                await db.Database.ExecuteSqlRawAsync(addSql, ct);
                logger.LogWarning("Schema safety net: added index {Index} on {Table}", indexName, table);
            }
            catch (Exception ex) { logger.LogWarning(ex, "Schema safety: index {Index} create failed (likely race), continuing.", indexName); }
        }
    }

    private static async Task EnsureTableAsync(AppDbContext db, ILogger logger, string dbName, string table, string createSql, CancellationToken ct)
    {
        var sql = "SELECT COUNT(*) FROM information_schema.TABLES " +
                  "WHERE TABLE_SCHEMA = {0} AND TABLE_NAME = {1}";
        var count = await db.Database.SqlQueryRaw<long>(sql, dbName, table).ToListAsync(ct);
        if ((count.FirstOrDefault()) == 0)
        {
            await db.Database.ExecuteSqlRawAsync(createSql, ct);
            logger.LogWarning("Schema safety net: created table {Table}", table);
        }
    }
}
