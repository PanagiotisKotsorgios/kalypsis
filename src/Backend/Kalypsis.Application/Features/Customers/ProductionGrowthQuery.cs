using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record GrowthProducerDto(Guid Id, string Name);
public record GrowthFamilyDto(Guid CustomerId, string Name, string Relationship);
public record ProductionGrowthRowDto(
    string Id, Guid? NeedId, Guid CustomerId, string CustomerNumber, string CustomerName,
    string CustomerType, string CustomerStatus, string? City, string? Occupation, string? Email, string? Phone,
    string? NeedKind, string NeedTitle, bool? HasAsset, bool? IsInsured, int Priority,
    DateOnly? NextContactAt, string? Notes, bool IsOpportunity, string CoverageState, string Reason,
    IReadOnlyList<string> AssetKinds, IReadOnlyList<string> ActivePolicyTypes, int ActivePolicyCount,
    IReadOnlyList<GrowthProducerDto> Producers, IReadOnlyList<GrowthFamilyDto> Family);

public record GetProductionGrowthQuery : IRequest<IReadOnlyList<ProductionGrowthRowDto>>;

/// <summary>One row per recorded need, or one explicitly unknown row for a customer without needs.
/// Reads the existing family/needs data in bounded query count, never one API call per customer.
/// Normal EF tenant, office and soft-deletion filters remain in force for every source.</summary>
public sealed class GetProductionGrowthHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    : IRequestHandler<GetProductionGrowthQuery, IReadOnlyList<ProductionGrowthRowDto>>
{
    public async Task<IReadOnlyList<ProductionGrowthRowDto>> Handle(GetProductionGrowthQuery request, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var visibleCustomers = db.Customers.AsNoTracking().Where(c => c.TenantId == tenantId && c.DeletedAt == null);
        var people = await visibleCustomers.OrderBy(c => c.CustomerNumber).Select(c => new
        {
            c.Id, c.CustomerNumber, c.Type, c.Status, c.FirstName, c.LastName, c.CompanyName,
            c.City, c.Occupation, c.Email, Phone = c.MobilePhone ?? c.Phone
        }).ToListAsync(ct);
        var ids = visibleCustomers.Select(c => c.Id);
        var needs = await db.CustomerInsuranceNeeds.AsNoTracking()
            .Where(n => n.TenantId == tenantId && n.DeletedAt == null && ids.Contains(n.CustomerId))
            .OrderByDescending(n => n.Priority).ThenBy(n => n.Kind).ToListAsync(ct);
        var policies = await db.Policies.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null && ids.Contains(p.CustomerId))
            .Select(p => new { p.CustomerId, p.Status, p.PolicyType, p.ProducerId, p.StartDate, p.EndDate }).ToListAsync(ct);
        var producers = await db.Producers.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => new GrowthProducerDto(p.Id, p.Name)).ToDictionaryAsync(p => p.Id, ct);
        var relationships = await db.CustomerRelationships.AsNoTracking()
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null
                && ids.Contains(r.CustomerId) && ids.Contains(r.RelatedCustomerId))
            .Select(r => new { r.CustomerId, r.RelatedCustomerId, r.RelationshipType }).ToListAsync(ct);

        var names = people.ToDictionary(c => c.Id, c => c.Type == CustomerType.Company
            ? c.CompanyName ?? c.CustomerNumber : $"{c.FirstName} {c.LastName}".Trim());
        var needsByCustomer = needs.ToLookup(n => n.CustomerId);
        var policiesByCustomer = policies.ToLookup(p => p.CustomerId);
        var familyByCustomer = relationships.ToLookup(r => r.CustomerId);
        var rows = new List<ProductionGrowthRowDto>();
        foreach (var customer in people)
        {
            var customerNeeds = needsByCustomer[customer.Id].ToList();
            var customerPolicies = policiesByCustomer[customer.Id].ToList();
            var active = customerPolicies.Where(p => CustomerFamilyQueries.IsCurrentInsurance(p.Status, p.StartDate, p.EndDate, today)).ToList();
            var activeTypes = active.Select(p => p.PolicyType.ToString()).ToHashSet();
            var assets = customerNeeds.Where(n => n.HasAsset).Select(n => n.Kind).Distinct().Order().ToArray();
            var partners = customerPolicies.Where(p => p.ProducerId.HasValue && producers.ContainsKey(p.ProducerId.Value))
                .Select(p => producers[p.ProducerId!.Value]).DistinctBy(p => p.Id).OrderBy(p => p.Name).ToArray();
            var family = familyByCustomer[customer.Id].Select(r => new GrowthFamilyDto(
                r.RelatedCustomerId, names[r.RelatedCustomerId], r.RelationshipType.ToString())).Distinct().ToArray();
            ProductionGrowthRowDto Row(string id, Guid? needId, string? kind, string title, bool? hasAsset,
                bool? insured, int priority, DateOnly? next, string? notes, bool opportunity, string state, string reason) => new(
                id, needId, customer.Id, customer.CustomerNumber, names[customer.Id], customer.Type.ToString(),
                customer.Status.ToString(), customer.City, customer.Occupation, customer.Email, customer.Phone,
                kind, title, hasAsset, insured, priority, next, notes, opportunity, state, reason,
                assets, activeTypes.Order().ToArray(), active.Count, partners, family);

            if (customerNeeds.Count == 0)
                rows.Add(Row($"customer-{customer.Id}", null, null, "Δεν έχουν καταχωρηθεί ανάγκες", null, null,
                    0, null, null, false, "Unknown", "Δεν υπάρχουν καταχωρημένες ανάγκες. Απαιτείται επιβεβαίωση με τον πελάτη."));
            foreach (var need in customerNeeds)
            {
                var opportunity = CustomerFamilyQueries.IsOpportunity(need, activeTypes);
                var state = !need.HasAsset ? "NoAsset" : need.IsInsured ? "DeclaredInsured"
                    : opportunity ? "Uncovered" : "ActivePolicy";
                var reason = state switch
                {
                    "NoAsset" => "Η περιουσία / ανάγκη έχει δηλωθεί ως μη διαθέσιμη.",
                    "DeclaredInsured" => "Η ανάγκη έχει δηλωθεί ως ήδη ασφαλισμένη.",
                    "ActivePolicy" => "Υπάρχει συμβόλαιο ίδιου κλάδου σε ισχύ. Δεν τεκμηριώνεται αντιστοίχιση με τη συγκεκριμένη περιουσία· απαιτείται έλεγχος πριν από νέα πρόταση.",
                    _ => CustomerNeedCatalog.PolicyTypeFor(need.Kind) is null
                        ? "Καταχωρημένη ανάγκη χωρίς δηλωμένη ασφάλιση. Δεν υπάρχει ακριβής αντιστοίχιση με τους βασικούς κλάδους· απαιτείται έλεγχος των συμβολαίων πριν από πρόταση."
                        : "Καταχωρημένη ανάγκη χωρίς δηλωμένη ασφάλιση ή συμβόλαιο του αντίστοιχου κλάδου σε ισχύ σήμερα. Προς διερεύνηση για πρόταση ασφάλισης."
                };
                rows.Add(Row(need.Id.ToString(), need.Id, need.Kind, need.Title, need.HasAsset, need.IsInsured,
                    need.Priority, need.NextContactAt, need.Notes, opportunity, state, reason));
            }
        }
        return rows.OrderByDescending(r => r.IsOpportunity).ThenByDescending(r => r.Priority)
            .ThenBy(r => r.NextContactAt ?? DateOnly.MaxValue).ThenBy(r => r.CustomerNumber).ToArray();
    }
}
