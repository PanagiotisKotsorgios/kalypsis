using Kalypsis.Application.Features.ClaimInvolvedParties;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.Producers;
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
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> List(
        [FromQuery] string? search,
        [FromQuery] string? occupation,
        [FromQuery] string? needKind,
        [FromQuery] bool? onlyUninsuredNeeds,
        CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new ListCustomersQuery(search, occupation, needKind, onlyUninsuredNeeds), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Get(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerQuery(id), ct));

    [HttpGet("{id:guid}/summary")]
    public async Task<ActionResult<CustomerSummaryDto>> Summary(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerSummaryQuery(id), ct));

    // Producers that have written policies for this customer. Reverse view of
    // /producers/{id}/customers — useful when investigating commission disputes.
    [HttpGet("{id:guid}/producers")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<IReadOnlyList<CustomerProducerLineDto>>> Producers(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCustomerProducersQuery(id), ct));

    // «Ζημιάδες Εμπλεκόμενοι» — everyone recorded on any claim tied to this
    // customer's policies. One row per party, joined with claim + policy
    // context so the frontend can group by claim without a second fetch.
    [HttpGet("{id:guid}/claim-involved-parties")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<IReadOnlyList<ClaimInvolvedPartyDto>>> ClaimInvolvedParties(
        Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new ListInvolvedPartiesByCustomerQuery(id), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<CreateCustomerResponse>> Create([FromBody] CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new CreateCustomerCommand(request), cancellationToken);
        return CreatedAtAction(nameof(List), null, result);
    }
}
