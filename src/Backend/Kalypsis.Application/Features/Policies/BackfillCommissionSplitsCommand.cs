using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Result of a bulk-backfill run — how many policies were touched and how
/// many actually produced splits (a policy with no matching rule or a
/// producer chain of zero levels yields zero splits and is counted as
/// "skipped").
/// </summary>
public record BackfillCommissionSplitsResult(
    int PoliciesScanned,
    int PoliciesWithSplits,
    int SplitsCreated);

/// <summary>
/// Iterate every active policy in the current tenant and re-materialise its
/// PolicyCommissionSplit rows. Sidesteps the lazy-heal path on
/// GetPolicyCommissionSplitsQuery so a fresh install / after a
/// LevelPercentsJson rollout can seed the matrix everywhere in one go.
/// </summary>
public record BackfillCommissionSplitsCommand()
    : IRequest<BackfillCommissionSplitsResult>;

public class BackfillCommissionSplitsHandler
    : IRequestHandler<BackfillCommissionSplitsCommand, BackfillCommissionSplitsResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly PolicyCommissionCalculator _calc;

    public BackfillCommissionSplitsHandler(
        IAppDbContext db, ICurrentUser current, PolicyCommissionCalculator calc)
    {
        _db = db; _current = current; _calc = calc;
    }

    public async Task<BackfillCommissionSplitsResult> Handle(
        BackfillCommissionSplitsCommand _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Scan every non-deleted policy in the tenant, not just the ones with
        // Status == Active — cancelled/expired policies still show up in
        // reports and their historical matrix should be recomputed too.
        var policies = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .ToListAsync(ct);
        if (policies.Count == 0)
            return new BackfillCommissionSplitsResult(0, 0, 0);

        var withSplits = 0;
        var totalSplits = 0;
        foreach (var policy in policies)
        {
            var beforeCount = await _db.PolicyCommissionSplits
                .CountAsync(s => s.PolicyId == policy.Id, ct);

            try
            {
                await _calc.RecomputeAsync(policy, ct);
                await _db.SaveChangesAsync(ct);
            }
            catch
            {
                // Never let a single bad row abort the whole backfill. The
                // affected policy just stays at its previous split count.
                continue;
            }

            var afterCount = await _db.PolicyCommissionSplits
                .CountAsync(s => s.PolicyId == policy.Id, ct);
            if (afterCount > 0) withSplits++;
            // Net-new only. A recompute that produces the same rows as before
            // shows as zero here, which matches the "did the backfill move
            // anything?" question the operator is asking.
            totalSplits += Math.Max(0, afterCount - beforeCount);
        }

        return new BackfillCommissionSplitsResult(
            policies.Count, withSplits, totalSplits);
    }
}
