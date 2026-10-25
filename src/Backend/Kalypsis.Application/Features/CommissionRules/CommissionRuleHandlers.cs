using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CommissionRules;

// ============================================================================
// CommissionRule CRUD — the "Παραμετροποίηση Προμηθειών" UI in ΠΑΡΑΜΕΤΡΟΠΟΙΗΣΗ.
// One rule per (carrier?, policyType?, tier?, producer?) tuple — broader scope
// when fields are left null. Most-specific rule wins at lookup time
// (see ProductionListBuilder.LookupPartnerPct).
// ============================================================================

public record CommissionRuleDto(
    Guid Id,
    Guid? ProducerId, string? ProducerName,
    ProducerTier? ProducerTier,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    PolicyType? PolicyType,
    string? CoverCode,
    VehicleUseCategory? VehicleUseCategory,
    decimal? AgencyPercent,
    decimal? ProducerPercent,
    decimal? LegacyValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    // Multi-level ALIS-parity fields — projected out of LevelPercentsJson
    // so the frontend gets 5 discrete inputs instead of a raw JSON blob.
    decimal? ManagerPercent = null,
    decimal? UnitPercent = null,
    decimal? AssistantPercent = null,
    decimal? TaxWithholdingPercent = null,
    string? AgreementNumber = null,
    int Priority = 0,
    int? InsuranceYear = null,
    decimal? MinimumGrossPremium = null,
    decimal? MaximumGrossPremium = null,
    decimal? MinimumDeductible = null,
    decimal? MaximumDeductible = null,
    CommissionCalculationBase? AgencyCalculationBase = null,
    CommissionCalculationBase? ProducerCalculationBase = null,
    CommissionCalculationBase? OverCommissionCalculationBase = null,
    CommissionCalculationBase? IncomingCalculationBase = null,
    decimal? IncomingPercent = null,
    decimal? OverCommissionPercent = null);

public record CommissionRuleBody(
    Guid? ProducerId,
    ProducerTier? ProducerTier,
    Guid? InsuranceCompanyId,
    PolicyType? PolicyType,
    string? CoverCode,
    VehicleUseCategory? VehicleUseCategory,
    decimal? AgencyPercent,
    decimal? ProducerPercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    // Multi-level ALIS-parity fields
    decimal? ManagerPercent = null,
    decimal? UnitPercent = null,
    decimal? AssistantPercent = null,
    decimal? TaxWithholdingPercent = null,
    string? AgreementNumber = null,
    int Priority = 0,
    int? InsuranceYear = null,
    decimal? MinimumGrossPremium = null,
    decimal? MaximumGrossPremium = null,
    decimal? MinimumDeductible = null,
    decimal? MaximumDeductible = null,
    CommissionCalculationBase? AgencyCalculationBase = null,
    CommissionCalculationBase? ProducerCalculationBase = null,
    CommissionCalculationBase? OverCommissionCalculationBase = null,
    CommissionCalculationBase? IncomingCalculationBase = null,
    decimal? IncomingPercent = null,
    decimal? OverCommissionPercent = null);

public record CommissionRuleBatchBody(
    Guid? ProducerId,
    ProducerTier? ProducerTier,
    Guid? InsuranceCompanyId,
    IReadOnlyList<PolicyType>? PolicyTypes,
    IReadOnlyList<VehicleUseCategory>? VehicleUseCategories,
    IReadOnlyList<string>? CoverCodes,
    decimal? AgencyPercent,
    decimal? ProducerPercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    bool ReplaceExisting = true,
    // Multi-level ALIS-parity fields — applied identically to every rule
    // created by the batch. Bulk hierarchy setup usually shares the same
    // Manager/Unit/Assistant % across the whole carrier scope.
    decimal? ManagerPercent = null,
    decimal? UnitPercent = null,
    decimal? AssistantPercent = null,
    decimal? TaxWithholdingPercent = null,
    string? AgreementNumber = null,
    int Priority = 0,
    int? InsuranceYear = null,
    decimal? MinimumGrossPremium = null,
    decimal? MaximumGrossPremium = null,
    decimal? MinimumDeductible = null,
    decimal? MaximumDeductible = null,
    CommissionCalculationBase? AgencyCalculationBase = null,
    CommissionCalculationBase? ProducerCalculationBase = null,
    CommissionCalculationBase? OverCommissionCalculationBase = null,
    CommissionCalculationBase? IncomingCalculationBase = null,
    decimal? IncomingPercent = null,
    decimal? OverCommissionPercent = null);

