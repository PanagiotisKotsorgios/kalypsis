using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

/// <summary>
/// The incentive plan is owned by the office and belongs to one producer.
/// It only governs personal goal projections; normal policy commission rules
/// and finalised commission runs remain the source of truth for payouts.
/// </summary>
public record ProducerGoalPlanDto(
    bool Enabled,
    decimal? BaseCommissionPercent,
    decimal? FirstTargetPremium,
    decimal? PremiumStep,
    decimal CommissionIncreasePercent,
    decimal MaximumCommissionPercent,
    int LevelCount);

public record SaveProducerGoalPlanBody(
    bool Enabled,
    decimal? BaseCommissionPercent,
    decimal? FirstTargetPremium,
    decimal? PremiumStep,
    decimal CommissionIncreasePercent,
    decimal MaximumCommissionPercent,
    int LevelCount);

public record GetProducerGoalPlanQuery(Guid ProducerId) : IRequest<ProducerGoalPlanDto>;
public record SaveProducerGoalPlanCommand(Guid ProducerId, SaveProducerGoalPlanBody Body) : IRequest<ProducerGoalPlanDto>;

public class SaveProducerGoalPlanBodyValidator : AbstractValidator<SaveProducerGoalPlanBody>
{
    public SaveProducerGoalPlanBodyValidator()
    {
        When(x => x.BaseCommissionPercent.HasValue,
            () => RuleFor(x => x.BaseCommissionPercent!.Value).InclusiveBetween(0m, 100m));
        When(x => x.FirstTargetPremium.HasValue,
            () => RuleFor(x => x.FirstTargetPremium!.Value).GreaterThanOrEqualTo(0m));
        When(x => x.PremiumStep.HasValue,
            () => RuleFor(x => x.PremiumStep!.Value).GreaterThanOrEqualTo(0m));
        RuleFor(x => x.CommissionIncreasePercent).InclusiveBetween(0m, 100m);
        RuleFor(x => x.MaximumCommissionPercent).InclusiveBetween(0m, 100m);
        RuleFor(x => x.LevelCount).InclusiveBetween(1, 12);
    }
}

public class GetProducerGoalPlanQueryHandler : IRequestHandler<GetProducerGoalPlanQuery, ProducerGoalPlanDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetProducerGoalPlanQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerGoalPlanDto> Handle(GetProducerGoalPlanQuery request, CancellationToken ct)
    {
        var producer = await ProducerGoalPlanAccess.GetProducerAsync(_db, _current, request.ProducerId, ct);
        return ProducerGoalPlanAccess.ToDto(producer);
    }
}

public class SaveProducerGoalPlanCommandHandler : IRequestHandler<SaveProducerGoalPlanCommand, ProducerGoalPlanDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public SaveProducerGoalPlanCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<ProducerGoalPlanDto> Handle(SaveProducerGoalPlanCommand request, CancellationToken ct)
    {
        var producer = await ProducerGoalPlanAccess.GetProducerAsync(_db, _current, request.ProducerId, ct);
        var plan = request.Body;
        producer.GoalPlanEnabled = plan.Enabled;
        producer.GoalBaseCommissionPercent = plan.BaseCommissionPercent;
        producer.GoalFirstTargetPremium = plan.FirstTargetPremium;
        producer.GoalPremiumStep = plan.PremiumStep;
        producer.GoalCommissionIncreasePercent = plan.CommissionIncreasePercent;
        producer.GoalMaximumCommissionPercent = plan.MaximumCommissionPercent;
        producer.GoalLevelCount = plan.LevelCount;
        await _db.SaveChangesAsync(ct);
        return ProducerGoalPlanAccess.ToDto(producer);
    }
}

internal static class ProducerGoalPlanAccess
{
    public static async Task<Kalypsis.Domain.Entities.Producer> GetProducerAsync(
        IAppDbContext db,
        ICurrentUser current,
        Guid producerId,
        CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        return await db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == producerId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
    }

    public static ProducerGoalPlanDto ToDto(Kalypsis.Domain.Entities.Producer producer) => new(
        producer.GoalPlanEnabled,
        producer.GoalBaseCommissionPercent,
        producer.GoalFirstTargetPremium,
        producer.GoalPremiumStep,
        producer.GoalCommissionIncreasePercent,
        producer.GoalMaximumCommissionPercent,
        producer.GoalLevelCount);
}
