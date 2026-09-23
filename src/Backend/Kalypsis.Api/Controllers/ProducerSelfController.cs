using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Exports;
using Kalypsis.Application.Features.Producers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/producer/me")]
[Authorize(Policy = "Producer")]
public class ProducerSelfController : ControllerBase
{
    private readonly IMediator _m;
    public ProducerSelfController(IMediator m) => _m = m;

    [HttpGet("summary")]
    public async Task<ActionResult<ProducerSelfSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _m.Send(new GetProducerSelfSummaryQuery(), ct));

    [HttpGet("commissions")]
    public async Task<ActionResult<IReadOnlyList<ProducerRunLineDto>>> Commissions([FromQuery] int? year, CancellationToken ct)
        => Ok(await _m.Send(new GetProducerSelfCommissionsQuery(year), ct));

    /// <summary>
    /// Download only the signed-in producer's operational data. The office
    /// controls policy assignment and commission rules; the producer may
    /// export their own portfolio and calculated commissions only.
    /// </summary>
    [HttpGet("exports/{entity}")]
    public async Task<IActionResult> Export(
        string entity,
        [FromQuery] string format = "xlsx",
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var key = (entity ?? string.Empty).Trim().ToLowerInvariant();
        if (key is "policies" or "customers")
        {
            // Existing list handlers scope both datasets to the current
            // ProducerId. The allowlist prevents a generic export bypass.
            var result = await _m.Send(new UniversalExportQuery(key, format, null), ct);
            return File(result.Content, result.MimeType, result.FileName);
        }

        if (key == "commissions")
        {
            var result = await _m.Send(new ExportProducerSelfCommissionsQuery(year, format), ct);
            return File(result.Content, result.MimeType, result.FileName);
        }

        throw new AppException(
            "producer_export_unknown",
            "Μπορείτε να εξαγάγετε μόνο συμβόλαια, πελάτες ή προμήθειες.",
            StatusCodes.Status400BadRequest);
    }

}
