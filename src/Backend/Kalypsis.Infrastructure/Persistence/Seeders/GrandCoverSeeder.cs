using System.Reflection;
using System.Text.Json;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// One-shot seeder that ingests the IW Παραμετρικά xlsx (pre-extracted into
/// Resources/grand-cover-seed.json) into the database:
///
///   - Grand Cover (IW) carrier row marked IsBroker=true.
///   - Every Εταιρίες entry from the xlsx as a child carrier with
///     ParentCompanyId pointing at Grand Cover.
///   - Per-subcompany Πακέτα as CompanyParameterItem rows attached to
///     the subcompany, source = "GrandCover IW dump".
///   - Broker-level Κλάδοι, Χρήσεις, Καλύψεις attached to the Grand Cover
///     container so all sub-carriers inherit them via the broker.
///
/// Idempotent: every row keys off (InsuranceCompanyId, Kind, Code, ParentCode)
/// and only inserts new ones. Re-running just adds missing items.
/// </summary>
public static class GrandCoverSeeder
{
    private record SeedFile(
        string BrokerCode,
        string BrokerName,
        IReadOnlyList<SubcompanyEntry> Subcompanies,
        IReadOnlyList<BranchEntry> Branches,
        IReadOnlyList<UseEntry> Uses,
        IReadOnlyList<CoverageEntry> Coverages);

    private record SubcompanyEntry(int Id, string Name, IReadOnlyList<PackageEntry> Packages);
    /// <summary>
    /// PackageEntry.Package_id is `int?` because the IW dump JSON stores it
    /// as a number. Earlier this was declared as `string?` which caused
    /// `JsonException: Cannot get the value of a token type 'Number' as a
    /// string` at every boot and the entire seed silently failed — leaving
    /// no subs, no branches, no παραμετρικά in the DB.
    /// </summary>
    private record PackageEntry(int? Package_id, string Name);
    private record BranchEntry(int Id, string Name, string? Fbc);
    private record UseEntry(int Id, string? Code, string Name, string? Label);
    private record CoverageEntry(string Name, string Fbc, int? Branch_id, string? Branch_name);

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        SeedFile? seed = LoadEmbedded();
        if (seed is null)
        {
            logger.LogWarning("Grand Cover seed JSON not found in embedded resources — skipping.");
            return;
        }
        // Defensive: if the JSON keys can't be deserialized, bail with a clear
        // log message instead of attempting INSERTs with NULL columns and
        // tripping the DB. This guards against future JSON-shape changes.
        if (string.IsNullOrWhiteSpace(seed.BrokerCode) || string.IsNullOrWhiteSpace(seed.BrokerName))
        {
            logger.LogError("GrandCoverSeeder: deserialized seed is missing broker_code or broker_name (got '{Code}' / '{Name}'). Aborting.",
                seed.BrokerCode ?? "<null>", seed.BrokerName ?? "<null>");
            return;
        }
        logger.LogInformation("GrandCoverSeeder: loaded {SubCount} subs, {BranchCount} branches, {UseCount} uses, {CoverageCount} coverages.",
            seed.Subcompanies?.Count ?? 0, seed.Branches?.Count ?? 0, seed.Uses?.Count ?? 0, seed.Coverages?.Count ?? 0);

