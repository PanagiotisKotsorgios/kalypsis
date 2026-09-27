using System.Text.Json;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>
/// Mail-merged Article 28/29 information notice for an insurance intermediary.
/// The fields follow the mandatory information list in Greek Law 4583/2018
/// (Articles 28, 29 and 33). Office-specific fields are supplied in the
/// immutable signing snapshot so the signed PDF cannot change later.
/// </summary>
public static class IntermediaryInformationPdfRenderer
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
            page.Margin(32);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(9).FontColor(Navy));
            Header(page.Header(), tenant, logo);
            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Item().AlignCenter().Text("ΕΝΤΥΠΟ ΠΑΡΟΧΗΣ ΠΛΗΡΟΦΟΡΙΩΝ ΑΣΦΑΛΙΣΤΙΚΟΥ ΔΙΑΜΕΣΟΛΑΒΗΤΗ").FontSize(13).Bold();
                col.Item().AlignCenter().PaddingTop(3).Text("Άρθρα 28, 29 και 33 του ν. 4583/2018").FontSize(8).FontColor(Muted);

                col.Item().PaddingTop(12).Element(x => Section(x, "1. Ταυτότητα και επαγγελματική ιδιότητα", new[]
                {
                    ("Επωνυμία / διακριτικός τίτλος", tenant.Name),
                    ("Διεύθυνση", tenant.AddressLine ?? "—"),
                    ("Email / τηλέφωνο", $"{tenant.ContactEmail ?? "—"} / {tenant.ContactPhone ?? "—"}"),
                    ("ΑΦΜ", tenant.VatNumber ?? "—"),
                    ("Επαγγελματική ιδιότητα / κατηγορία", V(data, "intermediaryCategory", "Δεν έχει οριστεί από το γραφείο")),
                    ("Αριθμός ειδικού μητρώου", V(data, "registryNumber", tenant.TteRegistrationNumber ?? "—")),
                    ("Έτος εγγραφής", V(data, "registryYear", tenant.TteRegistrationYear?.ToString() ?? "—")),
                    ("Ενιαίο Σημείο Πληροφόρησης", V(data, "singleInformationPointUrl", "https://insuranceregistry.uhc.gr/")),
                    ("Νομικός τρόπος δραστηριότητας", V(data, "legalActivity", "Δεν έχει οριστεί από το γραφείο"))
                }));

                col.Item().PaddingTop(8).Element(x => Section(x, "2. Ρόλος, συμβουλή και ασφαλιστικές επιχειρήσεις", new[]
                {
                    ("Ενεργεί για λογαριασμό", V(data, "represents", "Δεν έχει οριστεί από το γραφείο")),
                    ("Παρέχει συμβουλή", V(data, "providesAdvice", "Δεν έχει οριστεί από το γραφείο")),
                    ("Ασφαλιστικές εταιρείες με τις οποίες συνεργάζεται", V(data, "collaboratingInsurers", "Δεν έχει οριστεί από το γραφείο")),
                    ("Επενδυτικά προϊόντα βασιζόμενα σε ασφάλιση", V(data, "investmentBasedInsurance", "Δεν έχει οριστεί από το γραφείο")),
                    ("Εντολή είσπραξης ασφαλίστρων", V(data, "premiumCollectionMandate", "Δεν έχει οριστεί από το γραφείο"))
                }));

                col.Item().PaddingTop(8).Element(x => Section(x, "3. Αμοιβή, καταγγελίες και εξωδικαστική επίλυση", new[]
                {
                    ("Φύση αμοιβής", V(data, "remunerationNature", "Δεν έχει οριστεί από το γραφείο")),
                    ("Τρόπος αμοιβής", V(data, "remunerationMethod", "Δεν έχει οριστεί από το γραφείο")),
                    ("Συμμετοχές άνω του 10% σε ασφαλιστικές επιχειρήσεις", V(data, "ownershipDisclosure", "Δεν έχει οριστεί από το γραφείο")),
                    ("Διαδικασία αιτιάσεων / καταγγελιών", V(data, "complaintsProcedure", "Δεν έχει οριστεί από το γραφείο")),
                    ("Εξωδικαστική επίλυση διαφορών", V(data, "outOfCourtDisputes", "Δεν έχει οριστεί από το γραφείο"))
                }));

                col.Item().PaddingTop(8).Element(x => Section(x, "4. Στοιχεία πελάτη και προτεινόμενη σύμβαση", new[]
                {
                    ("Πελάτης", signing.CustomerFullNameSnapshot),
                    ("Email πελάτη", signing.CustomerEmailSnapshot ?? "—"),
                    ("Αριθμός συμβολαίου", V(data, "policyNumber", "—")),
                    ("Ασφαλιστική εταιρεία", V(data, "insuranceCompany", "—"))
                }));

                col.Item().PaddingTop(9).Text("Δήλωση παραλαβής ενημέρωσης").FontSize(10).Bold().FontColor(Blue);
                col.Item().PaddingTop(3).Text("Ο πελάτης δηλώνει ότι έλαβε τις παραπάνω πληροφορίες εγκαίρως, σε σαφή και κατανοητή μορφή, πριν από τη σύναψη της ασφαλιστικής σύμβασης. Οι πληροφορίες παρέχονται σύμφωνα με τον ν. 4583/2018 και δεν αποτελούν εξατομικευμένη νομική συμβουλή.").FontColor(Muted);
                Signatures(col, tenant, signing, customerSignature, officeSignature, insurerSignature);
            });
            page.Footer().BorderTop(1).BorderColor(Rule).PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"{tenant.Name} · Kalypsis · Πηγή: ν. 4583/2018 (Τράπεζα της Ελλάδος)").FontSize(7).FontColor(Muted);
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
            foreach (var row in rows)
                c.Item().PaddingTop(4).Row(r =>
                {
                    r.ConstantItem(178).Text(row.Label).FontSize(8).FontColor(Muted);
                    r.RelativeItem().Text(row.Value);
                });
        });
    }

    private static void Signatures(ColumnDescriptor col, Tenant tenant, CustomerFormSigning signing, byte[]? customerSignature, byte[]? officeSignature, byte[]? insurerSignature)
    {
        col.Item().PaddingTop(14).Table(t =>
        {
            t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
            SignatureCell(t, "Υπογραφή πελάτη", signing.CustomerFullNameSnapshot, customerSignature);
            SignatureCell(t, "Υπογραφή διαμεσολαβητή", tenant.Name, officeSignature);
            if (signing.RequireInsurerSignature) SignatureCell(t, "Υπογραφή ασφαλιστικής εταιρείας", signing.InsurerEmailSnapshot ?? "—", insurerSignature);
            SignatureCell(t, "Ημερομηνία", signing.CreatedAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm"), null);
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
