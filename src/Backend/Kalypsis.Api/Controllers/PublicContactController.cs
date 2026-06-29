using Kalypsis.Application.Features.Public;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/public/contact")]
[AllowAnonymous]
[EnableRateLimiting("public-contact")]
public class PublicContactController : ControllerBase
{
    private readonly IMediator _mediator;
    public PublicContactController(IMediator mediator) => _mediator = mediator;

    // POST /api/public/contact — pre-login contact / bug-report / complaint form.
    // Rate limited to 5 submissions per IP per hour.
    [HttpPost]
    public async Task<ActionResult<PublicContactResult>> Submit(
        [FromBody] PublicContactBody body,
        CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _mediator.Send(new SubmitPublicContactCommand(body, ip, ua), ct);
        return Ok(result);
    }
}
