using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "AgencyAdmin")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;
    public UsersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> List(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListUsersQuery(), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CreateEmployeeResponse>> Create([FromBody] CreateEmployeeRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateEmployeeCommand(request), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserDto>> Update(Guid id, [FromBody] UpdateEmployeeRequest body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateEmployeeCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteEmployeeCommand(id), ct);
        return NoContent();
    }
}
