using Kalypsis.Application.Features.Phase13;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/integration-settings")]
[Authorize(Policy = "AgencyAdmin")]
public class IntegrationSettingsController : ControllerBase
{
    private readonly IMediator _mediator;
    public IntegrationSettingsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<IntegrationSettingDto>>> List([FromQuery] string? service, CancellationToken ct)
        => Ok(await _mediator.Send(new ListIntegrationSettingsQuery(service), ct));

    [HttpPost]
    public async Task<ActionResult<IntegrationSettingDto>> Save([FromBody] IntegrationSettingBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveIntegrationSettingCommand(body), ct));
}

[ApiController]
[Route("api/custom-fields")]
[Authorize(Policy = "AgencyStaff")]
public class CustomFieldsController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomFieldsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("definitions")]
    public async Task<ActionResult<IReadOnlyList<CustomFieldDefDto>>> Definitions([FromQuery] string entityType, CancellationToken ct)
        => Ok(await _mediator.Send(new ListCustomFieldDefsQuery(entityType), ct));

    [HttpPost("definitions")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CustomFieldDefDto>> CreateDef([FromBody] CustomFieldDefBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveCustomFieldDefCommand(null, body), ct));

    [HttpPut("definitions/{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CustomFieldDefDto>> UpdateDef(Guid id, [FromBody] CustomFieldDefBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveCustomFieldDefCommand(id, body), ct));

    [HttpDelete("definitions/{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> DeleteDef(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCustomFieldDefCommand(id), ct);
        return NoContent();
    }

    [HttpGet("values")]
    public async Task<ActionResult<IReadOnlyList<CustomFieldValueDto>>> Values(
        [FromQuery] string entityType, [FromQuery] Guid entityId, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomFieldValuesQuery(entityType, entityId), ct));

    [HttpPost("values")]
    public async Task<IActionResult> Set([FromBody] SetCustomFieldValueBody body, CancellationToken ct)
    {
        await _mediator.Send(new SetCustomFieldValueCommand(body), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/movement-types")]
[Authorize(Policy = "AgencyStaff")]
public class MovementTypesController : ControllerBase
{
    private readonly IMediator _mediator;
    public MovementTypesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MovementTypeDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListMovementTypesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<MovementTypeDto>> Create([FromBody] MovementTypeBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveMovementTypeCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<MovementTypeDto>> Update(Guid id, [FromBody] MovementTypeBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveMovementTypeCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteMovementTypeCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/bonus-malus")]
[Authorize(Policy = "AgencyStaff")]
public class BonusMalusController : ControllerBase
{
    private readonly IMediator _mediator;
    public BonusMalusController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BonusMalusRuleDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListBonusMalusRulesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BonusMalusRuleDto>> Create([FromBody] BonusMalusRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveBonusMalusRuleCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BonusMalusRuleDto>> Update(Guid id, [FromBody] BonusMalusRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveBonusMalusRuleCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteBonusMalusRuleCommand(id), ct);
        return NoContent();
    }

    [HttpGet("evaluate/{policyId:guid}")]
    public async Task<ActionResult<EvaluateBonusMalusResult>> Evaluate(Guid policyId, CancellationToken ct)
        => Ok(await _mediator.Send(new EvaluateBonusMalusCommand(policyId), ct));
}

[ApiController]
[Route("api/renewal-rules")]
[Authorize(Policy = "AgencyStaff")]
public class RenewalRulesController : ControllerBase
{
    private readonly IMediator _mediator;
    public RenewalRulesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RenewalRuleDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListRenewalRulesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RenewalRuleDto>> Create([FromBody] RenewalRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveRenewalRuleCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RenewalRuleDto>> Update(Guid id, [FromBody] RenewalRuleBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveRenewalRuleCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteRenewalRuleCommand(id), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/register-templates")]
[Authorize(Policy = "AgencyStaff")]
public class RegisterTemplatesController : ControllerBase
{
    private readonly IMediator _mediator;
    public RegisterTemplatesController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RegisterTemplateDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListRegisterTemplatesQuery(), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RegisterTemplateDto>> Create([FromBody] RegisterTemplateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveRegisterTemplateCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<RegisterTemplateDto>> Update(Guid id, [FromBody] RegisterTemplateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveRegisterTemplateCommand(id, body), ct));
}

[ApiController]
[Route("api/advance-payments")]
[Authorize(Policy = "AgencyStaff")]
public class AdvancePaymentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public AdvancePaymentsController(IMediator mediator) => _mediator = mediator;

    public record AllocateBody(Guid PolicyId, decimal Amount);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdvancePaymentDto>>> List(
        [FromQuery] string? status, [FromQuery] string? partyType, CancellationToken ct)
        => Ok(await _mediator.Send(new ListAdvancePaymentsQuery(status, partyType), ct));

    [HttpPost]
    public async Task<ActionResult<AdvancePaymentDto>> Create([FromBody] AdvancePaymentBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateAdvancePaymentCommand(body), ct));

    [HttpPost("{id:guid}/allocate")]
    public async Task<ActionResult<AdvancePaymentDto>> Allocate(Guid id, [FromBody] AllocateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new AllocateAdvanceCommand(id, body.PolicyId, body.Amount), ct));
}

[ApiController]
[Route("api/reconciliation")]
[Authorize(Policy = "AgencyStaff")]
public class ReconciliationController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReconciliationController(IMediator mediator) => _mediator = mediator;

    [HttpGet("unmatched")]
    public async Task<ActionResult<UnmatchedDto>> Unmatched(CancellationToken ct)
        => Ok(await _mediator.Send(new GetUnmatchedQuery(), ct));

    [HttpPost("link")]
    public async Task<IActionResult> Link([FromBody] LinkReconciliationBody body, CancellationToken ct)
    {
        await _mediator.Send(new LinkReconciliationCommand(body), ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/tachypayments")]
[Authorize(Policy = "AgencyStaff")]
public class TachyPaymentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public TachyPaymentsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TachyBatchDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListTachyBatchesQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<TachyBatchDto>> Create([FromBody] CreateTachyBatchBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateTachyBatchCommand(body), ct));

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Export(Guid id, CancellationToken ct)
    {
        var bytes = await _mediator.Send(new ExportTachyBatchCommand(id), ct);
        return File(bytes, "text/csv", $"tachy-{id}.csv");
    }
}

[ApiController]
[Route("api/contact-export")]
[Authorize(Policy = "AgencyStaff")]
public class ContactExportController : ControllerBase
{
    private readonly IMediator _mediator;
    public ContactExportController(IMediator mediator) => _mediator = mediator;

    [HttpGet("{entityType}/{entityId:guid}.{format}")]
    public async Task<IActionResult> Export(string entityType, Guid entityId, string format, CancellationToken ct)
    {
        var bytes = await _mediator.Send(new ExportContactCommand(entityType, entityId, format), ct);
        var mime = format switch { "vCard" => "text/vcard", "Csv" => "text/csv", _ => "text/plain" };
        var ext = format switch { "vCard" => "vcf", "Csv" => "csv", _ => "txt" };
        return File(bytes, mime, $"contact-{entityId}.{ext}");
    }
}

[ApiController]
[Route("api/editable-documents")]
[Authorize(Policy = "AgencyStaff")]
public class EditableDocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    public EditableDocumentsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EditableDocumentDto>>> List(
        [FromQuery] string entityType, [FromQuery] Guid entityId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListEditableDocumentsQuery(entityType, entityId), ct));

    [HttpPost]
    public async Task<ActionResult<EditableDocumentDto>> Create([FromBody] CreateEditableDocumentBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateEditableDocumentCommand(body), ct));
}

[ApiController]
[Route("api/info-center")]
[Authorize(Policy = "AgencyAdmin")]
public class InfoCenterController : ControllerBase
{
    private readonly IMediator _mediator;
    public InfoCenterController(IMediator mediator) => _mediator = mediator;

    public record CreateBody(string Kind);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InfoCenterExportDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListInfoCenterExportsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<InfoCenterExportDto>> Create([FromBody] CreateBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateInfoCenterExportCommand(body.Kind), ct));
}

[ApiController]
[Route("api/sap-bridge")]
[Authorize(Policy = "AgencyAdmin")]
public class SapBridgeController : ControllerBase
{
    private readonly IMediator _mediator;
    public SapBridgeController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SapBridgeMappingDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListSapBridgeMappingsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<SapBridgeMappingDto>> Create([FromBody] SapBridgeMappingBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveSapBridgeMappingCommand(null, body), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SapBridgeMappingDto>> Update(Guid id, [FromBody] SapBridgeMappingBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SaveSapBridgeMappingCommand(id, body), ct));
}

[ApiController]
[Route("api/period-locks")]
[Authorize(Policy = "AgencyAdmin")]
public class PeriodLocksController : ControllerBase
{
    private readonly IMediator _mediator;
    public PeriodLocksController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PeriodLockDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListPeriodLocksQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<PeriodLockDto>> Save([FromBody] PeriodLockBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SavePeriodLockCommand(body), ct));
}

[ApiController]
[Route("api/reports")]
[Authorize(Policy = "AgencyStaff")]
public class NamedReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public NamedReportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("4500")]
    public async Task<ActionResult<IReadOnlyList<CustomerDirectoryRowDto>>> Report4500(
        [FromQuery] int? month, [FromQuery] int? day, [FromQuery] string? name, CancellationToken ct)
        => Ok(await _mediator.Send(new Report4500Query(month, day, name), ct));

    [HttpGet("507")]
    public async Task<ActionResult<IReadOnlyList<UnpaidPolicyRowDto>>> Report507(
        [FromQuery] int? maxDaysOverdue, CancellationToken ct)
        => Ok(await _mediator.Send(new Report507Query(maxDaysOverdue), ct));

    [HttpGet("506")]
    public async Task<ActionResult<IReadOnlyList<CustomerAgingRow>>> Report506(CancellationToken ct)
        => Ok(await _mediator.Send(new Report506Query(), ct));

    [HttpGet("610")]
    public async Task<ActionResult<IReadOnlyList<CarrierAgingRow>>> Report610(CancellationToken ct)
        => Ok(await _mediator.Send(new Report610Query(), ct));
}
