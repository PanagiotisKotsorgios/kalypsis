using Kalypsis.Application.Features.ParagogiExports;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/paragogi-exports")]
[Authorize(Policy = "AgencyStaff")]
public class ParagogiExportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ParagogiExportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("{entity}")]
    public async Task<IActionResult> Export(
        string entity,
        [FromQuery] string format = "xlsx",
        [FromQuery] string? search = null,
        [FromQuery] PolicyStatus? policyStatus = null,
        [FromQuery] PolicyType? policyType = null,
        [FromQuery] ClaimStatus? claimStatus = null,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<ParagogiEntity>(entity, ignoreCase: true, out var parsed))
            return BadRequest(new { error = "unknown_entity", entity });

        var result = await _mediator.Send(
            new ExportParagogiQuery(parsed, format, search, policyStatus, policyType, claimStatus), ct);
        return File(result.Content, result.MimeType, result.FileName);
    }
}
