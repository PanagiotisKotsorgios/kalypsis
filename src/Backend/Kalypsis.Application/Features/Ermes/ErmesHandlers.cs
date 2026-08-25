using System.Text.RegularExpressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Application.Features.Ermes;

// ─── DTOs ─────────────────────────────────────────────────────────────

public record ErmesFolderCountDto(string Folder, int Total, int Unread);

public record ErmesAttachmentDto(
    Guid Id, string FileName, string MimeType, long SizeBytes);

public record ErmesRecipientDto(
    Guid UserId, string Display, string Email, string Kind,
    bool IsRead, bool IsStarred);

public record ErmesMessageDto(
    Guid Id, Guid ThreadId, Guid? InReplyToMessageId,
    Guid SenderUserId, string SenderDisplay, string SenderEmail,
    string Subject, string BodyHtml, string Preview,
    string Folder,               // resolved from the caller's perspective
    bool IsRead, bool IsStarred, bool IsImportant, bool IsDraft,
    string? AutomationSource,
    string? Category,
    bool ExternalEmailRequested, bool ExternalEmailDelivered, string? ExternalEmailStatus,
    DateTime CreatedAt, DateTime? SentAt,
    IReadOnlyList<ErmesRecipientDto> Recipients,
    IReadOnlyList<ErmesAttachmentDto> Attachments,
    // Per-recipient E2E envelopes. Opaque JSON — the client decrypts
    // the entry keyed by its own userId. Null → the message is plain
    // HTML and BodyHtml has the real body.
    string? EncryptedEnvelopesJson = null);

public record ErmesContactDto(
    Guid UserId, string Display, string Email, string Role);

public record ErmesTeamDto(
    Guid Id, string Name, string? Description,
    IReadOnlyList<ErmesContactDto> Members);

public record ErmesBlockDto(
    Guid Id, Guid BlockedUserId, string BlockedDisplay,
    string BlockedEmail, string? Reason, DateTime CreatedAt);

public record ErmesOverviewDto(
    IReadOnlyList<ErmesFolderCountDto> Folders,
    IReadOnlyList<ErmesTeamDto> Teams,
    IReadOnlyList<ErmesContactDto> Contacts);

// ─── Utility ──────────────────────────────────────────────────────────

/// <summary>
/// Very small HTML sanitiser — the composer only lets the user emit a
/// handful of block/inline tags via the toolbar, but we still strip
/// anything dangerous on write. Real defense-in-depth beats leaning on
/// contentEditable behaviour.
/// </summary>
internal static class ErmesHtml
{
    private static readonly Regex ScriptOrStyle =
        new(@"<(script|style|iframe|object|embed)[^>]*>.*?</\1>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
    private static readonly Regex EventAttrs =
        new(@"\s+on[a-z]+\s*=\s*(?:""[^""]*""|'[^']*'|[^\s>]*)",
            RegexOptions.IgnoreCase);
    private static readonly Regex JavaScriptHrefs =
        new(@"(href|src)\s*=\s*(?:""\s*javascript:[^""]*""|'\s*javascript:[^']*')",
            RegexOptions.IgnoreCase);
    private static readonly Regex TagStripper =
        new(@"<[^>]+>", RegexOptions.Singleline);

    public static string Sanitise(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var h = html;
        h = ScriptOrStyle.Replace(h, string.Empty);
        h = EventAttrs.Replace(h, string.Empty);
        h = JavaScriptHrefs.Replace(h, "$1=\"#\"");
        return h.Trim();
    }

    public static string BuildPreview(string bodyHtml)
    {
        var plain = TagStripper.Replace(bodyHtml ?? string.Empty, " ");
        plain = System.Net.WebUtility.HtmlDecode(plain);
        plain = Regex.Replace(plain, @"\s+", " ").Trim();
        return plain.Length <= 300 ? plain : plain[..300];
    }
}

// ─── Overview (folder counts, teams, contacts) ────────────────────────

public record ErmesOverviewQuery : IRequest<ErmesOverviewDto>;

public class ErmesOverviewHandler : IRequestHandler<ErmesOverviewQuery, ErmesOverviewDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ErmesOverviewHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ErmesOverviewDto> Handle(ErmesOverviewQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();

        // Per-user folder counts drawn from ermes_recipients.
        var rec = _db.ErmesRecipients
            .Where(x => x.TenantId == tenantId && x.RecipientUserId == userId);
        var byFolder = await rec.GroupBy(x => x.Folder)
            .Select(g => new { Folder = g.Key, Total = g.Count(), Unread = g.Count(x => !x.IsRead) })
            .ToListAsync(ct);

        // Author's own folders (Sent/Draft/Trash).
        var sent = _db.ErmesMessages
            .Where(x => x.TenantId == tenantId && x.SenderUserId == userId);
        var sentByFolder = await sent.GroupBy(x => x.SenderFolder)
            .Select(g => new { Folder = g.Key, Total = g.Count() })
            .ToListAsync(ct);

        var folders = new List<ErmesFolderCountDto>
        {
            new("Inbox",   byFolder.FirstOrDefault(f => f.Folder == "Inbox")?.Total  ?? 0,
                          byFolder.FirstOrDefault(f => f.Folder == "Inbox")?.Unread ?? 0),
            new("Starred", await rec.CountAsync(x => x.IsStarred, ct), 0),
            new("Sent",    sentByFolder.FirstOrDefault(f => f.Folder == "Sent")?.Total  ?? 0, 0),
            new("Drafts",  sentByFolder.FirstOrDefault(f => f.Folder == "Draft")?.Total ?? 0, 0),
            new("Spam",    byFolder.FirstOrDefault(f => f.Folder == "Spam")?.Total  ?? 0,
                          byFolder.FirstOrDefault(f => f.Folder == "Spam")?.Unread ?? 0),
            new("Trash",   byFolder.FirstOrDefault(f => f.Folder == "Trash")?.Total  ?? 0, 0),
            new("Archive", byFolder.FirstOrDefault(f => f.Folder == "Archive")?.Total ?? 0, 0),
        };

        // Teams the caller is a member of, plus teams they created — one
        // list, deduped, with each team's full membership.
        var myTeamIds = await _db.ErmesTeamMembers
            .Where(m => m.TenantId == tenantId && m.UserId == userId)
            .Select(m => m.TeamId).ToListAsync(ct);
        var authoredTeamIds = await _db.ErmesTeams
            .Where(t => t.TenantId == tenantId && t.CreatedByUserId == userId)
            .Select(t => t.Id).ToListAsync(ct);
        var teamIds = myTeamIds.Concat(authoredTeamIds).Distinct().ToList();
        var teamRows = await _db.ErmesTeams
            .Where(t => t.TenantId == tenantId && teamIds.Contains(t.Id))
            .OrderBy(t => t.Name).ToListAsync(ct);
        var memberRows = await _db.ErmesTeamMembers
            .Where(m => m.TenantId == tenantId && teamIds.Contains(m.TeamId))
            .ToListAsync(ct);
        var teams = teamRows.Select(t => new ErmesTeamDto(
            t.Id, t.Name, t.Description,
            memberRows.Where(m => m.TeamId == t.Id)
                .Select(m => new ErmesContactDto(m.UserId, m.UserDisplay, m.UserEmail, "AgencyUser"))
                .ToList())).ToList();

        // Contacts = every user in the tenant (address book).
        var contacts = await _db.Users
            .Where(u => u.TenantId == tenantId && u.DeletedAt == null && u.IsActive && u.Id != userId)
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .Select(u => new ErmesContactDto(
                u.Id,
                (u.FirstName + " " + u.LastName).Trim(),
                u.Email,
                u.Role.ToString()))
            .ToListAsync(ct);

        return new ErmesOverviewDto(folders, teams, contacts);
    }
}

