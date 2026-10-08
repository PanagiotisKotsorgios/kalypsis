using Kalypsis.Application.Features.Crm;
using Kalypsis.Api.Authorization;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/crm")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public sealed class CrmController : ControllerBase
{
    private readonly IMediator _mediator;
    public CrmController(IMediator mediator) => _mediator = mediator;

    [HttpGet("groups")]
    public async Task<ActionResult<IReadOnlyList<CrmGroupDto>>> Groups([FromQuery] string? entityType, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCrmGroupsQuery(entityType), ct));

    [HttpGet("overview")]
    [RequirePermission("marketing.read")]
    public async Task<ActionResult<CrmOverviewDto>> Overview(CancellationToken ct)
        => Ok(await _mediator.Send(new GetCrmOverviewQuery(), ct));

    [HttpPost("groups/preview")]
    [RequirePermission("marketing.read")]
    public async Task<ActionResult<CrmGroupPreviewDto>> PreviewGroup([FromBody] PreviewCrmGroupBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new PreviewCrmGroupQuery(body.EntityType, body.FilterJson), ct));

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

    [HttpPost("groups/{id:guid}/refresh")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<CrmGroupDto>> RefreshGroup(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new RefreshCrmGroupCommand(id), ct));

    [HttpPut("groups/{id:guid}/members")]
    [Authorize(Policy = "AgencyManager")]
    public async Task<ActionResult<CrmGroupDto>> SetMembers(Guid id, [FromBody] SetMembersBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SetCrmGroupMembersCommand(id, body.MemberIds ?? Array.Empty<Guid>()), ct));

    public sealed record SetMembersBody(IReadOnlyList<Guid>? MemberIds);
    public sealed record PreviewCrmGroupBody(string EntityType, string? FilterJson);

    [HttpGet("opportunities")]
    [RequirePermission("marketing.read")]
    public async Task<ActionResult<IReadOnlyList<CrmOpportunityDto>>> Opportunities(
        [FromQuery] string? search, [FromQuery] string? stage,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCrmOpportunitiesQuery(search, stage, from, to), ct));

    [HttpPost("opportunities")]
    [RequirePermission("marketing.write")]
    public async Task<ActionResult<CrmOpportunityDto>> CreateOpportunity([FromBody] CrmOpportunityBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCrmOpportunityCommand(body), ct));

    [HttpPut("opportunities/{id:guid}")]
    [RequirePermission("marketing.write")]
    public async Task<ActionResult<CrmOpportunityDto>> UpdateOpportunity(Guid id, [FromBody] CrmOpportunityBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCrmOpportunityCommand(id, body), ct));

    [HttpDelete("opportunities/{id:guid}")]
    [RequirePermission("marketing.write")]
    public async Task<IActionResult> DeleteOpportunity(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCrmOpportunityCommand(id), ct);
        return NoContent();
    }

    [HttpGet("producers/{producerId:guid}/communications")]
    public async Task<ActionResult<IReadOnlyList<ProducerCommunicationDto>>> ProducerCommunications(Guid producerId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListProducerCommunicationsQuery(producerId), ct));

    [HttpPost("producers/{producerId:guid}/communications")]
    public async Task<ActionResult<ProducerCommunicationDto>> CreateProducerCommunication(Guid producerId, [FromBody] CreateProducerCommunicationBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateProducerCommunicationCommand(producerId, body), ct));
}
