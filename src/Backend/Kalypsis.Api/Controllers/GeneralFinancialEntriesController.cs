using Kalypsis.Application.Features.GeneralFinancialEntries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Γενικά έσοδα / έξοδα γραφείου — free-form categorised P&amp;L rows that
/// don't come from a policy. Parity with the desktop app's Financial
/// Movements module.
/// </summary>
[ApiController]
[Route("api/general-financial-entries")]
[Authorize(Policy = "AgencyAdmin")]
public class GeneralFinancialEntriesController : ControllerBase
{
    private readonly IMediator _m;
    public GeneralFinancialEntriesController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GeneralFinancialEntryDto>>> List(
        [FromQuery] int? year, [FromQuery] int? month,
        [FromQuery] string? kind, [FromQuery] string? category,
        [FromQuery] string? search, CancellationToken ct)
        => Ok(await _m.Send(new ListGeneralFinancialEntriesQuery(year, month, kind, category, search), ct));

    [HttpGet("rollup")]
    public async Task<ActionResult<IReadOnlyList<GeneralFinancialRollupRow>>> Rollup(
        [FromQuery] int year, [FromQuery] int? month, CancellationToken ct)
        => Ok(await _m.Send(new GeneralFinancialRollupQuery(year, month), ct));

    public record UpsertBody(
        string Kind, string Category, string? Subcategory,
        DateTime EntryDate, decimal Amount, string? Currency,
        string? Description, string? Counterparty, string? Reference,
        Guid? PolicyId, Guid? CustomerId, Guid? ProducerId);

    [HttpPost]
    public async Task<ActionResult<GeneralFinancialEntryDto>> Create(
        [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertGeneralFinancialEntryCommand(
            null, body.Kind, body.Category, body.Subcategory,
            body.EntryDate, body.Amount, body.Currency ?? "EUR",
            body.Description, body.Counterparty, body.Reference,
            body.PolicyId, body.CustomerId, body.ProducerId), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<GeneralFinancialEntryDto>> Update(
        Guid id, [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertGeneralFinancialEntryCommand(
            id, body.Kind, body.Category, body.Subcategory,
            body.EntryDate, body.Amount, body.Currency ?? "EUR",
            body.Description, body.Counterparty, body.Reference,
            body.PolicyId, body.CustomerId, body.ProducerId), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteGeneralFinancialEntryCommand(id), ct);
        return NoContent();
    }
}
