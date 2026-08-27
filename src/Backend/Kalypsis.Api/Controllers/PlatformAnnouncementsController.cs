using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Platform-admin CRUD for the announcements banner shown to every user
/// after login. Two surfaces here:
///   • /api/platform/announcements — admin-only list/create/update/delete
///     for the management page.
///   • /api/announcements/active + /api/announcements/{id}/dismiss —
///     called by every logged-in user's client to fetch banners they
///     haven't dismissed yet and to record the ×.
/// Kept in one file because both sides share the same DTOs and both
/// sides are trivial.
/// </summary>
[ApiController]
[Route("api/platform/announcements")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformAnnouncementsAdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public PlatformAnnouncementsAdminController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record AnnouncementDto(Guid Id, string Title, string Body, string Severity,
        string? Version, string? LinkUrl, string? LinkLabel, bool IsEnabled,
        int DismissedByCount, DateTime CreatedAt, DateTime? UpdatedAt);
    public record UpsertAnnouncementBody(string Title, string Body, string Severity,
        string? Version, string? LinkUrl, string? LinkLabel, bool IsEnabled);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AnnouncementDto>>> List(CancellationToken ct)
    {
        // Include soft-deleted? No — recycle bin owns undelete. History
        // here means "every non-deleted row, most-recent first, showing
        // enabled AND disabled together" so the admin can toggle either.
        var rows = await _db.PlatformAnnouncements
            .Where(a => a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
        // Piggyback the dismissal count per row so admins can see reach
        // without a second round-trip.
        var ids = rows.Select(r => r.Id).ToList();
        var counts = await _db.UserAnnouncementDismissals
            .Where(d => ids.Contains(d.AnnouncementId) && d.DeletedAt == null)
            .GroupBy(d => d.AnnouncementId)
            .Select(g => new { AnnouncementId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.AnnouncementId, x => x.Count, ct);
        return Ok(rows.Select(r => new AnnouncementDto(r.Id, r.Title, r.Body, r.Severity,
            r.Version, r.LinkUrl, r.LinkLabel, r.IsEnabled,
            counts.GetValueOrDefault(r.Id, 0), r.CreatedAt, r.UpdatedAt)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<AnnouncementDto>> Create([FromBody] UpsertAnnouncementBody body, CancellationToken ct)
    {
        var row = new PlatformAnnouncement
        {
            Id = Guid.NewGuid(),
            Title = body.Title.Trim(),
            Body = body.Body,
            Severity = string.IsNullOrWhiteSpace(body.Severity) ? "info" : body.Severity.Trim().ToLowerInvariant(),
            Version = string.IsNullOrWhiteSpace(body.Version) ? null : body.Version.Trim(),
            LinkUrl = string.IsNullOrWhiteSpace(body.LinkUrl) ? null : body.LinkUrl.Trim(),
            LinkLabel = string.IsNullOrWhiteSpace(body.LinkLabel) ? null : body.LinkLabel.Trim(),
            IsEnabled = body.IsEnabled,
            CreatedByUserId = _current.UserId,
            CreatedAt = _clock.UtcNow,
        };
        _db.PlatformAnnouncements.Add(row);
        await _db.SaveChangesAsync(ct);
        return Ok(new AnnouncementDto(row.Id, row.Title, row.Body, row.Severity,
            row.Version, row.LinkUrl, row.LinkLabel, row.IsEnabled,
            0, row.CreatedAt, row.UpdatedAt));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AnnouncementDto>> Update(Guid id, [FromBody] UpsertAnnouncementBody body, CancellationToken ct)
    {
        var row = await _db.PlatformAnnouncements.FirstOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Announcement");
        row.Title = body.Title.Trim();
        row.Body = body.Body;
        row.Severity = string.IsNullOrWhiteSpace(body.Severity) ? "info" : body.Severity.Trim().ToLowerInvariant();
        row.Version = string.IsNullOrWhiteSpace(body.Version) ? null : body.Version.Trim();
        row.LinkUrl = string.IsNullOrWhiteSpace(body.LinkUrl) ? null : body.LinkUrl.Trim();
        row.LinkLabel = string.IsNullOrWhiteSpace(body.LinkLabel) ? null : body.LinkLabel.Trim();
        row.IsEnabled = body.IsEnabled;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        var dismissed = await _db.UserAnnouncementDismissals
            .CountAsync(d => d.AnnouncementId == id && d.DeletedAt == null, ct);
        return Ok(new AnnouncementDto(row.Id, row.Title, row.Body, row.Severity,
            row.Version, row.LinkUrl, row.LinkLabel, row.IsEnabled,
            dismissed, row.CreatedAt, row.UpdatedAt));
    }

    /// <summary>Convenience one-shot toggle so the list UI doesn't have to
    /// echo the full body just to flip a bit.</summary>
    [HttpPost("{id:guid}/toggle")]
    public async Task<IActionResult> Toggle(Guid id, CancellationToken ct)
    {
        var row = await _db.PlatformAnnouncements.FirstOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Announcement");
        row.IsEnabled = !row.IsEnabled;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { row.Id, row.IsEnabled });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await _db.PlatformAnnouncements.FirstOrDefaultAsync(a => a.Id == id && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Announcement");
        row.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

/// <summary>User-facing side of the same store: list what's active for
/// the current viewer (enabled + not-yet-dismissed by them) and record
/// a dismissal. Any authenticated user, any role.</summary>
[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsUserController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public AnnouncementsUserController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ActiveAnnouncementDto(Guid Id, string Title, string Body, string Severity,
        string? Version, string? LinkUrl, string? LinkLabel, DateTime CreatedAt);

    [HttpGet("active")]
    public async Task<ActionResult<IReadOnlyList<ActiveAnnouncementDto>>> Active(CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var dismissedIds = await _db.UserAnnouncementDismissals
            .Where(d => d.UserId == userId && d.DeletedAt == null)
            .Select(d => d.AnnouncementId)
            .ToListAsync(ct);
        var rows = await _db.PlatformAnnouncements
            .Where(a => a.DeletedAt == null && a.IsEnabled
                && !dismissedIds.Contains(a.Id))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
        return Ok(rows.Select(a => new ActiveAnnouncementDto(a.Id, a.Title, a.Body, a.Severity,
            a.Version, a.LinkUrl, a.LinkLabel, a.CreatedAt)).ToList());
    }

    [HttpPost("{id:guid}/dismiss")]
    public async Task<IActionResult> Dismiss(Guid id, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        // Idempotent: pressing × twice from two tabs must not error.
        var exists = await _db.UserAnnouncementDismissals
            .AnyAsync(d => d.UserId == userId && d.AnnouncementId == id && d.DeletedAt == null, ct);
        if (!exists)
        {
            _db.UserAnnouncementDismissals.Add(new UserAnnouncementDismissal
            {
                Id = Guid.NewGuid(),
                AnnouncementId = id,
                UserId = userId,
                DismissedAt = _clock.UtcNow,
                CreatedAt = _clock.UtcNow,
            });
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }
}
