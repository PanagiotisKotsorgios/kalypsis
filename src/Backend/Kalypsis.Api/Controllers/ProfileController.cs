using Kalypsis.Application.Features.Profile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProfileController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<MyProfileDto>> Get(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetMyProfileQuery(), cancellationToken));

    [HttpPut]
    public async Task<ActionResult<MyProfileDto>> Update([FromBody] UpdateProfileBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateMyProfileCommand(body), cancellationToken));

    [HttpPost("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordBody body, CancellationToken cancellationToken)
    {
        await _mediator.Send(new ChangeMyPasswordCommand(body), cancellationToken);
        return NoContent();
    }
}