// ─── List messages for a folder ───────────────────────────────────────

public record ListErmesQuery(
    string Folder,           // Inbox / Starred / Sent / Drafts / Spam / Trash / Archive
    string? Search,
    int Skip = 0, int Take = 50) : IRequest<IReadOnlyList<ErmesMessageDto>>;

public class ListErmesHandler : IRequestHandler<ListErmesQuery, IReadOnlyList<ErmesMessageDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListErmesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ErmesMessageDto>> Handle(ListErmesQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        var take = Math.Clamp(r.Take, 1, 200);

        List<ErmesMessage> msgs;
        Dictionary<Guid, ErmesRecipient?> myRec;

        if (r.Folder is "Sent" or "Drafts")
        {
            var senderFolder = r.Folder == "Drafts" ? "Draft" : "Sent";
            var q = _db.ErmesMessages
                .Where(x => x.TenantId == tenantId && x.SenderUserId == userId
                    && x.SenderFolder == senderFolder);
            if (!string.IsNullOrWhiteSpace(r.Search))
            {
                var s = r.Search.Trim();
                q = q.Where(x => EF.Functions.Like(x.Subject, $"%{s}%")
                              || EF.Functions.Like(x.Preview, $"%{s}%"));
            }
            msgs = await q.OrderByDescending(x => x.SentAt ?? x.CreatedAt)
                          .Skip(Math.Max(0, r.Skip)).Take(take).ToListAsync(ct);
            myRec = new(); // no per-user row for sender folders
        }
        else
        {
            // Recipient folders.
            var folder = r.Folder switch
            {
                "Starred" => "Inbox",  // Starred is a virtual filter over Inbox
                _ => r.Folder,
            };
            var recQ = _db.ErmesRecipients
                .Where(x => x.TenantId == tenantId && x.RecipientUserId == userId && x.Folder == folder);
            if (r.Folder == "Starred") recQ = recQ.Where(x => x.IsStarred);

            var recRows = await recQ
                .OrderByDescending(x => x.CreatedAt)
                .Skip(Math.Max(0, r.Skip)).Take(take).ToListAsync(ct);
            var msgIds = recRows.Select(x => x.MessageId).Distinct().ToList();
            var msgQ = _db.ErmesMessages.Where(x => msgIds.Contains(x.Id));
            if (!string.IsNullOrWhiteSpace(r.Search))
            {
                var s = r.Search.Trim();
                msgQ = msgQ.Where(x => EF.Functions.Like(x.Subject, $"%{s}%")
                                    || EF.Functions.Like(x.Preview, $"%{s}%")
                                    || EF.Functions.Like(x.SenderDisplay, $"%{s}%"));
            }
            var m = await msgQ.ToListAsync(ct);
            // Preserve recipient-row ordering (most recent first).
            var order = recRows.Select((rr, i) => (rr.MessageId, i)).ToDictionary(x => x.MessageId, x => x.i);
            msgs = m.OrderBy(x => order.TryGetValue(x.Id, out var i) ? i : int.MaxValue).ToList();
            myRec = recRows.ToDictionary(x => x.MessageId, x => (ErmesRecipient?)x);
        }

        // Preload recipient chips + attachment stubs for each message.
        var msgIdsAll = msgs.Select(x => x.Id).ToList();
        var allRec = await _db.ErmesRecipients
            .Where(x => x.TenantId == tenantId && msgIdsAll.Contains(x.MessageId))
            .ToListAsync(ct);
        var allAtt = await _db.ErmesAttachments
            .Where(x => x.TenantId == tenantId && msgIdsAll.Contains(x.MessageId))
            .Select(x => new { x.Id, x.MessageId, x.FileName, x.MimeType, x.SizeBytes })
            .ToListAsync(ct);

        return msgs.Select(m =>
        {
            myRec.TryGetValue(m.Id, out var mine);
            var senderView = r.Folder is "Sent" or "Drafts";
            return new ErmesMessageDto(
                m.Id, m.ThreadId, m.InReplyToMessageId,
                m.SenderUserId, m.SenderDisplay, m.SenderEmail,
                m.Subject, m.BodyHtml, m.Preview,
                Folder: senderView ? m.SenderFolder : (mine?.Folder ?? "Inbox"),
                IsRead: senderView ? true : (mine?.IsRead ?? true),
                IsStarred: senderView ? m.SenderStarred : (mine?.IsStarred ?? false),
                IsImportant: m.IsImportant,
                IsDraft: m.SenderFolder == "Draft",
                AutomationSource: m.AutomationSource,
                Category: m.Category,
                ExternalEmailRequested: m.ExternalEmailRequested,
                ExternalEmailDelivered: m.ExternalEmailDelivered,
                ExternalEmailStatus: m.ExternalEmailStatus,
                CreatedAt: m.CreatedAt, SentAt: m.SentAt,
                Recipients: allRec
                    .Where(rr => rr.MessageId == m.Id && rr.Kind != "Bcc")
                    .Select(rr => new ErmesRecipientDto(
                        rr.RecipientUserId, rr.RecipientDisplay, rr.RecipientEmail,
                        rr.Kind, rr.IsRead, rr.IsStarred))
                    .ToList(),
                Attachments: allAtt.Where(a => a.MessageId == m.Id)
                    .Select(a => new ErmesAttachmentDto(a.Id, a.FileName, a.MimeType, a.SizeBytes))
                    .ToList(),
                EncryptedEnvelopesJson: m.EncryptedEnvelopesJson);
        }).ToList();
    }
}

