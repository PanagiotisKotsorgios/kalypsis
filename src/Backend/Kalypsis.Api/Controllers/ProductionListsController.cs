using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/production-lists")]
[Authorize(Policy = "AgencyStaff")]
public class ProductionListsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ProductionListsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<ProductionListResultDto>> Get(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] Guid? producerId,
        [FromQuery] PolicyType? policyType, [FromQuery] PolicyStatus? status,
        [FromQuery] string? groupBy, CancellationToken ct)
        => Ok(await _mediator.Send(new GetProductionListQuery(
            new ProductionFilters(from, to, insuranceCompanyId, producerId, policyType, status, groupBy)), ct));

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] Guid? producerId,
        [FromQuery] PolicyType? policyType, [FromQuery] PolicyStatus? status,
        [FromQuery] string? groupBy, [FromQuery] string format = "csv",
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ExportProductionListQuery(
            new ProductionFilters(from, to, insuranceCompanyId, producerId, policyType, status, groupBy),
            format), ct);
        return File(result.Content, result.MimeType, result.FileName);
    }
}
