using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// GDPR Article 17 «right to erasure» — request log for the γραφείο. Any
/// authenticated user can file a request on behalf of a customer; the
/// AgencyAdmin reviews and marks it Approved / Rejected / Completed.
/// Status transitions and notes are auditable.
/// </summary>
[ApiController]
[Route("api/gdpr/erasure-requests")]
[Authorize(Policy = "AgencyStaff")]
public class GdprController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public GdprController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record GdprRequestDto(
        Guid Id,
        string RequesterName,
        string RequesterEmail,
        string? RequesterPhone,
        Guid? CustomerId,
        string? CustomerDisplay,
        string Reason,
        string Status,
        string? Notes,
        DateTime CreatedAt,
        DateTime? HandledAt,
        string? HandledByName);

    public record CreateGdprRequestBody(
        string RequesterName,
        string RequesterEmail,
        string? RequesterPhone,
        Guid? CustomerId,
        string Reason);

    public record UpdateGdprRequestBody(string Status, string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GdprRequestDto>>> List(
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var q = _db.GdprErasureRequests.AsQueryable()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(x => x.Status == status);

        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);

        // Resolve customer display names in a single follow-up query so we
        // don't need Include and can keep the DTO trimmed.
        var customerIds = rows.Where(x => x.CustomerId.HasValue).Select(x => x.CustomerId!.Value).Distinct().ToList();
        var customerDisplays = await _db.Customers
            .Where(c => customerIds.Contains(c.Id))
            .Select(c => new { c.Id, Display = c.Type == Kalypsis.Domain.Enums.CustomerType.Individual
                ? (c.FirstName + " " + c.LastName).Trim()
                : (c.CompanyName ?? "") })
            .ToDictionaryAsync(x => x.Id, x => x.Display, ct);

        return Ok(rows.Select(x => new GdprRequestDto(
            x.Id, x.RequesterName, x.RequesterEmail, x.RequesterPhone,
            x.CustomerId,
            x.CustomerId.HasValue && customerDisplays.TryGetValue(x.CustomerId.Value, out var d) ? d : null,
            x.Reason, x.Status, x.Notes, x.CreatedAt, x.HandledAt, x.HandledByName)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<GdprRequestDto>> Create(
        [FromBody] CreateGdprRequestBody body,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var name = (body.RequesterName ?? "").Trim();
        var email = (body.RequesterEmail ?? "").Trim();
        var reason = (body.Reason ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(reason))
            throw new AppException("gdpr_required",
                "Συμπληρώστε ονοματεπώνυμο, email και αιτιολογία.", 400);

        var row = new GdprErasureRequest
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RequesterName = name.Length > 200 ? name.Substring(0, 200) : name,
            RequesterEmail = email.Length > 200 ? email.Substring(0, 200) : email,
            RequesterPhone = body.RequesterPhone?.Trim(),
            CustomerId = body.CustomerId,
            Reason = reason,
            Status = "Pending",
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow,
        };
        _db.GdprErasureRequests.Add(row);
        await _db.SaveChangesAsync(ct);

        return Ok(new GdprRequestDto(
            row.Id, row.RequesterName, row.RequesterEmail, row.RequesterPhone,
            row.CustomerId, null, row.Reason, row.Status, row.Notes,
            row.CreatedAt, row.HandledAt, row.HandledByName));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GdprRequestDto>> Update(
        Guid id,
        [FromBody] UpdateGdprRequestBody body,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.GdprErasureRequests
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αίτημα διαγραφής");

        // Whitelist of legal status transitions — Pending → InReview →
        // Approved/Rejected → Completed. Anything else is a UI bug and
        // deserves an explicit 400 rather than silent corruption.
        var status = (body.Status ?? "").Trim();
        var allowed = new[] { "Pending", "InReview", "Approved", "Rejected", "Completed" };
        if (!allowed.Contains(status))
            throw new AppException("gdpr_bad_status", "Μη έγκυρη κατάσταση.", 400);

        row.Status = status;
        row.Notes = string.IsNullOrWhiteSpace(body.Notes) ? row.Notes : body.Notes.Trim();
        row.HandledByUserId = _current.UserId;
        row.HandledByName = await ResolveEditorNameAsync(ct);
        row.HandledAt = _clock.UtcNow;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new GdprRequestDto(
            row.Id, row.RequesterName, row.RequesterEmail, row.RequesterPhone,
            row.CustomerId, null, row.Reason, row.Status, row.Notes,
            row.CreatedAt, row.HandledAt, row.HandledByName));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.GdprErasureRequests
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αίτημα διαγραφής");
        row.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<string?> ResolveEditorNameAsync(CancellationToken ct)
    {
        if (!_current.UserId.HasValue) return null;
        var u = await _db.Users
            .Where(x => x.Id == _current.UserId.Value && x.DeletedAt == null)
            .Select(x => new { x.FirstName, x.LastName, x.Email })
            .FirstOrDefaultAsync(ct);
        if (u is null) return null;
        var full = $"{u.FirstName} {u.LastName}".Trim();
        return string.IsNullOrWhiteSpace(full) ? u.Email : full;
    }
}
