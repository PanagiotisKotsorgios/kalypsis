using Kalypsis.Application.Features.Audit;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = "AgencyAdmin")]
public class AuditLogsController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuditLogsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<AuditLogPageDto>> List(
        [FromQuery] string? entityName,
        [FromQuery] string? action,
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? userId,
        [FromQuery] string? category,
        [FromQuery] string? search,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(new ListAuditLogsQuery(
            entityName, action, tenantId, userId, category, search, from, to, page, pageSize), cancellationToken));
}

[ApiController]
[Route("api/audit-logs/activity")]
[Authorize(Policy = "AgencyStaff")]
public class AuditActivityController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuditActivityController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    public async Task<IActionResult> Record(
        [FromBody] AuditActivityBatchRequest request,
        CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();
        await _mediator.Send(new LogUiActivityCommand(request.Events, ipAddress, userAgent), cancellationToken);
        return Accepted();
    }
}

public record AuditActivityBatchRequest(IReadOnlyList<UiActivityEventDto>? Events);
