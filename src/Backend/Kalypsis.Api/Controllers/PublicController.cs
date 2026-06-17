using Kalypsis.Application.Features.Public;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController : ControllerBase
{
    private readonly IMediator _m;
    public PublicController(IMediator m) => _m = m;

    [HttpGet("stats")]
    public async Task<ActionResult<PublicStatsDto>> Stats(CancellationToken ct)
        => Ok(await _m.Send(new GetPublicStatsQuery(), ct));

    public record NewsletterBody(string Email);

    [HttpPost("newsletter")]
    public async Task<IActionResult> Newsletter([FromBody] NewsletterBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || !body.Email.Contains('@'))
            return BadRequest(new { code = "validation", message = "Invalid email." });
        await _m.Send(new NewsletterSubscribeCommand(body.Email.Trim().ToLowerInvariant()), ct);
        return Ok();
    }
}
