using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Per-tenant handbook. AgencyAdmin edits the content (rich HTML); every
/// authenticated staff member of the same tenant can read it. Singleton
/// per tenant — the frontend GETs it as an object, PUTs a new body to
/// upsert.
/// </summary>
[ApiController]
[Route("api/agency-instructions")]
[Authorize(Policy = "AgencyStaff")]
public class AgencyInstructionsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public AgencyInstructionsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record AgencyInstructionDto(
        Guid Id,
        string Title,
        string ContentHtml,
        DateTime? UpdatedAt,
        Guid? UpdatedByUserId,
        string? UpdatedByName);

    public record UpsertAgencyInstructionBody(string Title, string ContentHtml);

    [HttpGet]
    public async Task<ActionResult<AgencyInstructionDto>> Get(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.AgencyInstructions
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);

        if (row is null)
        {
            // Return an empty placeholder so the frontend doesn't have to
            // special-case 404. AgencyAdmin's first save creates the row.
            return Ok(new AgencyInstructionDto(
                Guid.Empty,
                "Οδηγίες γραφείου",
                "",
                null, null, null));
        }
        return Ok(new AgencyInstructionDto(
            row.Id, row.Title, row.ContentHtml,
            row.UpdatedAt, row.UpdatedByUserId, row.UpdatedByName));
    }

    [HttpPut]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<AgencyInstructionDto>> Upsert(
        [FromBody] UpsertAgencyInstructionBody body,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var title = (body.Title ?? "").Trim();
        if (string.IsNullOrWhiteSpace(title)) title = "Οδηγίες γραφείου";
        if (title.Length > 200) title = title.Substring(0, 200);

        // Strip <script> / <style> / event handlers. Modest sanitisation —
        // the frontend also constrains its own toolbar output; we defence
        // in depth here in case someone posts raw HTML directly.
        var html = SanitiseHtml(body.ContentHtml ?? "");

        var row = await _db.AgencyInstructions
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);

        // Resolve the editor's display name for the "τελευταία επεξεργασία
        // από …" tag shown in the read-only view. Fall back to the email
        // if the user has no first/last set yet.
        string? editorName = null;
        if (_current.UserId.HasValue)
        {
            var u = await _db.Users
                .Where(x => x.Id == _current.UserId.Value && x.DeletedAt == null)
                .Select(x => new { x.FirstName, x.LastName, x.Email })
                .FirstOrDefaultAsync(ct);
            if (u != null)
            {
                var full = $"{u.FirstName} {u.LastName}".Trim();
                editorName = string.IsNullOrWhiteSpace(full) ? u.Email : full;
            }
        }

        if (row is null)
        {
            row = new AgencyInstruction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Title = title,
                ContentHtml = html,
                UpdatedByUserId = _current.UserId,
                UpdatedByName = editorName,
                CreatedAt = _clock.UtcNow,
                UpdatedAt = _clock.UtcNow,
            };
            _db.AgencyInstructions.Add(row);
        }
        else
        {
            row.Title = title;
            row.ContentHtml = html;
            row.UpdatedByUserId = _current.UserId;
            row.UpdatedByName = editorName;
            row.UpdatedAt = _clock.UtcNow;
        }
        await _db.SaveChangesAsync(ct);

        return Ok(new AgencyInstructionDto(
            row.Id, row.Title, row.ContentHtml,
            row.UpdatedAt, row.UpdatedByUserId, row.UpdatedByName));
    }

    private static string SanitiseHtml(string input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        var s = input;
        // Kill script / style blocks entirely (including their contents).
        s = System.Text.RegularExpressions.Regex.Replace(
            s, @"<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>",
            "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        s = System.Text.RegularExpressions.Regex.Replace(
            s, @"<style\b[^<]*(?:(?!</style>)<[^<]*)*</style>",
            "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        // Strip inline event handlers (onclick=, onerror=, …).
        s = System.Text.RegularExpressions.Regex.Replace(
            s, @"\s+on\w+\s*=\s*(?:""[^""]*""|'[^']*'|\S+)",
            "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        // Strip javascript: URLs.
        s = System.Text.RegularExpressions.Regex.Replace(
            s, @"javascript\s*:",
            "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        // Cap the total size to prevent runaway payloads (2 MB of markup is
        // way beyond any legitimate handbook).
        if (s.Length > 2_000_000) s = s.Substring(0, 2_000_000);
        return s;
    }
}
