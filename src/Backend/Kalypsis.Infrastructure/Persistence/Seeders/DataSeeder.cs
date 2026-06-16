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

        await SeedInsuranceCompaniesAsync(db, logger, cancellationToken);

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
                SubscriptionPlan = SubscriptionPlan.Enterprise
            };
            db.Tenants.Add(platformTenant);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded platform tenant.");
        }

        var exists = await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Role == Role.PlatformAdmin, cancellationToken);
        if (exists)
        {
            logger.LogInformation("Platform admin already exists; skipping seed.");
            return;
        }

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
            ("INTERLIFE",    "Interlife Α.Α.Ε.Γ.Α.",               "GR")
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
}
