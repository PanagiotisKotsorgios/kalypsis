using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/policies")]
[Authorize]
public class PoliciesController : ControllerBase
{
    private readonly IMediator _mediator;
    public PoliciesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PolicyDto>>> List(
        [FromQuery] string? search,
        [FromQuery] PolicyStatus? status,
        [FromQuery] PolicyType? type,
        [FromQuery] Guid? customerId,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListPoliciesQuery(search, status, type, customerId), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PolicyDto>> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetPolicyQuery(id), cancellationToken));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Create(
        [FromBody] CreatePolicyBody body, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreatePolicyCommand(body), cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Update(
        Guid id, [FromBody] UpdatePolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new UpdatePolicyCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Cancel(
        Guid id, [FromBody] CancelPolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new CancelPolicyCommand(id, body), cancellationToken));

    [HttpPost("{id:guid}/renew")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDto>> Renew(
        Guid id, [FromBody] RenewPolicyBody body, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new RenewPolicyCommand(id, body), cancellationToken));
}

[ApiController]
[Route("api/insurance-companies")]
[Authorize]
public class InsuranceCompaniesController : ControllerBase
{
    private readonly IMediator _mediator;
    public InsuranceCompaniesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InsuranceCompanyDto>>> List(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListInsuranceCompaniesQuery(), cancellationToken));
}
