using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Idempotent bootstrap for the InsureOne partner desk.  Branding is created
/// for every existing office so a Coolify redeploy immediately exposes a
/// working, office-specific login URL.  Only the clearly marked demo tenant
/// receives demo credentials; real offices are never given a user or password
/// implicitly.
/// </summary>
public static class InsureOneSeeder
{
    private const string DemoTenantCode = "DEMO_AGENCY";
    private const string DemoPartnerEmail = "insureone.partner@demo.kalypsis.gr";
    private const string DemoPartnerLoginCode = "demo-partner";
    private const string DemoPartnerPassword = "DemoPartner@2026!";

    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("InsureOneSeeder");

        try
        {
            await SeedOfficeSettingsAsync(db, logger, cancellationToken);
            await SeedLancaPartnerPortalAsync(db, logger, cancellationToken);
            await SeedDemoPartnerAsync(db, hasher, logger, cancellationToken);
        }
        catch (Exception ex)
        {
            // InsureOne is additive.  A transient optional seed problem must
            // not take the API back into the startup retry loop.
            logger.LogError(ex, "InsureOne bootstrap failed; continuing without optional seed changes.");
        }
    }

    /// <summary>
    /// Installs the first branded partner portal for LANCA without coupling
    /// the identity of the portal to an email address.  The email is used
    /// only for the initial discovery of the existing office; after the
    /// settings row is created, the stable office id and slug own the portal.
    /// No real partner credentials are created here.
    /// </summary>
    private static async Task SeedLancaPartnerPortalAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        const string slug = "lanca";
        const string contactEmail = "info@lanca1.gr";
        var settings = await db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .Include(x => x.AgencyOffice)
            .FirstOrDefaultAsync(x => x.Slug == slug && x.DeletedAt == null, ct);

        AgencyOffice? office = settings?.AgencyOffice;
        if (office is null)
        {
            var user = await db.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Email == contactEmail && x.DeletedAt == null, ct);
            if (user is not null)
            {
                office = await db.AgencyOffices.IgnoreQueryFilters()
                    .Where(x => x.TenantId == user.TenantId && x.IsActive && x.DeletedAt == null)
                    .OrderByDescending(x => x.IsHeadquarters).ThenBy(x => x.CreatedAt)
                    .FirstOrDefaultAsync(ct);
            }

            office ??= await db.AgencyOffices.IgnoreQueryFilters()
                .Where(x => x.IsActive && x.DeletedAt == null && x.Email != null && x.Email.ToLower() == contactEmail)
                .OrderByDescending(x => x.IsHeadquarters).ThenBy(x => x.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (office is null)
            {
                var tenant = await db.Tenants.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.ContactEmail != null && x.ContactEmail.ToLower() == contactEmail && x.DeletedAt == null, ct);
                if (tenant is not null)
                    office = await db.AgencyOffices.IgnoreQueryFilters()
                        .Where(x => x.TenantId == tenant.Id && x.IsActive && x.DeletedAt == null)
                        .OrderByDescending(x => x.IsHeadquarters).ThenBy(x => x.CreatedAt)
                        .FirstOrDefaultAsync(ct);
            }
        }

        if (office is null) return;
        settings ??= await db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == office.TenantId && x.AgencyOfficeId == office.Id && x.DeletedAt == null, ct);
        if (settings is null) return;

        var slugTaken = await db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .AnyAsync(x => x.Slug == slug && x.Id != settings.Id && x.DeletedAt == null, ct);
        if (slugTaken) return;

        var changed = false;
        if (!string.Equals(settings.Slug, slug, StringComparison.Ordinal)) { settings.Slug = slug; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.DisplayName) || string.Equals(settings.DisplayName, office.Name, StringComparison.OrdinalIgnoreCase)) { settings.DisplayName = "LANCA Insurance"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.WelcomeMessage)) { settings.WelcomeMessage = "Ασφαλής πρόσβαση στην πύλη συνεργατών της LANCA Insurance."; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.PrimaryColor) || string.Equals(settings.PrimaryColor, "#0B5CAB", StringComparison.OrdinalIgnoreCase)) { settings.PrimaryColor = "#0877E8"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.SecondaryColor) || string.Equals(settings.SecondaryColor, "#16A6C9", StringComparison.OrdinalIgnoreCase)) { settings.SecondaryColor = "#082B5C"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.SupportEmail)) { settings.SupportEmail = office.Email ?? contactEmail; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LoginTitle)) { settings.LoginTitle = "Πύλη Συνεργατών"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LoginSubtitle) || string.Equals(settings.LoginSubtitle, "Συνδεθείτε για να διαχειριστείτε τις προσφορές και τις εργασίες σας.", StringComparison.Ordinal)) { settings.LoginSubtitle = "Ασφαλής πρόσβαση για συνεργάτες, πρακτορεία και δίκτυο πωλήσεων."; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LoginSecurityText) || string.Equals(settings.LoginSecurityText, "Ασφαλής και κρυπτογραφημένη σύνδεση", StringComparison.Ordinal)) { settings.LoginSecurityText = "Ασφαλής σύνδεση"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LoginSupportLabel)) { settings.LoginSupportLabel = "Χρειάζεστε βοήθεια; Επικοινωνήστε με το γραφείο σας."; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LogoPath)) { settings.LogoPath = "/assets/lanca-insureone-logo.png"; changed = true; }
        if (string.IsNullOrWhiteSpace(settings.LoginBackgroundPath)) { settings.LoginBackgroundPath = "/assets/insureone-partner-portal-bg.png"; changed = true; }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("InsureOne branded portal ready at /insureone/{Slug}/login for office {OfficeId}.", slug, office.Id);
        }
    }

    private static async Task SeedOfficeSettingsAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        var offices = await db.AgencyOffices.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null && x.IsActive)
            .OrderBy(x => x.TenantId).ThenByDescending(x => x.IsHeadquarters).ThenBy(x => x.CreatedAt)
            .ToListAsync(ct);
        if (offices.Count == 0) return;

        var existing = await db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .ToListAsync(ct);
        var byOffice = existing.ToDictionary(x => (x.TenantId, x.AgencyOfficeId));
        var usedSlugs = existing.Select(x => x.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = 0;

        foreach (var office in offices)
        {
            if (byOffice.ContainsKey((office.TenantId, office.Id))) continue;

            var tenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == office.TenantId, ct);
            var baseSlug = Slugify(office.Code);
            if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = Slugify(office.Name);
            if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = $"office-{office.Id.ToString("N")[..8]}";
            var slug = MakeUniqueSlug(baseSlug, usedSlugs, office.Id);

            var settings = new InsureOneOfficeSettings
            {
                Id = Guid.NewGuid(),
                TenantId = office.TenantId,
                AgencyOfficeScopeId = office.Id,
                AgencyOfficeId = office.Id,
                Slug = slug,
                IsEnabled = true,
                DisplayName = office.Name,
                WelcomeMessage = "Συνδεθείτε στο InsureOne του γραφείου σας για γρήγορη τιμολόγηση και διαχείριση συνεργασιών.",
                PrimaryColor = "#0b5cab",
                SecondaryColor = "#16a6c9",
                SupportEmail = office.Email ?? tenant?.ContactEmail,
                SupportPhone = office.Phone ?? tenant?.ContactPhone,
                AllowedBranchesJson = "[]",
                CreatedAt = DateTime.UtcNow
            };
            db.InsureOneOfficeSettings.Add(settings);
            byOffice[(office.TenantId, office.Id)] = settings;
            usedSlugs.Add(slug);
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("InsureOne bootstrap: created {Count} office branding profile(s).", added);
        }
    }

    private static async Task SeedDemoPartnerAsync(AppDbContext db, IPasswordHasher hasher, ILogger logger, CancellationToken ct)
    {
        var tenant = await db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Code == DemoTenantCode && x.DeletedAt == null, ct);
        if (tenant is null) return;

        var office = await db.AgencyOffices.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.IsActive && x.DeletedAt == null)
            .OrderByDescending(x => x.IsHeadquarters).ThenBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);
        var producer = await db.Producers.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null)
            .OrderBy(x => x.Code)
            .FirstOrDefaultAsync(ct);
        if (office is null || producer is null) return;

        var settings = await db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.AgencyOfficeId == office.Id && x.DeletedAt == null, ct);
        if (settings is null) return;
        // The stable demo slug makes walkthrough links easy to remember while
        // retaining the normal per-office slug model for every real tenant.
        if (!string.Equals(settings.Slug, "demo", StringComparison.OrdinalIgnoreCase))
        {
            var demoSlugInUse = await db.InsureOneOfficeSettings.IgnoreQueryFilters()
                .AnyAsync(x => x.Slug == "demo" && x.Id != settings.Id && x.DeletedAt == null, ct);
            if (!demoSlugInUse) settings.Slug = "demo";
        }

        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Email == DemoPartnerEmail, ct);
        if (user is not null && user.TenantId != tenant.Id) return;
        user ??= new User { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        user.TenantId = tenant.Id;
        user.Email = DemoPartnerEmail;
        user.FirstName = "Demo";
        user.LastName = "InsureOne συνεργάτης";
        user.Phone = producer.Phone;
        user.PasswordHash = hasher.Hash(DemoPartnerPassword);
        user.Role = Role.Producer;
        user.ProducerId = producer.Id;
        user.IsActive = true;
        user.DeletedAt = null;
        user.PreferredLanguage = "el";
        if (user.Id != Guid.Empty && !await db.Users.IgnoreQueryFilters().AnyAsync(x => x.Id == user.Id, ct))
            db.Users.Add(user);

        var assignment = await db.UserAgencyOffices.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.UserId == user.Id && x.AgencyOfficeId == office.Id, ct);
        if (assignment is null)
            db.UserAgencyOffices.Add(new UserAgencyOffice
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = user.Id,
                AgencyOfficeId = office.Id, IsPrimary = true, CreatedAt = DateTime.UtcNow
            });
        else
        {
            assignment.DeletedAt = null;
            assignment.IsPrimary = true;
        }

        var access = await db.PartnerPortalAccesses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.ProducerId == producer.Id, ct);
        access ??= new PartnerPortalAccess { Id = Guid.NewGuid(), TenantId = tenant.Id, ProducerId = producer.Id, CreatedAt = DateTime.UtcNow };
        access.UserId = user.Id;
        access.LoginCode = DemoPartnerLoginCode;
        access.IsActive = true;
        access.DeletedAt = null;
        access.CanIssuePolicies = true;
        access.CanViewCommissions = true;
        access.CanViewCustomers = true;
        access.PermissionsJson = JsonSerializer.Serialize(new[] { "quoting.read", "quoting.create", "quotes.save", "quotes.history", "quotes.export", "customers.read", "policies.read", "commissions.read" });
        access.Notes = "Demo InsureOne συνεργάτης — credentials are for presentation only.";
        access.AgencyOfficeScopeId = office.Id;
        if (!await db.PartnerPortalAccesses.IgnoreQueryFilters().AnyAsync(x => x.Id == access.Id, ct))
            db.PartnerPortalAccesses.Add(access);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("InsureOne demo partner ready at /insureone/{Slug}/login (code {Code}).", settings.Slug, DemoPartnerLoginCode);
    }

    private static string MakeUniqueSlug(string baseSlug, ISet<string> used, Guid officeId)
    {
        var candidate = baseSlug;
        if (!used.Contains(candidate)) return candidate;
        var suffix = officeId.ToString("N")[..6];
        candidate = $"{baseSlug}-{suffix}";
        var index = 2;
        while (used.Contains(candidate)) candidate = $"{baseSlug}-{suffix}-{index++}";
        return candidate;
    }

    private static string Slugify(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var normalized = value.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            var mapped = character switch
            {
                'α' or 'Α' => "a", 'β' or 'Β' => "v", 'γ' or 'Γ' => "g", 'δ' or 'Δ' => "d",
                'ε' or 'Ε' => "e", 'ζ' or 'Ζ' => "z", 'η' or 'Η' => "i", 'θ' or 'Θ' => "th",
                'ι' or 'Ι' => "i", 'κ' or 'Κ' => "k", 'λ' or 'Λ' => "l", 'μ' or 'Μ' => "m",
                'ν' or 'Ν' => "n", 'ξ' or 'Ξ' => "x", 'ο' or 'Ο' => "o", 'π' or 'Π' => "p",
                'ρ' or 'Ρ' => "r", 'σ' or 'ς' or 'Σ' => "s", 'τ' or 'Τ' => "t", 'υ' or 'Υ' => "y",
                'φ' or 'Φ' => "f", 'χ' or 'Χ' => "ch", 'ψ' or 'Ψ' => "ps", 'ω' or 'Ω' => "o",
                _ => character.ToString().ToLowerInvariant()
            };
            if (mapped.Length == 1 && char.IsLetterOrDigit(mapped[0])) sb.Append(mapped);
            else if (mapped.Length > 1) sb.Append(mapped);
            else if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
        }
        return Regex.Replace(sb.ToString().Trim('-'), "[^a-z0-9-]", "").Trim('-');
    }
}
