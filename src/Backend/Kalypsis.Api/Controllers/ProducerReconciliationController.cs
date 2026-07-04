using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Reconciliation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Agency-side view of producer reconciliation declarations. Lets the office
/// see what each producer expected per policy and the diff vs the recorded
/// CommissionRunLine. Available to every agency without a premium gate.
/// </summary>
[ApiController]
[Route("api/producer-reconciliation")]
[Authorize(Policy = "AgencyStaff")]
public class ProducerReconciliationController : ControllerBase
{
    private readonly IMediator _m;
    private readonly ICurrentUser _current;
    public ProducerReconciliationController(IMediator m, ICurrentUser current)
    { _m = m; _current = current; }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProducerDeclarationDto>>> List(
        [FromQuery] Guid? producerId,
        CancellationToken ct)
    {
        _ = _current.TenantId ?? throw AppException.Forbidden();
        return Ok(await _m.Send(new ListAgencyDeclarationsQuery(producerId), ct));
    }

    /// <summary>
    /// Ταυτοποίηση Συνεργατών aggregated by CommissionRule instead of by
    /// individual policy. Answers «per producer × carrier × package/coverage,
    /// does your παραμετροποίηση match what the producer is expecting?» — the
    /// day-to-day view the operator lives in.
    /// </summary>
    [HttpGet("by-rule")]
    public async Task<ActionResult<IReadOnlyList<RuleReconciliationDto>>> ListByRule(
        [FromQuery] Guid? producerId,
        CancellationToken ct)
    {
        _ = _current.TenantId ?? throw AppException.Forbidden();
        return Ok(await _m.Send(new ListAgencyReconciliationByRuleQuery(producerId), ct));
    }

    /// <summary>Reconciliation dashboard — monthly totals of premium billed
    /// vs receipts collected vs commissions paid, plus yearly grand totals.</summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<ReconciliationDashboardDto>> Dashboard(
        [FromQuery] int? year,
        CancellationToken ct)
    {
        _ = _current.TenantId ?? throw AppException.Forbidden();
        return Ok(await _m.Send(new GetReconciliationDashboardQuery(year ?? DateTime.UtcNow.Year), ct));
    }
}