public record CommissionRuleBatchResult(int Created, int Updated, IReadOnlyList<CommissionRuleDto> Rules);

internal static class CommissionRuleConflictGuard
{
    public static bool Conflicts(CommissionRule candidate, CommissionRule existing)
    {
        if (candidate.Id == existing.Id || candidate.DeletedAt is not null) return false;
        var sameScope = candidate.ProducerId == existing.ProducerId
            && candidate.ProducerTier == existing.ProducerTier
            && candidate.InsuranceCompanyId == existing.InsuranceCompanyId
            && candidate.PolicyType == existing.PolicyType
            && candidate.VehicleUseCategory == existing.VehicleUseCategory
            && string.Equals(candidate.CoverCode, existing.CoverCode, StringComparison.OrdinalIgnoreCase)
            && candidate.InsuranceYear == existing.InsuranceYear
            && candidate.Priority == existing.Priority;
        if (!sameScope) return false;

        var dateOverlap = (!candidate.EffectiveTo.HasValue || candidate.EffectiveTo >= existing.EffectiveFrom)
            && (!existing.EffectiveTo.HasValue || existing.EffectiveTo >= candidate.EffectiveFrom);
        static bool RangeOverlaps(decimal? amin, decimal? amax, decimal? bmin, decimal? bmax) =>
            (!amax.HasValue || !bmin.HasValue || amax.Value >= bmin.Value)
            && (!bmax.HasValue || !amin.HasValue || bmax.Value >= amin.Value);
        return dateOverlap
            && RangeOverlaps(candidate.MinimumGrossPremium, candidate.MaximumGrossPremium,
                existing.MinimumGrossPremium, existing.MaximumGrossPremium)
            && RangeOverlaps(candidate.MinimumDeductible, candidate.MaximumDeductible,
                existing.MinimumDeductible, existing.MaximumDeductible);
    }

    public static void EnsureNoConflict(CommissionRule candidate, IEnumerable<CommissionRule> rules)
    {
        if (rules.Any(r => Conflicts(candidate, r)))
            throw AppException.Validation("Υπάρχει ήδη κανόνας με ίδια προτεραιότητα και επικαλυπτόμενα κριτήρια/περιόδους. Αλλάξτε προτεραιότητα, έτος ή εύρος τιμών.");
    }
}

// --- Shared serialisation helpers for the ALIS-parity multi-level percents.
// Keeps every read/write path aligned without adding a whole abstraction.
internal static class CommissionRuleMultiLevel
{
    public static CommissionRuleDto ToDto(CommissionRule r)
    {
        var levels = ReadLevels(r.LevelPercentsJson);
        return new CommissionRuleDto(
            r.Id, r.ProducerId, r.Producer?.Name,
            r.ProducerTier,
            r.InsuranceCompanyId, r.InsuranceCompany?.Name,
            r.PolicyType, r.CoverCode, r.VehicleUseCategory,
            r.AgencyPercent, r.ProducerPercent,
            r.AgencyPercent.HasValue || r.ProducerPercent.HasValue ? null : r.Value,
            r.EffectiveFrom, r.EffectiveTo,
            levels.TryGetValue("Manager",   out var m) ? m : null,
            levels.TryGetValue("Unit",      out var u) ? u : null,
            levels.TryGetValue("Assistant", out var a) ? a : null,
            r.TaxWithholdingPercent,
            r.AgreementNumber, r.Priority, r.InsuranceYear,
            r.MinimumGrossPremium, r.MaximumGrossPremium,
            r.MinimumDeductible, r.MaximumDeductible,
            r.AgencyCalculationBase, r.ProducerCalculationBase, r.OverCommissionCalculationBase,
            r.IncomingCalculationBase, r.IncomingPercent, r.OverCommissionPercent);
    }

