using System.Reflection;
using System.Text.Json;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Seeds Ατλαντική Ένωση's official παραμετρικά (branches, vehicle uses,
/// coverages) into CompanyParameterItems keyed off the "ATLANTIC" global
/// carrier row. Data is extracted from their official ΠΑΡΑΜΕΤΡΙΚΑ.zip:
///
///   - branches.xls  → 20 κλάδοι (2=Αυτοκίνητο, 3=Πυρός, 9=Υγείας, …)
///   - Use.xls       → 104 χρήσεις οχημάτων (0=Ε.Ι.Χ., 200=Φ.Ι.Χ., …)
///   - Covers.xls    → 2648 καλύψεις κατά κλάδο (KLDCOD → CVRCOD)
///
/// Idempotent: keys off (InsuranceCompanyId, Kind, Code, ParentCode) and
/// only inserts what's missing, so re-running just fills gaps without
/// producing duplicates. The auto-import bridge (ParseAtlanticZip) picks
/// these up so the diff pass can validate branches/χρήσεις/καλύψεις
/// against the file it's importing.
/// </summary>
public static class AtlanticSeeder
{
    private record SeedFile(
        IReadOnlyList<BranchEntry> Branches,
        IReadOnlyList<UseEntry>    Uses,
        IReadOnlyList<CoverEntry>  Covers);

    private record BranchEntry(string Code, string Name, string? Short);
    private record UseEntry(string Code, string Name, string? Short, string? Type);
    private record CoverEntry(string Branch, string Code, string Name, string? Type);

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        var seed = LoadEmbedded();
        if (seed is null)
        {
            logger.LogWarning("Atlantic seed: embedded resource missing — nothing to seed.");
            return;
        }

