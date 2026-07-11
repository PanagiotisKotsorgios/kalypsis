using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.CarrierBridges;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/carrier-bridges")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("bridges.read")]
public class CarrierBridgesController : ControllerBase
{
    private readonly IMediator _mediator;
    public CarrierBridgesController(IMediator mediator) => _mediator = mediator;

    /// <summary>Lists every carrier the agency has, flagging which ones can be imported.</summary>
    [HttpGet("available")]
    public async Task<ActionResult<IReadOnlyList<AvailableCarrierDto>>> Available(CancellationToken ct)
        => Ok(await _mediator.Send(new ListAvailableCarrierBridgesQuery(), ct));

    /// <summary>Parse an xlsx and return preview rows (no DB writes).</summary>
    [HttpPost("preview")]
    [RequirePermission("bridges.sync")]
    public async Task<ActionResult<BridgeImportPreviewResult>> Preview(
        [FromForm] Guid insuranceCompanyId,
        [FromForm] string? lob,
        IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest("file required");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return Ok(await _mediator.Send(
            new PreviewBridgeImportCommand(insuranceCompanyId, file.FileName, ms.ToArray(), lob ?? "auto"), ct));
    }

    /// <summary>Commit the previewed rows after user confirmation.</summary>
    [HttpPost("commit")]
    [RequirePermission("bridges.sync")]
    public async Task<ActionResult<CompanyBridgeRunSummary>> Commit(
        [FromBody] CommitBridgeImportCommand body, CancellationToken ct)
        => Ok(await _mediator.Send(body, ct));
}