// ─── Get a single thread ──────────────────────────────────────────────

public record GetErmesThreadQuery(Guid ThreadId) : IRequest<IReadOnlyList<ErmesMessageDto>>;

public class GetErmesThreadHandler : IRequestHandler<GetErmesThreadQuery, IReadOnlyList<ErmesMessageDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetErmesThreadHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ErmesMessageDto>> Handle(GetErmesThreadQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();

        var msgs = await _db.ErmesMessages
            .Where(x => x.TenantId == tenantId && x.ThreadId == r.ThreadId)
            .OrderBy(x => x.CreatedAt).ToListAsync(ct);
        if (msgs.Count == 0) return Array.Empty<ErmesMessageDto>();

        // Access check: the caller must be sender OR a recipient of at least
        // one message in the thread.
        var msgIds = msgs.Select(x => x.Id).ToList();
        var recs = await _db.ErmesRecipients
            .Where(x => x.TenantId == tenantId && msgIds.Contains(x.MessageId))
            .ToListAsync(ct);
        var senderIds = msgs.Select(x => x.SenderUserId).ToHashSet();
        var recipientIds = recs.Select(x => x.RecipientUserId).ToHashSet();
        if (!senderIds.Contains(userId) && !recipientIds.Contains(userId))
            throw AppException.Forbidden();

        // Mark this user's copies as read.
        var toMark = recs.Where(x => x.RecipientUserId == userId && !x.IsRead).ToList();
        if (toMark.Count > 0)
        {
            var now = DateTime.UtcNow;
            foreach (var x in toMark) { x.IsRead = true; x.ReadAt = now; }
            await _db.SaveChangesAsync(ct);
        }

        var msgIdsList = msgs.Select(x => x.Id).ToList();
        var atts = await _db.ErmesAttachments
            .Where(x => x.TenantId == tenantId && msgIdsList.Contains(x.MessageId))
            .Select(x => new { x.Id, x.MessageId, x.FileName, x.MimeType, x.SizeBytes })
            .ToListAsync(ct);
        var myRec = recs.Where(x => x.RecipientUserId == userId).ToDictionary(x => x.MessageId, x => x);
        return msgs.Select(m =>
        {
            myRec.TryGetValue(m.Id, out var mine);
            var isSender = m.SenderUserId == userId;
            return new ErmesMessageDto(
                m.Id, m.ThreadId, m.InReplyToMessageId,
                m.SenderUserId, m.SenderDisplay, m.SenderEmail,
                m.Subject, m.BodyHtml, m.Preview,
                Folder: isSender ? m.SenderFolder : (mine?.Folder ?? "Inbox"),
                IsRead: isSender ? true : (mine?.IsRead ?? true),
                IsStarred: isSender ? m.SenderStarred : (mine?.IsStarred ?? false),
                IsImportant: m.IsImportant,
                IsDraft: m.SenderFolder == "Draft",
                AutomationSource: m.AutomationSource,
                Category: m.Category,
                ExternalEmailRequested: m.ExternalEmailRequested,
                ExternalEmailDelivered: m.ExternalEmailDelivered,
                ExternalEmailStatus: m.ExternalEmailStatus,
                CreatedAt: m.CreatedAt, SentAt: m.SentAt,
                Recipients: recs.Where(rr => rr.MessageId == m.Id
                        && (rr.Kind != "Bcc" || rr.RecipientUserId == userId || isSender))
                    .Select(rr => new ErmesRecipientDto(
                        rr.RecipientUserId, rr.RecipientDisplay, rr.RecipientEmail,
                        rr.Kind, rr.IsRead, rr.IsStarred))
                    .ToList(),
                Attachments: atts.Where(a => a.MessageId == m.Id)
                    .Select(a => new ErmesAttachmentDto(a.Id, a.FileName, a.MimeType, a.SizeBytes))
                    .ToList(),
                EncryptedEnvelopesJson: m.EncryptedEnvelopesJson);
        }).ToList();
    }
}

