using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.AgencyProfile;

public record OnboardingStateDto(
    bool Completed,
    DateTime? CompletedAt,
    bool HasLogo,
    bool HasBrandColor,
    bool HasContact,
    int InsuranceCompanyCount,
    int CommissionRuleCount);

public record GetOnboardingStateQuery() : IRequest<OnboardingStateDto>;

public class GetOnboardingStateQueryHandler : IRequestHandler<GetOnboardingStateQuery, OnboardingStateDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetOnboardingStateQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<OnboardingStateDto> Handle(GetOnboardingStateQuery _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var companyCount = await _db.InsuranceCompanies.IgnoreQueryFilters().CountAsync(c => c.IsActive, ct);
        var ruleCount = await _db.CommissionRules.CountAsync(ct);

        return new OnboardingStateDto(
            t.OnboardingCompletedAt.HasValue,
            t.OnboardingCompletedAt,
            !string.IsNullOrWhiteSpace(t.LogoUrl),
            !string.IsNullOrWhiteSpace(t.BrandColorHex),
            !string.IsNullOrWhiteSpace(t.ContactEmail) || !string.IsNullOrWhiteSpace(t.ContactPhone),
            companyCount, ruleCount);
    }
}

public record CompleteOnboardingCommand() : IRequest<OnboardingStateDto>;

public class CompleteOnboardingCommandHandler : IRequestHandler<CompleteOnboardingCommand, OnboardingStateDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CompleteOnboardingCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<OnboardingStateDto> Handle(CompleteOnboardingCommand _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        t.OnboardingCompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var companyCount = await _db.InsuranceCompanies.IgnoreQueryFilters().CountAsync(c => c.IsActive, ct);
        var ruleCount = await _db.CommissionRules.CountAsync(ct);

        return new OnboardingStateDto(
            true, t.OnboardingCompletedAt,
            !string.IsNullOrWhiteSpace(t.LogoUrl),
            !string.IsNullOrWhiteSpace(t.BrandColorHex),
            !string.IsNullOrWhiteSpace(t.ContactEmail) || !string.IsNullOrWhiteSpace(t.ContactPhone),
            companyCount, ruleCount);
    }
}
