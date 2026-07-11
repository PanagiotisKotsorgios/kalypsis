using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Tasks;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("tasks.read")]
public class TasksController : ControllerBase
{
    private readonly IMediator _mediator;
    public TasksController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AgencyTaskDto>>> List(
        [FromQuery] AgencyTaskStatus? status,
        [FromQuery] Guid? assignedToUserId,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListTasksQuery(status, assignedToUserId), cancellationToken));

    [HttpPost]
    [RequirePermission("tasks.write")]
    public async Task<ActionResult<AgencyTaskDto>> Create([FromBody] CreateAgencyTaskBody body, CancellationToken cancellationToken)
    {
        var r = await _mediator.Send(new CreateAgencyTaskCommand(body), cancellationToken);
        return CreatedAtAction(nameof(List), null, r);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("tasks.write")]
    public async Task<ActionResult<AgencyTaskDto>> Update(Guid id, [FromBody] UpdateAgencyTaskBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateAgencyTaskCommand(id, body), cancellationToken));

    [HttpDelete("{id:guid}")]
    [RequirePermission("tasks.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteAgencyTaskCommand(id), cancellationToken);
        return NoContent();
    }
}
