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
        // Boot-time global-carrier cleanup + Kalypsis-seeded parametric
        // packs are DISABLED under the "each office runs its own catalogue"
        // model. The old pre-seed/post-seed CleanupNonGrandCoverGlobalsAsync
        // was actively harmful on redeploy — it soft-deleted every tenant-
        // owned row whose Code fell outside a small whitelist and re-routed
        // any carrier the office had authored back onto a shared Kalypsis-
        // global row, wiping the office's customisations. The Atlantic +
        // ERGO parametric seeders would then fill those global rows with
        // ~3000 rows nobody in the office ever asked for.
        //
        // Cleanup + seeders are kept as callable methods (a platform admin
        // can still invoke them via /api/platform/company-parameters/run-
        // cleanup for a controlled reset) but they no longer run on boot.
        //
        // GrandCoverSeeder still runs — it materialises the Grand Cover
        // broker + its 49 subs, which are the ONLY globals the platform
        // legitimately needs to offer (the whole Grand Cover business
        // is a broker aggregating other insurers, so its structure IS
        // the shared catalog).
        try { await GrandCoverSeeder.SeedAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "GrandCoverSeeder failed — continuing boot without IW seed."); }

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
        var carrierWhitelistCsv = "'ERGO','ATLANTIC','INTERLIFE'"; // extend when a new bridge lands
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
        var whitelistedCodes = new[] { "ERGO", "ATLANTIC", "INTERLIFE" };
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
                    "ERGO"      => "ERGO Hellas",
                    "ATLANTIC"  => "Ατλαντική Ένωση",
                    "INTERLIFE" => "Interlife",
                    _           => wcode
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

        // --- ALIS-parity batch A: policy schema enrichment ----------------
        // Ship 2026-07-07. Four low-risk nullable columns that close big gaps
        // for Greek brokerage:
        //   • ApplicationNumber          — αρ. αίτησης, tracked before the
        //     insurer issues the actual policy number.
        //   • ContractPartyCustomerId    — συμβαλλόμενος ≠ ασφαλιζόμενος
        //     (parent pays for child, company pays for employee, etc.).
        //   • PreviousInsuranceCompanyId — από πού μεταφέρθηκε το συμβόλαιο
        //     για churn / win-back analytics.
        //   • IssuedAt                    — ημερομηνία έκδοσης από την
        //     εταιρεία, distinct from row CreatedAt / policy StartDate.
        //   • VehicleRegistrationPlate    — πινακίδα προωθημένη από SpecsJson
        //     σε first-class στήλη ώστε το search να μπορεί να την ευρετηριάσει.
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "ApplicationNumber",
            addSql: "ALTER TABLE `policies` ADD COLUMN `ApplicationNumber` varchar(64) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "ContractPartyCustomerId",
            addSql: "ALTER TABLE `policies` ADD COLUMN `ContractPartyCustomerId` char(36) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "PreviousInsuranceCompanyId",
            addSql: "ALTER TABLE `policies` ADD COLUMN `PreviousInsuranceCompanyId` char(36) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "IssuedAt",
            addSql: "ALTER TABLE `policies` ADD COLUMN `IssuedAt` date NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "VehicleRegistrationPlate",
            addSql: "ALTER TABLE `policies` ADD COLUMN `VehicleRegistrationPlate` varchar(20) NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "policies", indexName: "IX_policies_VehicleRegistrationPlate",
            addSql: "CREATE INDEX `IX_policies_VehicleRegistrationPlate` ON `policies` (`VehicleRegistrationPlate`)", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "policies", indexName: "IX_policies_ApplicationNumber",
            addSql: "CREATE INDEX `IX_policies_ApplicationNumber` ON `policies` (`ApplicationNumber`)", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "policies", indexName: "IX_policies_ContractPartyCustomerId",
            addSql: "CREATE INDEX `IX_policies_ContractPartyCustomerId` ON `policies` (`ContractPartyCustomerId`)", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "policies", indexName: "IX_policies_PreviousInsuranceCompanyId",
            addSql: "CREATE INDEX `IX_policies_PreviousInsuranceCompanyId` ON `policies` (`PreviousInsuranceCompanyId`)", ct);

        // --- ALIS-parity batch B: customer KYC enrichment -----------------
        // Ship 2026-07-07. Six nullable string columns covering ALIS's F2
        // «Γενικά στοιχεία» view — the ones brokers actually fill in every
        // day. All safe to leave null on legacy rows.
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "FatherName",
            addSql: "ALTER TABLE `customers` ADD COLUMN `FatherName` varchar(120) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "MotherName",
            addSql: "ALTER TABLE `customers` ADD COLUMN `MotherName` varchar(120) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "SpouseName",
            addSql: "ALTER TABLE `customers` ADD COLUMN `SpouseName` varchar(160) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "Nationality",
            addSql: "ALTER TABLE `customers` ADD COLUMN `Nationality` varchar(80) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "Zone",
            addSql: "ALTER TABLE `customers` ADD COLUMN `Zone` varchar(80) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "customers", column: "ActivityCode",
            addSql: "ALTER TABLE `customers` ADD COLUMN `ActivityCode` varchar(20) NULL", ct);

        // --- ALIS-parity batch D: broker hierarchy + commission matrix ---
        // Ship 2026-07-07. Adds the columns / table needed for ALIS's F9
        // «Προμήθειες» matrix — five hierarchy levels (Producer / Manager /
        // Unit / Assistant / Agency), per-rule multi-level percents in a JSON
        // blob, tenant-level tax withholding default, and a materialised
        // audit ledger (policy_commission_splits) so we can render the matrix
        // for any policy without re-running the calculator.
        await EnsureColumnAsync(db, logger, dbName,
            table: "producers", column: "HierarchyLevel",
            addSql: "ALTER TABLE `producers` ADD COLUMN `HierarchyLevel` int NOT NULL DEFAULT 1", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "producers", column: "ParentProducerId",
            addSql: "ALTER TABLE `producers` ADD COLUMN `ParentProducerId` char(36) NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "producers", indexName: "IX_producers_ParentProducerId",
            addSql: "CREATE INDEX `IX_producers_ParentProducerId` ON `producers` (`ParentProducerId`)", ct);

        await EnsureColumnAsync(db, logger, dbName,
            table: "commission_rules", column: "LevelPercentsJson",
            addSql: "ALTER TABLE `commission_rules` ADD COLUMN `LevelPercentsJson` longtext NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "commission_rules", column: "TaxWithholdingPercent",
            addSql: "ALTER TABLE `commission_rules` ADD COLUMN `TaxWithholdingPercent` decimal(6,3) NULL", ct);

        // --- ALIS-parity batch F: motor policy first-class fields ---------
        // Driver ΑΦΜ + λόγος κυκλοφορίας promoted out of SpecsJson so they can
        // be searched, exported and rendered without touching JSON on every read.
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "DriverVatNumber",
            addSql: "ALTER TABLE `policies` ADD COLUMN `DriverVatNumber` varchar(20) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "ReasonForCirculation",
            addSql: "ALTER TABLE `policies` ADD COLUMN `ReasonForCirculation` varchar(120) NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "policies", indexName: "IX_policies_DriverVatNumber",
            addSql: "CREATE INDEX `IX_policies_DriverVatNumber` ON `policies` (`DriverVatNumber`)", ct);

        await EnsureColumnAsync(db, logger, dbName,
            table: "policies", column: "SpecialLevelPercentsJson",
            addSql: "ALTER TABLE `policies` ADD COLUMN `SpecialLevelPercentsJson` longtext NULL", ct);

        // --- ALIS-parity batch G: claim involved parties -----------------
        // «F5 Ζημιάδες Εμπλεκόμενοι» — everyone involved in a claim beyond
        // the policyholder (other driver, passenger, witness, garage…).
        // NOTE: the FK from claim_involved_parties.ClaimId → claims.Id is
        // intentionally omitted here. MySQL 8 rejects the constraint because
        // the `claims.Id` column was originally created by an EF migration
        // that used `utf8mb4_unicode_ci`, and this bare CREATE TABLE would
        // default to `utf8mb4_0900_ai_ci`. Explicit COLLATE tokens in the
        // CREATE would work but the FK isn't load-bearing — the app never
        // hard-deletes a claim (soft-delete via DeletedAt is the whole
        // deletion flow), so cascade behaviour never fires in practice. EF
        // still tracks the relationship via ClaimInvolvedPartyConfiguration.
        await EnsureTableAsync(db, logger, dbName,
            table: "claim_involved_parties",
            createSql: @"CREATE TABLE IF NOT EXISTS `claim_involved_parties` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ClaimId` char(36) NOT NULL,
                `Role` varchar(40) NOT NULL,
                `FullName` varchar(160) NOT NULL,
                `Phone` varchar(40) NULL,
                `Email` varchar(160) NULL,
                `VatNumber` varchar(20) NULL,
                `VehiclePlate` varchar(20) NULL,
                `InsuranceCompany` varchar(160) NULL,
                `PolicyNumber` varchar(64) NULL,
                `Notes` varchar(2000) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_claim_involved_parties_Tenant_Claim` (`TenantId`, `ClaimId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        // NOTE the table name — lowercase `tenants` matches what EF creates.
        // On MySQL 8 Linux with `lower_case_table_names=0` (the container
        // default), `ALTER TABLE Tenants` would target a non-existent table
        // and silently fail (caught by the wrapped helper), leaving the
        // column missing and every subsequent Tenants read broken.
        await EnsureColumnAsync(db, logger, dbName,
            table: "tenants", column: "DefaultTaxWithholdingPercent",
            addSql: "ALTER TABLE `tenants` ADD COLUMN `DefaultTaxWithholdingPercent` decimal(6,3) NOT NULL DEFAULT 20", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "policy_commission_splits",
            createSql: @"CREATE TABLE IF NOT EXISTS `policy_commission_splits` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `PolicyId` char(36) NOT NULL,
                `HierarchyLevel` int NOT NULL,
                `ProducerId` char(36) NULL,
                `Percent` decimal(8,4) NOT NULL DEFAULT 0,
                `GrossAmount` decimal(14,2) NOT NULL DEFAULT 0,
                `TaxWithholdingAmount` decimal(14,2) NOT NULL DEFAULT 0,
                `NetAmount` decimal(14,2) NOT NULL DEFAULT 0,
                `Currency` varchar(3) NOT NULL DEFAULT 'EUR',
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_policy_commission_splits_Tenant_Policy` (`TenantId`, `PolicyId`),
                KEY `IX_policy_commission_splits_Tenant_Producer` (`TenantId`, `ProducerId`),
                CONSTRAINT `FK_policy_commission_splits_policies` FOREIGN KEY (`PolicyId`) REFERENCES `policies` (`Id`) ON DELETE CASCADE,
                CONSTRAINT `FK_policy_commission_splits_producers` FOREIGN KEY (`ProducerId`) REFERENCES `producers` (`Id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

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
        await EnsureColumnAsync(db, logger, dbName,
            table: "users", column: "EmailLoginCodeEnabled",
            addSql: "ALTER TABLE `users` ADD COLUMN `EmailLoginCodeEnabled` tinyint(1) NOT NULL DEFAULT 0", ct);

        // platform_settings: monthly usage limits (Email/SMS/Viber/Phone)
        // per user — read by the profile page's UsageMonitorSection.
        await EnsureColumnAsync(db, logger, dbName,
            table: "platform_settings", column: "EmailMonthlyLimit",
            addSql: "ALTER TABLE `platform_settings` ADD COLUMN `EmailMonthlyLimit` int NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "platform_settings", column: "SmsMonthlyLimit",
            addSql: "ALTER TABLE `platform_settings` ADD COLUMN `SmsMonthlyLimit` int NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "platform_settings", column: "ViberMonthlyLimit",
            addSql: "ALTER TABLE `platform_settings` ADD COLUMN `ViberMonthlyLimit` int NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "platform_settings", column: "PhoneMonthlyLimit",
            addSql: "ALTER TABLE `platform_settings` ADD COLUMN `PhoneMonthlyLimit` int NULL", ct);

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

        // --- platform_pricings table (singleton row) ---------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "platform_pricings",
            createSql: @"CREATE TABLE IF NOT EXISTS `platform_pricings` (
                `Id` char(36) NOT NULL,
                `CatalogJson` longtext NOT NULL,
                `Version` int NOT NULL,
                `LastUpdatedByUserId` char(36) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- tenant_chargeables table ------------------------------------
        // Ad-hoc chargeable items (training, migration, custom dev) per
        // tenant. Missing table would 500 the «Χρεώσεις Γραφείου»
        // superadmin panel for every tenant.
        await EnsureTableAsync(db, logger, dbName,
            table: "tenant_chargeables",
            createSql: @"CREATE TABLE IF NOT EXISTS `tenant_chargeables` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ServiceCode` varchar(60) NOT NULL,
                `Description` varchar(400) NOT NULL,
                `UnitLabel` varchar(40) NOT NULL,
                `UnitPrice` decimal(12,2) NOT NULL,
                `Quantity` decimal(12,2) NOT NULL,
                `LineTotal` decimal(14,2) NOT NULL,
                `PerformedOn` datetime(6) NOT NULL,
                `Notes` varchar(2000) NULL,
                `InvoiceLineId` char(36) NULL,
                `PaidAt` datetime(6) NULL,
                `PaidReference` varchar(200) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_tenant_chargeables_TenantId` (`TenantId`),
                KEY `IX_tenant_chargeables_InvoiceLineId` (`InvoiceLineId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // In-place ALTER for existing tenant_chargeables tables — add the
        // paid-tracking columns (added after v1 shipped).
        await EnsureColumnAsync(db, logger, dbName,
            table: "tenant_chargeables", column: "PaidAt",
            addSql: "ALTER TABLE `tenant_chargeables` ADD COLUMN `PaidAt` datetime(6) NULL", ct);
        await EnsureColumnAsync(db, logger, dbName,
            table: "tenant_chargeables", column: "PaidReference",
            addSql: "ALTER TABLE `tenant_chargeables` ADD COLUMN `PaidReference` varchar(200) NULL", ct);

        // --- producer_expected_rates table -------------------------------
        // Producer-side «παραμετροποίηση» — a lightweight mirror of
        // CommissionRule that the producer maintains themselves so the
        // portal can compare «I expect X% from XYZ carrier» against what
        // the agency actually configures.
        await EnsureTableAsync(db, logger, dbName,
            table: "producer_expected_rates",
            createSql: @"CREATE TABLE IF NOT EXISTS `producer_expected_rates` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ProducerId` char(36) NOT NULL,
                `InsuranceCompanyId` char(36) NULL,
                `PolicyType` int NULL,
                `VehicleUseCategory` int NULL,
                `ExpectedPercent` decimal(7,2) NOT NULL,
                `Notes` varchar(1000) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_producer_expected_rates_TenantId_ProducerId` (`TenantId`, `ProducerId`)
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

        // --- agency_instructions table ------------------------------------
        // Per-tenant handbook maintained by AgencyAdmin, readable by every
        // staff member. Singleton per tenant enforced by the unique index.
        await EnsureTableAsync(db, logger, dbName,
            table: "agency_instructions",
            createSql: @"CREATE TABLE IF NOT EXISTS `agency_instructions` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `Title` varchar(200) NOT NULL,
                `ContentHtml` mediumtext NOT NULL,
                `UpdatedByUserId` char(36) NULL,
                `UpdatedByName` varchar(200) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                UNIQUE KEY `UX_agency_instructions_TenantId` (`TenantId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- tenant_backups table -----------------------------------------
        // Manifest of every full JSON backup we've written for a tenant.
        // The compressed archive itself lives on disk (Storage__LocalRoot/backups/…).
        await EnsureTableAsync(db, logger, dbName,
            table: "tenant_backups",
            createSql: @"CREATE TABLE IF NOT EXISTS `tenant_backups` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `FileName` varchar(300) NOT NULL,
                `StoragePath` varchar(800) NOT NULL,
                `SizeBytes` bigint NOT NULL DEFAULT 0,
                `Kind` varchar(20) NOT NULL DEFAULT 'Manual',
                `SummaryJson` text NULL,
                `CreatedByUserId` char(36) NULL,
                `CreatedByName` varchar(200) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_tenant_backups_TenantId_CreatedAt` (`TenantId`, `CreatedAt`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- tenant_backup_policies table --------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "tenant_backup_policies",
            createSql: @"CREATE TABLE IF NOT EXISTS `tenant_backup_policies` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `Enabled` tinyint(1) NOT NULL DEFAULT 0,
                `FrequencyDays` int NOT NULL DEFAULT 7,
                `RetentionCount` int NOT NULL DEFAULT 8,
                `LastAutoBackupAt` datetime(6) NULL,
                `LastEditedByUserId` char(36) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                UNIQUE KEY `UX_tenant_backup_policies_TenantId` (`TenantId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // --- gdpr_erasure_requests table ---------------------------------
        await EnsureTableAsync(db, logger, dbName,
            table: "gdpr_erasure_requests",
            createSql: @"CREATE TABLE IF NOT EXISTS `gdpr_erasure_requests` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `RequesterName` varchar(200) NOT NULL,
                `RequesterEmail` varchar(200) NOT NULL,
                `RequesterPhone` varchar(40) NULL,
                `CustomerId` char(36) NULL,
                `Reason` text NOT NULL,
                `Status` varchar(20) NOT NULL DEFAULT 'Pending',
                `Notes` text NULL,
                `HandledByUserId` char(36) NULL,
                `HandledByName` varchar(200) NULL,
                `HandledAt` datetime(6) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_gdpr_erasure_requests_TenantId_Status_CreatedAt` (`TenantId`, `Status`, `CreatedAt`)
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

        // --- bridge_code_mappings table -----------------------------------
        // Per-tenant link from a raw carrier bridge code (e.g. "1003" arriving
        // on an INTERLIFE feed) to the agency's own parametric — an insurance
        // company copy for Kind=Company, or a company_parameter_items row for
        // Branch / Coverage / Use / Package. Consulted by the bridge importer
        // before falling back to the platform's built-in code table.
        await EnsureTableAsync(db, logger, dbName,
            table: "bridge_code_mappings",
            createSql: @"CREATE TABLE IF NOT EXISTS `bridge_code_mappings` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `Kind` int NOT NULL,
                `SourceCarrier` varchar(120) NULL,
                `RawCode` varchar(200) NOT NULL,
                `RawLabel` varchar(400) NULL,
                `TargetInsuranceCompanyId` char(36) NULL,
                `TargetParameterItemId` char(36) NULL,
                `Notes` varchar(2000) NULL,
                `ConfirmedByUserId` char(36) NULL,
                `ConfirmedAt` datetime(6) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                UNIQUE KEY `IX_bcm_tenant_kind_carrier_raw` (`TenantId`,`Kind`,`SourceCarrier`,`RawCode`),
                KEY `IX_bcm_tenant_carrier` (`TenantId`,`SourceCarrier`),
                KEY `IX_bcm_target_company` (`TargetInsuranceCompanyId`),
                KEY `IX_bcm_target_param` (`TargetParameterItemId`)
            ) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", ct);

        // Producer mapping column — added after v1 so existing tenant
        // databases might not have it yet. The column stays nullable and
        // untyped (SET NULL on producer delete) so a broken FK never
        // blocks a mapping row from being read.
        await EnsureColumnAsync(db, logger, dbName,
            table: "bridge_code_mappings", column: "TargetProducerId",
            addSql: "ALTER TABLE `bridge_code_mappings` ADD COLUMN `TargetProducerId` char(36) NULL", ct);
        await EnsureIndexAsync(db, logger, dbName,
            table: "bridge_code_mappings", indexName: "IX_bcm_target_producer",
            addSql: "CREATE INDEX `IX_bcm_target_producer` ON `bridge_code_mappings` (`TargetProducerId`)", ct);

        // ================================================================
        // Federation module — Championship / Club / Athlete / etc.
        // Created via the same safety-net path as the ALIS-parity tables
        // above so a fresh boot brings the tables up without requiring the
        // operator to run `dotnet ef database update`. FK enforcement is
        // deliberately absent — soft deletes + tenant scoping already
        // prevent cross-tenant reads, and the tables all carry TenantId so
        // orphan cleanup can run per-tenant.
        // ================================================================
        await EnsureTableAsync(db, logger, dbName,
            table: "championships",
            createSql: @"CREATE TABLE IF NOT EXISTS `championships` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `Name` varchar(200) NOT NULL,
                `Sport` varchar(100) NOT NULL,
                `Location` varchar(200) NULL,
                `StartDate` date NOT NULL,
                `EndDate` date NOT NULL,
                `Status` int NOT NULL DEFAULT 0,
                `Description` longtext NULL,
                `RegistrationDeadline` date NULL,
                `ClubEntryFee` decimal(12,2) NOT NULL DEFAULT 0,
                `FeePerAthlete` decimal(12,2) NOT NULL DEFAULT 0,
                `Currency` varchar(3) NOT NULL DEFAULT 'EUR',
                `AnnouncementFilePath` varchar(500) NULL,
                `AnnouncementFileName` varchar(200) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_championships_TenantId` (`TenantId`),
                KEY `IX_championships_StartDate` (`StartDate`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "championship_categories",
            createSql: @"CREATE TABLE IF NOT EXISTS `championship_categories` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ChampionshipId` char(36) NOT NULL,
                `Name` varchar(200) NOT NULL,
                `MinAge` int NULL,
                `MaxAge` int NULL,
                `Gender` varchar(20) NULL,
                `SortOrder` int NOT NULL DEFAULT 0,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_champ_cat_Championship` (`ChampionshipId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "clubs",
            createSql: @"CREATE TABLE IF NOT EXISTS `clubs` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `Name` varchar(200) NOT NULL,
                `Code` varchar(40) NOT NULL,
                `City` varchar(120) NULL,
                `ContactName` varchar(160) NULL,
                `ContactEmail` varchar(160) NULL,
                `ContactPhone` varchar(40) NULL,
                `Notes` longtext NULL,
                `IsActive` tinyint(1) NOT NULL DEFAULT 1,
                `ManagerUserId` char(36) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                UNIQUE KEY `UQ_clubs_Tenant_Code` (`TenantId`, `Code`),
                KEY `IX_clubs_TenantId` (`TenantId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "athletes",
            createSql: @"CREATE TABLE IF NOT EXISTS `athletes` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ClubId` char(36) NOT NULL,
                `FirstName` varchar(120) NOT NULL,
                `LastName` varchar(120) NOT NULL,
                `BirthDate` date NULL,
                `Gender` varchar(20) NULL,
                `LicenseNumber` varchar(60) NULL,
                `Notes` longtext NULL,
                `IsActive` tinyint(1) NOT NULL DEFAULT 1,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_athletes_TenantId` (`TenantId`),
                KEY `IX_athletes_ClubId` (`ClubId`),
                KEY `IX_athletes_LicenseNumber` (`LicenseNumber`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "championship_registrations",
            createSql: @"CREATE TABLE IF NOT EXISTS `championship_registrations` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `ChampionshipId` char(36) NOT NULL,
                `ClubId` char(36) NOT NULL,
                `SubmittedOn` date NOT NULL,
                `TotalFee` decimal(12,2) NOT NULL DEFAULT 0,
                `Currency` varchar(3) NOT NULL DEFAULT 'EUR',
                `PaymentStatus` int NOT NULL DEFAULT 0,
                `PaidOn` date NULL,
                `PaymentReference` varchar(120) NULL,
                `Notes` longtext NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_champ_reg_Champ` (`ChampionshipId`),
                KEY `IX_champ_reg_Club` (`ClubId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "registration_athletes",
            createSql: @"CREATE TABLE IF NOT EXISTS `registration_athletes` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `RegistrationId` char(36) NOT NULL,
                `AthleteId` char(36) NOT NULL,
                `CategoryId` char(36) NOT NULL,
                `StartNumber` int NULL,
                `Notes` varchar(500) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_reg_ath_Registration` (`RegistrationId`),
                KEY `IX_reg_ath_Athlete` (`AthleteId`),
                KEY `IX_reg_ath_Category` (`CategoryId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        await EnsureTableAsync(db, logger, dbName,
            table: "championship_results",
            createSql: @"CREATE TABLE IF NOT EXISTS `championship_results` (
                `Id` char(36) NOT NULL,
                `TenantId` char(36) NOT NULL,
                `RegistrationAthleteId` char(36) NOT NULL,
                `Rank` int NULL,
                `Score` varchar(80) NULL,
                `Notes` longtext NULL,
                `EnteredByUserId` char(36) NULL,
                `EnteredAt` datetime(6) NULL,
                `CreatedAt` datetime(6) NOT NULL,
                `UpdatedAt` datetime(6) NULL,
                `DeletedAt` datetime(6) NULL,
                PRIMARY KEY (`Id`),
                KEY `IX_champ_res_RegAth` (`RegistrationAthleteId`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;", ct);

        // ==== Widen encrypted columns to varchar(500) ==========================
        // See AppDbContext.OnModelCreating — every column below is now encrypted
        // via ASP.NET DataProtection at the EF layer, and the ciphertext balloons
        // any plaintext to ~150-200 chars. Idempotent (no-op when already wide).
        var encColumnsSmall = new (string Table, string Column)[]
        {
            // Customer PII (ταυτότητα / ΑΜΚΑ / διαβατήριο / δίπλωμα)
            ("customers", "Amka"),
            ("customers", "IdNumber"),
            ("customers", "PassportNumber"),
            ("customers", "DriverLicenseNumber"),
            // Financial identifiers (IBAN)
            ("bank_connections", "Iban"),
            ("bank_statement_lines", "CounterpartyIban"),
            ("banks", "AccountIban"),
            ("garages", "Iban"),
            // Small integration secrets (client secrets, IMAP passwords, SIDs)
            ("carrier_connections", "ClientSecretEncrypted"),
            ("mailbox_connections", "ImapPasswordEncrypted"),
            ("telephony_connections", "AccountSidEncrypted"),
            ("telephony_connections", "AuthTokenEncrypted"),
            ("BackofficeBridgeConnections", "SecretEncrypted"),
        };
        foreach (var (table, column) in encColumnsSmall)
            await EnsureColumnAtLeastAsync(db, logger, dbName, table, column, minLength: 500, ct);

        // OAuth access/refresh tokens can be 1-2 KB before encryption balloons them.
        await EnsureColumnAtLeastAsync(db, logger, dbName, "mailbox_connections", "AccessTokenEncrypted", minLength: 3000, ct);
        await EnsureColumnAtLeastAsync(db, logger, dbName, "mailbox_connections", "RefreshTokenEncrypted", minLength: 3000, ct);
    }

    private static async Task<bool> ColumnExistsAsync(AppDbContext db, string dbName, string table, string column, CancellationToken ct)
    {
        var sql = "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                  "WHERE TABLE_SCHEMA = {0} AND TABLE_NAME = {1} AND COLUMN_NAME = {2}";
        var count = await db.Database.SqlQueryRaw<long>(sql, dbName, table, column).ToListAsync(ct);
        return count.FirstOrDefault() > 0;
    }

    /// <summary>
    /// Widens a varchar column if its current length is smaller than <paramref name="minLength"/>.
    /// Idempotent: no-op when the column is already at least as wide, silent if the
    /// table/column does not exist. Used by the encryption rollout so that
    /// previously-narrow columns (e.g. AMKA varchar(11)) can accommodate the
    /// DataProtection envelope (~150-200 chars).
    /// </summary>
    private static async Task EnsureColumnAtLeastAsync(AppDbContext db, ILogger logger, string dbName,
        string table, string column, int minLength, CancellationToken ct)
    {
        try
        {
            var sql = "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS " +
                      "WHERE TABLE_SCHEMA = {0} AND TABLE_NAME = {1} AND COLUMN_NAME = {2}";
            var current = await db.Database.SqlQueryRaw<long?>(sql, dbName, table, column).ToListAsync(ct);
            var currentLen = current.FirstOrDefault();
            if (currentLen is null) return; // column not present — nothing to widen
            if (currentLen >= minLength) return;
            var alter = $"ALTER TABLE `{table}` MODIFY COLUMN `{column}` varchar({minLength}) NULL";
            await db.Database.ExecuteSqlRawAsync(alter, ct);
            logger.LogWarning("Schema safety: widened {Table}.{Column} to varchar({Len})", table, column, minLength);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Schema safety: widening {Table}.{Column} failed, continuing.", table, column);
        }
    }

    private static async Task EnsureColumnAsync(AppDbContext db, ILogger logger, string dbName, string table, string column, string addSql, CancellationToken ct)
    {
        try
        {
            if (!await ColumnExistsAsync(db, dbName, table, column, ct))
            {
                await db.Database.ExecuteSqlRawAsync(addSql, ct);
                logger.LogWarning("Schema safety net: added {Table}.{Column}", table, column);
            }
        }
        catch (Exception ex)
        {
            // Belt-and-braces: swallow per-statement failures so a single bad
            // ALTER can't abort the whole schema safety net (which used to
            // cascade — one FK collation mismatch would skip every later
            // migration and leave subsequent columns unknown to the code).
            logger.LogError(ex, "Schema safety: adding {Table}.{Column} failed, continuing.", table, column);
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
        try
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
        catch (Exception ex)
        {
            // Same defense as EnsureColumnAsync — a per-CREATE failure (usually
            // a collation-mismatched FK constraint on MySQL 8) must not skip
            // later migrations in the same run.
            logger.LogError(ex, "Schema safety: creating table {Table} failed, continuing.", table);
        }
    }
}
