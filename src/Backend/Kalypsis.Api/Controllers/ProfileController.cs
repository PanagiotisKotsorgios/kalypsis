using Kalypsis.Application.Features.Profile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/me")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProfileController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<MyProfileDto>> Get(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetMyProfileQuery(), cancellationToken));

    [HttpPut]
    public async Task<ActionResult<MyProfileDto>> Update([FromBody] UpdateProfileBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateMyProfileCommand(body), cancellationToken));

    [HttpPost("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordBody body, CancellationToken cancellationToken)
    {
        await _mediator.Send(new ChangeMyPasswordCommand(body), cancellationToken);
        return NoContent();
    }

    /// <summary>Toggle per-user email 2FA. When enabled, every login sends
    /// a 6-digit code to the user's email via Brevo before session tokens
    /// are issued.</summary>
    [HttpPost("email-2fa")]
    public async Task<IActionResult> SetEmailTwoFactor([FromBody] SetEmailTwoFactorBody body, CancellationToken ct)
    {
        await _mediator.Send(new SetEmailTwoFactorCommand(body.Enabled), ct);
        return NoContent();
    }

    /// <summary>Current-month outgoing-communication usage per channel
    /// (Email/SMS/Viber/Phone) with the tenant limits. Powers the
    /// UsageMonitorSection on the profile page.</summary>
    [HttpGet("usage-monitor")]
    public async Task<ActionResult<UsageMonitorDto>> UsageMonitor(CancellationToken ct)
        => Ok(await _mediator.Send(new GetMyUsageMonitorQuery(), ct));
}