        // Find / require the ATLANTIC global carrier row. The DataSeeder
        // cleanup guarantees exactly one after boot (see
        // CleanupNonGrandCoverGlobalsAsync's whitelist), so this should
        // always succeed on a healthy DB.
        var carrier = await db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Code == "ATLANTIC" && c.DeletedAt == null, ct);
        if (carrier is null)
        {
            logger.LogWarning("Atlantic seed: no ATLANTIC carrier row — DataSeeder cleanup should have created it.");
            return;
        }

        // Load existing (Kind, Code, ParentCode) tuples so we can skip
        // whatever's already there. Note we scope to this carrier only —
        // deletion/undelete of prior runs must not leak across carriers.
        var existing = await db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(x => x.InsuranceCompanyId == carrier.Id && x.DeletedAt == null)
            .Select(x => new { x.Kind, x.Code, x.ParentCode })
            .ToListAsync(ct);
        var seenKeys = existing
            .Select(x => Key(x.Kind, x.Code, x.ParentCode))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        int order = 0;
        int added = 0;

        // === Κλάδοι ===
        foreach (var br in seed.Branches)
        {
            var code = br.Code.Trim().PadLeft(2, '0');
            var key = Key(CompanyParameterItemKind.Branch, code, null);
            if (!seenKeys.Add(key)) continue;
            db.CompanyParameterItems.Add(new CompanyParameterItem
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = carrier.Id,
                Kind = CompanyParameterItemKind.Branch,
                Code = code,
                Name = TruncSafe(br.Name, 200),
                PolicyType = GuessBranchPolicyType(code, br.Name),
                IsActive = true,
                DisplayOrder = order++,
                Source = "Atlantic παραμετρικά",
                Notes = string.IsNullOrWhiteSpace(br.Short) ? null : br.Short,
                BridgeSystem = "ATLANTIC",
                BridgeCode = code
            });
            added++;
        }

        // === Χρήσεις οχημάτων === (all branch=02 Auto)
        foreach (var use in seed.Uses)
        {
            var code = use.Code.Trim();
            var key = Key(CompanyParameterItemKind.Use, code, null);
            if (!seenKeys.Add(key)) continue;
            db.CompanyParameterItems.Add(new CompanyParameterItem
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = carrier.Id,
                Kind = CompanyParameterItemKind.Use,
                Code = code,
                Name = TruncSafe(use.Name, 200),
                PolicyType = PolicyType.Auto,
                VehicleUseCategory = GuessVehicleUseCategory(code, use.Name),
                IsActive = true,
                DisplayOrder = order++,
                Source = "Atlantic παραμετρικά",
                Notes = use.Short,
                BridgeSystem = "ATLANTIC",
                BridgeCode = code
            });
            added++;
        }

        // === Καλύψεις === (~2600 rows) — batched save to keep memory sane.
        foreach (var cov in seed.Covers)
        {
            var branch = cov.Branch.Trim().PadLeft(2, '0');
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
                PolicyType = GuessBranchPolicyType(branch, null),
                IsActive = true,
                DisplayOrder = order++,
                Source = "Atlantic παραμετρικά",
                Notes = string.IsNullOrWhiteSpace(cov.Type) ? null : $"Type: {cov.Type}",
                BridgeSystem = "ATLANTIC",
                BridgeCode = code
            });
            added++;

            // Flush every 500 to avoid a giant ChangeTracker.
            if (added % 500 == 0)
            {
                await db.SaveChangesAsync(ct);
                foreach (var e in db.ChangeTracker.Entries().ToList())
                    e.State = EntityState.Detached;
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Atlantic seed: inserted {Count} παραμετρικά rows on ATLANTIC.", added);
        }
        else
        {
            logger.LogInformation("Atlantic seed: no new παραμετρικά to insert (already up to date).");
        }
    }

    private static string Key(CompanyParameterItemKind kind, string code, string? parent)
        => $"{(int)kind}|{code.ToUpperInvariant()}|{parent ?? ""}";

    private static string TruncSafe(string s, int max)
        => string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);

    /// <summary>Map an Atlantic branch code to the platform's PolicyType enum.
    /// Names come in Greek so we probe both code and name.</summary>
    private static PolicyType? GuessBranchPolicyType(string code, string? name)
    {
        // Fast path: hard-coded Atlantic branch codes we know.
        switch (code?.PadLeft(2, '0'))
        {
            case "01": return PolicyType.Life;            // Κλάδος Ζωής
            case "02": return PolicyType.Auto;            // Αυτοκινήτων
            case "03": return PolicyType.Home;            // Πυρός
            case "07": return PolicyType.Life;            // Προσωπικών ατυχ.
            case "09": return PolicyType.Health;          // Υγείας
            case "12": return PolicyType.Life;            // Ομαδικών
            case "15": return PolicyType.Health;          // Ασθενείας
        }
        if (!string.IsNullOrEmpty(name))
        {
            var upper = name.ToUpperInvariant();
            if (upper.Contains("ΖΩΗΣ")) return PolicyType.Life;
            if (upper.Contains("ΑΥΤΟΚΙΝΗΤ")) return PolicyType.Auto;
            if (upper.Contains("ΠΥΡ")) return PolicyType.Home;
            if (upper.Contains("ΥΓΕΙΑ") || upper.Contains("ΑΣΘΕΝ")) return PolicyType.Health;
            if (upper.Contains("ΤΑΞΙΔ")) return PolicyType.Travel;
            if (upper.Contains("ΕΠΙΧ") || upper.Contains("ΕΠΑΓΓ")) return PolicyType.Business;
        }
        return null;
    }

    /// <summary>Map an Atlantic use code to a VehicleUseCategory value.
    /// EIX/EDX/FIX/FDX/LIX/LDX are the Greek insurance-industry buckets;
    /// number-range → bucket mapping follows Atlantic's Use.xls layout.</summary>
    private static VehicleUseCategory? GuessVehicleUseCategory(string code, string name)
    {
        var upper = (name ?? "").ToUpperInvariant();
        // Short-code hint on the second column (Ε.Ι.Χ., Φ.Ι.Χ., ΛΕ., …).
        if (upper.Contains("Ε.Ι.Χ") || upper.Contains("ΕΠΙΒΑΤΙΚΟ ΙΔ")) return VehicleUseCategory.EIX;
        if (upper.Contains("Ε.Δ.Χ") || upper.Contains("ΤΑΞΙ"))          return VehicleUseCategory.EDX;
        if (upper.Contains("Φ.Ι.Χ") || upper.StartsWith("ΦΟΡΤΗΓΟ ΙΔ")) return VehicleUseCategory.FIX;
        if (upper.Contains("Φ.Δ.Χ") || upper.Contains("ΦΟΡΤΗΓΟ ΔΗ"))   return VehicleUseCategory.FDX;
        if (upper.Contains("Λ.Ι.Χ") || upper.Contains("ΛΕΩΦΟΡΕΙΟ ΙΔ")) return VehicleUseCategory.LIX;
        if (upper.Contains("Λ.Δ.Χ") || upper.Contains("ΛΕΩΦΟΡΕΙΟ ΔΗ")) return VehicleUseCategory.LDX;
        if (upper.Contains("ΜΟΤΟΣ") || upper.Contains("ΔΙΚΥΚΛ"))       return VehicleUseCategory.Motorcycle;
        if (upper.Contains("ΑΓΡΟΤΙΚ"))                                   return VehicleUseCategory.Agricultural;

        // Number-range fallback based on Atlantic's Use.xls layout:
        //   0–  99  → passenger private
        //   100–199 → passenger public / school / rental bus
        //   200–299 → truck private (Φ.Ι.Χ.)
        //   300–399 → truck public   (Φ.Δ.Χ.)
        //   400–499 → various (bus mixed)
        //   500–599 → taxi (Ε.Δ.Χ.)
        //   600–699 → motorcycle
        //   700+    → other
        if (int.TryParse(code, out var n))
        {
            if (n is >= 0 and <= 99)     return VehicleUseCategory.EIX;
            if (n is >= 100 and <= 199)  return VehicleUseCategory.LIX;
            if (n is >= 200 and <= 299)  return VehicleUseCategory.FIX;
            if (n is >= 300 and <= 399)  return VehicleUseCategory.FDX;
            if (n is >= 400 and <= 499)  return VehicleUseCategory.LDX;
            if (n is >= 500 and <= 599)  return VehicleUseCategory.EDX;
            if (n is >= 600 and <= 699)  return VehicleUseCategory.Motorcycle;
        }
        return null;
    }

    private static SeedFile? LoadEmbedded()
    {
        var asm = typeof(AtlanticSeeder).Assembly;
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("atlantic-parametrics.json", StringComparison.OrdinalIgnoreCase));
        if (name is null) return null;
        using var s = asm.GetManifestResourceStream(name);
        if (s is null) return null;
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return JsonSerializer.Deserialize<SeedFile>(s, opts);
    }
}
