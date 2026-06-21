using Kalypsis.Application.Features.Communications;
using Kalypsis.Application.Features.Consents;
using Kalypsis.Application.Features.Gdpr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Agency-side GDPR + interactions endpoints for a specific customer record.
/// Mobile clients hit the corresponding ME-scoped endpoints in <see cref="ClientPortalController"/>.
/// </summary>
[ApiController]
[Route("api/customers/{customerId:guid}")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerGdprController : ControllerBase
{
    private readonly IMediator _m;
    public CustomerGdprController(IMediator m) => _m = m;

    [HttpGet("consents")]
    public async Task<ActionResult<IReadOnlyList<ConsentDto>>> ListConsents(Guid customerId, CancellationToken ct)
        => Ok(await _m.Send(new ListCustomerConsentsQuery(customerId), ct));

    [HttpPost("consents")]
    public async Task<ActionResult<ConsentDto>> Grant(Guid customerId, [FromBody] GrantConsentBody body, CancellationToken ct)
        => Ok(await _m.Send(new GrantConsentCommand(customerId, body, HttpContext.Connection.RemoteIpAddress?.ToString()), ct));

    [HttpPost("consents/revoke")]
    public async Task<ActionResult> Revoke(Guid customerId, [FromBody] RevokeConsentBody body, CancellationToken ct)
    {
        await _m.Send(new RevokeConsentCommand(customerId, body), ct);
        return NoContent();
    }

    [HttpGet("communications")]
    public async Task<ActionResult<IReadOnlyList<CommunicationDto>>> ListCommunications(
        Guid customerId,
        [FromQuery] Domain.Enums.CommunicationKind? kind,
        CancellationToken ct)
        => Ok(await _m.Send(new ListCommunicationsQuery(customerId, kind), ct));

    [HttpPost("communications")]
    public async Task<ActionResult<CommunicationDto>> CreateCommunication(
        Guid customerId, [FromBody] CreateCommunicationBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateCommunicationCommand(customerId, body), ct));

    [HttpGet("export")]
    public async Task<ActionResult<CustomerExportDto>> Export(Guid customerId, CancellationToken ct)
        => Ok(await _m.Send(new ExportCustomerDataQuery(customerId), ct));

    [HttpPost("anonymize")]
    public async Task<ActionResult> Anonymize(Guid customerId, CancellationToken ct)
    {
        await _m.Send(new AnonymizeCustomerCommand(customerId), ct);
        return NoContent();
    }
}
