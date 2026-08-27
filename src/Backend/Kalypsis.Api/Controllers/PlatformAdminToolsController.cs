using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.PlatformAdmin;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Small collection of platform-admin utilities exposed as one controller
/// so the frontend can wire a "Utilities" pane without hunting endpoints
/// across files.
///
///   • Outbound-email kill switch — toggle a global flag on PlatformSetting
///     that short-circuits every IEmailSender.SendAsync call. Used before
///     bulk operations that would otherwise trigger real recipient sends.
///   • Test-data seed for a specific tenant — non-destructive, additive
///     rich data (customers/producers/policies/receipts/endorsements/
///     cancellations/credit-notes/claims/movements/appointments).
/// </summary>
[ApiController]
[Route("api/platform/admin-tools")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformAdminToolsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMediator _mediator;
    private readonly IDateTimeProvider _clock;
    public PlatformAdminToolsController(AppDbContext db, IMediator mediator, IDateTimeProvider clock)
    { _db = db; _mediator = mediator; _clock = clock; }

    public record OutboundEmailsStatusDto(bool Disabled, DateTime? LastChangedAt);

    [HttpGet("outbound-emails")]
    public async Task<ActionResult<OutboundEmailsStatusDto>> GetOutboundEmailsStatus(CancellationToken ct)
    {
        var s = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        return Ok(new OutboundEmailsStatusDto(
            s?.OutboundEmailsDisabled ?? false,
            s?.UpdatedAt));
    }

    /// <summary>Flip the outbound-email kill switch. Idempotent — sending
    /// «disable» while already disabled is a no-op that still returns
    /// the current state.</summary>
    [HttpPost("outbound-emails")]
    public async Task<ActionResult<OutboundEmailsStatusDto>> SetOutboundEmails(
        [FromBody] SetOutboundEmailsBody body, CancellationToken ct)
    {
        // The singleton PlatformSetting row is created on first save;
        // seed one if we hit the toggle before anyone has set anything.
        var s = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (s is null)
        {
            s = new Kalypsis.Domain.Entities.PlatformSetting
            {
                Id = Guid.NewGuid(),
                CreatedAt = _clock.UtcNow,
            };
            _db.PlatformSettings.Add(s);
        }
        s.OutboundEmailsDisabled = body.Disabled;
        s.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new OutboundEmailsStatusDto(s.OutboundEmailsDisabled, s.UpdatedAt));
    }

    public record SetOutboundEmailsBody(bool Disabled);

    /// <summary>Small tenant picker for the admin tools UI — id + display
    /// name + code + admin email. Ordered by name, active tenants only.
    /// Kept local to this controller so the admin-tools card doesn't
    /// need to know about the fuller tenants API.</summary>
    public record TenantPickDto(Guid Id, string Name, string Code,
        string? ContactEmail, string? AdminEmail);

    [HttpGet("tenants")]
    public async Task<ActionResult<IReadOnlyList<TenantPickDto>>> ListTenants(CancellationToken ct)
    {
        // AgencyAdmin email = the tenant's first AgencyAdmin user's email.
        // Handy way to identify a tenant when the operator only remembers
        // whose office it is (e.g. "opengplms@gmail.com").
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id, t.Name, t.Code, t.ContactEmail,
                AdminEmail = _db.Users.IgnoreQueryFilters()
                    .Where(u => u.TenantId == t.Id && u.DeletedAt == null
                        && u.Role == Kalypsis.Domain.Enums.Role.AgencyAdmin)
                    .OrderBy(u => u.CreatedAt)
                    .Select(u => u.Email).FirstOrDefault(),
            })
            .ToListAsync(ct);
        return Ok(tenants.Select(t => new TenantPickDto(t.Id, t.Name, t.Code, t.ContactEmail, t.AdminEmail)).ToList());
    }

    /// <summary>Seed test data into a target tenant. The command refuses
    /// to run when OutboundEmailsDisabled is false, so an accidental
    /// re-run cannot spam real customers.</summary>
    [HttpPost("tenants/{tenantId:guid}/seed-test-data")]
    public async Task<ActionResult<SeedTenantTestDataResult>> SeedTestData(
        Guid tenantId, CancellationToken ct)
        => Ok(await _mediator.Send(new SeedTenantTestDataCommand(tenantId), ct));
}
