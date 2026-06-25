using Kalypsis.Application.Features.Customers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomersController(IMediator mediator) => _mediator = mediator;

    // GET is open to any authed user — the handler scopes Customer and Producer
    // roles to their own slice; AgencyStaff sees the full tenant.
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> List([FromQuery] string? search, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListCustomersQuery(search), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Get(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerQuery(id), ct));

    [HttpGet("{id:guid}/summary")]
    public async Task<ActionResult<CustomerSummaryDto>> Summary(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerSummaryQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<CreateCustomerResponse>> Create([FromBody] CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateCustomerCommand(request), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }
}
