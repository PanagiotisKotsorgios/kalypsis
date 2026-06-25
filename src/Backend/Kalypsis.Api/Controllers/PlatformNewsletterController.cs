using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.PlatformNewsletter;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/newsletter")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformNewsletterController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUser _current;
    public PlatformNewsletterController(IMediator mediator, ICurrentUser current)
    { _mediator = mediator; _current = current; }

    [HttpGet("subscribers")]
    public async Task<ActionResult<IReadOnlyList<SubscriberDto>>> ListSubscribers(CancellationToken ct)
        => Ok(await _mediator.Send(new ListSubscribersQuery(), ct));

    [HttpDelete("subscribers/{id:guid}")]
    public async Task<IActionResult> DeleteSubscriber(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteSubscriberCommand(id), ct);
        return NoContent();
    }

    [HttpGet("campaigns")]
    public async Task<ActionResult<IReadOnlyList<CampaignDto>>> ListCampaigns(CancellationToken ct)
        => Ok(await _mediator.Send(new ListCampaignsQuery(), ct));

    [HttpPost("campaigns/send")]
    public async Task<ActionResult<CampaignDto>> SendCampaign(
        [FromBody] SendCampaignBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SendCampaignCommand(body, _current.UserId), ct));
}
