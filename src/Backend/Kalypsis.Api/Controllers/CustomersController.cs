using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Policy = "AgencyStaff")]
public class CustomersController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> List([FromQuery] string? search, CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListCustomersQuery(search), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<CreateCustomerResponse>> Create([FromBody] CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateCustomerCommand(request), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }
}
