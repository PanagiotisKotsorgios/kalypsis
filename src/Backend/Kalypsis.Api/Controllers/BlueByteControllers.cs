using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Appointments;
using Kalypsis.Application.Features.Branches;
using Kalypsis.Application.Features.CoverNotes;
using Kalypsis.Application.Features.Financials;
using Kalypsis.Application.Features.Integrations;
using Kalypsis.Application.Features.Marketing;
using Kalypsis.Application.Features.Operations;
using Kalypsis.Application.Features.Production;
using Kalypsis.Application.Features.Tariffs;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public class AppointmentsController : ControllerBase
{
    private readonly IMediator _m;
    public AppointmentsController(IMediator m) => _m = m;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AppointmentDto>>> List(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] Guid? userId, [FromQuery] Guid? customerId, CancellationToken ct)
        => Ok(await _m.Send(new ListAppointmentsQuery(from, to, userId, customerId), ct));

    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> Create([FromBody] AppointmentBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateAppointmentCommand(body), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> Update(Guid id, [FromBody] AppointmentBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdateAppointmentCommand(id, body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { await _m.Send(new DeleteAppointmentCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/tariffs")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class TariffsController : ControllerBase
{
    private readonly IMediator _m; public TariffsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<TariffDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListTariffsQuery(), ct));
    [HttpPost] public async Task<ActionResult<TariffDto>> Create([FromBody] TariffBody body, CancellationToken ct) => Ok(await _m.Send(new CreateTariffCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<TariffDto>> Update(Guid id, [FromBody] TariffBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateTariffCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteTariffCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/cover-notes")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.FrontOffice)]
public class CoverNotesController : ControllerBase
{
    private readonly IMediator _m; public CoverNotesController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<CoverNoteDto>>> List([FromQuery] CoverNoteStatus? status, CancellationToken ct) => Ok(await _m.Send(new ListCoverNotesQuery(status), ct));
    [HttpPost] public async Task<ActionResult<CoverNoteDto>> Create([FromBody] CoverNoteBody body, CancellationToken ct) => Ok(await _m.Send(new CreateCoverNoteCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<CoverNoteDto>> Update(Guid id, [FromBody] CoverNoteBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateCoverNoteCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteCoverNoteCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/branches")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class BranchesController : ControllerBase
{
    private readonly IMediator _m; public BranchesController(IMediator m) => _m = m;
    [HttpGet] [AllowAnonymous] public async Task<ActionResult<IReadOnlyList<BranchDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListBranchesQuery(), ct));
    [HttpPost] public async Task<ActionResult<BranchDto>> Create([FromBody] BranchBody body, CancellationToken ct) => Ok(await _m.Send(new CreateBranchCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<BranchDto>> Update(Guid id, [FromBody] BranchBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateBranchCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteBranchCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/receipts")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class ReceiptsController : ControllerBase
{
    private readonly IMediator _m; public ReceiptsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<ReceiptDto>>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] Guid? customerId, CancellationToken ct)
        => Ok(await _m.Send(new ListReceiptsQuery(from, to, customerId), ct));
    [HttpPost] public async Task<ActionResult<ReceiptDto>> Create([FromBody] ReceiptBody body, CancellationToken ct) => Ok(await _m.Send(new CreateReceiptCommand(body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteReceiptCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/payments")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class PaymentsController : ControllerBase
{
    private readonly IMediator _m; public PaymentsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<PaymentDto>>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] BeneficiaryType? type, CancellationToken ct)
        => Ok(await _m.Send(new ListPaymentsQuery(from, to, type), ct));
    [HttpPost] public async Task<ActionResult<PaymentDto>> Create([FromBody] PaymentBody body, CancellationToken ct) => Ok(await _m.Send(new CreatePaymentCommand(body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeletePaymentCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/securities")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class SecuritiesController : ControllerBase
{
    private readonly IMediator _m; public SecuritiesController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<SecurityDto>>> List([FromQuery] SecurityStatus? status, CancellationToken ct) => Ok(await _m.Send(new ListSecuritiesQuery(status), ct));
    [HttpPost] public async Task<ActionResult<SecurityDto>> Create([FromBody] SecurityBody body, CancellationToken ct) => Ok(await _m.Send(new CreateSecurityCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<SecurityDto>> Update(Guid id, [FromBody] SecurityBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateSecurityCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteSecurityCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/financial-movements")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
public class FinancialMovementsController : ControllerBase
{
    private readonly IMediator _m; public FinancialMovementsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<FinancialMovementDto>>> List(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] FinancialMovementKind? kind,
        [FromQuery] Guid? customerId, [FromQuery] Guid? producerId, [FromQuery] Guid? insuranceCompanyId,
        CancellationToken ct)
        => Ok(await _m.Send(new ListFinancialMovementsQuery(from, to, kind, customerId, producerId, insuranceCompanyId), ct));

    [HttpGet("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Summary([FromQuery] int year, CancellationToken ct)
        => Ok(await _m.Send(new GetFinancialSummaryQuery(year), ct));
}

[ApiController]
[Route("api/bank-connections")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class BankConnectionsController : ControllerBase
{
    private readonly IMediator _m; public BankConnectionsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<BankConnectionDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListBankConnectionsQuery(), ct));
    [HttpPost] public async Task<ActionResult<BankConnectionDto>> Create([FromBody] BankConnectionBody body, CancellationToken ct) => Ok(await _m.Send(new CreateBankConnectionCommand(body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<BankConnectionDto>> Update(Guid id, [FromBody] BankConnectionBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateBankConnectionCommand(id, body), ct));
    [HttpPost("{id:guid}/sync")] public async Task<ActionResult<BankConnectionDto>> Sync(Guid id, CancellationToken ct) => Ok(await _m.Send(new SyncBankConnectionCommand(id), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteBankConnectionCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/marketing-campaigns")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public class MarketingCampaignsController : ControllerBase
{
    private readonly IMediator _m; public MarketingCampaignsController(IMediator m) => _m = m;
    [HttpGet] [RequirePermission("marketing.read")] public async Task<ActionResult<IReadOnlyList<MarketingCampaignDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListMarketingCampaignsQuery(), ct));
    [HttpPost] [RequirePermission("marketing.write")] public async Task<ActionResult<MarketingCampaignDto>> Create([FromBody] MarketingCampaignBody body, CancellationToken ct) => Ok(await _m.Send(new CreateMarketingCampaignCommand(body), ct));
    [HttpPut("{id:guid}")] [RequirePermission("marketing.write")] public async Task<ActionResult<MarketingCampaignDto>> Update(Guid id, [FromBody] MarketingCampaignBody body, CancellationToken ct) => Ok(await _m.Send(new UpdateMarketingCampaignCommand(id, body), ct));
    [HttpPost("{id:guid}/send")] [RequirePermission("marketing.send")] public async Task<ActionResult<MarketingCampaignDto>> Send(Guid id, CancellationToken ct) => Ok(await _m.Send(new SendMarketingCampaignCommand(id), ct));
    [HttpDelete("{id:guid}")] [RequirePermission("marketing.write")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteMarketingCampaignCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/delivery-records")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public class DeliveryRecordsController : ControllerBase
{
    private readonly IMediator _m; public DeliveryRecordsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<DeliveryRecordDto>>> List([FromQuery] DeliveryStatus? status, CancellationToken ct) => Ok(await _m.Send(new ListDeliveryRecordsQuery(status), ct));
    [HttpPost] public async Task<ActionResult<DeliveryRecordDto>> Upsert([FromBody] DeliveryRecordBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertDeliveryRecordCommand(null, body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<DeliveryRecordDto>> Update(Guid id, [FromBody] DeliveryRecordBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertDeliveryRecordCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteDeliveryRecordCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/document-folders")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Crm)]
public class DocumentFoldersController : ControllerBase
{
    private readonly IMediator _m; public DocumentFoldersController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<DocumentFolderDto>>> List([FromQuery] Guid? customerId, CancellationToken ct) => Ok(await _m.Send(new ListDocumentFoldersQuery(customerId), ct));
    [HttpPost] public async Task<ActionResult<Guid>> Create([FromBody] DocumentFolderBody body, CancellationToken ct) => Ok(await _m.Send(new CreateDocumentFolderCommand(body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteDocumentFolderCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/partner-portal-accesses")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class PartnerPortalAccessesController : ControllerBase
{
    private readonly IMediator _m; public PartnerPortalAccessesController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<PartnerPortalAccessDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListPartnerPortalAccessesQuery(), ct));
    [HttpPost] public async Task<ActionResult<PartnerPortalAccessDto>> Upsert([FromBody] PartnerPortalAccessBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertPartnerPortalAccessCommand(null, body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<PartnerPortalAccessDto>> Update(Guid id, [FromBody] PartnerPortalAccessBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertPartnerPortalAccessCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeletePartnerPortalAccessCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/api-keys")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.Integrations)]
public class ApiKeysController : ControllerBase
{
    private readonly IMediator _m; public ApiKeysController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<ApiKeyDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListApiKeysQuery(), ct));
    [HttpPost] public async Task<ActionResult<CreateApiKeyResponse>> Create([FromBody] ApiKeyBody body, CancellationToken ct) => Ok(await _m.Send(new CreateApiKeyCommand(body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Revoke(Guid id, CancellationToken ct) { await _m.Send(new RevokeApiKeyCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/dias-codes")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Integrations)]
public class DiasCodesController : ControllerBase
{
    private readonly IMediator _m; public DiasCodesController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<DiasCodeDto>>> List([FromQuery] DiasPaymentStatus? status, CancellationToken ct) => Ok(await _m.Send(new ListDiasCodesQuery(status), ct));
    [HttpPost] public async Task<ActionResult<DiasCodeDto>> Create([FromBody] DiasCodeBody body, CancellationToken ct) => Ok(await _m.Send(new CreateDiasCodeCommand(body), ct));
    [HttpPost("{id:guid}/mark-paid")] public async Task<ActionResult<DiasCodeDto>> MarkPaid(Guid id, [FromBody] MarkDiasPaidBody body, CancellationToken ct) => Ok(await _m.Send(new MarkDiasCodePaidCommand(id, body.BankReference), ct));
    public record MarkDiasPaidBody(string? BankReference);
}

[ApiController]
[Route("api/accounting-exports")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.BackOffice)]
public class AccountingExportsController : ControllerBase
{
    private readonly IMediator _m; public AccountingExportsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<AccountingExportDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListAccountingExportsQuery(), ct));
    [HttpPost] public async Task<ActionResult<AccountingExportDto>> Run([FromBody] RunAccountingExportBody body, CancellationToken ct) => Ok(await _m.Send(new RunAccountingExportCommand(body.Year, body.Month), ct));
    public record RunAccountingExportBody(int Year, int Month);
}

[ApiController]
[Route("api/kepyo-reports")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.BackOffice)]
public class KepyoReportsController : ControllerBase
{
    private readonly IMediator _m; public KepyoReportsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<KepyoReportDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListKepyoReportsQuery(), ct));
    [HttpPost] public async Task<ActionResult<KepyoReportDto>> Run([FromBody] RunKepyoBody body, CancellationToken ct) => Ok(await _m.Send(new RunKepyoCommand(body.Year), ct));
    public record RunKepyoBody(int Year);
}

[ApiController]
[Route("api/magnetic-imports")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.BackOffice)]
public class MagneticImportsController : ControllerBase
{
    private readonly IMediator _m; public MagneticImportsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<MagneticImportDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListMagneticImportsQuery(), ct));
    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<MagneticImportDto>> Upload(IFormFile file, [FromForm] string source, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { code = "validation", message = "Δεν επιλέξατε αρχείο." });
        await using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        var rows = 0;
        while (await reader.ReadLineAsync(ct) is not null) rows++;
        var result = await _m.Send(new CreateMagneticImportCommand(file.FileName, source ?? "—", rows), ct);
        return Ok(result);
    }
}

[ApiController]
[Route("api/over-commission-rules")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(PackageCode.BackOffice)]
public class OverCommissionRulesController : ControllerBase
{
    private readonly IMediator _m; public OverCommissionRulesController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<OverCommissionRuleDto>>> List(CancellationToken ct) => Ok(await _m.Send(new ListOverCommissionRulesQuery(), ct));
    [HttpPost] public async Task<ActionResult<Guid>> Upsert([FromBody] OverCommissionRuleBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertOverCommissionRuleCommand(null, body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<Guid>> Update(Guid id, [FromBody] OverCommissionRuleBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertOverCommissionRuleCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteOverCommissionRuleCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/production-goals")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public class ProductionGoalsController : ControllerBase
{
    private readonly IMediator _m; public ProductionGoalsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<IReadOnlyList<ProductionGoalDto>>> List([FromQuery] int? year, CancellationToken ct) => Ok(await _m.Send(new ListProductionGoalsQuery(year), ct));
    [HttpPost] public async Task<ActionResult<Guid>> Upsert([FromBody] ProductionGoalBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertProductionGoalCommand(null, body), ct));
    [HttpPut("{id:guid}")] public async Task<ActionResult<Guid>> Update(Guid id, [FromBody] ProductionGoalBody body, CancellationToken ct) => Ok(await _m.Send(new UpsertProductionGoalCommand(id, body), ct));
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) { await _m.Send(new DeleteProductionGoalCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/production-stats")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Intelligence)]
public class ProductionStatsController : ControllerBase
{
    private readonly IMediator _m; public ProductionStatsController(IMediator m) => _m = m;
    [HttpGet] public async Task<ActionResult<ProductionStatsDto>> Get([FromQuery] int year, CancellationToken ct) => Ok(await _m.Send(new GetProductionStatsQuery(year), ct));
}
