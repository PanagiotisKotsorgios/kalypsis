using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CommissionRules;

/// <summary>
/// Preview shape returned before a CommissionRule is actually saved. Answers
/// the operator's question: «If I save this rule, what happens?» — how many
/// existing policies will start using this rate, what's the total premium
/// they represent, and what's the estimated annual agency + producer
/// commission at the proposed % values.
/// </summary>
public record CommissionRulePreviewDto(
    int MatchingPolicyCount,
    decimal TotalMatchingPremium,
    decimal EstimatedAgencyCommission,
    decimal EstimatedProducerCommission,
    string? WarningMessage);

public record PreviewCommissionRuleQuery(CommissionRuleBody Body)
    : IRequest<CommissionRulePreviewDto>;

public class PreviewCommissionRuleQueryHandler
    : IRequestHandler<PreviewCommissionRuleQuery, CommissionRulePreviewDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public PreviewCommissionRuleQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<CommissionRulePreviewDto> Handle(PreviewCommissionRuleQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = r.Body;

        // Score only ACTIVE policies from this year (rolling 12 months would
        // be more accurate but 12 months of matches is a good approximation
        // for an annual commission estimate and stays fast).
        var oneYearAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1));

        var q = _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && p.Status != PolicyStatus.Cancelled
                        && p.Status != PolicyStatus.Draft
                        && p.StartDate >= oneYearAgo);

        if (b.ProducerId.HasValue)          q = q.Where(p => p.ProducerId == b.ProducerId);
        if (b.InsuranceCompanyId.HasValue)  q = q.Where(p => p.InsuranceCompanyId == b.InsuranceCompanyId);
        if (b.PolicyType.HasValue)          q = q.Where(p => p.PolicyType == b.PolicyType);
        if (b.VehicleUseCategory.HasValue)  q = q.Where(p => p.VehicleUseCategory == b.VehicleUseCategory);

        // CoverCode filter — approximated via the JSON blob in SpecsJson.
        // Not perfect (the real per-cover match happens at run-time), but a
        // reasonable estimate for the preview.
        if (!string.IsNullOrWhiteSpace(b.CoverCode))
        {
            var needle = b.CoverCode.Trim();
            q = q.Where(p => p.SpecsJson != null && EF.Functions.Like(p.SpecsJson, $"%{needle}%"));
        }

        var rows = await q.Select(p => new { p.Premium }).ToListAsync(ct);
        var count = rows.Count;
        var totalPremium = rows.Sum(x => x.Premium);

        var agencyPct = b.AgencyPercent ?? 0m;
        var producerPct = b.ProducerPercent ?? 0m;
        var estAgency = decimal.Round(totalPremium * agencyPct / 100m, 2);
        var estProducer = decimal.Round(totalPremium * producerPct / 100m, 2);

        string? warning = null;
        if (count == 0)
            warning = "Δεν βρέθηκαν συμβόλαια που να ταιριάζουν. Ο κανόνας θα ισχύει για μελλοντικές νέες εγγραφές.";
        else if (count > 500)
            warning = $"Ο κανόνας θα επηρεάσει {count} συμβόλαια. Βεβαιωθείτε ότι το εύρος είναι σκόπιμο.";
        else if (producerPct > agencyPct && b.AgencyPercent.HasValue)
            warning = "Το ποσοστό συνεργάτη υπερβαίνει το ποσοστό γραφείου. Ελέγξτε εάν είναι σκόπιμο.";

        return new CommissionRulePreviewDto(count, totalPremium, estAgency, estProducer, warning);
    }
}