// ─── Send / save-draft ───────────────────────────────────────────────

public record ErmesRecipientInput(Guid UserId, string Kind /* To | Cc | Bcc */);

public record SendErmesCommand(
    string Subject, string BodyHtml,
    IReadOnlyList<ErmesRecipientInput> Recipients,
    IReadOnlyList<Guid> TeamIds,
    Guid? InReplyToMessageId,
    bool IsImportant,
    bool SaveAsDraft,
    string? AutomationSource,
    string? Category,
    bool SendExternalEmail,
    IReadOnlyList<Guid>? AttachmentIds = null,
    Guid? ChannelId = null,
    // ── E2E encryption envelope (optional) ─────────────────────────
    // When present, the client has already encrypted the body for
    // each recipient using their ECDH public key. The server stores
    // the JSON opaquely alongside BodyHtml (which becomes a UI
    // placeholder like "[Κρυπτογραφημένο μήνυμα]"). The plaintext
    // NEVER reaches the server — decryption happens in each
    // recipient's browser with their IndexedDB-pinned private key.
    string? EncryptedEnvelopesJson = null) : IRequest<Guid>;

public class SendErmesHandler : IRequestHandler<SendErmesCommand, Guid>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IEmailSender _email;
    private readonly ILogger<SendErmesHandler> _logger;
    private readonly IErmesRealtimeService _realtime;
    public SendErmesHandler(IAppDbContext db, ICurrentUser current,
        IEmailSender email, ILogger<SendErmesHandler> logger,
        IErmesRealtimeService realtime)
    { _db = db; _current = current; _email = email; _logger = logger; _realtime = realtime; }

    public async Task<Guid> Handle(SendErmesCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("User");

        // Expand teams into user ids (dedup with explicit recipients).
        var explicitRecs = (r.Recipients ?? new List<ErmesRecipientInput>())
            .Where(x => x.UserId != Guid.Empty).ToList();
        var teamMemberRows = new List<ErmesTeamMember>();
        if (r.TeamIds != null && r.TeamIds.Count > 0)
        {
            teamMemberRows = await _db.ErmesTeamMembers
                .Where(m => m.TenantId == tenantId && r.TeamIds.Contains(m.TeamId))
                .ToListAsync(ct);
        }
        var allRecKind = new Dictionary<Guid, string>();
        foreach (var er in explicitRecs)
        {
            var k = er.Kind == "Cc" || er.Kind == "Bcc" ? er.Kind : "To";
            if (!allRecKind.ContainsKey(er.UserId)) allRecKind[er.UserId] = k;
        }
        foreach (var m in teamMemberRows)
        {
            if (!allRecKind.ContainsKey(m.UserId)) allRecKind[m.UserId] = "To";
        }
        // Drop self-sends — the sender's copy lives on the message row itself.
        allRecKind.Remove(userId);

        if (!r.SaveAsDraft && allRecKind.Count == 0)
            throw AppException.Validation("Απαιτείται τουλάχιστον ένας παραλήπτης.");

        var recipientUserIds = allRecKind.Keys.ToList();
        var recipientUsers = await _db.Users
            .Where(u => recipientUserIds.Contains(u.Id) && u.TenantId == tenantId && u.DeletedAt == null)
            .ToListAsync(ct);
        var recipientMap = recipientUsers.ToDictionary(u => u.Id);

        // Load blocklists — messages from a blocked sender land in Spam
        // for the recipient. Composed here so both the sender's copy and
        // the fanout are consistent.
        var blockRows = await _db.ErmesBlocks
            .Where(b => b.TenantId == tenantId
                && recipientUserIds.Contains(b.OwnerUserId)
                && b.BlockedUserId == userId).ToListAsync(ct);
        var blockedBy = new HashSet<Guid>(blockRows.Select(b => b.OwnerUserId));

        var bodyHtml = ErmesHtml.Sanitise(r.BodyHtml);
        var preview  = ErmesHtml.BuildPreview(bodyHtml);
        var subject  = string.IsNullOrWhiteSpace(r.Subject) ? "(Χωρίς θέμα)" : r.Subject.Trim();
        if (subject.Length > 400) subject = subject[..400];

        // Resolve thread — reply keeps the parent's thread id.
        Guid threadId;
        if (r.InReplyToMessageId is Guid parentId)
        {
            var parent = await _db.ErmesMessages
                .FirstOrDefaultAsync(x => x.Id == parentId && x.TenantId == tenantId, ct)
                ?? throw AppException.NotFound("Parent message");
            threadId = parent.ThreadId;
        }
        else threadId = Guid.NewGuid();

        var now = DateTime.UtcNow;
        var msg = new ErmesMessage
        {
            TenantId = tenantId,
            SenderUserId = userId,
            SenderDisplay = ($"{me.FirstName} {me.LastName}").Trim(),
            SenderEmail = me.Email,
            Subject = subject,
            BodyHtml = bodyHtml,
            Preview = preview,
            InReplyToMessageId = r.InReplyToMessageId,
            ThreadId = threadId,
            SenderFolder = r.SaveAsDraft ? "Draft" : "Sent",
            SentAt = r.SaveAsDraft ? null : now,
            IsImportant = r.IsImportant,
            AutomationSource = r.AutomationSource,
            Category = string.IsNullOrWhiteSpace(r.Category) ? null : r.Category.Trim(),
            ExternalEmailRequested = r.SendExternalEmail && !r.SaveAsDraft,
            ChannelId = r.ChannelId,
            // Trust the client's envelope opaquely — never inspect it. The
            // server has no way to tell the difference between a valid
            // envelope and gibberish, but bad JSON would only break
            // decryption for the recipients, not for anyone else.
            EncryptedEnvelopesJson = string.IsNullOrWhiteSpace(r.EncryptedEnvelopesJson)
                ? null : r.EncryptedEnvelopesJson,
        };
        _db.ErmesMessages.Add(msg);

        // Re-parent freshly-uploaded attachments (uploaded with MessageId
        // == Guid.Empty as scratch rows) to this message. Only the
        // uploader's own scratch rows are re-parented so a caller can't
        // steal someone else's uploads.
        if (r.AttachmentIds != null && r.AttachmentIds.Count > 0)
        {
            var wantedIds = r.AttachmentIds.Distinct().ToList();
            var scratch = await _db.ErmesAttachments
                .Where(a => a.TenantId == tenantId && a.UploadedByUserId == userId
                    && a.MessageId == Guid.Empty && wantedIds.Contains(a.Id))
                .ToListAsync(ct);
            foreach (var a in scratch) a.MessageId = msg.Id;
        }

        if (!r.SaveAsDraft)
        {
            foreach (var (uid, kind) in allRecKind)
            {
                if (!recipientMap.TryGetValue(uid, out var u)) continue;
                _db.ErmesRecipients.Add(new ErmesRecipient
                {
                    TenantId = tenantId,
                    MessageId = msg.Id,
                    RecipientUserId = u.Id,
                    RecipientDisplay = ($"{u.FirstName} {u.LastName}").Trim(),
                    RecipientEmail = u.Email,
                    Kind = kind,
                    Folder = blockedBy.Contains(u.Id) ? "Spam" : "Inbox",
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        // ─── Real-time push to open browser tabs ─────────────────
        // Every recipient with an active /api/ermes/stream subscription
        // gets an SSE event immediately, so their react-query cache
        // invalidates and the inbox row appears without a manual
        // refresh. Fire-and-forget in-process; multi-instance deploys
        // need this replaced with a shared bus.
        try
        {
            var recipientIds = recipientMap.Keys.ToList();
            if (recipientIds.Count > 0)
                _realtime.NotifyNewMessage(tenantId, recipientIds, msg.ThreadId, msg.Id);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Ermes realtime notify failed for message {MessageId}", msg.Id); }

        // ─── External email nudge via Brevo (best-effort) ────────
        // Kalypsis remains the source of truth; Brevo is just a
        // notification transport pointing recipients back to the app.
        // Any failure is logged + stamped on the message row but never
        // aborts the in-app delivery.
        //
        // E2E bodies get a light-touch «You have a new encrypted
        // message» nudge instead — sending the ciphertext placeholder
        // to a mailbox would be useless, and sending the plaintext
        // would defeat the whole point of E2E.
        if (msg.ExternalEmailRequested && !string.IsNullOrEmpty(msg.EncryptedEnvelopesJson))
        {
            _logger.LogInformation("Ermes external email skipped for E2E-encrypted message {MessageId}", msg.Id);
            msg.ExternalEmailStatus = "skipped — encrypted body";
            try { await _db.SaveChangesAsync(ct); } catch { /* best-effort */ }
        }
        else if (msg.ExternalEmailRequested)
        {
            try
            {
                var recipients = recipientMap.Values.ToList();
                var deliveredCount = 0; var failCount = 0;
                foreach (var u in recipients)
                {
                    if (string.IsNullOrWhiteSpace(u.Email)) continue;
                    var html = BuildExternalEmailHtml(msg, u);
                    var res = await _email.SendAsync(new EmailMessage(
                        u.Email, ($"{u.FirstName} {u.LastName}").Trim(),
                        subject, html), ct);
                    if (res.Success) deliveredCount++; else failCount++;
                }
                msg.ExternalEmailDelivered = deliveredCount > 0 && failCount == 0;
                msg.ExternalEmailStatus = $"delivered={deliveredCount} failed={failCount}";
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ermes external email send failed for message {MessageId}", msg.Id);
                msg.ExternalEmailStatus = ex.Message.Length > 400 ? ex.Message[..400] : ex.Message;
                try { await _db.SaveChangesAsync(ct); } catch { /* best-effort */ }
            }
        }
        return msg.Id;
    }

    /// <summary>Wraps the Ermes body in a minimal HTML shell for the
    /// external nudge. Deliberately terse — the source of truth stays
    /// inside Kalypsis.</summary>
    private static string BuildExternalEmailHtml(ErmesMessage m, User to)
    {
        var name = ($"{to.FirstName} {to.LastName}").Trim();
        return $@"<div style=""font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111"">
<p>Γεια σας {System.Net.WebUtility.HtmlEncode(name)},</p>
<p>Έχετε λάβει νέο μήνυμα ΕΡΜΗΣ από τον/την
<strong>{System.Net.WebUtility.HtmlEncode(m.SenderDisplay)}</strong>:</p>
<hr style=""border:none;border-top:1px solid #eee;margin:12px 0"" />
<div>{m.BodyHtml}</div>
<hr style=""border:none;border-top:1px solid #eee;margin:12px 0"" />
<p style=""color:#666"">Απαντήστε από την πλατφόρμα Kalypsis
(ενότητα ΕΡΜΗΣ). Αυτό το email είναι ενημερωτικό —
οι απαντήσεις σε αυτή τη διεύθυνση δεν παρακολουθούνται.</p>
</div>";
    }
}

// ─── Update-in-place draft (powers composer autosave) ───────────────

public record UpdateErmesDraftCommand(
    Guid MessageId,
    string Subject, string BodyHtml,
    IReadOnlyList<ErmesRecipientInput> Recipients,
    IReadOnlyList<Guid> TeamIds,
    bool IsImportant,
    string? Category,
    bool SendExternalEmail,
    IReadOnlyList<Guid>? AttachmentIds = null) : IRequest;

public class UpdateErmesDraftHandler : IRequestHandler<UpdateErmesDraftCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateErmesDraftHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task Handle(UpdateErmesDraftCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        var draft = await _db.ErmesMessages
            .FirstOrDefaultAsync(x => x.Id == r.MessageId
                && x.TenantId == tenantId
                && x.SenderUserId == userId
                && x.SenderFolder == "Draft", ct)
            ?? throw AppException.NotFound("Draft");

        var bodyHtml = ErmesHtml.Sanitise(r.BodyHtml);
        draft.Subject  = string.IsNullOrWhiteSpace(r.Subject) ? "(Πρόχειρο)" : r.Subject.Trim();
        if (draft.Subject.Length > 400) draft.Subject = draft.Subject[..400];
        draft.BodyHtml = bodyHtml;
        draft.Preview  = ErmesHtml.BuildPreview(bodyHtml);
        draft.IsImportant = r.IsImportant;
        draft.Category = string.IsNullOrWhiteSpace(r.Category) ? null : r.Category.Trim();
        draft.ExternalEmailRequested = r.SendExternalEmail;
        draft.UpdatedAt = DateTime.UtcNow;

        // Re-parent any newly-uploaded scratch attachments to this draft
        // so autosave hangs on to them just like a real send would.
        if (r.AttachmentIds != null && r.AttachmentIds.Count > 0)
        {
            var wantedIds = r.AttachmentIds.Distinct().ToList();
            var scratch = await _db.ErmesAttachments
                .Where(a => a.TenantId == tenantId && a.UploadedByUserId == userId
                    && a.MessageId == Guid.Empty && wantedIds.Contains(a.Id))
                .ToListAsync(ct);
            foreach (var a in scratch) a.MessageId = draft.Id;
        }
        await _db.SaveChangesAsync(ct);
    }
}

// ─── Bulk folder move / read / star / delete ─────────────────────────

public record ErmesBulkCommand(
    IReadOnlyList<Guid> MessageIds,
    string Action,           // MoveInbox / MoveSpam / MoveArchive / MoveTrash / MarkRead / MarkUnread / Star / Unstar / Delete / Restore
    string? Reason) : IRequest;

public class ErmesBulkHandler : IRequestHandler<ErmesBulkCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ErmesBulkHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task Handle(ErmesBulkCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        if (r.MessageIds == null || r.MessageIds.Count == 0) return;
        var ids = r.MessageIds.Distinct().ToList();

        var recs = await _db.ErmesRecipients
            .Where(x => x.TenantId == tenantId && x.RecipientUserId == userId && ids.Contains(x.MessageId))
            .ToListAsync(ct);
        var senderMsgs = await _db.ErmesMessages
            .Where(x => x.TenantId == tenantId && x.SenderUserId == userId && ids.Contains(x.Id))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        switch (r.Action)
        {
            case "MoveInbox":   foreach (var rr in recs) rr.Folder = "Inbox";   break;
            case "MoveSpam":    foreach (var rr in recs) rr.Folder = "Spam";    break;
            case "MoveArchive": foreach (var rr in recs) rr.Folder = "Archive"; break;
            case "MoveTrash":
                foreach (var rr in recs) rr.Folder = "Trash";
                foreach (var m in senderMsgs) m.SenderFolder = "Trash";
                break;
            case "Restore":
                // Restore-from-trash → recipients back to Inbox, sender copies
                // back to Sent (or Draft if never sent).
                foreach (var rr in recs) rr.Folder = "Inbox";
                foreach (var m in senderMsgs)
                    m.SenderFolder = m.SentAt is null ? "Draft" : "Sent";
                break;
            case "MarkRead":
                foreach (var rr in recs) { rr.IsRead = true;  if (rr.ReadAt is null) rr.ReadAt = now; }
                break;
            case "MarkUnread":
                foreach (var rr in recs) { rr.IsRead = false; rr.ReadAt = null; }
                break;
            case "Star":
                foreach (var rr in recs) rr.IsStarred = true;
                foreach (var m in senderMsgs) m.SenderStarred = true;
                break;
            case "Unstar":
                foreach (var rr in recs) rr.IsStarred = false;
                foreach (var m in senderMsgs) m.SenderStarred = false;
                break;
            case "Delete":
                foreach (var rr in recs) rr.DeletedAt = now;
                foreach (var m in senderMsgs) m.DeletedAt = now;
                break;
            default: throw AppException.Validation($"Άγνωστη ενέργεια: {r.Action}");
        }
        await _db.SaveChangesAsync(ct);
    }
}

// ─── Teams ───────────────────────────────────────────────────────────

public record ListErmesTeamsQuery : IRequest<IReadOnlyList<ErmesTeamDto>>;

public class ListErmesTeamsHandler : IRequestHandler<ListErmesTeamsQuery, IReadOnlyList<ErmesTeamDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListErmesTeamsHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ErmesTeamDto>> Handle(ListErmesTeamsQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var teams = await _db.ErmesTeams.Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Name).ToListAsync(ct);
        var ids = teams.Select(t => t.Id).ToList();
        var members = await _db.ErmesTeamMembers
            .Where(m => m.TenantId == tenantId && ids.Contains(m.TeamId))
            .ToListAsync(ct);
        return teams.Select(t => new ErmesTeamDto(
            t.Id, t.Name, t.Description,
            members.Where(m => m.TeamId == t.Id)
                .Select(m => new ErmesContactDto(m.UserId, m.UserDisplay, m.UserEmail, "AgencyUser"))
                .ToList())).ToList();
    }
}

