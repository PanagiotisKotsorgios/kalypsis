using Kalypsis.Application.Features.Tenants;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/tenants")]
[Authorize(Policy = "PlatformLevel")]
public class TenantsController : ControllerBase
{
    private readonly IMediator _mediator;
    public TenantsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TenantDto>>> List(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListTenantsQuery(), cancellationToken));

    [HttpPost]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<CreateTenantResponse>> Create([FromBody] CreateTenantRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateTenantCommand(request), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<TenantDto>> Update(Guid id, [FromBody] UpdateTenantBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdateTenantCommand(id, body), cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteTenantCommand(id), cancellationToken);
        return NoContent();
    }
}
