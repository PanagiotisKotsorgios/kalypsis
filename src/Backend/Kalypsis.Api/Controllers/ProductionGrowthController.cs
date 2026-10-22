using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Customers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/production-growth")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("customers.read")]
public sealed class ProductionGrowthController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductionGrowthRowDto>>> Get(CancellationToken ct)
        => Ok(await mediator.Send(new GetProductionGrowthQuery(), ct));
}
