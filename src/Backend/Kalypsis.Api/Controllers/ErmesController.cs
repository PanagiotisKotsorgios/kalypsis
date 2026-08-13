using Kalypsis.Application.Features.Ermes;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// «ΕΡΜΗΣ» — Kalypsis-native messaging endpoints. Tenant-scoped, opened to
/// every signed-in agency user; per-message access checks happen inside
/// the handlers (sender + recipients only).
/// </summary>
[ApiController]
[Route("api/ermes")]
[Authorize(Policy = "AgencyStaff")]
public class ErmesController : ControllerBase
{
    private readonly IMediator _m;
    public ErmesController(IMediator m) => _m = m;

    // ── Overview: folder counts + teams + contacts ─────────────────
    [HttpGet("overview")]
    public async Task<ActionResult<ErmesOverviewDto>> Overview(CancellationToken ct)
        => Ok(await _m.Send(new ErmesOverviewQuery(), ct));

    // ── List a folder ──────────────────────────────────────────────
    [HttpGet("messages")]
    public async Task<ActionResult<IReadOnlyList<ErmesMessageDto>>> List(
        [FromQuery] string folder = "Inbox",
        [FromQuery] string? search = null,
        [FromQuery] int skip = 0, [FromQuery] int take = 50,
        CancellationToken ct = default)
        => Ok(await _m.Send(new ListErmesQuery(folder, search, skip, take), ct));

    // ── Get a full thread (Reply-all / view-all) ───────────────────
    [HttpGet("threads/{threadId:guid}")]
    public async Task<ActionResult<IReadOnlyList<ErmesMessageDto>>> Thread(Guid threadId, CancellationToken ct)
        => Ok(await _m.Send(new GetErmesThreadQuery(threadId), ct));

    // ── Compose / send / save-draft ────────────────────────────────
    public record SendBody(
        string Subject, string BodyHtml,
        IReadOnlyList<ErmesRecipientInput> Recipients,
        IReadOnlyList<Guid>? TeamIds,
        Guid? InReplyToMessageId,
        bool IsImportant,
        bool SaveAsDraft,
        string? AutomationSource);

    [HttpPost("messages")]
    public async Task<ActionResult<Guid>> Send([FromBody] SendBody body, CancellationToken ct)
        => Ok(await _m.Send(new SendErmesCommand(
            body.Subject ?? "", body.BodyHtml ?? "",
            body.Recipients ?? new List<ErmesRecipientInput>(),
            body.TeamIds ?? new List<Guid>(),
            body.InReplyToMessageId, body.IsImportant, body.SaveAsDraft,
            body.AutomationSource), ct));

    // ── Bulk actions (move / read / star / delete / restore) ───────
    public record BulkBody(IReadOnlyList<Guid> MessageIds, string Action, string? Reason);

    [HttpPost("messages/bulk")]
    public async Task<IActionResult> Bulk([FromBody] BulkBody body, CancellationToken ct)
    {
        await _m.Send(new ErmesBulkCommand(
            body.MessageIds ?? new List<Guid>(), body.Action ?? "", body.Reason), ct);
        return NoContent();
    }

    // ── Teams ──────────────────────────────────────────────────────
    [HttpGet("teams")]
    public async Task<ActionResult<IReadOnlyList<ErmesTeamDto>>> Teams(CancellationToken ct)
        => Ok(await _m.Send(new ListErmesTeamsQuery(), ct));

    public record CreateTeamBody(string Name, string? Description, IReadOnlyList<Guid>? MemberUserIds);

    [HttpPost("teams")]
    public async Task<ActionResult<Guid>> CreateTeam([FromBody] CreateTeamBody body, CancellationToken ct)
        => Ok(await _m.Send(new CreateErmesTeamCommand(
            body.Name ?? "", body.Description,
            body.MemberUserIds ?? new List<Guid>()), ct));

    [HttpDelete("teams/{id:guid}")]
    public async Task<IActionResult> DeleteTeam(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteErmesTeamCommand(id), ct);
        return NoContent();
    }

    // ── Blocks ─────────────────────────────────────────────────────
    [HttpGet("blocks")]
    public async Task<ActionResult<IReadOnlyList<ErmesBlockDto>>> Blocks(CancellationToken ct)
        => Ok(await _m.Send(new ListErmesBlocksQuery(), ct));

    public record BlockBody(Guid BlockedUserId, string? Reason);

    [HttpPost("blocks")]
    public async Task<IActionResult> Block([FromBody] BlockBody body, CancellationToken ct)
    {
        await _m.Send(new BlockErmesUserCommand(body.BlockedUserId, body.Reason), ct);
        return NoContent();
    }

    [HttpDelete("blocks/{id:guid}")]
    public async Task<IActionResult> Unblock(Guid id, CancellationToken ct)
    {
        await _m.Send(new UnblockErmesUserCommand(id), ct);
        return NoContent();
    }
}
