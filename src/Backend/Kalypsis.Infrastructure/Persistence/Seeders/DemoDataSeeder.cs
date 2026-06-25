using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Phase 8 — Rich demo data so every screen has realistic content for
/// screenshots and pre-launch QA. Idempotent: re-running adds nothing the
/// second time. Gated by config flag <c>Seed:Demo</c> (defaults to true in
/// Development).
/// </summary>
public static class DemoDataSeeder
{
    private const string DemoTenantCode = "DEMO_AGENCY";
    private const string DemoAdminEmail = "demo@kalypsis.gr";
    private const string DemoUserEmail  = "user@kalypsis.gr";
    private const string DemoProducerEmail = "producer@kalypsis.gr";
    private const string DemoPassword = "Demo@2026!";

    private static readonly string[] FirstNamesM = { "Νίκος", "Γιώργος", "Δημήτρης", "Κώστας", "Πέτρος", "Στέλιος", "Μάνος", "Σταύρος", "Παύλος", "Άρης" };
    private static readonly string[] FirstNamesF = { "Μαρία", "Ελένη", "Άννα", "Σοφία", "Κατερίνα", "Δήμητρα", "Χριστίνα", "Νεφέλη", "Ιωάννα", "Αγγελική" };
    private static readonly string[] LastNames   = { "Παπαδάκης", "Γεωργίου", "Σταυρίδης", "Μιχαηλίδης", "Παππά", "Ζαφειρίου", "Νικολάου", "Πέτρου", "Ιωαννίδης", "Αντωνίου",
                                                     "Καλλιόπη", "Δρακάκης", "Σκουτέρης", "Καραγιάννης", "Βασιλάκης", "Σιδέρης", "Λαζαρίδης", "Πανταζής", "Κρανάκης", "Ψυχογιός" };
    private static readonly string[] Cities      = { "Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Ηράκλειο", "Λάρισα", "Βόλος", "Χανιά", "Ιωάννινα", "Καβάλα", "Σύρος" };
    private static readonly string[] Streets     = { "Ερμού", "Πατησίων", "Αλεξάνδρας", "Κηφισίας", "Βασ. Σοφίας", "Συγγρού", "Πειραιώς", "Σταδίου", "Ομονοίας", "Αχαρνών" };

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var clock = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DemoDataSeeder");

        // Off-switch for production environments.
        var enabled = (config["Seed:Demo"] ?? "true").Equals("true", StringComparison.OrdinalIgnoreCase);
        if (!enabled) { log.LogInformation("Demo seed disabled by config."); return; }

