using Kalypsis.Application.Features.Phase14;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/default-value-rules")]
[Authorize(Policy = "AgencyStaff")]
public class DefaultValueRulesController : ControllerBase
{
    private readonly IMediator _mediator;
    public DefaultValueRulesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DefaultValueRuleDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListDefaultValueRulesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DefaultValueRuleDto>> Create([FromBody] DefaultValueRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDefaultValueRuleCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DefaultValueRuleDto>> Update(Guid id, [FromBody] DefaultValueRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDefaultValueRuleCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteDefaultValueRuleCommand(id), ct);
        return NoContent();
    }

    [HttpGet("evaluate")]
    public async Task<ActionResult<Dictionary<string, object?>>> Evaluate(
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] PolicyType? policyType,
        [FromQuery] string? coverCode, [FromQuery] string? packageCode, CancellationToken ct)
        => Ok(await _mediator.Send(new EvaluateDefaultsQuery(insuranceCompanyId, policyType, coverCode, packageCode), ct));
}

[ApiController]
[Route("api/bridge-runs")]
[Authorize(Policy = "AgencyStaff")]
public class BridgeRunsController : ControllerBase
{
    private readonly IMediator _mediator;
    public BridgeRunsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CompanyBridgeRunDto>>> List([FromQuery] Guid? bridgeId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListBridgeRunsQuery(bridgeId), ct));

    [HttpPost("import")]
    public async Task<ActionResult<CompanyBridgeRunDto>> Import(
        [FromForm] Guid bridgeId, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest("File required");
        using var reader = new StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync(ct);
        return Ok(await _mediator.Send(new RunBridgeImportCommand(bridgeId, file.FileName, content), ct));
    }
}
