using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

public static class StatutoryInsuranceBranchCatalog
{
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
            .ToDictionaryAsync(x => x.Code, StringComparer.Ordinal, ct);
        var changed = false;
        for (var i = 0; i < Entries.Length; i++)
        {
            var entry = Entries[i];
            if (existing.TryGetValue(entry.Code, out var row))
            {
                if (row.DeletedAt is null && row.Name == entry.Name && row.Category == entry.Category && row.DisplayOrder == i + 1) continue;
                row.DeletedAt = null;
                row.Name = entry.Name;
                row.Category = entry.Category;
                row.DisplayOrder = i + 1;
                changed = true;
                continue;
            }
            db.StatutoryInsuranceBranches.Add(new StatutoryInsuranceBranch
            {
                TenantId = tenantId, InsuranceCompanyId = companyId, Code = entry.Code,
                Name = entry.Name, Category = entry.Category, DisplayOrder = i + 1
            });
            changed = true;
        }
        if (changed) await db.SaveChangesAsync(ct);
    }
}
