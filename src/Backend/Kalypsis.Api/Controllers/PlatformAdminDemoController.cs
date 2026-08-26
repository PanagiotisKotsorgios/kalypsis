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

    public record WipeAndReseedBody(string? ConfirmationPhrase);

    /// <summary>Wipes every tenant + user except the calling superadmin and
    /// the Kalypsis Platform tenant, then reseeds 5 demo agencies with
    /// representative data. GATED:
    ///   1. Server env var KALYPSIS_ALLOW_DEMO_WIPE must be "true" —
    ///      production instances MUST NOT set this.
    ///   2. Request body must include ConfirmationPhrase exactly equal
    ///      to WipeAndReseedConfirmation.RequiredPhrase.
    ///   3. Every call is LogCritical-audited.
    /// See WipeAndReseedDemoCommand for details.</summary>
    [HttpPost("wipe-and-reseed")]
    public async Task<ActionResult<WipeAndReseedDemoResult>> WipeAndReseed(
        [FromBody] WipeAndReseedBody body, CancellationToken ct)
    {
        var email = _current.Email ?? throw new UnauthorizedAccessException("Missing current-user email.");
        return Ok(await _mediator.Send(
            new WipeAndReseedDemoCommand(email, body?.ConfirmationPhrase ?? ""), ct));
    }

    /// <summary>Discovery endpoint the UI hits before rendering the
    /// destructive button — returns whether this environment allows
    /// wipe-and-reseed at all. If false, the button stays HIDDEN so
    /// even a scripted click can't fire.</summary>
    [HttpGet("wipe-and-reseed/status")]
    public ActionResult<object> WipeAndReseedStatus()
    {
        var flag = WipeAndReseedDemoCommandHandler.AllowedOverrideForTests
            ?? Environment.GetEnvironmentVariable("KALYPSIS_ALLOW_DEMO_WIPE");
        var allowed = string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);
        return Ok(new {
            allowed,
            requiredPhrase = WipeAndReseedConfirmation.RequiredPhrase,
        });
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
