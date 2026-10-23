using Kalypsis.Api.Authorization;
using Kalypsis.Application.Features.Financials;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/carrier-commissions")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice)]
[RequirePermission("financials.read")]
public class CarrierCommissionsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CarrierCommissionBalanceDto>>> List(CancellationToken ct) =>
        Ok(await mediator.Send(new ListCarrierCommissionBalancesQuery(), ct));

    [HttpGet("{policyId:guid}/receipts")]
    public async Task<ActionResult<IReadOnlyList<CarrierCommissionReceiptDto>>> Receipts(Guid policyId, CancellationToken ct) =>
        Ok(await mediator.Send(new ListCarrierCommissionReceiptsQuery(policyId), ct));

    [HttpPut("receipts/{id:guid}")]
    [RequirePermission("receipts.write")]
    public async Task<ActionResult<CarrierCommissionReceiptDto>> Save(Guid id, CarrierCommissionReceiptBody body, CancellationToken ct) =>
        Ok(await mediator.Send(new SaveCarrierCommissionReceiptCommand(id, body), ct));

    [HttpDelete("receipts/{id:guid}")]
    [RequirePermission("receipts.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteCarrierCommissionReceiptCommand(id), ct);
        return NoContent();
    }
}
