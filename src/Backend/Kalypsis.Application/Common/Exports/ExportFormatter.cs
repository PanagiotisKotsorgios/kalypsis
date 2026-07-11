using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Exports;

// Shared CSV / XLSX / PDF formatters for any backoffice export.
// Per-feature exports build a Sheet then call into one of the three builders.

public record Sheet(
    string Title,
    IReadOnlyList<string> Headers,
    IReadOnlyList<IReadOnlyList<string>> Rows,
    string? Subtitle = null,
    string? TenantLabel = null);

public static class ExportFormatter
{
    // Every Kalypsis-emitted export gets a small copyright/branding trailer so
    // the file can always be traced back to the platform even after it's been
    // forwarded around.
    private const string BrandUrl        = "https://mykalypsis.gr";
    private const string BrandLine       = "Kalypsis — Πλατφόρμα Διαχείρισης Ασφαλιστικού Γραφείου";
    private static string CopyrightLine  => $"© {DateTime.UtcNow.Year} Kalypsis · {BrandUrl}";
    private static string GeneratedLine  => $"Δημιουργήθηκε από το Kalypsis στις {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC";

    public static byte[] BuildCsv(Sheet sheet)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", sheet.Headers.Select(Quote)));
        foreach (var r in sheet.Rows)
            sb.AppendLine(string.Join(",", r.Select(Quote)));
        // Blank + branding lines. Quoted so any comma in the brand text
        // doesn't confuse the CSV parser.
        sb.AppendLine();
        sb.AppendLine(Quote(BrandLine));
        sb.AppendLine(Quote(CopyrightLine));
        sb.AppendLine(Quote(GeneratedLine));
        return new UTF8Encoding(true).GetBytes(sb.ToString());