        // ----- 1. Tenant ---------------------------------------------------
        var tenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Code == DemoTenantCode, ct);
        if (tenant is null)
        {
            tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Δημόνστρα Ασφαλιστική Α.Ε.",
                Code = DemoTenantCode,
                IsActive = true,
                SubscriptionPlan = SubscriptionPlan.Pro,
                LogoUrl = null,
                BrandColorHex = "#0b2545",
                ContactEmail = "info@demo-asfaleies.gr",
                ContactPhone = "+30 210 9999000",
                AddressLine = "Λ. Κηφισίας 268, 152 32 Χαλάνδρι",
                VatNumber = "801234567",
                DefaultCurrency = "EUR",
                DefaultPolicyDurationMonths = 12,
                OnboardingCompletedAt = clock.UtcNow,
                CreatedAt = clock.UtcNow.AddMonths(-9)
            };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded demo tenant {Code}", DemoTenantCode);
        }

        // Demo tenant gets every package so screenshots and QA cover all features.
        // Idempotent — skips any grant that already exists (works even with soft-deleted
        // rows because the unique index includes deleted entries).
        var existingPkgs = await db.TenantPackageGrants.IgnoreQueryFilters()
            .Where(g => g.TenantId == tenant.Id).Select(g => g.Package).ToListAsync(ct);
        var missing = Enum.GetValues<PackageCode>().Where(p => !existingPkgs.Contains(p)).ToList();
        foreach (var pkg in missing)
        {
            db.TenantPackageGrants.Add(new TenantPackageGrant
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Package = pkg,
                EnabledAt = clock.UtcNow,
                Notes = "Demo seed — full feature set"
            });
        }
        if (missing.Count > 0)
        {
            await db.SaveChangesAsync(ct);
            log.LogInformation("Granted {Count} packages to demo tenant", missing.Count);
        }

        var rng = new Random(unchecked((int)tenant.Id.GetHashCode()));

        // ----- 2. Users (AgencyAdmin + AgencyUser + Producer) --------------
        await EnsureUserAsync(db, hasher, clock, tenant.Id, DemoAdminEmail, "Νίκος", "Παπαδάκης",
            Role.AgencyAdmin, isActive: true, ct);
        await EnsureUserAsync(db, hasher, clock, tenant.Id, DemoUserEmail, "Ελένη", "Γεωργίου",
            Role.AgencyUser, isActive: true, ct);
        await EnsureUserAsync(db, hasher, clock, tenant.Id, DemoProducerEmail, "Δημήτρης", "Σταυρίδης",
            Role.Producer, isActive: true, ct);

        // ----- 3. Producers ------------------------------------------------
        if (!await db.Producers.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenant.Id, ct))
        {
            var producerSeeds = new[]
            {
                ("P001", "Δ. Σταυρίδης",  "dim.stav@demo.gr",  "6970000001"),
                ("P002", "Α. Μιχαηλίδη", "ann.mich@demo.gr",  "6970000002"),
                ("P003", "Σ. Πέτρου",     "spy.petr@demo.gr",  "6970000003"),
                ("P004", "Μ. Ζαφειρίου", "mar.zaf@demo.gr",   "6970000004"),
                ("P005", "Κ. Νικολάου",   "kos.nic@demo.gr",   "6970000005")
            };
            foreach (var (code, name, email, phone) in producerSeeds)
            {
                db.Producers.Add(new Producer
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Code = code,
                    Name = name,
                    Email = email,
                    Phone = phone,
                    Status = ProducerStatus.Active,
                    CreatedAt = clock.UtcNow.AddMonths(-rng.Next(3, 9))
                });
            }
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded 5 producers");
        }

        var producers = await db.Producers.IgnoreQueryFilters().Where(p => p.TenantId == tenant.Id).ToListAsync(ct);

        // ----- 4. Customers -------------------------------------------------
        if (!await db.Customers.IgnoreQueryFilters().AnyAsync(c => c.TenantId == tenant.Id && c.CustomerNumber.StartsWith("DEMO-"), ct))
        {
            for (var i = 1; i <= 25; i++)
            {
                var female = rng.Next(2) == 0;
                var first = (female ? FirstNamesF : FirstNamesM)[rng.Next(10)];
                var last = LastNames[rng.Next(LastNames.Length)] + (female ? "" : "");
                var customer = new Customer
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    CustomerNumber = $"DEMO-{i:D4}",
                    Type = CustomerType.Individual,
                    Status = CustomerStatus.Active,
                    FirstName = first,
                    LastName = last,
                    Email = $"{Latinize(first.ToLowerInvariant())}.{Latinize(last.ToLowerInvariant())}{i}@example.gr",
                    MobilePhone = $"69{rng.Next(10000000, 99999999)}",
                    Phone = $"21{rng.Next(10000000, 99999999)}",
                    VatNumber = $"{rng.Next(100000000, 999999999)}",
                    City = Cities[rng.Next(Cities.Length)],
                    Address = $"{Streets[rng.Next(Streets.Length)]} {rng.Next(1, 250)}",
                    PostalCode = $"{rng.Next(10000, 99999)}",
                    BirthDate = DateOnly.FromDateTime(clock.UtcNow.AddYears(-(20 + rng.Next(50))).AddDays(-rng.Next(365))),
                    Gender = female ? "Female" : "Male",
                    Source = (new[] { "referral", "web", "walk-in", "ad" })[rng.Next(4)],
                    CreatedAt = clock.UtcNow.AddDays(-rng.Next(1, 270))
                };
                db.Customers.Add(customer);
            }
            // 5 business customers
            for (var i = 1; i <= 5; i++)
            {
                db.Customers.Add(new Customer
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    CustomerNumber = $"DEMO-B-{i:D3}",
                    Type = CustomerType.Company,
                    Status = CustomerStatus.Active,
                    CompanyName = $"{LastNames[rng.Next(LastNames.Length)]} & Co {(new[] { "Α.Ε.", "Ε.Π.Ε.", "Ι.Κ.Ε.", "Ο.Ε." })[rng.Next(4)]}",
                    VatNumber = $"{rng.Next(100000000, 999999999)}",
                    TaxOffice = "ΦΑΕ Αθηνών",
                    LegalForm = "ΑΕ",
                    Email = $"contact{i}@demo-business.gr",
                    Phone = $"21{rng.Next(10000000, 99999999)}",
                    City = Cities[rng.Next(Cities.Length)],
                    Address = $"{Streets[rng.Next(Streets.Length)]} {rng.Next(1, 250)}",
                    CreatedAt = clock.UtcNow.AddDays(-rng.Next(1, 365))
                });
            }
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded 30 customers (25 individuals + 5 businesses)");
        }

        var customers = await db.Customers.IgnoreQueryFilters().Where(c => c.TenantId == tenant.Id).ToListAsync(ct);
        var companies = await db.InsuranceCompanies.IgnoreQueryFilters().ToListAsync(ct);
        if (companies.Count == 0)
        {
            log.LogWarning("No InsuranceCompanies — cannot seed demo policies");
            return;
        }

        // ----- 5. Policies --------------------------------------------------
        if (!await db.Policies.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenant.Id && p.PolicyNumber.StartsWith("DEMO-"), ct))
        {
            var policyTypes = Enum.GetValues<PolicyType>();
            for (var i = 1; i <= 50; i++)
            {
                var cust = customers[rng.Next(customers.Count)];
                var company = companies[rng.Next(companies.Count)];
                var producer = producers.Count > 0 ? producers[rng.Next(producers.Count)] : null;
                var type = policyTypes[rng.Next(policyTypes.Length)];
                var start = DateOnly.FromDateTime(clock.UtcNow.AddDays(-rng.Next(0, 300)));
                var end = start.AddYears(1);
                var status = end < DateOnly.FromDateTime(clock.UtcNow.AddDays(0))
                    ? PolicyStatus.Expired
                    : (i % 9 == 0 ? PolicyStatus.Cancelled : PolicyStatus.Active);
                var premium = type switch
                {
                    PolicyType.Auto => 250 + rng.Next(400),
                    PolicyType.Home => 180 + rng.Next(220),
                    PolicyType.Health => 420 + rng.Next(800),
                    PolicyType.Life => 380 + rng.Next(600),
                    PolicyType.Business => 600 + rng.Next(1400),
                    _ => 200 + rng.Next(300)
                };
                db.Policies.Add(new Policy
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PolicyNumber = $"DEMO-{type.ToString().ToUpperInvariant()[..3]}-{2026}-{i:D5}",
                    CustomerId = cust.Id,
                    InsuranceCompanyId = company.Id,
                    ProducerId = producer?.Id,
                    PolicyType = type,
                    Status = status,
                    StartDate = start,
                    EndDate = end,
                    Premium = premium,
                    Currency = "EUR",
                    PaymentFrequency = (PaymentFrequency)(rng.Next(3) switch { 0 => PaymentFrequency.Annual, 1 => PaymentFrequency.Semiannual, _ => PaymentFrequency.Quarterly }),
                    PremiumIncludesVat = true,
                    CreatedAt = clock.UtcNow.AddDays(-rng.Next(0, 365))
                });
            }
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded 50 policies");
        }

        // ----- 6. AgencyOffices for the demo tenant (multi-branch) ---------
        if (!await db.AgencyOffices.IgnoreQueryFilters().AnyAsync(o => o.TenantId == tenant.Id, ct))
        {
            db.AgencyOffices.Add(new AgencyOffice {
                Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "HQ", Name = "Κεντρικά Αθήνας",
                City = "Αθήνα", Address = "Λ. Κηφισίας 268", PostalCode = "15232", Phone = "2106000000",
                IsHeadquarters = true, IsActive = true, CreatedAt = clock.UtcNow.AddMonths(-9)
            });
            db.AgencyOffices.Add(new AgencyOffice {
                Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "THES", Name = "Υποκατάστημα Θεσσαλονίκης",
                City = "Θεσσαλονίκη", PostalCode = "54622", IsHeadquarters = false, IsActive = true,
                CreatedAt = clock.UtcNow.AddMonths(-6)
            });
            db.AgencyOffices.Add(new AgencyOffice {
                Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "PAT", Name = "Υποκατάστημα Πατρών",
                City = "Πάτρα", IsHeadquarters = false, IsActive = true,
                CreatedAt = clock.UtcNow.AddMonths(-3)
            });
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded 3 offices");
        }

        // ----- 7. Active TenantContract for demo tenant --------------------
        if (!await db.TenantContracts.IgnoreQueryFilters().AnyAsync(c => c.TenantId == tenant.Id && c.IsActive, ct))
        {
            db.TenantContracts.Add(new TenantContract {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                ContractNumber = "KAL-2026-DEMO",
                SignedAt = DateOnly.FromDateTime(clock.UtcNow.AddMonths(-9)),
                EffectiveFrom = DateOnly.FromDateTime(clock.UtcNow.AddMonths(-9)),
                EffectiveTo = null,
                Plan = "Pro",
                MonthlyBaseAmount = 89m,
                OfficeSurchargePerExtra = 25m,
                OfficeIncludedCount = 1,
                Currency = "EUR",
                AutoRenew = true,
                RenewalTermMonths = 12,
                SignedByName = "Νίκος Παπαδάκης",
                SignedByEmail = DemoAdminEmail,
                SignedByRole = "Διευθύνων Σύμβουλος",
                IsActive = true,
                CreatedAt = clock.UtcNow.AddMonths(-9)
            });
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded active contract");
        }

        // ----- 8. Tenant subscription (so MRR computes correctly) ----------
        if (!await db.TenantSubscriptions.IgnoreQueryFilters().AnyAsync(s => s.TenantId == tenant.Id, ct))
        {
            db.TenantSubscriptions.Add(new TenantSubscription {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                ProviderCode = "stub",
                Plan = "Pro",
                State = SubscriptionState.Active,
                CurrentPeriodStart = DateOnly.FromDateTime(clock.UtcNow.AddDays(-15)),
                CurrentPeriodEnd = DateOnly.FromDateTime(clock.UtcNow.AddDays(15)),
                OfficeIncludedCount = 1,
                OfficeSurchargeAmount = 25m,
                OfficeSurchargeCurrency = "EUR"
            });
            await db.SaveChangesAsync(ct);
            log.LogInformation("Seeded subscription");
        }

        log.LogInformation("Demo data seed complete for tenant {Tenant}", tenant.Code);
    }

    private static async Task EnsureUserAsync(
        AppDbContext db, IPasswordHasher hasher, IDateTimeProvider clock,
        Guid tenantId, string email, string first, string last, Role role, bool isActive, CancellationToken ct)
    {
        var exists = await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, ct);
        if (exists) return;
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            FirstName = first,
            LastName = last,
            PasswordHash = hasher.Hash(DemoPassword),
            Role = role,
            IsActive = isActive,
            PreferredLanguage = "el",
            CreatedAt = clock.UtcNow.AddMonths(-6)
        });
        await db.SaveChangesAsync(ct);
    }

    private static string Latinize(string greek)
    {
        var map = new Dictionary<char, string> {
            ['α'] = "a", ['β'] = "v", ['γ'] = "g", ['δ'] = "d", ['ε'] = "e", ['ζ'] = "z", ['η'] = "i",
            ['θ'] = "th", ['ι'] = "i", ['κ'] = "k", ['λ'] = "l", ['μ'] = "m", ['ν'] = "n", ['ξ'] = "x",
            ['ο'] = "o", ['π'] = "p", ['ρ'] = "r", ['σ'] = "s", ['ς'] = "s", ['τ'] = "t", ['υ'] = "y",
            ['φ'] = "f", ['χ'] = "ch", ['ψ'] = "ps", ['ω'] = "o", ['ά'] = "a", ['έ'] = "e", ['ή'] = "i",
            ['ί'] = "i", ['ό'] = "o", ['ύ'] = "y", ['ώ'] = "o"
        };
        return string.Concat(greek.Select(c => map.TryGetValue(c, out var s) ? s : c.ToString()));
    }
}
