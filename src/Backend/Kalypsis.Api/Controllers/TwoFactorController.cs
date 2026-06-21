using Kalypsis.Application.Features.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/me/2fa")]
[Authorize]
public class TwoFactorController : ControllerBase
{
    private readonly IMediator _m;
    public TwoFactorController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<TwoFactorStatusDto>> Status(CancellationToken ct)
        => Ok(await _m.Send(new GetTwoFactorStatusQuery(), ct));

    [HttpPost("begin")]
    public async Task<ActionResult<TwoFactorEnrollmentDto>> Begin(CancellationToken ct)
        => Ok(await _m.Send(new BeginTwoFactorEnrollmentCommand(), ct));

    [HttpPost("confirm")]
    public async Task<ActionResult<TwoFactorVerifyResult>> Confirm([FromBody] TwoFactorConfirmBody body, CancellationToken ct)
        => Ok(await _m.Send(new ConfirmTwoFactorCommand(body.Code), ct));

    [HttpPost("disable")]
    public async Task<ActionResult> Disable(CancellationToken ct)
    {
        await _m.Send(new DisableTwoFactorCommand(), ct);
        return NoContent();
    }
}
