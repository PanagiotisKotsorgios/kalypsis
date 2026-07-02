using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Reconciliation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Agency-side view of producer reconciliation declarations. Lets the office
/// see what each producer expected per policy and the diff vs the recorded
/// CommissionRunLine. Available to every agency without a premium gate.
/// </summary>
[ApiController]
[Route("api/producer-reconciliation")]
[Authorize(Policy = "AgencyStaff")]
public class ProducerReconciliationController : ControllerBase
{
    private readonly IMediator _m;
    private readonly ICurrentUser _current;
    public ProducerReconciliationController(IMediator m, ICurrentUser current)
    { _m = m; _current = current; }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProducerDeclarationDto>>> List(
        [FromQuery] Guid? producerId,
        CancellationToken ct)
    {
        _ = _current.TenantId ?? throw AppException.Forbidden();
        return Ok(await _m.Send(new ListAgencyDeclarationsQuery(producerId), ct));
    }
}
