using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Common.Exports;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.ProductionLists;

// ============================================================================
// Λίστες Παραγωγής — per-month / per-carrier / per-producer / per-policy-type
// aggregations with full filter combinatorics + CSV/XLSX/PDF export.
// Partner commission % is read from CommissionRule (parameterization), NOT
// from the bridge — that's the user's explicit rule.
// ============================================================================

public record ProductionFilters(
    DateOnly? From, DateOnly? To,
    Guid? InsuranceCompanyId, Guid? ProducerId,
    PolicyType? PolicyType, PolicyStatus? Status,
    VehicleUseCategory? VehicleUseCategory, string? CoverCode,
    string? GroupBy,
    string? PackageCode = null,
    string? UseCodeRaw = null,
    // When the incoming Κλάδος value doesn't parse as the PolicyType enum,
    // BranchCodeRaw holds the raw carrier token that the handler queries
    // against Policy.CarrierBranchCode. Πακέτο / Κάλυψη use the always-
    // string PackageCode / CoverCode fields — no separate raw variant.
    string? BranchCodeRaw = null,   // "carrier" | "producer" | "type" | "month" | null
    // Which policy date field the From/To window applies to:
    //   "start"    → Policy.StartDate (coverage begin) — DEFAULT, backward-compat
    //   "issued"   → Policy.IssuedAt (carrier issuance / Έκδοση)
    //   "recorded" → Policy.CreatedAt (row insert / Καταχώρηση)
    // Anything else (or null) falls back to "start".
    string? DateField = null,
    IReadOnlyList<Guid>? InsuranceCompanyIds = null,
    IReadOnlyList<Guid>? ProducerIds = null,
    IReadOnlyList<string>? PolicyTypes = null,
    IReadOnlyList<PolicyStatus>? Statuses = null,
    IReadOnlyList<string>? VehicleUseCategories = null,
    IReadOnlyList<string>? CoverCodes = null,
    IReadOnlyList<string>? PackageCodes = null)
{
    // Frontend Παραμετρικά dropdowns send either the strict enum value
    // (when the operator wired policyType / vehicleUseCategory on the
    // parametric row) or the row's own free-form code. The old handler
    // took strict enums and 400-ed on custom codes — leaving the filter
    // unusable for any office that has parametrics but no enum mapping.
    // Now we try the enum parse; if the string isn't a valid enum, we
    // hand the raw string to the query as UseCodeRaw and match against
    // Policy.CarrierUseCode (the token the bridge stored at import time).
    public static PolicyType? ParseBranch(string? raw) =>
        !string.IsNullOrWhiteSpace(raw)
        && Enum.TryParse<PolicyType>(raw, ignoreCase: true, out var pt)
            ? pt : null;

    public static VehicleUseCategory? ParseUse(string? raw) =>
        !string.IsNullOrWhiteSpace(raw)
        && Enum.TryParse<VehicleUseCategory>(raw, ignoreCase: true, out var vc)
            ? vc : null;

    /// <summary>Non-null when the incoming string didn't parse as
    /// VehicleUseCategory — hands it to the handler as a raw
    /// Policy.CarrierUseCode filter.</summary>
    public static string? RawUseFallback(string? raw) =>
        !string.IsNullOrWhiteSpace(raw)
        && !Enum.TryParse<VehicleUseCategory>(raw, ignoreCase: true, out _)
            ? raw.Trim() : null;

    /// <summary>Non-null when the incoming Κλάδος string didn't parse as
    /// PolicyType — filters by Policy.CarrierBranchCode instead.</summary>
    public static string? RawBranchFallback(string? raw) =>
        !string.IsNullOrWhiteSpace(raw)
        && !Enum.TryParse<PolicyType>(raw, ignoreCase: true, out _)
            ? raw.Trim() : null;
}

public record ProductionRowDto(
    Guid PolicyId, string PolicyNumber,
    DateOnly StartDate, DateOnly EndDate,
    string CustomerName, string InsuranceCompany, string? Producer, string PolicyType, string Status,
    VehicleUseCategory? VehicleUseCategory, string? CoverCode,
    IReadOnlyList<string> CoverageCodes,
    decimal Gross, decimal Net, decimal Vat,
    decimal PartnerCommissionPercent, decimal PartnerCommission,
    decimal AgencyCommissionPercent, decimal AgencyCommission,
    decimal IncomingAgencyCommissionPercent, decimal IncomingAgencyCommission,
    string? CommissionWarning);

public record ProductionGroupTotalDto(
    string Key, int Count,
    decimal Gross, decimal Net, decimal Vat,
    decimal PartnerCommission, decimal AgencyCommission);

