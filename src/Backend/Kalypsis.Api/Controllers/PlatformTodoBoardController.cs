using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// The SuperAdmin's private, spreadsheet-style work board.  The payload is a
/// deliberately flexible JSON document (dynamic columns and cells), while the
/// row itself remains protected by the platform-admin policy and the normal
/// request-audit middleware.
/// </summary>
[ApiController]
[Route("api/platform/todo-board")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformTodoBoardController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
        MaxDepth = 32,
    };

    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public PlatformTodoBoardController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public sealed record BoardResponse(JsonElement? Board, DateTime? UpdatedAt);
    public sealed record SaveBoardRequest(JsonElement Board);

    [HttpGet]
    public async Task<ActionResult<BoardResponse>> Get(CancellationToken ct)
    {
        var settings = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (settings is null || string.IsNullOrWhiteSpace(settings.SuperAdminTodoBoardJson))
            return Ok(new BoardResponse(null, settings?.UpdatedAt));

        try
        {
            using var document = JsonDocument.Parse(settings.SuperAdminTodoBoardJson);
            return Ok(new BoardResponse(document.RootElement.Clone(), settings.UpdatedAt));
        }
        catch (JsonException)
        {
            // A malformed legacy value must not take the admin console down.
            return Ok(new BoardResponse(null, settings.UpdatedAt));
        }
    }

    [HttpPut]
    [RequestSizeLimit(2_000_000)]
    public async Task<ActionResult<BoardResponse>> Save([FromBody] SaveBoardRequest request, CancellationToken ct)
    {
        if (request.Board.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            return BadRequest(new { message = "Ο πίνακας εργασιών δεν μπορεί να είναι κενός." });
        if (request.Board.ValueKind != JsonValueKind.Object)
            return BadRequest(new { message = "Ο πίνακας εργασιών πρέπει να είναι αντικείμενο JSON." });

        var raw = JsonSerializer.Serialize(request.Board, JsonOptions);
        if (raw.Length > 1_900_000)
            return BadRequest(new { message = "Ο πίνακας εργασιών είναι πολύ μεγάλος." });

        var settings = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new Kalypsis.Domain.Entities.PlatformSetting
            {
                Id = Guid.NewGuid(),
                CreatedAt = _clock.UtcNow,
            };
            _db.PlatformSettings.Add(settings);
        }

        settings.SuperAdminTodoBoardJson = raw;
        settings.UpdatedAt = _clock.UtcNow;
        settings.LastUpdatedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);

        using var document = JsonDocument.Parse(raw);
        return Ok(new BoardResponse(document.RootElement.Clone(), settings.UpdatedAt));
    }
}
