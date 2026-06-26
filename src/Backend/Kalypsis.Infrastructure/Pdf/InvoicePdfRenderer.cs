using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Infrastructure.Pdf;

/// <summary>
/// Renders a TenantInvoice to a PDF using QuestPDF. Styling is intentionally
/// quiet — navy headings, hairline rules, no logos — so the document stays
/// usable in B2B contexts before brand assets are in place.
/// </summary>
public class InvoicePdfRenderer : IInvoicePdfRenderer
{
    static InvoicePdfRenderer()
    {
        // QuestPDF Community license — free for projects with under €1M
        // annual revenue. Bump this if/when revenue crosses the threshold.
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static readonly string NavyHex = "#0B2545";
    private static readonly string SoftHex = "#3D4F6B";
    private static readonly string RuleHex = "#E5E9EF";

    public byte[] Render(TenantInvoice invoice, Tenant tenant)
    {
        var culture = CultureInfo.GetCultureInfo("el-GR");

        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(10).FontColor(NavyHex));

                // ---------- HEADER ----------
                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("KALYPSIS").FontSize(20).Bold().LetterSpacing(0.04f).FontColor(NavyHex);
                        col.Item().Text("Πλατφόρμα Ασφαλιστικού Γραφείου").FontSize(9).FontColor(SoftHex);
                        col.Item().Text("info@kalypsis.gr · 2631028971").FontSize(9).FontColor(SoftHex);
                    });
                    row.RelativeItem().AlignRight().Column(col =>
                    {
                        col.Item().Text("ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ").FontSize(11).Bold().FontColor(NavyHex);
                        col.Item().Text(invoice.InvoiceNumber).FontSize(13).Bold();
                        col.Item().Text($"Έκδοση: {invoice.IssuedAt.ToLocalTime():dd/MM/yyyy}").FontSize(9).FontColor(SoftHex);
                        col.Item().Text($"Λήξη: {invoice.DueAt.ToLocalTime():dd/MM/yyyy}").FontSize(9).FontColor(SoftHex);
                    });
                });

                // ---------- BODY ----------
                page.Content().PaddingVertical(16).Column(col =>
                {
                    // Tenant block + period block side-by-side
                    col.Item().PaddingVertical(8).Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text("ΠΕΛΑΤΗΣ").FontSize(8).LetterSpacing(0.16f).FontColor(SoftHex);
                            c.Item().PaddingTop(2).Text(tenant.Name).Bold().FontSize(12);
                            if (!string.IsNullOrWhiteSpace(tenant.AddressLine))
                                c.Item().Text(tenant.AddressLine).FontSize(9).FontColor(SoftHex);
                            if (!string.IsNullOrWhiteSpace(tenant.VatNumber))
                                c.Item().Text($"ΑΦΜ: {tenant.VatNumber}").FontSize(9).FontColor(SoftHex);
                            if (!string.IsNullOrWhiteSpace(tenant.ContactEmail))
                                c.Item().Text(tenant.ContactEmail).FontSize(9).FontColor(SoftHex);
                            c.Item().Text($"Κωδικός γραφείου: {tenant.Code}").FontSize(9).FontColor(SoftHex);
                        });
                        row.ConstantItem(180).AlignRight().Column(c =>
                        {
                            c.Item().Text("ΠΕΡΙΟΔΟΣ").FontSize(8).LetterSpacing(0.16f).FontColor(SoftHex);
                            var periodLabel = new DateTime(invoice.PeriodYear, invoice.PeriodMonth, 1)
                                .ToString("MMMM yyyy", culture);
                            c.Item().PaddingTop(2).Text(periodLabel).Bold().FontSize(12);
                            c.Item().Text($"Νόμισμα: {invoice.Currency}").FontSize(9).FontColor(SoftHex);
                        });
                    });

                    // Lines table
                    col.Item().PaddingTop(16).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(5);
                            c.RelativeColumn(1);
                            c.RelativeColumn(2);
                            c.RelativeColumn(2);
                        });
                        t.Header(h =>
                        {
                            h.Cell().Element(HeaderCell).Text("Περιγραφή");
                            h.Cell().Element(HeaderCell).AlignRight().Text("Ποσότ.");
                            h.Cell().Element(HeaderCell).AlignRight().Text("Τιμή Μονάδας");
                            h.Cell().Element(HeaderCell).AlignRight().Text("Σύνολο");
                        });
                        foreach (var line in invoice.Lines.OrderBy(l => l.Package))
                        {
                            t.Cell().Element(BodyCell).Text(line.Description);
                            t.Cell().Element(BodyCell).AlignRight().Text(line.Quantity.ToString(culture));
                            t.Cell().Element(BodyCell).AlignRight().Text(line.MonthlyPrice.ToString("C2", culture));
                            t.Cell().Element(BodyCell).AlignRight().Text(line.LineTotal.ToString("C2", culture));
                        }
                    });

                    // Totals
                    col.Item().PaddingTop(16).AlignRight().Column(c =>
                    {
                        c.Item().Row(r =>
                        {
                            r.ConstantItem(180).Text("Καθαρή αξία:").FontColor(SoftHex);
                            r.ConstantItem(120).AlignRight().Text(invoice.Subtotal.ToString("C2", culture));
                        });
                        c.Item().Row(r =>
                        {
                            r.ConstantItem(180).Text($"Φ.Π.Α. {(invoice.VatRate * 100m):F0}%:").FontColor(SoftHex);
                            r.ConstantItem(120).AlignRight().Text(invoice.VatAmount.ToString("C2", culture));
                        });
                        c.Item().PaddingTop(4).BorderTop(1).BorderColor(NavyHex).Row(r =>
                        {
                            r.ConstantItem(180).PaddingTop(6).Text("Συνολικό ποσό:").Bold();
                            r.ConstantItem(120).PaddingTop(6).AlignRight().Text(invoice.Total.ToString("C2", culture)).Bold();
                        });
                    });

                    if (!string.IsNullOrWhiteSpace(invoice.Notes))
                    {
                        col.Item().PaddingTop(24).BorderTop(1).BorderColor(RuleHex).PaddingTop(12).Column(c =>
                        {
                            c.Item().Text("Σημειώσεις").FontSize(8).LetterSpacing(0.16f).FontColor(SoftHex);
                            c.Item().PaddingTop(4).Text(invoice.Notes).FontSize(10);
                        });
                    }
                });

                // ---------- FOOTER ----------
                page.Footer().BorderTop(1).BorderColor(RuleHex).PaddingTop(8).Row(row =>
                {
                    row.RelativeItem().Text($"Kalypsis · info@kalypsis.gr · {DateTime.UtcNow.Year}")
                        .FontSize(8).FontColor(SoftHex);
                    row.RelativeItem().AlignRight().Text(text =>
                    {
                        text.DefaultTextStyle(s => s.FontSize(8).FontColor(SoftHex));
                        text.Span("Σελίδα ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
                });
            });
        }).GeneratePdf();
    }

    private static IContainer HeaderCell(IContainer c) =>
        c.DefaultTextStyle(s => s.FontSize(9).Bold().FontColor("#3D4F6B").LetterSpacing(0.08f))
            .PaddingVertical(6).BorderBottom(1).BorderColor("#0B2545");

    private static IContainer BodyCell(IContainer c) =>
        c.DefaultTextStyle(s => s.FontSize(10).FontColor("#0B2545"))
            .PaddingVertical(6).BorderBottom(1).BorderColor("#E5E9EF");
}
