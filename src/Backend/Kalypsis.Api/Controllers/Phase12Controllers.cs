using Kalypsis.Application.Features.Phase12;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

// Phase 12 — BluByte parity controllers.

[ApiController]
[Route("api/friendly-settlements")]
[Authorize(Policy = "AgencyStaff")]
public class FriendlySettlementsController : ControllerBase
{
    private readonly IMediator _mediator;
    public FriendlySettlementsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FriendlySettlementDto>>> List([FromQuery] string? status, CancellationToken ct)
        => Ok(await _mediator.Send(new ListFriendlySettlementsQuery(status), ct));

    [HttpPost]
    public async Task<ActionResult<FriendlySettlementDto>> Create([FromBody] FriendlySettlementBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateFriendlySettlementCommand(body), ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FriendlySettlementDto>> Update(Guid id, [FromBody] FriendlySettlementBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateFriendlySettlementCommand(id, body), ct));
}

[ApiController]
[Route("api/claim-victims")]
[Authorize(Policy = "AgencyStaff")]
public class ClaimVictimsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ClaimVictimsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClaimVictimDto>>> List([FromQuery] Guid? claimId, [FromQuery] Guid? settlementId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListClaimVictimsQuery(claimId, settlementId), ct));

    [HttpPost]
    public async Task<ActionResult<ClaimVictimDto>> Add([FromBody] ClaimVictimBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new AddClaimVictimCommand(body), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteClaimVictimCommand(id), ct);
        return NoContent();
    }

    [HttpGet("{victimId:guid}/payments")]
    public async Task<ActionResult<IReadOnlyList<SettlementPaymentDto>>> Payments(Guid victimId, CancellationToken ct)
        => Ok(await _mediator.Send(new ListSettlementPaymentsQuery(victimId), ct));

    [HttpPost("payments")]
    public async Task<ActionResult<SettlementPaymentDto>> AddPayment([FromBody] SettlementPaymentBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new AddSettlementPaymentCommand(body), ct));
}

[ApiController]
[Route("api/caller-id")]
[Authorize(Policy = "AgencyStaff")]
public class CallerIdController : ControllerBase
{
    private readonly IMediator _mediator;
    public CallerIdController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CallerIdLogDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListCallerIdLogsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<CallerIdLogDto>> Log([FromBody] CallerIdLogBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new LogIncomingCallCommand(body), ct));
}

[ApiController]
[Route("api/usae-submissions")]
[Authorize(Policy = "AgencyStaff")]
public class UsaeSubmissionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public UsaeSubmissionsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UsaeSubmissionDto>>> List(CancellationToken ct)
        => Ok(await _mediator.Send(new ListUsaeSubmissionsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<UsaeSubmissionDto>> Submit([FromBody] UsaeSubmissionBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new SubmitUsaeCommand(body), ct));
}

[ApiController]
[Route("api/vehicle-models")]
[Authorize(Policy = "AgencyStaff")]
public class VehicleModelsController : ControllerBase
{
    private readonly IMediator _mediator;
    public VehicleModelsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<VehicleModelDto>>> List([FromQuery] string? manufacturer, CancellationToken ct)
        => Ok(await _mediator.Send(new ListVehicleModelsQuery(manufacturer), ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<VehicleModelDto>> Create([FromBody] VehicleModelBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateVehicleModelCommand(body), ct));
}

[ApiController]
[Route("api/customer-merge")]
[Authorize(Policy = "AgencyAdmin")]
public class CustomerMergeController : ControllerBase
{
    private readonly IMediator _mediator;
    public CustomerMergeController(IMediator mediator) => _mediator = mediator;

    public record MergeBody(Guid KeepId, List<Guid> RemoveIds);

    [HttpGet("duplicates")]
    public async Task<ActionResult<IReadOnlyList<DuplicateCustomerGroupDto>>> Duplicates(CancellationToken ct)
        => Ok(await _mediator.Send(new FindDuplicateCustomersQuery(), ct));

    [HttpPost("merge")]
    public async Task<ActionResult<MergeResultDto>> Merge([FromBody] MergeBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new MergeCustomersCommand(body.KeepId, body.RemoveIds), ct));
}

[ApiController]
[Route("api/persistency")]
[Authorize(Policy = "AgencyStaff")]
public class PersistencyController : ControllerBase
{
    private readonly IMediator _mediator;
    public PersistencyController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<ActionResult<PersistencyDto>> Get([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await _mediator.Send(new GetPersistencyQuery(from, to), ct));
}

[ApiController]
[Route("api/policy-delivery")]
[Authorize(Policy = "AgencyStaff")]
public class PolicyDeliveryController : ControllerBase
{
    private readonly IMediator _mediator;
    public PolicyDeliveryController(IMediator mediator) => _mediator = mediator;

    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<DeliveryRowDto>>> Pending(CancellationToken ct)
        => Ok(await _mediator.Send(new ListUndeliveredPoliciesQuery(), ct));

    [HttpPost("mark-delivered")]
    public async Task<ActionResult<int>> MarkDelivered([FromBody] MarkDeliveredBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new MarkPoliciesDeliveredCommand(body), ct));
}

[ApiController]
[Route("api/lookups")]
[Authorize(Policy = "AgencyStaff")]
public class ExternalLookupsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ExternalLookupsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("afm/{afm}")]
    public async Task<ActionResult<AfmLookupDto>> Afm(string afm, CancellationToken ct)
        => Ok(await _mediator.Send(new AfmLookupQuery(afm), ct));

    [HttpGet("gemi/{afm}")]
    public async Task<ActionResult<GemiLookupDto>> Gemi(string afm, CancellationToken ct)
        => Ok(await _mediator.Send(new GemiLookupQuery(afm), ct));
}
