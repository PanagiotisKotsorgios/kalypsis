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
    /// <summary>Flat annual price for the whole plan (includes the default
    /// offices + users below). Extra offices / extra users cost the
    /// per-unit rates further down.</summary>
    decimal PricePerYear,
    int IncludedOffices,
    int IncludedUsers,
    decimal ExtraOfficePerYear,
    decimal ExtraUserPerYear,
    string[] Packages);

public record AddonDefinitionDto(
    string Code,
    string Description,
    /// <summary>Flat annual price added to the tenant's total when enabled.</summary>
    decimal PricePerYear);

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
                PricePerYear: 90m, IncludedOffices: 0, IncludedUsers: 1,
                ExtraOfficePerYear: 0m, ExtraUserPerYear: 60m,
                Packages: new[] { "ProducerPortal" }),
            new PlanDefinitionDto("Standard", "1 γραφείο · κλασικές λειτουργίες",
                PricePerYear: 550m, IncludedOffices: 1, IncludedUsers: 4,
                ExtraOfficePerYear: 400m, ExtraUserPerYear: 150m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges" }),
            // Intermediate «Growth» plan — sweet spot for a 2-office agency
            // with 6 users that outgrew Standard but doesn't need Premium
            // yet.
            new PlanDefinitionDto("Growth", "2 γραφεία · Standard + βασικό reporting",
                PricePerYear: 950m, IncludedOffices: 2, IncludedUsers: 6,
                ExtraOfficePerYear: 350m, ExtraUserPerYear: 180m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges", "Reporting" }),
            new PlanDefinitionDto("Premium", "Πλήρες σουίτα · priority support",
                PricePerYear: 1800m, IncludedOffices: 3, IncludedUsers: 10,
                ExtraOfficePerYear: 500m, ExtraUserPerYear: 240m,
                Packages: new[] { "BackOffice", "ClientPortal", "CRM", "AllBridges",
                                  "FrontOffice", "Intelligence", "CustomIntegrations", "PrioritySupport" })
        },
        Addons: new[]
        {
            new AddonDefinitionDto("FrontOffice",        "Front office + καμπάνια εργαλεία",                  400m),
            new AddonDefinitionDto("Intelligence",       "Analytics + reports + benchmarks",                  300m),
            new AddonDefinitionDto("AdvancedBridges",    "Bridges premium — απεριόριστες γέφυρες + AI matching", 200m),
            new AddonDefinitionDto("PrioritySupport",    "SLA 4h · phone hotline",                             600m),
            new AddonDefinitionDto("CustomIntegrations", "Ενσωμάτωση με ERPs (SAP, Oracle) + custom APIs",     1200m),
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

            // The JSON might come from an older schema version — v1 used
            // `pricePerUserYear` on plans + addons. Migrate on read: if the
            // new `pricePerYear` field is missing/zero AND we can see the
            // old field, port it over so the operator doesn't stare at
            // blank inputs when editing.
            PricingCatalogDto? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<PricingCatalogDto>(row.CatalogJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch { return PricingDefaults.Build(); }
            if (parsed is null) return PricingDefaults.Build();

            var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(row.CatalogJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            var migrated = MigrateLegacyIfNeeded(parsed, raw);
            return migrated;
        }
        catch { return PricingDefaults.Build(); }
    }

    /// <summary>Legacy-shape rescue: if plans / addons in the parsed catalog
    /// have zero <c>PricePerYear</c> but the raw JSON carries the v1
    /// <c>pricePerUserYear</c> field, copy the old value into the new field
    /// so the operator sees the real number in the editor. Prevents blank
    /// TextField inputs after the shape rename.</summary>
    private static PricingCatalogDto MigrateLegacyIfNeeded(PricingCatalogDto parsed, Dictionary<string, JsonElement>? raw)
    {
        if (raw is null || parsed.Plans.All(p => p.PricePerYear > 0)) return parsed;

        var plans = parsed.Plans.ToArray();
        if (raw.TryGetValue("plans", out var plansEl) && plansEl.ValueKind == JsonValueKind.Array)
        {
            var planItems = plansEl.EnumerateArray().ToArray();
            for (int i = 0; i < plans.Length && i < planItems.Length; i++)
            {
                var p = plans[i];
                if (p.PricePerYear > 0) continue;
                if (planItems[i].TryGetProperty("pricePerUserYear", out var legacy) &&
                    legacy.TryGetDecimal(out var v) && v > 0)
                {
                    plans[i] = p with { PricePerYear = v * Math.Max(1, p.IncludedUsers) };
                }
            }
        }

        var addons = parsed.Addons.ToArray();
        if (raw.TryGetValue("addons", out var addonsEl) && addonsEl.ValueKind == JsonValueKind.Array)
        {
            var items = addonsEl.EnumerateArray().ToArray();
            for (int i = 0; i < addons.Length && i < items.Length; i++)
            {
                var a = addons[i];
                if (a.PricePerYear > 0) continue;
                if (items[i].TryGetProperty("pricePerUserYear", out var legacy) &&
                    legacy.TryGetDecimal(out var v) && v > 0)
                {
                    addons[i] = a with { PricePerYear = v };
                }
            }
        }

        return parsed with { Plans = plans, Addons = addons };
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
            if (p.PricePerYear < 0 || p.ExtraOfficePerYear < 0 || p.ExtraUserPerYear < 0)
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
