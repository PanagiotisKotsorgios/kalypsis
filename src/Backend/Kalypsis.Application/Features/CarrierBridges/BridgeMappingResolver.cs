using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.CarrierBridges;

/// <summary>
/// One raw code that appears in the uploaded bridge file but has no linked
/// mapping yet, and no obvious existing parametric to fall back to. Surfaced
/// to the preview UI so the operator can link it to an agency parametric (or
/// create a new one inline) before committing the import.
/// </summary>
public record UnmappedBridgeCode(
    BridgeMappingKind Kind,
    string? SourceCarrier,
    string RawCode,
    string? RawLabel,
    int Occurrences,
    /// <summary>Row indexes in the parsed preview where the code appears.</summary>
    IReadOnlyList<int> Rows);

/// <summary>
/// Walks the parsed <see cref="BridgeImportRow"/>s' Raw dictionaries, extracts
/// distinct raw codes for each Kind, and returns the ones that:
///  1. Do NOT have a per-tenant <see cref="BridgeCodeMapping"/> pointing at
///     an agency parametric, AND
///  2. Do NOT trivially match an existing <see cref="CompanyParameterItem"/>
///     by code + kind (case-insensitive) so we can lazily seed the mapping.
///
/// The resolver is intentionally pure — no DB access — so the caller can
/// prefetch mappings + parametrics once and reuse them.
/// </summary>
public static class BridgeMappingResolver
{
    // Keys the parsers agree on. If a new parser is added it should write to
    // these same keys to plug into the resolver without extra glue.
    //   Sub.Carrier.Id           — sub-company / broker inside a carrier
    //   Κλάδος.Code              — branch (Auto/Fire/…)
    //   Πακέτο.Code              — package
    //   Χρήση.Code               — vehicle use
    //   Καλύψεις                 — comma-separated list of cover codes
    //   KLDCOD                   — ATLANTIKI branch code alias
    // Both normalised keys the newer parsers write AND the plain XLSX column
    // header names the older INTERLIFE parser dumps rows into. The INTERLIFE
    // parser copies every workbook cell into Raw using the header text as-is
    // ("Κλάδος", "Χρήση", "Τίτλος συμβολαίου"…) — we treat them as fallbacks
    // to avoid rewriting 200 lines of already-tested parser code.
    private static readonly string[] SubCarrierKeys = { "Sub.Carrier.Id", "Εταιρία" };
    private static readonly string[] BranchKeys     = { "Κλάδος.Code", "Κλάδος", "KLDCOD" };
    private static readonly string[] PackageKeys    = { "Πακέτο.Code", "Πακέτο" };
    private static readonly string[] UseKeys        = { "Χρήση.Code", "Χρήση" };
    private static readonly string[] CoveragesKeys  = { "Καλύψεις" };
    private static readonly string[] ProducerKeys   = { "Συνεργάτης.Code", "Κωδ. παραγωγού", "ergo.producer" };

