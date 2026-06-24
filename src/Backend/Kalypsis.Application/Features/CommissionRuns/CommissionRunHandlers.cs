using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CommissionRuns;

public record CommissionRunDto(
    Guid Id, int Year, int Month, string Title, CommissionRunStatus Status,
    DateTime GeneratedAt, DateTime? FinalisedAt, string? GeneratedByUserName,
    Guid? FilterInsuranceCompanyId, string? FilterInsuranceCompanyName,
    Guid? FilterProducerId, string? FilterProducerName,
    PolicyType? FilterPolicyType, string? FilterPackageCode,
    int LineCount, decimal TotalCommission, decimal TotalPremium, string Currency,
    string? Notes);

public record CommissionRunLineDto(
    Guid Id, Guid PolicyId, string PolicyNumber,
    Guid? ProducerId, string? ProducerName,
    Guid InsuranceCompanyId, string InsuranceCompanyName,
    PolicyType PolicyType, string? PackageCode,
    decimal Premium, decimal RatePercent, decimal CommissionAmount,
    bool IsOverridden, decimal? OriginalCommissionAmount, string? OverrideReason,
    bool IsOverCommission, int OverCommissionLevel, Guid? OnBehalfOfProducerId, string? OnBehalfOfProducerName);

public record CommissionRunDetailDto(CommissionRunDto Run, IReadOnlyList<CommissionRunLineDto> Lines);

/* ========= List runs ========= */

public record ListCommissionRunsQuery(int? Year) : IRequest<IReadOnlyList<CommissionRunDto>>;
public class ListCommissionRunsQueryHandler : IRequestHandler<ListCommissionRunsQuery, IReadOnlyList<CommissionRunDto>>
{
    private readonly IAppDbContext _db;
    public ListCommissionRunsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CommissionRunDto>> Handle(ListCommissionRunsQuery r, CancellationToken ct)
    {
        var q = _db.CommissionRuns
            .Include(x => x.GeneratedByUser)
            .Include(x => x.FilterInsuranceCompany)
            .Include(x => x.FilterProducer)
            .AsQueryable();
        if (r.Year.HasValue) q = q.Where(x => x.Year == r.Year);
        var rows = await q.OrderByDescending(x => x.Year).ThenByDescending(x => x.Month).Take(200).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static CommissionRunDto Map(CommissionRun r) => new(
        r.Id, r.Year, r.Month, r.Title, r.Status, r.GeneratedAt, r.FinalisedAt,
        r.GeneratedByUser is null ? null : $"{r.GeneratedByUser.FirstName} {r.GeneratedByUser.LastName}".Trim(),
        r.FilterInsuranceCompanyId, r.FilterInsuranceCompany?.Name,
        r.FilterProducerId, r.FilterProducer?.Name,
        r.FilterPolicyType, r.FilterPackageCode,
        r.LineCount, r.TotalCommission, r.TotalPremium, r.Currency, r.Notes);
}

/* ========= Generate run ========= */

public record GenerateCommissionRunBody(
    int Year, int Month, string? Title,
    Guid? InsuranceCompanyId, Guid? ProducerId, PolicyType? PolicyType, string? PackageCode,
    string? Notes);

public record GenerateCommissionRunCommand(GenerateCommissionRunBody Body) : IRequest<CommissionRunDto>;

public class GenerateCommissionRunCommandValidator : AbstractValidator<GenerateCommissionRunCommand>
{
    public GenerateCommissionRunCommandValidator()
    {
        RuleFor(x => x.Body.Year).InclusiveBetween(2000, 2100);
        RuleFor(x => x.Body.Month).InclusiveBetween(1, 12);
    }
}

public class GenerateCommissionRunCommandHandler : IRequestHandler<GenerateCommissionRunCommand, CommissionRunDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GenerateCommissionRunCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CommissionRunDto> Handle(GenerateCommissionRunCommand request, CancellationToken ct)
    {
        var b = request.Body;
        var firstDay = new DateOnly(b.Year, b.Month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);

        var policiesQ = _db.Policies
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Producer)
            .Where(p => p.StartDate >= firstDay && p.StartDate <= lastDay
                        && p.Status != PolicyStatus.Cancelled
                        && p.Status != PolicyStatus.Draft);

