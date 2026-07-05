using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

// Editable pricing catalog stored as a single JSON row in
// platform_pricings. GET returns the catalog; PUT overwrites it.
// The catalog is versioned (`version`) so future migrations of the
// shape can key off it. If no row exists, we return the seeded
// defaults — matches what the plans page used to hard-code.

public record PlanDefinitionDto(
    string Code,
    string Tagline,
    decimal PricePerUserYear,
    int IncludedOffices,
    int IncludedUsers,
    decimal ExtraOfficePerYear,
    decimal ExtraUserPerYear,
    string[] Packages);

public record AddonDefinitionDto(
    string Code,
    string Description,
    decimal PricePerUserYear);

public record ServiceDefinitionDto(
    string Code,
    string Description,
    string UnitLabel,
    decimal UnitPrice);

public record PricingCatalogDto(
    int Version,
    IReadOnlyList<PlanDefinitionDto> Plans,
    IReadOnlyList<AddonDefinitionDto> Addons,
    IReadOnlyList<ServiceDefinitionDto> Services);

public static class PricingDefaults
{
    public static PricingCatalogDto Build() => new(
        Version: 1,
        Plans: new[]
        {
            new PlanDefinitionDto("Producer", "Solo συνεργάτης · portal μόνο",
                PricePerUserYear: 90m, IncludedOffices: 0, IncludedUsers: 1,
                ExtraOfficePerYear: 0m, ExtraUserPerYear: 60m,
                Packages: new[] { "ProducerPortal" }),
            new PlanDefinitionDto("Standard", "1 γραφείο · κλασικές λειτουργίες",
                PricePerUserYear: 550m, IncludedOffices: 1, IncludedUsers: 4,
                ExtraOfficePerYear: 400m, ExtraUserPerYear: 450m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges" }),
            // NEW intermediate «Growth» plan — sweet spot for a 2-office
            // agency with 6 users that outgrew Standard but doesn't need
            // Premium's FrontOffice + Intelligence yet.
            new PlanDefinitionDto("Growth", "2 γραφεία · Standard + βασικό reporting",
                PricePerUserYear: 750m, IncludedOffices: 2, IncludedUsers: 6,
                ExtraOfficePerYear: 350m, ExtraUserPerYear: 600m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges", "Reporting" }),
            new PlanDefinitionDto("Premium", "Πλήρες σουίτα · priority support",
                PricePerUserYear: 1200m, IncludedOffices: 3, IncludedUsers: 10,
                ExtraOfficePerYear: 500m, ExtraUserPerYear: 950m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges",
                                  "FrontOffice", "Intelligence", "CustomIntegrations", "PrioritySupport" })
        },
        Addons: new[]
        {
            new AddonDefinitionDto("FrontOffice",        "Front office + καμπάνια εργαλεία",                  200m),
            new AddonDefinitionDto("Intelligence",       "Analytics + reports + benchmarks",                  150m),
            new AddonDefinitionDto("AdvancedBridges",    "Bridges premium — απεριόριστες γέφυρες + AI matching", 100m),
            new AddonDefinitionDto("PrioritySupport",    "SLA 4h · phone hotline",                             300m),
            new AddonDefinitionDto("CustomIntegrations", "Ενσωμάτωση με ERPs (SAP, Oracle) + custom APIs",     500m),
        },
        Services: new[]
        {
            new ServiceDefinitionDto("RemoteTraining",    "Εξ αποστάσεως εκπαίδευση (Zoom / Teams)", "ώρα",  15m),
            new ServiceDefinitionDto("OnsiteTraining",    "Εκπαίδευση στην έδρα του γραφείου",        "ώρα",  45m),
            new ServiceDefinitionDto("DataMigration",     "Migration από παλαιό σύστημα",              "flat", 500m),
            new ServiceDefinitionDto("CustomDevelopment", "Custom feature development",                "ώρα",  200m),
        });
}

/* ========= Get catalog ========= */

public record GetPricingCatalogQuery : IRequest<PricingCatalogDto>;

public class GetPricingCatalogHandler : IRequestHandler<GetPricingCatalogQuery, PricingCatalogDto>
{
    private readonly IAppDbContext _db;
    public GetPricingCatalogHandler(IAppDbContext db) => _db = db;

    public async Task<PricingCatalogDto> Handle(GetPricingCatalogQuery r, CancellationToken ct)
    {
        try
        {
            var row = await _db.PlatformPricings.IgnoreQueryFilters()
                .OrderBy(x => x.Id).FirstOrDefaultAsync(ct);
            if (row is null) return PricingDefaults.Build();
            try
            {
                var parsed = JsonSerializer.Deserialize<PricingCatalogDto>(row.CatalogJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                return parsed ?? PricingDefaults.Build();
            }
            catch { return PricingDefaults.Build(); }
        }
        catch { return PricingDefaults.Build(); }
    }
}

/* ========= Save catalog ========= */

public record SavePricingCatalogCommand(PricingCatalogDto Catalog) : IRequest<PricingCatalogDto>;

public class SavePricingCatalogHandler : IRequestHandler<SavePricingCatalogCommand, PricingCatalogDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public SavePricingCatalogHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<PricingCatalogDto> Handle(SavePricingCatalogCommand r, CancellationToken ct)
    {
        // Basic validation
        if (r.Catalog is null) throw new AppException("bad_body", "Missing catalog", 400);
        if (r.Catalog.Plans is null || r.Catalog.Plans.Count == 0)
            throw new AppException("bad_plans", "Χρειάζεται τουλάχιστον ένα πλάνο", 400);
        foreach (var p in r.Catalog.Plans)
        {
            if (string.IsNullOrWhiteSpace(p.Code)) throw new AppException("bad_plan", "Πλάνο χωρίς όνομα", 400);
            if (p.PricePerUserYear < 0 || p.ExtraOfficePerYear < 0 || p.ExtraUserPerYear < 0)
                throw new AppException("bad_price", $"Πλάνο {p.Code}: αρνητικές τιμές", 400);
        }

        var json = JsonSerializer.Serialize(r.Catalog);
        var row = await _db.PlatformPricings.IgnoreQueryFilters()
            .OrderBy(x => x.Id).FirstOrDefaultAsync(ct);
        if (row is null)
        {
            row = new PlatformPricing
            {
                Id = Guid.NewGuid(),
                CatalogJson = json,
                Version = r.Catalog.Version,
                LastUpdatedByUserId = _current.UserId
            };
            _db.PlatformPricings.Add(row);
        }
        else
        {
            row.CatalogJson = json;
            row.Version = r.Catalog.Version;
            row.LastUpdatedByUserId = _current.UserId;
        }
        await _db.SaveChangesAsync(ct);
        return r.Catalog;
    }
}
