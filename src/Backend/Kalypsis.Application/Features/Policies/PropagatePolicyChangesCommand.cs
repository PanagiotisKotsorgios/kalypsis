using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// «Do you also want to apply this change to their older contracts?» —
/// after a policy save, the frontend shows the operator a list of
/// related policies (same customer, same customer × carrier, or the
/// full renewal lineage) and lets them opt into propagating specific
/// fields to those historical rows.
///
/// Only fields that make sense to sync retroactively are exposed here.
/// Premium / dates / status / policy number are per-contract and never
/// propagate — the caller can't set them via this command.
/// </summary>
public record PropagatePolicyChangesBody(
    IReadOnlyList<Guid> TargetPolicyIds,
    Guid? ProducerId,
    string? PaymentCollectionMethod,
    string? PaymentFrequency,             // enum name — parsed server-side
    decimal? SpecialCommissionPercent,
    Guid? RenewalTransferToProducerId,
    Guid? RenewalTransferToCarrierId);

public record PropagatePolicyChangesCommand(PropagatePolicyChangesBody Body)
    : IRequest<PropagatePolicyChangesResult>;

public record PropagatePolicyChangesResult(int UpdatedCount, int SkippedCount);

public class PropagatePolicyChangesCommandHandler
    : IRequestHandler<PropagatePolicyChangesCommand, PropagatePolicyChangesResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public PropagatePolicyChangesCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PropagatePolicyChangesResult> Handle(PropagatePolicyChangesCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = r.Body;
        if (b.TargetPolicyIds.Count == 0)
            return new PropagatePolicyChangesResult(0, 0);

        var ids = b.TargetPolicyIds.ToList();
        var policies = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null && ids.Contains(p.Id))
            .ToListAsync(ct);

        Kalypsis.Domain.Enums.PaymentFrequency? freq = null;
        if (!string.IsNullOrWhiteSpace(b.PaymentFrequency)
            && Enum.TryParse<Kalypsis.Domain.Enums.PaymentFrequency>(b.PaymentFrequency, true, out var f))
            freq = f;

        int updated = 0;
        foreach (var p in policies)
        {
            var changed = false;
            if (b.ProducerId.HasValue && p.ProducerId != b.ProducerId.Value)
            { p.ProducerId = b.ProducerId.Value; changed = true; }
            if (b.PaymentCollectionMethod != null && p.PaymentCollectionMethod != b.PaymentCollectionMethod)
            { p.PaymentCollectionMethod = b.PaymentCollectionMethod; changed = true; }
            if (freq.HasValue && p.PaymentFrequency != freq.Value)
            { p.PaymentFrequency = freq.Value; changed = true; }
            if (b.SpecialCommissionPercent.HasValue && p.SpecialCommissionPercent != b.SpecialCommissionPercent.Value)
            { p.SpecialCommissionPercent = b.SpecialCommissionPercent.Value; changed = true; }
            if (b.RenewalTransferToProducerId.HasValue
                && p.RenewalTransferToProducerId != b.RenewalTransferToProducerId.Value)
            { p.RenewalTransferToProducerId = b.RenewalTransferToProducerId.Value; changed = true; }
            if (b.RenewalTransferToCarrierId.HasValue
                && p.RenewalTransferToCarrierId != b.RenewalTransferToCarrierId.Value)
            { p.RenewalTransferToCarrierId = b.RenewalTransferToCarrierId.Value; changed = true; }
            if (changed) { p.UpdatedAt = DateTime.UtcNow; updated++; }
        }

        await _db.SaveChangesAsync(ct);
        return new PropagatePolicyChangesResult(updated, ids.Count - policies.Count);
    }
}

/// <summary>
/// Companion query for the propagation dialog: given a policy, list the
/// customer's OTHER policies with a short label the UI can render as
/// checkbox rows. Includes both direct siblings (same customer) and the
/// renewal chain (RenewedFromPolicyId lineage).
/// </summary>
public record RelatedPolicySummary(
    Guid Id, string PolicyNumber, string InsuranceCompanyName,
    DateOnly StartDate, DateOnly EndDate, string Status,
    bool IsRenewalOfCurrent, bool IsRenewedFromCurrent);

public record ListRelatedPoliciesQuery(Guid PolicyId) : IRequest<IReadOnlyList<RelatedPolicySummary>>;

public class ListRelatedPoliciesQueryHandler
    : IRequestHandler<ListRelatedPoliciesQuery, IReadOnlyList<RelatedPolicySummary>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListRelatedPoliciesQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<RelatedPolicySummary>> Handle(ListRelatedPoliciesQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var current = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == r.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var siblings = await _db.Policies.IgnoreQueryFilters()
            .Include(p => p.InsuranceCompany)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.CustomerId == current.CustomerId
                        && p.Id != current.Id)
            .OrderByDescending(p => p.StartDate)
            .ToListAsync(ct);

        return siblings.Select(p => new RelatedPolicySummary(
            p.Id, p.PolicyNumber, p.InsuranceCompany?.Name ?? "",
            p.StartDate, p.EndDate, p.Status.ToString(),
            IsRenewalOfCurrent:  p.RenewedFromPolicyId == current.Id,
            IsRenewedFromCurrent: current.RenewedFromPolicyId == p.Id
        )).ToList();
    }
}
