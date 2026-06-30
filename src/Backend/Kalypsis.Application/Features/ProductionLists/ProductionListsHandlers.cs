using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Features.ProductionLists;

// ============================================================================
// Λίστες Παραγωγής — per-month / per-carrier / per-producer / per-policy-type
// aggregations with full filter combinatorics + CSV/XLSX/PDF export.
// Partner commission % is read from CommissionRule (parameterization), NOT
// from the bridge — that's the user's explicit rule.
// ============================================================================

public record ProductionFilters(
    DateOnly? From, DateOnly? To,
    Guid? InsuranceCompanyId, Guid? ProducerId,
    PolicyType? PolicyType, PolicyStatus? Status,
    VehicleUseCategory? VehicleUseCategory, string? CoverCode,
    string? GroupBy,
    string? PackageCode = null);   // "carrier" | "producer" | "type" | "month" | null

public record ProductionRowDto(
    Guid PolicyId, string PolicyNumber,
    DateOnly StartDate, DateOnly EndDate,
    string CustomerName, string InsuranceCompany, string? Producer, string PolicyType, string Status,
    VehicleUseCategory? VehicleUseCategory, string? CoverCode,
    decimal Gross, decimal Net, decimal Vat,
    decimal PartnerCommissionPercent, decimal PartnerCommission,
    decimal AgencyCommissionPercent, decimal AgencyCommission,
    decimal IncomingAgencyCommissionPercent, decimal IncomingAgencyCommission,
    string? CommissionWarning);

public record ProductionGroupTotalDto(
    string Key, int Count,
    decimal Gross, decimal Net, decimal Vat,
    decimal PartnerCommission, decimal AgencyCommission);

public record ProductionListResultDto(
    int Count,
    IReadOnlyList<ProductionRowDto> Rows,
    IReadOnlyList<ProductionGroupTotalDto> Groups,
    ProductionGroupTotalDto Grand);

public record GetProductionListQuery(ProductionFilters Filters) : IRequest<ProductionListResultDto>;

public class GetProductionListHandler : IRequestHandler<GetProductionListQuery, ProductionListResultDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetProductionListHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProductionListResultDto> Handle(GetProductionListQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await ProductionListBuilder.BuildRowsAsync(_db, tenantId, q.Filters, ct);

        // Group bucketing per filter.
        string GroupKey(ProductionRowDto r) => q.Filters.GroupBy switch
        {
            "carrier"  => r.InsuranceCompany,
            "producer" => r.Producer ?? "—",
            "type"     => r.PolicyType,
            "month"    => r.StartDate.ToString("yyyy-MM"),
            _          => ""
        };

        var groups = string.IsNullOrEmpty(q.Filters.GroupBy)
            ? new List<ProductionGroupTotalDto>()
            : rows.GroupBy(GroupKey)
                .Select(g => new ProductionGroupTotalDto(
                    g.Key, g.Count(),
                    g.Sum(x => x.Gross), g.Sum(x => x.Net), g.Sum(x => x.Vat),
                    g.Sum(x => x.PartnerCommission), g.Sum(x => x.AgencyCommission)))
                .OrderByDescending(x => x.Gross).ToList();

        var grand = new ProductionGroupTotalDto(
            "ΣΥΝΟΛΟ", rows.Count,
            rows.Sum(x => x.Gross), rows.Sum(x => x.Net), rows.Sum(x => x.Vat),
            rows.Sum(x => x.PartnerCommission), rows.Sum(x => x.AgencyCommission));

        return new ProductionListResultDto(rows.Count, rows, groups, grand);
    }

    // Builder moved to ProductionListBuilder (static) for DI-free reuse.
}