    /// <summary>
    /// Apply the ALIS-parity fields on the body to the entity. When any of
    /// Producer/Manager/Unit/Assistant/Agency percent is set we materialise
    /// <see cref="CommissionRule.LevelPercentsJson"/>; when they're all null
    /// we clear it so the legacy two-column fallback stays in charge.
    /// </summary>
    public static void ApplyLevels(CommissionRule r, CommissionRuleBody b)
    {
        var hasMultiLevel = b.ManagerPercent.HasValue || b.UnitPercent.HasValue || b.AssistantPercent.HasValue;
        var hasTwoLevel   = b.AgencyPercent.HasValue  || b.ProducerPercent.HasValue;

        if (hasMultiLevel || (hasTwoLevel && (b.ProducerPercent.HasValue || b.AgencyPercent.HasValue)))
        {
            // Assemble the full ordered map so downstream consumers can rely on
            // insertion order matching the display order.
            var map = new Dictionary<string, decimal>();
            if (b.ProducerPercent.HasValue)  map["Producer"]  = b.ProducerPercent.Value;
            if (b.ManagerPercent.HasValue)   map["Manager"]   = b.ManagerPercent.Value;
            if (b.UnitPercent.HasValue)      map["Unit"]      = b.UnitPercent.Value;
            if (b.AssistantPercent.HasValue) map["Assistant"] = b.AssistantPercent.Value;
            if (b.AgencyPercent.HasValue)    map["Agency"]    = b.AgencyPercent.Value;
            // Only persist JSON when at least one *extra* level is defined;
            // pure Producer+Agency rows stay JSON-less so the calculator's
            // legacy fallback path picks them up untouched. That preserves
            // existing behaviour for every tenant that hasn't opted in.
            r.LevelPercentsJson = hasMultiLevel
                ? System.Text.Json.JsonSerializer.Serialize(map)
                : null;
        }
        else
        {
            r.LevelPercentsJson = null;
        }

        r.TaxWithholdingPercent = b.TaxWithholdingPercent;
        r.AgreementNumber = string.IsNullOrWhiteSpace(b.AgreementNumber) ? null : b.AgreementNumber.Trim();
        r.Priority = b.Priority;
        r.InsuranceYear = b.InsuranceYear;
        r.MinimumGrossPremium = b.MinimumGrossPremium;
        r.MaximumGrossPremium = b.MaximumGrossPremium;
        r.MinimumDeductible = b.MinimumDeductible;
        r.MaximumDeductible = b.MaximumDeductible;
        r.AgencyCalculationBase = b.AgencyCalculationBase;
        r.ProducerCalculationBase = b.ProducerCalculationBase;
        r.OverCommissionCalculationBase = b.OverCommissionCalculationBase;
        r.IncomingCalculationBase = b.IncomingCalculationBase;
        r.IncomingPercent = b.IncomingPercent;
        r.OverCommissionPercent = b.OverCommissionPercent;
    }

    private static Dictionary<string, decimal> ReadLevels(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, decimal>>(json)
                ?? new();
        }
        catch { return new(); }
    }
}

/* ========= List ========= */

public record ListCommissionRulesQuery() : IRequest<IReadOnlyList<CommissionRuleDto>>;

public class ListCommissionRulesHandler : IRequestHandler<ListCommissionRulesQuery, IReadOnlyList<CommissionRuleDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListCommissionRulesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<CommissionRuleDto>> Handle(ListCommissionRulesQuery _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rules = await _db.CommissionRules
            .Include(r => r.Producer)
            .Include(r => r.InsuranceCompany)
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            // Order from broadest scope to narrowest so the rule the lookup picks
            // last appears at the top of the editor table.
            .OrderBy(r => r.ProducerId == null ? 0 : 1)
                .ThenBy(r => r.ProducerTier == null ? 0 : 1)
                .ThenBy(r => r.InsuranceCompanyId == null ? 0 : 1)
                .ThenBy(r => r.PolicyType == null ? 0 : 1)
                .ThenByDescending(r => r.EffectiveFrom)
            .ToListAsync(ct);

        return rules.Select(CommissionRuleMultiLevel.ToDto).ToList();
    }
}

/* ========= Create / Update ========= */

public record CreateCommissionRuleCommand(CommissionRuleBody Body) : IRequest<CommissionRuleDto>;
public record UpdateCommissionRuleCommand(Guid Id, CommissionRuleBody Body) : IRequest<CommissionRuleDto>;

