using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

public record AffiliateReferralOfficeDto(Guid Id, string Name, DateTime CreatedAt);

public record AffiliateProgressDto(
    string ReferralCode,
    int ActiveReferrals,
    int Goal,
    bool LifetimeFreeUnlocked,
    IReadOnlyList<AffiliateReferralOfficeDto> Offices
);

public record GetAffiliateProgressQuery() : IRequest<AffiliateProgressDto>;

public sealed class GetAffiliateProgressQueryHandler
    : IRequestHandler<GetAffiliateProgressQuery, AffiliateProgressDto>
{
    private const int Goal = 5;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetAffiliateProgressQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<AffiliateProgressDto> Handle(GetAffiliateProgressQuery request, CancellationToken ct)
    {
        if (!_current.IsAuthenticated || _current.TenantId is not Guid tenantId)
            throw AppException.Unauthorized();

        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.Id == tenantId && t.DeletedAt == null)
            .Select(t => new { t.Id, t.ContactEmail, t.AffiliateLifetimeFreeUnlocked })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Tenant");

        var offices = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.ReferredByTenantId == tenant.Id && t.IsActive && t.DeletedAt == null)
            .OrderBy(t => t.CreatedAt)
            .Select(t => new AffiliateReferralOfficeDto(t.Id, t.Name, t.CreatedAt))
            .ToListAsync(ct);

        return new AffiliateProgressDto(
            AffiliateReferralCode.ForTenant(tenant.Id, tenant.ContactEmail),
            offices.Count,
            Goal,
            tenant.AffiliateLifetimeFreeUnlocked || offices.Count >= Goal,
            offices);
    }
}
