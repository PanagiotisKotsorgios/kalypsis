using Kalypsis.Application.Common;
using Kalypsis.Application.Features.ProducerPortal;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Legacy commission-expectation endpoints. Commission rules are now owned by
/// the office, so Producer users are deliberately not authorized to call them.
/// Existing rows are left intact for audit history; they are no longer exposed
/// in the producer portal or used as a comparison surface.
/// </summary>
[ApiController]
[Route("api/producer-portal")]
[Authorize(Policy = "AgencyStaff")]
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

    /// <summary>Only the carriers the producer actually interacts with —
    /// used to filter down the «Παραμετροποίηση μου» dropdown so both
    /// sides of the comparison end up with the same shortlist.</summary>
    [HttpGet("relevant-carriers")]
    public async Task<ActionResult<IReadOnlyList<ProducerRelevantCarrierDto>>> ListRelevantCarriers(CancellationToken ct)
        => Ok(await _m.Send(new ListMyRelevantCarriersQuery(), ct));
}
