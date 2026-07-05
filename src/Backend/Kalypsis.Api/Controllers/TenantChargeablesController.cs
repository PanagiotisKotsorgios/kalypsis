using Kalypsis.Application.Features.PlatformAdmin;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Superadmin-only endpoints for managing per-tenant ad-hoc charges
/// (training hours, migration flat fees, custom development).
/// </summary>
[ApiController]
[Route("api/platform/tenant-chargeables")]
[Authorize(Policy = "PlatformAdmin")]
public class TenantChargeablesController : ControllerBase
{
    private readonly IMediator _m;
    public TenantChargeablesController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TenantChargeableDto>>> List(
        [FromQuery] Guid tenantId, CancellationToken ct)
        => Ok(await _m.Send(new ListTenantChargeablesQuery(tenantId), ct));

    [HttpPost]
    public async Task<ActionResult<TenantChargeableDto>> Upsert(
        [FromBody] UpsertTenantChargeableBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertTenantChargeableCommand(body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteTenantChargeableCommand(id), ct);
        return NoContent();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<TenantChargeableSummaryDto>> Summary(
        [FromQuery] Guid tenantId, CancellationToken ct)
        => Ok(await _m.Send(new GetTenantChargeableSummaryQuery(tenantId), ct));
}
