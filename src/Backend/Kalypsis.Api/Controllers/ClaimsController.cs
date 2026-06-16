using Kalypsis.Application.Features.Claims;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/claims")]
[Authorize]
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
    public async Task<ActionResult<ClaimDto>> Create([FromBody] CreateClaimBody body, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateClaimCommand(body), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ClaimDto>> Update(Guid id, [FromBody] UpdateClaimBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateClaimCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ClaimDto>> UpdateStatus(Guid id, [FromBody] UpdateClaimStatusBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateClaimStatusCommand(id, body), cancellationToken));
}
