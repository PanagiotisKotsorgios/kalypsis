using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

// One versioned catalogue is shared by the public pricing page, SuperAdmin,
// billing dashboards and the server-side price calculator.
public record PricingFeatureDto(
    string Key,
    string Label,
    string Description = "",
    int SortOrder = 0,
    bool IsActive = true,
    string? IconKey = null);

public record PlanDefinitionDto(
    string Code,
    string Tagline,
    decimal PricePerYear,
    int IncludedOffices,
    int IncludedUsers,
    decimal ExtraOfficePerYear,
    decimal ExtraUserPerYear,
    string[] Packages,
    string Name = "",
    string Description = "",
    bool IsFeatured = false,
    bool IsActive = true,
    int SortOrder = 0,
    string ButtonText = "Επιλογή Πακέτου →",
    string ButtonUrl = "/register",
    string? IconKey = null,
    string? Badge = null,
    int IncludedPackages = 0,
    string[]? FeatureKeys = null);

public record AddonDefinitionDto(
    string Code,
    string Description,
    decimal PricePerYear,
    string Name = "",
    bool IsActive = true,
    int SortOrder = 0,
    string? IconKey = null);

public record ServiceDefinitionDto(
    string Code,
    string Description,
    string UnitLabel,
    decimal? UnitPrice,
    string Name = "",
    string PricingType = "fixed",
    bool IsActive = true,
    int SortOrder = 0,
    string? IconKey = null);

public record PricingSettingsDto(
    bool PricesIncludeVat = true,
    decimal VatRate = 24m,
    string Currency = "EUR",
    string PublicTitle = "Πακέτα & Τιμολόγηση KALYPSIS",
    string PublicSubtitle = "Ευέλικτα πακέτα για κάθε ασφαλιστικό γραφείο, με όλες τις δυνατότητες που χρειάζεστε για να αναπτυχθείτε.",
    string VatLabel = "Όλες οι τιμές συμπ. ΦΠΑ");

public record PricingCatalogDto(
    int Version,
    IReadOnlyList<PlanDefinitionDto> Plans,
    IReadOnlyList<AddonDefinitionDto> Addons,
    IReadOnlyList<ServiceDefinitionDto> Services)
{
    public IReadOnlyList<PricingFeatureDto> Features { get; init; } = Array.Empty<PricingFeatureDto>();
    public PricingSettingsDto Settings { get; init; } = new();
}

