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
    VehicleUseCategory? VehicleUseCategory,
    decimal? AgencyPercent,
    decimal? ProducerPercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo);

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
            r.PolicyType, r.VehicleUseCategory,
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
            r.PolicyType, r.VehicleUseCategory,
            r.AgencyPercent, r.ProducerPercent,
            r.AgencyPercent.HasValue || r.ProducerPercent.HasValue ? null : r.Value,
            r.EffectiveFrom, r.EffectiveTo);
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

        var r = await _db.CommissionRules.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == c.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κανόνας προμήθειας");

        r.ProducerId = c.Body.ProducerId;
        r.ProducerTier = c.Body.ProducerTier;
        r.InsuranceCompanyId = c.Body.InsuranceCompanyId;
        r.PolicyType = c.Body.PolicyType;
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
            reloaded.PolicyType, reloaded.VehicleUseCategory,
            reloaded.AgencyPercent, reloaded.ProducerPercent,
            reloaded.AgencyPercent.HasValue || reloaded.ProducerPercent.HasValue ? null : reloaded.Value,
            reloaded.EffectiveFrom, reloaded.EffectiveTo);
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