public class CommissionRuleBodyValidator : AbstractValidator<CommissionRuleBody>
{
    public CommissionRuleBodyValidator()
    {
        RuleFor(x => x).Must(b => b.AgencyPercent.HasValue || b.ProducerPercent.HasValue || b.OverCommissionPercent.HasValue)
            .WithMessage("Ορίστε τουλάχιστον μία προμήθεια: έδρα, συνεργάτη ή υπερπρομήθεια.");
        RuleFor(x => x.AgencyPercent).GreaterThanOrEqualTo(0m)
            .When(x => x.AgencyCalculationBase == CommissionCalculationBase.FixedAmount && x.AgencyPercent.HasValue);
        RuleFor(x => x.AgencyPercent).InclusiveBetween(0m, 100m)
            .When(x => x.AgencyCalculationBase != CommissionCalculationBase.FixedAmount && x.AgencyPercent.HasValue);
        RuleFor(x => x.ProducerPercent).GreaterThanOrEqualTo(0m)
            .When(x => x.ProducerCalculationBase == CommissionCalculationBase.FixedAmount && x.ProducerPercent.HasValue);
        RuleFor(x => x.ProducerPercent).InclusiveBetween(0m, 100m)
            .When(x => x.ProducerCalculationBase != CommissionCalculationBase.FixedAmount && x.ProducerPercent.HasValue);
        RuleFor(x => x.CoverCode).MaximumLength(80);
        RuleFor(x => x).Must(b => !(b.ProducerId.HasValue && b.ProducerTier.HasValue))
            .WithMessage("Επιλέξτε είτε συγκεκριμένο συνεργάτη είτε κατηγορία, όχι και τα δύο.");
        RuleFor(x => x.AgreementNumber).MaximumLength(80);
        RuleFor(x => x.InsuranceYear).InclusiveBetween(1900, 2200).When(x => x.InsuranceYear.HasValue);
        RuleFor(x => x.Priority).InclusiveBetween(-10000, 10000);
        RuleFor(x => x.MinimumGrossPremium).GreaterThanOrEqualTo(0m).When(x => x.MinimumGrossPremium.HasValue);
        RuleFor(x => x.MaximumGrossPremium).GreaterThanOrEqualTo(0m).When(x => x.MaximumGrossPremium.HasValue);
        RuleFor(x => x.MinimumDeductible).GreaterThanOrEqualTo(0m).When(x => x.MinimumDeductible.HasValue);
        RuleFor(x => x.MaximumDeductible).GreaterThanOrEqualTo(0m).When(x => x.MaximumDeductible.HasValue);
        RuleFor(x => x.IncomingPercent).InclusiveBetween(0m, 100m).When(x => x.IncomingPercent.HasValue);
        RuleFor(x => x.OverCommissionPercent).GreaterThanOrEqualTo(0m)
            .When(x => x.OverCommissionCalculationBase == CommissionCalculationBase.FixedAmount && x.OverCommissionPercent.HasValue);
        RuleFor(x => x.OverCommissionPercent).InclusiveBetween(0m, 100m)
            .When(x => x.OverCommissionCalculationBase != CommissionCalculationBase.FixedAmount && x.OverCommissionPercent.HasValue);
        RuleFor(x => x.IncomingCalculationBase).Must(x => x is CommissionCalculationBase.GrossPremium or CommissionCalculationBase.NetPremium)
            .When(x => x.IncomingCalculationBase.HasValue)
            .WithMessage("Η εισερχόμενη προμήθεια υπολογίζεται σε μικτά ή καθαρά ασφάλιστρα.");
        RuleFor(x => x).Must(x => !new[] { x.AgencyCalculationBase, x.ProducerCalculationBase, x.OverCommissionCalculationBase }
                .Contains(CommissionCalculationBase.IncomingCommission)
                || (x.IncomingCalculationBase.HasValue && x.IncomingPercent.HasValue))
            .WithMessage("Για βάση «Εισερχόμενη προμήθεια», ορίστε πρώτα ποσοστό και βάση εισερχόμενης προμήθειας.");
        RuleFor(x => x).Must(x => !x.IncomingPercent.HasValue || x.IncomingCalculationBase.HasValue)
            .WithMessage("Επιλέξτε βάση μικτών ή καθαρών για την εισερχόμενη προμήθεια.");
        RuleFor(x => x).Must(x => !x.MinimumGrossPremium.HasValue || !x.MaximumGrossPremium.HasValue || x.MinimumGrossPremium <= x.MaximumGrossPremium)
            .WithMessage("Το ελάχιστο μικτό ασφάλιστρο δεν μπορεί να υπερβαίνει το μέγιστο.");
        RuleFor(x => x).Must(x => !x.MinimumDeductible.HasValue || !x.MaximumDeductible.HasValue || x.MinimumDeductible <= x.MaximumDeductible)
            .WithMessage("Η ελάχιστη απαλλαγή δεν μπορεί να υπερβαίνει τη μέγιστη.");
        RuleFor(x => x.EffectiveTo).GreaterThanOrEqualTo(x => x.EffectiveFrom)
            .When(x => x.EffectiveTo.HasValue);
    }
}

