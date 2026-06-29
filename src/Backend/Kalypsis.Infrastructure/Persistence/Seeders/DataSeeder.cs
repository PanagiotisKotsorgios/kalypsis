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

        // Wrap each seeder in try/catch so one failure doesn't block the API
        // from booting — the operator needs a running container in order to log
        // in and fix anything via the admin UI.
        try { await SeedInsuranceCompaniesAsync(db, logger, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "SeedInsuranceCompaniesAsync failed — continuing boot."); }

        // Carrier parametrics intentionally start BLANK for every company except
        // Grand Cover (IW), which we seed line-by-line from the embedded IW dump
        // resource. Other carriers wait for the superadmin to enter their real
        // branch / use / cover / package data — dropdowns are empty until then so
        // an agency can't pick a setup that doesn't actually exist at the carrier.
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

    private static async Task SeedInsuranceCompaniesAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        var seed = new (string Code, string Name, string Country)[]
        {
            ("INTERAMERICAN", "Interamerican Ελληνική Ασφαλιστική", "GR"),
            ("ETHNIKI",      "Εθνική Ασφαλιστική",                 "GR"),
            ("EUROLIFE",     "Eurolife FFH",                       "GR"),
            ("ERGO",         "ERGO Ασφαλιστική",                   "GR"),
            ("ALLIANZ",      "Allianz Ελλάδος",                    "GR"),
            ("NN",           "NN Hellas",                          "GR"),
            ("GENERALI",     "Generali Hellas",                    "GR"),
            ("INTERLIFE",    "Interlife Α.Α.Ε.Γ.Α.",               "GR"),
            ("GRAND_COVER",  "Grand Cover (IW)",                    "GR")
        };

        var existing = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Select(c => c.Code).ToListAsync(ct);
        var missing = seed.Where(s => !existing.Contains(s.Code, StringComparer.OrdinalIgnoreCase)).ToList();
        if (missing.Count == 0) return;

        foreach (var s in missing)
        {
            db.InsuranceCompanies.Add(new InsuranceCompany
            {
                Id = Guid.NewGuid(),
                Code = s.Code,
                Name = s.Name,
                Country = s.Country,
                IsActive = true
            });
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} insurance companies.", missing.Count);
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
