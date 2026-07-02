using System.Text.Json;
using ClosedXML.Excel;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Persistence.Seeders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api")]
public class CompanyParametersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public CompanyParametersController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record CompanyParameterItemDto(
        Guid Id,
        Guid InsuranceCompanyId,
        string InsuranceCompanyCode,
        string InsuranceCompanyName,
        CompanyParameterItemKind Kind,
        string Code,
        string Name,
        PolicyType? PolicyType,
        VehicleUseCategory? VehicleUseCategory,
        string? ParentCode,
        string? BridgeSystem,
        string? BridgeCode,
        string? BridgeField,
        string? DefaultValuesJson,
        DateOnly? EffectiveFrom,
        DateOnly? EffectiveTo,
        bool IsActive,
        int DisplayOrder,
        string Source,
        string? Notes);

    public record CompanyParameterItemBody(
        Guid InsuranceCompanyId,
        CompanyParameterItemKind Kind,
        string Code,
        string Name,
        PolicyType? PolicyType,
        VehicleUseCategory? VehicleUseCategory,
        string? ParentCode,
        string? BridgeSystem,
        string? BridgeCode,
        string? BridgeField,
        string? DefaultValuesJson,
        DateOnly? EffectiveFrom,
        DateOnly? EffectiveTo,
        bool IsActive,
        int DisplayOrder,
        string? Source,
        string? Notes);

    public record SeedCompanyParametersBody(Guid? InsuranceCompanyId);
    public record SeedCompanyParametersResult(int CompaniesProcessed, int ItemsCreated);

    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/company-parameters")]
    public async Task<ActionResult<IReadOnlyList<CompanyParameterItemDto>>> ListPlatform(
        [FromQuery] Guid? insuranceCompanyId,
        [FromQuery] CompanyParameterItemKind? kind,
        [FromQuery] string? search,
        [FromQuery] bool includeInactive,
        CancellationToken ct)
    {
        var q = _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .Where(x => x.DeletedAt == null);

        if (!includeInactive) q = q.Where(x => x.IsActive);
        q = await ApplyCompanyCodeFilterAsync(q, insuranceCompanyId, ct);
        q = ApplyCommonFilters(q, kind, search);

        // See note on the tenant-facing handler below — Atlantic + Grand Cover
        // both blow past 2000 params, and the Kind ordering pushes Uses last,
        // so the safety cap was silently dropping every Χρήση row.
        var takePlatform = insuranceCompanyId.HasValue ? 20000 : 2000;
        var rows = await q.OrderBy(x => x.InsuranceCompany.Name)
            .ThenBy(x => x.Kind)
            .ThenBy(x => x.DisplayOrder)
            .ThenBy(x => x.Code)
            .Take(takePlatform)
            .ToListAsync(ct);

        return Ok(rows.Select(Map).ToList());
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("company-parameters")]
    public async Task<ActionResult<IReadOnlyList<CompanyParameterItemDto>>> ListInherited(
        [FromQuery] Guid? insuranceCompanyId,
        [FromQuery] CompanyParameterItemKind? kind,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var accessibleCodes = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId))
            .Select(c => c.Code)
            .Distinct()
            .ToListAsync(ct);

        var q = _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .Where(x => x.DeletedAt == null && x.IsActive && accessibleCodes.Contains(x.InsuranceCompany.Code));

        q = await ApplyCompanyCodeFilterAsync(q, insuranceCompanyId, ct);
        q = ApplyCommonFilters(q, kind, search);

        var today = DateOnly.FromDateTime(_clock.UtcNow);
        q = q.Where(x => (!x.EffectiveFrom.HasValue || x.EffectiveFrom <= today)
            && (!x.EffectiveTo.HasValue || x.EffectiveTo >= today));

        // Big carriers can exceed 2000 (Atlantic 2772, Grand Cover 2292). The
        // ORDER BY Kind sequence puts Coverages before Uses, so with a 2000
        // budget every carrier's Χρήση rows silently vanish. Scoping to a
        // single carrier is always bounded — lift the ceiling then. The
        // unfiltered call keeps the 2000 safety cap so a bad frontend can't
        // haul the entire catalog.
        var take = insuranceCompanyId.HasValue ? 20000 : 2000;
        var rows = await q.OrderBy(x => x.InsuranceCompany.Name)
            .ThenBy(x => x.Kind)
            .ThenBy(x => x.DisplayOrder)
            .ThenBy(x => x.Code)
            .Take(take)
            .ToListAsync(ct);

        return Ok(rows.Select(Map).ToList());
    }

    /// <summary>
    /// Excel export of company parametrics. Same filter surface as the JSON
    /// endpoints — accepts insuranceCompanyId, kind, policyType,
    /// vehicleUseCategory, parentCode, search and audience.
    ///
    /// audience:
    ///   headquarters (default) — every column, no producer filtering.
    ///                            Requires AgencyAdmin+ or PlatformAdmin.
    ///   producer               — trimmed columns suitable for handing to
    ///                            producers; strips internal source/notes.
    /// </summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("company-parameters/export.xlsx")]
    public async Task<IActionResult> ExportXlsx(
        [FromQuery] Guid? insuranceCompanyId,
        [FromQuery] CompanyParameterItemKind? kind,
        [FromQuery] PolicyType? policyType,
        [FromQuery] VehicleUseCategory? vehicleUseCategory,
        [FromQuery] string? parentCode,
        [FromQuery] string? search,
        [FromQuery] string audience = "headquarters",
        CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var accessibleCodes = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId))
            .Select(c => c.Code)
            .Distinct()
            .ToListAsync(ct);

        var q = _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .Where(x => x.DeletedAt == null && x.IsActive
                && accessibleCodes.Contains(x.InsuranceCompany.Code));

        q = await ApplyCompanyCodeFilterAsync(q, insuranceCompanyId, ct);
        q = ApplyCommonFilters(q, kind, search);
        if (policyType.HasValue)
            q = q.Where(x => x.PolicyType == policyType.Value);
        if (vehicleUseCategory.HasValue)
            q = q.Where(x => x.VehicleUseCategory == vehicleUseCategory.Value);
        if (!string.IsNullOrWhiteSpace(parentCode))
            q = q.Where(x => x.ParentCode == parentCode);

        var today = DateOnly.FromDateTime(_clock.UtcNow);
        q = q.Where(x => (!x.EffectiveFrom.HasValue || x.EffectiveFrom <= today)
            && (!x.EffectiveTo.HasValue || x.EffectiveTo >= today));

        var rows = await q
            .OrderBy(x => x.InsuranceCompany.Name)
            .ThenBy(x => x.Kind)
            .ThenBy(x => x.PolicyType)
            .ThenBy(x => x.DisplayOrder)
            .ThenBy(x => x.Code)
            .Take(20000)
            .ToListAsync(ct);

        var producerView = string.Equals(audience, "producer", StringComparison.OrdinalIgnoreCase);

        using var wb = new XLWorkbook();
        var sheet = wb.Worksheets.Add("Παραμετρικά");
        var col = 1;
        void H(string label) { sheet.Cell(1, col).Value = label; col++; }
        H("Ασφαλιστική");
        H("Κωδικός εταιρίας");
        H("Είδος");
        H("Κωδικός");
        H("Όνομα");
        H("Κλάδος");
        H("Χρήση οχήματος");
        H("Πατέρας (parentCode)");
        H("Γέφυρα (system)");
        H("Γέφυρα (κωδικός)");
        H("Ισχύς από");
        H("Ισχύς έως");
        if (!producerView)
        {
            H("Πηγή");
            H("Σημειώσεις");
        }
        var lastCol = col - 1;

        var header = sheet.Range(1, 1, 1, lastCol);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0b2545");
        header.Style.Font.FontColor = XLColor.White;

        int r = 2;
        foreach (var x in rows)
        {
            col = 1;
            sheet.Cell(r, col++).Value = x.InsuranceCompany.Name;
            sheet.Cell(r, col++).Value = x.InsuranceCompany.Code;
            sheet.Cell(r, col++).Value = x.Kind.ToString();
            sheet.Cell(r, col++).Value = x.Code;
            sheet.Cell(r, col++).Value = x.Name;
            sheet.Cell(r, col++).Value = x.PolicyType.HasValue ? x.PolicyType.Value.ToString() : "";
            sheet.Cell(r, col++).Value = x.VehicleUseCategory.HasValue ? x.VehicleUseCategory.Value.ToString() : "";
            sheet.Cell(r, col++).Value = x.ParentCode ?? "";
            sheet.Cell(r, col++).Value = x.BridgeSystem ?? "";
            sheet.Cell(r, col++).Value = x.BridgeCode ?? "";
            if (x.EffectiveFrom.HasValue) sheet.Cell(r, col).Value = x.EffectiveFrom.Value.ToDateTime(TimeOnly.MinValue);
            col++;
            if (x.EffectiveTo.HasValue) sheet.Cell(r, col).Value = x.EffectiveTo.Value.ToDateTime(TimeOnly.MinValue);
            col++;
            if (!producerView)
            {
                sheet.Cell(r, col++).Value = x.Source ?? "";
                sheet.Cell(r, col++).Value = x.Notes ?? "";
            }
            r++;
        }

        // Date columns as dd/MM/yyyy.
        sheet.Column(11).Style.DateFormat.Format = "dd/MM/yyyy";
        sheet.Column(12).Style.DateFormat.Format = "dd/MM/yyyy";

        sheet.Columns().AdjustToContents();
        // Cap the widths so long notes don't produce a monstrous column.
        for (int i = 1; i <= lastCol; i++)
            if (sheet.Column(i).Width > 50) sheet.Column(i).Width = 50;
        sheet.SheetView.FreezeRows(1);

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        stream.Position = 0;
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmm");
        var scope = insuranceCompanyId.HasValue ? "εταιρία" : "ολα";
        var filename = $"parametrics_{scope}_{audience}_{stamp}.xlsx";
        return File(stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename);
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/company-parameters")]
    public async Task<ActionResult<CompanyParameterItemDto>> Create(
        [FromBody] CompanyParameterItemBody body,
        CancellationToken ct)
    {
        await ValidateBodyAsync(body, null, ct);
        var item = new CompanyParameterItem { Id = Guid.NewGuid(), CreatedAt = _clock.UtcNow };
        Apply(body, item);
        _db.CompanyParameterItems.Add(item);
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == item.Id, ct);
        return Ok(Map(saved));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPut("platform/company-parameters/{id:guid}")]
    public async Task<ActionResult<CompanyParameterItemDto>> Update(
        Guid id,
        [FromBody] CompanyParameterItemBody body,
        CancellationToken ct)
    {
        var item = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό εταιρείας");

        await ValidateBodyAsync(body, id, ct);
        Apply(body, item);
        item.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == id, ct);
        return Ok(Map(saved));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpDelete("platform/company-parameters/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό εταιρείας");
        item.DeletedAt = _clock.UtcNow;
        item.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ===== AgencyAdmin-accessible mirrors =====
    // Catalogue rows are shared across tenants (κάλυψη/χρήση/πακέτο taxonomies
    // are carrier-wide), so we let an AgencyAdmin add / edit / delete entries
    // the same way the PlatformAdmin can — every other γραφειο sees them too.
    // Source defaults to "AgencyAdmin" so the platform side can tell who added what.

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPost("company-parameters")]
    public async Task<ActionResult<CompanyParameterItemDto>> CreateAsAgency(
        [FromBody] CompanyParameterItemBody body,
        CancellationToken ct)
    {
        await ValidateBodyAsync(body, null, ct);
        var item = new CompanyParameterItem { Id = Guid.NewGuid(), CreatedAt = _clock.UtcNow };
        Apply(body, item);
        if (string.IsNullOrWhiteSpace(body.Source)) item.Source = "AgencyAdmin";
        _db.CompanyParameterItems.Add(item);
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == item.Id, ct);
        return Ok(Map(saved));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPut("company-parameters/{id:guid}")]
    public async Task<ActionResult<CompanyParameterItemDto>> UpdateAsAgency(
        Guid id,
        [FromBody] CompanyParameterItemBody body,
        CancellationToken ct)
    {
        var item = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό εταιρείας");

        EnsureAgencyCanModify(item);

        await ValidateBodyAsync(body, id, ct);
        Apply(body, item);
        item.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        var saved = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == id, ct);
        return Ok(Map(saved));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpDelete("company-parameters/{id:guid}")]
    public async Task<IActionResult> DeleteAsAgency(Guid id, CancellationToken ct)
    {
        var item = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραμετρικό εταιρείας");

        EnsureAgencyCanModify(item);
        item.DeletedAt = _clock.UtcNow;
        item.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Bridge-linked rows or those imported from a canonical source (IW dump,
    /// ERGO bridge, BlueByte map) MUST NOT be agency-editable — they are the
    /// contract between Kalypsis and the carrier. Only PlatformAdmin can touch
    /// those, through the /platform/ endpoints. Agencies get a 403 with a
    /// clear "ask the platform admin" message.
    /// </summary>
    private static void EnsureAgencyCanModify(CompanyParameterItem item)
    {
        var protectedBySource =
            !string.IsNullOrEmpty(item.Source)
            && (item.Source.StartsWith("GrandCover", StringComparison.OrdinalIgnoreCase)
             || item.Source.StartsWith("Kalypsis defaults", StringComparison.OrdinalIgnoreCase)
             || item.Source.StartsWith("Bridge", StringComparison.OrdinalIgnoreCase));
        if (protectedBySource || !string.IsNullOrEmpty(item.BridgeSystem))
        {
            throw new AppException("parameter_bridge_locked",
                "Αυτή η εγγραφή είναι συνδεδεμένη με γέφυρα και δεν τροποποιείται από το γραφείο.", 403,
                title: "Κλειδωμένη παραμετροποίηση",
                why: "Η εγγραφή προέρχεται από επίσημο dump ασφαλιστικής ή είναι μέρος ενεργής γέφυρας. Αλλαγή θα έσπαγε την αντιστοίχιση συμβολαίων.",
                fix: "Ζητήστε από τον superadmin να κάνει την αλλαγή στο /platform/company-parameters.");
        }
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/company-parameters/seed-defaults")]
    public ActionResult<SeedCompanyParametersResult> SeedDefaults(
        [FromBody] SeedCompanyParametersBody _,
        CancellationToken __)
    {
        // Disabled. The generic «Kalypsis defaults» seeder created seven
        // synthetic branches with names like "Αυτοκίνητο" / "Κατοικία" that
        // polluted the real per-carrier catalogue (most notably Grand Cover
        // IW). Going forward, παραμετρικά are populated exclusively via the
        // bulk xlsx/csv importer per carrier. Returning a no-op keeps any
        // existing UI button working without side-effects.
        return Ok(new SeedCompanyParametersResult(0, 0));
    }

    /// <summary>
    /// Manual trigger for the boot-time cleanup. Lets the platform admin
    /// re-assert the "only Grand Cover exists" invariant without restarting
    /// the API container.
    /// </summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/company-parameters/run-cleanup")]
    public async Task<ActionResult<object>> RunCleanup(
        [FromServices] Microsoft.Extensions.Logging.ILoggerFactory loggerFactory,
        CancellationToken ct)
    {
        var logger = loggerFactory.CreateLogger("ManualCleanup");
        await Kalypsis.Infrastructure.Persistence.Seeders.DataSeeder
            .CleanupNonGrandCoverGlobalsAsync(_db, logger, ct);
        return Ok(new { ok = true, ranAt = DateTime.UtcNow });
    }

    private async Task<IQueryable<CompanyParameterItem>> ApplyCompanyCodeFilterAsync(
        IQueryable<CompanyParameterItem> q,
        Guid? insuranceCompanyId,
        CancellationToken ct)
    {
        if (!insuranceCompanyId.HasValue) return q;

        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.Id == insuranceCompanyId.Value && c.DeletedAt == null)
            .Select(c => new { c.Id, c.Code, c.ParentCompanyId, c.IsBroker, c.ExcludedBranchCodesJson })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρεία");

        // Cascade rules:
        //   - SUB selected  → include the sub's own παραμετρικά (its packages)
        //                     AND the broker's κλάδοι/χρήσεις/καλύψεις, MINUS
        //                     any branch codes the sub explicitly doesn't sell
        //                     (per its ExcludedBranchCodesJson list).
        //   - BROKER selected → include the broker's catalogue AND every sub's
        //                     packages so the dropdown shows the whole
        //                     hierarchy in one place.
        //   - STANDALONE     → just its own rows.
        if (carrier.ParentCompanyId.HasValue)
        {
            var parentCode = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.Id == carrier.ParentCompanyId.Value && c.DeletedAt == null)
                .Select(c => c.Code)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrEmpty(parentCode))
            {
                var subCodes = new[] { carrier.Code, parentCode };
                var filtered = q.Where(x => subCodes.Contains(x.InsuranceCompany.Code));
                // Honour the sub's exclusion list — strip branches it doesn't sell.
                var excluded = ParseExclusions(carrier.ExcludedBranchCodesJson);
                if (excluded.Count > 0)
                    filtered = filtered.Where(x =>
                        !(x.Kind == CompanyParameterItemKind.Branch && excluded.Contains(x.Code)));
                return filtered;
            }
        }
        else if (carrier.IsBroker)
        {
            var hierarchyCodes = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null
                    && (c.Id == carrier.Id || c.ParentCompanyId == carrier.Id))
                .Select(c => c.Code)
                .ToListAsync(ct);
            return q.Where(x => hierarchyCodes.Contains(x.InsuranceCompany.Code));
        }

        return q.Where(x => x.InsuranceCompany.Code == carrier.Code);
    }

    private static HashSet<string> ParseExclusions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array)
                return new(StringComparer.OrdinalIgnoreCase);
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var el in doc.RootElement.EnumerateArray())
                if (el.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var s = el.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) set.Add(s.Trim().ToUpperInvariant());
                }
            return set;
        }
        catch { return new(StringComparer.OrdinalIgnoreCase); }
    }

    private static IQueryable<CompanyParameterItem> ApplyCommonFilters(
        IQueryable<CompanyParameterItem> q,
        CompanyParameterItemKind? kind,
        string? search)
    {
        if (kind.HasValue) q = q.Where(x => x.Kind == kind.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = $"%{search.Trim()}%";
            q = q.Where(x =>
                EF.Functions.Like(x.Code, s) ||
                EF.Functions.Like(x.Name, s) ||
                (x.ParentCode != null && EF.Functions.Like(x.ParentCode, s)) ||
                (x.BridgeSystem != null && EF.Functions.Like(x.BridgeSystem, s)) ||
                (x.BridgeCode != null && EF.Functions.Like(x.BridgeCode, s)));
        }
        return q;
    }

    private async Task ValidateBodyAsync(CompanyParameterItemBody body, Guid? editingId, CancellationToken ct)
    {
        var code = NormalizeCode(body.Code);
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(body.Name))
            throw new AppException("company_parameter_required",
                "Συμπληρώστε εταιρεία, τύπο, κωδικό και όνομα παραμετρικού.", 400,
                title: "Λείπουν υποχρεωτικά πεδία",
                why: "Τα παραμετρικά χρησιμοποιούνται σε dropdowns και γέφυρες. Δεν μπορούν να σωθούν χωρίς σταθερό κωδικό και όνομα.",
                fix: "Συμπληρώστε τα βασικά πεδία και ξαναδοκιμάστε.");

        var company = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == body.InsuranceCompanyId && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρεία");

        if (company.TenantId != null)
            throw new AppException("tenant_company_parameters_not_allowed",
                "Τα κεντρικά παραμετρικά ορίζονται μόνο σε καθολικές ασφαλιστικές εταιρείες Kalypsis.", 400,
                title: "Λάθος εταιρεία",
                why: "Αν οριστούν πάνω σε εταιρεία γραφείου, τα υπόλοιπα γραφεία δεν θα τα κληρονομήσουν.",
                fix: "Επιλέξτε την καθολική εταιρεία από τον κατάλογο Kalypsis.");

        if (body.EffectiveFrom.HasValue && body.EffectiveTo.HasValue && body.EffectiveTo.Value < body.EffectiveFrom.Value)
            throw new AppException("invalid_effective_period", "Η ισχύς έως δεν μπορεί να είναι πριν την ισχύ από.", 400);

        if (body.VehicleUseCategory.HasValue && body.PolicyType is not PolicyType.Auto)
            throw new AppException("vehicle_use_requires_auto",
                "Η χρήση οχήματος μπορεί να οριστεί μόνο σε κλάδο Αυτοκινήτου.", 400);

        if (body.Kind is CompanyParameterItemKind.Branch && !body.PolicyType.HasValue)
            throw new AppException("branch_requires_policy_type", "Ο κλάδος πρέπει να έχει τύπο συμβολαίου.", 400);

        if (body.Kind is CompanyParameterItemKind.Use && !body.VehicleUseCategory.HasValue)
            throw new AppException("use_requires_vehicle_category", "Η χρήση πρέπει να έχει κατηγορία χρήσης οχήματος.", 400);

        if (body.Kind is CompanyParameterItemKind.Coverage or CompanyParameterItemKind.Package)
        {
            if (!body.PolicyType.HasValue || string.IsNullOrWhiteSpace(body.ParentCode))
                throw new AppException("coverage_package_requires_scope",
                    "Καλύψεις και πακέτα πρέπει να έχουν κλάδο/parent code.", 400);
        }

        if (body.Kind is CompanyParameterItemKind.BridgeCode
            && (string.IsNullOrWhiteSpace(body.BridgeSystem) || string.IsNullOrWhiteSpace(body.BridgeCode)))
            throw new AppException("bridge_mapping_required",
                "Το mapping γέφυρας πρέπει να έχει σύστημα και εξωτερικό κωδικό.", 400);

        if (!string.IsNullOrWhiteSpace(body.DefaultValuesJson))
        {
            try { JsonDocument.Parse(body.DefaultValuesJson); }
            catch
            {
                throw new AppException("invalid_parameter_json",
                    "Το JSON παραμετρικών δεν είναι έγκυρο.", 400,
                    title: "Μη έγκυρο JSON",
                    why: "Οι γέφυρες και οι αυτόματες προεπιλογές διαβάζουν αυτό το πεδίο μηχανικά.",
                    fix: "Διορθώστε τη σύνταξη, π.χ. {\"sourceOfTruth\":\"bridge\"}.");
            }
        }

        var normalizedParent = NormalizeCodeOrNull(body.ParentCode);
        var normalizedBridgeSystem = NormalizeCodeOrNull(body.BridgeSystem);
        var bridgeCode = Clean(body.BridgeCode);

        var duplicate = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .AnyAsync(x => (!editingId.HasValue || x.Id != editingId.Value)
                && x.DeletedAt == null
                && x.InsuranceCompanyId == body.InsuranceCompanyId
                && x.Kind == body.Kind
                && x.Code == code
                && x.ParentCode == normalizedParent
                && x.BridgeSystem == normalizedBridgeSystem
                && x.BridgeCode == bridgeCode, ct);

        if (duplicate)
            throw new AppException("company_parameter_duplicate",
                "Υπάρχει ήδη ίδιο παραμετρικό για αυτή την εταιρεία.", 400,
                title: "Διπλή παραμετροποίηση",
                why: "Ο ίδιος κωδικός/τύπος/parent/bridge mapping θα δημιουργούσε αμφισημία στις γέφυρες.",
                fix: "Επεξεργαστείτε την υπάρχουσα γραμμή ή αλλάξτε κωδικό.");
    }

    private static void Apply(CompanyParameterItemBody body, CompanyParameterItem item)
    {
        item.InsuranceCompanyId = body.InsuranceCompanyId;
        item.Kind = body.Kind;
        item.Code = NormalizeCode(body.Code);
        item.Name = body.Name.Trim();
        item.PolicyType = body.PolicyType;
        item.VehicleUseCategory = body.VehicleUseCategory;
        item.ParentCode = NormalizeCodeOrNull(body.ParentCode);
        item.BridgeSystem = NormalizeCodeOrNull(body.BridgeSystem);
        item.BridgeCode = Clean(body.BridgeCode);
        item.BridgeField = Clean(body.BridgeField);
        item.DefaultValuesJson = Clean(body.DefaultValuesJson);
        item.EffectiveFrom = body.EffectiveFrom;
        item.EffectiveTo = body.EffectiveTo;
        item.IsActive = body.IsActive;
        item.DisplayOrder = body.DisplayOrder;
        item.Source = string.IsNullOrWhiteSpace(body.Source) ? "Manual" : body.Source.Trim();
        item.Notes = Clean(body.Notes);
    }

    private static CompanyParameterItemDto Map(CompanyParameterItem x) => new(
        x.Id,
        x.InsuranceCompanyId,
        x.InsuranceCompany.Code,
        x.InsuranceCompany.Name,
        x.Kind,
        x.Code,
        x.Name,
        x.PolicyType,
        x.VehicleUseCategory,
        x.ParentCode,
        x.BridgeSystem,
        x.BridgeCode,
        x.BridgeField,
        x.DefaultValuesJson,
        x.EffectiveFrom,
        x.EffectiveTo,
        x.IsActive,
        x.DisplayOrder,
        x.Source,
        x.Notes);

    private static string NormalizeCode(string? code)
    {
        var cleaned = new string((code ?? "").Trim().ToUpperInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '_')
            .ToArray());
        while (cleaned.Contains("__", StringComparison.Ordinal)) cleaned = cleaned.Replace("__", "_", StringComparison.Ordinal);
        return cleaned.Trim('_');
    }

    private static string? NormalizeCodeOrNull(string? code)
    {
        var cleaned = Clean(code);
        return cleaned is null ? null : NormalizeCode(cleaned);
    }

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
