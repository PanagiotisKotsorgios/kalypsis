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
    public ProducerReconciliationController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProducerDeclarationDto>>> List(
        [FromQuery] Guid? producerId,
        CancellationToken ct)
        => Ok(await _m.Send(new ListAgencyDeclarationsQuery(producerId), ct));
}
