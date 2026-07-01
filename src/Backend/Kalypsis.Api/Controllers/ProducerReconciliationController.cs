using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Premium;
using Kalypsis.Application.Features.Reconciliation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Agency-side view of producer reconciliation declarations. Lets the office
/// see what each producer expected per policy and the diff vs the recorded
/// CommissionRunLine. Premium-gated by producer-reconciliation.
/// </summary>
[ApiController]
[Route("api/producer-reconciliation")]
[Authorize(Policy = "AgencyStaff")]
public class ProducerReconciliationController : ControllerBase
{
    private readonly IMediator _m;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ProducerReconciliationController(IMediator m, IAppDbContext db, ICurrentUser current)
    { _m = m; _db = db; _current = current; }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProducerDeclarationDto>>> List(
        [FromQuery] Guid? producerId,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        await PremiumGate.RequireAsync(_db, tenantId, PremiumFeatureCodes.ProducerReconciliation, ct);
        return Ok(await _m.Send(new ListAgencyDeclarationsQuery(producerId), ct));
    }
}
