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

    [HttpGet("{id:guid}/detail")]
    public async Task<ActionResult<ProducerDetailDto>> Detail(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetProducerDetailQuery(id), ct));

    /// <summary>KPI snapshot for a producer + month — powers the drawer
    /// «Monthly snapshot» card and the auto-mailer template.</summary>
    [HttpGet("{id:guid}/monthly-snapshot")]
    public async Task<ActionResult<ProducerMonthlySnapshotDto>> MonthlySnapshot(
        Guid id, [FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return Ok(await _mediator.Send(
            new GetProducerMonthlySnapshotQuery(id, year ?? now.Year, month ?? now.Month), ct));
    }

    // Customers reachable through this producer (via Policy.ProducerId). Aggregated
    // one row per customer with policy count + total premium for quick triage.
    [HttpGet("{id:guid}/customers")]
    public async Task<ActionResult<IReadOnlyList<ProducerCustomerLineDto>>> Customers(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new ListProducerCustomersQuery(id), ct));

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

    [HttpPost("{id:guid}/portal-account")]
    public async Task<ActionResult<CreateProducerPortalAccountResponse>> CreatePortalAccount(
        Guid id, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new CreateProducerPortalAccountCommand(id), cancellationToken));

    // === Reassignment === Preview shows the totals about to move.
    [HttpGet("{id:guid}/reassign-preview")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ReassignProducerPreviewDto>> ReassignPreview(
        Guid id, [FromQuery] Guid toId, CancellationToken ct)
        => Ok(await _mediator.Send(new ReassignProducerPreviewQuery(id, toId), ct));

    public record ReassignBody(Guid ToProducerId, string? Reason);

    // Execute: moves policies + pending commissions; settled history stays put.
    [HttpPost("{id:guid}/reassign")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ReassignProducerResultDto>> Reassign(
        Guid id, [FromBody] ReassignBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new ReassignProducerCommand(id, body.ToProducerId, body.Reason), ct));
}