public record CreateErmesTeamCommand(
    string Name, string? Description, IReadOnlyList<Guid> MemberUserIds) : IRequest<Guid>;

public class CreateErmesTeamHandler : IRequestHandler<CreateErmesTeamCommand, Guid>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateErmesTeamHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Guid> Handle(CreateErmesTeamCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(r.Name)) throw AppException.Validation("Απαιτείται όνομα ομάδας.");

        var team = new ErmesTeam
        {
            TenantId = tenantId,
            Name = r.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim(),
            CreatedByUserId = userId,
        };
        _db.ErmesTeams.Add(team);

        var wanted = (r.MemberUserIds ?? new List<Guid>()).Distinct().Where(id => id != Guid.Empty).ToList();
        if (wanted.Count > 0)
        {
            var users = await _db.Users
                .Where(u => wanted.Contains(u.Id) && u.TenantId == tenantId && u.DeletedAt == null)
                .ToListAsync(ct);
            foreach (var u in users)
            {
                _db.ErmesTeamMembers.Add(new ErmesTeamMember
                {
                    TenantId = tenantId,
                    TeamId = team.Id,
                    UserId = u.Id,
                    UserDisplay = ($"{u.FirstName} {u.LastName}").Trim(),
                    UserEmail = u.Email,
                });
            }
        }
        await _db.SaveChangesAsync(ct);
        return team.Id;
    }
}

