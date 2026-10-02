using Kalypsis.Application.Features.Crm;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/crm")]
[Authorize(Policy = "AgencyStaff")]
public sealed class CrmController : ControllerBase
{
    private readonly IMediator _mediator;
    public CrmController(IMediator mediator) => _mediator = mediator;

    [HttpGet("groups")]
    public async Task<ActionResult<IReadOnlyList<CrmGroupDto>>> Groups([FromQuery] string? entityType, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCrmGroupsQuery(entityType), ct));

    [HttpPost("groups")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<CrmGroupDto>> CreateGroup([FromBody] CrmGroupBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCrmGroupCommand(body), ct));

    [HttpPut("groups/{id:guid}")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<CrmGroupDto>> UpdateGroup(Guid id, [FromBody] CrmGroupBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCrmGroupCommand(id, body), ct));

    [HttpDelete("groups/{id:guid}")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCrmGroupCommand(id), ct);
        return NoContent();
    }

    [HttpGet("groups/{id:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<CrmGroupMemberDto>>> Members(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCrmGroupMembersQuery(id), ct));

    [HttpPut("groups/{id:guid}/members")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<CrmGroupDto>> SetMembers(Guid id, [FromBody] SetMembersBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SetCrmGroupMembersCommand(id, body.MemberIds ?? Array.Empty<Guid>()), ct));

    public sealed record SetMembersBody(IReadOnlyList<Guid>? MemberIds);

    [HttpGet("producers/{producerId:guid}/communications")]
    public async Task<ActionResult<IReadOnlyList<ProducerCommunicationDto>>> ProducerCommunications(Guid producerId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListProducerCommunicationsQuery(producerId), ct));

    [HttpPost("producers/{producerId:guid}/communications")]
    public async Task<ActionResult<ProducerCommunicationDto>> CreateProducerCommunication(Guid producerId, [FromBody] CreateProducerCommunicationBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateProducerCommunicationCommand(producerId, body), ct));
}