public record ProductionListResultDto(
    int Count,
    IReadOnlyList<ProductionRowDto> Rows,
    IReadOnlyList<ProductionGroupTotalDto> Groups,
    ProductionGroupTotalDto Grand);

public record GetProductionListQuery(ProductionFilters Filters) : IRequest<ProductionListResultDto>;

public class GetProductionListHandler : IRequestHandler<GetProductionListQuery, ProductionListResultDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetProductionListHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProductionListResultDto> Handle(GetProductionListQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await ProductionListBuilder.BuildRowsAsync(_db, tenantId, q.Filters, ct);

        // Group bucketing per filter.
        string GroupKey(ProductionRowDto r) => q.Filters.GroupBy switch
        {
            "carrier"  => r.InsuranceCompany,
            "producer" => r.Producer ?? "—",
            "type"     => r.PolicyType,
            "month"    => r.StartDate.ToString("yyyy-MM"),
            _          => ""
        };

        var groups = string.IsNullOrEmpty(q.Filters.GroupBy)
            ? new List<ProductionGroupTotalDto>()
            : rows.GroupBy(GroupKey)
                .Select(g => new ProductionGroupTotalDto(
                    g.Key, g.Count(),
                    g.Sum(x => x.Gross), g.Sum(x => x.Net), g.Sum(x => x.Vat),
                    g.Sum(x => x.PartnerCommission), g.Sum(x => x.AgencyCommission)))
                .OrderByDescending(x => x.Gross).ToList();

        var grand = new ProductionGroupTotalDto(
            "ΣΥΝΟΛΟ", rows.Count,
            rows.Sum(x => x.Gross), rows.Sum(x => x.Net), rows.Sum(x => x.Vat),
            rows.Sum(x => x.PartnerCommission), rows.Sum(x => x.AgencyCommission));

        return new ProductionListResultDto(rows.Count, rows, groups, grand);
    }

    // Builder moved to ProductionListBuilder (static) for DI-free reuse.
}

