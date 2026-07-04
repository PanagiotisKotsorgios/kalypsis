using Kalypsis.Application.Common;
using Kalypsis.Application.Features.ProducerPortal;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Producer-portal endpoints — scoped to whichever Producer row the current
/// user (Role=Producer) is linked to via User.ProducerId. Covers:
///   • CRUD for the producer's own «παραμετροποίηση προμηθειών»
///   • Comparison view: producer's expected rates vs the agency's CommissionRule
///     at each (company × package × vehicle-use) key, with delta and status
/// </summary>
[ApiController]
[Route("api/producer-portal")]
[Authorize(Roles = "Producer")]
public class ProducerPortalController : ControllerBase
{
    private readonly IMediator _m;
    public ProducerPortalController(IMediator m) => _m = m;

    [HttpGet("expected-rates")]
    public async Task<ActionResult<IReadOnlyList<ExpectedRateDto>>> ListMyRates(CancellationToken ct)
        => Ok(await _m.Send(new ListMyExpectedRatesQuery(), ct));

    [HttpPost("expected-rates")]
    public async Task<ActionResult<ExpectedRateDto>> UpsertMyRate(
        [FromBody] UpsertExpectedRateBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertMyExpectedRateCommand(body), ct));

    [HttpDelete("expected-rates/{id:guid}")]
    public async Task<ActionResult> DeleteMyRate(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteMyExpectedRateCommand(id), ct);
        return NoContent();
    }

    [HttpGet("rate-comparison")]
    public async Task<ActionResult<IReadOnlyList<ProducerRateComparisonRow>>> GetComparison(CancellationToken ct)
        => Ok(await _m.Send(new GetMyRateComparisonQuery(), ct));
}
