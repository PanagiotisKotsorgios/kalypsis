using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

/// <summary>Driver-license fields on a customer — needed for Auto policies.</summary>
[ApiController]
[Route("api/customers/{customerId:guid}/driver-license")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerDriverLicenseController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public CustomerDriverLicenseController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record DriverLicenseDto(string? Number, string? Class, DateOnly? IssueDate, DateOnly? ExpiryDate);

    [HttpGet]
    public async Task<ActionResult<DriverLicenseDto>> Get(Guid customerId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        return Ok(new DriverLicenseDto(c.DriverLicenseNumber, c.DriverLicenseClass,
            c.DriverLicenseIssueDate, c.DriverLicenseExpiryDate));
    }

    [HttpPut]
    public async Task<ActionResult<DriverLicenseDto>> Update(Guid customerId, [FromBody] DriverLicenseDto body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        c.DriverLicenseNumber = body.Number?.Trim();
        c.DriverLicenseClass = body.Class?.Trim();
        c.DriverLicenseIssueDate = body.IssueDate;
        c.DriverLicenseExpiryDate = body.ExpiryDate;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new DriverLicenseDto(c.DriverLicenseNumber, c.DriverLicenseClass,
            c.DriverLicenseIssueDate, c.DriverLicenseExpiryDate));
    }
}
