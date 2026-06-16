using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Production;

/* ========= Over-commission rules ========= */

public record OverCommissionRuleDto(
    Guid Id, Guid ManagerProducerId, string ManagerName,
    Guid SubordinateProducerId, string SubordinateName,
    int Level, decimal Percentage, PolicyType? PolicyType,
    bool IsActive, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record OverCommissionRuleBody(
    Guid ManagerProducerId, Guid SubordinateProducerId,
    int Level, decimal Percentage, PolicyType? PolicyType,
    bool IsActive, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record ListOverCommissionRulesQuery() : IRequest<IReadOnlyList<OverCommissionRuleDto>>;
public class ListOverCommissionRulesQueryHandler : IRequestHandler<ListOverCommissionRulesQuery, IReadOnlyList<OverCommissionRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListOverCommissionRulesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<OverCommissionRuleDto>> Handle(ListOverCommissionRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.OverCommissionRules
            .Include(o => o.ManagerProducer).Include(o => o.SubordinateProducer)
            .OrderBy(o => o.Level).ThenBy(o => o.ManagerProducer.Name)
            .Take(500).ToListAsync(ct);
        return rows.Select(o => new OverCommissionRuleDto(
            o.Id, o.ManagerProducerId, o.ManagerProducer.Name,
            o.SubordinateProducerId, o.SubordinateProducer.Name,
            o.Level, o.Percentage, o.PolicyType,
            o.IsActive, o.EffectiveFrom, o.EffectiveTo)).ToList();
    }
}

public class OverCommissionRuleBodyValidator : AbstractValidator<OverCommissionRuleBody>
{
    public OverCommissionRuleBodyValidator()
    {
        RuleFor(x => x.ManagerProducerId).NotEmpty();
        RuleFor(x => x.SubordinateProducerId).NotEmpty();
        RuleFor(x => x.Level).InclusiveBetween(1, 9);
        RuleFor(x => x.Percentage).InclusiveBetween(0, 100);
    }
}

public record UpsertOverCommissionRuleCommand(Guid? Id, OverCommissionRuleBody Body) : IRequest<Guid>;
public class UpsertOverCommissionRuleCommandValidator : AbstractValidator<UpsertOverCommissionRuleCommand>
{ public UpsertOverCommissionRuleCommandValidator() { RuleFor(x => x.Body).SetValidator(new OverCommissionRuleBodyValidator()); } }

public class UpsertOverCommissionRuleCommandHandler : IRequestHandler<UpsertOverCommissionRuleCommand, Guid>
{
    private readonly IAppDbContext _db;
    public UpsertOverCommissionRuleCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Guid> Handle(UpsertOverCommissionRuleCommand r, CancellationToken ct)
    {
        OverCommissionRule o;
        if (r.Id.HasValue)
        {
            o = await _db.OverCommissionRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        }
        else
        {
            o = new OverCommissionRule { Id = Guid.NewGuid() };
            _db.OverCommissionRules.Add(o);
        }
        var b = r.Body;
        o.ManagerProducerId = b.ManagerProducerId; o.SubordinateProducerId = b.SubordinateProducerId;
        o.Level = b.Level; o.Percentage = b.Percentage; o.PolicyType = b.PolicyType;
        o.IsActive = b.IsActive; o.EffectiveFrom = b.EffectiveFrom; o.EffectiveTo = b.EffectiveTo;
        await _db.SaveChangesAsync(ct);
        return o.Id;
    }
}

public record DeleteOverCommissionRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteOverCommissionRuleCommandHandler : IRequestHandler<DeleteOverCommissionRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteOverCommissionRuleCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteOverCommissionRuleCommand r, CancellationToken ct)
    {
        var o = await _db.OverCommissionRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        o.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Production goals ========= */

public record ProductionGoalDto(
    Guid Id, Guid? ProducerId, string? ProducerName, int Year, int? Month,
    PolicyType? PolicyType, decimal TargetPremium, int? TargetPolicies, string? Notes);

public record ProductionGoalBody(
    Guid? ProducerId, int Year, int? Month, PolicyType? PolicyType,
    decimal TargetPremium, int? TargetPolicies, string? Notes);

public record ListProductionGoalsQuery(int? Year) : IRequest<IReadOnlyList<ProductionGoalDto>>;
public class ListProductionGoalsQueryHandler : IRequestHandler<ListProductionGoalsQuery, IReadOnlyList<ProductionGoalDto>>
{
    private readonly IAppDbContext _db;
    public ListProductionGoalsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ProductionGoalDto>> Handle(ListProductionGoalsQuery r, CancellationToken ct)
    {
        var q = _db.ProductionGoals.Include(g => g.Producer).AsQueryable();
        if (r.Year.HasValue) q = q.Where(g => g.Year == r.Year);
        var rows = await q.OrderByDescending(g => g.Year).ThenBy(g => g.Month).Take(500).ToListAsync(ct);
        return rows.Select(g => new ProductionGoalDto(
            g.Id, g.ProducerId,
            g.Producer?.Name,
            g.Year, g.Month, g.PolicyType, g.TargetPremium, g.TargetPolicies, g.Notes)).ToList();
    }
}

public class ProductionGoalBodyValidator : AbstractValidator<ProductionGoalBody>
{
    public ProductionGoalBodyValidator()
    {
        RuleFor(x => x.Year).InclusiveBetween(2000, 2100);
        When(x => x.Month.HasValue, () => RuleFor(x => x.Month!.Value).InclusiveBetween(1, 12));
        RuleFor(x => x.TargetPremium).GreaterThanOrEqualTo(0);
    }
}

public record UpsertProductionGoalCommand(Guid? Id, ProductionGoalBody Body) : IRequest<Guid>;
public class UpsertProductionGoalCommandValidator : AbstractValidator<UpsertProductionGoalCommand>
{ public UpsertProductionGoalCommandValidator() { RuleFor(x => x.Body).SetValidator(new ProductionGoalBodyValidator()); } }

public class UpsertProductionGoalCommandHandler : IRequestHandler<UpsertProductionGoalCommand, Guid>
{
    private readonly IAppDbContext _db;
    public UpsertProductionGoalCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Guid> Handle(UpsertProductionGoalCommand r, CancellationToken ct)
    {
        ProductionGoal g;
        if (r.Id.HasValue)
        {
            g = await _db.ProductionGoals.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Goal");
        }
        else
        {
            g = new ProductionGoal { Id = Guid.NewGuid() };
            _db.ProductionGoals.Add(g);
        }
        var b = r.Body;
        g.ProducerId = b.ProducerId; g.Year = b.Year; g.Month = b.Month;
        g.PolicyType = b.PolicyType; g.TargetPremium = b.TargetPremium;
        g.TargetPolicies = b.TargetPolicies; g.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        return g.Id;
    }
}

public record DeleteProductionGoalCommand(Guid Id) : IRequest<Unit>;
public class DeleteProductionGoalCommandHandler : IRequestHandler<DeleteProductionGoalCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteProductionGoalCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteProductionGoalCommand r, CancellationToken ct)
    {
        var g = await _db.ProductionGoals.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Goal");
        g.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Production statistics ========= */

public record ProductionStatsDto(
    int Year,
    decimal TotalPremium,
    int TotalPolicies,
    IReadOnlyList<MonthRow> Monthly,
    IReadOnlyList<TypeRow> ByType,
    IReadOnlyList<ProducerRow> ByProducer);

public record MonthRow(int Month, decimal Premium, int Count);
public record TypeRow(PolicyType Type, decimal Premium, int Count);
public record ProducerRow(Guid? ProducerId, string Name, decimal Premium, int Count);

public record GetProductionStatsQuery(int Year) : IRequest<ProductionStatsDto>;
public class GetProductionStatsQueryHandler : IRequestHandler<GetProductionStatsQuery, ProductionStatsDto>
{
    private readonly IAppDbContext _db;
    public GetProductionStatsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<ProductionStatsDto> Handle(GetProductionStatsQuery r, CancellationToken ct)
    {
        var first = new DateOnly(r.Year, 1, 1);
        var last = new DateOnly(r.Year, 12, 31);
        var rows = await _db.Policies
            .Where(p => p.StartDate >= first && p.StartDate <= last)
            .Select(p => new { p.StartDate, p.Premium, p.PolicyType, p.ProducerId, p.Producer })
            .ToListAsync(ct);

        var monthly = rows.GroupBy(x => x.StartDate.Month).Select(g => new MonthRow(g.Key, g.Sum(x => x.Premium), g.Count())).OrderBy(m => m.Month).ToList();
        var byType = rows.GroupBy(x => x.PolicyType).Select(g => new TypeRow(g.Key, g.Sum(x => x.Premium), g.Count())).ToList();
        var byProducer = rows.GroupBy(x => new { x.ProducerId, Name = x.Producer?.Name ?? "Χωρίς συνεργάτη" })
            .Select(g => new ProducerRow(g.Key.ProducerId, g.Key.Name, g.Sum(x => x.Premium), g.Count())).ToList();

        return new ProductionStatsDto(r.Year, rows.Sum(x => x.Premium), rows.Count, monthly, byType, byProducer);
    }
}
