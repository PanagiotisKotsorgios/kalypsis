using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

public static class CompanyParameterDefaults
{
    public static async Task<int> SeedMissingAsync(AppDbContext db, Guid? insuranceCompanyId, CancellationToken ct)
    {
        var companiesQuery = db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.TenantId == null && c.DeletedAt == null && c.IsActive);

        if (insuranceCompanyId.HasValue)
            companiesQuery = companiesQuery.Where(c => c.Id == insuranceCompanyId.Value);

        var companies = await companiesQuery.OrderBy(c => c.Name).ToListAsync(ct);
        var created = 0;

        foreach (var company in companies)
        {
            var existing = await db.CompanyParameterItems.IgnoreQueryFilters()
                .Where(x => x.InsuranceCompanyId == company.Id && x.DeletedAt == null)
                .Select(x => new
                {
                    x.Kind,
                    x.Code,
                    x.ParentCode,
                    x.BridgeSystem,
                    x.BridgeCode
                })
                .ToListAsync(ct);

            var existingKeys = existing
                .Select(x => Key(x.Kind, x.Code, x.ParentCode, x.BridgeSystem, x.BridgeCode))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var item in Build(company.Id))
            {
                if (!existingKeys.Add(Key(item.Kind, item.Code, item.ParentCode, item.BridgeSystem, item.BridgeCode)))
                    continue;
                db.CompanyParameterItems.Add(item);
                created++;
            }
        }

        if (created > 0) await db.SaveChangesAsync(ct);
        return created;
    }

    private static IEnumerable<CompanyParameterItem> Build(Guid companyId)
    {
        var order = 0;
        CompanyParameterItem Item(
            CompanyParameterItemKind kind,
            string code,
            string name,
            PolicyType? policyType = null,
            VehicleUseCategory? vehicleUse = null,
            string? parentCode = null,
            string? bridgeSystem = null,
            string? bridgeCode = null,
            string? bridgeField = null,
            string? defaultValuesJson = null,
            string? notes = null)
            => new()
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = companyId,
                Kind = kind,
                Code = Normalize(code),
                Name = name.Trim(),
                PolicyType = policyType,
                VehicleUseCategory = vehicleUse,
                ParentCode = NormalizeOrNull(parentCode),
                BridgeSystem = NormalizeOrNull(bridgeSystem),
                BridgeCode = Clean(bridgeCode),
                BridgeField = Clean(bridgeField),
                DefaultValuesJson = Clean(defaultValuesJson),
                IsActive = true,
                DisplayOrder = order++,
                Source = "Kalypsis defaults",
                Notes = notes
            };

        foreach (var branch in Branches())
            yield return Item(CompanyParameterItemKind.Branch, branch.Code, branch.Name, branch.Type, parentCode: null);

        foreach (var use in Enum.GetValues<VehicleUseCategory>().Where(x => x != VehicleUseCategory.None))
            yield return Item(CompanyParameterItemKind.Use, use.ToString().ToUpperInvariant(), UseName(use),
                PolicyType.Auto, use, "AUTO");

        foreach (var coverage in Coverages())
            yield return Item(CompanyParameterItemKind.Coverage, coverage.Code, coverage.Name,
                coverage.Type, parentCode: coverage.BranchCode);

        foreach (var package in Packages())
            yield return Item(CompanyParameterItemKind.Package, package.Code, package.Name,
                package.Type, parentCode: package.BranchCode,
                defaultValuesJson: $$"""{"coverageLevel":"{{package.Code}}"}""");

        foreach (var mapping in BridgeMappings())
            yield return Item(CompanyParameterItemKind.BridgeCode, mapping.Code, mapping.Name,
                mapping.Type, parentCode: mapping.BranchCode,
                bridgeSystem: mapping.BridgeSystem,
                bridgeCode: mapping.BridgeCode,
                bridgeField: mapping.BridgeField,
                defaultValuesJson: $$"""{"rowType":"{{mapping.RowType}}","autoLink":true}""",
                notes: "Default bridge mapping. The carrier bridge value always remains the source of truth; this mapping normalizes and validates it.");

        yield return Item(CompanyParameterItemKind.Field, "AGENCY_COMMISSION", "Προμήθεια γραφείου από γέφυρα",
            bridgeSystem: "GLOBAL", bridgeCode: "AgencyCommission", bridgeField: "AgencyCommission",
            defaultValuesJson: """{"sourceOfTruth":"bridge","compareWithCommissionRules":true}""");
        yield return Item(CompanyParameterItemKind.Field, "PARTNER_COMMISSION", "Προμήθεια συνεργάτη από γέφυρα",
            bridgeSystem: "GLOBAL", bridgeCode: "PartnerCommission", bridgeField: "PartnerCommission",
            defaultValuesJson: """{"sourceOfTruth":"bridge","compareWithCommissionRules":true}""");
    }

    private static IEnumerable<(string Code, string Name, PolicyType Type)> Branches()
    {
        yield return ("AUTO", "Αυτοκίνητο", PolicyType.Auto);
        yield return ("HOME", "Κατοικία", PolicyType.Home);
        yield return ("HEALTH", "Υγείας", PolicyType.Health);
        yield return ("LIFE", "Ζωής", PolicyType.Life);
        yield return ("BUSINESS", "Επιχείρηση", PolicyType.Business);
        yield return ("TRAVEL", "Ταξιδιού", PolicyType.Travel);
        yield return ("OTHER", "Λοιποί κλάδοι", PolicyType.Other);
    }

    private static IEnumerable<(string Code, string Name, PolicyType Type, string BranchCode)> Coverages()
    {
        yield return ("MTPL", "Αστική ευθύνη οχήματος", PolicyType.Auto, "AUTO");
        yield return ("FIRE_AUTO", "Πυρός οχήματος", PolicyType.Auto, "AUTO");
        yield return ("THEFT_AUTO", "Κλοπή οχήματος", PolicyType.Auto, "AUTO");
        yield return ("GLASS", "Θραύση κρυστάλλων", PolicyType.Auto, "AUTO");
        yield return ("ROAD_ASSIST", "Οδική βοήθεια", PolicyType.Auto, "AUTO");
        yield return ("LEGAL_AUTO", "Νομική προστασία οχήματος", PolicyType.Auto, "AUTO");
        yield return ("PERSONAL_ACCIDENT", "Προσωπικό ατύχημα οδηγού", PolicyType.Auto, "AUTO");
        yield return ("GREEN_CARD", "Πράσινη κάρτα", PolicyType.Auto, "AUTO");

        yield return ("FIRE_HOME", "Πυρός κατοικίας", PolicyType.Home, "HOME");
        yield return ("EARTHQUAKE", "Σεισμός", PolicyType.Home, "HOME");
        yield return ("FLOOD", "Πλημμύρα", PolicyType.Home, "HOME");
        yield return ("THEFT_HOME", "Κλοπή κατοικίας", PolicyType.Home, "HOME");
        yield return ("LIABILITY_HOME", "Αστική ευθύνη κατοικίας", PolicyType.Home, "HOME");

        yield return ("HOSPITAL", "Νοσοκομειακή περίθαλψη", PolicyType.Health, "HEALTH");
        yield return ("OUTPATIENT", "Εξωνοσοκομειακή περίθαλψη", PolicyType.Health, "HEALTH");
        yield return ("DENTAL", "Οδοντιατρική κάλυψη", PolicyType.Health, "HEALTH");

        yield return ("LIFE_CAPITAL", "Κεφάλαιο ζωής", PolicyType.Life, "LIFE");
        yield return ("ACCIDENT", "Ατύχημα", PolicyType.Life, "LIFE");
        yield return ("DISABILITY", "Ανικανότητα", PolicyType.Life, "LIFE");

        yield return ("PROPERTY_BUSINESS", "Περιουσία επιχείρησης", PolicyType.Business, "BUSINESS");
        yield return ("LIABILITY_BUSINESS", "Αστική ευθύνη επιχείρησης", PolicyType.Business, "BUSINESS");
        yield return ("BUSINESS_INTERRUPTION", "Διακοπή εργασιών", PolicyType.Business, "BUSINESS");

        yield return ("MEDICAL_TRAVEL", "Ιατρικά ταξιδιού", PolicyType.Travel, "TRAVEL");
        yield return ("CANCELLATION_TRAVEL", "Ακύρωση ταξιδιού", PolicyType.Travel, "TRAVEL");
        yield return ("BAGGAGE", "Αποσκευές", PolicyType.Travel, "TRAVEL");

        yield return ("OTHER", "Λοιπή κάλυψη", PolicyType.Other, "OTHER");
    }

    private static IEnumerable<(string Code, string Name, PolicyType Type, string BranchCode)> Packages()
    {
        foreach (var branch in Branches())
        {
            yield return ($"{branch.Code}_BASIC", $"{branch.Name} Basic", branch.Type, branch.Code);
            yield return ($"{branch.Code}_PLUS", $"{branch.Name} Plus", branch.Type, branch.Code);
            yield return ($"{branch.Code}_PREMIUM", $"{branch.Name} Premium", branch.Type, branch.Code);
        }
    }

    private static IEnumerable<(string Code, string Name, PolicyType? Type, string? BranchCode, string BridgeSystem, string BridgeCode, string BridgeField, string RowType)> BridgeMappings()
    {
        yield return ("ERGO_NEW", "ERGO νέο/ανανέωση", PolicyType.Auto, "AUTO", "ERGO", "New", "RowType", "New");
        yield return ("ERGO_RENEWAL", "ERGO ανανέωση", PolicyType.Auto, "AUTO", "ERGO", "Renewal", "RowType", "Renewal");
        yield return ("ERGO_CANCELLATION", "ERGO ακύρωση", null, null, "ERGO", "Cancellation", "RowType", "Cancellation");
        yield return ("ERGO_ENDORSEMENT", "ERGO πρόσθετη πράξη", null, null, "ERGO", "Endorsement", "RowType", "Endorsement");
        yield return ("ERGO_GREENCARD", "ERGO πράσινη κάρτα", PolicyType.Auto, "AUTO", "ERGO", "GreenCard", "RowType", "GreenCard");
    }

    private static string UseName(VehicleUseCategory use) => use switch
    {
        VehicleUseCategory.EIX => "ΕΙΧ - Επιβατικό Ι.Χ.",
        VehicleUseCategory.EDX => "ΕΔΧ - Ταξί / δημόσιας χρήσης",
        VehicleUseCategory.FIX => "ΦΙΧ - Φορτηγό Ι.Χ.",
        VehicleUseCategory.FDX => "ΦΔΧ - Φορτηγό δημόσιας χρήσης",
        VehicleUseCategory.LIX => "ΛΙΧ - Λεωφορείο Ι.Χ.",
        VehicleUseCategory.LDX => "ΛΔΧ - Λεωφορείο δημόσιας χρήσης",
        VehicleUseCategory.Motorcycle => "Μοτοσικλέτα",
        VehicleUseCategory.Agricultural => "Αγροτικό",
        VehicleUseCategory.Construction => "Εργοταξιακό",
        _ => use.ToString()
    };

    private static string Key(CompanyParameterItemKind kind, string code, string? parentCode, string? bridgeSystem, string? bridgeCode)
        => $"{(int)kind}|{Normalize(code)}|{NormalizeOrNull(parentCode) ?? ""}|{NormalizeOrNull(bridgeSystem) ?? ""}|{Clean(bridgeCode) ?? ""}";

    private static string Normalize(string value)
    {
        var cleaned = new string((value ?? "").Trim().ToUpperInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '_')
            .ToArray());
        while (cleaned.Contains("__", StringComparison.Ordinal)) cleaned = cleaned.Replace("__", "_", StringComparison.Ordinal);
        return cleaned.Trim('_');
    }

    private static string? NormalizeOrNull(string? value)
    {
        var cleaned = Clean(value);
        return cleaned is null ? null : Normalize(cleaned);
    }

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
