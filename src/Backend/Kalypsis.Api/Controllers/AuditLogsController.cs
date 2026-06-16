using Kalypsis.Application.Features.Audit;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = "PlatformLevel")]
public class AuditLogsController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuditLogsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogDto>>> List(
        [FromQuery] string? entityName,
        [FromQuery] string? action,
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? userId,
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(new ListAuditLogsQuery(entityName, action, tenantId, userId, take), cancellationToken));
}
