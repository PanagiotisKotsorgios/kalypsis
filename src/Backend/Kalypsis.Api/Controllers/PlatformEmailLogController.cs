using Kalypsis.Application.Features.PlatformEmailLog;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/emails")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformEmailLogController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformEmailLogController(IMediator m) => _m = m;

    [HttpGet("recent")]
    public async Task<ActionResult<IReadOnlyList<EmailLogEntryDto>>> Recent(
        [FromQuery] int limit = 50, CancellationToken ct = default)
        => Ok(await _m.Send(new ListRecentEmailsQuery(limit), ct));
}
