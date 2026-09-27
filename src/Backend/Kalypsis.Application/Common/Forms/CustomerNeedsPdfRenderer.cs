using System.Text.Json;
using Kalypsis.Domain.Entities;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Kalypsis.Application.Common.Forms;

/// <summary>
/// Renders the five-page «Έντυπο Αναγκών Πελάτη» supplied by the customer
/// (NIVIS form).  The layout follows the reference: agency branding/header,
/// customer contact table, cover-interest checklist, vessel/property details,
/// risk questions and the final declaration/signature page.  Values are read
/// from the immutable FormDataJson snapshot created when the form is sent.
/// </summary>
public static class CustomerNeedsPdfRenderer
{
    private const string Ink = "#171717";
    private const string Grey = "#E7E7E7";
    private const string Rule = "#737373";
    private const string Accent = "#7D1E25";

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

        return Document.Create(doc =>
        {
            AddPage(doc, tenant, logo, footer: true, page => PageOne(page, tenant, signing, data));
            AddPage(doc, tenant, logo, footer: true, page => PageTwo(page, data));
            AddPage(doc, tenant, logo, footer: true, page => PageThree(page, data));
            AddPage(doc, tenant, logo, footer: true, page => PageFour(page, data));
            AddPage(doc, tenant, logo, footer: true, page => PageFive(page, tenant, signing, data, customerSignature, officeSignature, insurerSignature));
        }).GeneratePdf();
    }

    private static void AddPage(
        IDocumentContainer document,
        Tenant tenant,
        byte[]? logo,
        bool footer,
        Action<IContainer> content)
    {
        document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.MarginHorizontal(42);
            page.MarginVertical(38);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(8.5f).FontColor(Ink));
            page.Header().Element(header => Header(header, tenant, logo));
            page.Content().Element(content);
            if (footer)
            {
                page.Footer().PaddingTop(5).BorderTop(1).BorderColor(Accent).Column(c =>
                {
                    c.Item().AlignCenter().Text(t =>
                    {
                        t.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(7).FontColor("#888888"));
                        t.Span($"{tenant.Name} · {tenant.AddressLine ?? string.Empty} · {tenant.ContactPhone ?? string.Empty} · {tenant.ContactEmail ?? string.Empty}");
                    });
                    c.Item().AlignCenter().Text(t => { t.DefaultTextStyle(s => s.FontSize(7).FontColor("#888888")); t.Span("Σελίδα "); t.CurrentPageNumber(); });
                });
            }
        });
    }

    private static void Header(IContainer container, Tenant tenant, byte[]? logo)
    {
        container.Column(c =>
        {
            c.Item().Row(row =>
            {
                if (logo is { Length: > 0 }) row.ConstantItem(145).Height(52).Image(logo).FitArea();
                row.RelativeItem().AlignRight().Column(info =>
                {
                    info.Item().Text(tenant.Name).Bold().FontSize(10);
                    if (!string.IsNullOrWhiteSpace(tenant.AddressLine)) info.Item().Text(tenant.AddressLine!).FontSize(7).FontColor("#666666");
                    if (!string.IsNullOrWhiteSpace(tenant.ContactEmail)) info.Item().Text(tenant.ContactEmail!).FontSize(7).FontColor("#666666");
                    if (!string.IsNullOrWhiteSpace(tenant.VatNumber)) info.Item().Text($"ΑΦΜ: {tenant.VatNumber}").FontSize(7).FontColor("#666666");
                });
            });
            c.Item().PaddingTop(5).LineHorizontal(1).LineColor(Accent);
        });
    }

    private static void PageOne(IContainer page, Tenant tenant, CustomerFormSigning signing, JsonElement data)
    {
        page.Column(c =>
        {
            c.Item().PaddingTop(8).AlignCenter().Text("ΕΝΤΥΠΟ ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ").Bold().FontSize(15);
            c.Item().AlignCenter().PaddingTop(3).Text("(Σύμφωνα με το άρθρο 11 ΠΔ 190/2006 & το άρθρο 5, παρ. 4 της Πράξης 31/2013 της ΤτΕ)").FontSize(8);
            c.Item().PaddingTop(20).Text("Κώδικας Δεοντολογίας").Bold().FontSize(10);
            c.Item().PaddingTop(5).Text("Βάσει της 30 & 31/30.9.2013 πράξεως της ΤτΕ και στα πλαίσια της λειτουργίας μας ως επαγγελματίες Μεσίτες Ασφαλίσεων, οφείλουμε να σας προτείνουμε ρεαλιστικές και σύγχρονες ασφαλιστικές λύσεις, οι οποίες θα ανταποκρίνονται στις πραγματικές σας ανάγκες. Το ερωτηματολόγιο αυτό έχει σκοπό να συγκεντρώσει τα στοιχεία που είναι απαραίτητα για την εξατομικευμένη πρότασή μας.").LineHeight(1.25f);
            c.Item().PaddingTop(14).Element(x => SectionTitle(x, "ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ – ΣΤΟΙΧΕΙΑ ΕΠΙΚΟΙΝΩΝΙΑΣ"));
            c.Item().Element(x => TwoColumnTable(x, new[]
            {
                ("Ονοματεπώνυμο", V(data, "customerName", signing.CustomerFullNameSnapshot), "Ημ. Γέννησης", V(data, "birthDate")),
                ("Α.Φ.Μ.", V(data, "vatNumber"), "Δ.Ο.Υ.", V(data, "taxOffice")),
                ("Επάγγελμα", V(data, "occupation"), "E-mail", V(data, "email", signing.CustomerEmailSnapshot)),
                ("Τηλέφωνα", V(data, "phone"), "Διεύθυνση", V(data, "address"))
            }));
            c.Item().PaddingTop(13).Border(1).BorderColor(Rule).Padding(7).Column(box =>
            {
                box.Item().Text("Παρακαλούμε όπως επιλέξετε παρακάτω τις περιπτώσεις εύρεσης ασφαλιστικής κάλυψης από εμάς:").Bold();
                foreach (var item in new[]
                {
                    ("Ασφάλιση οχήματος", "coverageVehicle"),
                    ("Ασφάλιση σκάφους", "coverageVessel"),
                    ("Ασφάλιση κατοικίας / εξοχικού", "coverageHome"),
                    ("Ασφάλιση επιχείρησης", "coverageBusiness"),
                    ("Ασφάλιση Επαγγελματικής Αστικής Ευθύνης", "coverageProfessional"),
                    ("Άλλο", "coverageOtherText")
                }) box.Item().PaddingTop(5).Text($"{Mark(data, item.Item2)} {item.Item1} {V(data, item.Item2 + "Text")}");
            });
        });
    }

    private static void PageTwo(IContainer page, JsonElement data)
    {
        page.Column(c =>
        {
            c.Item().PaddingTop(10).AlignCenter().Element(x => SectionTitle(x, "ΣΤΟΙΧΕΙΑ ΓΙΑ ΤΗΝ ΑΣΦΑΛΙΣΗ ΠΕΡΙΟΥΣΙΑΣ (ΣΚΑΦΟΣ / VESSEL)"));
            c.Item().PaddingTop(8).Element(x => TwoColumnTable(x, new[]
            {
                ("ΟΝΟΜΑ / NAME", V(data, "vesselName"), "ΝΗΟΛΟΓΙΟ / REG. No", V(data, "registrationNumber")),
                ("ΣΗΜΑΙΑ / FLAG", V(data, "flag"), "Hull No", V(data, "hullNumber")),
                ("ΤΥΠΟΣ / TYPE", V(data, "vesselType"), "ΚΑΤΑΣΚΕΥΑΣΤΗΣ / MAKER", V(data, "maker")),
                ("ΥΛΙΚΟ ΚΑΤΑΣΚΕΥΗΣ / HULL MATERIAL", V(data, "hullMaterial"), "ΕΤΟΣ / YEAR BUILD", V(data, "yearBuilt")),
                ("ΜΕΓΙΣΤΗ ΤΑΧΥΤΗΤΑ / MAX. SPEED", V(data, "maxSpeed"), "ΗΜ/ΝΙΑ ΑΓΟΡΑΣ / PURCHASE DATE", V(data, "purchaseDate")),
                ("ΤΙΜΗ ΑΓΟΡΑΣ / PURCHASE PRICE", V(data, "purchasePrice"), "ΜΗΚΟΣ / LENGTH", V(data, "length")),
                ("ΠΛΑΤΟΣ / BEAM", V(data, "beam"), "ΒΥΘΙΣΜΑ / DRAFT", V(data, "draft")),
                ("ΧΡΗΣΗ / USE", V(data, "use"), "ΠΛΗΡΩΜΑ / CREW DETAILS", V(data, "crewDetails"))
            }));
            c.Item().PaddingTop(16).Element(x => SectionTitle(x, "ΚΥΡΙΑ(ΕΣ) ΜΗΧΑΝΗ(ΕΣ) / MAIN ENGINE(S)"));
            c.Item().PaddingTop(5).Element(x => EngineTable(x, data));
            c.Item().PaddingTop(15).Background(Grey).Border(1).BorderColor(Rule).Padding(6).AlignCenter().Text("Κάλυψη Αστικής Ευθύνης ως Ν.4256/14, έως € 800.000\nThird Party Liability coverage as per Greek Law 4256/14 up to € 800.000").Bold();
            c.Item().PaddingTop(7).Element(x => TwoColumnTable(x, new[] { ("Επιθυμείτε μεγαλύτερο όριο; / Do you wish to cover larger limit", V(data, "largerLiabilityLimit", "Έως € 1.000.000"), "", "") }));
        });
    }

    private static void PageThree(IContainer page, JsonElement data)
    {
        page.Column(c =>
        {
            c.Item().PaddingTop(10).Element(x => TwoColumnTable(x, new[]
            {
                ("ΠΕΡΙΟΔΟΣ ΕΚΤΟΣ ΝΕΡΟΥ / LAID UP PERIOD", V(data, "laidUpPeriod"), "ΠΟΥ ΘΑ ΕΙΝΑΙ ΤΟ ΣΚΑΦΟΣ; / WHERE WILL THE VESSEL BE LAID UP?", V(data, "laidUpLocation")),
                ("ΣΕ ΜΑΡΙΝΑ / IN A MARINA", V(data, "marina"), "ΠΡΟΣΔΕΣΕΙΣ / MOORINGS", V(data, "moorings")),
                ("ΠΕΡΙΟΡΙΟ ΠΛΕΥΣΗΣ / CRUISING LIMITS", V(data, "cruisingLimits"), "ΑΥΤΟΜΑΤΟ ΣΥΣΤΗΜΑ ΠΥΡΟΣΒΕΣΗΣ;", V(data, "automaticFireExtinguishing"))
            }));
            c.Item().PaddingTop(16).Text("ΑΣΦΑΛΙΖΟΜΕΝΕΣ ΑΞΙΕΣ / INSURED VALUES").Bold().FontSize(10);
            c.Item().PaddingTop(5).Element(x => TwoColumnTable(x, new[]
            {
                ("ΚΥΤΟΣ / HULL", V(data, "insuredHull"), "ΜΗΧΑΝΗ(ΕΣ) / MACHINERY(IES)", V(data, "insuredMachinery")),
                ("ΙΣΤΙΑ, ΙΣΤΟΣ / RIGGING, MAST", V(data, "insuredRigging"), "ΕΞΩΛΕΜΒΙΑ / O.B. MOTOR", V(data, "insuredOutboard")),
                ("ΒΟΗΘΗΤΙΚΟ ΣΚΑΦΟΣ / DINGHY", V(data, "insuredDinghy"), "ΕΞΟΠΛΙΣΜΟΣ ΝΑΥΣΙΠΛΟΪΑΣ", V(data, "insuredNavigation")),
                ("ΣΩΣΤΙΚΗ ΛΕΜΒΟΣ / LIFE RAFT", V(data, "insuredLifeRaft"), "ΑΥΤΟΜΑΤΟΣ ΠΙΛΟΤΟΣ / AUTOPILOT", V(data, "insuredAutopilot")),
                ("ΑΛΛΟΣ ΕΞΟΠΛΙΣΜΟΣ / OTHER", V(data, "insuredOther"), "ΠΡΟΣΩΠΙΚΑ ΑΝΤΙΚΕΙΜΕΝΑ / PERSONAL ITEMS", V(data, "insuredPersonalItems")),
                ("ΣΥΝΟΛΟ ΑΣΦΑΛΙΖΟΜΕΝΗΣ ΑΞΙΑΣ / TOTAL", V(data, "totalInsuredValue"), "", "")
            }));
            c.Item().PaddingTop(16).Border(1).BorderColor(Rule).Padding(7).Column(box =>
            {
                box.Item().Text("Παρατηρήσεις / πρόσθετες πληροφορίες").Bold();
                box.Item().PaddingTop(6).Text(V(data, "additionalInformation"));
                box.Item().PaddingTop(20).LineHorizontal(0.5f).LineColor(Rule);
                box.Item().PaddingTop(4).Text(" ");
            });
        });
    }

    private static void PageFour(IContainer page, JsonElement data)
    {
        page.Column(c =>
        {
            c.Item().PaddingTop(12).Element(x => TwoColumnTable(x, new[]
            {
                ("WATER SKIERS / LIABILITY FROM WATER SKIERS", V(data, "waterSkiers"), "RACING RISKS", V(data, "racingRisks")),
                ("Αν ναι, αξίες αντικατάστασης / If yes, Replacement Values", V(data, "replacementValues"), "ΟΔΙΚΗ ΜΕΤΑΦΟΡΑ / ROAD TRANSIT", V(data, "roadTransit")),
                ("ΖΗΜΙΕΣ ΤΕΛΕΥΤΑΙΑΣ 5ΕΤΙΑΣ / CLAIMS OF LAST 5 YEARS", V(data, "claimsLastFiveYears"), "ΥΠΑΡΧΕΙ ΔΑΝΕΙΟ / DOES THE YACHT BARE A LOAN?", V(data, "loan")),
                ("Ποσό δανείου / Loan amount", V(data, "loanAmount"), "ΑΣΦΑΛΙΣΤΙΚΗ ΠΕΡΙΟΔΟΣ / INSURED PERIOD", $"{V(data, "insuredFrom")} έως {V(data, "insuredTo")}"),
                ("ΠΛΗΡΩΜΗ ΑΣΦΑΛΙΣΤΡΩΝ / PREMIUM PAYMENT", V(data, "premiumPayment", "Ετήσια / Yearly"), "", "")
            }));
            c.Item().PaddingTop(25).Text("ΔΗΛΩΣΗ / DECLARATION").Bold().FontSize(10);
            c.Item().PaddingTop(7).Text("Δηλώνω ότι οι παραπάνω απαντήσεις είναι αληθείς, ακριβείς και πλήρεις και ότι δεν έχω αποκρύψει καμία πληροφορία που θα μπορούσε να επηρεάσει την απόφαση των Ασφαλιστών σχετικά με την πρόταση ασφάλισης.").LineHeight(1.35f);
            c.Item().PaddingTop(7).Text("I hereby declare that the above particulars and answers are correct and complete in every aspect and that I have not withheld any information which might influence the decision of the Underwriters referring the proposal.").LineHeight(1.3f).FontSize(8);
            c.Item().PaddingTop(24).Text("Οποιαδήποτε μεταβολή στα στοιχεία του εντύπου πρέπει να γνωστοποιείται άμεσα στο γραφείο.").Italic().FontColor("#555555");
        });
    }

    private static void PageFive(IContainer page, Tenant tenant, CustomerFormSigning signing, JsonElement data, byte[]? customerSignature, byte[]? officeSignature, byte[]? insurerSignature)
    {
        page.Column(c =>
        {
            c.Item().PaddingTop(10).Text("ΔΗΛΩΣΗ ΕΝΗΜΕΡΩΣΗΣ ΚΑΙ ΣΥΝΑΙΝΕΣΗΣ").Bold().FontSize(12).AlignCenter();
            c.Item().PaddingTop(15).Text("Ως ασφαλιστικός σας διαμεσολαβητής, δηλώνω ότι η συλλογή των προσωπικών σας δεδομένων που περιλαμβάνονται στο παρόν έντυπο αναγκών σας και η ακόλουθη επεξεργασία αυτών θα λάβει χώρα από το γραφείο για την αξιολόγηση των αναγκών σας και την υποβολή ασφαλιστικής πρότασης. Έχετε τα δικαιώματα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού, φορητότητας και εναντίωσης σύμφωνα με την ισχύουσα νομοθεσία.").LineHeight(1.3f);
            c.Item().PaddingTop(8).Text("Η παρούσα πρόταση και δήλωση αποτελεί τη βάση και αναπόσπαστο τμήμα του ασφαλιστηρίου συμβολαίου, σε περίπτωση έκδοσης. Οι απαντήσεις και τα στοιχεία πρέπει να παραμένουν ακριβή και πλήρη.").LineHeight(1.3f);
            c.Item().PaddingTop(28).AlignCenter().Text($"{V(data, "city", "....................")}, {DateTime.UtcNow.ToLocalTime():dd/MM/yyyy}");
            c.Item().PaddingTop(32).Element(x => SignatureTable(x, tenant, signing, customerSignature, officeSignature, insurerSignature));
        });
    }

    private static void SignatureTable(IContainer container, Tenant tenant, CustomerFormSigning signing, byte[]? customerSignature, byte[]? officeSignature, byte[]? insurerSignature)
    {
        container.Table(t =>
        {
            t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });
            SignatureCell(t, "Ο Ασφαλιστικός Διαμεσολαβητής", tenant.Name, officeSignature);
            SignatureCell(t, "Ο Πελάτης", signing.CustomerFullNameSnapshot, customerSignature);
            if (signing.RequireInsurerSignature || insurerSignature is { Length: > 0 })
                SignatureCell(t, "Η Ασφαλιστική Εταιρεία", signing.InsurerEmailSnapshot ?? "", insurerSignature);
            SignatureCell(t, "Ονοματεπώνυμο & Υπογραφή", signing.CustomerFullNameSnapshot, customerSignature);
        });
    }

    private static void SignatureCell(TableDescriptor table, string title, string name, byte[]? signature)
    {
        table.Cell().Padding(10).Column(c =>
        {
            c.Item().AlignCenter().Text(title).Bold();
            if (signature is { Length: > 0 }) c.Item().PaddingTop(15).Height(58).Image(signature).FitArea();
            else c.Item().PaddingTop(25).Height(45).BorderBottom(0.8f).BorderColor(Ink);
            c.Item().PaddingTop(4).AlignCenter().Text(name).FontSize(8);
        });
    }

    private static void EngineTable(IContainer container, JsonElement data)
    {
        container.Table(t =>
        {
            t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn(); });
            foreach (var engine in new[] { ("inboard", "ΕΣΩΛΕΜΒΙΑ / INBOARD"), ("outboard", "ΕΞΩΛΕΜΒΙΑ / OUTBOARD"), ("inoutboard", "ΕΣΩ-ΕΞΩΛΕΜΒΙΑ / IN-OUTBOARD") })
            {
                t.Cell().ColumnSpan(1).Background(Grey).Border(0.5f).BorderColor(Rule).Padding(4).Text(engine.Item2).Bold().AlignCenter();
            }
            var rows = new[] { ("maker", "ΚΑΤΑΣΚΕΥΑΣΤΗΣ / MAKER"), ("serial", "SERIAL No"), ("hp", "ΙΠΠΟΙ / HP"), ("year", "ΕΤΟΣ / YEAR"), ("fuel", "ΚΑΥΣΙΜΑ / FUEL") };
            foreach (var row in rows)
            {
                foreach (var engine in new[] { "inboard", "outboard", "inoutboard" })
                    t.Cell().Border(0.5f).BorderColor(Rule).Padding(5).Column(c => { c.Item().Text(row.Item2).FontSize(7).FontColor("#555555"); c.Item().Text(V(data, $"engine_{engine}_{row.Item1}")); });
            }
        });
    }

    private static void TwoColumnTable(IContainer container, IReadOnlyList<(string A, string Av, string B, string Bv)> rows)
    {
        container.Table(t =>
        {
            t.ColumnsDefinition(c => { c.RelativeColumn(1.25f); c.RelativeColumn(1.6f); c.RelativeColumn(1.25f); c.RelativeColumn(1.6f); });
            foreach (var row in rows)
            {
                Cell(t, row.A, row.Av, row.A.Length > 0);
                Cell(t, row.B, row.Bv, row.B.Length > 0);
            }
        });
    }

    private static void Cell(TableDescriptor table, string label, string value, bool visible)
    {
        table.Cell().Background(visible ? Grey : "#FFFFFF").Border(0.5f).BorderColor(Rule).Padding(5).Text(label).FontSize(7.5f);
        table.Cell().Border(0.5f).BorderColor(Rule).Padding(5).Text(value);
    }

    private static void SectionTitle(IContainer container, string text)
        => container.Background(Grey).Border(1).BorderColor(Rule).Padding(6).AlignCenter().Text(text).Bold();

    private static JsonElement Parse(string? json)
    {
        try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone(); }
        catch { return JsonDocument.Parse("{}").RootElement.Clone(); }
    }

    private static string V(JsonElement data, string key, string fallback = "—")
        => data.ValueKind == JsonValueKind.Object && data.TryGetProperty(key, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.ToString() is { Length: > 0 } text ? text : fallback
            : fallback;

    private static string Mark(JsonElement data, string key)
        => V(data, key, "").Equals("true", StringComparison.OrdinalIgnoreCase) || V(data, key, "").Equals("Ναι", StringComparison.OrdinalIgnoreCase) ? "☒" : "☐";
}
