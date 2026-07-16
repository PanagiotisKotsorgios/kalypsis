using Kalypsis.Application.Features.PlatformSupport;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/support-tickets")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformSupportController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformSupportController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupportTicketDto>>> List(
        [FromQuery] string? status, [FromQuery] string? priority, CancellationToken ct)
        => Ok(await _m.Send(new ListTicketsQuery(status, priority), ct));

    public record CreateBody(Guid TenantId, string Subject, string Body, string Priority, string Channel, string? Assignee);

    [HttpPost]
    public async Task<ActionResult<SupportTicketDto>> Create([FromBody] CreateBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateTicketCommand(
            body.TenantId, body.Subject, body.Body, body.Priority, body.Channel, body.Assignee), ct));

    public record UpdateBody(string? Status, string? Priority, string? Assignee);

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<SupportTicketDto>> Update(Guid id, [FromBody] UpdateBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdateTicketCommand(id, body.Status, body.Priority, body.Assignee), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteTicketCommand(id), ct);
        return NoContent();
    }

    public record ReplyBody(string Author, string Body);

    [HttpPost("{id:guid}/replies")]
    public async Task<ActionResult<SupportTicketDto>> Reply(Guid id, [FromBody] ReplyBody body, CancellationToken ct)
        => Ok(await _m.Send(new AddReplyCommand(id, body.Author, body.Body), ct));

    public record NotifyBody(string Subject, string Body);

    [HttpPost("{id:guid}/notify")]
    public async Task<ActionResult<SupportTicketDto>> Notify(Guid id, [FromBody] NotifyBody body, CancellationToken ct)
        => Ok(await _m.Send(new NotifyTenantCommand(id, body.Subject, body.Body), ct));
}
