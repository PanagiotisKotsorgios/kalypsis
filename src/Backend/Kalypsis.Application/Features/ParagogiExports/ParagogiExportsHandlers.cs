using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Kalypsis.Application.Features.Claims;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Enums;
using MediatR;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Features.ParagogiExports;

// ============================================================================
// Server-side CSV / XLSX / PDF exports for every ΠΑΡΑΓΩΓΗ sidebar item:
// Customers, Policies, Claims, Producers.
// Delegates row loading to each entity's existing list handler so filter logic
// stays in ONE place; we just format and stream.
// ============================================================================

public enum ParagogiEntity { Customers, Policies, Claims, Producers }

public record ExportParagogiQuery(
    ParagogiEntity Entity,
    string Format,                                 // "csv" | "xlsx" | "pdf"
    string? Search,
    PolicyStatus? PolicyStatus = null,
    PolicyType? PolicyType = null,
    ClaimStatus? ClaimStatus = null) : IRequest<ExportResult>;

public class ExportParagogiHandler : IRequestHandler<ExportParagogiQuery, ExportResult>
{
    private readonly IMediator _mediator;
    public ExportParagogiHandler(IMediator mediator) { _mediator = mediator; }

    public async Task<ExportResult> Handle(ExportParagogiQuery q, CancellationToken ct)
    {
        var ts = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");
        var fmt = q.Format.ToLowerInvariant();
        var entityKey = q.Entity.ToString().ToLowerInvariant();
        var name = $"{entityKey}-{ts}";

        var sheet = q.Entity switch
        {
            ParagogiEntity.Customers => await BuildCustomersAsync(q, ct),
            ParagogiEntity.Policies  => await BuildPoliciesAsync(q, ct),
            ParagogiEntity.Claims    => await BuildClaimsAsync(q, ct),
            ParagogiEntity.Producers => await BuildProducersAsync(q, ct),
            _ => throw new ArgumentOutOfRangeException()
        };

        return fmt switch
        {
            "csv"  => new ExportResult(BuildCsv(sheet), "text/csv", $"{name}.csv"),
            "xlsx" => new ExportResult(BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx"),
            "pdf"  => new ExportResult(BuildPdf(sheet), "application/pdf", $"{name}.pdf"),
            _ => throw new ArgumentException("Unsupported format: " + q.Format)
        };
    }

    // ---- per-entity row builders ------------------------------------------------

    private record Sheet(string Title, IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows);

    private async Task<Sheet> BuildCustomersAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListCustomersQuery(q.Search), ct);
        return new Sheet(
            "Πελάτες",
            new[] { "Α/Α", "Όνομα/Επωνυμία", "ΑΦΜ", "Email", "Τηλέφωνο", "Πόλη", "Δημ.", "Πύλη" },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.CustomerNumber,
                c.Type == CustomerType.Company
                    ? c.CompanyName ?? ""
                    : $"{c.FirstName} {c.LastName}".Trim(),
                c.VatNumber ?? "",
                c.Email ?? "",
                c.Phone ?? "",
                c.City ?? "",
                c.CreatedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                c.HasPortalAccount ? "Ναι" : "Όχι"
            }).ToList());
    }

    private async Task<Sheet> BuildPoliciesAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(
            new ListPoliciesQuery(q.Search, q.PolicyStatus, q.PolicyType, null), ct);
        return new Sheet(
            "Συμβόλαια",
            new[] { "Αρ.Συμβ.", "Πελάτης", "Εταιρία", "Συνεργάτης", "Κλάδος", "Κατάσταση", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Νόμισμα" },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.PolicyNumber,
                p.CustomerDisplay,
                p.InsuranceCompanyName,
                p.ProducerName ?? "",
                p.PolicyType.ToString(),
                p.Status.ToString(),
                p.StartDate.ToString("yyyy-MM-dd"),
                p.EndDate.ToString("yyyy-MM-dd"),
                p.Premium.ToString("F2", CultureInfo.InvariantCulture),
                p.Currency
            }).ToList());
    }

    private async Task<Sheet> BuildClaimsAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListClaimsQuery(q.ClaimStatus, null), ct);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            rows = rows.Where(c =>
                (c.ClaimNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (c.PolicyNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (c.CustomerDisplay?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }
        return new Sheet(
            "Ζημίες",
            new[] { "Αρ.Ζημίας", "Συμβόλαιο", "Πελάτης", "Εταιρία", "Κλάδος", "Κατάσταση", "Συμβάν", "Αναγγελία", "Διεκδικ.", "Εγκρ." },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.ClaimNumber,
                c.PolicyNumber,
                c.CustomerDisplay,
                c.InsuranceCompanyName,
                c.PolicyType.ToString(),
                c.Status.ToString(),
                c.IncidentDate.ToString("yyyy-MM-dd"),
                c.ReportedDate.ToString("yyyy-MM-dd"),
                c.ClaimedAmount?.ToString("F2", CultureInfo.InvariantCulture) ?? "",
                c.ApprovedAmount?.ToString("F2", CultureInfo.InvariantCulture) ?? ""
            }).ToList());
    }

    private async Task<Sheet> BuildProducersAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListProducersQuery(), ct);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            rows = rows.Where(p =>
                p.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                p.Name.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (p.Email?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (p.Phone?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false))
                .ToList();
        }
        return new Sheet(
            "Συνεργάτες",
            new[] { "Κωδικός", "Όνομα", "Email", "Τηλέφωνο", "Κατάσταση", "Συμβόλαια", "Δημ." },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.Code, p.Name, p.Email ?? "", p.Phone ?? "",
                p.Status.ToString(),
                p.PolicyCount.ToString(CultureInfo.InvariantCulture),
                p.CreatedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            }).ToList());
    }

    // ---- formatters -------------------------------------------------------------

    private static byte[] BuildCsv(Sheet sheet)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", sheet.Headers.Select(Quote)));
        foreach (var r in sheet.Rows)
            sb.AppendLine(string.Join(",", r.Select(Quote)));
        return new UTF8Encoding(true).GetBytes(sb.ToString());

        static string Quote(string s) => "\"" + (s ?? "").Replace("\"", "\"\"") + "\"";
    }

    private static byte[] BuildXlsx(Sheet sheet)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(sheet.Title);

        ws.Cell(1, 1).Value = $"Kalypsis — {sheet.Title}";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Range(1, 1, 1, sheet.Headers.Count).Merge();

        ws.Cell(2, 1).Value = $"Εξαγωγή: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC · {sheet.Rows.Count} γραμμές";
        ws.Cell(2, 1).Style.Font.Italic = true;
        ws.Range(2, 1, 2, sheet.Headers.Count).Merge();

        for (int i = 0; i < sheet.Headers.Count; i++)
        {
            var c = ws.Cell(4, i + 1);
            c.Value = sheet.Headers[i];
            c.Style.Font.Bold = true;
            c.Style.Fill.BackgroundColor = XLColor.FromHtml("#0b2545");
            c.Style.Font.FontColor = XLColor.White;
        }

        for (int rIdx = 0; rIdx < sheet.Rows.Count; rIdx++)
        {
            for (int cIdx = 0; cIdx < sheet.Rows[rIdx].Count; cIdx++)
                ws.Cell(5 + rIdx, cIdx + 1).Value = sheet.Rows[rIdx][cIdx];
        }
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static byte[] BuildPdf(Sheet sheet)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var doc = QuestPDF.Fluent.Document.Create(d =>
        {
            d.Page(p =>
            {
                p.Size(PageSizes.A4.Landscape());
                p.Margin(1.2f, QuestPDF.Infrastructure.Unit.Centimetre);
                p.DefaultTextStyle(s => s.FontSize(9));

                p.Header().Column(col =>
                {
                    col.Item().Text($"Kalypsis — {sheet.Title}").FontSize(16).Bold();
                    col.Item().Text($"Εξαγωγή: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC · {sheet.Rows.Count} γραμμές").FontSize(9).Italic();
                });

                p.Content().Table(t =>
                {
                    t.ColumnsDefinition(c =>
                    {
                        for (int i = 0; i < sheet.Headers.Count; i++)
                            c.RelativeColumn();
                    });
                    t.Header(h =>
                    {
                        foreach (var head in sheet.Headers)
                            h.Cell().Background("#0b2545").Padding(4)
                                .Text(head).FontColor(Colors.White).Bold();
                    });
                    foreach (var row in sheet.Rows)
                        foreach (var cell in row)
                            t.Cell().BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(cell ?? "");
                });

                p.Footer().AlignRight().Text(t => { t.Span("Σελ. "); t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
            });
        });
        return doc.GeneratePdf();
    }
}
