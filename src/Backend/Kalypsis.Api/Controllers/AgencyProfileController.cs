using Kalypsis.Application.Features.AgencyProfile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/agency-profile")]
[Authorize(Policy = "AgencyAdmin")]
public class AgencyProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    public AgencyProfileController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<AgencyProfileDto>> Get(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetMyAgencyProfileQuery(), cancellationToken));

    [HttpPut]
    public async Task<ActionResult<AgencyProfileDto>> Update([FromBody] UpdateAgencyProfileBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateMyAgencyProfileCommand(body), cancellationToken));
}
