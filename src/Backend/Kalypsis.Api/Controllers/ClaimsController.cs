using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Claims;
using Kalypsis.Application.Features.ClaimInvolvedParties;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/claims")]
[Authorize]
[RequirePermission("claims.read")]
public class ClaimsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ClaimsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClaimDto>>> List(
        [FromQuery] ClaimStatus? status,
        [FromQuery] Guid? policyId,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListClaimsQuery(status, policyId), cancellationToken));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<ActionResult<ClaimDto>> Create([FromBody] CreateClaimBody body, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateClaimCommand(body), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<ActionResult<ClaimDto>> Update(Guid id, [FromBody] UpdateClaimBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateClaimCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<ActionResult<ClaimDto>> UpdateStatus(Guid id, [FromBody] UpdateClaimStatusBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateClaimStatusCommand(id, body), cancellationToken));

    // «Ζημιάδες Εμπλεκόμενοι» — one row per person / entity involved in a
    // claim beyond the policyholder. Aggregated per-customer for the tab
    // view; writes are always claim-scoped.
    [HttpPost("{claimId:guid}/involved-parties")]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<ActionResult<ClaimInvolvedPartyDto>> CreateInvolvedParty(
        Guid claimId, [FromBody] ClaimInvolvedPartyBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateInvolvedPartyCommand(claimId, body), ct));
}

[ApiController]
[Route("api/claim-involved-parties")]
[Authorize]
public class ClaimInvolvedPartiesController : ControllerBase
{
    private readonly IMediator _mediator;
    public ClaimInvolvedPartiesController(IMediator mediator) => _mediator = mediator;

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<ActionResult<ClaimInvolvedPartyDto>> Update(
        Guid id, [FromBody] ClaimInvolvedPartyBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateInvolvedPartyCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    [RequirePermission("claims.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteInvolvedPartyCommand(id), ct);
        return NoContent();
    }
}
