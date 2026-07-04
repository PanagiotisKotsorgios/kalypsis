using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.ProducerPortal;

internal static class ProducerPortalScope
{
    // Resolve Producer.Id from the current user's row. Every producer-portal
    // handler needs this — factored to one place so the lookup pattern stays
    // consistent and we don't leak «wrong producer» rows if the JWT is stale.
    public static async Task<Guid> ResolveProducerIdAsync(
        IAppDbContext db, ICurrentUser current, CancellationToken ct)
    {
        var userId = current.UserId ?? throw AppException.Forbidden();
        var producerId = await db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId && u.DeletedAt == null)
            .Select(u => u.ProducerId)
            .FirstOrDefaultAsync(ct);
        if (producerId is null || producerId == Guid.Empty) throw AppException.Forbidden();
        return producerId.Value;
    }
}


// Producer-facing CRUD for their own «παραμετροποίηση προμηθειών» —
// what THEY think they should be earning per company × package × vehicle-use.
// Everything is scoped to the current producer via User.ProducerId; no
// cross-producer access is possible. Also used by the comparison view
// («Σύγκριση με γραφείο») which pairs each rate with the matching agency
// CommissionRule and shows the delta.

public record ExpectedRateDto(
    Guid Id,
    Guid? InsuranceCompanyId,
    string? InsuranceCompanyName,
    PolicyType? PolicyType,
    VehicleUseCategory? VehicleUseCategory,
    decimal ExpectedPercent,
    string? Notes);

public record UpsertExpectedRateBody(
    Guid? Id,
    Guid? InsuranceCompanyId,
    PolicyType? PolicyType,
    VehicleUseCategory? VehicleUseCategory,
    decimal ExpectedPercent,
    string? Notes);

/* ========= List ========= */

public record ListMyExpectedRatesQuery : IRequest<IReadOnlyList<ExpectedRateDto>>;

public class ListMyExpectedRatesHandler
    : IRequestHandler<ListMyExpectedRatesQuery, IReadOnlyList<ExpectedRateDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListMyExpectedRatesHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<IReadOnlyList<ExpectedRateDto>> Handle(ListMyExpectedRatesQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerId = await ProducerPortalScope.ResolveProducerIdAsync(_db, _current, ct);

        try
        {
            var rates = await _db.ProducerExpectedRates
                .Include(x => x.InsuranceCompany)
                .Where(x => x.TenantId == tenantId && x.ProducerId == producerId && x.DeletedAt == null)
                .OrderBy(x => x.InsuranceCompany != null ? x.InsuranceCompany.Name : "")
                .ThenBy(x => x.PolicyType)
                .ToListAsync(ct);
            return rates.Select(x => new ExpectedRateDto(
                x.Id, x.InsuranceCompanyId, x.InsuranceCompany?.Name,
                x.PolicyType, x.VehicleUseCategory,
                x.ExpectedPercent, x.Notes)).ToList();
        }
        catch { return Array.Empty<ExpectedRateDto>(); }
    }
}

/* ========= Upsert (create or update) ========= */

public record UpsertMyExpectedRateCommand(UpsertExpectedRateBody Body) : IRequest<ExpectedRateDto>;

public class UpsertMyExpectedRateHandler : IRequestHandler<UpsertMyExpectedRateCommand, ExpectedRateDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertMyExpectedRateHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<ExpectedRateDto> Handle(UpsertMyExpectedRateCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerId = await ProducerPortalScope.ResolveProducerIdAsync(_db, _current, ct);
        var b = r.Body;
        if (b.ExpectedPercent < 0 || b.ExpectedPercent > 100)
            throw new AppException("bad_percent", "Το ποσοστό πρέπει να είναι μεταξύ 0 και 100.", 400);

        ProducerExpectedRate? row = null;
        if (b.Id.HasValue)
        {
            row = await _db.ProducerExpectedRates
                .FirstOrDefaultAsync(x => x.Id == b.Id.Value && x.TenantId == tenantId
                    && x.ProducerId == producerId && x.DeletedAt == null, ct);
            if (row is null) throw AppException.NotFound("Παραμετροποίηση");
        }
        else
        {
            row = new ProducerExpectedRate
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ProducerId = producerId,
            };
            _db.ProducerExpectedRates.Add(row);
        }

        row.InsuranceCompanyId = b.InsuranceCompanyId;
        row.PolicyType = b.PolicyType;
        row.VehicleUseCategory = b.VehicleUseCategory;
        row.ExpectedPercent = decimal.Round(b.ExpectedPercent, 2);
        row.Notes = string.IsNullOrWhiteSpace(b.Notes) ? null : b.Notes.Trim();

        await _db.SaveChangesAsync(ct);

        string? carrierName = null;
        if (row.InsuranceCompanyId.HasValue)
        {
            carrierName = await _db.InsuranceCompanies
                .Where(c => c.Id == row.InsuranceCompanyId.Value)
                .Select(c => c.Name).FirstOrDefaultAsync(ct);
        }

        return new ExpectedRateDto(row.Id, row.InsuranceCompanyId, carrierName,
            row.PolicyType, row.VehicleUseCategory, row.ExpectedPercent, row.Notes);
    }
}

/* ========= Delete ========= */

