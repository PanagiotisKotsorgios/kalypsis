using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.ProductionLists;

/// <summary>OR within each selection, AND across fields; shared by the list and every export.</summary>
public static class ProductionMultiFilters
{
    public static string[] Codes(string? single, IReadOnlyList<string>? multiple) =>
        (multiple ?? []).Append(single ?? "").Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    private static T[] Values<T>(T? single, IReadOnlyList<T>? multiple) where T : struct =>
        (multiple ?? []).Concat(single.HasValue ? [single.Value] : []).Distinct().ToArray();

    public static async Task<IQueryable<Policy>> ApplyAsync(IAppDbContext db, IQueryable<Policy> query, ProductionFilters f, CancellationToken ct)
    {
        if (new[] { f.InsuranceCompanyIds?.Count, f.ProducerIds?.Count, f.PolicyTypes?.Count, f.Statuses?.Count,
            f.VehicleUseCategories?.Count, f.CoverCodes?.Count, f.PackageCodes?.Count }.Any(count => count > 200))
            throw AppException.Validation("Επιλέξτε έως 200 τιμές ανά πεδίο φίλτρου.");
        var companies = Values(f.InsuranceCompanyId, f.InsuranceCompanyIds);
        if (companies.Length > 0)
        {
            // Preserve the existing broker → subcompany inclusion for EVERY selected broker.
            var ids = await db.InsuranceCompanies.Where(c => c.DeletedAt == null
                && (companies.Contains(c.Id) || (c.ParentCompanyId.HasValue && companies.Contains(c.ParentCompanyId.Value))))
                .Select(c => c.Id).ToListAsync(ct);
            query = query.Where(p => ids.Contains(p.InsuranceCompanyId));
        }
        var producers = Values(f.ProducerId, f.ProducerIds);
        if (producers.Length > 0) query = query.Where(p => p.ProducerId.HasValue && producers.Contains(p.ProducerId.Value));
        var branches = Codes(f.PolicyType?.ToString() ?? f.BranchCodeRaw, f.PolicyTypes);
        if (branches.Length > 0)
        {
            var types = branches.Where(value => Enum.TryParse<PolicyType>(value, true, out var parsed) && Enum.IsDefined(parsed))
                .Select(value => Enum.Parse<PolicyType>(value, true)).ToArray();
            var raw = branches.Where(value => !Enum.TryParse<PolicyType>(value, true, out var parsed) || !Enum.IsDefined(parsed)).ToArray();
            query = query.Where(p => types.Contains(p.PolicyType) || (p.CarrierBranchCode != null && raw.Contains(p.CarrierBranchCode)));
        }
        var statuses = Values(f.Status, f.Statuses);
        if (statuses.Length > 0) query = query.Where(p => statuses.Contains(p.Status));
        var uses = Codes(f.VehicleUseCategory?.ToString() ?? f.UseCodeRaw, f.VehicleUseCategories);
        if (uses.Length > 0)
        {
            var typed = uses.Where(value => Enum.TryParse<VehicleUseCategory>(value, true, out var parsed) && Enum.IsDefined(parsed))
                .Select(value => Enum.Parse<VehicleUseCategory>(value, true)).ToArray();
            var raw = uses.Where(value => !Enum.TryParse<VehicleUseCategory>(value, true, out var parsed) || !Enum.IsDefined(parsed)).ToArray();
            query = query.Where(p => (p.VehicleUseCategory.HasValue && typed.Contains(p.VehicleUseCategory.Value)) || (p.CarrierUseCode != null && raw.Contains(p.CarrierUseCode)));
        }
        return query;
    }
}
