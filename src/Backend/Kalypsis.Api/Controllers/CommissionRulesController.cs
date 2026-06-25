using Kalypsis.Application.Features.CommissionRules;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/commission-rules")]
[Authorize(Policy = "AgencyStaff")]
public class CommissionRulesController : ControllerBase
{
    private readonly IMediator _mediator;
    public CommissionRulesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CommissionRuleDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListCommissionRulesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CommissionRuleDto>> Create([FromBody] CommissionRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCommissionRuleCommand(body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CommissionRuleDto>> Update(Guid id, [FromBody] CommissionRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCommissionRuleCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCommissionRuleCommand(id), ct);
        return NoContent();
    }
}