        if (b.InsuranceCompanyId.HasValue) policiesQ = policiesQ.Where(p => p.InsuranceCompanyId == b.InsuranceCompanyId);
        if (b.ProducerId.HasValue) policiesQ = policiesQ.Where(p => p.ProducerId == b.ProducerId);
        if (b.PolicyType.HasValue) policiesQ = policiesQ.Where(p => p.PolicyType == b.PolicyType);

        var policies = await policiesQ.ToListAsync(ct);

        // All commission rules active during this month, with priority: most specific wins
        // (producer × type × company) → (producer × type) → (producer × company) → (producer) → (any).
        var rules = await _db.CommissionRules
            .Where(r => (r.EffectiveTo == null || r.EffectiveTo >= firstDay) && r.EffectiveFrom <= lastDay)
            .ToListAsync(ct);

        // 9-level over-commission rules active this month.
        var overRules = await _db.OverCommissionRules
            .Where(o => o.IsActive
                        && (o.EffectiveTo == null || o.EffectiveTo >= firstDay)
                        && o.EffectiveFrom <= lastDay)
            .ToListAsync(ct);

        decimal MatchScore(CommissionRule r, Policy p)
        {
            decimal s = 0;
            if (r.ProducerId == p.ProducerId && r.ProducerId.HasValue) s += 4;
            if (r.InsuranceCompanyId == p.InsuranceCompanyId && r.InsuranceCompanyId.HasValue) s += 2;
            if (r.PolicyType == p.PolicyType && r.PolicyType.HasValue) s += 1;
            return s;
        }

        var run = new CommissionRun
        {
            Id = Guid.NewGuid(),
            Year = b.Year, Month = b.Month,
            Title = string.IsNullOrWhiteSpace(b.Title) ? $"Εκκαθάριση {b.Month:00}/{b.Year}" : b.Title!.Trim(),
            Status = CommissionRunStatus.Draft,
            GeneratedAt = DateTime.UtcNow,
            GeneratedByUserId = _current.UserId,
            FilterInsuranceCompanyId = b.InsuranceCompanyId,
            FilterProducerId = b.ProducerId,
            FilterPolicyType = b.PolicyType,
            FilterPackageCode = b.PackageCode,
            Notes = b.Notes,
            Currency = "EUR"
        };
        _db.CommissionRuns.Add(run);

        decimal totalPremium = 0;
        decimal totalCommission = 0;
        int lineCount = 0;

        foreach (var p in policies)
        {
            var match = rules
                .Where(r =>
                    (!r.ProducerId.HasValue || r.ProducerId == p.ProducerId) &&
                    (!r.InsuranceCompanyId.HasValue || r.InsuranceCompanyId == p.InsuranceCompanyId) &&
                    (!r.PolicyType.HasValue || r.PolicyType == p.PolicyType))
                .OrderByDescending(r => MatchScore(r, p))
                .FirstOrDefault();

            // Default to 10% if no rule applies — gives the agency a starting point they can override.
            var ratePercent = match?.CommissionType == CommissionType.Percentage ? match.Value
                            : match?.CommissionType == CommissionType.FixedAmount ? 0m
                            : 10m;
            var fixedAmount = match?.CommissionType == CommissionType.FixedAmount ? match.Value : 0m;

            var commission = fixedAmount > 0 ? fixedAmount : Math.Round(p.Premium * (ratePercent / 100m), 2);

            _db.CommissionRunLines.Add(new CommissionRunLine
            {
                Id = Guid.NewGuid(),
                CommissionRunId = run.Id,
                PolicyId = p.Id,
                ProducerId = p.ProducerId,
                InsuranceCompanyId = p.InsuranceCompanyId,
                PolicyType = p.PolicyType,
                Premium = p.Premium,
                RatePercent = ratePercent,
                CommissionAmount = commission,
                Currency = p.Currency
            });
            totalPremium += p.Premium;
            totalCommission += commission;
            lineCount++;

            // Walk the 9-level over-commission pyramid: every manager whose
            // SubordinateProducerId matches the policy's producer earns a payout,
            // and we recurse so chains stack (manager-of-manager up to level 9).
            if (!p.ProducerId.HasValue) continue;

            var visited = new HashSet<Guid> { p.ProducerId.Value };
            var queue = new Queue<Guid>();
            queue.Enqueue(p.ProducerId.Value);
            var depth = 0;

            while (queue.Count > 0 && depth < 9)
            {
                depth++;
                var levelSize = queue.Count;
                for (var i = 0; i < levelSize; i++)
                {
                    var subordinate = queue.Dequeue();
                    var managers = overRules
                        .Where(r => r.SubordinateProducerId == subordinate
                                    && r.Level == depth
                                    && (!r.PolicyType.HasValue || r.PolicyType == p.PolicyType));
                    foreach (var rule in managers)
                    {
                        if (!visited.Add(rule.ManagerProducerId)) continue;
                        var overAmount = Math.Round(p.Premium * (rule.Percentage / 100m), 2);

                        _db.CommissionRunLines.Add(new CommissionRunLine
                        {
                            Id = Guid.NewGuid(),
                            CommissionRunId = run.Id,
                            PolicyId = p.Id,
                            ProducerId = rule.ManagerProducerId,
                            InsuranceCompanyId = p.InsuranceCompanyId,
                            PolicyType = p.PolicyType,
                            Premium = p.Premium,
                            RatePercent = rule.Percentage,
                            CommissionAmount = overAmount,
                            Currency = p.Currency,
                            IsOverCommission = true,
                            OverCommissionLevel = depth,
                            OnBehalfOfProducerId = p.ProducerId
                        });
                        totalCommission += overAmount;
                        lineCount++;

                        queue.Enqueue(rule.ManagerProducerId);
                    }
                }
            }
        }

