using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

// ============================================================================
// Phase 6 — Multi-office agencies (παραρτήματα / υποκαταστήματα)
// CRUD for AgencyOffice plus user-to-office assignments.
// Gated under Integrations package — see Phase 5 / pricing copy.
// ============================================================================

[ApiController]
[Route("api/agency-offices")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Integrations)]
public class AgencyOfficesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;

    public AgencyOfficesController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record OfficeDto(Guid Id, string Code, string Name, string? City, string? Address,
        string? PostalCode, string? Phone, string? Email, bool IsHeadquarters, bool IsActive,
        int UserCount, string? Notes);

    public record UpsertOfficeBody(string Code, string Name, string? City, string? Address,
        string? PostalCode, string? Phone, string? Email, bool IsHeadquarters, bool IsActive,
        string? Notes);

    [HttpGet]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<IReadOnlyList<OfficeDto>>> List(CancellationToken ct) =>
        Ok(await _db.AgencyOffices
            .Where(o => o.DeletedAt == null)
            .OrderByDescending(o => o.IsHeadquarters)
            .ThenBy(o => o.Name)
            .Select(o => new OfficeDto(
                o.Id, o.Code, o.Name, o.City, o.Address, o.PostalCode, o.Phone, o.Email,
                o.IsHeadquarters, o.IsActive,
                _db.UserAgencyOffices.Count(a => a.AgencyOfficeId == o.Id && a.DeletedAt == null),
                o.Notes))
            .ToListAsync(ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<OfficeDto>> Get(Guid id, CancellationToken ct)
    {
        var o = await _db.AgencyOffices.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Office");
        var count = await _db.UserAgencyOffices.CountAsync(a => a.AgencyOfficeId == o.Id && a.DeletedAt == null, ct);
        return Ok(new OfficeDto(o.Id, o.Code, o.Name, o.City, o.Address, o.PostalCode, o.Phone, o.Email,
            o.IsHeadquarters, o.IsActive, count, o.Notes));
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<OfficeDto>> Create([FromBody] UpsertOfficeBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Only one HQ allowed per tenant — silently flip the previous one if needed.
        if (body.IsHeadquarters)
            await _db.AgencyOffices.Where(o => o.TenantId == tenantId && o.IsHeadquarters && o.DeletedAt == null)
                .ForEachAsync(o => o.IsHeadquarters = false, ct);

        var office = new AgencyOffice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = body.Code.Trim(),
            Name = body.Name.Trim(),
            City = body.City, Address = body.Address, PostalCode = body.PostalCode,
            Phone = body.Phone, Email = body.Email,
            IsHeadquarters = body.IsHeadquarters,
            IsActive = body.IsActive,
            Notes = body.Notes
        };
        _db.AgencyOffices.Add(office);
        await _db.SaveChangesAsync(ct);
        return Ok(new OfficeDto(office.Id, office.Code, office.Name, office.City, office.Address,
            office.PostalCode, office.Phone, office.Email, office.IsHeadquarters, office.IsActive, 0, office.Notes));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<OfficeDto>> Update(Guid id, [FromBody] UpsertOfficeBody body, CancellationToken ct)
    {
        var office = await _db.AgencyOffices.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Office");
        if (body.IsHeadquarters && !office.IsHeadquarters)
            await _db.AgencyOffices.Where(o => o.TenantId == office.TenantId && o.IsHeadquarters && o.Id != id && o.DeletedAt == null)
                .ForEachAsync(o => o.IsHeadquarters = false, ct);
        office.Code = body.Code.Trim();
        office.Name = body.Name.Trim();
        office.City = body.City; office.Address = body.Address; office.PostalCode = body.PostalCode;
        office.Phone = body.Phone; office.Email = body.Email;
        office.IsHeadquarters = body.IsHeadquarters;
        office.IsActive = body.IsActive;
        office.Notes = body.Notes;
        office.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        var count = await _db.UserAgencyOffices.CountAsync(a => a.AgencyOfficeId == office.Id && a.DeletedAt == null, ct);
        return Ok(new OfficeDto(office.Id, office.Code, office.Name, office.City, office.Address,
            office.PostalCode, office.Phone, office.Email, office.IsHeadquarters, office.IsActive, count, office.Notes));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var office = await _db.AgencyOffices.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Office");
        if (office.IsHeadquarters)
            return BadRequest(new { code = "cannot_delete_hq", message = "Δεν μπορείτε να διαγράψετε το κεντρικό υποκατάστημα." });
        office.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------- user-to-office assignments ----------

    public record UserOfficeDto(Guid OfficeId, string OfficeName, bool IsPrimary);
    public record AssignBody(IReadOnlyList<Guid> OfficeIds, Guid? PrimaryOfficeId);
    public record OfficeUserDto(Guid UserId, string Email, string FirstName, string LastName,
        Role Role, bool IsAssigned, bool IsPrimary);
    public record AssignOfficeUsersBody(IReadOnlyList<Guid> UserIds);

    [HttpGet("{id:guid}/users")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<IReadOnlyList<OfficeUserDto>>> ListOfficeUsers(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var officeExists = await _db.AgencyOffices.AnyAsync(o => o.Id == id && o.TenantId == tenantId, ct);
        if (!officeExists) throw AppException.NotFound("Office");

        return Ok(await _db.Users
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                && (u.Role == Role.AgencyAdmin || u.Role == Role.AgencyUser))
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .Select(u => new OfficeUserDto(
                u.Id, u.Email, u.FirstName, u.LastName, u.Role,
                _db.UserAgencyOffices.Any(a => a.UserId == u.Id && a.AgencyOfficeId == id && a.DeletedAt == null),
                _db.UserAgencyOffices.Any(a => a.UserId == u.Id && a.AgencyOfficeId == id
                    && a.IsPrimary && a.DeletedAt == null)))
            .ToListAsync(ct));
    }

    [HttpPut("{id:guid}/users")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> AssignOfficeUsers(Guid id, [FromBody] AssignOfficeUsersBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var office = await _db.AgencyOffices.FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Office");
        var desired = body.UserIds.Distinct().ToHashSet();
        var validUsers = await _db.Users
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                && (u.Role == Role.AgencyAdmin || u.Role == Role.AgencyUser))
            .Select(u => u.Id).ToHashSetAsync(ct);
        if (desired.Any(userId => !validUsers.Contains(userId)))
            return BadRequest(new { code = "invalid_office_user", message = "Η ανάθεση περιέχει μη έγκυρο χρήστη." });

        var rows = await _db.UserAgencyOffices
            .Where(a => a.TenantId == tenantId && a.AgencyOfficeId == id)
            .ToListAsync(ct);
        var byUser = rows.ToDictionary(x => x.UserId);
        var addedRows = new List<UserAgencyOffice>();
        foreach (var userId in desired)
        {
            if (byUser.TryGetValue(userId, out var row))
            {
                row.DeletedAt = null;
            }
            else
            {
                var added = new UserAgencyOffice
                {
                    Id = Guid.NewGuid(), TenantId = tenantId, UserId = userId,
                    AgencyOfficeId = id, IsPrimary = false
                };
                _db.UserAgencyOffices.Add(added);
                addedRows.Add(added);
            }
        }
        foreach (var row in rows.Where(x => !desired.Contains(x.UserId) && x.DeletedAt == null))
            row.DeletedAt = _clock.UtcNow;

        // Ensure each assigned user has one primary office.  Existing primary
        // choices are preserved; newly assigned users default to this office.
        var desiredRows = rows.Where(x => desired.Contains(x.UserId) && x.DeletedAt == null)
            .Concat(addedRows).ToList();
        foreach (var userId in desired)
        {
            if (desiredRows.Any(x => x.UserId == userId && x.IsPrimary)) continue;
            var existingPrimary = await _db.UserAgencyOffices
                .FirstOrDefaultAsync(x => x.UserId == userId && x.IsPrimary && x.DeletedAt == null, ct);
            if (existingPrimary is null)
            {
                var current = desiredRows.FirstOrDefault(x => x.UserId == userId);
                if (current is not null) current.IsPrimary = true;
            }
        }

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Office context available to the signed-in back-office user.</summary>
    [HttpGet("mine")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<IReadOnlyList<UserOfficeDto>>> Mine(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();

        // Agency admins manage the tenant and can see every office.  Staff only
        // receive their assigned offices, which also drives the client selector.
        var q = _db.AgencyOffices.Where(o => o.TenantId == tenantId && o.DeletedAt == null && o.IsActive);
        if (_current.Role != Role.AgencyAdmin && !_current.IsPlatformLevel)
        {
            var assigned = _db.UserAgencyOffices
                .Where(a => a.TenantId == tenantId && a.UserId == userId && a.DeletedAt == null)
                .Select(a => a.AgencyOfficeId);
            q = q.Where(o => assigned.Contains(o.Id));
        }

        return Ok(await q
            .OrderByDescending(o => o.IsHeadquarters)
            .ThenBy(o => o.Name)
            .Select(o => new UserOfficeDto(o.Id, o.Name,
                _db.UserAgencyOffices.Any(a => a.UserId == userId && a.AgencyOfficeId == o.Id
                    && a.IsPrimary && a.DeletedAt == null)))
            .ToListAsync(ct));
    }

    [HttpGet("/api/users/{userId:guid}/offices")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<IReadOnlyList<UserOfficeDto>>> ListForUser(Guid userId, CancellationToken ct) =>
        Ok(await _db.UserAgencyOffices
            .Where(a => a.UserId == userId && a.DeletedAt == null)
            .Select(a => new UserOfficeDto(a.AgencyOfficeId, a.AgencyOffice!.Name, a.IsPrimary))
            .ToListAsync(ct));

    /// <summary>Replace the full set of office assignments for a user.</summary>
    [HttpPut("/api/users/{userId:guid}/offices")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> AssignToUser(Guid userId, [FromBody] AssignBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var existing = await _db.UserAgencyOffices.Where(a => a.UserId == userId).ToListAsync(ct);
        var existingByOffice = existing.ToDictionary(e => e.AgencyOfficeId);
        var desired = body.OfficeIds.Distinct().ToHashSet();

        var allowedOfficeIds = await _db.AgencyOffices
            .Where(o => o.TenantId == tenantId && o.DeletedAt == null)
            .Select(o => o.Id)
            .ToHashSetAsync(ct);
        if (desired.Any(id => !allowedOfficeIds.Contains(id))
            || (body.PrimaryOfficeId.HasValue && !desired.Contains(body.PrimaryOfficeId.Value)))
            return BadRequest(new { code = "invalid_office_assignment", message = "Η ανάθεση περιέχει μη έγκυρο υποκατάστημα." });

        // Revive or insert
        foreach (var officeId in desired)
        {
            if (existingByOffice.TryGetValue(officeId, out var row))
            {
                row.DeletedAt = null;
                row.IsPrimary = body.PrimaryOfficeId == officeId;
            }
            else
            {
                _db.UserAgencyOffices.Add(new UserAgencyOffice
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    AgencyOfficeId = officeId,
                    IsPrimary = body.PrimaryOfficeId == officeId
                });
            }
        }

        // Soft-delete what was removed
        foreach (var row in existing.Where(r => !desired.Contains(r.AgencyOfficeId) && r.DeletedAt == null))
            row.DeletedAt = _clock.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