public class CreateCommissionRuleHandler : IRequestHandler<CreateCommissionRuleCommand, CommissionRuleDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateCommissionRuleHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CommissionRuleDto> Handle(CreateCommissionRuleCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        new CommissionRuleBodyValidator().ValidateAndThrow(c.Body);

        var r = new CommissionRule
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            ProducerId = c.Body.ProducerId,
            ProducerTier = c.Body.ProducerTier,
            InsuranceCompanyId = c.Body.InsuranceCompanyId,
            PolicyType = c.Body.PolicyType,
            CoverCode = CommissionRuleInput.CleanCode(c.Body.CoverCode),
            VehicleUseCategory = c.Body.VehicleUseCategory,
            AgencyPercent = c.Body.AgencyPercent,
            ProducerPercent = c.Body.ProducerPercent,
            // Keep the legacy `Value` mirroring ProducerPercent so the older
            // lookup path (still used by some reports) stays consistent.
            Value = c.Body.ProducerPercent ?? c.Body.AgencyPercent ?? 0m,
            CommissionType = CommissionType.Percentage,
            EffectiveFrom = c.Body.EffectiveFrom,
            EffectiveTo = c.Body.EffectiveTo
        };
        CommissionRuleMultiLevel.ApplyLevels(r, c.Body);
        var existingRules = await _db.CommissionRules
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null).ToListAsync(ct);
        CommissionRuleConflictGuard.EnsureNoConflict(r, existingRules);
        _db.CommissionRules.Add(r);
        await _db.SaveChangesAsync(ct);
        return await ReloadAsync(r.Id, ct);
    }

    private async Task<CommissionRuleDto> ReloadAsync(Guid id, CancellationToken ct)
    {
        var r = await _db.CommissionRules
            .Include(x => x.Producer).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == id, ct);
        return CommissionRuleMultiLevel.ToDto(r);
    }
}

public record UpsertCommissionRuleBatchCommand(CommissionRuleBatchBody Body) : IRequest<CommissionRuleBatchResult>;