public static class PricingDefaults
{
    public static PricingCatalogDto Build()
    {
        var features = new[]
        {
            new PricingFeatureDto("producer_portal", "Πύλη Συνεργάτη", "Πρόσβαση συνεργάτη στην παραγωγή και στα έγγραφά του.", 10, true, "person"),
            new PricingFeatureDto("backoffice", "Διαχείριση Γραφείου", "Πελάτες, συμβόλαια, οικονομικά και παραγωγή.", 20, true, "business"),
            new PricingFeatureDto("backoffice_customers", "Πελατολόγιο και πλήρη στοιχεία πελατών", "Ενιαία καρτέλα με όλα τα στοιχεία και τις σχέσεις του πελάτη.", 21, true, "people"),
            new PricingFeatureDto("backoffice_policies", "Διαχείριση ασφαλιστηρίων συμβολαίων", "Συμβόλαια, καλύψεις, οχήματα και συνημμένα έγγραφα.", 22, true, "business"),
            new PricingFeatureDto("backoffice_lifecycle", "Ανανεώσεις, ακυρώσεις και πρόσθετες πράξεις", "Πλήρης κύκλος ζωής κάθε συμβολαίου.", 23, true, "extension"),
            new PricingFeatureDto("backoffice_production", "Παρακολούθηση παραγωγής", "Λίστες παραγωγής, προμήθειες και αναλυτική εικόνα.", 24, true, "chart"),
            new PricingFeatureDto("backoffice_partners", "Συνεργάτες και προμήθειες", "Καρτέλες συνεργατών, κανόνες και εκκαθαρίσεις.", 25, true, "groups"),
            new PricingFeatureDto("backoffice_financials", "Οικονομική εικόνα γραφείου", "Ταμείο, οφειλές, εισπράξεις και υποχρεώσεις.", 26, true, "business"),
            new PricingFeatureDto("backoffice_payments", "Εισπράξεις και πληρωμές", "Παρακολούθηση πληρωμών γραφείου, εταιρειών και συνεργατών.", 27, true, "business"),
            new PricingFeatureDto("all_bridges", "Γέφυρες και εισαγωγές ασφαλιστικών εταιρειών", "Εισαγωγές αρχείων και αντιστοιχίσεις από τις ασφαλιστικές εταιρείες.", 28, true, "hub"),
            new PricingFeatureDto("backoffice_search_exports", "Αναζητήσεις, φίλτρα και εξαγωγές στοιχείων", "Γρήγορα φίλτρα και εξαγωγή των δεδομένων του γραφείου.", 29, true, "extension"),
            new PricingFeatureDto("backoffice_analytics", "Προηγμένα στατιστικά και συνολική εικόνα", "Δείκτες δραστηριότητας και γραφήματα για το γραφείο.", 30, true, "chart"),
            new PricingFeatureDto("client_portal", "Πύλη Πελάτη", "Ο πελάτης βλέπει συγκεντρωμένα συμβόλαια, έγγραφα και αιτήματα.", 40, true, "people"),
            new PricingFeatureDto("crm", "CRM και αυτοματοποιημένες επικοινωνίες", "Ομάδες, οργανωμένη επικοινωνία, ενημερώσεις και αποστολή έως περίπου 300 email ημερησίως χωρίς επιπλέον χρέωση.", 50, true, "groups"),
            new PricingFeatureDto("reporting", "Αναφορές", "Στατιστικά, στόχοι και αναφορές παραγωγής.", 60, true, "chart"),
            new PricingFeatureDto("frontoffice", "Ιστοσελίδα Γραφείου", "Δημόσια ιστοσελίδα, posts και αιτήσεις.", 70, true, "language"),
            new PricingFeatureDto("intelligence", "Νοημοσύνη και Desktop με συγχρονισμό Cloud", "AI αναλύσεις, προβλέψεις, δημιουργός αναφορών και εφαρμογή υπολογιστή.", 80, true, "smart"),
            new PricingFeatureDto("custom_integrations", "Εξατομικευμένες Διασυνδέσεις", "Προσαρμοσμένα APIs και εξωτερικά συστήματα.", 90, true, "extension"),
            new PricingFeatureDto("priority_support", "Υποστήριξη Προτεραιότητας", "SLA και τηλεφωνική γραμμή προτεραιότητας.", 100, true, "support")
        };
        var producer = new[] { "producer_portal" };
        var backoffice = new[]
        {
            "backoffice", "backoffice_customers", "backoffice_policies", "backoffice_lifecycle",
            "backoffice_production", "backoffice_partners", "backoffice_financials", "backoffice_payments",
            "all_bridges", "backoffice_search_exports", "backoffice_analytics"
        };
        var growth = backoffice.Concat(new[] { "client_portal", "crm" }).ToArray();
        var advanced = growth.Append("intelligence").ToArray();
        var premium = advanced.Concat(new[] { "reporting", "frontoffice", "custom_integrations", "priority_support" }).ToArray();
        var plans = new[]
        {
            new PlanDefinitionDto("producer", "Μεμονωμένος συνεργάτης · μόνο πύλη", 90m, 0, 1, 0m, 60m, producer,
                Name: "Συνεργάτης", Description: "Μεμονωμένος συνεργάτης · μόνο πύλη", SortOrder: 10, IncludedPackages: 1, FeatureKeys: producer, IconKey: "person"),
            new PlanDefinitionDto("standard", "1 γραφείο · μόνο Backoffice", 150m, 1, 4, 400m, 150m, backoffice,
                Name: "Απλό", Description: "Η βασική έκδοση του KALYPSIS Backoffice για την καθημερινή λειτουργία του ασφαλιστικού γραφείου.", SortOrder: 20, IncludedPackages: 1, FeatureKeys: backoffice, IconKey: "business"),
            new PlanDefinitionDto("growth", "1 γραφείο · Backoffice + CRM + Πύλη Πελάτη", 225m, 1, 4, 350m, 180m, growth,
                Name: "Ανάπτυξης", Description: "Backoffice με οργανωμένη επικοινωνία, αυτοματοποιημένες ενημερώσεις και Πύλη Πελάτη.", IsFeatured: true, Badge: "Πιο Δημοφιλές", SortOrder: 30, IncludedPackages: 3, FeatureKeys: growth, IconKey: "groups"),
            new PlanDefinitionDto("advanced", "1 γραφείο · ανάπτυξη + Νοημοσύνη/Desktop", 300m, 1, 6, 400m, 200m, advanced,
                Name: "Προχωρημένο", Description: "Backoffice, CRM, Πύλη Πελάτη και Νοημοσύνη με εφαρμογή Desktop και συγχρονισμό Cloud.", SortOrder: 40, IncludedPackages: 4, FeatureKeys: advanced, IconKey: "smart"),
            new PlanDefinitionDto("premium", "Πλήρης σουίτα · όλες οι δυνατότητες", 450m, 3, 10, 500m, 240m, premium,
                Name: "Πλήρες", Description: "Όλες οι δυνατότητες του KALYPSIS για γραφεία που θέλουν την πλήρη επιχειρηματική σουίτα.", SortOrder: 50, IncludedPackages: 8, FeatureKeys: premium, IconKey: "crown")
        };
        var addons = new[]
        {
            new AddonDefinitionDto("crm_portal", "Οργανωμένη επικοινωνία, ομάδες, αυτοματοποιημένες ενημερώσεις και Πύλη Πελάτη", 75m, "CRM + Πύλη Πελάτη", true, 5, "groups"),
            new AddonDefinitionDto("frontoffice", "Ιστοσελίδα γραφείου + εργαλεία καμπάνιας", 400m, "Ιστοσελίδα Γραφείου", true, 10, "language"),
            new AddonDefinitionDto("intelligence", "Νοημοσύνη και Desktop εφαρμογή με συγχρονισμό Cloud", 75m, "Νοημοσύνη + Desktop", true, 20, "smart"),
            new AddonDefinitionDto("advanced_bridges", "Προηγμένες γέφυρες — απεριόριστες γέφυρες + αντιστοίχιση AI", 200m, "Προηγμένες Γέφυρες", true, 30, "hub"),
            new AddonDefinitionDto("priority_support", "SLA 4 ωρών · τηλεφωνική γραμμή προτεραιότητας", 130m, "Υποστήριξη Προτεραιότητας", true, 40, "support"),
            new AddonDefinitionDto("custom_integrations", "Ενσωμάτωση με ERP (SAP, Oracle κ.λπ.) + προσαρμοσμένα APIs", 1200m, "Εξατομικευμένες Διασυνδέσεις", true, 50, "extension")
        };
        var services = new[]
        {
            new ServiceDefinitionDto("remote_training", "Εξ αποστάσεως εκπαίδευση μέσω Zoom / Teams", "ανά ώρα", 30m, "Εκπαίδευση εξ αποστάσεως", "hourly", true, 10, "school"),
            new ServiceDefinitionDto("onsite_training", "Εκπαίδευση στην έδρα του γραφείου", "κατά περίπτωση", null, "Εκπαίδευση στην έδρα", "custom_quote", true, 20, "school"),
            new ServiceDefinitionDto("data_migration", "Μεταφορά από παλαιό σύστημα", "σταθερό", 500m, "Μεταφορά Δεδομένων", "fixed", true, 30, "database"),
            new ServiceDefinitionDto("custom_development", "Ανάπτυξη ειδικής λειτουργίας", "κατά περίπτωση", null, "Εξατομικευμένη Ανάπτυξη", "custom_quote", true, 40, "code"),
            new ServiceDefinitionDto("website_creation", "Δημιουργία ιστοσελίδας ασφαλιστικού γραφείου", "σταθερό", 300m, "Δημιουργία Ιστοσελίδας", "fixed", true, 50, "language"),
            new ServiceDefinitionDto("website_maintenance", "Ετήσια συντήρηση ιστοσελίδας από το 1ο έτος", "ανά έτος", 130m, "Συντήρηση Ιστοσελίδας", "yearly", true, 60, "build")
        };
        return new PricingCatalogDto(3, plans, addons, services) { Features = features, Settings = new PricingSettingsDto() };
    }