public record DeleteErmesTeamCommand(Guid Id) : IRequest;

public class DeleteErmesTeamHandler : IRequestHandler<DeleteErmesTeamCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteErmesTeamHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task Handle(DeleteErmesTeamCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var team = await _db.ErmesTeams
            .FirstOrDefaultAsync(t => t.Id == r.Id && t.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Team");
        team.DeletedAt = DateTime.UtcNow;
        var members = await _db.ErmesTeamMembers
            .Where(m => m.TenantId == tenantId && m.TeamId == r.Id && m.DeletedAt == null)
            .ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var m in members) m.DeletedAt = now;
        await _db.SaveChangesAsync(ct);
    }
}

// ─── Blocks ──────────────────────────────────────────────────────────

public record ListErmesBlocksQuery : IRequest<IReadOnlyList<ErmesBlockDto>>;

public class ListErmesBlocksHandler : IRequestHandler<ListErmesBlocksQuery, IReadOnlyList<ErmesBlockDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListErmesBlocksHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ErmesBlockDto>> Handle(ListErmesBlocksQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        return await _db.ErmesBlocks
            .Where(b => b.TenantId == tenantId && b.OwnerUserId == userId)
            .OrderBy(b => b.BlockedDisplay)
            .Select(b => new ErmesBlockDto(b.Id, b.BlockedUserId, b.BlockedDisplay,
                b.BlockedEmail, b.Reason, b.CreatedAt))
            .ToListAsync(ct);
    }
}

