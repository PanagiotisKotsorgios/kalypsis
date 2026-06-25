using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformNewsletter;

// ============================================================================
// Platform-admin newsletter management — list subscribers, send broadcasts,
// view past campaigns. All endpoints expect the PlatformAdmin role.
// ============================================================================

public record SubscriberDto(
    Guid Id, string Email, string? Source, DateTime CreatedAt, DateTime? UnsubscribedAt);

public record CampaignDto(
    Guid Id, string Subject, string Status,
    int Recipients, int Sent, int Failed,
    DateTime? SentAt, DateTime CreatedAt);

public record CampaignDetailDto(
    Guid Id, string Subject, string HtmlBody, string? TextBody,
    string Status, int Recipients, int Sent, int Failed,
    DateTime? SentAt, DateTime CreatedAt);

/* ===== List subscribers ===== */
public record ListSubscribersQuery() : IRequest<IReadOnlyList<SubscriberDto>>;

public class ListSubscribersHandler : IRequestHandler<ListSubscribersQuery, IReadOnlyList<SubscriberDto>>
{
    private readonly IAppDbContext _db;
    public ListSubscribersHandler(IAppDbContext db) { _db = db; }
    public async Task<IReadOnlyList<SubscriberDto>> Handle(ListSubscribersQuery _, CancellationToken ct)
    {
        return await _db.NewsletterSubscribers.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new SubscriberDto(x.Id, x.Email, x.Source, x.CreatedAt, x.UnsubscribedAt))
            .ToListAsync(ct);
    }
}

/* ===== Delete subscriber ===== */
public record DeleteSubscriberCommand(Guid Id) : IRequest<Unit>;
public class DeleteSubscriberHandler : IRequestHandler<DeleteSubscriberCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteSubscriberHandler(IAppDbContext db) { _db = db; }
    public async Task<Unit> Handle(DeleteSubscriberCommand c, CancellationToken ct)
    {
        var s = await _db.NewsletterSubscribers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == c.Id, ct) ?? throw AppException.NotFound("Subscriber");
        s.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ===== List campaigns ===== */
public record ListCampaignsQuery() : IRequest<IReadOnlyList<CampaignDto>>;
public class ListCampaignsHandler : IRequestHandler<ListCampaignsQuery, IReadOnlyList<CampaignDto>>
{
    private readonly IAppDbContext _db;
    public ListCampaignsHandler(IAppDbContext db) { _db = db; }
    public async Task<IReadOnlyList<CampaignDto>> Handle(ListCampaignsQuery _, CancellationToken ct)
    {
        return await _db.NewsletterCampaigns.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CampaignDto(x.Id, x.Subject, x.Status,
                x.Recipients, x.Sent, x.Failed, x.SentAt, x.CreatedAt))
            .ToListAsync(ct);
    }
}

/* ===== Send broadcast =====
   Sequentially fans out one email per active subscriber. Tracks Sent / Failed
   counters so partial outages don't bring down the whole batch. */
public record SendCampaignBody(string Subject, string HtmlBody, string? TextBody);
public record SendCampaignCommand(SendCampaignBody Body, Guid? UserId) : IRequest<CampaignDto>;

public class SendCampaignHandler : IRequestHandler<SendCampaignCommand, CampaignDto>
{
    private readonly IAppDbContext _db;
    private readonly IEmailSender _email;
    public SendCampaignHandler(IAppDbContext db, IEmailSender email) { _db = db; _email = email; }

    public async Task<CampaignDto> Handle(SendCampaignCommand c, CancellationToken ct)
    {
        var subject = (c.Body.Subject ?? "").Trim();
        var html    = (c.Body.HtmlBody ?? "").Trim();
        if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(html))
            throw new AppException("invalid_campaign", "Θέμα και περιεχόμενο είναι υποχρεωτικά.", 400);

        var subs = await _db.NewsletterSubscribers.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null && x.UnsubscribedAt == null)
            .Select(x => x.Email).ToListAsync(ct);

        var campaign = new NewsletterCampaign
        {
            Id = Guid.NewGuid(),
            Subject = subject,
            HtmlBody = html,
            TextBody = c.Body.TextBody,
            SentByUserId = c.UserId,
            Recipients = subs.Count,
            Status = "Sending"
        };
        _db.NewsletterCampaigns.Add(campaign);
        await _db.SaveChangesAsync(ct);

        int sent = 0, failed = 0;
        foreach (var to in subs)
        {
            try
            {
                var res = await _email.SendAsync(new EmailMessage(
                    to, to.Split('@')[0], subject, html, c.Body.TextBody), ct);
                if (res.Success) sent++; else failed++;
            }
            catch { failed++; }
        }

        campaign.Sent = sent;
        campaign.Failed = failed;
        campaign.Status = failed == 0 ? "Sent" : (sent == 0 ? "Failed" : "PartialFailure");
        campaign.SentAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new CampaignDto(campaign.Id, campaign.Subject, campaign.Status,
            campaign.Recipients, campaign.Sent, campaign.Failed,
            campaign.SentAt, campaign.CreatedAt);
    }
}
