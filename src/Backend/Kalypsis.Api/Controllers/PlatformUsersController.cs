using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/users")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformUsersController : ControllerBase
{
    private readonly IMediator _mediator;
    public PlatformUsersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformUserDto>>> List(
        [FromQuery] string? search,
        [FromQuery] Guid? tenantId,
        [FromQuery] Role? role,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListAllUsersQuery(search, tenantId, role), cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlatformUserDto>> Update(Guid id, [FromBody] UpdatePlatformUserBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdatePlatformUserCommand(id, body), cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeletePlatformUserCommand(id), cancellationToken);
        return NoContent();
    }
}