public record DeleteMyExpectedRateCommand(Guid Id) : IRequest<Unit>;

public class DeleteMyExpectedRateHandler : IRequestHandler<DeleteMyExpectedRateCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteMyExpectedRateHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteMyExpectedRateCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerId = await ProducerPortalScope.ResolveProducerIdAsync(_db, _current, ct);
        var row = await _db.ProducerExpectedRates
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId
                && x.ProducerId == producerId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετροποίηση");
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Comparison view (producer perspective) ========= */

public record ProducerRateComparisonRow(
    Guid? InsuranceCompanyId,
    string InsuranceCompanyName,
    PolicyType? PolicyType,
    VehicleUseCategory? VehicleUseCategory,
    decimal? MyExpectedPercent,
    decimal? AgencyConfiguredPercent,
    int PolicyCount,
    decimal PoliciesPremiumTotal,
    decimal MyExpectedAmount,
    decimal AgencyExpectedAmount,
    decimal DifferenceAmount,
    string Status);

public record GetMyRateComparisonQuery : IRequest<IReadOnlyList<ProducerRateComparisonRow>>;

// Walks the producer's own ExpectedRates AND the agency's CommissionRules
// scoped to this producer, unions them by (Company × PolicyType × VehicleUse)
// so every «leg» of the negotiation shows up even if only one side has
// declared a rate. Each row is annotated with the totals over active policies
// that fall in the scope, and a status the frontend colours accordingly.
public class GetMyRateComparisonHandler
    : IRequestHandler<GetMyRateComparisonQuery, IReadOnlyList<ProducerRateComparisonRow>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetMyRateComparisonHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<IReadOnlyList<ProducerRateComparisonRow>> Handle(
        GetMyRateComparisonQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var producerId = await ProducerPortalScope.ResolveProducerIdAsync(_db, _current, ct);

        var mine = await _db.ProducerExpectedRates
            .Where(x => x.TenantId == tenantId && x.ProducerId == producerId && x.DeletedAt == null)
            .ToListAsync(ct);
        var agency = await _db.CommissionRules
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.ProducerId == producerId)
            .ToListAsync(ct);
        var policies = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.Status == PolicyStatus.Active && p.ProducerId == producerId)
            .ToListAsync(ct);
        var carrierIds = mine.Where(x => x.InsuranceCompanyId.HasValue).Select(x => x.InsuranceCompanyId!.Value)
            .Concat(agency.Where(x => x.InsuranceCompanyId.HasValue).Select(x => x.InsuranceCompanyId!.Value))
            .Distinct().ToList();
        var carriers = await _db.InsuranceCompanies
            .Where(c => carrierIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        // Build the union of scope keys from both sides.
        var keys = new HashSet<(Guid?, PolicyType?, VehicleUseCategory?)>();
        foreach (var m in mine) keys.Add((m.InsuranceCompanyId, m.PolicyType, m.VehicleUseCategory));
        foreach (var a in agency) keys.Add((a.InsuranceCompanyId, a.PolicyType, a.VehicleUseCategory));

        var result = new List<ProducerRateComparisonRow>();
        foreach (var key in keys)
        {
            var (companyId, packageType, vehicleUse) = key;
            var myRate = mine.FirstOrDefault(m =>
                m.InsuranceCompanyId == companyId && m.PolicyType == packageType && m.VehicleUseCategory == vehicleUse);
            var agencyRule = agency.FirstOrDefault(a =>
                a.InsuranceCompanyId == companyId && a.PolicyType == packageType && a.VehicleUseCategory == vehicleUse);

            var agencyPct = agencyRule?.ProducerPercent
                ?? (agencyRule?.CommissionType == CommissionType.Percentage ? agencyRule?.Value : null);

            var scopedPolicies = policies.Where(p =>
                (!companyId.HasValue      || p.InsuranceCompanyId == companyId) &&
                (!packageType.HasValue    || p.PolicyType == packageType) &&
                (!vehicleUse.HasValue     || p.VehicleUseCategory == vehicleUse)
            ).ToList();
            var premiumTotal = scopedPolicies.Sum(p => p.Premium);
            var myAmount = decimal.Round(premiumTotal * (myRate?.ExpectedPercent ?? 0m) / 100m, 2);
            var agencyAmount = decimal.Round(premiumTotal * (agencyPct ?? 0m) / 100m, 2);
            var diff = decimal.Round(myAmount - agencyAmount, 2);

            string status;
            if (myRate is null) status = "no_mine";
            else if (agencyRule is null) status = "no_agency";
            else if (Math.Abs(diff) < 0.01m) status = "match";
            else if (Math.Abs(diff) < 5m) status = "diff_small";
            else status = "diff_large";

            var carrierLabel = companyId.HasValue && carriers.TryGetValue(companyId.Value, out var n)
                ? n : "Όλες οι εταιρείες";

            result.Add(new ProducerRateComparisonRow(
                companyId, carrierLabel, packageType, vehicleUse,
                myRate?.ExpectedPercent, agencyPct,
                scopedPolicies.Count, premiumTotal,
                myAmount, agencyAmount, diff, status));
        }

        return result.OrderBy(x => x.InsuranceCompanyName).ThenBy(x => x.PolicyType).ToList();
    }
}
