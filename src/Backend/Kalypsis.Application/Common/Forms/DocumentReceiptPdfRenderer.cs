using System.Text.Json;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>Receipt proving which customer-facing documents were delivered and received.</summary>
public static class DocumentReceiptPdfRenderer
{
    private const string Navy = "#0B2545";
    private const string Blue = "#1565C0";
    private const string Muted = "#52657A";
    private const string Rule = "#D9E0E8";

    public static byte[] Render(Tenant tenant, CustomerFormSigning signing, byte[]? logo, byte[]? customerSignature, byte[]? officeSignature, byte[]? insurerSignature)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var data = Parse(signing.FormDataJson);
        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(34);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(9).FontColor(Navy));
            Header(page.Header(), tenant, logo);
            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Item().AlignCenter().Text("ΑΠΟΔΕΙΞΗ ΠΑΡΑΛΑΒΗΣ ΕΝΤΥΠΩΝ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ").FontSize(14).Bold();
                col.Item().AlignCenter().PaddingTop(3).Text("Ημερομηνίες επικοινωνίας, παράδοσης και παραλαβής εγγράφων").FontSize(8).FontColor(Muted);

                col.Item().PaddingTop(12).Element(x => Section(x, "Στοιχεία πελάτη και γραφείου", new[]
                {
                    ("Πελάτης", signing.CustomerFullNameSnapshot),
                    ("Email πελάτη", signing.CustomerEmailSnapshot ?? "—"),
                    ("Αριθμός συμβολαίου", V(data, "policyNumber")),
                    ("Ασφαλιστική εταιρεία", V(data, "insuranceCompany")),
                    ("Γραφείο / διαμεσολαβητής", tenant.Name),
                    ("Email γραφείου", tenant.ContactEmail ?? "—")
                }));

                col.Item().PaddingTop(9).Element(x => Section(x, "Στοιχεία παράδοσης", new[]
                {
                    ("Ημερομηνία επικοινωνίας", V(data, "contactDate")),
                    ("Ημερομηνία παράδοσης / παραλαβής", V(data, "deliveryDate")),
                    ("Τρόπος παράδοσης", V(data, "deliveryMethod", "Ηλεκτρονικά μέσω ασφαλούς συνδέσμου")),
                    ("Παρατηρήσεις", V(data, "receiptNotes"))
                }));

                col.Item().PaddingTop(9).Text("Έγγραφα που παραδόθηκαν και παραλήφθηκαν").FontSize(10).Bold().FontColor(Blue);
                col.Item().PaddingTop(4).Border(1).BorderColor(Rule).Padding(8).Column(c =>
                {
                    var docs = V(data, "documentsReceived", "Δεν έχει οριστεί").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    foreach (var document in docs) c.Item().PaddingVertical(3).Text($"☑ {document}");
                });
                col.Item().PaddingTop(8).Text("Ο πελάτης βεβαιώνει ότι παρέλαβε τα παραπάνω έγγραφα και είχε τη δυνατότητα να τα διαβάσει, να ζητήσει διευκρινίσεις και να κρατήσει αντίγραφό τους. Η παρούσα απόδειξη δεν τροποποιεί τους όρους ασφαλιστηρίου ή τις νόμιμες υποχρεώσεις ενημέρωσης.").FontColor(Muted);

                col.Item().PaddingTop(16).Table(t =>
                {
                    t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
                    SignatureCell(t, "Υπογραφή πελάτη / παραλαβή", signing.CustomerFullNameSnapshot, customerSignature);
                    SignatureCell(t, "Υπογραφή διαμεσολαβητή / παράδοση", tenant.Name, officeSignature);
                    if (signing.RequireInsurerSignature) SignatureCell(t, "Υπογραφή ασφαλιστικής εταιρείας", signing.InsurerEmailSnapshot ?? "—", insurerSignature);
                    SignatureCell(t, "Αριθμός εντύπου / ημερομηνία", signing.Id.ToString("N")[..12].ToUpperInvariant() + " · " + signing.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm"), null);
                });
            });
            page.Footer().BorderTop(1).BorderColor(Rule).PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"{tenant.Name} · Kalypsis · Απόδειξη παραλαβής").FontSize(7).FontColor(Muted);
                row.ConstantItem(70).AlignRight().Text(t => { t.DefaultTextStyle(s => s.FontSize(7).FontColor(Muted)); t.Span("Σελίδα "); t.CurrentPageNumber(); t.Span("/"); t.TotalPages(); });
            });
        })).GeneratePdf();
    }

    private static void Header(IContainer container, Tenant tenant, byte[]? logo)
    {
        container.Column(c =>
        {
            c.Item().Row(row =>
            {
                if (logo is { Length: > 0 }) row.ConstantItem(95).Height(45).Image(logo).FitArea();
                row.RelativeItem().PaddingLeft(logo is { Length: > 0 } ? 10 : 0).Column(info =>
                {
                    info.Item().Text(tenant.Name).FontSize(15).Bold().FontColor(Navy);
                    if (!string.IsNullOrWhiteSpace(tenant.AddressLine)) info.Item().Text(tenant.AddressLine!).FontColor(Muted);
                    info.Item().Text($"{tenant.ContactEmail ?? "—"} · {tenant.ContactPhone ?? "—"}").FontColor(Muted);
                });
            });
            c.Item().PaddingTop(7).LineHorizontal(1).LineColor(Navy);
        });
    }

    private static void Section(IContainer container, string title, IEnumerable<(string Label, string Value)> rows)
    {
        container.Border(1).BorderColor(Rule).Padding(8).Column(c =>
        {
            c.Item().Text(title).Bold().FontColor(Blue);
            foreach (var row in rows) c.Item().PaddingTop(4).Row(r =>
            {
                r.ConstantItem(178).Text(row.Label).FontSize(8).FontColor(Muted);
                r.RelativeItem().Text(row.Value);
            });
        });
    }

    private static void SignatureCell(TableDescriptor table, string label, string name, byte[]? signature)
    {
        table.Cell().Border(1).BorderColor(Rule).Padding(7).Column(c =>
        {
            c.Item().Text(label).Bold();
            if (signature is { Length: > 0 }) c.Item().PaddingTop(4).Height(48).Image(signature).FitArea();
            else c.Item().PaddingTop(22).BorderBottom(0.8f).BorderColor(Navy).Height(18);
            c.Item().Text(name).FontSize(8).FontColor(Muted);
        });
    }

    private static Dictionary<string, string> Parse(string? json)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            foreach (var p in doc.RootElement.EnumerateObject()) result[p.Name] = p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() ?? string.Empty : p.Value.ToString();
        }
        catch { }
        return result;
    }

    private static string V(IReadOnlyDictionary<string, string> data, string key, string fallback = "—")
        => data.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : fallback;
}
