using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Policies;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/vehicles")]
[Authorize]
public sealed class VehiclesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    [RequirePermission("policies.read")]
    public async Task<ActionResult<IReadOnlyList<VehicleRegisterRow>>> List(CancellationToken ct)
        => Ok(await mediator.Send(new VehicleRegisterQuery(), ct));
}
