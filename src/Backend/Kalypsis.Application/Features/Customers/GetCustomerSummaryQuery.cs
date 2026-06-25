using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

/// <summary>
/// One-shot summary card used by the customer detail page.
/// Pulls counts + lifetime totals + assigns a Premium / Gold / Standard tier
/// based on cumulative gross premium across all active policies.
/// </summary>
public record CustomerSummaryDto(
    int    ActivePolicyCount,
    int    TotalPolicyCount,
    decimal LifetimeGrossPremium,
    decimal CurrentYearGrossPremium,
    decimal LifetimeAgencyCommission,
    int    OpenClaimCount,
    int    TotalClaimCount,
    int    NotificationCount,
    int    CommunicationCount,
    string Tier,             // "Premium" | "Gold" | "Standard" | "Basic"
    string TierReason);      // human-readable explanation for the badge

public record GetCustomerSummaryQuery(Guid Id) : IRequest<CustomerSummaryDto>;

public class GetCustomerSummaryHandler : IRequestHandler<GetCustomerSummaryQuery, CustomerSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetCustomerSummaryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CustomerSummaryDto> Handle(GetCustomerSummaryQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        _ = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == q.Id && c.TenantId == tenantId && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");

        var policies = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.CustomerId == q.Id && p.DeletedAt == null)
            .Select(p => new { p.Status, p.Premium, p.StartDate, p.SpecialCommissionPercent })
            .ToListAsync(ct);

        var thisYear = DateTime.UtcNow.Year;
        var activePolicies = policies.Count(p => p.Status == PolicyStatus.Active);
        var totalPolicies  = policies.Count;
        var lifetimeGross  = policies.Sum(p => p.Premium);
        var yearGross      = policies.Where(p => p.StartDate.Year == thisYear).Sum(p => p.Premium);

        // Agency commission proxy: 20% incoming minus special partner cut (if any).
        var incomingPct = 20m;
        var agencyComm  = policies.Sum(p => {
            var partnerPct = p.SpecialCommissionPercent ?? 0m;
            return p.Premium * (incomingPct - partnerPct) / 100m;
        });

        // Claims hang off the policy — join via PolicyId → CustomerId.
        var customerPolicyIds = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.CustomerId == q.Id && p.DeletedAt == null)
            .Select(p => p.Id).ToListAsync(ct);
        var openClaims  = customerPolicyIds.Count == 0 ? 0
            : await _db.Claims.IgnoreQueryFilters()
                .CountAsync(x => customerPolicyIds.Contains(x.PolicyId) && x.DeletedAt == null
                              && (x.Status == ClaimStatus.Reported || x.Status == ClaimStatus.UnderReview
                               || x.Status == ClaimStatus.Approved), ct);
        var totalClaims = customerPolicyIds.Count == 0 ? 0
            : await _db.Claims.IgnoreQueryFilters()
                .CountAsync(x => customerPolicyIds.Contains(x.PolicyId) && x.DeletedAt == null, ct);

        // Notifications target the user that owns the customer portal account.
        var customerUserIds = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.CustomerId == q.Id && u.DeletedAt == null)
            .Select(u => u.Id).ToListAsync(ct);
        var notifications = customerUserIds.Count == 0 ? 0
            : await _db.Notifications.IgnoreQueryFilters()
                .CountAsync(n => customerUserIds.Contains(n.UserId) && n.DeletedAt == null, ct);

        var comms = await _db.CommunicationLogs.IgnoreQueryFilters()
            .CountAsync(x => x.CustomerId == q.Id && x.DeletedAt == null, ct);

        // Tiering — purely cumulative-premium based; tune from Παραμετροποίηση later.
        var (tier, why) = lifetimeGross switch
        {
            >= 10_000m => ("Premium", $"Συσσωρευμένο μεικτό {lifetimeGross:N0} € ≥ 10.000 €"),
            >=  5_000m => ("Gold",    $"Συσσωρευμένο μεικτό {lifetimeGross:N0} € ≥ 5.000 €"),
            >=  1_500m => ("Standard",$"Συσσωρευμένο μεικτό {lifetimeGross:N0} € ≥ 1.500 €"),
            _          => ("Basic",   $"Συσσωρευμένο μεικτό {lifetimeGross:N0} €")
        };

        return new CustomerSummaryDto(
            activePolicies, totalPolicies,
            lifetimeGross, yearGross, agencyComm,
            openClaims, totalClaims,
            notifications, comms,
            tier, why);
    }
}
