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

        // (4) Soft-delete every row that isn't the canonical broker or one of
        // its subs. This kills both the demo carriers AND the duplicate
        // Grand Cover broker copies.
        var deletedCarriers = await db.Database.ExecuteSqlRawAsync($@"
            UPDATE `insurance_companies`
            SET `DeletedAt` = UTC_TIMESTAMP(6), `IsActive` = 0
            WHERE `DeletedAt` IS NULL
              AND `Id` <> '{canonical}'
              AND (`ParentCompanyId` IS NULL OR `ParentCompanyId` <> '{canonical}')", ct);
        logger.LogInformation("Cleanup: soft-deleted {Count} non-canonical carrier row(s) across all tenants.", deletedCarriers);

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
        await EnsureIndexAsync(db, logger, dbName,
            table: "insurance_companies", indexName: "IX_insurance_companies_ParentCompanyId",
            addSql: "CREATE INDEX `IX_insurance_companies_ParentCompanyId` ON `insurance_companies` (`ParentCompanyId`)", ct);

        // --- TenantPackageGrants.PremiumFeaturesJson -----------------------
        await EnsureColumnAsync(db, logger, dbName,
            table: "TenantPackageGrants", column: "PremiumFeaturesJson",
            addSql: "ALTER TABLE `TenantPackageGrants` ADD COLUMN `PremiumFeaturesJson` longtext NULL", ct);

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
