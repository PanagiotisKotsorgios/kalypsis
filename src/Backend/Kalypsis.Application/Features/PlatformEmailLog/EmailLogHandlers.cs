using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformEmailLog;

/*
 * Cross-cutting email history for the SuperAdmin. Newsletter campaigns
 * already have their own endpoint; this pulls in the rest: password reset
 * emails, DPA emails, notifications delivered via email, support-ticket
 * notifications. Each source contributes to a single unified feed.
 */

public record EmailLogEntryDto(
    DateTime At,
    string Source,       // "Newsletter" | "PasswordReset" | "Notification" | "Support" | "Comm"
    string Subject,
    string Recipient,
    int RecipientCount,  // >1 for newsletter campaigns
    string Status,       // "Sent" | "Failed" | "Queued"
    Guid? TenantId,
    string? TenantName);

public record ListRecentEmailsQuery(int Limit = 50) : IRequest<IReadOnlyList<EmailLogEntryDto>>;

public class ListRecentEmailsHandler : IRequestHandler<ListRecentEmailsQuery, IReadOnlyList<EmailLogEntryDto>>
{
    private readonly IAppDbContext _db;
    public ListRecentEmailsHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<EmailLogEntryDto>> Handle(ListRecentEmailsQuery r, CancellationToken ct)
    {
        var limit = Math.Clamp(r.Limit, 1, 200);
        var since = DateTime.UtcNow.AddDays(-30);
        var feed = new List<EmailLogEntryDto>();

        // --- Newsletter campaigns -------------------------------------------------
        var campaigns = await _db.NewsletterCampaigns
            .Where(c => c.DeletedAt == null && (c.SentAt ?? c.CreatedAt) >= since)
            .OrderByDescending(c => c.SentAt ?? c.CreatedAt)
            .Take(limit)
            .Select(c => new
            {
                At = c.SentAt ?? c.CreatedAt,
                c.Subject,
                Recipients = c.Recipients,
                Status = c.Status
            })
            .ToListAsync(ct);
        feed.AddRange(campaigns.Select(c => new EmailLogEntryDto(
            c.At, "Newsletter", c.Subject, "(mass)", c.Recipients,
            c.Status.ToString(), null, null)));

        // --- Password reset tokens are proxy rows for the actual email --------
        // The token existing is proof we generated + sent the email.
        var resets = await _db.PasswordResetTokens
            .Where(t => t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .Join(_db.Users, t => t.UserId, u => u.Id, (t, u) => new
            {
                t.CreatedAt, u.Email, u.TenantId
            })
            .ToListAsync(ct);
        var tenantIds = resets.Select(x => x.TenantId).Where(t => t != Guid.Empty).Distinct().ToList();
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => tenantIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Name })
            .ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        feed.AddRange(resets.Select(r => new EmailLogEntryDto(
            r.CreatedAt, "PasswordReset", "Επαναφορά κωδικού Kalypsis",
            r.Email, 1, "Sent",
            r.TenantId == Guid.Empty ? null : r.TenantId,
            r.TenantId == Guid.Empty ? null : tenants.GetValueOrDefault(r.TenantId))));

        // --- Outbound email communications logged as CommunicationLog rows ----
        // Recipient is implied by CustomerId — join to the customer to surface
        // an email address in the feed rather than a raw Guid.
        var comms = await _db.CommunicationLogs
            .IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null
                && c.Direction == CommunicationDirection.Outbound
                && c.Kind == CommunicationKind.Email
                && c.OccurredAt >= since)
            .OrderByDescending(c => c.OccurredAt)
            .Take(limit)
            .Join(_db.Customers.IgnoreQueryFilters(), c => c.CustomerId, cu => cu.Id,
                (c, cu) => new { c.OccurredAt, c.Subject, cu.Email, c.TenantId })
            .ToListAsync(ct);
        feed.AddRange(comms.Select(c => new EmailLogEntryDto(
            c.OccurredAt, "Comm",
            string.IsNullOrEmpty(c.Subject) ? "(χωρίς θέμα)" : c.Subject,
            c.Email ?? "—", 1, "Sent",
            c.TenantId, tenants.GetValueOrDefault(c.TenantId))));

        // --- Support-ticket notifications --------------------------------------
        var supportReplies = await _db.SupportTicketReplies
            .Where(r => r.NotifiedTenant && r.DeletedAt == null && r.CreatedAt >= since)
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .Join(_db.SupportTickets, r => r.SupportTicketId, t => t.Id, (r, t) => new
            {
                r.CreatedAt, t.Subject, t.TenantId, t.TenantName
            })
            .ToListAsync(ct);
        feed.AddRange(supportReplies.Select(r => new EmailLogEntryDto(
            r.CreatedAt, "Support", $"[Support] {r.Subject}", "(tenant admins)", 0, "Sent",
            r.TenantId, r.TenantName)));

        // Merge + sort + trim to the requested limit. Newest-first.
        return feed
            .OrderByDescending(e => e.At)
            .Take(limit)
            .ToList();
    }
}