/// <summary>Stateless helper used by both the list query and the export query.</summary>
public static class ProductionListBuilder
{
    public static async Task<List<ProductionRowDto>> BuildRowsAsync(
        IAppDbContext _db, Guid tenantId, ProductionFilters f, CancellationToken ct,
        Guid? policyId = null, bool includeAll = false)
    {
        var query = _db.Policies
            .Include(p => p.Customer)
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Producer)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null);
        if (policyId.HasValue) query = query.Where(p => p.Id == policyId.Value);

        // Date-field switch (Έναρξη κάλυψης | Έκδοση | Καταχώρηση).
        //   IssuedAt is nullable — rows without a carrier issuance date
        //   fall outside the window (correct: they aren't dated).
        //   CreatedAt is a DateTime (row insert) → compare via DateOnly
        //   conversion so the [from, to] window is inclusive on the day.
        var dateField = (f.DateField ?? "start").ToLowerInvariant();
        if (dateField == "issued")
        {
            if (f.From.HasValue) query = query.Where(p => p.IssuedAt != null && p.IssuedAt >= f.From);
            if (f.To.HasValue)   query = query.Where(p => p.IssuedAt != null && p.IssuedAt <= f.To);
        }
        else if (dateField == "recorded")
        {
            if (f.From.HasValue)
            {
                var fromDt = f.From.Value.ToDateTime(TimeOnly.MinValue);
                query = query.Where(p => p.CreatedAt >= fromDt);
            }
            if (f.To.HasValue)
            {
                var toDt = f.To.Value.ToDateTime(TimeOnly.MaxValue);
                query = query.Where(p => p.CreatedAt <= toDt);
            }
        }
        else
        {
            if (f.From.HasValue) query = query.Where(p => p.StartDate >= f.From);
            if (f.To.HasValue)   query = query.Where(p => p.StartDate <= f.To);
        }
        query = await ProductionMultiFilters.ApplyAsync(_db, query, f, ct);
        var requestedCovers = ProductionMultiFilters.Codes(f.CoverCode, f.CoverCodes);
        var requestedPackages = ProductionMultiFilters.Codes(f.PackageCode, f.PackageCodes);
        var policies = await query.OrderByDescending(p => p.StartDate)
            .Take(!includeAll && requestedCovers.Length == 0 && requestedPackages.Length == 0 ? 5000 : int.MaxValue).ToListAsync(ct);
        if (requestedCovers.Length > 0)
        {
            var codes = requestedCovers.Select(code => code.ToUpperInvariant()).ToArray();
            var normalizedPolicyIds = (await _db.PolicyCovers
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null && codes.Contains(c.CoverCode.ToUpper()))
                .Select(c => c.PolicyId).Distinct().ToListAsync(ct)).ToHashSet();
            policies = policies.Where(p => normalizedPolicyIds.Contains(p.Id)
                || requestedCovers.Contains(ExtractCoverCode(p.SpecsJson) ?? "", StringComparer.OrdinalIgnoreCase)
                || (ExtractCoverCode(p.SpecsJson)?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Any(code => requestedCovers.Contains(code, StringComparer.OrdinalIgnoreCase)) ?? false)
                || (p.CarrierCoverageCode?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Any(code => requestedCovers.Contains(code, StringComparer.OrdinalIgnoreCase)) ?? false)).ToList();
        }
        if (requestedPackages.Length > 0)
            policies = policies.Where(p =>
                requestedPackages.Contains(ExtractPackageCode(p.SpecsJson) ?? "", StringComparer.OrdinalIgnoreCase)
                || requestedPackages.Contains(p.CarrierPackageCode ?? "", StringComparer.OrdinalIgnoreCase)).ToList();
        if (!includeAll) policies = policies.Take(5000).ToList();

        // Pull active commission rules so partner commission % can be read from
        // parameterization (NOT the bridge). Most-specific rule wins.
        var rules = await _db.CommissionRules
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null
                && (r.EffectiveFrom <= DateOnly.FromDateTime(DateTime.UtcNow))
                && (r.EffectiveTo == null || r.EffectiveTo >= DateOnly.FromDateTime(DateTime.UtcNow)))
            .ToListAsync(ct);

        // Resolve producer tiers so per-tier rules can target a whole bucket
        // (Α/Β/Γ/Δ/Ε) instead of an individual partner.
        var producerTiers = policies.Where(x => x.ProducerId.HasValue)
            .Select(x => x.ProducerId!.Value).Distinct().ToList();
        var tierByProducer = producerTiers.Count == 0
            ? new Dictionary<Guid, ProducerTier>()
            : await _db.Producers
                .Where(x => producerTiers.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Tier, ct);

        var policyIds = policies.Select(p => p.Id).ToList();

        // A policy can contain many PolicyCover rows.  The old production
        // list only extracted one legacy value from SpecsJson, which made a
        // multi-cover contract look as if it had a single cover (or none).
        // Keep the legacy CoverCode for matching/compatibility, but expose a
        // complete, de-duplicated code list for the UI summary and details
        // popup.  CarrierCoverageCode is the safe fallback for bridge rows
        // whose detailed cover table has not been populated yet.
        var coverageCodesByPolicy = new Dictionary<Guid, IReadOnlyList<string>>();
        try
        {
            var coverRows = await _db.PolicyCovers
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null && policyIds.Contains(c.PolicyId))
                .Select(c => new { c.PolicyId, c.CoverCode })
                .ToListAsync(ct);
            coverageCodesByPolicy = coverRows
                .GroupBy(c => c.PolicyId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyList<string>)g
                        .Select(x => x.CoverCode.Trim())
                        .Where(x => x.Length > 0)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList());
        }
        catch
        {
            // Older installations may be running before the policy_covers
            // migration.  The production list must still load; fallbacks
            // below use the indexed carrier/specs values in that case.
        }

        static IReadOnlyList<string> FallbackCoverageCodes(Policy policy, string? legacyCode)
        {
            var raw = !string.IsNullOrWhiteSpace(policy.CarrierCoverageCode)
                ? policy.CarrierCoverageCode
                : legacyCode;
            if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.Trim())
                .Where(x => x.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        var bridgeAgencyCommissionByPolicy = policyIds.Count == 0
            ? new Dictionary<Guid, decimal>()
            : await _db.FinancialMovements
                .Where(m => m.TenantId == tenantId
                    && m.DeletedAt == null
                    && m.PolicyId.HasValue
                    && policyIds.Contains(m.PolicyId.Value)
                    && m.Kind == FinancialMovementKind.CommissionEarned
                    && m.Description != null
                    && m.Description.StartsWith("[bridge:"))
                .GroupBy(m => m.PolicyId!.Value)
                .Select(g => new { PolicyId = g.Key, Amount = g.Sum(x => x.Amount) })
                .ToDictionaryAsync(g => g.PolicyId, g => g.Amount, ct);

        // The materialised commission matrix is the source of truth for a
        // policy-level override. In particular, a manual producer percentage
        // may intentionally have no Agency row; deriving the office amount
        // from a default rule in that case would show money the office does
        // not actually retain.
        var splitRows = new List<(Guid PolicyId, HierarchyLevel Level, Guid? ProducerId, decimal Percent, decimal Gross)>();
        if (policyIds.Count > 0)
        {
            var persistedSplits = await _db.PolicyCommissionSplits
                .Where(s => s.TenantId == tenantId && s.DeletedAt == null && policyIds.Contains(s.PolicyId))
                .Select(s => new { s.PolicyId, s.HierarchyLevel, s.ProducerId, s.Percent, s.GrossAmount })
                .ToListAsync(ct);
            splitRows.AddRange(persistedSplits.Select(s =>
                (s.PolicyId, s.HierarchyLevel, s.ProducerId, s.Percent, s.GrossAmount)));
        }
        var splitsByPolicy = splitRows
            .GroupBy(s => s.PolicyId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    ProducerPercent = g.Where(s => s.Level != HierarchyLevel.Agency && s.ProducerId.HasValue)
                        .Sum(s => s.Percent),
                    AgencyPercent = g.Where(s => s.Level == HierarchyLevel.Agency).Sum(s => s.Percent)
                });

        CommissionRule? LookupRule(Policy p, string? coverCode)
        {
            var tier = p.ProducerId.HasValue && tierByProducer.TryGetValue(p.ProducerId.Value, out var t)
                ? t : ProducerTier.None;

            return rules
                .Where(r => (!r.ProducerId.HasValue           || r.ProducerId == p.ProducerId)
                         && (!r.ProducerTier.HasValue         || r.ProducerTier == tier)
                         && (!r.InsuranceCompanyId.HasValue   || r.InsuranceCompanyId == p.InsuranceCompanyId)
                         && (!r.PolicyType.HasValue           || r.PolicyType == p.PolicyType)
                         && (r.CoverCode == null              || string.Equals(r.CoverCode, coverCode, StringComparison.OrdinalIgnoreCase))
                         && (!r.VehicleUseCategory.HasValue   || r.VehicleUseCategory == p.VehicleUseCategory))
                .OrderByDescending(r =>
                    (r.ProducerId.HasValue ? 32 : 0) +
                    (r.ProducerTier.HasValue ? 16 : 0) +
                    (r.CoverCode != null ? 8 : 0) +
                    (r.VehicleUseCategory.HasValue ? 4 : 0) +
                    (r.InsuranceCompanyId.HasValue ? 2 : 0) +
                    (r.PolicyType.HasValue ? 1 : 0))
                .FirstOrDefault();
        }

        // The producer rate and the carrier's total rate may intentionally be
        // stored at different scopes (for example: 10% on a producer-specific
        // rule, 16% on the carrier rule). Do not let the more-specific
        // producer rule hide the carrier total when its AgencyPercent is blank.
        CommissionRule? LookupTotalRule(Policy p, string? coverCode)
        {
            var tier = p.ProducerId.HasValue && tierByProducer.TryGetValue(p.ProducerId.Value, out var t)
                ? t : ProducerTier.None;

            return rules
                .Where(r => ConfiguredTotalPercent(r).HasValue
                         && (!r.ProducerId.HasValue           || r.ProducerId == p.ProducerId)
                         && (!r.ProducerTier.HasValue         || r.ProducerTier == tier)
                         && (!r.InsuranceCompanyId.HasValue   || r.InsuranceCompanyId == p.InsuranceCompanyId)
                         && (!r.PolicyType.HasValue           || r.PolicyType == p.PolicyType)
                         && (r.CoverCode == null              || string.Equals(r.CoverCode, coverCode, StringComparison.OrdinalIgnoreCase))
                         && (!r.VehicleUseCategory.HasValue   || r.VehicleUseCategory == p.VehicleUseCategory))
                .OrderByDescending(r =>
                    (r.ProducerId.HasValue ? 32 : 0) +
                    (r.ProducerTier.HasValue ? 16 : 0) +
                    (r.CoverCode != null ? 8 : 0) +
                    (r.VehicleUseCategory.HasValue ? 4 : 0) +
                    (r.InsuranceCompanyId.HasValue ? 2 : 0) +
                    (r.PolicyType.HasValue ? 1 : 0))
                .FirstOrDefault();
        }

        decimal LookupPartnerPct(Policy p, CommissionRule? match)
        {
            // A policy without a producer belongs to the office.  Never show
            // a producer percentage (or pay a producer) on office production,
            // even if a broad rule contains a producer default.
            if (!p.ProducerId.HasValue) return 0m;
            if (p.SpecialCommissionPercent.HasValue) return p.SpecialCommissionPercent.Value;
            if (match is null) return 0m;
            // Prefer the new ProducerPercent column when populated; fall back to the
            // legacy single-value field so older rules still work end-to-end.
            if (match.ProducerPercent.HasValue) return match.ProducerPercent.Value;
            return match.CommissionType == CommissionType.Percentage ? match.Value : 0m;
        }

        return policies.Select(p =>
        {
            var coverCode = ExtractCoverCode(p.SpecsJson);
            var coverageCodes = coverageCodesByPolicy.TryGetValue(p.Id, out var persistedCodes)
                && persistedCodes.Count > 0
                ? persistedCodes
                : FallbackCoverageCodes(p, coverCode);
            var match = LookupRule(p, coverCode);
            var totalRule = LookupTotalRule(p, coverCode);
            var hasProducer = p.ProducerId.HasValue;
            var partnerPct = LookupPartnerPct(p, match);
            // Use the amounts recorded on the policy first. Insurance
            // contracts use the insurance-tax breakdown entered by the
            // office/carrier; the old 24% fallback was ordinary VAT and made
            // the production list disagree with the policy card (for example
            // 51.61/12.39 instead of the stored 45.08/18.92).
            var net = p.NetPremium
                ?? (p.VatAmount.HasValue
                    ? p.Premium - p.VatAmount.Value
                    : p.PremiumIncludesVat ? Math.Round(p.Premium / 1.24m, 2) : p.Premium);
            var vat = p.VatAmount
                ?? (p.NetPremium.HasValue
                    ? p.Premium - p.NetPremium.Value
                    : p.PremiumIncludesVat ? p.Premium - net : 0m);
            splitsByPolicy.TryGetValue(p.Id, out var materialized);
            var hasManualPartnerOverride = hasProducer && p.SpecialCommissionPercent.HasValue;
            if (hasManualPartnerOverride)
            {
                partnerPct = Math.Max(0m, p.SpecialCommissionPercent!.Value);
            }
            else if (materialized is not null)
            {
                partnerPct = materialized.ProducerPercent;
            }
            var partnerComm = !hasProducer
                ? 0m
                : hasManualPartnerOverride
                ? Math.Round(net * partnerPct / 100m, 2)
                : materialized is not null
                ? Math.Round(net * materialized.ProducerPercent / 100m, 2)
                : Math.Round(net * partnerPct / 100m, 2);
            // A zero-valued legacy bridge movement is not a usable carrier
            // total. Ignore it so an active 16% parameterization can produce
            // the correct 6% office remainder instead of preserving 0,00 €.
            var hasBridgeAgencyCommission = bridgeAgencyCommissionByPolicy.TryGetValue(p.Id, out var bridgeAgencyCommission)
                && bridgeAgencyCommission > 0m;
            // AgencyPercent is the total commission rate paid by the carrier
            // on the net premium.  It is not an additional amount on top of
            // the producer's share.  The office keeps the remainder after
            // the producer percentage is paid.
            // The carrier/agency rule is the authoritative *total* commission
            // percentage for manually entered policies.  Older policies may
            // still have a materialised matrix containing only the producer
            // row (or an outdated agency remainder of 0); using that matrix
            // as the incoming total makes the office remainder appear as
            // 0,00 €.  Prefer the configured carrier total whenever one is
            // available and only fall back to the persisted matrix for
            // legacy policies that have no matching total rule.
            // Prefer the dedicated total rule, but fall back to the matched
            // producer rule as well. A producer-specific rule can legitimately
            // contain both values (e.g. 16% carrier total / 10% producer),
            // and older records may not have a separately discoverable total
            // rule. In that case the office remainder must still be 6%.
            var configuredTotalPct = ConfiguredTotalPercent(totalRule)
                ?? ConfiguredTotalPercent(match);
            var incomingPct = hasBridgeAgencyCommission
                ? net > 0 ? Math.Round(bridgeAgencyCommission / net * 100m, 2) : 0m
                : configuredTotalPct
                    ?? (materialized is not null
                        ? materialized.AgencyPercent + materialized.ProducerPercent
                        : 0m);
            var incomingComm = hasBridgeAgencyCommission
                ? bridgeAgencyCommission
                : Math.Round(net * incomingPct / 100m, 2);
            var agencyComm = hasProducer
                ? Math.Max(incomingComm - partnerComm, 0m)
                : incomingComm;
            var agencyPct = net > 0 ? Math.Round(agencyComm / net * 100m, 2) : 0m;
            string? warning = null;
            if (hasBridgeAgencyCommission && totalRule?.AgencyPercent.HasValue == true
                && Math.Abs(incomingPct - totalRule.AgencyPercent.Value) > 0.5m)
                warning = $"Η γέφυρα δίνει συνολική προμήθεια {incomingPct:0.##}% ενώ η παραμετροποίηση έχει {totalRule.AgencyPercent.Value:0.##}%. Ισχύει η γέφυρα.";
            if (agencyComm < 0)
                warning = "Η προμήθεια συνεργάτη είναι μεγαλύτερη από την προμήθεια γραφείου. Ελέγξτε τη σύμβαση ή επικοινωνήστε για να επιλυθεί η διαφορά.";

            return new ProductionRowDto(
                p.Id, p.PolicyNumber,
                p.StartDate, p.EndDate,
                p.Customer == null ? "—"
                    : (p.Customer.Type == CustomerType.Individual
                        ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim()
                        : p.Customer.CompanyName ?? "—"),
                p.InsuranceCompany?.Name ?? "—",
                p.Producer?.Name,
                p.PolicyType.ToString(),
                p.Status.ToString(),
                p.VehicleUseCategory,
                coverCode,
                coverageCodes,
                p.Premium, net, vat,
                partnerPct, partnerComm,
                agencyPct, agencyComm,
                incomingPct, incomingComm,
                warning);
        }).ToList();
    }

    private static string? CleanCode(string? value)
    {
        var cleaned = value?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static decimal? ConfiguredTotalPercent(CommissionRule? rule)
    {
        if (rule is null) return null;
        if (rule.AgencyPercent.HasValue)
            return rule.AgencyPercent.Value > 0m ? rule.AgencyPercent.Value : null;
        return !rule.ProducerPercent.HasValue
            && rule.CommissionType == CommissionType.Percentage
            && rule.Value > 0m
            ? rule.Value
            : null;
    }

    private static string? ExtractCoverCode(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(specsJson);
            foreach (var key in new[] { "coverCode", "coverageCode", "coverage", "cover" })
            {
                if (doc.RootElement.TryGetProperty(key, out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    return CleanCode(prop.GetString());
            }
        }
        catch { /* malformed specs are ignored for reporting filters */ }
        return null;
    }

    private static string? ExtractPackageCode(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(specsJson);
            foreach (var key in new[] { "packageCode", "package" })
            {
                if (doc.RootElement.TryGetProperty(key, out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    return CleanCode(prop.GetString());
            }
        }
        catch { /* malformed specs are ignored */ }
        return null;
    }
}

/* ============================================================================
   EXPORTS — CSV / XLSX / PDF
   ========================================================================= */
public record ExportProductionListQuery(ProductionFilters Filters, string Format, string? Columns = null) : IRequest<ExportResult>;
public record ExportResult(byte[] Content, string MimeType, string FileName);

public class ExportProductionListHandler : IRequestHandler<ExportProductionListQuery, ExportResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ExportProductionListHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ExportResult> Handle(ExportProductionListQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await ProductionListBuilder.BuildRowsAsync(_db, tenantId, q.Filters, ct);
        var ts = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");

        // All formats share the visible-table projection, including legacy callers.
        var sheet = await BuildSelectedSheetAsync(rows, q.Columns ?? "", q.Filters, ct);
        return q.Format.ToLowerInvariant() switch
        {
            "csv" => new ExportResult(ExportFormatter.BuildCsv(sheet), "text/csv", $"production-{ts}.csv"),
            "xlsx" => new ExportResult(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"production-{ts}.xlsx"),
            "pdf" => new ExportResult(ExportFormatter.BuildPdf(sheet), "application/pdf", $"production-{ts}.pdf"),
            _ => throw new AppException("export_format_unsupported", $"Μη υποστηριζόμενη μορφή: {q.Format}", 400)
        };
    }

    private async Task<Sheet> BuildSelectedSheetAsync(
        List<ProductionRowDto> rows,
        string columns,
        ProductionFilters filters,
        CancellationToken ct)
    {
        var all = new (string Key, string Label)[]
        {
            ("policyNumber", "Αρ. συμβολαίου"), ("startDate", "Έναρξη"), ("duration", "Διάρκεια"),
            ("endDate", "Λήξη"), ("customerName", "Πελάτης"), ("carrier", "Εταιρεία"),
            ("producer", "Συνεργάτης"), ("type", "Κλάδος"), ("use", "Χρήση"),
            ("cover", "Καλύψεις"), ("status", "Κατάσταση"), ("gross", "Μικτά"),
            ("net", "Καθαρά"), ("bridgeComm", "Προμ. έδρας πριν την κατανομή"),
            ("partnerPct", "Ποσοστό συνεργάτη"), ("partner", "Προμ. συνεργάτη"),
            ("agency", "Προμ. έδρας"), ("check", "Έλεγχος")
        };
        var requested = columns.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var selected = all.Where(x => requested.Contains(x.Key, StringComparer.OrdinalIgnoreCase)).ToArray();
        if (selected.Length == 0) selected = all;

        var groups = GroupForExport(rows, filters.GroupBy);
        var output = new List<IReadOnlyList<string>>();
        if (groups.Count == 0)
        {
            output.AddRange(rows.Select(row => selected.Select(x => Value(x.Key, row)).ToArray()));
        }
        foreach (var group in groups)
        {
            var dimension = GroupDimensionLabel(filters.GroupBy);
            output.Add(selected.Select((_, index) => index == 0 ? $"ΟΜΑΔΑ: {dimension} · {group.Key}" : "").ToArray());
            output.AddRange(group.Rows.Select(row => selected.Select(x => Value(x.Key, row)).ToArray()));
            output.Add(selected.Select(x => SummaryValue(x.Key, group.Key, group.Rows)).ToArray());
        }
        output.Add(selected.Select(x => SummaryValue(x.Key, "", rows)).ToArray());

        var office = _current.AgencyOfficeId.HasValue
            ? await _db.AgencyOffices.AsNoTracking().Where(x => x.Id == _current.AgencyOfficeId.Value)
                .Select(x => new { x.Name, x.Address, x.City, x.PostalCode, x.Email, x.Phone }).FirstOrDefaultAsync(ct)
            : null;
        var tenant = await _db.Tenants.AsNoTracking().Where(x => x.Id == _current.TenantId!.Value)
            .Select(x => new { x.Name, x.AddressLine, x.ContactEmail, x.ContactPhone, x.VatNumber }).FirstOrDefaultAsync(ct);
        var label = office?.Name ?? tenant?.Name;
        var details = new[]
        {
            office is null ? tenant?.AddressLine : string.Join(", ", new[] { office.Address, office.City, office.PostalCode }.Where(x => !string.IsNullOrWhiteSpace(x))),
            office?.Phone ?? tenant?.ContactPhone, office?.Email ?? tenant?.ContactEmail,
            string.IsNullOrWhiteSpace(tenant?.VatNumber) ? null : $"ΑΦΜ: {tenant!.VatNumber}"
        }.Where(x => !string.IsNullOrWhiteSpace(x));
        var filterSummary = await BuildFilterSummaryAsync(filters, rows.Count, ct);
        return new Sheet("Λίστες παραγωγής", selected.Select(x => x.Label).ToArray(), output,
            filterSummary, label, string.Join(" · ", details),
            HeaderTitle: string.IsNullOrWhiteSpace(label) ? "Λίστες παραγωγής" : label);

        static string Value(string key, ProductionRowDto r) => key switch
        {
            "policyNumber" => r.PolicyNumber,
            "startDate" => r.StartDate.ToString("yyyy-MM-dd"),
            "duration" => Duration(r.StartDate, r.EndDate),
            "endDate" => r.EndDate.ToString("yyyy-MM-dd"),
            "customerName" => r.CustomerName,
            "carrier" => r.InsuranceCompany,
            "producer" => r.Producer ?? "",
            "type" => r.PolicyType,
            "use" => r.VehicleUseCategory?.ToString() ?? "",
            "cover" => string.Join(", ", r.CoverageCodes),
            "status" => r.Status,
            "gross" => F(r.Gross),
            "net" => F(r.Net),
            "bridgeComm" => $"{F(r.IncomingAgencyCommission)} ({r.IncomingAgencyCommissionPercent:F1}%)",
            "partnerPct" => $"{r.PartnerCommissionPercent:F1}%",
            "partner" => F(r.PartnerCommission),
            "agency" => F(r.AgencyCommission),
            "check" => r.CommissionWarning ?? "OK",
            _ => ""
        };
        static string SummaryValue(string key, string group, IReadOnlyCollection<ProductionRowDto> source) => key switch
        {
            "policyNumber" => string.IsNullOrWhiteSpace(group) ? "ΣΥΝΟΛΑ" : $"ΥΠΟΣΥΝΟΛΟ {group}",
            "status" => $"{source.Count} συμβόλαια",
            "gross" => F(source.Sum(x => x.Gross)),
            "net" => F(source.Sum(x => x.Net)),
            "partner" => F(source.Sum(x => x.PartnerCommission)),
            "agency" => F(source.Sum(x => x.AgencyCommission)),
            _ => ""
        };
        static string Duration(DateOnly start, DateOnly end)
        {
            var months = (end.Year - start.Year) * 12 + end.Month - start.Month;
            if (end.Day < start.Day) months--;
            return $"{Math.Max(0, months)} μήνες";
        }
        static string F(decimal value) => value.ToString("F2", CultureInfo.InvariantCulture);
    }

    private async Task<string> BuildFilterSummaryAsync(ProductionFilters filters, int rowCount, CancellationToken ct)
    {
        var bits = new List<string> { $"{rowCount} συμβόλαια" };
        if (filters.From.HasValue) bits.Add($"Από: {filters.From.Value:dd/MM/yyyy}");
        if (filters.To.HasValue) bits.Add($"Έως: {filters.To.Value:dd/MM/yyyy}");
        bits.Add($"Πεδίο ημερομηνίας: {filters.DateField?.ToLowerInvariant() switch
        {
            "issued" => "Ημερομηνία Έκδοσης",
            "recorded" => "Ημερομηνία Καταχώρησης",
            _ => "Ημερομηνία Έναρξης"
        }}");
        if (filters.InsuranceCompanyId.HasValue)
        {
            var carrier = await _db.InsuranceCompanies.AsNoTracking()
                .Where(x => x.Id == filters.InsuranceCompanyId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(carrier)) bits.Add($"Εταιρεία: {carrier}");
        }
        if (filters.ProducerId.HasValue)
        {
            var producer = await _db.Producers.AsNoTracking()
                .Where(x => x.Id == filters.ProducerId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(producer)) bits.Add($"Συνεργάτης: {producer}");
        }
        if (filters.PolicyType.HasValue) bits.Add($"Κλάδος: {filters.PolicyType}");
        else if (!string.IsNullOrWhiteSpace(filters.BranchCodeRaw)) bits.Add($"Κλάδος: {filters.BranchCodeRaw}");
        if (filters.Status.HasValue) bits.Add($"Κατάσταση: {filters.Status}");
        if (filters.VehicleUseCategory.HasValue) bits.Add($"Χρήση: {filters.VehicleUseCategory}");
        else if (!string.IsNullOrWhiteSpace(filters.UseCodeRaw)) bits.Add($"Χρήση: {filters.UseCodeRaw}");
        if (!string.IsNullOrWhiteSpace(filters.CoverCode)) bits.Add($"Κάλυψη: {filters.CoverCode}");
        if (!string.IsNullOrWhiteSpace(filters.PackageCode)) bits.Add($"Πακέτο: {filters.PackageCode}");
        var grouping = filters.GroupBy?.ToLowerInvariant() switch
        {
            "carrier" => "ανά εταιρεία",
            "producer" => "ανά συνεργάτη",
            "type" => "ανά κλάδο",
            "month" => "ανά μήνα",
            _ => null
        };
        if (grouping is not null) bits.Add($"Ομαδοποίηση: {grouping}");
        return string.Join(" · ", bits);
    }

    private static string GroupDimensionLabel(string? groupBy) => groupBy?.ToLowerInvariant() switch
    {
        "carrier" => "Εταιρεία",
        "producer" => "Συνεργάτης",
        "type" => "Κλάδος",
        "month" => "Μήνας",
        _ => "Ομάδα"
    };

    private sealed record ExportGroup(string Key, IReadOnlyList<ProductionRowDto> Rows);

    // Use the exact grouping selected in the production-list UI. An empty
    // grouping keeps the export flat, just like the on-screen table.
    private static List<ExportGroup> GroupForExport(List<ProductionRowDto> rows, string? groupBy)
    {
        Func<ProductionRowDto, string>? selector = groupBy?.ToLowerInvariant() switch
        {
            "carrier" => row => row.InsuranceCompany,
            "producer" => row => string.IsNullOrWhiteSpace(row.Producer) ? "Χωρίς συνεργάτη" : row.Producer!,
            "type" => row => row.PolicyType,
            "month" => row => row.StartDate.ToString("yyyy-MM"),
            _ => null
        };
        if (selector is null) return new List<ExportGroup>();

        var grouped = rows
            .GroupBy(selector)
            .Select(group => new ExportGroup(
                group.Key,
                group.OrderByDescending(row => row.StartDate).ToList()))
            .ToList();

        grouped.Sort((left, right) =>
        {
            var leftEmpty = left.Key is "Χωρίς συνεργάτη" or "—";
            var rightEmpty = right.Key is "Χωρίς συνεργάτη" or "—";
            if (leftEmpty != rightEmpty) return leftEmpty ? 1 : -1;
            return string.Equals(groupBy, "month", StringComparison.OrdinalIgnoreCase)
                ? string.Compare(right.Key, left.Key, StringComparison.Ordinal)
                : string.Compare(left.Key, right.Key, new CultureInfo("el-GR"), CompareOptions.IgnoreCase);
        });
        return grouped;
    }

}
