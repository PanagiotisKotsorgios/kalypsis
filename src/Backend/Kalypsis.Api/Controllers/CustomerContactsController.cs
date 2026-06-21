using Kalypsis.Application.Features.Customers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/customers/{customerId:guid}/contacts")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerContactsController : ControllerBase
{
    private readonly IMediator _m;
    public CustomerContactsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerContactDto>>> List(Guid customerId, CancellationToken ct)
        => Ok(await _m.Send(new ListContactsQuery(customerId), ct));

    [HttpPost]
    public async Task<ActionResult<CustomerContactDto>> Create(Guid customerId, [FromBody] UpsertCustomerContactBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateContactCommand(customerId, body), ct));

    [HttpPut("{contactId:guid}")]
    public async Task<ActionResult<CustomerContactDto>> Update(Guid customerId, Guid contactId, [FromBody] UpsertCustomerContactBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdateContactCommand(customerId, contactId, body), ct));

    [HttpDelete("{contactId:guid}")]
    public async Task<ActionResult> Delete(Guid customerId, Guid contactId, CancellationToken ct)
    {
        await _m.Send(new DeleteContactCommand(customerId, contactId), ct);
        return NoContent();
    }
}
