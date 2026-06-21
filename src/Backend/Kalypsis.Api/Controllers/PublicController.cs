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

    [HttpGet("partners")]
    public async Task<ActionResult<IReadOnlyList<PartnerDto>>> Partners(CancellationToken ct)
        => Ok(await _m.Send(new GetPublicPartnersQuery(), ct));

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

[ApiController]
[Route("api/platform/partners")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformPartnersController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformPartnersController(IMediator m) => _m = m;

    [HttpGet] public async Task<ActionResult<IReadOnlyList<PartnerDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListPartnersQuery(), ct));
    [HttpPost] public async Task<ActionResult<PartnerDto>> Create([FromBody] PartnerBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreatePartnerCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<PartnerDto>> Update(Guid id, [FromBody] PartnerBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdatePartnerCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { await _m.Send(new DeletePartnerCommand(id), ct); return NoContent(); }
}
