using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformBilling;

public record TenantPackagePriceDto(
    Guid TenantId, string TenantName, string TenantCode,
    string Package,
    decimal? MonthlyPrice,
    string Currency,
    DateTime EnabledAt,
    string? Notes);

public record TenantBillingRowDto(
    Guid TenantId, string TenantName, string TenantCode,
    bool TenantActive,
    IReadOnlyList<TenantPackagePriceDto> Packages,
    decimal MonthlyTotal,
    int PricedCount,
    int UnpricedCount,
    string Currency);

public record GetTenantBillingRowsQuery() : IRequest<IReadOnlyList<TenantBillingRowDto>>;

public class GetTenantBillingRowsQueryHandler
    : IRequestHandler<GetTenantBillingRowsQuery, IReadOnlyList<TenantBillingRowDto>>
{
    private readonly IAppDbContext _db;
    public GetTenantBillingRowsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<TenantBillingRowDto>> Handle(GetTenantBillingRowsQuery _, CancellationToken ct)
    {
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);

        var grants = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .Where(g => g.DeletedAt == null)
            .ToListAsync(ct);

        var rows = new List<TenantBillingRowDto>();
        foreach (var t in tenants)
        {
            var tenantGrants = grants
                .Where(g => g.TenantId == t.Id)
                .OrderBy(g => g.Package)
                .Select(g => new TenantPackagePriceDto(
                    t.Id, t.Name, t.Code,
                    g.Package.ToString(),
                    g.MonthlyPrice,
                    g.Currency,
                    g.EnabledAt == default ? g.CreatedAt : g.EnabledAt,
                    g.Notes))
                .ToList();

            var priced = tenantGrants.Where(g => g.MonthlyPrice.HasValue).ToList();
            var total = priced.Sum(g => g.MonthlyPrice!.Value);
            var currency = priced.FirstOrDefault()?.Currency ?? "EUR";

            rows.Add(new TenantBillingRowDto(
                t.Id, t.Name, t.Code, t.IsActive,
                tenantGrants,
                Math.Round(total, 2),
                priced.Count,
                tenantGrants.Count - priced.Count,
                currency));
        }
        return rows;
    }
}

public record SetTenantPackagePriceCommand(
    Guid TenantId, PackageCode Package, decimal? MonthlyPrice, string Currency)
    : IRequest<TenantPackagePriceDto>;

public class SetTenantPackagePriceCommandValidator : AbstractValidator<SetTenantPackagePriceCommand>
{
    public SetTenantPackagePriceCommandValidator()
    {
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        When(x => x.MonthlyPrice.HasValue, () =>
            RuleFor(x => x.MonthlyPrice!.Value).GreaterThanOrEqualTo(0));
    }
}

public class SetTenantPackagePriceCommandHandler
    : IRequestHandler<SetTenantPackagePriceCommand, TenantPackagePriceDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public SetTenantPackagePriceCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<TenantPackagePriceDto> Handle(SetTenantPackagePriceCommand r, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        // Auto-create the grant if the price is set for a package the tenant
        // doesn't have yet. Mirrors the superadmin's intent: "Pricing this
        // package implies enabling it."
        var grant = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.TenantId == r.TenantId && g.Package == r.Package && g.DeletedAt == null, ct);
        if (grant == null)
        {
            grant = new TenantPackageGrant
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                Package = r.Package,
                EnabledAt = DateTime.UtcNow,
                EnabledByUserId = _currentUser.UserId,
                Currency = r.Currency.ToUpperInvariant()
            };
            _db.TenantPackageGrants.Add(grant);
        }

        grant.MonthlyPrice = r.MonthlyPrice;
        grant.Currency = r.Currency.ToUpperInvariant();
        await _db.SaveChangesAsync(ct);

        return new TenantPackagePriceDto(
            tenant.Id, tenant.Name, tenant.Code,
            grant.Package.ToString(), grant.MonthlyPrice, grant.Currency,
            grant.EnabledAt, grant.Notes);
    }
}

public record PlatformBillingSummaryDto(
    decimal MonthlyTotal,
    decimal AnnualTotal,
    int TenantsTotal,
    int TenantsWithRevenue,
    decimal AverageRevenuePerTenant,
    string Currency,
    IReadOnlyList<PackageBreakdown> ByPackage);

public record PackageBreakdown(string Package, int TenantCount, decimal MonthlyTotal);

public record GetPlatformBillingSummaryQuery() : IRequest<PlatformBillingSummaryDto>;

public class GetPlatformBillingSummaryQueryHandler
    : IRequestHandler<GetPlatformBillingSummaryQuery, PlatformBillingSummaryDto>
{
    private readonly IAppDbContext _db;
    public GetPlatformBillingSummaryQueryHandler(IAppDbContext db) => _db = db;

    public async Task<PlatformBillingSummaryDto> Handle(GetPlatformBillingSummaryQuery _, CancellationToken ct)
    {
        var grants = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .Where(g => g.DeletedAt == null && g.MonthlyPrice != null)
            .ToListAsync(ct);

        var tenantsTotal = await _db.Tenants.IgnoreQueryFilters()
            .CountAsync(t => t.DeletedAt == null, ct);

        var total = grants.Sum(g => g.MonthlyPrice!.Value);
        var tenantsWithRevenue = grants.Select(g => g.TenantId).Distinct().Count();
        var avg = tenantsWithRevenue > 0 ? total / tenantsWithRevenue : 0m;
        var currency = grants.FirstOrDefault()?.Currency ?? "EUR";

        var byPackage = grants
            .GroupBy(g => g.Package)
            .OrderBy(g => g.Key)
            .Select(g => new PackageBreakdown(
                g.Key.ToString(),
                g.Select(x => x.TenantId).Distinct().Count(),
                Math.Round(g.Sum(x => x.MonthlyPrice!.Value), 2)))
            .ToList();

        return new PlatformBillingSummaryDto(
            Math.Round(total, 2),
            Math.Round(total * 12m, 2),
            tenantsTotal,
            tenantsWithRevenue,
            Math.Round(avg, 2),
            currency,
            byPackage);
    }
}