    public static PricingCatalogDto Normalize(PricingCatalogDto parsed)
    {
        var defaults = Build();
        // v1 was the legacy hard-coded catalogue. Upgrade it to the explicit
        // v2 catalogue once, so the public page never serves stale legacy prices.
        if (parsed.Version < 3) return defaults;
        var featureList = parsed.Features is { Count: > 0 } ? parsed.Features : defaults.Features;
        var settings = parsed.Settings ?? defaults.Settings;
        var plans = parsed.Plans.Select((p, i) =>
        {
            var d = defaults.Plans.FirstOrDefault(x => x.Code.Equals(p.Code, StringComparison.OrdinalIgnoreCase));
            var featureKeys = p.FeatureKeys is { Length: > 0 } ? p.FeatureKeys : p.Packages;
            return p with
            {
                Name = string.IsNullOrWhiteSpace(p.Name) ? d?.Name ?? p.Code : p.Name,
                Description = string.IsNullOrWhiteSpace(p.Description) ? (string.IsNullOrWhiteSpace(p.Tagline) ? d?.Description ?? "" : p.Tagline) : p.Description,
                Tagline = string.IsNullOrWhiteSpace(p.Tagline) ? d?.Description ?? "" : p.Tagline,
                IsActive = p.IsActive,
                SortOrder = p.SortOrder == 0 ? (d?.SortOrder ?? (i + 1) * 10) : p.SortOrder,
                ButtonText = string.IsNullOrWhiteSpace(p.ButtonText) ? "Επιλογή Πακέτου →" : p.ButtonText,
                ButtonUrl = string.IsNullOrWhiteSpace(p.ButtonUrl) ? "/register" : p.ButtonUrl,
                IncludedPackages = p.IncludedPackages > 0 ? p.IncludedPackages : featureKeys.Length,
                FeatureKeys = featureKeys
            };
        }).ToArray();
        var addons = parsed.Addons.Select((a, i) =>
        {
            var d = defaults.Addons.FirstOrDefault(x => x.Code.Equals(a.Code, StringComparison.OrdinalIgnoreCase));
            return a with { Name = string.IsNullOrWhiteSpace(a.Name) ? d?.Name ?? a.Code : a.Name, IsActive = a.IsActive, SortOrder = a.SortOrder == 0 ? (d?.SortOrder ?? (i + 1) * 10) : a.SortOrder };
        }).ToArray();
        var services = parsed.Services.Select((s, i) =>
        {
            var d = defaults.Services.FirstOrDefault(x => x.Code.Equals(s.Code, StringComparison.OrdinalIgnoreCase));
            var pricingType = string.IsNullOrWhiteSpace(s.PricingType) ? (s.UnitPrice.HasValue ? "fixed" : "custom_quote") : s.PricingType.Trim().ToLowerInvariant();
            return s with { Name = string.IsNullOrWhiteSpace(s.Name) ? d?.Name ?? s.Code : s.Name, PricingType = pricingType, IsActive = s.IsActive, SortOrder = s.SortOrder == 0 ? (d?.SortOrder ?? (i + 1) * 10) : s.SortOrder };
        }).ToArray();
        return parsed with { Version = Math.Max(3, parsed.Version), Plans = plans, Addons = addons, Services = services, Features = featureList, Settings = settings };
    }
}

