using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/policies/{policyId:guid}/risk-profile")]
[Authorize(Policy = "AgencyStaff")]
public sealed class PolicyRiskProfileController(IAppDbContext db, ICurrentUser current) : ControllerBase
{
    public record ChangesBody(Dictionary<string, string> Changes);
    public record ClaimAmounts(string Currency, decimal? Paid, decimal? Reserve);
    public record ClaimSummary(Guid Id, string ClaimNumber, DateOnly IncidentDate, DateOnly ReportedDate,
        string Status, decimal? ClaimedAmount, decimal? ApprovedAmount, string Currency, IReadOnlyList<ClaimAmounts> Amounts);
    private async Task<Policy> OwnPolicy(Guid policyId, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        return await db.Policies.FirstOrDefaultAsync(row => row.Id == policyId && row.TenantId == tenantId && row.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
    }
    [HttpGet]
    [RequirePermission("policies.read")]
    public async Task<ActionResult<Dictionary<string, string>>> Get(Guid policyId, CancellationToken ct)
        => Ok(PolicyRiskProfile.Read(await OwnPolicy(policyId, ct)));

    [HttpPatch]
    [RequirePermission("policies.write")]
    [RequestSizeLimit(300_000)]
    public async Task<ActionResult<Dictionary<string, string>>> Update(Guid policyId, ChangesBody body, CancellationToken ct)
    {
        var policy = await OwnPolicy(policyId, ct);
        if (body.Changes is null) throw AppException.Validation("Δεν δόθηκαν πεδία επεξεργασίας.");
        var coverIds = await db.PolicyCovers.Where(row => row.PolicyId == policyId && row.TenantId == policy.TenantId && row.DeletedAt == null)
            .Select(row => row.Id).ToListAsync(ct);
        PolicyRiskProfile.Apply(policy, body.Changes, coverIds.ToHashSet());
        await db.SaveChangesAsync(ct);
        return Ok(PolicyRiskProfile.Read(policy));
    }

    [HttpGet("claims")]
    [RequirePermission("claims.read")]
    public async Task<ActionResult<IReadOnlyList<ClaimSummary>>> Claims(Guid policyId, CancellationToken ct)
    {
        var policy = await OwnPolicy(policyId, ct);
        var claims = await db.Claims.AsNoTracking().Where(row => row.PolicyId == policyId && row.TenantId == policy.TenantId && row.DeletedAt == null)
            .OrderByDescending(row => row.IncidentDate).ThenBy(row => row.ClaimNumber).ToListAsync(ct);
        var ids = claims.Select(row => row.Id).ToArray();
        var payments = await db.ClaimIndemnities.AsNoTracking().Where(row => ids.Contains(row.ClaimId) && row.TenantId == policy.TenantId && row.DeletedAt == null).ToListAsync(ct);
        var reserves = await db.ClaimProvisions.AsNoTracking().Where(row => ids.Contains(row.ClaimId) && row.TenantId == policy.TenantId && row.DeletedAt == null).ToListAsync(ct);
        decimal? Paid(Guid claimId, string currency)
        {
            var rows = payments.Where(row => row.ClaimId == claimId && row.Currency == currency).ToArray();
            return rows.Length == 0 ? null : rows.Sum(row => row.Amount);
        }
        return Ok(claims.Select(claim => new ClaimSummary(claim.Id, claim.ClaimNumber, claim.IncidentDate, claim.ReportedDate,
            claim.Status.ToString(), claim.ClaimedAmount, claim.ApprovedAmount, policy.Currency,
            payments.Where(row => row.ClaimId == claim.Id).Select(row => row.Currency)
                .Union(reserves.Where(row => row.ClaimId == claim.Id).Select(row => row.Currency))
                .OrderBy(currency => currency).Select(currency => new ClaimAmounts(currency,
                    Paid(claim.Id, currency),
                    reserves.Where(row => row.ClaimId == claim.Id && row.Currency == currency)
                        .OrderByDescending(row => row.EvaluationDate).ThenByDescending(row => row.CreatedAt)
                        .Select(row => (decimal?)row.ReserveAmount).FirstOrDefault())).ToArray())).ToArray());
    }
}
