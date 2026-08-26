using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// One-shot ingestion endpoint for client-side diagnostic breadcrumbs.
/// Everything posted here is logged at Information level with the
/// «CLIENT-DIAG» prefix so it stands out in the Coolify runtime log
/// stream. Purpose: when the browser hits a bug that never reaches
/// the server (file picker refuses to open, request cancelled by an
/// extension, etc.) we still get a paper trail — the frontend calls
/// this at each step of the failing flow.
///
/// No PII protection because we're logging free-form JSON the client
/// sends. Clients MUST NOT pass PII (customer names, emails other
/// than the caller's own etc.). Frontend code that uses this should
/// only send flow-tracing fields (event name, folder id, file size,
/// http status, error message).
/// </summary>
[ApiController]
[Route("api/diag/client")]
[AllowAnonymous]     // anonymous OK — visitors on the public /register etc. also produce diagnostics
public class ClientDiagnosticsController : ControllerBase
{
    private readonly ILogger<ClientDiagnosticsController> _log;
    public ClientDiagnosticsController(ILogger<ClientDiagnosticsController> log) => _log = log;

    public record ClientDiagBody(
        string Flow,               // e.g. "bookkeeping.upload"
        string Step,               // e.g. "label-click" / "onchange-fired" / "before-post"
        string? Detail,            // arbitrary short human-readable string
        string? Ua,                // navigator.userAgent
        long? Ts);                 // Date.now() from the client

    [HttpPost]
    public IActionResult Ingest([FromBody] ClientDiagBody body)
    {
        if (body is null) return NoContent();
        // Prefix + a single line so grep-through-Coolify is trivial.
        _log.LogInformation(
            "CLIENT-DIAG · flow={Flow} step={Step} detail={Detail} ua={Ua} clientTs={Ts}",
            body.Flow ?? "?", body.Step ?? "?",
            body.Detail ?? "-",
            (body.Ua ?? "-").Length > 120 ? (body.Ua ?? "").Substring(0, 120) : body.Ua ?? "-",
            body.Ts);
        return NoContent();
    }
}