/// <summary>Stateless helper used by both the list query and the export query.</summary>
public static class ProductionListBuilder
{
    public static async Task<List<ProductionRowDto>> BuildRowsAsync(
        IAppDbContext _db, Guid tenantId, ProductionFilters f, CancellationToken ct)
    {
        var query = _db.Policies
            .Include(p => p.Customer)
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Producer)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null);

        if (f.From.HasValue) query = query.Where(p => p.StartDate >= f.From);
        if (f.To.HasValue)   query = query.Where(p => p.StartDate <= f.To);
        if (f.InsuranceCompanyId.HasValue)
        {
            // Cascade: when a broker is selected, also include all of its subs
            // so the production list reflects the whole hierarchy. When a sub
            // (or a standalone carrier) is selected, only its own policies.
            var carrierIds = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null
                    && (c.Id == f.InsuranceCompanyId.Value
                        || c.ParentCompanyId == f.InsuranceCompanyId.Value))
                .Select(c => c.Id)
                .ToListAsync(ct);
            query = query.Where(p => carrierIds.Contains(p.InsuranceCompanyId));
        }
        if (f.ProducerId.HasValue)         query = query.Where(p => p.ProducerId == f.ProducerId);
        if (f.PolicyType.HasValue)         query = query.Where(p => p.PolicyType == f.PolicyType);
        if (f.Status.HasValue)             query = query.Where(p => p.Status == f.Status);
        if (f.VehicleUseCategory.HasValue) query = query.Where(p => p.VehicleUseCategory == f.VehicleUseCategory);

        var policies = await query.OrderByDescending(p => p.StartDate).Take(5000).ToListAsync(ct);
        var requestedCover = CleanCode(f.CoverCode);
        if (requestedCover is not null)
            policies = policies.Where(p => string.Equals(ExtractCoverCode(p.SpecsJson), requestedCover, StringComparison.OrdinalIgnoreCase)).ToList();
        var requestedPackage = CleanCode(f.PackageCode);
        if (requestedPackage is not null)
            policies = policies.Where(p => string.Equals(ExtractPackageCode(p.SpecsJson), requestedPackage, StringComparison.OrdinalIgnoreCase)).ToList();

        // Pull active commission rules so partner commission % can be read from
        // parameterization (NOT the bridge). Most-specific rule wins.
        var rules = await _db.CommissionRules
            .Where(r => r.DeletedAt == null
                && (r.EffectiveFrom <= DateOnly.FromDateTime(DateTime.UtcNow))
                && (r.EffectiveTo == null || r.EffectiveTo >= DateOnly.FromDateTime(DateTime.UtcNow)))
            .ToListAsync(ct);

        // Resolve producer tiers so per-tier rules can target a whole bucket
        // (Α/Β/Γ/Δ/Ε) instead of an individual partner.
        var producerTiers = policies.Where(x => x.ProducerId.HasValue)
            .Select(x => x.ProducerId!.Value).Distinct().ToList();
        var tierByProducer = producerTiers.Count == 0
            ? new Dictionary<Guid, ProducerTier>()
            : await _db.Producers.IgnoreQueryFilters()
                .Where(x => producerTiers.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Tier, ct);

        var policyIds = policies.Select(p => p.Id).ToList();
        var bridgeAgencyCommissionByPolicy = policyIds.Count == 0
            ? new Dictionary<Guid, decimal>()
            : await _db.FinancialMovements.IgnoreQueryFilters()
                .Where(m => m.TenantId == tenantId
                    && m.DeletedAt == null
                    && m.PolicyId.HasValue
                    && policyIds.Contains(m.PolicyId.Value)
                    && m.Kind == FinancialMovementKind.CommissionEarned
                    && m.Description != null
                    && m.Description.StartsWith("[bridge:"))
                .GroupBy(m => m.PolicyId!.Value)
                .ToDictionaryAsync(g => g.Key, g => g.Sum(x => x.Amount), ct);

        CommissionRule? LookupRule(Policy p, string? coverCode)
        {
            var tier = p.ProducerId.HasValue && tierByProducer.TryGetValue(p.ProducerId.Value, out var t)
                ? t : ProducerTier.None;

            return rules
                .Where(r => (!r.ProducerId.HasValue           || r.ProducerId == p.ProducerId)
                         && (!r.ProducerTier.HasValue         || r.ProducerTier == tier)
                         && (!r.InsuranceCompanyId.HasValue   || r.InsuranceCompanyId == p.InsuranceCompanyId)
                         && (!r.PolicyType.HasValue           || r.PolicyType == p.PolicyType)
                         && (r.CoverCode == null              || string.Equals(r.CoverCode, coverCode, StringComparison.OrdinalIgnoreCase))
                         && (!r.VehicleUseCategory.HasValue   || r.VehicleUseCategory == p.VehicleUseCategory))
                .OrderByDescending(r =>
                    (r.ProducerId.HasValue ? 32 : 0) +
                    (r.ProducerTier.HasValue ? 16 : 0) +
                    (r.CoverCode != null ? 8 : 0) +
                    (r.VehicleUseCategory.HasValue ? 4 : 0) +
                    (r.InsuranceCompanyId.HasValue ? 2 : 0) +
                    (r.PolicyType.HasValue ? 1 : 0))
                .FirstOrDefault();
        }

        decimal LookupPartnerPct(Policy p, CommissionRule? match)
        {
            if (p.SpecialCommissionPercent.HasValue) return p.SpecialCommissionPercent.Value;
            if (match is null) return 0m;
            // Prefer the new ProducerPercent column when populated; fall back to the
            // legacy single-value field so older rules still work end-to-end.
            if (match.ProducerPercent.HasValue) return match.ProducerPercent.Value;
            return match.CommissionType == CommissionType.Percentage ? match.Value : 0m;
        }

        return policies.Select(p =>
        {
            var coverCode = ExtractCoverCode(p.SpecsJson);
            var match = LookupRule(p, coverCode);
            var partnerPct = LookupPartnerPct(p, match);
            var net = p.PremiumIncludesVat ? Math.Round(p.Premium / 1.24m, 2) : p.Premium;
            var vat = p.Premium - net;
            var partnerComm = Math.Round(p.Premium * partnerPct / 100m, 2);
            var hasBridgeAgencyCommission = bridgeAgencyCommissionByPolicy.TryGetValue(p.Id, out var bridgeAgencyCommission);
            var incomingPct = hasBridgeAgencyCommission
                ? p.Premium > 0 ? Math.Round(bridgeAgencyCommission / p.Premium * 100m, 2) : 0m
                : match?.AgencyPercent ?? 20m;
            var incomingComm = hasBridgeAgencyCommission
                ? bridgeAgencyCommission
                : Math.Round(p.Premium * incomingPct / 100m, 2);
            var agencyComm = incomingComm - partnerComm;
            var agencyPct = p.Premium > 0 ? Math.Round(agencyComm / p.Premium * 100m, 2) : 0m;
            string? warning = null;
            if (hasBridgeAgencyCommission && match?.AgencyPercent.HasValue == true
                && Math.Abs(incomingPct - match.AgencyPercent.Value) > 0.5m)
                warning = $"Η γέφυρα δίνει προμήθεια γραφείου {incomingPct:0.##}% ενώ η παραμετροποίηση έχει {match.AgencyPercent.Value:0.##}%. Ισχύει η γέφυρα.";
            if (agencyComm < 0)
                warning = "Η προμήθεια συνεργάτη είναι μεγαλύτερη από την προμήθεια γραφείου. Ελέγξτε τη σύμβαση ή επικοινωνήστε για να επιλυθεί η διαφορά.";

            return new ProductionRowDto(
                p.Id, p.PolicyNumber,
                p.StartDate, p.EndDate,
                p.Customer == null ? "—"
                    : (p.Customer.Type == CustomerType.Individual
                        ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim()
                        : p.Customer.CompanyName ?? "—"),
                p.InsuranceCompany?.Name ?? "—",
                p.Producer?.Name,
                p.PolicyType.ToString(),
                p.Status.ToString(),
                p.VehicleUseCategory,
                coverCode,
                p.Premium, net, vat,
                partnerPct, partnerComm,
                agencyPct, agencyComm,
                incomingPct, incomingComm,
                warning);
        }).ToList();
    }

    private static string? CleanCode(string? value)
    {
        var cleaned = value?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static string? ExtractCoverCode(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(specsJson);
            foreach (var key in new[] { "coverCode", "coverageCode", "coverage", "cover" })
            {
                if (doc.RootElement.TryGetProperty(key, out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    return CleanCode(prop.GetString());
            }
        }
        catch { /* malformed specs are ignored for reporting filters */ }
        return null;
    }

    private static string? ExtractPackageCode(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(specsJson);
            foreach (var key in new[] { "packageCode", "package" })
            {
                if (doc.RootElement.TryGetProperty(key, out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                    return CleanCode(prop.GetString());
            }
        }
        catch { /* malformed specs are ignored */ }
        return null;
    }
}

/* ============================================================================
   EXPORTS — CSV / XLSX / PDF
   ========================================================================= */
public record ExportProductionListQuery(ProductionFilters Filters, string Format) : IRequest<ExportResult>;
public record ExportResult(byte[] Content, string MimeType, string FileName);

public class ExportProductionListHandler : IRequestHandler<ExportProductionListQuery, ExportResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ExportProductionListHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ExportResult> Handle(ExportProductionListQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await ProductionListBuilder.BuildRowsAsync(_db, tenantId, q.Filters, ct);
        var ts = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");

        return q.Format.ToLowerInvariant() switch
        {
            "csv"   => new ExportResult(BuildCsv(rows), "text/csv", $"production-{ts}.csv"),
            "xlsx"  => new ExportResult(BuildXlsx(rows, q.Filters), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"production-{ts}.xlsx"),
            "pdf"   => new ExportResult(BuildPdf(rows, q.Filters), "application/pdf", $"production-{ts}.pdf"),
            _ => throw new AppException("export_format_unsupported",
                $"Μη υποστηριζόμενο format: {q.Format}", 400,
                title: "Μη έγκυρο format",
                why: "Δεκτά: csv, xlsx, pdf.",
                fix: "Επιλέξτε ξανά από το dropdown εξαγωγής.")
        };
    }

    // Rows are always written carrier-by-carrier (alphabetical), customer-alphabetical
    // within each carrier, with a subtotal line per carrier and a grand total at the
    // end. This mirrors how the user reads paper παραγωγή lists at the agency.
    private static List<IGrouping<string, ProductionRowDto>> GroupForExport(List<ProductionRowDto> rows)
        => rows
            .OrderBy(r => r.InsuranceCompany, StringComparer.Create(new CultureInfo("el-GR"), true))
            .ThenBy(r => r.CustomerName,      StringComparer.Create(new CultureInfo("el-GR"), true))
            .GroupBy(r => r.InsuranceCompany)
            .ToList();

    private static byte[] BuildCsv(List<ProductionRowDto> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("PolicyNumber,StartDate,EndDate,Customer,Carrier,Producer,Type,Status,Gross,Net,VAT,PartnerComm%,PartnerComm,AgencyComm%,AgencyComm");
        foreach (var grp in GroupForExport(rows))
        {
            foreach (var r in grp)
                sb.AppendLine(string.Join(",",
                    Csv(r.PolicyNumber), r.StartDate, r.EndDate,
                    Csv(r.CustomerName), Csv(r.InsuranceCompany), Csv(r.Producer ?? ""),
                    r.PolicyType, r.Status,
                    F(r.Gross), F(r.Net), F(r.Vat),
                    F(r.PartnerCommissionPercent), F(r.PartnerCommission),
                    F(r.AgencyCommissionPercent), F(r.AgencyCommission)));
            sb.AppendLine(string.Join(",",
                "", "", "", "", Csv($"ΣΥΝΟΛΟ {grp.Key}"), "", "", $"{grp.Count()} συμβ.",
                F(grp.Sum(x => x.Gross)), F(grp.Sum(x => x.Net)), F(grp.Sum(x => x.Vat)),
                "", F(grp.Sum(x => x.PartnerCommission)), "", F(grp.Sum(x => x.AgencyCommission))));
        }
        sb.AppendLine(string.Join(",",
            "", "", "", "", "\"ΓΕΝΙΚΟ ΣΥΝΟΛΟ\"", "", "", $"{rows.Count} συμβ.",
            F(rows.Sum(x => x.Gross)), F(rows.Sum(x => x.Net)), F(rows.Sum(x => x.Vat)),
            "", F(rows.Sum(x => x.PartnerCommission)), "", F(rows.Sum(x => x.AgencyCommission))));
        return new UTF8Encoding(true).GetBytes(sb.ToString());

        static string Csv(string s) => "\"" + s.Replace("\"", "\"\"") + "\"";
        static string F(decimal d) => d.ToString("F2", CultureInfo.InvariantCulture);
    }

    private static byte[] BuildXlsx(List<ProductionRowDto> rows, ProductionFilters f)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Production");

        // Header banner
        ws.Cell(1, 1).Value = "Kalypsis — Λίστα Παραγωγής";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Range(1, 1, 1, 15).Merge();
        ws.Cell(2, 1).Value = $"Φίλτρα: {f.From?.ToString() ?? "—"} → {f.To?.ToString() ?? "—"} · {f.PolicyType?.ToString() ?? "όλοι κλάδοι"} · {f.Status?.ToString() ?? "όλες καταστάσεις"}";
        ws.Cell(2, 1).Style.Font.Italic = true;
        ws.Range(2, 1, 2, 15).Merge();

        var headers = new[] { "Αρ.Συμβ.", "Έναρξη", "Λήξη", "Πελάτης", "Εταιρία", "Συνεργάτης", "Κλάδος",
            "Κατάσταση", "Μεικτό", "Καθαρό", "ΦΠΑ", "Προμ.Συν.%", "Προμ.Συν.€", "Προμ.Γρ.%", "Προμ.Γρ.€" };
        for (int i = 0; i < headers.Length; i++)
        {
            var c = ws.Cell(4, i + 1);
            c.Value = headers[i];
            c.Style.Font.Bold = true;
            c.Style.Fill.BackgroundColor = XLColor.FromHtml("#0b2545");
            c.Style.Font.FontColor = XLColor.White;
        }

        int r0 = 5;
        int cur = r0;
        var groups = GroupForExport(rows);
        foreach (var grp in groups)
        {
            // Carrier header band (visual separator)
            ws.Cell(cur, 1).Value = grp.Key;
            ws.Cell(cur, 1).Style.Font.Bold = true;
            ws.Cell(cur, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#e6edf5");
            ws.Range(cur, 1, cur, 15).Merge();
            ws.Range(cur, 1, cur, 15).Style.Border.BottomBorder = XLBorderStyleValues.Thin;
            cur++;

            int groupStart = cur;
            foreach (var r in grp)
            {
                ws.Cell(cur, 1).Value = r.PolicyNumber;
                ws.Cell(cur, 2).Value = r.StartDate.ToString("yyyy-MM-dd");
                ws.Cell(cur, 3).Value = r.EndDate.ToString("yyyy-MM-dd");
                ws.Cell(cur, 4).Value = r.CustomerName;
                ws.Cell(cur, 5).Value = r.InsuranceCompany;
                ws.Cell(cur, 6).Value = r.Producer ?? "";
                ws.Cell(cur, 7).Value = r.PolicyType;
                ws.Cell(cur, 8).Value = r.Status;
                ws.Cell(cur, 9).Value = (double)r.Gross;
                ws.Cell(cur, 10).Value = (double)r.Net;
                ws.Cell(cur, 11).Value = (double)r.Vat;
                ws.Cell(cur, 12).Value = (double)r.PartnerCommissionPercent;
                ws.Cell(cur, 13).Value = (double)r.PartnerCommission;
                ws.Cell(cur, 14).Value = (double)r.AgencyCommissionPercent;
                ws.Cell(cur, 15).Value = (double)r.AgencyCommission;
                cur++;
            }

            // Per-carrier subtotal row
            int sub = cur;
            ws.Cell(sub, 1).Value = $"ΣΥΝΟΛΟ {grp.Key}";
            ws.Cell(sub, 8).Value = $"{grp.Count()} συμβ.";
            ws.Cell(sub, 9).FormulaA1 = $"=SUM(I{groupStart}:I{sub - 1})";
            ws.Cell(sub, 10).FormulaA1 = $"=SUM(J{groupStart}:J{sub - 1})";
            ws.Cell(sub, 11).FormulaA1 = $"=SUM(K{groupStart}:K{sub - 1})";
            ws.Cell(sub, 13).FormulaA1 = $"=SUM(M{groupStart}:M{sub - 1})";
            ws.Cell(sub, 15).FormulaA1 = $"=SUM(O{groupStart}:O{sub - 1})";
            ws.Range(sub, 1, sub, 15).Style.Font.Bold = true;
            ws.Range(sub, 1, sub, 15).Style.Fill.BackgroundColor = XLColor.FromHtml("#f5f8fc");
            ws.Range(sub, 1, sub, 15).Style.Border.TopBorder = XLBorderStyleValues.Thin;
            cur = sub + 1;
            // visual gap between groups
            cur++;
        }

        // Grand total
        int tot = cur;
        ws.Cell(tot, 1).Value = "ΓΕΝΙΚΟ ΣΥΝΟΛΟ";
        ws.Cell(tot, 8).Value = $"{rows.Count} συμβ.";
        // Sum across carrier subtotals — find the subtotal rows we wrote.
        // Simpler & robust: just sum every cell in the data range (subtotals add
        // back the same amounts → we instead sum source rows directly).
        ws.Cell(tot, 9).Value  = (double)rows.Sum(x => x.Gross);
        ws.Cell(tot, 10).Value = (double)rows.Sum(x => x.Net);
        ws.Cell(tot, 11).Value = (double)rows.Sum(x => x.Vat);
        ws.Cell(tot, 13).Value = (double)rows.Sum(x => x.PartnerCommission);
        ws.Cell(tot, 15).Value = (double)rows.Sum(x => x.AgencyCommission);
        ws.Range(tot, 1, tot, 15).Style.Font.Bold = true;
        ws.Range(tot, 1, tot, 15).Style.Fill.BackgroundColor = XLColor.FromHtml("#0b2545");
        ws.Range(tot, 1, tot, 15).Style.Font.FontColor = XLColor.White;
        ws.Range(tot, 1, tot, 15).Style.Border.TopBorder = XLBorderStyleValues.Double;

        // Format numeric cols
        ws.Range(r0, 9, tot, 11).Style.NumberFormat.Format = "#,##0.00 €";
        ws.Range(r0, 12, tot, 12).Style.NumberFormat.Format = "0.00\"%\"";
        ws.Range(r0, 13, tot, 13).Style.NumberFormat.Format = "#,##0.00 €";
        ws.Range(r0, 14, tot, 14).Style.NumberFormat.Format = "0.00\"%\"";
        ws.Range(r0, 15, tot, 15).Style.NumberFormat.Format = "#,##0.00 €";
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static byte[] BuildPdf(List<ProductionRowDto> rows, ProductionFilters f)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var doc = QuestPDF.Fluent.Document.Create(d =>
        {
            d.Page(p =>
            {
                p.Size(PageSizes.A4.Landscape());
                p.Margin(1.4f, QuestPDF.Infrastructure.Unit.Centimetre);
                p.DefaultTextStyle(s => s.FontSize(9));

                p.Header().Column(col =>
                {
                    col.Item().Text("Kalypsis — Λίστα Παραγωγής").FontSize(16).Bold();
                    col.Item().Text($"Φίλτρα: {f.From?.ToString() ?? "—"} → {f.To?.ToString() ?? "—"} · "
                        + $"{f.PolicyType?.ToString() ?? "όλοι κλάδοι"} · {f.Status?.ToString() ?? "όλες"} · "
                        + $"{rows.Count} γραμμές").FontSize(9).Italic();
                });

                p.Content().Table(t =>
                {
                    t.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(2);   // PolicyNo
                        c.RelativeColumn(1.6f); // Date
                        c.RelativeColumn(3);   // Customer
                        c.RelativeColumn(2.4f); // Carrier
                        c.RelativeColumn(2);   // Producer
                        c.RelativeColumn(1.2f); // Type
                        c.RelativeColumn(1.4f); // Gross
                        c.RelativeColumn(1.4f); // Net
                        c.RelativeColumn(1.2f); // Partner€
                        c.RelativeColumn(1.2f); // Agency€
                    });
                    t.Header(h =>
                    {
                        h.Cell().Background("#0b2545").Padding(4).Text("Αρ.Συμβ").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).Text("Έναρξη").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).Text("Πελάτης").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).Text("Εταιρία").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).Text("Συνεργάτης").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).Text("Κλάδος").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).AlignRight().Text("Μεικτό").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).AlignRight().Text("Καθαρό").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).AlignRight().Text("Προμ.Συν").FontColor(Colors.White).Bold();
                        h.Cell().Background("#0b2545").Padding(4).AlignRight().Text("Προμ.Γρ").FontColor(Colors.White).Bold();
                    });
                    foreach (var grp in GroupForExport(rows))
                    {
                        // Carrier band — span all 10 columns
                        t.Cell().ColumnSpan(10).Background("#e6edf5").Padding(4).Text(grp.Key).Bold();

                        foreach (var r in grp)
                        {
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.PolicyNumber);
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.StartDate.ToString("dd/MM/yy"));
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.CustomerName);
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.InsuranceCompany);
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.Producer ?? "—");
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(r.PolicyType);
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).AlignRight().Text(r.Gross.ToString("N2"));
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).AlignRight().Text(r.Net.ToString("N2"));
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).AlignRight().Text(r.PartnerCommission.ToString("N2"));
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).AlignRight().Text(r.AgencyCommission.ToString("N2"));
                        }

                        // Per-carrier subtotal
                        t.Cell().Background("#f5f8fc").Padding(4).Text($"ΣΥΝΟΛΟ {grp.Key}").Bold();
                        t.Cell().Background("#f5f8fc").Padding(4).Text("");
                        t.Cell().Background("#f5f8fc").Padding(4).Text("");
                        t.Cell().Background("#f5f8fc").Padding(4).Text("");
                        t.Cell().Background("#f5f8fc").Padding(4).Text("");
                        t.Cell().Background("#f5f8fc").Padding(4).Text($"{grp.Count()} συμβ.").Bold();
                        t.Cell().Background("#f5f8fc").Padding(4).AlignRight().Text(grp.Sum(x => x.Gross).ToString("N2")).Bold();
                        t.Cell().Background("#f5f8fc").Padding(4).AlignRight().Text(grp.Sum(x => x.Net).ToString("N2")).Bold();
                        t.Cell().Background("#f5f8fc").Padding(4).AlignRight().Text(grp.Sum(x => x.PartnerCommission).ToString("N2")).Bold();
                        t.Cell().Background("#f5f8fc").Padding(4).AlignRight().Text(grp.Sum(x => x.AgencyCommission).ToString("N2")).Bold();
                    }

                    // Grand total band (navy)
                    t.Cell().Background("#0b2545").Padding(4).Text("ΓΕΝΙΚΟ ΣΥΝΟΛΟ").FontColor(Colors.White).Bold();
                    t.Cell().Background("#0b2545").Padding(4).Text("").FontColor(Colors.White);
                    t.Cell().Background("#0b2545").Padding(4).Text("").FontColor(Colors.White);
                    t.Cell().Background("#0b2545").Padding(4).Text("").FontColor(Colors.White);
                    t.Cell().Background("#0b2545").Padding(4).Text("").FontColor(Colors.White);
                    t.Cell().Background("#0b2545").Padding(4).Text($"{rows.Count} συμβ.").FontColor(Colors.White).Bold();
                    t.Cell().Background("#0b2545").Padding(4).AlignRight().Text(rows.Sum(r => r.Gross).ToString("N2")).FontColor(Colors.White).Bold();
                    t.Cell().Background("#0b2545").Padding(4).AlignRight().Text(rows.Sum(r => r.Net).ToString("N2")).FontColor(Colors.White).Bold();
                    t.Cell().Background("#0b2545").Padding(4).AlignRight().Text(rows.Sum(r => r.PartnerCommission).ToString("N2")).FontColor(Colors.White).Bold();
                    t.Cell().Background("#0b2545").Padding(4).AlignRight().Text(rows.Sum(r => r.AgencyCommission).ToString("N2")).FontColor(Colors.White).Bold();
                });

                p.Footer().AlignRight().Text(t => { t.Span("Σελ. "); t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
            });
        });
        return doc.GeneratePdf();
    }
}
