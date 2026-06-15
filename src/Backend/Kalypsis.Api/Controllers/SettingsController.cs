using Kalypsis.Application.Features.Settings;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Policy = "PlatformAdmin")]
public class SettingsController : ControllerBase
{
    private readonly IMediator _mediator;
    public SettingsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<PlatformSettingsDto>> Get(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetPlatformSettingsQuery(), cancellationToken));

    [HttpPut]
    public async Task<ActionResult<PlatformSettingsDto>> Update(
        [FromBody] UpdatePlatformSettingsRequest request,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdatePlatformSettingsCommand(request), cancellationToken));

    [HttpPost("test-email")]
    public async Task<ActionResult<SendTestEmailResponse>> SendTestEmail(
        [FromBody] SendTestEmailRequest request,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new SendTestEmailCommand(request.ToEmail), cancellationToken));
}
