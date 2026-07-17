using Kalypsis.Application.Features.PlatformContractors;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/contractors")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformContractorsController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformContractorsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContractorDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListContractorsQuery(), ct));

    public record UpsertBody(string Name, string Email, string? Phone, string? AfmVat, bool Active, string? Notes);

    [HttpPost]
    public async Task<ActionResult<ContractorDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertContractorCommand(
            null, body.Name, body.Email, body.Phone, body.AfmVat, body.Active, body.Notes), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ContractorDto>> Update(Guid id, [FromBody] UpsertBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertContractorCommand(
            id, body.Name, body.Email, body.Phone, body.AfmVat, body.Active, body.Notes), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteContractorCommand(id), ct);
        return NoContent();
    }

    /* ---- Assignments ---- */

    [HttpGet("assignments")]
    public async Task<ActionResult<IReadOnlyList<AssignmentDto>>> ListAssignments(CancellationToken ct)
        => Ok(await _m.Send(new ListAssignmentsQuery(), ct));

    public record AssignmentBody(
        Guid ContractorId, Guid TenantId,
        decimal MonthlyPrice, string Currency,
        DateTime StartedOn, DateTime? EndedOn, string? Notes,
        decimal? KalypsisCommissionPercent);

    [HttpPost("assignments")]
    public async Task<ActionResult<AssignmentDto>> CreateAssignment([FromBody] AssignmentBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertAssignmentCommand(
            null, body.ContractorId, body.TenantId,
            body.MonthlyPrice, body.Currency,
            body.StartedOn, body.EndedOn, body.Notes,
            body.KalypsisCommissionPercent ?? 0m), ct));

    [HttpPut("assignments/{id:guid}")]
    public async Task<ActionResult<AssignmentDto>> UpdateAssignment(Guid id, [FromBody] AssignmentBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertAssignmentCommand(
            id, body.ContractorId, body.TenantId,
            body.MonthlyPrice, body.Currency,
            body.StartedOn, body.EndedOn, body.Notes,
            body.KalypsisCommissionPercent ?? 0m), ct));

    [HttpDelete("assignments/{id:guid}")]
    public async Task<IActionResult> DeleteAssignment(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteAssignmentCommand(id), ct);
        return NoContent();
    }
}
