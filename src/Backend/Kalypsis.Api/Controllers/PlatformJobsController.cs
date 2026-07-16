using Kalypsis.Application.Features.PlatformJobs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/jobs")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformJobsController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformJobsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JobDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListJobsQuery(), ct));

    public record OverrideBody(string? CronOverride, bool Enabled);

    [HttpPut("{jobKey}")]
    public async Task<ActionResult<JobDto>> UpsertOverride(string jobKey, [FromBody] OverrideBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertJobOverrideCommand(jobKey, body.CronOverride, body.Enabled), ct));

    [HttpPost("{jobKey}/trigger")]
    public async Task<IActionResult> Trigger(string jobKey, CancellationToken ct)
    {
        await _m.Send(new TriggerJobCommand(jobKey), ct);
        return Accepted();
    }
}
