using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// One row of the ALIS-style «Προμήθειες» matrix for a policy.
/// </summary>
public record PolicyCommissionSplitDto(
    Guid Id,
    HierarchyLevel HierarchyLevel,
    string HierarchyLevelLabel,
    Guid? ProducerId,
    string? ProducerName,
    decimal Percent,
    decimal GrossAmount,
    decimal TaxWithholdingAmount,
    decimal NetAmount,
    string Currency);

/// <summary>
/// Summary totals across every level so the drawer can render the footer row
/// without a client-side sum. Excludes rows whose gross is zero to keep the
/// matrix signal-only.
/// </summary>
public record PolicyCommissionMatrixDto(
    IReadOnlyList<PolicyCommissionSplitDto> Rows,
    decimal TotalGross,
    decimal TotalTaxWithholding,
    decimal TotalNet,
    string Currency);

public record GetPolicyCommissionSplitsQuery(Guid PolicyId) : IRequest<PolicyCommissionMatrixDto>;

public class GetPolicyCommissionSplitsHandler
    : IRequestHandler<GetPolicyCommissionSplitsQuery, PolicyCommissionMatrixDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly PolicyCommissionCalculator _calc;

    public GetPolicyCommissionSplitsHandler(
        IAppDbContext db, ICurrentUser current, PolicyCommissionCalculator calc)
    {
        _db = db; _current = current; _calc = calc;
    }

    public async Task<PolicyCommissionMatrixDto> Handle(
        GetPolicyCommissionSplitsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Auto-heal: a legacy policy has never been saved since the migration
        // ran, so it has zero splits on file. Recompute lazily on first read
        // so the operator sees a matrix instead of an empty tab.
        var splits = await _db.PolicyCommissionSplits
            .Include(s => s.Producer)
            .Where(s => s.TenantId == tenantId && s.PolicyId == request.PolicyId && s.DeletedAt == null)
            .OrderBy(s => s.HierarchyLevel)
            .ToListAsync(ct);
        if (splits.Count == 0)
        {
            var policy = await _db.Policies
                .FirstOrDefaultAsync(p => p.Id == request.PolicyId && p.TenantId == tenantId && p.DeletedAt == null, ct);
            if (policy is not null)
            {
                try
                {
                    await _calc.RecomputeAsync(policy, ct);
                    await _db.SaveChangesAsync(ct);
                    splits = await _db.PolicyCommissionSplits
                        .Include(s => s.Producer)
                        .Where(s => s.TenantId == tenantId && s.PolicyId == request.PolicyId && s.DeletedAt == null)
                        .OrderBy(s => s.HierarchyLevel)
                        .ToListAsync(ct);
                }
                catch { /* lazy heal is best-effort */ }
            }
        }

        var rows = splits.Select(s => new PolicyCommissionSplitDto(
            s.Id,
            s.HierarchyLevel,
            LevelLabel(s.HierarchyLevel),
            s.ProducerId,
            s.Producer?.Name,
            s.Percent,
            s.GrossAmount,
            s.TaxWithholdingAmount,
            s.NetAmount,
            s.Currency)).ToList();

        var currency = rows.FirstOrDefault()?.Currency ?? "EUR";
        return new PolicyCommissionMatrixDto(
            rows,
            rows.Sum(r => r.GrossAmount),
            rows.Sum(r => r.TaxWithholdingAmount),
            rows.Sum(r => r.NetAmount),
            currency);
    }

    private static string LevelLabel(HierarchyLevel level) => level switch
    {
        HierarchyLevel.Producer  => "Παραγωγός",
        HierarchyLevel.Manager   => "Manager",
        HierarchyLevel.Unit      => "Unit",
        HierarchyLevel.Assistant => "Assistant",
        HierarchyLevel.Agency    => "Γραφείο",
        _ => level.ToString()
    };
}
