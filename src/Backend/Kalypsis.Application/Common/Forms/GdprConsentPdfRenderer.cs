using System.Globalization;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>
/// Server-side renderer for the Cover-style GDPR customer acknowledgement.
/// The two-column consent choice and signature blocks deliberately mirror the
/// supplied reference form; all identity values are mail-merged from the
/// customer snapshot rather than typed by the signer.
/// </summary>
public static class GdprConsentPdfRenderer
{
    private const string Navy = "#0B2545";
    private const string Blue = "#1565C0";
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
        var customer = signing.CustomerFullNameSnapshot;
        var consentText = signing.CustomerConsented == true
            ? "Έχω ενημερωθεί για την ως άνω επεξεργασία προσωπικών μου δεδομένων και συναινώ σε αυτήν, όπως ειδικά αυτή ορίζεται στο παρόν έγγραφο."
            : signing.CustomerConsented == false
                ? "Έχω ενημερωθεί για την ως άνω επεξεργασία προσωπικών μου δεδομένων και ΔΕΝ συναινώ σε αυτήν, όπως ειδικά αυτή ορίζεται στο παρόν έγγραφο."
                : "Η επιλογή συγκατάθεσης θα συμπληρωθεί ηλεκτρονικά από τον πελάτη.";

        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(9).FontColor(Navy));
            page.Header().Column(header =>
            {
                header.Item().Row(row =>
                {
                    if (logo is { Length: > 0 })
                        row.ConstantItem(100).Height(48).Image(logo).FitArea();
                    row.RelativeItem().PaddingLeft(logo is { Length: > 0 } ? 12 : 0).Column(c =>
                    {
                        c.Item().Text(tenant.Name).FontSize(16).Bold().FontColor(Navy);
                        if (!string.IsNullOrWhiteSpace(tenant.AddressLine)) c.Item().Text(tenant.AddressLine!).FontColor(Muted);
                        if (!string.IsNullOrWhiteSpace(tenant.ContactEmail)) c.Item().Text(tenant.ContactEmail!).FontColor(Muted);
                        if (!string.IsNullOrWhiteSpace(tenant.VatNumber)) c.Item().Text($"ΑΦΜ: {tenant.VatNumber}").FontColor(Muted);
                    });
                });
                header.Item().PaddingTop(8).LineHorizontal(1).LineColor(Navy);
            });

            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Item().AlignCenter().Text("ΕΝΗΜΕΡΩΣΗ ΥΠΟΚΕΙΜΕΝΟΥ ΔΕΔΟΜΕΝΩΝ & ΔΗΛΩΣΗ GDPR").FontSize(13).Bold();
                col.Item().AlignCenter().PaddingTop(2).Text("Άρθρα 13 και 14 Γενικού Κανονισμού Προστασίας Δεδομένων (ΕΕ) 2016/679").FontSize(8).FontColor(Muted);

                col.Item().PaddingTop(12).Background("#F5F8FC").Border(1).BorderColor(Rule).Padding(10).Column(c =>
                {
                    c.Item().Text("Υπεύθυνος επεξεργασίας").Bold().FontColor(Blue);
                    c.Item().Text(tenant.Name).Bold();
                    if (!string.IsNullOrWhiteSpace(tenant.AddressLine)) c.Item().Text(tenant.AddressLine!);
                    c.Item().Text("Τα δεδομένα χρησιμοποιούνται για την αξιολόγηση, έκδοση, διαχείριση και εξυπηρέτηση ασφαλιστικών συμβάσεων, την επικοινωνία με τις ασφαλιστικές εταιρείες και την τήρηση των νόμιμων υποχρεώσεων.");
                    c.Item().Text("Τα δεδομένα διατηρούνται για όσο απαιτείται από τη σύμβαση και τη νομοθεσία. Το υποκείμενο μπορεί να ασκήσει δικαιώματα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού, φορητότητας και εναντίωσης μέσω των στοιχείων επικοινωνίας του γραφείου.");
                });

                col.Item().PaddingTop(10).Text("Στοιχεία πελάτη").FontSize(10).Bold().FontColor(Blue);
                col.Item().PaddingTop(3).Table(t =>
                {
                    t.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); });
                    Cell(t, "Ονοματεπώνυμο / Επωνυμία", customer);
                    Cell(t, "Email", signing.CustomerEmailSnapshot ?? "—");
                    Cell(t, "Αριθμός εντύπου", signing.Id.ToString("N")[..12].ToUpperInvariant());
                    Cell(t, "Έκδοση", signing.FormVersion);
                });

                col.Item().PaddingTop(12).Text("Δήλωση επιλογής").FontSize(10).Bold().FontColor(Blue);
                col.Item().PaddingTop(4).Border(1).BorderColor(Rule).Padding(8).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("ΣΥΝΑΙΝΩ").Bold().FontColor(Blue);
                        c.Item().Text("Έχω ενημερωθεί για την ως άνω επεξεργασία προσωπικών μου δεδομένων και συναινώ σε αυτήν, όπως ειδικά αυτή ορίζεται στο παρόν έγγραφο.");
                        c.Item().PaddingTop(8).Text("Ονοματεπώνυμο: "+customer);
                        Signature(c, signing.CustomerConsented == true ? customerSignature : null);
                    });
                    row.ConstantItem(1).Background(Rule);
                    row.RelativeItem().PaddingLeft(10).Column(c =>
                    {
                        c.Item().Text("ΔΕΝ ΣΥΝΑΙΝΩ").Bold().FontColor(Blue);
                        c.Item().Text("Έχω ενημερωθεί για την ως άνω επεξεργασία προσωπικών μου δεδομένων και ΔΕΝ συναινώ σε αυτήν, όπως ειδικά αυτή ορίζεται στο παρόν έγγραφο.");
                        c.Item().PaddingTop(8).Text("Ονοματεπώνυμο: "+customer);
                        Signature(c, signing.CustomerConsented == false ? customerSignature : null);
                    });
                });
                col.Item().PaddingTop(5).Text(consentText).Italic().FontColor(Muted);

                col.Item().PaddingTop(14).Text("Υπογραφή γραφείου / ασφαλιστικής (όπου απαιτείται από τις ρυθμίσεις του γραφείου)").FontSize(10).Bold().FontColor(Blue);
                col.Item().PaddingTop(4).Table(t =>
                {
                    t.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); });
                    t.Cell().Border(1).BorderColor(Rule).Padding(8).Column(c => { c.Item().Text("Υπογραφή γραφείου").Bold(); Signature(c, officeSignature); c.Item().Text(tenant.Name).FontColor(Muted); });
                    t.Cell().Border(1).BorderColor(Rule).Padding(8).Column(c => { c.Item().Text("Υπογραφή ασφαλιστικής εταιρείας").Bold(); Signature(c, insurerSignature); c.Item().Text(signing.InsurerEmailSnapshot ?? "—").FontColor(Muted); });
                });
                col.Item().PaddingTop(12).Text($"Ημερομηνία δημιουργίας: {signing.CreatedAt.ToLocalTime():dd/MM/yyyy HH:mm} · Κατάσταση: {StatusLabel(signing.Status)}").FontSize(8).FontColor(Muted);
                col.Item().PaddingTop(8).Text("Πληροφορίες προστασίας δεδομένων και σύνδεσμοι πολιτικών της συνεργαζόμενης ασφαλιστικής εταιρείας παρέχονται από το γραφείο και αποτελούν μέρος της ενημέρωσης του πελάτη.").FontSize(8).FontColor(Muted);
            });

            page.Footer().BorderTop(1).BorderColor(Rule).PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"{tenant.Name} · Kalypsis · {DateTime.UtcNow.Year}").FontSize(8).FontColor(Muted);
                row.ConstantItem(90).AlignRight().Text(t => { t.DefaultTextStyle(s => s.FontSize(8).FontColor(Muted)); t.Span("Σελίδα "); t.CurrentPageNumber(); t.Span("/"); t.TotalPages(); });
            });
        })).GeneratePdf();
    }

    private static void Cell(TableDescriptor table, string label, string value)
    {
        table.Cell().BorderBottom(0.5f).BorderColor(Rule).Padding(5).Column(c => { c.Item().Text(label).FontSize(7).FontColor(Muted); c.Item().Text(value); });
    }

    private static void Signature(ColumnDescriptor column, byte[]? signature)
    {
        if (signature is { Length: > 0 }) column.Item().PaddingTop(5).Height(55).Image(signature).FitArea();
        else column.Item().PaddingTop(25).BorderBottom(0.8f).BorderColor(Navy).Height(22);
    }

    private static string StatusLabel(CustomerFormSigningStatus status) => status switch
    {
        CustomerFormSigningStatus.Completed => "Ολοκληρωμένο",
        CustomerFormSigningStatus.PendingCustomer => "Αναμονή πελάτη",
        CustomerFormSigningStatus.PendingOffice => "Αναμονή γραφείου",
        CustomerFormSigningStatus.PendingInsurer => "Αναμονή ασφαλιστικής",
        CustomerFormSigningStatus.Declined => "Δεν συναινεί",
        _ => status.ToString()
    };
}
