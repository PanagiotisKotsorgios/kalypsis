using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Consents;
using Kalypsis.Application.Features.Gdpr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// "ME"-scoped endpoints the mobile client portal uses for GDPR self-service.
/// Resolves the customer record off the current Customer user.
/// </summary>
[ApiController]
[Route("api/me")]
[Authorize]
public class ClientPortalController : ControllerBase
{
    private readonly IMediator _m;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ClientPortalController(IMediator m, IAppDbContext db, ICurrentUser current)
    {
        _m = m;
        _db = db;
        _current = current;
    }

    private async Task<Guid> ResolveMyCustomerIdAsync(CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var customerId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
        if (customerId is null) throw AppException.Forbidden("Δεν υπάρχει συνδεδεμένος πελάτης.");
        return customerId.Value;
    }

    [HttpGet("consents")]
    public async Task<ActionResult<IReadOnlyList<ConsentDto>>> MyConsents(CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new ListCustomerConsentsQuery(id), ct));
    }

    [HttpPost("consents")]
    public async Task<ActionResult<ConsentDto>> Grant([FromBody] GrantConsentBody body, CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new GrantConsentCommand(id, body, HttpContext.Connection.RemoteIpAddress?.ToString()), ct));
    }

    [HttpPost("consents/revoke")]
    public async Task<ActionResult> Revoke([FromBody] RevokeConsentBody body, CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        await _m.Send(new RevokeConsentCommand(id, body), ct);
        return NoContent();
    }

    [HttpGet("export")]
    public async Task<ActionResult<CustomerExportDto>> ExportMyData(CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new ExportCustomerDataQuery(id), ct));
    }
}
