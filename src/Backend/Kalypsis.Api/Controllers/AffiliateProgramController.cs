using Kalypsis.Application.Features.Public;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/public")]
[Authorize]
public sealed class AffiliateProgramController : ControllerBase
{
    private readonly IMediator _mediator;

    public AffiliateProgramController(IMediator mediator) => _mediator = mediator;

    [HttpGet("affiliate-progress")]
    public async Task<ActionResult<AffiliateProgressDto>> Progress(CancellationToken ct)
        => Ok(await _mediator.Send(new GetAffiliateProgressQuery(), ct));
}
