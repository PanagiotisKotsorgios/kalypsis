using Kalypsis.Application.Features.Reports;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("agency")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<AgencyReportDto>> Agency(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetAgencyReportQuery(), cancellationToken));

    [HttpGet("producer")]
    [Authorize(Policy = "Producer")]
    public async Task<ActionResult<ProducerReportDto>> Producer(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetProducerReportQuery(), cancellationToken));

    [HttpGet("agency-user")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<AgencyUserReportDto>> AgencyUser(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetAgencyUserReportQuery(), cancellationToken));

    [HttpGet("platform")]
    [Authorize(Policy = "PlatformLevel")]
    public async Task<ActionResult<PlatformReportDto>> Platform(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetPlatformReportQuery(), cancellationToken));
}
