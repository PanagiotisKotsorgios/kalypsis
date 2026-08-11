using Kalypsis.Application.Features.PlatformSupport;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// «Τα αιτήματά μου» — tenant-scoped read/write for support tickets. Lets a
/// signed-in agency user see their own past requests and open new ones from
/// the Αίτημα Υποστήριξης page without needing platform-admin rights.
/// </summary>
[ApiController]
[Route("api/support-tickets/mine")]
[Authorize(Policy = "AgencyStaff")]
public class MySupportTicketsController : ControllerBase
{
    private readonly IMediator _m;
    public MySupportTicketsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupportTicketDto>>> List(
        [FromQuery] string? search, [FromQuery] string? status, CancellationToken ct)
        => Ok(await _m.Send(new MyTicketsQuery(search, status), ct));

    public record CreateBody(string Subject, string Body);

    [HttpPost]
    public async Task<ActionResult<SupportTicketDto>> Create([FromBody] CreateBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateMyTicketCommand(body.Subject ?? "", body.Body ?? ""), ct));
}
