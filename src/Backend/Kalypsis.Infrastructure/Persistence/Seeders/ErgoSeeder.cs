using System.Text.Json;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Seeds ERGO Hellas's official cover codes into CompanyParameterItems
/// keyed off the "ERGO" global carrier. Data was extracted from ERGO's
/// «Κωδικοποίηση και περιγραφή» PDF and lives at
/// Resources/ergo-parametrics.json.
///
/// ERGO's coverage codes use a Greek-letter prefix that implicitly
/// identifies the line of business:
///   Α — Auto     (Α1001 Θάνατος, Α1210 Ίδιες ζημιές, Α1901 Σωματικές βλάβες, …)
///   Φ — Fire     (Φ1003 Μόνιμη Μερική Ανικανότητα, Φ1801 Κλοπή χρημάτων, …)
///   Π — Personal (Π1003–Π1006 προσωπικά ατυχήματα)
///   Ε — Employer (Ε5006–Ε5008 εργοδοτική αστική ευθύνη)
///   Τ — Technical(Τ1805–Τ1807 λέβητας, μηχανήματα)
///   Λ — Loans    (Λ1818 ακούσια ανεργία)
///   Μ — Cargo    (Μεταφορές)
///   Σ — Special  (Σ01 Απαλλαγές — special terms)
/// We synthesise a Branch row per prefix so ApplyDiffsAsync's branch
/// diff has a target to look up.
/// </summary>
public static class ErgoSeeder
{
    private record SeedFile(
        IReadOnlyList<BranchEntry> Branches,
        IReadOnlyList<CoverEntry>  Covers);

    private record BranchEntry(string Code, string Name, string? PolicyType);
    private record CoverEntry(string Branch, string Code, string Name, string? Short);

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        var seed = LoadEmbedded();
        if (seed is null)
        {
            logger.LogWarning("ERGO seed: embedded resource missing — nothing to seed.");
            return;
        }

        var carrier = await db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Code == "ERGO" && c.DeletedAt == null, ct);
        if (carrier is null)
        {
            logger.LogWarning("ERGO seed: no ERGO carrier row — DataSeeder cleanup should have created it.");
            return;
        }

        var existing = await db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(x => x.InsuranceCompanyId == carrier.Id && x.DeletedAt == null)
            .Select(x => new { x.Kind, x.Code, x.ParentCode })
            .ToListAsync(ct);
        var seenKeys = existing
            .Select(x => Key(x.Kind, x.Code, x.ParentCode))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        int order = 0;
        int added = 0;

        foreach (var br in seed.Branches)
        {
            var code = br.Code.Trim().ToUpperInvariant();
            var key = Key(CompanyParameterItemKind.Branch, code, null);
            if (!seenKeys.Add(key)) continue;
            db.CompanyParameterItems.Add(new CompanyParameterItem
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = carrier.Id,
                Kind = CompanyParameterItemKind.Branch,
                Code = code,
                Name = TruncSafe(br.Name, 200),
                PolicyType = ParsePolicyType(br.PolicyType),
                IsActive = true,
                DisplayOrder = order++,
                Source = "ERGO κωδικοποίηση",
                BridgeSystem = "ERGO",
                BridgeCode = code
            });
            added++;
        }

        foreach (var cov in seed.Covers)
        {
            var branch = cov.Branch.Trim().ToUpperInvariant();
            var code = cov.Code.Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(code)) continue;
            var key = Key(CompanyParameterItemKind.Coverage, code, branch);
            if (!seenKeys.Add(key)) continue;
            db.CompanyParameterItems.Add(new CompanyParameterItem
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = carrier.Id,
                Kind = CompanyParameterItemKind.Coverage,
                Code = code,
                Name = TruncSafe(cov.Name, 200),
                ParentCode = branch,
                PolicyType = ParsePolicyType(seed.Branches.FirstOrDefault(b => b.Code == cov.Branch)?.PolicyType),
                IsActive = true,
                DisplayOrder = order++,
                Source = "ERGO κωδικοποίηση",
                Notes = cov.Short,
                BridgeSystem = "ERGO",
                BridgeCode = code
            });
            added++;

            if (added % 250 == 0)
            {
                await db.SaveChangesAsync(ct);
                foreach (var e in db.ChangeTracker.Entries().ToList())
                    e.State = EntityState.Detached;
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("ERGO seed: inserted {Count} παραμετρικά rows on ERGO.", added);
        }
        else
        {
            logger.LogInformation("ERGO seed: no new παραμετρικά to insert (already up to date).");
        }

        // Backfill: any Κάλυψη row seeded before we started resolving
        // PolicyType from the parent branch would still have null → hidden
        // when a Κλάδος filter is applied on production lists / commission
        // rules / claims / bulk commissions. Runs on every boot; idempotent.
        var covBackfilled = await BackfillCoveragePolicyTypeAsync(db, carrier.Id, seed.Branches, ct);
        if (covBackfilled > 0)
            logger.LogInformation("ERGO seed: backfilled PolicyType on {Count} Κάλυψη row(s).", covBackfilled);
    }

    /// <summary>Fill in PolicyType on Coverage rows where the parent
    /// branch has a known PolicyType in the seed JSON but the row was
    /// inserted with null. Also updates rows attached to a Branch whose
    /// own PolicyType was later corrected. Case-insensitive branch
    /// lookup so a re-casing of ParentCode doesn't break the join.</summary>
    private static async Task<int> BackfillCoveragePolicyTypeAsync(
        AppDbContext db, Guid carrierId, IReadOnlyList<BranchEntry> branches, CancellationToken ct)
    {
        var lookup = branches
            .Where(b => !string.IsNullOrWhiteSpace(b.PolicyType))
            .ToDictionary(
                b => b.Code.Trim().ToUpperInvariant(),
                b => ParsePolicyType(b.PolicyType),
                StringComparer.OrdinalIgnoreCase);
        if (lookup.Count == 0) return 0;
        var rows = await db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(p => p.InsuranceCompanyId == carrierId
                && p.Kind == CompanyParameterItemKind.Coverage
                && p.DeletedAt == null
                && p.PolicyType == null
                && p.ParentCode != null)
            .ToListAsync(ct);
        int updated = 0;
        foreach (var r in rows)
        {
            if (lookup.TryGetValue((r.ParentCode ?? "").Trim().ToUpperInvariant(), out var pt) && pt.HasValue)
            {
                r.PolicyType = pt;
                updated++;
            }
        }
        if (updated > 0) await db.SaveChangesAsync(ct);
        return updated;
    }

    private static string Key(CompanyParameterItemKind kind, string code, string? parent)
        => $"{(int)kind}|{code.ToUpperInvariant()}|{parent ?? ""}";

    private static string TruncSafe(string s, int max)
        => string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);

    private static PolicyType? ParsePolicyType(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        return Enum.TryParse<PolicyType>(s, ignoreCase: true, out var v) ? v : null;
    }

    private static SeedFile? LoadEmbedded()
    {
        var asm = typeof(ErgoSeeder).Assembly;
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("ergo-parametrics.json", StringComparison.OrdinalIgnoreCase));
        if (name is null) return null;
        using var s = asm.GetManifestResourceStream(name);
        if (s is null) return null;
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return JsonSerializer.Deserialize<SeedFile>(s, opts);
    }
}