public record BlockErmesUserCommand(Guid BlockedUserId, string? Reason) : IRequest;

public class BlockErmesUserHandler : IRequestHandler<BlockErmesUserCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public BlockErmesUserHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task Handle(BlockErmesUserCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        if (r.BlockedUserId == Guid.Empty || r.BlockedUserId == userId) return;

        var already = await _db.ErmesBlocks.FirstOrDefaultAsync(b =>
            b.TenantId == tenantId && b.OwnerUserId == userId && b.BlockedUserId == r.BlockedUserId, ct);
        if (already != null)
        {
            already.Reason = r.Reason;
            already.DeletedAt = null;
            await _db.SaveChangesAsync(ct);
            return;
        }
        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == r.BlockedUserId && u.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("User");
        _db.ErmesBlocks.Add(new ErmesBlock
        {
            TenantId = tenantId,
            OwnerUserId = userId,
            BlockedUserId = target.Id,
            BlockedDisplay = ($"{target.FirstName} {target.LastName}").Trim(),
            BlockedEmail = target.Email,
            Reason = string.IsNullOrWhiteSpace(r.Reason) ? null : r.Reason.Trim(),
        });
        await _db.SaveChangesAsync(ct);
    }
}

public record UnblockErmesUserCommand(Guid Id) : IRequest;

