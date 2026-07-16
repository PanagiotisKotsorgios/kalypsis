using Kalypsis.Application.Features.PlatformBackups;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/backups")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformBackupsController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformBackupsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformBackupDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListPlatformBackupsQuery(), ct));

    public record CreateBody(bool Db, bool Uploads, bool Logs, bool Config);

    [HttpPost("create")]
    public async Task<ActionResult<PlatformBackupDto>> Create([FromBody] CreateBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreatePlatformBackupCommand(body.Db, body.Uploads, body.Logs, body.Config), ct));

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult<PlatformBackupDto>> Restore(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new RestorePlatformBackupCommand(id), ct));

    [HttpPost("import")]
    [RequestSizeLimit(2L * 1024 * 1024 * 1024)]   // 2 GB cap on the frontend upload
    public async Task<ActionResult<PlatformBackupDto>> Import(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { code = "validation", message = "Επιλέξτε αρχείο zip." });
        // First-pass: we register the upload as a manifest row and let the
        // Ops team validate + kick off the restore. Streaming the bytes to
        // permanent storage will be added when we wire the actual restore
        // engine.
        return Ok(await _m.Send(new ImportBackupZipCommand(file.FileName, file.Length), ct));
    }
}
