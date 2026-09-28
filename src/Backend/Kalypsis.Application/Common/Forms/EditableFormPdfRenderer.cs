using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>
/// Safe fallback renderer for office-customised legal forms. The office edits
/// HTML in the WYSIWYG designer; signing still uses QuestPDF so the generated
/// document remains deterministic and the signature blocks cannot be removed
/// accidentally from the workflow.
/// </summary>
public static class EditableFormPdfRenderer
{
    private const string Navy = "#0B2545";
    private const string Muted = "#52657A";
    private const string Rule = "#D9E0E8";

    public static byte[] Render(
        Tenant tenant,
        CustomerFormSigning signing,
        byte[]? logo,
        byte[]? customerSignature,
        byte[]? officeSignature,
        byte[]? insurerSignature)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var data = Parse(signing.FormDataJson);
        var header = HtmlToText(data.GetValueOrDefault("__templateHeaderHtml"));
        var body = HtmlToText(data.GetValueOrDefault("__templateBodyHtml"));
        var footer = HtmlToText(data.GetValueOrDefault("__templateFooterHtml"));

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(34);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(9).FontColor(Navy));
            page.Header().Column(column =>
            {
                column.Item().Row(row =>
                {
                    if (logo is { Length: > 0 }) row.ConstantItem(100).Height(48).Image(logo).FitArea();
                    row.RelativeItem().PaddingLeft(logo is { Length: > 0 } ? 12 : 0).Column(info =>
                    {
                        info.Item().Text(tenant.Name).FontSize(16).Bold().FontColor(Navy);
                        if (!string.IsNullOrWhiteSpace(tenant.AddressLine)) info.Item().Text(tenant.AddressLine!).FontColor(Muted);
                        if (!string.IsNullOrWhiteSpace(tenant.ContactEmail)) info.Item().Text(tenant.ContactEmail!).FontColor(Muted);
                        if (!string.IsNullOrWhiteSpace(tenant.VatNumber)) info.Item().Text($"ΑΦΜ: {tenant.VatNumber}").FontColor(Muted);
                    });
                });
                column.Item().PaddingTop(8).LineHorizontal(1).LineColor(Navy);
            });
            page.Content().PaddingVertical(12).Column(column =>
            {
                if (!string.IsNullOrWhiteSpace(header))
                    column.Item().Text(header).FontSize(9).LineHeight(1.35f);
                if (!string.IsNullOrWhiteSpace(body))
                    column.Item().PaddingTop(10).Text(body).LineHeight(1.45f);

                column.Item().PaddingTop(18).Text("Υπογραφές").FontSize(10).Bold().FontColor(Navy);
                column.Item().PaddingTop(5).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                    });
                    SignatureCell(table, "Πελάτης", signing.CustomerFullNameSnapshot, customerSignature);
                    SignatureCell(table, "Γραφείο", tenant.Name, officeSignature);
                    SignatureCell(table, "Ασφαλιστική εταιρεία", signing.InsurerEmailSnapshot ?? "", insurerSignature);
                });

                if (!string.IsNullOrWhiteSpace(footer))
                    column.Item().PaddingTop(14).Text(footer).FontSize(8).FontColor(Muted).LineHeight(1.3f);
            });
            page.Footer().BorderTop(1).BorderColor(Rule).PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"{tenant.Name} · Kalypsis · {DateTime.UtcNow.Year}").FontSize(8).FontColor(Muted);
                row.ConstantItem(90).AlignRight().Text(text =>
                {
                    text.DefaultTextStyle(style => style.FontSize(8).FontColor(Muted));
                    text.Span("Σελίδα "); text.CurrentPageNumber(); text.Span("/"); text.TotalPages();
                });
            });
        })).GeneratePdf();
    }

    private static void SignatureCell(TableDescriptor table, string label, string signer, byte[]? signature)
    {
        table.Cell().Border(1).BorderColor(Rule).Padding(8).Column(column =>
        {
            column.Item().Text(label).Bold();
            if (signature is { Length: > 0 })
                column.Item().PaddingTop(7).Height(55).Image(signature).FitArea();
            else
                column.Item().PaddingTop(32).BorderBottom(0.8f).BorderColor(Navy).Height(22);
            if (!string.IsNullOrWhiteSpace(signer)) column.Item().PaddingTop(4).Text(signer).FontColor(Muted);
        });
    }

    private static Dictionary<string, string> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.EnumerateObject()
                .Where(x => x.Value.ValueKind == JsonValueKind.String)
                .ToDictionary(x => x.Name, x => x.Value.GetString() ?? "", StringComparer.OrdinalIgnoreCase);
        }
        catch { return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); }
    }

    private static string HtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var value = Regex.Replace(html, @"<\s*(br|/p|/div|/h[1-6]|/li)\s*/?>", "\n", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, @"<\s*li\b[^>]*>", "• ", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, "<[^>]+>", string.Empty);
        value = WebUtility.HtmlDecode(value).Replace("\r\n", "\n");
        return Regex.Replace(value, @"\n{3,}", "\n\n").Trim();
    }
}
