using Kalypsis.Application.Features.Reports;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Policy = "AgencyStaff")]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("agency")]
    public async Task<ActionResult<AgencyReportDto>> Agency(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetAgencyReportQuery(), cancellationToken));
}
