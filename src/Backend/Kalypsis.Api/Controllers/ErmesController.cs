using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Ermes;
using Kalypsis.Domain.Enums;
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
[RequiresPackage(PackageCode.Ermes)]
public class ErmesController : ControllerBase
{
    private readonly IMediator _m;
    private readonly IErmesRealtimeService _realtime;
    private readonly ICurrentUser _current;
    public ErmesController(IMediator m, IErmesRealtimeService realtime, ICurrentUser current)
    { _m = m; _realtime = realtime; _current = current; }

    // ── Overview: folder counts + teams + contacts ─────────────────
    [HttpGet("overview")]
    public async Task<ActionResult<ErmesOverviewDto>> Overview(CancellationToken ct)
        => Ok(await _m.Send(new ErmesOverviewQuery(), ct));

    /// <summary>
    /// Server-Sent Events stream: keeps a long-lived HTTP connection open
    /// and pushes «message» events whenever a new ΕΡΜΗΣ message lands for
    /// the caller. Frontend uses EventSource to invalidate its react-query
    /// cache, so the inbox refreshes without polling. Auth via the normal
    /// bearer token (the frontend uses a fetch-based SSE client that can
    /// set Authorization headers).
    /// </summary>
    [HttpGet("stream")]
    public async Task Stream(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        Response.Headers.CacheControl = "no-cache, no-store";
        Response.Headers.Append("X-Accel-Buffering", "no"); // disable nginx buffering
        Response.ContentType = "text/event-stream";
        await Response.Body.FlushAsync(ct);

        var writeLock = new SemaphoreSlim(1, 1);
        async Task WriteAsync(string payload)
        {
            await writeLock.WaitAsync(ct);
            try
            {
                var bytes = System.Text.Encoding.UTF8.GetBytes(payload);
                await Response.Body.WriteAsync(bytes, ct);
                await Response.Body.FlushAsync(ct);
            }
            finally { writeLock.Release(); }
        }

        // Announce connect so the client knows the stream is live.
        await WriteAsync(": connected\n\n");

        await using var sub = _realtime.Subscribe(tenantId, userId, async evt =>
        {
            var json = JsonSerializer.Serialize(evt);
            await WriteAsync($"event: {evt.Kind}\ndata: {json}\n\n");
        });

        // Keep-alive comment every 25s so proxies don't idle-timeout, and
        // so we notice a broken client sooner via WriteAsync throwing.
        try
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(25), ct);
                await WriteAsync(": keep-alive\n\n");
            }
        }
        catch (OperationCanceledException) { /* client disconnected — sub disposed by using */ }
        catch { /* write failure means client is gone; fall through to dispose */ }
    }

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
        string? AutomationSource,
        string? Category,
        bool SendExternalEmail,
        IReadOnlyList<Guid>? AttachmentIds,
        Guid? ChannelId,
        // Optional per-recipient E2E envelope JSON. When set, `BodyHtml`
        // is a placeholder like "[Κρυπτογραφημένο μήνυμα]" and the real
        // plaintext lives inside the envelope keyed by recipient user id.
        string? EncryptedEnvelopesJson);

    [HttpPost("messages")]
    public async Task<ActionResult<Guid>> Send([FromBody] SendBody body, CancellationToken ct)
        => Ok(await _m.Send(new SendErmesCommand(
            body.Subject ?? "", body.BodyHtml ?? "",
            body.Recipients ?? new List<ErmesRecipientInput>(),
            body.TeamIds ?? new List<Guid>(),
            body.InReplyToMessageId, body.IsImportant, body.SaveAsDraft,
            body.AutomationSource, body.Category, body.SendExternalEmail,
            body.AttachmentIds ?? new List<Guid>(),
            body.ChannelId,
            body.EncryptedEnvelopesJson), ct));

    // ── Channel feed (Discord-style shared thread per team) ────────
    [HttpGet("channels/{teamId:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<ErmesMessageDto>>> Channel(
        Guid teamId, [FromQuery] int take = 100, CancellationToken ct = default)
        => Ok(await _m.Send(new ListErmesChannelMessagesQuery(teamId, take), ct));

    // ── Attachments ────────────────────────────────────────────────
    [HttpPost("attachments")]
    [RequestSizeLimit(20_000_000)] // 20 MB request body, ~16 MB payload
    public async Task<ActionResult<ErmesAttachmentDto>> Upload(
        [FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest("Απαιτείται αρχείο.");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return Ok(await _m.Send(new UploadErmesAttachmentCommand(
            file.FileName, file.ContentType, ms.ToArray()), ct));
    }

    [HttpGet("attachments/{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var (name, mime, bytes) = await _m.Send(new DownloadErmesAttachmentQuery(id), ct);
        return File(bytes, mime, name);
    }

    // ── Autosave (update an existing draft in place) ───────────────
    public record UpdateDraftBody(
        string Subject, string BodyHtml,
        IReadOnlyList<ErmesRecipientInput> Recipients,
        IReadOnlyList<Guid>? TeamIds,
        bool IsImportant,
        string? Category,
        bool SendExternalEmail,
        IReadOnlyList<Guid>? AttachmentIds);

    [HttpPut("messages/{id:guid}/draft")]
    public async Task<IActionResult> UpdateDraft(Guid id, [FromBody] UpdateDraftBody body, CancellationToken ct)
    {
        await _m.Send(new UpdateErmesDraftCommand(
            id,
            body.Subject ?? "", body.BodyHtml ?? "",
            body.Recipients ?? new List<ErmesRecipientInput>(),
            body.TeamIds ?? new List<Guid>(),
            body.IsImportant, body.Category, body.SendExternalEmail,
            body.AttachmentIds ?? new List<Guid>()), ct);
        return NoContent();
    }

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
