using Kalypsis.Application.Features.CarrierBridgeConfigs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/carrier-bridge-configs")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformCarrierBridgeConfigsController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformCarrierBridgeConfigsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CarrierBridgeConfigDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListBridgeConfigsQuery(), ct));

    [HttpGet("{carrierId:guid}/{recordType}")]
    public async Task<ActionResult<CarrierBridgeConfigDto?>> Get(
        Guid carrierId, string recordType, CancellationToken ct)
        => Ok(await _m.Send(new GetBridgeConfigQuery(carrierId, recordType), ct));

    public record UpsertBody(string FileType, string RecordType, string ConfigJson, bool Enabled, string? Notes);

    [HttpPut("{carrierId:guid}")]
    public async Task<ActionResult<CarrierBridgeConfigDto>> Upsert(
        Guid carrierId, [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertBridgeConfigCommand(
            carrierId, body.FileType, body.RecordType, body.ConfigJson, body.Enabled, body.Notes), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteBridgeConfigCommand(id), ct);
        return NoContent();
    }

    public record DetectBody(string FileType, string? SheetName, int HeaderRow, string CsvDelimiter, string Encoding);

    /// <summary>Upload a sample file — receive the detected columns + first
    /// 10 data rows so the SuperAdmin can build the mapping visually.</summary>
    [HttpPost("detect")]
    [RequestSizeLimit(100L * 1024 * 1024)]   // 100 MB — enterprise xlsx feeds cap out around 40 MB.
    public async Task<ActionResult<DetectColumnsResult>> Detect(
        [FromForm] IFormFile file,
        [FromForm] string fileType,
        [FromForm] string? sheetName,
        [FromForm] int headerRow,
        [FromForm] string csvDelimiter,
        [FromForm] string encoding,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δώστε αρχείο δείγματος." });
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return Ok(await _m.Send(new DetectColumnsCommand(
            fileType, sheetName, headerRow, csvDelimiter, encoding, ms.ToArray()), ct));
    }

    /// <summary>Run the config against a sample file and return the first 20
    /// mapped output rows so the SuperAdmin can validate before saving.</summary>
    [HttpPost("preview")]
    [RequestSizeLimit(100L * 1024 * 1024)]
    public async Task<ActionResult<PreviewBridgeConfigResult>> Preview(
        [FromForm] IFormFile file,
        [FromForm] string fileType,
        [FromForm] string configJson,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Δώστε αρχείο δείγματος." });
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return Ok(await _m.Send(new PreviewBridgeConfigCommand(configJson, fileType, ms.ToArray()), ct));
    }
}
