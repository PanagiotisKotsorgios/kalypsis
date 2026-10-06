using Kalypsis.Application.Features.GreenCards;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/policies/{policyId:guid}/green-cards")]
[Authorize]
public sealed class GreenCardsController : ControllerBase
{
    private readonly IMediator _mediator;
    public GreenCardsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("~/api/green-cards")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<IReadOnlyList<GreenCardDto>>> ListAll(
        [FromQuery] string? search,
        [FromQuery] GreenCardStatus? status,
        [FromQuery] DateOnly? validFrom,
        [FromQuery] DateOnly? validTo,
        CancellationToken ct)
        => Ok(await _mediator.Send(new ListAllGreenCardsQuery(search, status, validFrom, validTo), ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GreenCardDto>>> List(Guid policyId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListGreenCardsQuery(policyId), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<GreenCardDto>> Create(Guid policyId, [FromBody] GreenCardBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateGreenCardCommand(policyId, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<GreenCardDto>> Update(Guid policyId, Guid id, [FromBody] GreenCardBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateGreenCardCommand(policyId, id, body), ct));

    [HttpPost("{id:guid}/issue")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<GreenCardDto>> Issue(Guid policyId, Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new IssueGreenCardCommand(policyId, id), ct));

    public sealed record DeliverBody(string? DeliveryMethod);

    [HttpPost("{id:guid}/deliver")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<GreenCardDto>> Deliver(Guid policyId, Guid id, [FromBody] DeliverBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new DeliverGreenCardCommand(policyId, id, body.DeliveryMethod), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> Cancel(Guid policyId, Guid id, CancellationToken ct)
    {
        await _mediator.Send(new CancelGreenCardCommand(policyId, id), ct);
        return NoContent();
    }
}
