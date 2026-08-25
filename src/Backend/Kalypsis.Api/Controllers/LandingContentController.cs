using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Public landing-page CMS. Every editable section (ΕΡΜΗΣ showcase,
/// hero copy, etc.) is stored as one JSON row in landing_contents. The
/// frontend reads with a hardcoded fallback so a fresh DB always renders.
/// PlatformAdmin edits via /app/platform/landing.
/// </summary>
[ApiController]
[Route("api/landing")]
public class LandingContentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public LandingContentController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ContentDto(string SectionKey, string PayloadJson, DateTime? UpdatedAt);
    public record SaveBody(string PayloadJson);

    /// <summary>Public — returns the JSON payload for a section, or 404 if
    /// the admin hasn't customised it yet. Frontend must gracefully
    /// fall back to defaults on 404.</summary>
    [HttpGet("content/{key}")]
    [AllowAnonymous]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<ActionResult<ContentDto>> Get(string key, CancellationToken ct)
    {
        var row = await _db.LandingContents.FirstOrDefaultAsync(x => x.SectionKey == key, ct);
        if (row is null) return NotFound();
        return Ok(new ContentDto(row.SectionKey, row.PayloadJson, row.UpdatedAt));
    }

    /// <summary>PlatformAdmin — full list of every customised section.</summary>
    [HttpGet("content")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<ContentDto>>> List(CancellationToken ct)
    {
        var rows = await _db.LandingContents
            .OrderBy(x => x.SectionKey)
            .Select(x => new ContentDto(x.SectionKey, x.PayloadJson, x.UpdatedAt))
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>PlatformAdmin — upsert a section payload.</summary>
    [HttpPut("content/{key}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<ContentDto>> Upsert(string key, [FromBody] SaveBody body, CancellationToken ct)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(key, @"^[a-z0-9-]{2,80}$"))
            throw new AppException("bad_key", "Το section key επιτρέπει μόνο πεζά λατινικά, αριθμούς και παύλες (2-80 χαρακτήρες).", 400);
        // Sanity-check the payload parses as JSON — never store garbage.
        try { _ = System.Text.Json.JsonDocument.Parse(body.PayloadJson ?? "{}"); }
        catch (System.Text.Json.JsonException) { throw new AppException("bad_json", "Το payload δεν είναι έγκυρο JSON.", 400); }

        var now = _clock.UtcNow;
        var row = await _db.LandingContents.FirstOrDefaultAsync(x => x.SectionKey == key, ct);
        if (row is null)
        {
            row = new LandingContent
            {
                Id = Guid.NewGuid(),
                SectionKey = key,
                PayloadJson = body.PayloadJson ?? "{}",
                UpdatedByUserId = _current.UserId,
                CreatedAt = now,
            };
            _db.LandingContents.Add(row);
        }
        else
        {
            row.PayloadJson = body.PayloadJson ?? "{}";
            row.UpdatedByUserId = _current.UserId;
            row.UpdatedAt = now;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new ContentDto(row.SectionKey, row.PayloadJson, row.UpdatedAt));
    }
}
