using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Per-user saved filter presets on reporting pages. Not a real report engine —
/// just a bookmark for what filters were open. Pages hydrate the FiltersJson
/// on click.
/// </summary>
[ApiController]
[Route("api/saved-reports")]
[Authorize(Policy = "AgencyStaff")]
public class SavedReportsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public SavedReportsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ReportDto(Guid Id, string Entity, string Name, string FiltersJson, bool IsShared,
        bool OwnedByMe, DateTime CreatedAt);
    public record UpsertBody(string Entity, string Name, string FiltersJson, bool IsShared);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReportDto>>> List(
        [FromQuery] string? entity, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var q = _db.SavedReports
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null
                && (r.OwnerUserId == userId || r.IsShared));
        if (!string.IsNullOrWhiteSpace(entity))
            q = q.Where(r => r.Entity == entity);
        var rows = await q.OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct);
        return Ok(rows.Select(r => new ReportDto(r.Id, r.Entity, r.Name, r.FiltersJson, r.IsShared,
            r.OwnerUserId == userId, r.CreatedAt)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<ReportDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        if (string.IsNullOrWhiteSpace(body.Entity) || string.IsNullOrWhiteSpace(body.Name))
            throw new AppException("saved_report_required", "Συμπληρώστε τύπο και όνομα.", 400);
        var r = new SavedReport
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            OwnerUserId = userId,
            Entity = body.Entity.Trim(),
            Name = body.Name.Trim(),
            FiltersJson = string.IsNullOrWhiteSpace(body.FiltersJson) ? "{}" : body.FiltersJson,
            IsShared = body.IsShared,
            CreatedAt = _clock.UtcNow
        };
        _db.SavedReports.Add(r);
        await _db.SaveChangesAsync(ct);
        return Ok(new ReportDto(r.Id, r.Entity, r.Name, r.FiltersJson, r.IsShared, true, r.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var r = await _db.SavedReports.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.OwnerUserId == userId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Report");
        r.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
