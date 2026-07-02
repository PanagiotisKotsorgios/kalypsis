using Kalypsis.Application.Features.Producers;
using Kalypsis.Application.Features.Reconciliation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/producer/me")]
[Authorize(Policy = "Producer")]
public class ProducerSelfController : ControllerBase
{
    private readonly IMediator _m;
    public ProducerSelfController(IMediator m) => _m = m;

    [HttpGet("summary")]
    public async Task<ActionResult<ProducerSelfSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _m.Send(new GetProducerSelfSummaryQuery(), ct));

    [HttpGet("commissions")]
    public async Task<ActionResult<IReadOnlyList<ProducerRunLineDto>>> Commissions([FromQuery] int? year, CancellationToken ct)
        => Ok(await _m.Send(new GetProducerSelfCommissionsQuery(year), ct));

    // Reconciliation — producer self-reports expected commission per policy.
    [HttpGet("declarations")]
    public async Task<ActionResult<IReadOnlyList<ProducerDeclarationDto>>> ListMyDeclarations(CancellationToken ct)
        => Ok(await _m.Send(new ListMyDeclarationsQuery(), ct));

    [HttpPost("declarations")]
    public async Task<ActionResult<ProducerDeclarationDto>> CreateMyDeclaration(
        [FromBody] CreateProducerDeclarationBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateMyDeclarationCommand(body), ct));
}