public class UpsertCommissionRuleBatchHandler : IRequestHandler<UpsertCommissionRuleBatchCommand, CommissionRuleBatchResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertCommissionRuleBatchHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CommissionRuleBatchResult> Handle(UpsertCommissionRuleBatchCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = c.Body;
        new CommissionRuleBodyValidator().ValidateAndThrow(new CommissionRuleBody(
            b.ProducerId, b.ProducerTier, b.InsuranceCompanyId, null, null, null,
            b.AgencyPercent, b.ProducerPercent, b.EffectiveFrom, b.EffectiveTo,
            b.ManagerPercent, b.UnitPercent, b.AssistantPercent, b.TaxWithholdingPercent,
            b.AgreementNumber, b.Priority, b.InsuranceYear, b.MinimumGrossPremium,
            b.MaximumGrossPremium, b.MinimumDeductible, b.MaximumDeductible,
            b.AgencyCalculationBase, b.ProducerCalculationBase, b.OverCommissionCalculationBase,
            b.IncomingCalculationBase, b.IncomingPercent, b.OverCommissionPercent));
        if (!b.AgencyPercent.HasValue && !b.ProducerPercent.HasValue && !b.OverCommissionPercent.HasValue)
            throw new AppException("commission_percent_required",
                "Ορίστε τουλάχιστον μία προμήθεια: έδρα, συνεργάτη ή υπερπρομήθεια.", 400);
        if (b.ProducerId.HasValue && b.ProducerTier.HasValue)
            throw new AppException("commission_target_conflict",
                "Επιλέξτε είτε συγκεκριμένο συνεργάτη είτε κατηγορία, όχι και τα δύο.", 400);
        if (b.EffectiveTo.HasValue && b.EffectiveTo.Value < b.EffectiveFrom)
            throw new AppException("invalid_effective_period",
                "Η ισχύς έως δεν μπορεί να είναι πριν την ισχύ από.", 400);

        var policyTypes = (b.PolicyTypes is { Count: > 0 }
                ? b.PolicyTypes.Distinct().Cast<PolicyType?>()
                : new PolicyType?[] { null })
            .ToList();
        var requestedUses = (b.VehicleUseCategories ?? Array.Empty<VehicleUseCategory>())
            .Where(x => x != VehicleUseCategory.None)
            .Distinct()
            .ToList();
        var coverCodes = (b.CoverCodes ?? Array.Empty<string>())
            .Select(CommissionRuleInput.CleanCode)
            .Where(x => x is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Cast<string?>()
            .DefaultIfEmpty(null)
            .ToList();

        var existing = await _db.CommissionRules
            .Include(x => x.Producer)
            .Include(x => x.InsuranceCompany)
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .ToListAsync(ct);

        var changedIds = new List<Guid>();
        var created = 0;
        var updated = 0;

        foreach (var policyType in policyTypes)
        {
            var useScopes = policyType == PolicyType.Auto
                ? requestedUses.Cast<VehicleUseCategory?>().DefaultIfEmpty(null).ToList()
                : new List<VehicleUseCategory?> { null };

            foreach (var use in useScopes)
            foreach (var cover in coverCodes)
            {
                var rule = b.ReplaceExisting
                    ? existing.FirstOrDefault(x =>
                        x.ProducerId == b.ProducerId
                        && x.ProducerTier == b.ProducerTier
                        && x.InsuranceCompanyId == b.InsuranceCompanyId
                        && x.PolicyType == policyType
                        && x.VehicleUseCategory == use
                        && string.Equals(x.CoverCode, cover, StringComparison.OrdinalIgnoreCase)
                        && x.Priority == b.Priority && x.InsuranceYear == b.InsuranceYear
                        && x.MinimumGrossPremium == b.MinimumGrossPremium && x.MaximumGrossPremium == b.MaximumGrossPremium
                        && x.MinimumDeductible == b.MinimumDeductible && x.MaximumDeductible == b.MaximumDeductible)
                    : null;

                if (rule is null)
                {
                    rule = new CommissionRule
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId
                    };
                    _db.CommissionRules.Add(rule);
                    existing.Add(rule);
                    created++;
                }
                else
                {
                    updated++;
                }

                // A rule with the same precedence and overlapping criteria is
                // ambiguous. Catch it before persisting the batch, while still
                // allowing intentionally tiered premium/deductible ranges.
                var conflictCandidate = new CommissionRule
                {
                    Id = rule.Id, TenantId = tenantId, ProducerId = b.ProducerId, ProducerTier = b.ProducerTier,
                    InsuranceCompanyId = b.InsuranceCompanyId, PolicyType = policyType,
                    VehicleUseCategory = use, CoverCode = cover, Priority = b.Priority,
                    InsuranceYear = b.InsuranceYear, EffectiveFrom = b.EffectiveFrom, EffectiveTo = b.EffectiveTo,
                    MinimumGrossPremium = b.MinimumGrossPremium, MaximumGrossPremium = b.MaximumGrossPremium,
                    MinimumDeductible = b.MinimumDeductible, MaximumDeductible = b.MaximumDeductible
                };
                CommissionRuleConflictGuard.EnsureNoConflict(conflictCandidate, existing.Where(x => x.Id != rule.Id));

                rule.ProducerId = b.ProducerId;
                rule.ProducerTier = b.ProducerTier;
                rule.InsuranceCompanyId = b.InsuranceCompanyId;
                rule.PolicyType = policyType;
                rule.VehicleUseCategory = use;
                rule.CoverCode = cover;
                rule.AgencyPercent = b.AgencyPercent;
                rule.ProducerPercent = b.ProducerPercent;
                rule.Value = b.ProducerPercent ?? b.AgencyPercent ?? 0m;
                rule.CommissionType = CommissionType.Percentage;
                rule.EffectiveFrom = b.EffectiveFrom;
                rule.EffectiveTo = b.EffectiveTo;
                rule.AgreementNumber = string.IsNullOrWhiteSpace(b.AgreementNumber) ? null : b.AgreementNumber.Trim();
                rule.Priority = b.Priority;
                rule.InsuranceYear = b.InsuranceYear;
                rule.MinimumGrossPremium = b.MinimumGrossPremium;
                rule.MaximumGrossPremium = b.MaximumGrossPremium;
                rule.MinimumDeductible = b.MinimumDeductible;
                rule.MaximumDeductible = b.MaximumDeductible;
                // Reuse the single-write helper via a lightweight body shim so
                // the batch path never diverges from Create/Update mapping.
                CommissionRuleMultiLevel.ApplyLevels(rule, new CommissionRuleBody(
                    b.ProducerId, b.ProducerTier, b.InsuranceCompanyId,
                    policyType, cover, use,
                    b.AgencyPercent, b.ProducerPercent,
                    b.EffectiveFrom, b.EffectiveTo,
                    b.ManagerPercent, b.UnitPercent, b.AssistantPercent, b.TaxWithholdingPercent,
                    b.AgreementNumber, b.Priority, b.InsuranceYear, b.MinimumGrossPremium,
                    b.MaximumGrossPremium, b.MinimumDeductible, b.MaximumDeductible,
                    b.AgencyCalculationBase, b.ProducerCalculationBase, b.OverCommissionCalculationBase,
                    b.IncomingCalculationBase, b.IncomingPercent, b.OverCommissionPercent));
                changedIds.Add(rule.Id);
            }
        }

        await _db.SaveChangesAsync(ct);

        var saved = await _db.CommissionRules
            .Include(x => x.Producer)
            .Include(x => x.InsuranceCompany)
            .Where(x => changedIds.Contains(x.Id))
            .ToListAsync(ct);

        return new CommissionRuleBatchResult(created, updated, saved.Select(CommissionRuleMultiLevel.ToDto).ToList());
    }
}

