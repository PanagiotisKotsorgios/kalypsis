using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.PlatformBackups;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/backups")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformBackupsController : ControllerBase
{
    private readonly IMediator _m;
    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    public PlatformBackupsController(IMediator m, AppDbContext db, IFileStorage storage)
    { _m = m; _db = db; _storage = storage; }

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
        return Ok(await _m.Send(new ImportBackupZipCommand(file.FileName, file.Length), ct));
    }

    /// <summary>
    /// Streams the gzipped JSON archive back to the SuperAdmin. Only Completed
    /// rows are downloadable — InProgress and Failed rows have no bytes.
    /// </summary>
    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var row = await _db.PlatformBackups
            .FirstOrDefaultAsync(b => b.Id == id && b.DeletedAt == null, ct);
        if (row == null) return NotFound();
        if (row.Status != "Completed" || string.IsNullOrEmpty(row.StoragePath))
            return BadRequest(new { code = "not_ready", message = "Το backup δεν έχει ολοκληρωθεί ακόμη." });

        try
        {
            var stream = await _storage.DownloadAsync(row.StoragePath, ct);
            return File(stream, "application/gzip", row.FileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { code = "file_missing", message = "Το αρχείο δεν βρέθηκε στο storage." });
        }
    }
}
