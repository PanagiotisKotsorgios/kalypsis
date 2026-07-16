using Kalypsis.Application.Features.PlatformPayments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/tenant-payments")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformPaymentsController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformPaymentsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TenantPaymentDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListTenantPaymentsQuery(), ct));

    public record UpsertBody(DateTime? PaidUntil, DateTime? LastPaidOn, string? Note);

    [HttpPut("{tenantId:guid}")]
    public async Task<ActionResult<TenantPaymentDto>> Upsert(Guid tenantId, [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertTenantPaymentCommand(
            tenantId, body.PaidUntil, body.LastPaidOn, body.Note), ct));

    [HttpDelete("{tenantId:guid}")]
    public async Task<IActionResult> Clear(Guid tenantId, CancellationToken ct)
    {
        await _m.Send(new ClearTenantPaymentCommand(tenantId), ct);
        return NoContent();
    }
}
