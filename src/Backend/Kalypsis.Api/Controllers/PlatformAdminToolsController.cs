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

    /// <summary>Seed test data into a target tenant. The command refuses
    /// to run when OutboundEmailsDisabled is false, so an accidental
    /// re-run cannot spam real customers.</summary>
    [HttpPost("tenants/{tenantId:guid}/seed-test-data")]
    public async Task<ActionResult<SeedTenantTestDataResult>> SeedTestData(
        Guid tenantId, CancellationToken ct)
        => Ok(await _mediator.Send(new SeedTenantTestDataCommand(tenantId), ct));
}
