using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.PlatformAdmin;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Superadmin-only demo tooling. Callable via UI button or curl; never
/// wired into the customer-facing surface.
/// </summary>
[ApiController]
[Route("api/platform/demo")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformAdminDemoController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUser _current;

    public PlatformAdminDemoController(IMediator mediator, ICurrentUser current)
    {
        _mediator = mediator;
        _current = current;
    }

    /// <summary>Wipes every tenant + user except the calling superadmin and
    /// the Kalypsis Platform tenant, then reseeds 5 demo agencies with
    /// representative data. See WipeAndReseedDemoCommand for details.</summary>
    [HttpPost("wipe-and-reseed")]
    public async Task<ActionResult<WipeAndReseedDemoResult>> WipeAndReseed(CancellationToken ct)
    {
        // Use the calling user's email as the "preserve" hint so no-one
        // else on the platform-admin role can wipe someone else's account.
        var email = _current.Email ?? throw new UnauthorizedAccessException("Missing current-user email.");
        return Ok(await _mediator.Send(new WipeAndReseedDemoCommand(email), ct));
    }

    /// <summary>
    /// Downloads a ZIP of ERGO-format xlsx samples — 3 per demo tenant —
    /// with matched, unlinked and cancellation rows so every bridge
    /// scenario can be exercised end-to-end from the Γέφυρες page.
    /// See GenerateBridgeSamplesQuery for the scenario breakdown.
    /// </summary>
    [HttpGet("bridge-samples.zip")]
    public async Task<IActionResult> BridgeSamples(CancellationToken ct)
    {
        var result = await _mediator.Send(new GenerateBridgeSamplesQuery(), ct);
        return File(result.ZipBytes, "application/zip", result.FileName);
    }

    /// <summary>Superadmin quick-create of a standalone Producer user in any
    /// tenant — no impersonation required. Returns the generated temp password
    /// so the operator can hand it to the producer.</summary>
    [HttpPost("standalone-producer-user")]
    public async Task<ActionResult<CreateStandaloneProducerUserResponse>> CreateStandaloneProducer(
        [FromBody] CreateStandaloneProducerUserBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateStandaloneProducerUserCommand(body), ct));
}
