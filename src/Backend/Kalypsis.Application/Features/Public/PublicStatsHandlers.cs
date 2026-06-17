using Kalypsis.Application.Abstractions;
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

public record NewsletterSubscribeCommand(string Email) : IRequest<Unit>;

public class NewsletterSubscribeCommandHandler : IRequestHandler<NewsletterSubscribeCommand, Unit>
{
    public Task<Unit> Handle(NewsletterSubscribeCommand request, CancellationToken cancellationToken)
    {
        // No-op for now; in production this would push to Brevo / Mailchimp.
        // Returning success is intentional so the UX stays clean.
        return Task.FromResult(Unit.Value);
    }
}
