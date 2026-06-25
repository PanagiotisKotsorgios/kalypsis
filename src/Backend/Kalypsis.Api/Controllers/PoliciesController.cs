using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet("{id:guid}/detail")]
    public async Task<ActionResult<PolicyDetailDto>> Detail(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetPolicyDetailQuery(id), ct));

    [HttpPut("{id:guid}/extended")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<PolicyDetailDto>> UpdateExtended(
        Guid id, [FromBody] UpdatePolicyExtendedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdatePolicyExtendedCommand(id, body), ct));

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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DeletePolicyResultDto>> Delete(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new DeletePolicyCommand(id), ct));

    [HttpGet("{id:guid}/payment-summary")]
    public async Task<ActionResult<PolicyPaymentSummaryDto>> PaymentSummary(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetPolicyPaymentSummaryQuery(id), ct));
}

[ApiController]
[Route("api/insurance-companies")]
[Authorize]
public class InsuranceCompaniesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly Kalypsis.Infrastructure.Persistence.AppDbContext _db;
    private readonly Kalypsis.Application.Abstractions.ICurrentUser _current;
    private readonly Kalypsis.Application.Abstractions.IDateTimeProvider _clock;

    public InsuranceCompaniesController(
        IMediator mediator,
        Kalypsis.Infrastructure.Persistence.AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
    { _mediator = mediator; _db = db; _current = current; _clock = clock; }

    public record InsuranceCompanyExtendedDto(
        Guid Id, string Name, string Code, string? Country, string? Website, bool IsActive,
        Guid? TenantId, bool IsGlobal,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes);

    public record UpsertCompanyBody(
        string Name, string Code, string? Country, string? Website, bool IsActive,
        string? AgentCode, string? ContactName, string? ContactEmail, string? ContactPhone,
        string? AfmVat, string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InsuranceCompanyExtendedDto>>> List(CancellationToken ct)
    {
        var tenantId = _current.TenantId;
        var rows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .ToListAsync(_db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId))
                .OrderBy(c => c.TenantId == null ? 0 : 1)
                .ThenBy(c => c.Name), ct);
        return Ok(rows.Select(c => new InsuranceCompanyExtendedDto(
            c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, c.TenantId == null,
            c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes)).ToList());
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<InsuranceCompanyExtendedDto>> Create([FromBody] UpsertCompanyBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId
            ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var c = new Kalypsis.Domain.Entities.InsuranceCompany
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = body.Name.Trim(),
            Code = body.Code.Trim().ToUpperInvariant(),
            Country = body.Country,
            Website = body.Website,
            IsActive = body.IsActive,
            AgentCode = body.AgentCode,
            ContactName = body.ContactName,
            ContactEmail = body.ContactEmail,
            ContactPhone = body.ContactPhone,
            AfmVat = body.AfmVat,
            Notes = body.Notes,
            CreatedAt = _clock.UtcNow
        };
        _db.InsuranceCompanies.Add(c);
        await _db.SaveChangesAsync(ct);
        return Ok(new InsuranceCompanyExtendedDto(c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, false, c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<InsuranceCompanyExtendedDto>> Update(Guid id, [FromBody] UpsertCompanyBody body, CancellationToken ct)
    {
        var c = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.Id == id), ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        // Only tenant-owned rows may be edited via this endpoint. Global carriers
        // are managed by PlatformAdmin via the platform settings.
        if (c.TenantId == null || c.TenantId != _current.TenantId)
            return Forbid();
        c.Name = body.Name.Trim();
        c.Code = body.Code.Trim().ToUpperInvariant();
        c.Country = body.Country; c.Website = body.Website; c.IsActive = body.IsActive;
        c.AgentCode = body.AgentCode; c.ContactName = body.ContactName;
        c.ContactEmail = body.ContactEmail; c.ContactPhone = body.ContactPhone;
        c.AfmVat = body.AfmVat; c.Notes = body.Notes;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new InsuranceCompanyExtendedDto(c.Id, c.Name, c.Code, c.Country, c.Website, c.IsActive,
            c.TenantId, false, c.AgentCode, c.ContactName, c.ContactEmail, c.ContactPhone, c.AfmVat, c.Notes));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .FirstOrDefaultAsync(_db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.Id == id), ct)
            ?? throw Kalypsis.Application.Common.AppException.NotFound("Ασφαλιστική");
        if (c.TenantId == null) return BadRequest(new { code = "global_company", message = "Δεν διαγράφεται καθολική ασφαλιστική." });
        if (c.TenantId != _current.TenantId) return Forbid();
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
