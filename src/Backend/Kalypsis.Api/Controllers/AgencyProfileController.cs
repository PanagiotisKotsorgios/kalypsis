using Kalypsis.Application.Features.AgencyProfile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/agency-profile")]
public class AgencyProfileController : ControllerBase
{
    private readonly IMediator _mediator;
    public AgencyProfileController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<AgencyProfileDto>> Get(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetMyAgencyProfileQuery(), cancellationToken));

    [HttpPut]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<AgencyProfileDto>> Update([FromBody] UpdateAgencyProfileBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateMyAgencyProfileCommand(body), cancellationToken));

    [HttpPost("logo")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<AgencyProfileDto>> UploadLogo(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });

        await using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadAgencyLogoCommand(
            file.FileName,
            file.ContentType ?? "application/octet-stream",
            file.Length,
            stream), cancellationToken);
        return Ok(result);
    }

    [HttpDelete("logo")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<AgencyProfileDto>> DeleteLogo(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new DeleteMyAgencyLogoCommand(), cancellationToken));

    /// <summary>
    /// Returns the current user's tenant logo. Any authenticated tenant member
    /// (admin / employee / producer / customer) can fetch it for navbar display.
    /// </summary>
    [HttpGet("logo")]
    [Authorize]
    public async Task<IActionResult> GetMyLogo(CancellationToken cancellationToken)
    {
        var payload = await _mediator.Send(new GetMyAgencyLogoQuery(), cancellationToken);
        if (payload is null) return NoContent();
        var (stream, fileName, mime) = payload.Value;
        Response.Headers.CacheControl = "private, max-age=300";
        return File(stream, mime, fileName);
    }
}
