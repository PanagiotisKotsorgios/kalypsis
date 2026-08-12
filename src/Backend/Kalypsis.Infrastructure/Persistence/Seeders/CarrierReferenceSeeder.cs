using System.Security.Cryptography;
using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Boots the two shipped «Οδηγός παραμετρικών» reference files into
/// PlatformCarrierReferences:
///   • ergo-reference.pdf              → carrier whose (Code|Name) contains "ERGO"
///   • grand-cover-reference.xlsx      → carrier whose (Code|Name) contains "GRAND COVER" / "IW"
///
/// Idempotent: re-upserts only when the SHA-256 of the shipped file differs
/// from the row already in the DB, so every deploy after this one is a
/// no-op unless the operator drops a new file into the repo.
///
/// PlatformAdmin can still overwrite via the UI — a manual upload wins on
/// the next boot only if it differs from the shipped resource, which is
/// exactly what we want.
/// </summary>
public static class CarrierReferenceSeeder
{
    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct)
    {
        // (embedded-resource suffix, mime, filename-shown, carrier-key predicates)
        var entries = new[]
        {
            new SeedEntry(
                ResourceSuffix: "ergo-reference.pdf",
                MimeType: "application/pdf",
                DisplayName: "ERGO Κωδικοποίηση & Περιγραφή.pdf",
                CarrierMatches: k => k.Contains("ERGO")
            ),
            new SeedEntry(
                // Rendered from Παραμετρικά_Αρχεία_IW.xlsx via xlsx2pdf.py so
                // the viewer iframes it inline like the ERGO reference, one
                // sheet per landscape A4 page. Regenerate + drop back into
                // Resources whenever the source xlsx changes.
                ResourceSuffix: "grand-cover-reference.pdf",
                MimeType: "application/pdf",
                DisplayName: "Grand Cover Παραμετρικά Αρχεία.pdf",
                CarrierMatches: k => k.Contains("GRAND COVER") || k.Contains("GRANDCOVER") || k.Contains("IW")
            ),
        };

        foreach (var e in entries)
        {
            var bytes = LoadEmbedded(e.ResourceSuffix);
            if (bytes is null)
            {
                logger.LogWarning("CarrierReferenceSeeder: {Res} not embedded.", e.ResourceSuffix);
                continue;
            }
            var carriers = await db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null && c.TenantId == null) // global catalogue
                .ToListAsync(ct);
            var matches = carriers
                .Where(c => e.CarrierMatches(((c.Code ?? "") + " " + (c.Name ?? "")).ToUpperInvariant()))
                .ToList();
            if (matches.Count == 0)
            {
                logger.LogInformation("CarrierReferenceSeeder: no carrier matches {Res}.", e.ResourceSuffix);
                continue;
            }

            var newHash = Convert.ToHexString(SHA256.HashData(bytes));
            var now = DateTime.UtcNow;

            foreach (var carrier in matches)
            {
                var existing = await db.PlatformCarrierReferences.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(r => r.InsuranceCompanyId == carrier.Id, ct);
                if (existing is not null)
                {
                    // Compare hashes so re-deploys of the same content are
                    // no-op — avoid pointless UPDATEs and audit noise.
                    var existingHash = Convert.ToHexString(SHA256.HashData(existing.ContentBytes ?? Array.Empty<byte>()));
                    if (existingHash == newHash && existing.DeletedAt is null)
                    {
                        logger.LogInformation("CarrierReferenceSeeder: {Res} unchanged for {Carrier}.",
                            e.ResourceSuffix, carrier.Name);
                        continue;
                    }
                    existing.FileName = e.DisplayName;
                    existing.MimeType = e.MimeType;
                    existing.SizeBytes = bytes.LongLength;
                    existing.ContentBytes = bytes;
                    existing.UpdatedAt = now;
                    existing.DeletedAt = null;
                    logger.LogInformation("CarrierReferenceSeeder: refreshed {Res} for {Carrier}.",
                        e.ResourceSuffix, carrier.Name);
                }
                else
                {
                    db.PlatformCarrierReferences.Add(new PlatformCarrierReference
                    {
                        Id = Guid.NewGuid(),
                        InsuranceCompanyId = carrier.Id,
                        FileName = e.DisplayName,
                        MimeType = e.MimeType,
                        SizeBytes = bytes.LongLength,
                        ContentBytes = bytes,
                        CreatedAt = now,
                    });
                    logger.LogInformation("CarrierReferenceSeeder: seeded {Res} for {Carrier}.",
                        e.ResourceSuffix, carrier.Name);
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private record SeedEntry(
        string ResourceSuffix,
        string MimeType,
        string DisplayName,
        Func<string, bool> CarrierMatches);

    private static byte[]? LoadEmbedded(string suffix)
    {
        var asm = typeof(CarrierReferenceSeeder).Assembly;
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
        if (name is null) return null;
        using var s = asm.GetManifestResourceStream(name);
        if (s is null) return null;
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    }
}