    private static bool TryGetAny(IReadOnlyDictionary<string, string> raw, string[] keys, out string value)
    {
        foreach (var k in keys)
            if (raw.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v)) { value = v; return true; }
        value = string.Empty;
        return false;
    }

    public static IReadOnlyList<UnmappedBridgeCode> Resolve(
        IReadOnlyList<BridgeImportRow> rows,
        string carrierName,
        IReadOnlyList<BridgeCodeMapping> mappings,
        IReadOnlyList<CompanyParameterItem> agencyParametrics,
        IReadOnlyList<Producer>? agencyProducers = null)
    {
        // Fast lookup: for each (kind, raw code) is there a mapping?
        var mappedByKindRaw = new HashSet<(BridgeMappingKind, string)>();
        foreach (var m in mappings)
        {
            if (m.DeletedAt is not null) continue;
            if (!string.IsNullOrEmpty(m.RawCode))
                mappedByKindRaw.Add((m.Kind, NormaliseCode(m.RawCode)));
        }

        // Fast lookup: does the agency already have a parametric with a code
        // equal to the raw code? Auto-mapped in a follow-up commit (the row
        // isn't marked unmapped so it doesn't block preview) — but we DO stash
        // it in a separate bucket so the caller can pre-populate mappings
        // when the user clicks "auto-link all".
        var paramCodesByKind = new Dictionary<BridgeMappingKind, HashSet<string>>();
        foreach (var p in agencyParametrics)
        {
            if (p.DeletedAt is not null || !p.IsActive) continue;
            var kind = MapKind(p.Kind);
            if (kind is null) continue;
            if (!paramCodesByKind.TryGetValue(kind.Value, out var set))
                paramCodesByKind[kind.Value] = set = new HashSet<string>();
            set.Add(NormaliseCode(p.Code));
        }
        // Producer catalogue — same shape: if the office already has a
        // producer with a code identical to the raw one, treat it as known
        // (the commit step will lazily create the mapping).
        if (agencyProducers is not null)
        {
            var producerSet = new HashSet<string>();
            foreach (var pr in agencyProducers)
            {
                if (pr.DeletedAt is not null) continue;
                if (!string.IsNullOrEmpty(pr.Code)) producerSet.Add(NormaliseCode(pr.Code));
            }
            if (producerSet.Count > 0) paramCodesByKind[BridgeMappingKind.Producer] = producerSet;
        }

        bool IsAlreadyKnown(BridgeMappingKind kind, string raw)
        {
            var n = NormaliseCode(raw);
            if (mappedByKindRaw.Contains((kind, n))) return true;
            if (paramCodesByKind.TryGetValue(kind, out var set) && set.Contains(n)) return true;
            return false;
        }

        var buckets = new Dictionary<(BridgeMappingKind, string), (string? label, HashSet<int> rows)>();

        void Note(BridgeMappingKind kind, string? raw, string? label, int rowIndex)
        {
            if (string.IsNullOrWhiteSpace(raw)) return;
            var norm = NormaliseCode(raw);
            if (norm.Length == 0) return;
            if (IsAlreadyKnown(kind, norm)) return;
            var key = (kind, norm);
            if (!buckets.TryGetValue(key, out var b))
                buckets[key] = b = (label, new HashSet<int>());
            b.rows.Add(rowIndex);
            if (b.label is null && !string.IsNullOrWhiteSpace(label))
                buckets[key] = (label, b.rows);
        }

        foreach (var r in rows)
        {
            if (TryGetAny(r.Raw, SubCarrierKeys, out var subCarrier))
                Note(BridgeMappingKind.Company, subCarrier, null, r.Index);
            if (TryGetAny(r.Raw, BranchKeys, out var branchCode))
                Note(BridgeMappingKind.Branch, branchCode, null, r.Index);
            if (TryGetAny(r.Raw, PackageKeys, out var packageCode))
                Note(BridgeMappingKind.Package, packageCode, null, r.Index);
            if (TryGetAny(r.Raw, UseKeys, out var useCode))
                Note(BridgeMappingKind.Use, useCode, null, r.Index);
            if (TryGetAny(r.Raw, CoveragesKeys, out var covers))
            {
                foreach (var c in covers.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    Note(BridgeMappingKind.Coverage, c, null, r.Index);
            }
            if (TryGetAny(r.Raw, ProducerKeys, out var producerCode))
                Note(BridgeMappingKind.Producer, producerCode, null, r.Index);
        }

        return buckets
            .OrderBy(b => b.Key.Item1).ThenBy(b => b.Key.Item2)
            .Select(b => new UnmappedBridgeCode(
                Kind: b.Key.Item1,
                SourceCarrier: carrierName,
                RawCode: b.Key.Item2,
                RawLabel: b.Value.label,
                Occurrences: b.Value.rows.Count,
                Rows: b.Value.rows.OrderBy(x => x).Take(20).ToList()))
            .ToList();
    }

    private static string NormaliseCode(string s) =>
        (s ?? string.Empty).Trim().ToUpperInvariant();

    private static BridgeMappingKind? MapKind(CompanyParameterItemKind kind) => kind switch
    {
        CompanyParameterItemKind.Branch   => BridgeMappingKind.Branch,
        CompanyParameterItemKind.Coverage => BridgeMappingKind.Coverage,
        CompanyParameterItemKind.Use      => BridgeMappingKind.Use,
        CompanyParameterItemKind.Package  => BridgeMappingKind.Package,
        _ => null,
    };
}