        run.LineCount = lineCount;
        run.TotalPremium = totalPremium;
        run.TotalCommission = totalCommission;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CommissionRuns
            .Include(x => x.GeneratedByUser)
            .Include(x => x.FilterInsuranceCompany)
            .Include(x => x.FilterProducer)
            .FirstAsync(x => x.Id == run.Id, ct);
        return ListCommissionRunsQueryHandler.Map(saved);
    }
}

/* ========= Get detail (lines) ========= */

public record GetCommissionRunDetailQuery(Guid Id) : IRequest<CommissionRunDetailDto>;
public class GetCommissionRunDetailQueryHandler : IRequestHandler<GetCommissionRunDetailQuery, CommissionRunDetailDto>
{
    private readonly IAppDbContext _db;
    public GetCommissionRunDetailQueryHandler(IAppDbContext db) => _db = db;
    public async Task<CommissionRunDetailDto> Handle(GetCommissionRunDetailQuery request, CancellationToken ct)
    {
        var run = await _db.CommissionRuns
            .Include(x => x.GeneratedByUser)
            .Include(x => x.FilterInsuranceCompany)
            .Include(x => x.FilterProducer)
            .FirstOrDefaultAsync(x => x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Run");

        var lines = await _db.CommissionRunLines
            .Include(l => l.Policy)
            .Include(l => l.Producer)
            .Include(l => l.InsuranceCompany)
            .Include(l => l.OnBehalfOfProducer)
            .Where(l => l.CommissionRunId == run.Id)
            .OrderBy(l => l.Producer == null ? "" : l.Producer.Name)
            .ThenBy(l => l.IsOverCommission)
            .ThenBy(l => l.Policy.PolicyNumber)
            .ToListAsync(ct);

        var lineDtos = lines.Select(l => new CommissionRunLineDto(
            l.Id, l.PolicyId, l.Policy.PolicyNumber,
            l.ProducerId, l.Producer?.Name,
            l.InsuranceCompanyId, l.InsuranceCompany.Name,
            l.PolicyType, l.PackageCode,
            l.Premium, l.RatePercent, l.CommissionAmount,
            l.IsOverridden, l.OriginalCommissionAmount, l.OverrideReason,
            l.IsOverCommission, l.OverCommissionLevel, l.OnBehalfOfProducerId, l.OnBehalfOfProducer?.Name)).ToList();

        return new CommissionRunDetailDto(ListCommissionRunsQueryHandler.Map(run), lineDtos);
    }
}

/* ========= Override line ========= */

public record OverrideCommissionLineCommand(Guid LineId, decimal NewAmount, string? Reason) : IRequest<CommissionRunLineDto>;
public class OverrideCommissionLineCommandValidator : AbstractValidator<OverrideCommissionLineCommand>
{
    public OverrideCommissionLineCommandValidator()
    {
        RuleFor(x => x.NewAmount).GreaterThanOrEqualTo(0);
    }
}

public class OverrideCommissionLineCommandHandler : IRequestHandler<OverrideCommissionLineCommand, CommissionRunLineDto>
{
    private readonly IAppDbContext _db;
    public OverrideCommissionLineCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CommissionRunLineDto> Handle(OverrideCommissionLineCommand request, CancellationToken ct)
    {
        var line = await _db.CommissionRunLines
            .Include(l => l.Policy)
            .Include(l => l.Producer)
            .Include(l => l.InsuranceCompany)
            .Include(l => l.CommissionRun)
            .FirstOrDefaultAsync(l => l.Id == request.LineId, ct)
            ?? throw AppException.NotFound("Line");

        if (line.CommissionRun.Status == CommissionRunStatus.Finalised)
            throw new AppException("run_finalised",
                "Η εκκαθάριση έχει οριστικοποιηθεί.", 409,
                title: "Κλειδωμένη εκκαθάριση",
                why: $"Η εκκαθάριση «{line.CommissionRun.Title}» έχει οριστικοποιηθεί στις {line.CommissionRun.FinalisedAt:dd/MM/yyyy} — οι γραμμές προμηθειών δεν αλλάζουν πια.",
                fix: "Αν χρειάζεται διόρθωση, εκδώστε πιστωτικό σημείωμα ή δημιουργήστε νέα εκκαθάριση για τον επόμενο μήνα.",
                fixLink: "/app/credit-notes");

        if (!line.IsOverridden) line.OriginalCommissionAmount = line.CommissionAmount;
        line.IsOverridden = true;
        line.CommissionAmount = request.NewAmount;
        line.OverrideReason = request.Reason;

        // Recompute totals
        line.CommissionRun.TotalCommission = await _db.CommissionRunLines
            .Where(l => l.CommissionRunId == line.CommissionRunId && l.Id != line.Id)
            .SumAsync(l => (decimal?)l.CommissionAmount, ct) ?? 0;
        line.CommissionRun.TotalCommission += line.CommissionAmount;

        await _db.SaveChangesAsync(ct);

        return new CommissionRunLineDto(
            line.Id, line.PolicyId, line.Policy.PolicyNumber,
            line.ProducerId, line.Producer?.Name,
            line.InsuranceCompanyId, line.InsuranceCompany.Name,
            line.PolicyType, line.PackageCode,
            line.Premium, line.RatePercent, line.CommissionAmount,
            line.IsOverridden, line.OriginalCommissionAmount, line.OverrideReason,
            line.IsOverCommission, line.OverCommissionLevel, line.OnBehalfOfProducerId, null);
    }
}

/* ========= Finalise / cancel ========= */

public record FinaliseCommissionRunCommand(Guid Id) : IRequest<CommissionRunDto>;
public class FinaliseCommissionRunCommandHandler : IRequestHandler<FinaliseCommissionRunCommand, CommissionRunDto>
{
    private readonly IAppDbContext _db;
    public FinaliseCommissionRunCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CommissionRunDto> Handle(FinaliseCommissionRunCommand request, CancellationToken ct)
    {
        var run = await _db.CommissionRuns.FirstOrDefaultAsync(x => x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Run");
        run.Status = CommissionRunStatus.Finalised;
        run.FinalisedAt = DateTime.UtcNow;

        // Emit per-producer FinancialMovement entries so partner ledgers reflect payable.
        var byProducer = await _db.CommissionRunLines
            .Where(l => l.CommissionRunId == run.Id && l.ProducerId != null)
            .GroupBy(l => l.ProducerId!.Value)
            .Select(g => new { ProducerId = g.Key, Total = g.Sum(x => x.CommissionAmount) })
            .ToListAsync(ct);

        var movementDate = new DateOnly(run.Year, run.Month, DateTime.DaysInMonth(run.Year, run.Month));
        foreach (var bp in byProducer)
        {
            _db.FinancialMovements.Add(new FinancialMovement
            {
                Id = Guid.NewGuid(),
                MovementDate = movementDate,
                Kind = FinancialMovementKind.PartnerCredit,
                Amount = bp.Total,
                Currency = run.Currency,
                ProducerId = bp.ProducerId,
                Description = $"Προμήθεια εκκαθάρισης {run.Month:00}/{run.Year}"
            });
        }
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CommissionRuns
            .Include(x => x.GeneratedByUser)
            .Include(x => x.FilterInsuranceCompany)
            .Include(x => x.FilterProducer)
            .FirstAsync(x => x.Id == run.Id, ct);
        return ListCommissionRunsQueryHandler.Map(saved);
    }
}

public record DeleteCommissionRunCommand(Guid Id) : IRequest<Unit>;
public class DeleteCommissionRunCommandHandler : IRequestHandler<DeleteCommissionRunCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCommissionRunCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCommissionRunCommand request, CancellationToken ct)
    {
        var run = await _db.CommissionRuns.FirstOrDefaultAsync(x => x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Run");
        if (run.Status == CommissionRunStatus.Finalised)
            throw new AppException("run_finalised_delete",
                "Δεν διαγράφεται οριστικοποιημένη εκκαθάριση.", 409,
                title: "Οριστικοποιημένη εκκαθάριση",
                why: $"Η εκκαθάριση «{run.Title}» έχει ήδη παράξει κινήσεις στα ταμεία/εκκαθαρίσεις παραγωγών. Η διαγραφή θα διέρρηγνε τη λογιστική ιχνηλάτηση.",
                fix: "Αν η εκκαθάριση είναι λάθος, αναιρέστε με αντίστροφη εκκαθάριση ή πιστωτικά σημειώματα. Επικοινωνήστε με τον λογιστή σας.",
                fixLink: "/app/credit-notes");
        run.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= CommissionRule CRUD (default rules per agency) ========= */

public record CommissionRuleDto(
    Guid Id, Guid? ProducerId, string? ProducerName,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    PolicyType? PolicyType, CommissionType CommissionType, decimal Value,
    DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record CommissionRuleBody(
    Guid? ProducerId, Guid? InsuranceCompanyId, PolicyType? PolicyType,
    CommissionType CommissionType, decimal Value,
    DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record ListCommissionRulesQuery() : IRequest<IReadOnlyList<CommissionRuleDto>>;
public class ListCommissionRulesQueryHandler : IRequestHandler<ListCommissionRulesQuery, IReadOnlyList<CommissionRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListCommissionRulesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CommissionRuleDto>> Handle(ListCommissionRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.CommissionRules
            .Include(r => r.Producer).Include(r => r.InsuranceCompany)
            .OrderByDescending(r => r.EffectiveFrom).Take(500).ToListAsync(ct);
        return rows.Select(r => new CommissionRuleDto(
            r.Id, r.ProducerId, r.Producer?.Name,
            r.InsuranceCompanyId, r.InsuranceCompany?.Name,
            r.PolicyType, r.CommissionType, r.Value,
            r.EffectiveFrom, r.EffectiveTo)).ToList();
    }
}

public record CreateCommissionRuleCommand(CommissionRuleBody Body) : IRequest<CommissionRuleDto>;
public class CreateCommissionRuleCommandHandler : IRequestHandler<CreateCommissionRuleCommand, CommissionRuleDto>
{
    private readonly IAppDbContext _db;
    public CreateCommissionRuleCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CommissionRuleDto> Handle(CreateCommissionRuleCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var rule = new CommissionRule
        {
            Id = Guid.NewGuid(),
            ProducerId = b.ProducerId,
            InsuranceCompanyId = b.InsuranceCompanyId,
            PolicyType = b.PolicyType,
            CommissionType = b.CommissionType,
            Value = b.Value,
            EffectiveFrom = b.EffectiveFrom,
            EffectiveTo = b.EffectiveTo
        };
        _db.CommissionRules.Add(rule);
        await _db.SaveChangesAsync(ct);
        rule = await _db.CommissionRules.Include(x => x.Producer).Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == rule.Id, ct);
        return new CommissionRuleDto(rule.Id, rule.ProducerId, rule.Producer?.Name,
            rule.InsuranceCompanyId, rule.InsuranceCompany?.Name,
            rule.PolicyType, rule.CommissionType, rule.Value,
            rule.EffectiveFrom, rule.EffectiveTo);
    }
}

public record DeleteCommissionRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteCommissionRuleCommandHandler : IRequestHandler<DeleteCommissionRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCommissionRuleCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCommissionRuleCommand request, CancellationToken ct)
    {
        var rule = await _db.CommissionRules.FirstOrDefaultAsync(x => x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Rule");
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
