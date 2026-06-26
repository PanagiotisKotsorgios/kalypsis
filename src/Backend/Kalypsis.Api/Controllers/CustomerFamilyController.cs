using Kalypsis.Application.Features.Customers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>Family graph, customer assets and insurance opportunities.</summary>
[ApiController]
[Route("api/customers/{customerId:guid}/family")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerFamilyController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomerFamilyController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<CustomerFamilyProfileDto>> Get(Guid customerId, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerFamilyProfileQuery(customerId), ct));

    [HttpPut("profile")]
    public async Task<ActionResult<CustomerProfileDto>> UpdateProfile(Guid customerId, [FromBody] CustomerProfileBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerProfileCommand(customerId, body), ct));

    [HttpPost("relationships")]
    public async Task<ActionResult<CustomerFamilyMemberDto>> CreateRelationship(Guid customerId, [FromBody] CustomerRelationshipBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCustomerRelationshipCommand(customerId, body), ct));

    [HttpPut("relationships/{relationshipId:guid}")]
    public async Task<ActionResult<CustomerFamilyMemberDto>> UpdateRelationship(Guid customerId, Guid relationshipId, [FromBody] UpdateCustomerRelationshipBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerRelationshipCommand(customerId, relationshipId, body), ct));

    [HttpDelete("relationships/{relationshipId:guid}")]
    public async Task<IActionResult> DeleteRelationship(Guid customerId, Guid relationshipId, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCustomerRelationshipCommand(customerId, relationshipId), ct);
        return NoContent();
    }

    [HttpPost("needs")]
    public async Task<ActionResult<CustomerNeedDto>> CreateNeed(Guid customerId, [FromBody] CustomerNeedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCustomerNeedCommand(customerId, body), ct));

    [HttpPut("needs/{needId:guid}")]
    public async Task<ActionResult<CustomerNeedDto>> UpdateNeed(Guid customerId, Guid needId, [FromBody] CustomerNeedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerNeedCommand(customerId, needId, body), ct));

    [HttpDelete("needs/{needId:guid}")]
    public async Task<IActionResult> DeleteNeed(Guid customerId, Guid needId, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCustomerNeedCommand(customerId, needId), ct);
        return NoContent();
    }
}
