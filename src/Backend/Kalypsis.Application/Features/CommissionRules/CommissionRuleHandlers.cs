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
    DateOnly? EffectiveTo);

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
    DateOnly? EffectiveTo);

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
    bool ReplaceExisting = true);

public record CommissionRuleBatchResult(int Created, int Updated, IReadOnlyList<CommissionRuleDto> Rules);

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
        var rules = await _db.CommissionRules.IgnoreQueryFilters()
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

        return rules.Select(r => new CommissionRuleDto(
            r.Id, r.ProducerId, r.Producer?.Name,
            r.ProducerTier,
            r.InsuranceCompanyId, r.InsuranceCompany?.Name,
            r.PolicyType, r.CoverCode, r.VehicleUseCategory,
            r.AgencyPercent, r.ProducerPercent,
            r.AgencyPercent.HasValue || r.ProducerPercent.HasValue ? null : r.Value,
            r.EffectiveFrom, r.EffectiveTo)).ToList();
    }
}

/* ========= Create / Update ========= */

public record CreateCommissionRuleCommand(CommissionRuleBody Body) : IRequest<CommissionRuleDto>;
public record UpdateCommissionRuleCommand(Guid Id, CommissionRuleBody Body) : IRequest<CommissionRuleDto>;

public class CommissionRuleBodyValidator : AbstractValidator<CommissionRuleBody>
{
    public CommissionRuleBodyValidator()
    {
        RuleFor(x => x).Must(b => b.AgencyPercent.HasValue || b.ProducerPercent.HasValue)
            .WithMessage("Πρέπει να ορίσετε τουλάχιστον μία από τις δύο προμήθειες (έδρα ή συνεργάτη).");
        RuleFor(x => x.AgencyPercent).InclusiveBetween(0m, 100m).When(x => x.AgencyPercent.HasValue);
        RuleFor(x => x.ProducerPercent).InclusiveBetween(0m, 100m).When(x => x.ProducerPercent.HasValue);
        RuleFor(x => x.CoverCode).MaximumLength(80);
        RuleFor(x => x).Must(b => !(b.ProducerId.HasValue && b.ProducerTier.HasValue))
            .WithMessage("Επιλέξτε είτε συγκεκριμένο συνεργάτη είτε κατηγορία, όχι και τα δύο.");
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
        _db.CommissionRules.Add(r);
        await _db.SaveChangesAsync(ct);
        return await ReloadAsync(r.Id, ct);
    }

    private async Task<CommissionRuleDto> ReloadAsync(Guid id, CancellationToken ct)
    {
        var r = await _db.CommissionRules.IgnoreQueryFilters()
            .Include(x => x.Producer).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == id, ct);
        return new CommissionRuleDto(
            r.Id, r.ProducerId, r.Producer?.Name,
            r.ProducerTier,
            r.InsuranceCompanyId, r.InsuranceCompany?.Name,
            r.PolicyType, r.CoverCode, r.VehicleUseCategory,
            r.AgencyPercent, r.ProducerPercent,
            r.AgencyPercent.HasValue || r.ProducerPercent.HasValue ? null : r.Value,
            r.EffectiveFrom, r.EffectiveTo);
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
        if (!b.AgencyPercent.HasValue && !b.ProducerPercent.HasValue)
            throw new AppException("commission_percent_required",
                "Ορίστε τουλάχιστον μία προμήθεια: έδρα ή συνεργάτη.", 400);
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

        var existing = await _db.CommissionRules.IgnoreQueryFilters()
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
                        && string.Equals(x.CoverCode, cover, StringComparison.OrdinalIgnoreCase))
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
                changedIds.Add(rule.Id);
            }
        }

        await _db.SaveChangesAsync(ct);

        var saved = await _db.CommissionRules.IgnoreQueryFilters()
            .Include(x => x.Producer)
            .Include(x => x.InsuranceCompany)
            .Where(x => changedIds.Contains(x.Id))
            .ToListAsync(ct);

        return new CommissionRuleBatchResult(created, updated, saved.Select(ToDto).ToList());
    }

    private static CommissionRuleDto ToDto(CommissionRule r) => new(
        r.Id, r.ProducerId, r.Producer?.Name,
        r.ProducerTier,
        r.InsuranceCompanyId, r.InsuranceCompany?.Name,
        r.PolicyType, r.CoverCode, r.VehicleUseCategory,
        r.AgencyPercent, r.ProducerPercent,
        r.AgencyPercent.HasValue || r.ProducerPercent.HasValue ? null : r.Value,
        r.EffectiveFrom, r.EffectiveTo);
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

        var r = await _db.CommissionRules.IgnoreQueryFilters()
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
        await _db.SaveChangesAsync(ct);

        var reloaded = await _db.CommissionRules.IgnoreQueryFilters()
            .Include(x => x.Producer).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == r.Id, ct);
        return new CommissionRuleDto(
            reloaded.Id, reloaded.ProducerId, reloaded.Producer?.Name,
            reloaded.ProducerTier,
            reloaded.InsuranceCompanyId, reloaded.InsuranceCompany?.Name,
            reloaded.PolicyType, reloaded.CoverCode, reloaded.VehicleUseCategory,
            reloaded.AgencyPercent, reloaded.ProducerPercent,
            reloaded.AgencyPercent.HasValue || reloaded.ProducerPercent.HasValue ? null : reloaded.Value,
            reloaded.EffectiveFrom, reloaded.EffectiveTo);
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
        var r = await _db.CommissionRules.IgnoreQueryFilters()
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
        var companiesQuery = _db.InsuranceCompanies.IgnoreQueryFilters()
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
        var companyCode = await db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.Id == companyId && c.DeletedAt == null)
            .Select(c => c.Code)
            .FirstOrDefaultAsync(ct);
        var companyParams = string.IsNullOrWhiteSpace(companyCode)
            ? new List<CompanyParameterItem>()
            : await db.CompanyParameterItems.IgnoreQueryFilters()
                .Include(p => p.InsuranceCompany)
                .Where(p => p.DeletedAt == null && p.IsActive && p.InsuranceCompany.Code == companyCode)
                .ToListAsync(ct);
        var existing = await db.CommissionRules.IgnoreQueryFilters()
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