        static string Quote(string s) => "\"" + (s ?? "").Replace("\"", "\"\"") + "\"";
    }

    public static byte[] BuildXlsx(Sheet sheet)
    {
        using var wb = new XLWorkbook();
        // Bake Kalypsis into the workbook's document properties so it shows
        // up in Excel's File → Info pane — impossible to trim, unlike row
        // trailers, and useful for compliance/traceability.
        wb.Properties.Title    = sheet.Title;
        wb.Properties.Subject  = BrandLine;
        wb.Properties.Author   = "Kalypsis";
        wb.Properties.Company  = $"Kalypsis · {BrandUrl}";
        wb.Properties.Comments = GeneratedLine;
        var safeTitle = SafeSheetName(sheet.Title);
        var ws = wb.Worksheets.Add(safeTitle);

        var lastCol = Math.Max(1, sheet.Headers.Count);

        ws.Cell(1, 1).Value = $"Kalypsis — {sheet.Title}";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Range(1, 1, 1, lastCol).Merge();

        var subtitleParts = new List<string> { $"Εξαγωγή: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC", $"{sheet.Rows.Count} γραμμές" };
        if (!string.IsNullOrWhiteSpace(sheet.TenantLabel)) subtitleParts.Insert(0, sheet.TenantLabel!);
        if (!string.IsNullOrWhiteSpace(sheet.Subtitle)) subtitleParts.Add(sheet.Subtitle!);
        ws.Cell(2, 1).Value = string.Join(" · ", subtitleParts);
        ws.Cell(2, 1).Style.Font.Italic = true;
        ws.Range(2, 1, 2, lastCol).Merge();

        for (int i = 0; i < sheet.Headers.Count; i++)
        {
            var c = ws.Cell(4, i + 1);
            c.Value = sheet.Headers[i];
            c.Style.Font.Bold = true;
            c.Style.Fill.BackgroundColor = XLColor.FromHtml("#0b2545");
            c.Style.Font.FontColor = XLColor.White;
            c.Style.Alignment.WrapText = true;
        }

        for (int rIdx = 0; rIdx < sheet.Rows.Count; rIdx++)
        {
            for (int cIdx = 0; cIdx < sheet.Rows[rIdx].Count; cIdx++)
                ws.Cell(5 + rIdx, cIdx + 1).Value = sheet.Rows[rIdx][cIdx];
            if (rIdx % 2 == 1)
            {
                ws.Range(5 + rIdx, 1, 5 + rIdx, lastCol).Style
                    .Fill.SetBackgroundColor(XLColor.FromHtml("#f4f6fa"));
            }
        }

        // Branding trailer: two blank rows + a bold copyright line so the
        // reader always sees where the file came from, plus a print header
        // & footer so the same appears when the sheet is printed.
        var trailerStart = 5 + sheet.Rows.Count + 2;
        ws.Cell(trailerStart, 1).Value = BrandLine;
        ws.Cell(trailerStart, 1).Style.Font.Bold = true;
        ws.Cell(trailerStart, 1).Style.Font.FontColor = XLColor.FromHtml("#0b2545");
        ws.Range(trailerStart, 1, trailerStart, lastCol).Merge();

        ws.Cell(trailerStart + 1, 1).Value = CopyrightLine;
        ws.Cell(trailerStart + 1, 1).Style.Font.FontColor = XLColor.FromHtml("#666666");
        ws.Cell(trailerStart + 1, 1).Style.Font.FontSize = 9;
        ws.Range(trailerStart + 1, 1, trailerStart + 1, lastCol).Merge();

        ws.Cell(trailerStart + 2, 1).Value = GeneratedLine;
        ws.Cell(trailerStart + 2, 1).Style.Font.FontColor = XLColor.FromHtml("#888888");
        ws.Cell(trailerStart + 2, 1).Style.Font.FontSize = 9;
        ws.Cell(trailerStart + 2, 1).Style.Font.Italic = true;
        ws.Range(trailerStart + 2, 1, trailerStart + 2, lastCol).Merge();

        ws.PageSetup.Header.Left.AddText(BrandLine);
        ws.PageSetup.Footer.Right.AddText(CopyrightLine);

        ws.SheetView.FreezeRows(4);
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public static byte[] BuildPdf(Sheet sheet)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var doc = QuestPDF.Fluent.Document.Create(d =>
        {
            d.Page(p =>
            {
                p.Size(PageSizes.A4.Landscape());
                p.Margin(1.2f, Unit.Centimetre);
                p.DefaultTextStyle(s => s.FontSize(9));

                p.Header().Column(col =>
                {
                    col.Item().Text($"Kalypsis — {sheet.Title}").FontSize(16).Bold();
                    var subtitleParts = new List<string> { $"Εξαγωγή: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC", $"{sheet.Rows.Count} γραμμές" };
                    if (!string.IsNullOrWhiteSpace(sheet.TenantLabel)) subtitleParts.Insert(0, sheet.TenantLabel!);
                    if (!string.IsNullOrWhiteSpace(sheet.Subtitle)) subtitleParts.Add(sheet.Subtitle!);
                    col.Item().Text(string.Join(" · ", subtitleParts)).FontSize(9).Italic();
                });

                p.Content().PaddingTop(8).Table(t =>
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
                    var rowIndex = 0;
                    foreach (var row in sheet.Rows)
                    {
                        var bg = rowIndex++ % 2 == 1 ? "#f4f6fa" : "#ffffff";
                        foreach (var cell in row)
                            t.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#dadada").Padding(3).Text(cell ?? "");
                    }
                });

                // Two-column footer: Kalypsis brand + URL on the left,
                // pagination on the right. Copyright line spans the whole
                // width above so every printed page carries it.
                p.Footer().Column(col =>
                {
                    col.Item().PaddingBottom(2).LineHorizontal(0.5f).LineColor("#dadada");
                    col.Item().Row(r =>
                    {
                        r.RelativeItem().Text(text =>
                        {
                            text.Span(BrandLine).FontSize(8).FontColor("#0b2545");
                            text.Span("  ·  ").FontSize(8).FontColor("#888");
                            text.Span(BrandUrl).FontSize(8).FontColor("#1976d2");
                        });
                        r.ConstantItem(120).AlignRight().Text(text =>
                        {
                            text.Span("Σελ. ").FontSize(8).FontColor("#666");
                            text.CurrentPageNumber().FontSize(8).FontColor("#666");
                            text.Span(" / ").FontSize(8).FontColor("#666");
                            text.TotalPages().FontSize(8).FontColor("#666");
                        });
                    });
                    col.Item().Text($"{CopyrightLine}").FontSize(7).FontColor("#888").Italic();
                });
            });
        });
        return doc.GeneratePdf();
    }

    public static string FormatBool(bool value) => value ? "Ναι" : "Όχι";
    public static string FormatDecimal(decimal? value) => value?.ToString("F2", CultureInfo.InvariantCulture) ?? "";
    public static string FormatDecimal(decimal value) => value.ToString("F2", CultureInfo.InvariantCulture);
    public static string FormatDate(DateTime? value) => value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "";
    public static string FormatDate(DateTime value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    public static string FormatDate(DateOnly? value) => value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? "";
    public static string FormatDate(DateOnly value) => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    public static string FormatDateTime(DateTime? value) => value?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "";

    private static string SafeSheetName(string raw)
    {
        var cleaned = new string((raw ?? "Export").Where(c => c != ':' && c != '\\' && c != '/' && c != '?' && c != '*' && c != '[' && c != ']').ToArray());
        return cleaned.Length > 31 ? cleaned.Substring(0, 31) : cleaned;
    }
}
