using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Batch-update multiple policies in one transaction. Fields left null on
/// the body are IGNORED (the policy keeps its existing value); non-null
/// fields apply to every id in the batch.
///
/// Common operations the operator does today:
///   • Change producer on ~30 policies at once (staff reshuffling)
///   • Set the same «Renewal transfer to producer» on a whole book
///   • Bulk mark a batch as PendingRenewal
///
/// The handler enforces that every id belongs to the current tenant so a
/// bad payload can never touch someone else's policies.
/// </summary>
public record BulkUpdatePoliciesBody(
    IReadOnlyList<Guid> PolicyIds,
    Guid? ProducerId,
    Guid? RenewalTransferToProducerId,
    Guid? RenewalTransferToCarrierId,
    string? Status,
    string? PaymentCollectionMethod);

public record BulkUpdatePoliciesCommand(BulkUpdatePoliciesBody Body)
    : IRequest<BulkUpdatePoliciesResult>;

public record BulkUpdatePoliciesResult(int UpdatedCount, int SkippedCount);

public class BulkUpdatePoliciesCommandHandler
    : IRequestHandler<BulkUpdatePoliciesCommand, BulkUpdatePoliciesResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly PolicyCommissionCalculator _commissionCalc;

    public BulkUpdatePoliciesCommandHandler(IAppDbContext db, ICurrentUser current,
        PolicyCommissionCalculator commissionCalc)
    {
        _db = db;
        _current = current;
        _commissionCalc = commissionCalc;
    }

    public async Task<BulkUpdatePoliciesResult> Handle(BulkUpdatePoliciesCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = r.Body;
        if (b.PolicyIds.Count == 0)
            return new BulkUpdatePoliciesResult(0, 0);

        var ids = b.PolicyIds.ToList();
        var policies = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null && ids.Contains(p.Id))
            .ToListAsync(ct);

        // Track which policies need side-effects after the main field
        // updates land:
        //   • recomputeCommissionFor — producer swapped, so
        //     PolicyCommissionSplit rows need to be re-materialised
        //     against the new producer's chain.
        //   • cancelledInThisBatch — Status flipped to Cancelled, so a
        //     PolicyCancellation workflow row needs stamping (bug fix
        //     matching CancelPolicyCommand — bulk-cancel used to leave
        //     /app/cancellations completely blind to the batch).
        var recomputeCommissionFor = new List<Policy>();
        var cancelledInThisBatch = new List<Policy>();

        int updated = 0;
        foreach (var p in policies)
        {
            var changed = false;
            if (b.ProducerId.HasValue && p.ProducerId != b.ProducerId.Value)
            {
                p.ProducerId = b.ProducerId.Value;
                changed = true;
                recomputeCommissionFor.Add(p);
            }
            if (b.RenewalTransferToProducerId.HasValue
                && p.RenewalTransferToProducerId != b.RenewalTransferToProducerId.Value)
            { p.RenewalTransferToProducerId = b.RenewalTransferToProducerId.Value; changed = true; }
            if (b.RenewalTransferToCarrierId.HasValue
                && p.RenewalTransferToCarrierId != b.RenewalTransferToCarrierId.Value)
            { p.RenewalTransferToCarrierId = b.RenewalTransferToCarrierId.Value; changed = true; }
            if (!string.IsNullOrWhiteSpace(b.Status)
                && Enum.TryParse<PolicyStatus>(b.Status, true, out var newStatus)
                && p.Status != newStatus)
            {
                var wasNotCancelled = p.Status != PolicyStatus.Cancelled;
                p.Status = newStatus;
                changed = true;
                if (newStatus == PolicyStatus.Cancelled && wasNotCancelled)
                    cancelledInThisBatch.Add(p);
            }
            if (!string.IsNullOrWhiteSpace(b.PaymentCollectionMethod)
                && p.PaymentCollectionMethod != b.PaymentCollectionMethod)
            { p.PaymentCollectionMethod = b.PaymentCollectionMethod; changed = true; }
            if (changed) { p.UpdatedAt = DateTime.UtcNow; updated++; }
        }

        // Stamp PolicyCancellation workflow rows for every policy that
        // just flipped into Cancelled state — mirrors the single-policy
        // CancelPolicyCommand fix so /app/cancellations sees the batch.
        // Sequential AK-YYYY-NNNNN numbers computed once up front and
        // handed out one-per-row, so a 30-item batch doesn't cost 30 DB
        // round-trips. Skips any policy that already has an active
        // cancellation row (dedup guard identical to the single path).
        if (cancelledInThisBatch.Count > 0)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var yearPrefix = $"AK-{today.Year}-";
            var lastSeq = await _db.PolicyCancellations.IgnoreQueryFilters()
                .CountAsync(c => c.CancellationNumber.StartsWith(yearPrefix), ct);
            var policyIdsInBatch = cancelledInThisBatch.Select(p => p.Id).ToList();
            var alreadyCancelled = (await _db.PolicyCancellations.IgnoreQueryFilters()
                .Where(c => policyIdsInBatch.Contains(c.PolicyId)
                    && c.DeletedAt == null
                    && c.Status != PolicyCancellationStatus.Rejected)
                .Select(c => c.PolicyId)
                .ToListAsync(ct))
                .ToHashSet();
            var seq = lastSeq;
            foreach (var p in cancelledInThisBatch)
            {
                if (alreadyCancelled.Contains(p.Id)) continue;
                seq++;
                _db.PolicyCancellations.Add(new PolicyCancellation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PolicyId = p.Id,
                    CancellationNumber = $"{yearPrefix}{seq:D5}",
                    Status = PolicyCancellationStatus.Effective,
                    RequestedAt = today,
                    EffectiveFrom = today,
                    RefundMethod = "None",
                    RefundAmount = 0m,
                    Currency = p.Currency,
                    CreatedByUserId = _current.UserId,
                    ApprovedByUserId = _current.UserId,
                    ApprovedAt = DateTime.UtcNow,
                    Notes = "Δημιουργήθηκε αυτόματα από μαζική ακύρωση συμβολαίων."
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        // Recompute commission splits per producer-swapped policy. Same
        // try/catch pattern as UpdatePolicyCommand — splits are a read-
        // side convenience so a failure never breaks the batch. Runs
        // after the main SaveChanges so the calculator reads the new
        // ProducerId.
        foreach (var p in recomputeCommissionFor)
        {
            try { await _commissionCalc.RecomputeAsync(p, ct); }
            catch { /* per-policy split failure never blocks the batch */ }
        }
        if (recomputeCommissionFor.Count > 0)
        {
            try { await _db.SaveChangesAsync(ct); }
            catch { /* same */ }
        }

        return new BulkUpdatePoliciesResult(updated, ids.Count - policies.Count);
    }
}
