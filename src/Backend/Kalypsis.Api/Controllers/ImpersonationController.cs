using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 7 — Full user-level impersonation ("login as any user") for
/// platform staff. Distinct from tenant-level impersonation which only sets
/// an X-Impersonate-Tenant header. This endpoint actually mints a JWT for
/// the target user, audits the event, and returns enough metadata for the
/// frontend to render a "← exit impersonation" banner.
///
/// Tokens are 30-minute, non-refreshable. The original admin's session is
/// preserved client-side and restored on exit.
/// </summary>
[ApiController]
[Route("api/platform/impersonate")]
[Authorize(Policy = "PlatformAdmin")]
public class ImpersonationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IJwtTokenService _jwt;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ImpersonationController(AppDbContext db, IJwtTokenService jwt, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _jwt = jwt; _current = current; _clock = clock; }

    public record TargetInfo(Guid UserId, string Email, string FirstName, string LastName, string Role, Guid? TenantId, string? TenantName);
    public record ImpersonationResponse(string AccessToken, DateTime ExpiresAt, TargetInfo TargetUser,
        Guid ImpersonatorUserId, string ImpersonatorEmail);

    [HttpPost("{userId:guid}")]
    public async Task<ActionResult<ImpersonationResponse>> Start(Guid userId, CancellationToken ct)
    {
        if (!_current.UserId.HasValue) return Unauthorized();
        if (userId == _current.UserId.Value)
            return BadRequest(new { code = "self_impersonation", message = "Δεν μπορείτε να συνδεθείτε ως ο εαυτός σας." });

        var target = await _db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("Χρήστης");

        var tenantName = target.TenantId == Guid.Empty
            ? null
            : await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.Id == target.TenantId)
                .Select(t => t.Name).FirstOrDefaultAsync(ct);

        if (!target.IsActive)
            return BadRequest(new { code = "user_inactive", message = "Δεν μπορείτε να συνδεθείτε ως ανενεργός χρήστης." });

        var impersonator = new ImpersonatorIdentity(_current.UserId.Value, _current.Email ?? "unknown");
        var token = _jwt.IssueImpersonationAccessToken(target, impersonator, minutes: 30);
        var expiresAt = _clock.UtcNow.AddMinutes(30);

        // Audit the action — append a row directly via the standard AuditLog table.
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = target.TenantId,
            UserId = _current.UserId,
            EntityName = nameof(User),
            EntityId = target.Id.ToString(),
            Action = "Impersonation.Started",
            NewValues = $"{{\"impersonator\":\"{impersonator.Email}\",\"target\":\"{target.Email}\",\"role\":\"{target.Role}\"}}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers["User-Agent"].ToString(),
            CreatedAt = _clock.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return Ok(new ImpersonationResponse(
            token, expiresAt,
            new TargetInfo(target.Id, target.Email, target.FirstName, target.LastName,
                target.Role.ToString(), target.TenantId == Guid.Empty ? null : target.TenantId,
                tenantName),
            impersonator.UserId, impersonator.Email));
    }

    /// <summary>Audit hook the frontend calls when it stops impersonating.</summary>
    [Authorize]
    [HttpPost("end")]
    public async Task<ActionResult> End(CancellationToken ct)
    {
        if (!_current.UserId.HasValue) return Unauthorized();
        // We only get here when the frontend, holding the impersonation token,
        // calls this endpoint just before swapping back. The token's claims
        // already identify both parties.
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = _current.TenantId,
            UserId = _current.UserId,
            EntityName = nameof(User),
            EntityId = _current.UserId.Value.ToString(),
            Action = "Impersonation.Ended",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers["User-Agent"].ToString(),
            CreatedAt = _clock.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
