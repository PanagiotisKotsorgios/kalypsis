using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 8 — Launch gate + site-wide maintenance toggles. The frontend reads
/// <c>/api/public/maintenance</c> before login and on every full-page load so
/// the superadmin can switch them on/off instantly.
/// </summary>
[ApiController]
public class MaintenanceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public MaintenanceController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record MaintenanceDto(
        bool LaunchGateEnabled, string? LaunchGateTitle, string? LaunchGateMessage,
        bool MaintenanceModeEnabled, string? MaintenanceTitle, string? MaintenanceMessage);

    public record UpdateBody(
        bool LaunchGateEnabled, string? LaunchGateTitle, string? LaunchGateMessage,
        bool MaintenanceModeEnabled, string? MaintenanceTitle, string? MaintenanceMessage);

    /// <summary>Public read — every browser session hits this on bootstrap.</summary>
    [AllowAnonymous]
    [HttpGet("/api/public/maintenance")]
    public async Task<ActionResult<MaintenanceDto>> Public(CancellationToken ct)
    {
        var s = await _db.PlatformSettings.IgnoreQueryFilters().FirstOrDefaultAsync(ct);
        return Ok(new MaintenanceDto(
            s?.LaunchGateEnabled ?? false,
            s?.LaunchGateTitle,
            s?.LaunchGateMessage,
            s?.MaintenanceModeEnabled ?? false,
            s?.MaintenanceTitle,
            s?.MaintenanceMessage));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("/api/platform/maintenance")]
    public async Task<ActionResult<MaintenanceDto>> Get(CancellationToken ct)
    {
        var s = await EnsureRowAsync(ct);
        return Ok(new MaintenanceDto(
            s.LaunchGateEnabled, s.LaunchGateTitle, s.LaunchGateMessage,
            s.MaintenanceModeEnabled, s.MaintenanceTitle, s.MaintenanceMessage));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPut("/api/platform/maintenance")]
    public async Task<ActionResult<MaintenanceDto>> Update([FromBody] UpdateBody body, CancellationToken ct)
    {
        var s = await EnsureRowAsync(ct);
        s.LaunchGateEnabled = body.LaunchGateEnabled;
        s.LaunchGateTitle = body.LaunchGateTitle;
        s.LaunchGateMessage = body.LaunchGateMessage;
        s.MaintenanceModeEnabled = body.MaintenanceModeEnabled;
        s.MaintenanceTitle = body.MaintenanceTitle;
        s.MaintenanceMessage = body.MaintenanceMessage;
        s.UpdatedAt = _clock.UtcNow;
        s.LastUpdatedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);
        return Ok(new MaintenanceDto(
            s.LaunchGateEnabled, s.LaunchGateTitle, s.LaunchGateMessage,
            s.MaintenanceModeEnabled, s.MaintenanceTitle, s.MaintenanceMessage));
    }

    private async Task<PlatformSetting> EnsureRowAsync(CancellationToken ct)
    {
        var s = await _db.PlatformSettings.IgnoreQueryFilters().FirstOrDefaultAsync(ct);
        if (s is null)
        {
            s = new PlatformSetting { Id = Guid.NewGuid(), CreatedAt = _clock.UtcNow };
            _db.PlatformSettings.Add(s);
            await _db.SaveChangesAsync(ct);
        }
        return s;
    }
}
