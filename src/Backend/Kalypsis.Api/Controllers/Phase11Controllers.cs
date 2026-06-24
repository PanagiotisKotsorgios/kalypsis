using Kalypsis.Application.Features.Phase11;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

// ============================================================================
// Phase 11 — Controllers for the remaining ALIS gap features.
// ============================================================================

[ApiController]
[Route("api/group-policies")]
[Authorize(Policy = "AgencyStaff")]
public class GroupPoliciesController : ControllerBase
{
    private readonly IMediator _mediator;
    public GroupPoliciesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GroupPolicyDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListGroupPoliciesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GroupPolicyDto>> Create([FromBody] GroupPolicyBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateGroupPolicyCommand(body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GroupPolicyDto>> Update(Guid id, [FromBody] GroupPolicyBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateGroupPolicyCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteGroupPolicyCommand(id), ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<GroupPolicyMemberDto>>> Members(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new ListGroupPolicyMembersQuery(id), ct));

    [HttpPost("members")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<GroupPolicyMemberDto>> AddMember([FromBody] GroupPolicyMemberBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new AddGroupPolicyMemberCommand(body), ct));

    [HttpDelete("members/{memberId:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> RemoveMember(Guid memberId, CancellationToken ct)
    {
        await _mediator.Send(new RemoveGroupPolicyMemberCommand(memberId), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/claim-provisions")]
[Authorize(Policy = "AgencyStaff")]
public class ClaimProvisionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ClaimProvisionsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClaimProvisionDto>>> List([FromQuery] Guid? claimId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListClaimProvisionsQuery(claimId), ct));

    [HttpPost]
    public async Task<ActionResult<ClaimProvisionDto>> Create([FromBody] ClaimProvisionBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateClaimProvisionCommand(body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteClaimProvisionCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/indemnities")]
[Authorize(Policy = "AgencyStaff")]
public class ClaimIndemnitiesController : ControllerBase
{
    private readonly IMediator _mediator;
    public ClaimIndemnitiesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClaimIndemnityDto>>> List([FromQuery] Guid? claimId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListClaimIndemnitiesQuery(claimId), ct));

    [HttpPost]
    public async Task<ActionResult<ClaimIndemnityDto>> Create([FromBody] ClaimIndemnityBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateClaimIndemnityCommand(body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteClaimIndemnityCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/garages")]
[Authorize(Policy = "AgencyStaff")]
public class GaragesController : ControllerBase
{
    private readonly IMediator _mediator;
    public GaragesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GarageDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListGaragesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GarageDto>> Create([FromBody] GarageBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateGarageCommand(body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GarageDto>> Update(Guid id, [FromBody] GarageBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateGarageCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteGarageCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/gl/accounts")]
[Authorize(Policy = "AgencyStaff")]
public class GlAccountsController : ControllerBase
{
    private readonly IMediator _mediator;
    public GlAccountsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GlAccountDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListGlAccountsQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GlAccountDto>> Create([FromBody] GlAccountBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateGlAccountCommand(body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<GlAccountDto>> Update(Guid id, [FromBody] GlAccountBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateGlAccountCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteGlAccountCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/gl/entries")]
[Authorize(Policy = "AgencyStaff")]
public class GlEntriesController : ControllerBase
{
    private readonly IMediator _mediator;
    public GlEntriesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GlEntryDto>>> List(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] Guid? accountId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListGlEntriesQuery(from, to, accountId), ct));

    [HttpPost]
    public async Task<ActionResult<GlEntryDto>> Create([FromBody] GlEntryBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateGlEntryCommand(body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteGlEntryCommand(id), ct);
        return NoContent();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<GlSummaryDto>> Summary(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
        => Ok(await _mediator.Send(new GetGlSummaryQuery(from, to), ct));
}

[ApiController]
[Route("api/cash/accounts")]
[Authorize(Policy = "AgencyStaff")]
public class CashAccountsController : ControllerBase
{
    private readonly IMediator _mediator;
    public CashAccountsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CashAccountDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListCashAccountsQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CashAccountDto>> Create([FromBody] CashAccountBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCashAccountCommand(body), ct));
}

[ApiController]
[Route("api/cash/movements")]
[Authorize(Policy = "AgencyStaff")]
public class CashMovementsController : ControllerBase
{
    private readonly IMediator _mediator;
    public CashMovementsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CashMovementDto>>> List(
        [FromQuery] Guid? cashAccountId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCashMovementsQuery(cashAccountId, from, to), ct));

    [HttpPost]
    public async Task<ActionResult<CashMovementDto>> Create([FromBody] CashMovementBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCashMovementCommand(body), ct));
}

[ApiController]
[Route("api/name-days")]
[Authorize(Policy = "AgencyStaff")]
public class NameDaysController : ControllerBase
{
    private readonly IMediator _mediator;
    public NameDaysController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NameDayDto>>> List([FromQuery] int? month, CancellationToken ct)
        => Ok(await _mediator.Send(new ListNameDaysQuery(month), ct));

    [HttpGet("celebrating")]
    public async Task<ActionResult<IReadOnlyList<TodaysCelebratingCustomersDto>>> Today(
        [FromQuery] int? day, [FromQuery] int? month, CancellationToken ct)
        => Ok(await _mediator.Send(new GetTodaysCelebrantsQuery(day, month), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<NameDayDto>> Create([FromBody] NameDayBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateNameDayCommand(body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteNameDayCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/mydata/submissions")]
[Authorize(Policy = "AgencyStaff")]
public class MyDataSubmissionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public MyDataSubmissionsController(IMediator mediator) => _mediator = mediator;

    public record MarkBody(string Status, string? AadeMark, string? AadeUid, string? ErrorMessage);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MyDataSubmissionDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListMyDataSubmissionsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<MyDataSubmissionDto>> Create([FromBody] MyDataSubmissionBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateMyDataSubmissionCommand(body), ct));

    [HttpPost("{id:guid}/mark")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<MyDataSubmissionDto>> Mark(Guid id, [FromBody] MarkBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new MarkMyDataSubmissionCommand(id, body.Status, body.AadeMark, body.AadeUid, body.ErrorMessage), ct));
}

[ApiController]
[Route("api/document-templates")]
[Authorize(Policy = "AgencyStaff")]
public class DocumentTemplatesController : ControllerBase
{
    private readonly IMediator _mediator;
    public DocumentTemplatesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentTemplateDto>>> List([FromQuery] string? kind, CancellationToken ct)
        => Ok(await _mediator.Send(new ListDocumentTemplatesQuery(kind), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DocumentTemplateDto>> Create([FromBody] DocumentTemplateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDocumentTemplateCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DocumentTemplateDto>> Update(Guid id, [FromBody] DocumentTemplateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDocumentTemplateCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteDocumentTemplateCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/numbering")]
[Authorize(Policy = "AgencyStaff")]
public class DocumentNumberingController : ControllerBase
{
    private readonly IMediator _mediator;
    public DocumentNumberingController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentNumberingRuleDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListDocumentNumberingRulesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DocumentNumberingRuleDto>> Create([FromBody] DocumentNumberingRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDocumentNumberingRuleCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DocumentNumberingRuleDto>> Update(Guid id, [FromBody] DocumentNumberingRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveDocumentNumberingRuleCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteDocumentNumberingRuleCommand(id), ct);
        return NoContent();
    }
}
