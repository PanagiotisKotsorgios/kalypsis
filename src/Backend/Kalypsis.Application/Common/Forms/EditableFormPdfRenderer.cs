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
        var header = data.GetValueOrDefault("__templateHeaderHtml");
        var body = data.GetValueOrDefault("__templateBodyHtml");
        var footer = data.GetValueOrDefault("__templateFooterHtml");

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
                    RenderHtml(column, header, 9, Muted);
                if (!string.IsNullOrWhiteSpace(body))
                    RenderHtml(column, body, 9, Navy, 10);

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
                    RenderHtml(column, footer, 8, Muted, 14);
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

    private sealed record RichRun(string Text, bool Bold, bool Italic, bool Underline, float FontSize, string Color);

    /// <summary>
    /// Converts the small, safe HTML subset produced by the office WYSIWYG
    /// editor into QuestPDF text spans. It deliberately keeps paragraphs,
    /// headings, lists, links, bold/italic/underline and every text node so
    /// the PDF matches what the office edited instead of flattening it to one
    /// plain-text paragraph.
    /// </summary>
    private static void RenderHtml(ColumnDescriptor column, string html, float baseFontSize, string color, float paddingTop = 0)
    {
        var runs = new List<RichRun>();
        var inlineTags = new Stack<string>();
        var lists = new Stack<(bool Ordered, int Index)>();
        var blockFontSize = baseFontSize;
        var blockBold = false;
        var firstBlock = true;

        void FlushBlock()
        {
            while (runs.Count > 0 && string.IsNullOrWhiteSpace(runs[0].Text)) runs.RemoveAt(0);
            while (runs.Count > 0 && string.IsNullOrWhiteSpace(runs[^1].Text)) runs.RemoveAt(runs.Count - 1);
            if (runs.Count == 0) return;
            var blockRuns = runs.ToArray();
            var top = firstBlock ? paddingTop : 4;
            column.Item().PaddingTop(top).Text(text =>
            {
                text.DefaultTextStyle(style => style.LineHeight(1.35f));
                foreach (var run in blockRuns)
                {
                    var span = text.Span(run.Text).FontSize(run.FontSize).FontColor(run.Color);
                    if (run.Bold) span.Bold();
                    if (run.Italic) span.Italic();
                    if (run.Underline) span.Underline();
                }
            });
            firstBlock = false;
            runs.Clear();
            blockFontSize = baseFontSize;
            blockBold = false;
        }

        bool Has(string tag) => tag switch
        {
            "bold" => inlineTags.Any(x => x == "bold"),
            "italic" => inlineTags.Any(x => x == "italic"),
            "underline" => inlineTags.Any(x => x == "underline"),
            _ => false
        };

        void AddText(string text)
        {
            var decoded = WebUtility.HtmlDecode(text).Replace('\u00A0', ' ');
            decoded = Regex.Replace(decoded, @"\s+", " ");
            if (string.IsNullOrWhiteSpace(decoded)) return;
            var bullet = lists.Count > 0 && runs.Count == 0;
            if (bullet)
            {
                var list = lists.Pop();
                var marker = list.Ordered ? $"{list.Index}. " : "• ";
                lists.Push((list.Ordered, list.Index + 1));
                runs.Add(new RichRun(marker, true, false, false, blockFontSize, color));
            }
            runs.Add(new RichRun(decoded, blockBold || Has("bold"), Has("italic"), Has("underline"), blockFontSize, color));
        }

        var tokens = Regex.Split(Regex.Replace(html, @"<!--[\s\S]*?-->", string.Empty), @"(<[^>]+>)", RegexOptions.IgnoreCase);
        foreach (var token in tokens)
        {
            if (string.IsNullOrEmpty(token)) continue;
            if (!token.StartsWith('<')) { AddText(token); continue; }
            var tagMatch = Regex.Match(token, @"^<\s*(/?)\s*([a-z0-9]+)([^>]*)>", RegexOptions.IgnoreCase);
            if (!tagMatch.Success) continue;
            var closing = tagMatch.Groups[1].Value.Length > 0;
            var tag = tagMatch.Groups[2].Value.ToLowerInvariant();
            var attrs = tagMatch.Groups[3].Value;

            if (closing)
            {
                if (tag is "p" or "div" or "section" or "article" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "li" or "blockquote" or "br") FlushBlock();
                if (tag is "ul" or "ol") { if (lists.Count > 0) lists.Pop(); FlushBlock(); }
                if (tag is "b" or "strong" or "i" or "em" or "u" or "a" or "span" or "bold" or "italic" or "underline")
                {
                    if (inlineTags.Count > 0) inlineTags.Pop();
                }
                continue;
            }

            if (tag is "p" or "div" or "section" or "article" or "h1" or "h2" or "h3" or "h4" or "h5" or "h6" or "li" or "blockquote")
            {
                if (runs.Count > 0) FlushBlock();
                blockFontSize = tag switch { "h1" => baseFontSize + 7, "h2" => baseFontSize + 4, "h3" => baseFontSize + 2, "h4" or "h5" or "h6" => baseFontSize + 1, _ => baseFontSize };
                blockBold = tag is "h1" or "h2" or "h3" or "h4" or "h5" or "h6";
                if (tag == "li" && lists.Count > 0) { /* marker is added with the first text node */ }
                continue;
            }
            if (tag == "br") { FlushBlock(); continue; }
            if (tag is "ul" or "ol") { if (runs.Count > 0) FlushBlock(); lists.Push((tag == "ol", 1)); continue; }
            if (tag is "b" or "strong" or "bold") { inlineTags.Push("bold"); continue; }
            if (tag is "i" or "em" or "italic") { inlineTags.Push("italic"); continue; }
            if (tag is "u" or "underline") { inlineTags.Push("underline"); continue; }
            if (tag is "a") { inlineTags.Push("underline"); continue; }
            if (tag == "span")
            {
                var style = Regex.Match(attrs, @"style\s*=\s*[""']([^""']*)[""']", RegexOptions.IgnoreCase).Groups[1].Value.ToLowerInvariant();
                inlineTags.Push(style.Contains("font-weight") && style.Contains("bold") ? "bold" : style.Contains("font-style") && style.Contains("italic") ? "italic" : style.Contains("text-decoration") && style.Contains("underline") ? "underline" : "span");
            }
        }
        FlushBlock();
    }
}
