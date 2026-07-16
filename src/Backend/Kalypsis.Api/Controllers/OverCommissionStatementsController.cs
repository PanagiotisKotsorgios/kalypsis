using Kalypsis.Application.Features.OverCommissionStatements;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Manual entry surface for the monthly «ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ» carriers ship
/// (ERGO, GC, ATL, etc.). One row per (carrier × producer × month).
/// Endpoint layer for the agency's Financials → Over-commission statements
/// screen. Automated import from the carrier xlsx lives in a separate flow.
/// </summary>
[ApiController]
[Route("api/over-commission-statements")]
[Authorize(Policy = "AgencyAdmin")]
public class OverCommissionStatementsController : ControllerBase
{
    private readonly IMediator _m;
    public OverCommissionStatementsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OverCommissionStatementDto>>> List(
        [FromQuery] int? year, [FromQuery] int? month,
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] Guid? producerId,
        [FromQuery] string? search,
        CancellationToken ct)
        => Ok(await _m.Send(new ListOverCommissionStatementsQuery(
            year, month, insuranceCompanyId, producerId, search), ct));

    public record UpsertBody(
        Guid InsuranceCompanyId, Guid ProducerId,
        int Year, int Month,
        decimal GrossAmount, decimal NetAmount, string? Currency,
        string? Reference, string? Notes,
        DateTime? PaidOn);

    [HttpPost]
    public async Task<ActionResult<OverCommissionStatementDto>> Create(
        [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertOverCommissionStatementCommand(
            null,
            body.InsuranceCompanyId, body.ProducerId,
            body.Year, body.Month,
            body.GrossAmount, body.NetAmount, body.Currency ?? "EUR",
            body.Reference, body.Notes, body.PaidOn), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OverCommissionStatementDto>> Update(
        Guid id, [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertOverCommissionStatementCommand(
            id,
            body.InsuranceCompanyId, body.ProducerId,
            body.Year, body.Month,
            body.GrossAmount, body.NetAmount, body.Currency ?? "EUR",
            body.Reference, body.Notes, body.PaidOn), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteOverCommissionStatementCommand(id), ct);
        return NoContent();
    }
}
