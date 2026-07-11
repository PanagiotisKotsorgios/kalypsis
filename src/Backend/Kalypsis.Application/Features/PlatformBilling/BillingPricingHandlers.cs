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
    string? Notes,
    /// <summary>True when a TenantPackageGrant row exists for this
    /// (tenant, package) — regardless of price. The frontend uses it to
    /// distinguish "granted without a price" (bug case) from "not
    /// granted" and to gate the revoke button.</summary>
    bool Granted = false);

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
                    g.Notes,
                    Granted: true))
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
    private readonly IPackageService _packages;
    public SetTenantPackagePriceCommandHandler(IAppDbContext db, ICurrentUser currentUser, IPackageService packages)
    { _db = db; _currentUser = currentUser; _packages = packages; }

    public async Task<TenantPackagePriceDto> Handle(SetTenantPackagePriceCommand r, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        // Grants are pulled with IgnoreQueryFilters so we can revive a
        // soft-deleted one instead of inserting a duplicate (there's a
        // unique constraint on (TenantId, Package)).
        var grant = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.TenantId == r.TenantId && g.Package == r.Package, ct);

        // ── Case A ── Clearing the price ("—") means "this package is no
        // longer sold to this tenant" — revoke access. Previously we kept
        // the grant alive with MonthlyPrice=null, which meant the tenant
        // still saw the feature in their sidebar. That was the reported
        // «Lanca IKE keeps having CRM even after I cleared its price» bug.
        if (r.MonthlyPrice is null)
        {
            if (grant is not null && grant.DeletedAt is null)
            {
                grant.DeletedAt = DateTime.UtcNow;
                grant.MonthlyPrice = null;
                grant.Currency = r.Currency.ToUpperInvariant();
                await _db.SaveChangesAsync(ct);
            }
            _packages.InvalidateCache(r.TenantId);

            // Return a "no grant" DTO — MonthlyPrice=null, EnabledAt=epoch
            // so the frontend renders «—».
            return new TenantPackagePriceDto(
                tenant.Id, tenant.Name, tenant.Code,
                r.Package.ToString(), null, r.Currency.ToUpperInvariant(),
                grant?.EnabledAt ?? default, grant?.Notes,
                Granted: false);
        }

        // ── Case B ── Setting a non-null price implies enabling the
        // package. If a soft-deleted grant is on file, revive it instead of
        // inserting a duplicate; otherwise create fresh.
        if (grant is null)
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
        else if (grant.DeletedAt is not null)
        {
            grant.DeletedAt = null;
            grant.EnabledAt = DateTime.UtcNow;
            grant.EnabledByUserId = _currentUser.UserId;
        }

        grant.MonthlyPrice = r.MonthlyPrice;
        grant.Currency = r.Currency.ToUpperInvariant();
        await _db.SaveChangesAsync(ct);
        _packages.InvalidateCache(r.TenantId);

        return new TenantPackagePriceDto(
            tenant.Id, tenant.Name, tenant.Code,
            grant.Package.ToString(), grant.MonthlyPrice, grant.Currency,
            grant.EnabledAt, grant.Notes,
            Granted: true);
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
