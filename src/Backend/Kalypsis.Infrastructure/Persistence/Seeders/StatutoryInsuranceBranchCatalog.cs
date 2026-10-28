using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

public static class StatutoryInsuranceBranchCatalog
{
    public static async Task EnsureForTenantAsync(AppDbContext db, Guid tenantId, CancellationToken ct)
    {
        var owned = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .Select(x => x.Id).ToListAsync(ct);
        var used = await db.Policies.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .Select(x => x.InsuranceCompanyId).Distinct().ToListAsync(ct);
        foreach (var id in owned.Concat(used).Distinct())
            await EnsureForCompanyAsync(db, tenantId, id, ct);
    }

    public static readonly (string Code, string Name)[] VehicleUses =
    [
        ("01", "Επιβατικό Ιδιωτικής Χρήσης (Ε.Ι.Χ.)"),
        ("02", "Επιβατικό Ι.Χ. Ειδικό"),
        ("03", "Επιβατικό Ι.Χ. Ενοικιαζόμενο"),
        ("04", "Λεωφορείο"),
        ("05", "Ταξί"),
        ("06", "Φορτηγό Ιδιωτικής Χρήσης (Φ.Ι.Χ.)"),
        ("07", "Φορτηγό Δημόσιας Χρήσης (Φ.Δ.Χ.)"),
        ("08", "Φορτηγό Ι.Χ. Αγροτικό"),
        ("09", "Μηχάνημα Έργου (Μ.Ε.)"),
        ("10", "Αγροτικό Μηχάνημα"),
        ("11", "Μοτοσυκλέτα Ιδιωτικής Χρήσης"),
        ("12", "Μοτοσυκλέτα Ι.Χ. Ενοικιαζόμενη"),
        ("13", "Όχημα Σχολής Οδηγών"),
        ("14", "Όχημα Ιστορικού Ενδιαφέροντος"),
        ("15", "Αυτοκινούμενο Τροχόσπιτο"),
        ("16", "Νεκροφόρα"),
        ("17", "Ασθενοφόρο"),
        ("18", "Ρυμουλκούμενο / Trailer"),
        ("19", "Φορτηγό Κίνησης Εντός Αεροδρομίου"),
        ("20", "Όχημα Ταχυμεταφορών (Courier)")
    ];

    public static async Task EnsureForAllUsedCompaniesAsync(AppDbContext db, CancellationToken ct)
    {
        var owned = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId != null && x.DeletedAt == null)
            .Select(x => new { TenantId = x.TenantId!.Value, CompanyId = x.Id })
            .ToListAsync(ct);
        var withPolicies = await db.Policies.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .Select(x => new { x.TenantId, CompanyId = x.InsuranceCompanyId })
            .Distinct().ToListAsync(ct);
        foreach (var pair in owned.Concat(withPolicies).DistinctBy(x => (x.TenantId, x.CompanyId)))
            await EnsureForCompanyAsync(db, pair.TenantId, pair.CompanyId, ct);
    }

    public static readonly (string Code, string Name, string Category)[] Entries =
    [
        ("01", "Ατυχήματα", "Ζημιών"),
        ("02", "Ασθένειες", "Ζημιών"),
        ("03", "Χερσαία οχήματα (εκτός σιδηροδρομικών)", "Ζημιών"),
        ("04", "Σιδηροδρομικά οχήματα", "Ζημιών"),
        ("05", "Αεροσκάφη", "Ζημιών"),
        ("06", "Πλοία (θαλάσσια, λιμναία και ποτάμια σκάφη)", "Ζημιών"),
        ("07", "Μεταφερόμενα εμπορεύματα", "Ζημιών"),
        ("08", "Πυρκαϊά και στοιχεία της φύσεως", "Ζημιών"),
        ("09", "Λοιπές ζημίες αγαθών", "Ζημιών"),
        ("10", "Αστική ευθύνη από χερσαία αυτοκίνητα οχήματα", "Ζημιών"),
        ("11", "Αστική ευθύνη από αεροσκάφη", "Ζημιών"),
        ("12", "Αστική ευθύνη από θαλάσσια, λιμναία και ποτάμια σκάφη", "Ζημιών"),
        ("13", "Γενική αστική ευθύνη", "Ζημιών"),
        ("14", "Πιστώσεις", "Ζημιών"),
        ("15", "Εγγυήσεις", "Ζημιών"),
        ("16", "Διάφορες χρηματικές απώλειες", "Ζημιών"),
        ("17", "Νομική προστασία", "Ζημιών"),
        ("18", "Βοήθεια", "Ζημιών"),
        ("I", "Ασφαλίσεις ζωής", "Ζωής"),
        ("II", "Ασφαλίσεις γάμου και γεννήσεως", "Ζωής"),
        ("III", "Ασφαλίσεις ζωής συνδεδεμένες με επενδύσεις", "Ζωής"),
        ("IV", "Διαρκής ασφάλιση ασθένειας", "Ζωής"),
        ("V", "Τοντίνες", "Ζωής"),
        ("VI", "Εργασίες κεφαλαιοποίησης", "Ζωής"),
        ("VII", "Διαχείριση συλλογικών συνταξιοδοτικών κεφαλαίων ή οργανισμών", "Ζωής"),
        ("VIII", "Ασφαλίσεις του γαλλικού ασφαλιστικού κώδικα", "Ζωής"),
        ("IX", "Εργασίες κοινωνικής ασφάλισης", "Ζωής")
    ];

    public static async Task EnsureForCompanyAsync(AppDbContext db, Guid tenantId, Guid companyId, CancellationToken ct)
    {
        var existing = await db.StatutoryInsuranceBranches.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.InsuranceCompanyId == companyId)
            .ToListAsync(ct);
        var existingUses = await db.OfficeVehicleUses.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.InsuranceCompanyId == companyId)
            .ToListAsync(ct);
        var changed = false;
        for (var i = 0; i < Entries.Length; i++)
        {
            var entry = Entries[i];
            var row = existing.FirstOrDefault(x => string.Equals(x.SeedCode ?? x.Code, entry.Code, StringComparison.OrdinalIgnoreCase));
            if (row is not null)
            {
                if (row.SeedCode is null) { row.SeedCode = entry.Code; changed = true; }
                continue;
            }
            db.StatutoryInsuranceBranches.Add(new StatutoryInsuranceBranch
            {
                TenantId = tenantId, InsuranceCompanyId = companyId, Code = entry.Code, SeedCode = entry.Code,
                Name = entry.Name, Category = entry.Category, DisplayOrder = i + 1
            });
            changed = true;
        }
        for (var i = 0; i < VehicleUses.Length; i++)
        {
            var entry = VehicleUses[i];
            var row = existingUses.FirstOrDefault(x => string.Equals(x.SeedCode ?? x.Code, entry.Code, StringComparison.OrdinalIgnoreCase));
            if (row is not null)
            {
                if (row.SeedCode is null) { row.SeedCode = entry.Code; changed = true; }
                continue;
            }
            db.OfficeVehicleUses.Add(new OfficeVehicleUse
            {
                TenantId = tenantId, InsuranceCompanyId = companyId, Code = entry.Code, SeedCode = entry.Code,
                Name = entry.Name, DisplayOrder = i + 1
            });
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
    }
}