public class UpdateCommissionRuleHandler : IRequestHandler<UpdateCommissionRuleCommand, CommissionRuleDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateCommissionRuleHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CommissionRuleDto> Handle(UpdateCommissionRuleCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        new CommissionRuleBodyValidator().ValidateAndThrow(c.Body);

        var r = await _db.CommissionRules
            .FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κανόνας προμήθειας");

        r.ProducerId = c.Body.ProducerId;
        r.ProducerTier = c.Body.ProducerTier;
        r.InsuranceCompanyId = c.Body.InsuranceCompanyId;
        r.PolicyType = c.Body.PolicyType;
        r.CoverCode = CommissionRuleInput.CleanCode(c.Body.CoverCode);
        r.VehicleUseCategory = c.Body.VehicleUseCategory;
        r.AgencyPercent = c.Body.AgencyPercent;
        r.ProducerPercent = c.Body.ProducerPercent;
        r.Value = c.Body.ProducerPercent ?? c.Body.AgencyPercent ?? 0m;
        r.CommissionType = CommissionType.Percentage;
        r.EffectiveFrom = c.Body.EffectiveFrom;
        r.EffectiveTo = c.Body.EffectiveTo;
        CommissionRuleMultiLevel.ApplyLevels(r, c.Body);
        var existingRules = await _db.CommissionRules
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.Id != r.Id).ToListAsync(ct);
        CommissionRuleConflictGuard.EnsureNoConflict(r, existingRules);
        await _db.SaveChangesAsync(ct);

        var reloaded = await _db.CommissionRules
            .Include(x => x.Producer).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == r.Id, ct);
        return CommissionRuleMultiLevel.ToDto(reloaded);
    }
}

internal static class CommissionRuleInput
{
    public static string? CleanCode(string? value)
    {
        var cleaned = value?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}

/* ========= Delete ========= */

public record DeleteCommissionRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteCommissionRuleHandler : IRequestHandler<DeleteCommissionRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteCommissionRuleHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteCommissionRuleCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var r = await _db.CommissionRules
            .FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κανόνας προμήθειας");
        r.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Safe default matrix ========= */

public record SeedZeroCommissionRulesCommand(Guid? InsuranceCompanyId) : IRequest<SeedZeroCommissionRulesResult>;
public record SeedZeroCommissionRulesResult(int CompaniesProcessed, int RulesCreated);

public class SeedZeroCommissionRulesHandler : IRequestHandler<SeedZeroCommissionRulesCommand, SeedZeroCommissionRulesResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public SeedZeroCommissionRulesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<SeedZeroCommissionRulesResult> Handle(SeedZeroCommissionRulesCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var companiesQuery = _db.InsuranceCompanies
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.IsActive);
        if (r.InsuranceCompanyId.HasValue) companiesQuery = companiesQuery.Where(c => c.Id == r.InsuranceCompanyId.Value);
        var companyIds = await companiesQuery.Select(c => c.Id).ToListAsync(ct);
        if (r.InsuranceCompanyId.HasValue && companyIds.Count == 0)
            throw AppException.NotFound("Ασφαλιστική εταιρεία");