        var broker = await db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Code == seed.BrokerCode && c.TenantId == null, ct);
        if (broker is null)
        {
            broker = new InsuranceCompany
            {
                Id = Guid.NewGuid(),
                Code = seed.BrokerCode,
                Name = seed.BrokerName,
                Country = "GR",
                IsActive = true,
                IsBroker = true,
                Notes = "Πρακτορείο IW — διανομή πολλαπλών ασφαλιστικών εταιρειών."
            };
            db.InsuranceCompanies.Add(broker);
            await db.SaveChangesAsync(ct);
        }
        else if (!broker.IsBroker)
        {
            broker.IsBroker = true;
            await db.SaveChangesAsync(ct);
        }

        // === Subcompanies ===
        // Look up existing subs GLOBALLY by code (not only under the current
        // broker). Earlier deploys could have left subs orphaned under a
        // duplicate, soft-deleted broker. If we find them by code, re-parent
        // to the canonical broker and resurrect — never insert a duplicate.
        var subCodes = seed.Subcompanies
            .Select(s => $"GC_{s.Id:0000}")
            .ToList();
        var existingSubs = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.TenantId == null && subCodes.Contains(c.Code))
            .ToListAsync(ct);
        var existingByCode = existingSubs.ToDictionary(c => c.Code, StringComparer.OrdinalIgnoreCase);
        var subByExternalId = new Dictionary<int, InsuranceCompany>(seed.Subcompanies.Count);

        foreach (var sub in seed.Subcompanies)
        {
            var subCode = $"GC_{sub.Id:0000}";
            if (existingByCode.TryGetValue(subCode, out var ent))
            {
                // Force the sub back into the canonical hierarchy and
                // resurrect it in case it was soft-deleted by cleanup.
                ent.ParentCompanyId = broker.Id;
                ent.DeletedAt = null;
                ent.IsActive = true;
                ent.Name = TruncSafe(sub.Name, 200);
                subByExternalId[sub.Id] = ent;
                continue;
            }
            ent = new InsuranceCompany
            {
                Id = Guid.NewGuid(),
                Code = subCode,
                Name = TruncSafe(sub.Name, 200),
                Country = "GR",
                IsActive = true,
                ParentCompanyId = broker.Id,
                Notes = $"IW subcompany id={sub.Id}"
            };
            db.InsuranceCompanies.Add(ent);
            subByExternalId[sub.Id] = ent;
        }
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);

        // === Broker-level Branches / Uses / Coverages ===
        var existingBrokerItems = await db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(x => x.InsuranceCompanyId == broker.Id && x.DeletedAt == null)
            .Select(x => new { x.Kind, x.Code, x.ParentCode })
            .ToListAsync(ct);
        var existingBrokerKey = existingBrokerItems
            .Select(x => $"{(int)x.Kind}|{x.Code}|{x.ParentCode ?? ""}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var order = 0;
        foreach (var br in seed.Branches)
        {
            var code = $"IW{br.Id:00}";
            var key = $"{(int)CompanyParameterItemKind.Branch}|{code.ToUpperInvariant()}|";
            if (existingBrokerKey.Add(key))
            {
                db.CompanyParameterItems.Add(new CompanyParameterItem
                {
                    Id = Guid.NewGuid(),
                    InsuranceCompanyId = broker.Id,
                    Kind = CompanyParameterItemKind.Branch,
                    Code = code.ToUpperInvariant(),
                    Name = TruncSafe(br.Name, 200),
                    PolicyType = GuessPolicyType(br.Name),
                    IsActive = true,
                    DisplayOrder = order++,
                    Source = "GrandCover IW dump",
                    Notes = string.IsNullOrWhiteSpace(br.Fbc) ? null : $"FBC: {br.Fbc}"
                });
            }
        }
        foreach (var use in seed.Uses)
        {
            var code = $"IWU{use.Id:000}";
            var key = $"{(int)CompanyParameterItemKind.Use}|{code.ToUpperInvariant()}|";
            if (existingBrokerKey.Add(key))
            {
                db.CompanyParameterItems.Add(new CompanyParameterItem
                {
                    Id = Guid.NewGuid(),
                    InsuranceCompanyId = broker.Id,
                    Kind = CompanyParameterItemKind.Use,
                    Code = code.ToUpperInvariant(),
                    Name = TruncSafe(use.Name, 200),
                    PolicyType = PolicyType.Auto,
                    IsActive = true,
                    DisplayOrder = order++,
                    Source = "GrandCover IW dump",
                    Notes = use.Label
                });
            }
        }
        foreach (var cov in seed.Coverages)
        {
            var code = cov.Fbc.ToUpperInvariant();
            var parent = cov.Branch_id is int bid ? $"IW{bid:00}" : null;
            var key = $"{(int)CompanyParameterItemKind.Coverage}|{code}|{parent ?? ""}";
            if (existingBrokerKey.Add(key))
            {
                db.CompanyParameterItems.Add(new CompanyParameterItem
                {
                    Id = Guid.NewGuid(),
                    InsuranceCompanyId = broker.Id,
                    Kind = CompanyParameterItemKind.Coverage,
                    Code = code,
                    Name = TruncSafe(cov.Name, 200),
                    PolicyType = GuessPolicyType(cov.Branch_name),
                    ParentCode = parent,
                    IsActive = true,
                    DisplayOrder = order++,
                    Source = "GrandCover IW dump"
                });
            }
        }

        // === Per-subcompany packages ===
        foreach (var sub in seed.Subcompanies)
        {
            if (!subByExternalId.TryGetValue(sub.Id, out var subEnt)) continue;

            var existingSubItems = await db.CompanyParameterItems.IgnoreQueryFilters()
                .Where(x => x.InsuranceCompanyId == subEnt.Id && x.DeletedAt == null && x.Kind == CompanyParameterItemKind.Package)
                .Select(x => x.Code)
                .ToListAsync(ct);
            var existingSubCodes = existingSubItems.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var pkgOrder = 0;
            foreach (var pkg in sub.Packages)
            {
                var pkgIdStr = pkg.Package_id?.ToString();
                var code = Sanitize(pkgIdStr, pkg.Name);
                if (!existingSubCodes.Add(code)) continue;
                db.CompanyParameterItems.Add(new CompanyParameterItem
                {
                    Id = Guid.NewGuid(),
                    InsuranceCompanyId = subEnt.Id,
                    Kind = CompanyParameterItemKind.Package,
                    Code = code,
                    Name = TruncSafe(pkg.Name, 200),
                    IsActive = true,
                    DisplayOrder = pkgOrder++,
                    Source = "GrandCover IW dump",
                    BridgeSystem = "GRAND_COVER",
                    BridgeCode = pkgIdStr
                });
            }
        }

        // Count BEFORE saving — after SaveChangesAsync the entities transition
        // from Added → Unchanged so the count would always read zero.
        var addedItems = db.ChangeTracker.Entries<CompanyParameterItem>()
            .Count(e => e.State == EntityState.Added);
        var addedSubs = db.ChangeTracker.Entries<InsuranceCompany>()
            .Count(e => e.State == EntityState.Added);

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(ct);
        }

        // After save, query the DB for the actual current totals on the
        // broker hierarchy so we know what the agencies will see, regardless
        // of whether this boot added rows or just confirmed the existing ones.
        var subIds = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.ParentCompanyId == broker.Id && c.DeletedAt == null)
            .Select(c => c.Id)
            .ToListAsync(ct);
        var ownedIds = subIds.Append(broker.Id).ToList();
        var totalItems = await db.CompanyParameterItems.IgnoreQueryFilters()
            .CountAsync(p => ownedIds.Contains(p.InsuranceCompanyId) && p.DeletedAt == null, ct);
        var branchCount = await db.CompanyParameterItems.IgnoreQueryFilters()
            .CountAsync(p => p.InsuranceCompanyId == broker.Id && p.Kind == CompanyParameterItemKind.Branch && p.DeletedAt == null, ct);
        var useCount = await db.CompanyParameterItems.IgnoreQueryFilters()
            .CountAsync(p => p.InsuranceCompanyId == broker.Id && p.Kind == CompanyParameterItemKind.Use && p.DeletedAt == null, ct);
        var coverageCount = await db.CompanyParameterItems.IgnoreQueryFilters()
            .CountAsync(p => p.InsuranceCompanyId == broker.Id && p.Kind == CompanyParameterItemKind.Coverage && p.DeletedAt == null, ct);

        logger.LogInformation(
            "Grand Cover seed applied — added {AddedSubs} new sub rows, {AddedItems} new parametric rows this run. " +
            "DB totals: {Subs} subs, {Branches} branches, {Uses} uses, {Coverages} coverages ({Total} total parametric rows under the broker hierarchy).",
            addedSubs, addedItems, subIds.Count, branchCount, useCount, coverageCount, totalItems);
    }

    private static SeedFile? LoadEmbedded()
    {
        var asm = typeof(GrandCoverSeeder).GetTypeInfo().Assembly;
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("grand-cover-seed.json", StringComparison.OrdinalIgnoreCase));
        if (name is null) return null;
        using var stream = asm.GetManifestResourceStream(name);
        if (stream is null) return null;
        // The IW dump uses snake_case keys (broker_code, broker_name,
        // subcompanies[i].packages[j].package_id, branches[i].fbc, …).
        // `PropertyNameCaseInsensitive` alone only ignores LETTER case —
        // it doesn't bridge underscores, so `BrokerCode` was silently
        // deserializing to null. Apply the SnakeCaseLower naming policy
        // so snake_case JSON keys map onto our PascalCase record members.
        return JsonSerializer.Deserialize<SeedFile>(stream, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        });
    }

    private static PolicyType? GuessPolicyType(string? branchName)
    {
        if (string.IsNullOrWhiteSpace(branchName)) return null;
        var n = branchName.ToUpperInvariant();
        if (n.Contains("ΑΥΤΟΚ") || n.Contains("AYTOK") || n.Contains("AUTO") || n.Contains("ΟΧΗΜ")) return PolicyType.Auto;
        if (n.Contains("ΚΑΤΟΙΚ") || n.Contains("HOME") || n.Contains("ΣΠΙΤ")) return PolicyType.Home;
        if (n.Contains("ΥΓΕΙ") || n.Contains("ΝΟΣΟ") || n.Contains("HEALTH")) return PolicyType.Health;
        if (n.Contains("ΖΩΗΣ") || n.Contains("LIFE") || n.Contains("ΣΥΝΤΑΞ")) return PolicyType.Life;
        if (n.Contains("ΤΑΞΙΔ") || n.Contains("TRAVEL")) return PolicyType.Travel;
        if (n.Contains("ΕΠΙΧ") || n.Contains("BUSINESS") || n.Contains("ΕΠΑΓΓ")) return PolicyType.Business;
        return PolicyType.Other;
    }

    private static string Sanitize(string? id, string name)
    {
        if (!string.IsNullOrWhiteSpace(id))
        {
            var s = id.Trim().ToUpperInvariant().Replace(".", "").Replace(" ", "_");
            if (s.Length <= 40) return s;
        }
        var cleaned = new string((name ?? "PKG").Trim().ToUpperInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-').Take(40).ToArray());
        return string.IsNullOrWhiteSpace(cleaned) ? "PKG_" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant() : cleaned;
    }

    private static string TruncSafe(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var t = s.Trim();
        return t.Length <= max ? t : t[..max];
    }
}