public class UnblockErmesUserHandler : IRequestHandler<UnblockErmesUserCommand>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UnblockErmesUserHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task Handle(UnblockErmesUserCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        var b = await _db.ErmesBlocks.FirstOrDefaultAsync(x => x.Id == r.Id
            && x.TenantId == tenantId && x.OwnerUserId == userId, ct)
            ?? throw AppException.NotFound("Block");
        b.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

// ─── Attachments (upload while composing, download while reading) ────

/// <summary>
/// Uploads live under a scratch row (MessageId = Guid.Empty) until the
/// composing user actually sends the message — the SendErmesHandler
/// then re-parents the scratch rows into the freshly-created message.
/// Cap at 16 MB per file, matching the /documents upload limit.
/// </summary>
public record UploadErmesAttachmentCommand(
    string FileName, string MimeType, byte[] Content) : IRequest<ErmesAttachmentDto>;

public class UploadErmesAttachmentHandler : IRequestHandler<UploadErmesAttachmentCommand, ErmesAttachmentDto>
{
    private const int MaxBytes = 16 * 1024 * 1024;   // 16 MB
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UploadErmesAttachmentHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ErmesAttachmentDto> Handle(UploadErmesAttachmentCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();
        if (r.Content == null || r.Content.Length == 0)
            throw AppException.Validation("Το αρχείο είναι κενό.");
        if (r.Content.Length > MaxBytes)
            throw AppException.Validation($"Μέγιστο μέγεθος {MaxBytes / (1024 * 1024)} MB.");

        var att = new ErmesAttachment
        {
            TenantId = tenantId,
            MessageId = Guid.Empty,           // scratch — SendCommand re-parents
            FileName = string.IsNullOrWhiteSpace(r.FileName) ? "attachment" : r.FileName,
            MimeType = string.IsNullOrWhiteSpace(r.MimeType) ? "application/octet-stream" : r.MimeType,
            SizeBytes = r.Content.LongLength,
            ContentBytes = r.Content,
            UploadedByUserId = userId,
        };
        _db.ErmesAttachments.Add(att);
        await _db.SaveChangesAsync(ct);
        return new ErmesAttachmentDto(att.Id, att.FileName, att.MimeType, att.SizeBytes);
    }
}

public record DownloadErmesAttachmentQuery(Guid Id)
    : IRequest<(string FileName, string MimeType, byte[] Content)>;

public class DownloadErmesAttachmentHandler
    : IRequestHandler<DownloadErmesAttachmentQuery, (string FileName, string MimeType, byte[] Content)>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DownloadErmesAttachmentHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<(string FileName, string MimeType, byte[] Content)> Handle(
        DownloadErmesAttachmentQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();

        var att = await _db.ErmesAttachments
            .FirstOrDefaultAsync(a => a.Id == r.Id && a.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Attachment");

        // Scratch rows (unsent) can only be seen by the uploader.
        if (att.MessageId == Guid.Empty)
        {
            if (att.UploadedByUserId != userId) throw AppException.Forbidden();
        }
        else
        {
            // Sent messages: sender + any recipient may fetch.
            var msg = await _db.ErmesMessages
                .FirstOrDefaultAsync(m => m.Id == att.MessageId && m.TenantId == tenantId, ct)
                ?? throw AppException.NotFound("Message");
            var isRecipient = await _db.ErmesRecipients
                .AnyAsync(rr => rr.TenantId == tenantId && rr.MessageId == msg.Id
                    && rr.RecipientUserId == userId, ct);
            if (msg.SenderUserId != userId && !isRecipient) throw AppException.Forbidden();
        }
        return (att.FileName, att.MimeType, att.ContentBytes);
    }
}

// ─── Channel feed (Discord-style shared thread per team) ────────────

public record ListErmesChannelMessagesQuery(Guid TeamId, int Take = 100)
    : IRequest<IReadOnlyList<ErmesMessageDto>>;

public class ListErmesChannelMessagesHandler
    : IRequestHandler<ListErmesChannelMessagesQuery, IReadOnlyList<ErmesMessageDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListErmesChannelMessagesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ErmesMessageDto>> Handle(
        ListErmesChannelMessagesQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId   = _current.UserId   ?? throw AppException.Forbidden();

        // Membership check — only team members (or its author) may read
        // the channel feed. Everyone else gets Forbidden.
        var team = await _db.ErmesTeams
            .FirstOrDefaultAsync(t => t.Id == r.TeamId && t.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Channel");
        var isMember = await _db.ErmesTeamMembers.AnyAsync(m =>
            m.TenantId == tenantId && m.TeamId == r.TeamId && m.UserId == userId, ct);
        if (!isMember && team.CreatedByUserId != userId) throw AppException.Forbidden();

        var take = Math.Clamp(r.Take, 1, 200);
        var msgs = await _db.ErmesMessages
            .Where(x => x.TenantId == tenantId && x.ChannelId == r.TeamId
                && x.SenderFolder != "Draft")
            .OrderByDescending(x => x.SentAt ?? x.CreatedAt)
            .Take(take)
            .ToListAsync(ct);

        var msgIds = msgs.Select(x => x.Id).ToList();
        var recs = await _db.ErmesRecipients
            .Where(x => x.TenantId == tenantId && msgIds.Contains(x.MessageId))
            .ToListAsync(ct);
        var atts = await _db.ErmesAttachments
            .Where(x => x.TenantId == tenantId && msgIds.Contains(x.MessageId))
            .Select(x => new { x.Id, x.MessageId, x.FileName, x.MimeType, x.SizeBytes })
            .ToListAsync(ct);

        return msgs.Select(m => new ErmesMessageDto(
            m.Id, m.ThreadId, m.InReplyToMessageId,
            m.SenderUserId, m.SenderDisplay, m.SenderEmail,
            m.Subject, m.BodyHtml, m.Preview,
            Folder: m.SenderFolder,
            IsRead: true, IsStarred: m.SenderStarred,
            IsImportant: m.IsImportant, IsDraft: false,
            AutomationSource: m.AutomationSource,
            Category: m.Category,
            ExternalEmailRequested: m.ExternalEmailRequested,
            ExternalEmailDelivered: m.ExternalEmailDelivered,
            ExternalEmailStatus: m.ExternalEmailStatus,
            CreatedAt: m.CreatedAt, SentAt: m.SentAt,
            Recipients: recs.Where(rr => rr.MessageId == m.Id && rr.Kind != "Bcc")
                .Select(rr => new ErmesRecipientDto(
                    rr.RecipientUserId, rr.RecipientDisplay, rr.RecipientEmail,
                    rr.Kind, rr.IsRead, rr.IsStarred)).ToList(),
            Attachments: atts.Where(a => a.MessageId == m.Id)
                .Select(a => new ErmesAttachmentDto(a.Id, a.FileName, a.MimeType, a.SizeBytes)).ToList(),
            EncryptedEnvelopesJson: m.EncryptedEnvelopesJson
        )).ToList();
    }
}