internal static class PricingCatalogReader
{
    public static async Task<PricingCatalogDto> LoadAsync(IAppDbContext db, CancellationToken ct)
    {
        var row = await db.PlatformPricings.IgnoreQueryFilters().OrderBy(x => x.Id).FirstOrDefaultAsync(ct);
        if (row is null) return PricingDefaults.Build();
        try
        {
            var parsed = JsonSerializer.Deserialize<PricingCatalogDto>(row.CatalogJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (parsed is null) return PricingDefaults.Build();
            var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(row.CatalogJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return PricingDefaults.Normalize(MigrateLegacyPrices(parsed, raw));
        }
        catch { return PricingDefaults.Build(); }
    }

    private static PricingCatalogDto MigrateLegacyPrices(PricingCatalogDto parsed, Dictionary<string, JsonElement>? raw)
    {
        if (raw is null) return parsed;
        var plans = parsed.Plans.ToArray();
        if (raw.TryGetValue("plans", out var plansEl) && plansEl.ValueKind == JsonValueKind.Array)
        {
            var items = plansEl.EnumerateArray().ToArray();
            for (var i = 0; i < plans.Length && i < items.Length; i++)
            {
                if (plans[i].PricePerYear > 0 || !items[i].TryGetProperty("pricePerUserYear", out var legacy) || !legacy.TryGetDecimal(out var v) || v <= 0) continue;
                plans[i] = plans[i] with { PricePerYear = v * Math.Max(1, plans[i].IncludedUsers) };
            }
        }
        var addons = parsed.Addons.ToArray();
        if (raw.TryGetValue("addons", out var addonsEl) && addonsEl.ValueKind == JsonValueKind.Array)
        {
            var items = addonsEl.EnumerateArray().ToArray();
            for (var i = 0; i < addons.Length && i < items.Length; i++)
            {
                if (addons[i].PricePerYear > 0 || !items[i].TryGetProperty("pricePerUserYear", out var legacy) || !legacy.TryGetDecimal(out var v) || v <= 0) continue;
                addons[i] = addons[i] with { PricePerYear = v };
            }
        }
        return parsed with { Plans = plans, Addons = addons };
    }
}

public record GetPricingCatalogQuery : IRequest<PricingCatalogDto>;
public class GetPricingCatalogHandler : IRequestHandler<GetPricingCatalogQuery, PricingCatalogDto>
{
    private readonly IAppDbContext _db;
    public GetPricingCatalogHandler(IAppDbContext db) => _db = db;
    public Task<PricingCatalogDto> Handle(GetPricingCatalogQuery r, CancellationToken ct) => PricingCatalogReader.LoadAsync(_db, ct);
}

public record SavePricingCatalogCommand(PricingCatalogDto Catalog) : IRequest<PricingCatalogDto>;
public class SavePricingCatalogHandler : IRequestHandler<SavePricingCatalogCommand, PricingCatalogDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public SavePricingCatalogHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<PricingCatalogDto> Handle(SavePricingCatalogCommand r, CancellationToken ct)
    {
        if (r.Catalog is null) throw new AppException("bad_body", "Missing catalog", 400);
        var catalog = PricingDefaults.Normalize(r.Catalog);
        if (catalog.Plans.Count == 0) throw new AppException("bad_plans", "Χρειάζεται τουλάχιστον ένα πλάνο", 400);
        var planCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in catalog.Plans)
        {
            if (string.IsNullOrWhiteSpace(p.Code) || !planCodes.Add(p.Code)) throw new AppException("bad_plan", "Τα πλάνα πρέπει να έχουν μοναδικό κωδικό", 400);
            if (p.PricePerYear < 0 || p.ExtraOfficePerYear < 0 || p.ExtraUserPerYear < 0 || p.IncludedOffices < 0 || p.IncludedUsers < 0) throw new AppException("bad_price", $"Μη έγκυρη τιμή ή ποσότητα στο πλάνο {p.Code}", 400);
        }
        foreach (var a in catalog.Addons) if (a.PricePerYear < 0) throw new AppException("bad_addon_price", $"Μη έγκυρη τιμή στο πρόσθετο {a.Code}", 400);
        var allowedPricingTypes = new HashSet<string>(new[] { "fixed", "hourly", "yearly", "custom_quote" }, StringComparer.OrdinalIgnoreCase);
        foreach (var s in catalog.Services)
        {
            if (!allowedPricingTypes.Contains(s.PricingType)) throw new AppException("bad_service_type", $"Μη έγκυρος τύπος τιμής στην υπηρεσία {s.Code}", 400);
            if (s.PricingType != "custom_quote" && s.UnitPrice is < 0) throw new AppException("bad_service_price", $"Μη έγκυρη τιμή στην υπηρεσία {s.Code}", 400);
        }
        if (catalog.Settings.VatRate < 0 || catalog.Settings.VatRate > 100) throw new AppException("bad_vat", "Ο ΦΠΑ πρέπει να είναι μεταξύ 0 και 100", 400);
        var json = JsonSerializer.Serialize(catalog);
        var row = await _db.PlatformPricings.IgnoreQueryFilters().OrderBy(x => x.Id).FirstOrDefaultAsync(ct);
        var old = row?.CatalogJson;
        if (row is null)
        {
            row = new PlatformPricing { Id = Guid.NewGuid(), CatalogJson = json, Version = catalog.Version, LastUpdatedByUserId = _current.UserId };
            _db.PlatformPricings.Add(row);
        }
        else { row.CatalogJson = json; row.Version = catalog.Version; row.LastUpdatedByUserId = _current.UserId; row.UpdatedAt = DateTime.UtcNow; }
        _db.AuditLogs.Add(new AuditLog { Id = Guid.NewGuid(), UserId = _current.UserId, EntityName = "PlatformPricing", EntityId = row.Id.ToString(), Action = old is null ? "Create" : "Update", Category = "Pricing", OldValues = old, NewValues = json, Metadata = $"version={catalog.Version}; plans={catalog.Plans.Count}; addons={catalog.Addons.Count}; services={catalog.Services.Count}" });
        await _db.SaveChangesAsync(ct);
        return catalog;
    }
}

