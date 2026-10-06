using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>Renders the office's manually issued green card as a printable PDF.</summary>
public static class GreenCardPdfRenderer
{
    private const string Navy = "#0B2545";
    private const string Blue = "#1565C0";
    private const string Muted = "#52657A";
    private const string Rule = "#D9E0E8";

    public static byte[] Render(GreenCard card, Policy policy, Customer customer, Tenant tenant)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var customerName = CustomerName(customer);
        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(34);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(9).FontColor(Navy));

            page.Header().Column(header =>
            {
                header.Item().Row(row =>
                {
                    if (!string.IsNullOrWhiteSpace(tenant.LogoUrl))
                    {
                        // LogoUrl can be a remote URL; the application header remains
                        // useful without making PDF generation depend on network access.
                        row.RelativeItem().Text(tenant.Name).FontSize(15).Bold().FontColor(Navy);
                    }
                    else row.RelativeItem().Text(tenant.Name).FontSize(15).Bold().FontColor(Navy);
                    row.ConstantItem(150).AlignRight().Text("ΠΡΑΣΙΝΗ ΚΑΡΤΑ").FontSize(13).Bold().FontColor(Blue);
                });
                header.Item().PaddingTop(7).LineHorizontal(1).LineColor(Navy);
            });

            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Item().AlignCenter().Text("ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΔΙΕΘΝΟΥΣ ΑΣΦΑΛΙΣΗΣ ΑΥΤΟΚΙΝΗΤΟΥ").FontSize(14).Bold();
                col.Item().AlignCenter().PaddingTop(3).Text("Η παρούσα κάρτα ισχύει μόνο για το χρονικό διάστημα και τις χώρες που αναγράφονται.").FontSize(8).FontColor(Muted);

                col.Item().PaddingTop(12).Element(x => Section(x, "Στοιχεία κάρτας", new[]
                {
                    ("Αριθμός πράσινης κάρτας", card.CardNumber),
                    ("Έναρξη ισχύος", card.ValidFrom.ToString("dd/MM/yyyy")),
                    ("Λήξη ισχύος", card.ValidTo.ToString("dd/MM/yyyy")),
                    ("Κατάσταση", StatusLabel(card.Status)),
                    ("Χώρες ισχύος", Value(card.Territories)),
                }));

                col.Item().PaddingTop(9).Element(x => Section(x, "Ασφαλισμένος και όχημα", new[]
                {
                    ("Κάτοχος", Value(card.HolderName)),
                    ("Ασφαλισμένος", Value(card.InsuredName, customerName)),
                    ("Αριθμός κυκλοφορίας", Value(card.VehicleRegistrationPlate, policy.VehicleRegistrationPlate ?? "—")),
                    ("Μάρκα / μοντέλο", Value(card.VehicleMakeModel)),
                    ("Αριθμός πλαισίου (VIN)", Value(card.VehicleVin)),
                    ("Αριθμός συμβολαίου", policy.PolicyNumber),
                    ("Ασφαλιστική εταιρεία", policy.InsuranceCompany?.Name ?? "—"),
                }));

                col.Item().PaddingTop(9).Element(x => Section(x, "Έκδοση και παράδοση", new[]
                {
                    ("Γραφείο έκδοσης", Value(card.IssuingOffice, tenant.Name)),
                    ("Ημερομηνία έκδοσης", card.IssuedAt?.ToLocalTime().ToString("dd/MM/yyyy HH:mm") ?? "Δεν έχει εκδοθεί"),
                    ("Τρόπος παράδοσης", Value(card.DeliveryMethod)),
                    ("Ημερομηνία παράδοσης", card.DeliveredAt?.ToLocalTime().ToString("dd/MM/yyyy HH:mm") ?? "Δεν έχει παραδοθεί"),
                    ("Παρατηρήσεις", Value(card.Notes)),
                }));

                col.Item().PaddingTop(18).Row(row =>
                {
                    row.RelativeItem().BorderTop(1).BorderColor(Navy).PaddingTop(4).Text("Υπογραφή γραφείου").FontSize(8).FontColor(Muted);
                    row.ConstantItem(22);
                    row.RelativeItem().BorderTop(1).BorderColor(Navy).PaddingTop(4).Text("Υπογραφή ασφαλισμένου").FontSize(8).FontColor(Muted);
                });
            });

            page.Footer().BorderTop(1).BorderColor(Rule).PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text($"{tenant.Name} · Πράσινη κάρτα · Kalypsis").FontSize(7).FontColor(Muted);
                row.ConstantItem(70).AlignRight().Text(t => { t.DefaultTextStyle(s => s.FontSize(7).FontColor(Muted)); t.Span("Σελίδα "); t.CurrentPageNumber(); t.Span("/"); t.TotalPages(); });
            });
        })).GeneratePdf();
    }

    private static void Section(IContainer container, string title, IEnumerable<(string Label, string Value)> rows)
    {
        container.Border(1).BorderColor(Rule).Padding(8).Column(c =>
        {
            c.Item().Text(title).Bold().FontColor(Blue);
            foreach (var row in rows)
                c.Item().PaddingTop(4).Row(r =>
                {
                    r.ConstantItem(175).Text(row.Label).FontSize(8).FontColor(Muted);
                    r.RelativeItem().Text(row.Value);
                });
        });
    }

    private static string Value(string? value, string fallback = "—")
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string CustomerName(Customer c)
        => c.Type == Kalypsis.Domain.Enums.CustomerType.Individual
            ? $"{c.FirstName} {c.LastName}".Trim()
            : Value(c.CompanyName);

    private static string StatusLabel(Kalypsis.Domain.Enums.GreenCardStatus status) => status switch
    {
        Kalypsis.Domain.Enums.GreenCardStatus.Draft => "Πρόχειρη",
        Kalypsis.Domain.Enums.GreenCardStatus.Issued => "Εκδόθηκε",
        Kalypsis.Domain.Enums.GreenCardStatus.Delivered => "Παραδόθηκε",
        Kalypsis.Domain.Enums.GreenCardStatus.Expired => "Έληξε",
        Kalypsis.Domain.Enums.GreenCardStatus.Cancelled => "Ακυρώθηκε",
        _ => status.ToString()
    };
}
