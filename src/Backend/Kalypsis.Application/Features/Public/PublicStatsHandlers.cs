using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

public record PublicStatsDto(int Agencies, int Producers, int ActivePolicies, string Uptime);

public record GetPublicStatsQuery() : IRequest<PublicStatsDto>;

public class GetPublicStatsQueryHandler : IRequestHandler<GetPublicStatsQuery, PublicStatsDto>
{
    private readonly IAppDbContext _db;
    public GetPublicStatsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<PublicStatsDto> Handle(GetPublicStatsQuery _, CancellationToken ct)
    {
        // Real agencies = active tenants that aren't the internal PLATFORM tenant.
        var agencies = await _db.Tenants.IgnoreQueryFilters()
            .CountAsync(t => t.IsActive && t.DeletedAt == null && t.Code != "PLATFORM", ct);

        var producers = await _db.Producers.IgnoreQueryFilters()
            .CountAsync(p => p.DeletedAt == null && p.Status == ProducerStatus.Active, ct);

        var activePolicies = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(p => p.DeletedAt == null && p.Status == PolicyStatus.Active, ct);

        return new PublicStatsDto(agencies, producers, activePolicies, "99,98%");
    }
}

public record NewsletterSubscribeCommand(string Email, string? Source = null) : IRequest<Unit>;

public class NewsletterSubscribeCommandHandler : IRequestHandler<NewsletterSubscribeCommand, Unit>
{
    private readonly IAppDbContext _db;
    public NewsletterSubscribeCommandHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(NewsletterSubscribeCommand r, CancellationToken ct)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return Unit.Value; // silently ignore garbage — the UI already validates.

        var existing = await _db.NewsletterSubscribers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (existing is null)
        {
            _db.NewsletterSubscribers.Add(new NewsletterSubscriber
            {
                Email = email,
                Source = r.Source ?? "landing"
            });
            await _db.SaveChangesAsync(ct);
        }
        else if (existing.UnsubscribedAt.HasValue)
        {
            // Re-subscribe — clear the unsubscribed flag.
            existing.UnsubscribedAt = null;
            await _db.SaveChangesAsync(ct);
        }
        return Unit.Value;
    }
}

