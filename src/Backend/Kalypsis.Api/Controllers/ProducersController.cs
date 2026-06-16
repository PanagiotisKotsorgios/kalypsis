using Kalypsis.Application.Features.Producers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/producers")]
[Authorize(Policy = "AgencyStaff")]
public class ProducersController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProducersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProducerDto>>> List(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListProducersQuery(), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ProducerDto>> Create([FromBody] CreateProducerBody body, CancellationToken cancellationToken)
    {
        var r = await _mediator.Send(new CreateProducerCommand(body), cancellationToken);
        return CreatedAtAction(nameof(List), null, r);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProducerDto>> Update(Guid id, [FromBody] UpdateProducerBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateProducerCommand(id, body), cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteProducerCommand(id), cancellationToken);
        return NoContent();
    }
}