        var created = 0;
        foreach (var companyId in companyIds)
            created += await SeedCompanyAsync(_db, tenantId, companyId, ct);
        await _db.SaveChangesAsync(ct);
        return new SeedZeroCommissionRulesResult(companyIds.Count, created);
    }

    private static async Task<int> SeedCompanyAsync(IAppDbContext db, Guid tenantId, Guid companyId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var companyCode = await db.InsuranceCompanies
            .Where(c => c.Id == companyId && c.DeletedAt == null)
            .Select(c => c.Code)
            .FirstOrDefaultAsync(ct);
        var companyParams = string.IsNullOrWhiteSpace(companyCode)
            ? new List<CompanyParameterItem>()
            : await db.CompanyParameterItems
                .Include(p => p.InsuranceCompany)
                .Where(p => p.DeletedAt == null && p.IsActive && p.InsuranceCompany.Code == companyCode)
                .ToListAsync(ct);
        var existing = await db.CommissionRules
            .Where(rule => rule.TenantId == tenantId && rule.DeletedAt == null && rule.InsuranceCompanyId == companyId)
            .Select(rule => new { rule.PolicyType, rule.VehicleUseCategory, rule.ProducerTier, rule.ProducerId, rule.CoverCode })
            .ToListAsync(ct);

        var tiers = new[] { ProducerTier.A, ProducerTier.B, ProducerTier.C, ProducerTier.D, ProducerTier.E };
        var branchTypes = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Branch && p.PolicyType.HasValue)
            .Select(p => p.PolicyType!.Value)
            .Distinct()
            .ToList();
        if (branchTypes.Count == 0)
            branchTypes = Enum.GetValues<PolicyType>().ToList();
        var autoUses = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Use && p.VehicleUseCategory.HasValue && p.VehicleUseCategory != VehicleUseCategory.None)
            .Select(p => p.VehicleUseCategory!.Value)
            .Distinct()
            .ToList();
        if (autoUses.Count == 0)
            autoUses = Enum.GetValues<VehicleUseCategory>().Where(use => use != VehicleUseCategory.None).ToList();
        var coverages = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Coverage && p.PolicyType.HasValue && !string.IsNullOrWhiteSpace(p.Code))
            .Select(p => new { PolicyType = p.PolicyType!.Value, CoverCode = p.Code })
            .Distinct()
            .ToList();
        var created = 0;

        bool Exists(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier, string? coverCode) =>
            existing.Any(rule => rule.ProducerId == null
                && rule.CoverCode == coverCode
                && rule.PolicyType == policyType
                && rule.VehicleUseCategory == vehicleUse
                && rule.ProducerTier == tier);

        void Add(PolicyType policyType, VehicleUseCategory? vehicleUse, ProducerTier tier, string? coverCode = null)
        {
            if (Exists(policyType, vehicleUse, tier, coverCode)) return;
            db.CommissionRules.Add(new CommissionRule
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InsuranceCompanyId = companyId,
                PolicyType = policyType,
                VehicleUseCategory = vehicleUse,
                ProducerTier = tier,
                CoverCode = coverCode,
                AgencyPercent = 0m,
                ProducerPercent = 0m,
                Value = 0m,
                CommissionType = CommissionType.Percentage,
                EffectiveFrom = today,
                CreatedAt = DateTime.UtcNow
            });
            created++;
        }

        foreach (var tier in tiers)
        {
            if (branchTypes.Contains(PolicyType.Auto))
                foreach (var use in autoUses) Add(PolicyType.Auto, use, tier);
            foreach (var policyType in branchTypes.Where(type => type != PolicyType.Auto))
                Add(policyType, null, tier);
            foreach (var coverage in coverages)
                Add(coverage.PolicyType, null, tier, coverage.CoverCode);
        }
        return created;
    }
}
