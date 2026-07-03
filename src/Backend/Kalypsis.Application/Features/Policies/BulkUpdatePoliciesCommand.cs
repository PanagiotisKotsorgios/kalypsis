using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
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

    public BulkUpdatePoliciesCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
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

        int updated = 0;
        foreach (var p in policies)
        {
            var changed = false;
            if (b.ProducerId.HasValue && p.ProducerId != b.ProducerId.Value)
            { p.ProducerId = b.ProducerId.Value; changed = true; }
            if (b.RenewalTransferToProducerId.HasValue
                && p.RenewalTransferToProducerId != b.RenewalTransferToProducerId.Value)
            { p.RenewalTransferToProducerId = b.RenewalTransferToProducerId.Value; changed = true; }
            if (b.RenewalTransferToCarrierId.HasValue
                && p.RenewalTransferToCarrierId != b.RenewalTransferToCarrierId.Value)
            { p.RenewalTransferToCarrierId = b.RenewalTransferToCarrierId.Value; changed = true; }
            if (!string.IsNullOrWhiteSpace(b.Status)
                && Enum.TryParse<Kalypsis.Domain.Enums.PolicyStatus>(b.Status, true, out var newStatus)
                && p.Status != newStatus)
            { p.Status = newStatus; changed = true; }
            if (!string.IsNullOrWhiteSpace(b.PaymentCollectionMethod)
                && p.PaymentCollectionMethod != b.PaymentCollectionMethod)
            { p.PaymentCollectionMethod = b.PaymentCollectionMethod; changed = true; }
            if (changed) { p.UpdatedAt = DateTime.UtcNow; updated++; }
        }

        await _db.SaveChangesAsync(ct);
        return new BulkUpdatePoliciesResult(updated, ids.Count - policies.Count);
    }
}