public record PricingCalculationRequest(string PlanCode, int ExtraOffices = 0, int ExtraUsers = 0, string[]? AddonCodes = null, string[]? ServiceCodes = null);
public record PricingCalculationLine(string Code, string Label, decimal Amount);
public record PricingCalculationDto(string PlanCode, string PlanName, decimal BaseAmount, decimal ExtraOfficesAmount, decimal ExtraUsersAmount, decimal AddonsAmount, decimal ServicesAmount, decimal TotalAmount, decimal NetAmount, decimal VatAmount, bool PricesIncludeVat, decimal VatRate, string Currency, bool RequiresQuote, IReadOnlyList<PricingCalculationLine> Lines);
public record CalculatePricingQuery(PricingCalculationRequest Request) : IRequest<PricingCalculationDto>;
public sealed class CalculatePricingHandler : IRequestHandler<CalculatePricingQuery, PricingCalculationDto>
{
    private readonly IAppDbContext _db;
    public CalculatePricingHandler(IAppDbContext db) => _db = db;
    public async Task<PricingCalculationDto> Handle(CalculatePricingQuery request, CancellationToken ct)
    {
        var catalog = await PricingCatalogReader.LoadAsync(_db, ct);
        var p = catalog.Plans.FirstOrDefault(x => x.IsActive && x.Code.Equals(request.Request.PlanCode, StringComparison.OrdinalIgnoreCase)) ?? throw new AppException("unknown_plan", "Το πλάνο δεν είναι διαθέσιμο", 400);
        var offices = Math.Max(0, request.Request.ExtraOffices); var users = Math.Max(0, request.Request.ExtraUsers);
        var lines = new List<PricingCalculationLine> { new("base", p.Name, p.PricePerYear) };
        var officeAmount = offices * p.ExtraOfficePerYear; var userAmount = users * p.ExtraUserPerYear;
        if (offices > 0) lines.Add(new("extra_offices", $"{offices} επιπλέον γραφεία", officeAmount));
        if (users > 0) lines.Add(new("extra_users", $"{users} επιπλέον χρήστες", userAmount));
        var requestedAddons = request.Request.AddonCodes ?? Array.Empty<string>();
        var addonAmount = catalog.Addons.Where(a => a.IsActive && requestedAddons.Contains(a.Code, StringComparer.OrdinalIgnoreCase)).Sum(a => { lines.Add(new(a.Code, a.Name, a.PricePerYear)); return a.PricePerYear; });
        var requestedServices = request.Request.ServiceCodes ?? Array.Empty<string>();
        var requiresQuote = false;
        var serviceAmount = catalog.Services.Where(s => s.IsActive && requestedServices.Contains(s.Code, StringComparer.OrdinalIgnoreCase)).Sum(s =>
        {
            if (s.PricingType == "custom_quote" || !s.UnitPrice.HasValue)
            {
                requiresQuote = true;
                lines.Add(new(s.Code, s.Name, 0m));
                return 0m;
            }
            lines.Add(new(s.Code, s.Name, s.UnitPrice.Value));
            return s.UnitPrice.Value;
        });
        var total = p.PricePerYear + officeAmount + userAmount + addonAmount + serviceAmount;
        var vat = catalog.Settings.PricesIncludeVat && catalog.Settings.VatRate > 0 ? Math.Round(total * catalog.Settings.VatRate / (100m + catalog.Settings.VatRate), 2) : 0m;
        return new PricingCalculationDto(p.Code, p.Name, p.PricePerYear, officeAmount, userAmount, addonAmount, serviceAmount, total, catalog.Settings.PricesIncludeVat ? total - vat : total, vat, catalog.Settings.PricesIncludeVat, catalog.Settings.VatRate, catalog.Settings.Currency, requiresQuote, lines);
    }
}
