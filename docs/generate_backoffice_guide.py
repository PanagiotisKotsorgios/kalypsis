"""Create the branded, navigable Greek KALYPSIS BackOffice user guide."""

from __future__ import annotations

import html
import io
import os
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import BaseDocTemplate, Frame, Image as PdfImage, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "guide-assets"
OUT = ROOT / "src" / "Frontend" / "web" / "public" / "docs" / "kalypsis-backoffice-guide.pdf"
LETTERHEAD = ASSETS / "letterhead.png"
PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#0B2545")
BLUE = colors.HexColor("#1167B1")
CYAN = colors.HexColor("#17A9E5")
GREEN = colors.HexColor("#1B8A4B")
GOLD = colors.HexColor("#D99000")
INK = colors.HexColor("#162538")
MUTED = colors.HexColor("#52657A")
PALE = colors.HexColor("#F3F7FB")


def register_fonts() -> None:
    windows = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    regular, bold, italic = windows / "arial.ttf", windows / "arialbd.ttf", windows / "ariali.ttf"
    if not regular.exists():
        regular = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        bold = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        italic = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf")
    pdfmetrics.registerFont(TTFont("GuideSans", str(regular)))
    pdfmetrics.registerFont(TTFont("GuideSans-Bold", str(bold)))
    pdfmetrics.registerFont(TTFont("GuideSans-Italic", str(italic)))


def screen_font(size: int, bold: bool = False):
    windows = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    path = windows / ("arialbd.ttf" if bold else "arial.ttf")
    if not path.exists():
        path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size)


def slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-") or "section"


def synthetic_screen(title: str, number: int) -> Image.Image:
    w, h = 1440, 820
    image = Image.new("RGB", (w, h), "#F4F7FB")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, w, 62), fill="#0B2545")
    draw.rectangle((0, 62, 245, h), fill="#102E55")
    draw.text((28, 18), "KALYPSIS", fill="white", font=screen_font(25, True))
    draw.text((270, 19), title, fill="white", font=screen_font(22, True))
    side = ["\u0391\u03c1\u03c7\u03b9\u03ba\u03ae", "\u03a0\u03b1\u03c1\u03b1\u03b3\u03c9\u03b3\u03ae", "\u03a0\u03b5\u03bb\u03ac\u03c4\u03b5\u03c2", "\u03a3\u03c5\u03bc\u03b2\u03cc\u03bb\u03b1\u03b9\u03b1", "\u039f\u03b9\u03ba\u03bf\u03bd\u03bf\u03bc\u03b9\u03ba\u03ac", "\u0391\u03bd\u03b1\u03c6\u03bf\u03c1\u03ad\u03c2", "\u03a1\u03c5\u03b8\u03bc\u03af\u03c3\u03b5\u03b9\u03c2"]
    for row, label in enumerate(side):
        y = 103 + row * 52
        if row == number % len(side):
            draw.rounded_rectangle((14, y - 9, 230, y + 35), 8, fill="#176BB7")
        draw.text((30, y), label, fill="#F1F7FF", font=screen_font(17))
    draw.text((270, 112), title, fill="#0B2545", font=screen_font(30, True))
    draw.text((270, 154), "\u0395\u03bd\u03b4\u03b5\u03b9\u03ba\u03c4\u03b9\u03ba\u03ae \u03bf\u03b8\u03cc\u03bd\u03b7 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1\u03c2", fill="#52657A", font=screen_font(16))
    draw.rounded_rectangle((270, 200, 1390, 279), 12, fill="white", outline="#C8D4E2", width=2)
    draw.text((294, 224), "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7 \u03ae \u03c6\u03af\u03bb\u03c4\u03c1\u03b1", fill="#52657A", font=screen_font(16))
    draw.rounded_rectangle((1110, 214, 1360, 259), 8, fill="#198754")
    draw.text((1154, 226), "\u039d\u03ad\u03b1 \u03b5\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae", fill="white", font=screen_font(16, True))
    for row in range(5):
        y = 310 + row * 82
        draw.rounded_rectangle((270, y, 1390, y + 62), 8, fill="white", outline="#D6E0EA")
        draw.ellipse((290, y + 19, 311, y + 40), fill="#18A978")
        draw.text((330, y + 15), f"\u0395\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae {row + 1:02d} \u00b7 \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03b1 Kalypsis", fill="#1B2F45", font=screen_font(16, True))
        draw.text((1030, y + 18), "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae   \u0395\u03be\u03b1\u03b3\u03c9\u03b3\u03ae   \u22ef", fill="#1167B1", font=screen_font(15))
    return image


def annotated_screen(asset: Path | None, title: str, number: int, callouts: list[tuple[float, float, str, str]]) -> bytes:
    image = Image.open(asset).convert("RGB") if asset and asset.exists() else synthetic_screen(title, number)
    image.thumbnail((1400, 790), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (1400, image.height + 72), "#E8F0F8")
    offset_x = (canvas.width - image.width) // 2
    canvas.paste(image, (offset_x, 58))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((18, 14, canvas.width - 18, 48), 7, fill="#0B2545")
    draw.text((34, 20), f"\u039f\u03b8\u03cc\u03bd\u03b7: {title}", fill="white", font=screen_font(18, True))
    for nx, ny, label, colour in callouts:
        tx = offset_x + int(nx * image.width)
        ty = 58 + int(ny * image.height)
        left = tx < canvas.width * 0.58
        box_x = 30 if left else canvas.width - 360
        box_y = max(70, min(canvas.height - 48, ty - 24))
        end_x = box_x + (320 if left else 0)
        draw.line((end_x, box_y + 18, tx, ty), fill=colour, width=5)
        direction = 1 if left else -1
        draw.polygon([(tx, ty), (tx - direction * 17, ty - 8), (tx - direction * 12, ty + 10)], fill=colour)
        draw.rounded_rectangle((box_x, box_y, box_x + 320, box_y + 38), 8, fill="white", outline=colour, width=3)
        draw.text((box_x + 10, box_y + 9), label, fill="#15263A", font=screen_font(15, True))
    output = io.BytesIO()
    canvas.save(output, format="JPEG", quality=84, optimize=True)
    return output.getvalue()


def html_text(value: str) -> str:
    return html.escape(value).replace("\n", "<br/>")


def para(value: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(html_text(value), style)


class GuideDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(filename, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=38 * mm, bottomMargin=16 * mm, title="Kalypsis BackOffice - \u039f\u03b4\u03b7\u03b3\u03cc\u03c2 \u03c7\u03c1\u03ae\u03c3\u03b7\u03c2", author="Kalypsis")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="guide")
        self.addPageTemplates([PageTemplate(id="guide", frames=frame, onPage=draw_background)])
        self.outlines: set[str] = set()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph) or flowable.style.name not in {"GuideTitle", "GuideH1"}:
            return
        text = flowable.getPlainText()
        key = slug(text)
        if key in self.outlines:
            return
        self.outlines.add(key)
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text[:120], key, level=0 if flowable.style.name == "GuideTitle" else 1, closed=False)


def draw_background(canvas, doc):
    canvas.saveState()
    canvas.drawImage(str(LETTERHEAD), 0, 0, width=PAGE_W, height=PAGE_H, preserveAspectRatio=False, mask="auto")
    canvas.setFillColor(colors.white)
    try:
        canvas.setFillAlpha(0.94)
    except AttributeError:
        pass
    canvas.roundRect(28, 44, PAGE_W - 56, PAGE_H - 172, 12, stroke=0, fill=1)
    try:
        canvas.setFillAlpha(1)
    except AttributeError:
        pass
    canvas.setStrokeColor(CYAN)
    canvas.setLineWidth(1.2)
    canvas.line(42, PAGE_H - 130, PAGE_W - 42, PAGE_H - 130)
    canvas.setFont("GuideSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(42, 25, "KALYPSIS · \u039f\u03b4\u03b7\u03b3\u03cc\u03c2 BackOffice · \u0388\u03ba\u03b4\u03bf\u03c3\u03b7 2026")
    canvas.drawRightString(PAGE_W - 42, 25, f"\u03a3\u03b5\u03bb\u03af\u03b4\u03b1 {doc.page}")
    canvas.restoreState()


def make_styles():
    base = getSampleStyleSheet()
    return {
        "GuideTitle": ParagraphStyle("GuideTitle", parent=base["Title"], fontName="GuideSans-Bold", fontSize=27, leading=32, textColor=NAVY, alignment=TA_LEFT, spaceAfter=7),
        "GuideH1": ParagraphStyle("GuideH1", parent=base["Heading1"], fontName="GuideSans-Bold", fontSize=18, leading=22, textColor=NAVY, spaceBefore=5, spaceAfter=7),
        "GuideH2": ParagraphStyle("GuideH2", parent=base["Heading2"], fontName="GuideSans-Bold", fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=7, spaceAfter=4),
        "Body": ParagraphStyle("Body", parent=base["BodyText"], fontName="GuideSans", fontSize=9.3, leading=12.6, textColor=INK, spaceAfter=4),
        "Small": ParagraphStyle("Small", parent=base["BodyText"], fontName="GuideSans", fontSize=7.4, leading=9.4, textColor=MUTED),
        "Bullet": ParagraphStyle("Bullet", parent=base["BodyText"], fontName="GuideSans", fontSize=8.7, leading=11.3, textColor=INK, leftIndent=13, firstLineIndent=-7, bulletIndent=2, spaceAfter=2),
        "Tip": ParagraphStyle("Tip", parent=base["BodyText"], fontName="GuideSans-Italic", fontSize=8.5, leading=11.2, textColor=INK, leftIndent=10, rightIndent=8, borderColor=CYAN, borderWidth=1, borderPadding=6, backColor=colors.HexColor("#EFF8FE"), spaceBefore=4, spaceAfter=6),
        "Toc": ParagraphStyle("Toc", parent=base["BodyText"], fontName="GuideSans", fontSize=9.4, leading=12.4, textColor=INK, spaceAfter=3),
        "Caption": ParagraphStyle("Caption", parent=base["BodyText"], fontName="GuideSans-Italic", fontSize=7.5, leading=9, textColor=MUTED, alignment=TA_LEFT, spaceBefore=3, spaceAfter=6),
    }


def S(name, title, intro, image, callouts, route=None):
    """Create one guide section.

    ``route`` is kept separately from the human title so the generated PDF can
    show a clickable, copyable BackOffice URL while retaining a clean Greek
    heading and an internal bookmark.
    """
    return {
        "name": name,
        "title": title,
        "intro": intro,
        "image": image,
        "callouts": callouts,
        "route": route,
    }


SECTIONS = [
    S("dashboard", "\u03a0\u03af\u03bd\u03b1\u03ba\u03b1\u03c2 \u03b5\u03bb\u03ad\u03b3\u03c7\u03bf\u03c5", "Η αρχική οθόνη συγκεντρώνει παραγωγή, συμβόλαια, εισπράξεις, ανανεώσεις, εκκρεμότητες και γρήγορες ενέργειες.", "dashboard.jpg", [(.88, .05, "Επιλογή γραφείου", "#D99000"), (.77, .30, "Κάρτες KPI", "#1167B1"), (.54, .73, "Άνοιγμα workspace", "#1B8A4B")]),
    S("customers", "Πελάτες", "Η λίστα πελατών προσφέρει ενιαία αναζήτηση, φίλτρα, γρήγορες ετικέτες, μαζική επιλογή, εισαγωγή, εκτύπωση και εξαγωγή.", "customers.jpg", [(.88, .04, "Νέος πελάτης", "#1B8A4B"), (.40, .18, "Αναζήτηση και φίλτρα", "#1167B1"), (.88, .47, "Προβολή καρτέλας", "#D99000")]),
    S("customer-profile", "Ενιαία καρτέλα πελάτη", "Η καρτέλα οργανώνει τα στοιχεία ταυτότητας, επικοινωνίας, οικογένειας, οχημάτων, συμβολαίων, οικονομικών, ζημιών και εγγράφων σε tabs.", "customer-profile.jpg", [(.82, .04, "Επεξεργασία πελάτη", "#1B8A4B"), (.42, .16, "Tabs καρτέλας", "#1167B1"), (.76, .66, "Συμβόλαια και δεδομένα", "#D99000")]),
    S("policies", "Συμβόλαια", "Η κεντρική λίστα συμβολαίων επιτρέπει αναζήτηση, ημερομηνίες, εταιρεία, κλάδο, κατάσταση, σύνθετα φίλτρα και άνοιγμα της πλήρους καρτέλας.", "production-lists.jpg", [(.73, .08, "Νέο συμβόλαιο", "#1B8A4B"), (.42, .15, "Σύνθετα φίλτρα", "#1167B1"), (.72, .51, "Προβολή συμβολαίου", "#D99000")]),
    S("policy-profile", "Καρτέλα συμβολαίου", "Η σύνοψη δείχνει ασφαλιστήριο, πελάτη, ασφαλιστική, παραγωγό, καλύψεις, όχημα, διάρκεια, εισπράξεις και προμήθειες. Τα υπόλοιπα tabs αναλύουν οικονομικά, στοιχεία, κινήσεις και έγγραφα.", "contract-profile.jpg", [(.79, .07, "Επεξεργασία", "#1B8A4B"), (.42, .15, "Πλοήγηση tabs", "#1167B1"), (.76, .55, "Καλύψεις και όχημα", "#D99000")]),
    S("vehicles", "Οχήματα", "Το μητρώο οχημάτων έχει αναζήτηση, φίλτρα, στατιστικά, σελιδοποίηση, εκτύπωση, εξαγωγή και compact popup πλήρους καρτέλας.", "customer-profile.jpg", [(.88, .04, "Νέο όχημα", "#1B8A4B"), (.38, .15, "Φίλτρα", "#1167B1"), (.86, .62, "Άνοιγμα καρτέλας", "#D99000")]),
    S("green-cards", "Πράσινες κάρτες", "Δημιουργήστε, αναζητήστε, επεξεργαστείτε, εκδώστε PDF, παραδώστε και διαγράψτε χειροκίνητες πράσινες κάρτες ή συνδέστε τις με συμβόλαιο και όχημα.", None, [(.87, .24, "Νέα πράσινη κάρτα", "#1B8A4B"), (.45, .32, "Αναζήτηση και κατάσταση", "#1167B1"), (.83, .62, "Έκδοση / διαγραφή", "#D99000")]),
    S("production-lists", "Λίστες παραγωγής", "Οι λίστες παραγωγής είναι αναφορά του χαρτοφυλακίου. Χρησιμοποιήστε στήλες, φίλτρα, εκτύπωση, εξαγωγή, ομαδοποίηση και προβολή καλύψεων.", "production-lists.jpg", [(.73, .06, "Εξαγωγή / εκτύπωση", "#D99000"), (.42, .16, "Φίλτρα λίστας", "#1167B1"), (.72, .61, "Ομαδοποίηση", "#1B8A4B")]),
    S("companies", "Εταιρείες και πρακτορεία παραγωγής", "Το ενιαίο μητρώο συνεργαζόμενων ασφαλιστικών εταιρειών και πρακτορείων έχει λίστα, αναζήτηση, νέα εγγραφή, μαζικές ενέργειες και πλήρη καρτέλα.", "company-list.jpg", [(.90, .05, "Νέα εταιρεία / πρακτορείο", "#1B8A4B"), (.47, .17, "Αναζήτηση", "#1167B1"), (.88, .56, "Προβολή / επεξεργασία", "#D99000")]),
    S("company-profile", "Καρτέλα εταιρείας ή πρακτορείου", "Η σύνοψη, τα συμβόλαια, οι επικοινωνίες, τα στελέχη, τα έγγραφα, τα δυναμικά πεδία και τα στατιστικά παραμένουν σε ένα compact popup με σταθερή πλοήγηση.", "company-profile.jpg", [(.80, .08, "Επεξεργασία", "#1B8A4B"), (.43, .15, "Tabs", "#1167B1"), (.83, .67, "Αρχεία και πεδία", "#D99000")]),
    S("claims", "Ζημιές", "Καταγράψτε ζημιές, συνδέστε πελάτη, συμβόλαιο και όχημα, παρακολουθήστε στάδιο, ημερομηνίες, ποσά, υπεύθυνο και αποζημίωση.", "company-stats.jpg", [(.40, .16, "Φίλτρα ζημιών", "#1167B1"), (.88, .07, "Νέα ζημιά", "#1B8A4B"), (.84, .56, "Άνοιγμα υπόθεσης", "#D99000")]),
    S("partners", "Συνεργάτες", "Η καρτέλα συνεργάτη περιλαμβάνει στοιχεία, ρόλο, φορολογικά, συμβάσεις, παραγωγή, προμήθειες, εκκαθαρίσεις, επικοινωνίες και δικαιώματα.", "company-detail.jpg", [(.89, .05, "Νέος συνεργάτης", "#1B8A4B"), (.44, .16, "Αναζήτηση", "#1167B1"), (.86, .52, "Πλήρης καρτέλα", "#D99000")]),
    S("bridges", "Γέφυρες ασφαλιστικών εταιρειών", "Επιλέξτε εταιρεία, ανεβάστε CSV, TXT ή ZIP, ελέγξτε αντιστοιχίσεις και προεπισκόπηση πριν την εισαγωγή. Οι άγνωστοι κωδικοί συνδέονται από το πάνελ αντιστοιχίσεων.", "company-parametrics.jpg", [(.32, .18, "Επιλογή εταιρείας", "#1167B1"), (.77, .20, "Ανέβασμα αρχείου", "#1B8A4B"), (.80, .67, "Έλεγχος εισαγωγής", "#D99000")]),
    S("financials", "Οικονομικά και ταμείο", "Παρακολουθήστε εισπράξεις, πληρωμές σε εταιρείες και συνεργάτες, εκκρεμότητες, ταμειακές κινήσεις, συμψηφισμούς και καθαρή εκροή.", "dashboard.jpg", [(.45, .18, "Επιλογή οικονομικής ενότητας", "#1167B1"), (.83, .07, "Νέα κίνηση", "#1B8A4B"), (.86, .61, "Εξαγωγή", "#D99000")]),
    S("commissions", "Προμήθειες και εκκαθαρίσεις", "Οι κανόνες προμηθειών υπολογίζουν την προμήθεια γραφείου και συνεργάτη, ενώ οι εκκαθαρίσεις ελέγχονται και οριστικοποιούνται ανά περίοδο.", "production-lists.jpg", [(.44, .16, "Κανόνας / περίοδος", "#1167B1"), (.87, .07, "Νέα εκκαθάριση", "#1B8A4B"), (.78, .63, "Οριστικοποίηση", "#D99000")]),
    S("parameters", "Παραμετροποίηση", "Οι κατάλογοι κλάδων, καλύψεων, χρήσεων, πακέτων, εταιρικών γεφυρών και προμηθειών καθορίζουν τις ασφαλείς επιλογές σε όλο το BackOffice.", "company-parametrics.jpg", [(.44, .16, "Κατηγορία παραμέτρου", "#1167B1"), (.87, .07, "Νέα εγγραφή", "#1B8A4B"), (.85, .58, "Επεξεργασία", "#D99000")]),
    S("documents", "Έγγραφα και νομικά έντυπα", "Δημιουργήστε, προεπισκοπήστε, υπογράψτε, κατεβάστε και αρχειοθετήστε έγγραφα πελατών, συμβολαίων και εταιρειών. Το ιστορικό δείχνει ποιος έστειλε τι και πότε.", "legal-documents.jpg", [(.84, .08, "Νέο έγγραφο", "#1B8A4B"), (.42, .16, "Φίλτρα ιστορικού", "#1167B1"), (.86, .61, "Λήψη / προεπισκόπηση", "#D99000")]),
    S("legal-templates", "Πρότυπα GDPR, IDD και AML", "Τα πρότυπα έχουν δυναμικά πεδία πελάτη και γραφείου, προεπισκόπηση PDF, αποστολή για ψηφιακή υπογραφή και ιστορικό ανά πελάτη.", "forms.jpg", [(.38, .18, "Επιλογή εντύπου", "#1167B1"), (.81, .18, "Προεπισκόπηση", "#D99000"), (.82, .64, "Αποστολή υπογραφής", "#1B8A4B")]),
    S("reports", "Αναφορές και στατιστικά", "Φιλτράρετε περίοδο, γραφείο, εταιρεία, κλάδο και συνεργάτη. Τα γραφήματα, οι πίνακες και οι εξαγωγές βοηθούν στη λήψη αποφάσεων.", "company-stats.jpg", [(.43, .18, "Φίλτρα αναφοράς", "#1167B1"), (.82, .29, "Διαδραστικό γράφημα", "#1B8A4B"), (.84, .06, "Εξαγωγή", "#D99000")]),
    S("intelligence", "Αναλυτικά και Νοημοσύνη", "Το workspace οργανώνει prompts, αναλύσεις συμβολαίων, προβλέψεις κινδύνου, ιστορικό αποτελεσμάτων και χρήση AI με το API key του γραφείου.", "front-dashboard.jpg", [(.43, .16, "Υποσελίδες workspace", "#1167B1"), (.80, .26, "Εκτέλεση ανάλυσης", "#1B8A4B"), (.84, .67, "Ιστορικό αποτελεσμάτων", "#D99000")]),
    S("crm", "CRM", "Οργανώστε ομάδες, εργασίες, ραντεβού, επικοινωνίες, καμπάνιες, follow-up και ιστορικό αποστολών. Τα email χρησιμοποιούν τις ρυθμίσεις του κάθε γραφείου.", "workspace-cards.jpg", [(.45, .24, "Ομάδες πελατών", "#1167B1"), (.77, .24, "Νέα επικοινωνία", "#1B8A4B"), (.84, .65, "Ιστορικό αποστολών", "#D99000")]),
    S("frontoffice", "FrontOffice και ιστοσελίδα γραφείου", "Διαχειριστείτε posts, προσφορές, banners, φόρμες ενδιαφέροντος, αιτήματα και στατιστικά επισκεψιμότητας για το site του γραφείου.", "front-dashboard.jpg", [(.42, .20, "Περιεχόμενο ιστοσελίδας", "#1167B1"), (.79, .20, "Νέα ανάρτηση", "#1B8A4B"), (.82, .64, "Αιτήματα website", "#D99000")]),
    S("offices", "Πολλαπλά γραφεία", "Ο διαχειριστής δημιουργεί γραφεία, αντιγράφει παραμέτρους, επιλέγει scope, βλέπει συγκεντρωτικά στατιστικά και εισέρχεται σε κάθε γραφείο με ελεγχόμενο ρόλο.", "office-settings.jpg", [(.86, .07, "Νέο γραφείο", "#1B8A4B"), (.43, .16, "Επιλογή γραφείου", "#1167B1"), (.82, .61, "Εποπτεία", "#D99000")]),
    S("users", "Χρήστες, ρόλοι και δικαιώματα", "Προσθέστε υπαλλήλους και υποδιαχειριστές, ορίστε δικαιώματα και επιβεβαιώστε ότι κάθε χρήστης βλέπει μόνο το επιτρεπόμενο γραφείο.", "office-settings.jpg", [(.86, .07, "Νέος χρήστης", "#1B8A4B"), (.43, .16, "Ρόλος και scope", "#1167B1"), (.84, .61, "Αποθήκευση", "#D99000")]),
    S("settings", "Γραφείο και προφίλ", "Ρυθμίστε στοιχεία γραφείου, λογότυπο, email, CRM, Brevo, Bulker, AI API key, αυτόματη παράδοση και ορατότητα sidebar.", "office-settings.jpg", [(.45, .16, "Tabs ρυθμίσεων", "#1167B1"), (.81, .28, "Στοιχεία γραφείου", "#1B8A4B"), (.83, .67, "Αποθήκευση", "#D99000")]),
    S("audit", "Audit logs και κάδος ανακύκλωσης", "Ελέγξτε ποιος δημιούργησε, άλλαξε ή διέγραψε κάθε δεδομένο. Για διαγραφές και μαζικές ενέργειες χρησιμοποιήστε την επιβεβαίωση και τον κάδο όπου υπάρχει.", "company-detail.jpg", [(.42, .17, "Φίλτρα ενεργειών", "#1167B1"), (.84, .56, "Προβολή αλλαγής", "#D99000"), (.86, .07, "Επαναφορά", "#1B8A4B")]),
    S("notifications", "Ειδοποιήσεις, εργασίες και ραντεβού", "Οι λήξεις, οφειλές, follow-ups και εργασίες εμφανίζονται στο dashboard. Ορίστε υπεύθυνο, προτεραιότητα, σύνδεση με πελάτη και ημερομηνία υπενθύμισης.", "dashboard.jpg", [(.44, .17, "Γρήγορα φίλτρα", "#1167B1"), (.85, .07, "Νέα εργασία", "#1B8A4B"), (.84, .62, "Κατάσταση", "#D99000")]),
    S("imports", "Εισαγωγές και εξαγωγές", "Κατεβάστε ελληνικά πρότυπα XLSX, συμπληρώστε τα υποχρεωτικά πεδία και κάντε drag-and-drop εισαγωγή. Πριν την οριστικοποίηση ελέγξτε τα σφάλματα και τις διπλοεγγραφές.", "production-lists.jpg", [(.43, .15, "Λήψη προτύπου", "#1167B1"), (.81, .15, "Drag and drop", "#1B8A4B"), (.83, .65, "Έλεγχος / εξαγωγή", "#D99000")]),
    S("troubleshooting", "Ασφάλεια και αντιμετώπιση προβλημάτων", "Σε μήνυμα υπηρεσίας, ελέγξτε πρώτα σύνδεση, ρόλο, επιλογή γραφείου, κατάσταση γέφυρας και υποχρεωτικά πεδία. Μην επαναλαμβάνετε εισαγωγή χωρίς να ελέγξετε τις αντιστοιχίσεις.", "documentation.jpg", [(.43, .17, "Αναζήτηση βοήθειας", "#1167B1"), (.82, .06, "Υποστήριξη", "#1B8A4B"), (.85, .65, "Οδηγίες", "#D99000")]),
]


# ---------------------------------------------------------------------------
# Route-complete BackOffice catalogue
# ---------------------------------------------------------------------------
# The hand-authored sections above contain the most important workflows with
# real screenshots.  The route catalogue below is generated from App.tsx so
# the downloadable guide does not silently become stale when a new BackOffice
# screen is added.  Routes without a captured production screenshot receive a
# polished annotated wireframe with the same Kalypsis navigation, search,
# filter, primary-action and row-action affordances.
ROUTE_EXCLUSIONS = {
    "*", "platform/*", "agency/*", "my-expected-rates", "my-reconciliation",
}

ROUTE_LABELS = {
    "": "Αρχική σελίδα / Πίνακας ελέγχου",
    "dashboard": "Πίνακας ελέγχου",
    "customers": "Πελάτες",
    "customers/:id": "Καρτέλα πελάτη",
    "vehicles": "Οχήματα",
    "contracts/new": "Νέο συμβόλαιο",
    "contracts/:id": "Καρτέλα συμβολαίου",
    "policies": "Συμβόλαια",
    "green-cards": "Πράσινες κάρτες",
    "all-users": "Όλοι οι χρήστες",
    "documents": "Έγγραφα",
    "notifications": "Ειδοποιήσεις",
    "users": "Χρήστες και υπάλληλοι",
    "tenants": "Γραφεία και μισθώσεις",
    "tenants/:id": "Καρτέλα γραφείου",
    "settings": "Ρυθμίσεις διαχειριστή",
    "requests": "Αιτήματα",
    "audit": "Audit logs / Ιστορικό ενεργειών",
    "recycle-bin": "Κάδος ανακύκλωσης",
    "producer-reconciliation": "Εκκαθάριση συνεργατών",
    "reconciliation-dashboard": "Πίνακας εκκαθαρίσεων",
    "reconciliation-hub": "Κέντρο εκκαθαρίσεων",
    "tasks": "Εργασίες",
    "producers": "Συνεργάτες",
    "claims": "Ζημιές",
    "reports": "Αναφορές",
    "intelligence-workbench": "Αναλυτικά και Νοημοσύνη",
    "intelligence-workbench/prompts": "Prompts και πρότυπα AI",
    "intelligence-workbench/chat": "Συνομιλία AI",
    "intelligence-workbench/history": "Ιστορικό αποτελεσμάτων AI",
    "intelligence-workbench/automations": "Αυτοματισμοί AI",
    "production-report": "Αναφορά παραγωγής",
    "commission-distribution": "Κατανομή προμηθειών",
    "financial-report": "Οικονομική αναφορά",
    "producer-statement": "Πινάκιο συνεργάτη",
    "legal-templates": "Νομικά έντυπα πελατών",
    "legal": "Νομική βιβλιοθήκη",
    "compliance-dashboard": "Πίνακας συμμόρφωσης",
    "dynamic-fields": "Δυναμικά πεδία",
    "groupings": "Ομαδοποιήσεις",
    "period-locks": "Κλειδώματα περιόδων",
    "bulk-receipts": "Μαζικές εισπράξεις",
    "auto-receipt-matching": "Αυτόματος συμψηφισμός εισπράξεων",
    "ageing-analysis": "Ανάλυση ληξιπρόθεσμων",
    "journal-entries": "Εγγραφές ημερολογίου",
    "commission-certificates": "Βεβαιώσεις προμηθειών",
    "carrier-ledger": "Λογιστήριο ασφαλιστικών",
    "statement-mailer": "Αποστολή πινακίων",
    "federation/championships": "Πρωταθλήματα",
    "profile": "Προφίλ χρήστη",
    "agency-settings": "Ρυθμίσεις γραφείου",
    "agency-settings-hub": "Κέντρο ρυθμίσεων γραφείου",
    "agency-and-profile": "Γραφείο και προφίλ",
    "appointments": "Ραντεβού",
    "tariffs": "Τιμολόγια",
    "cover-notes": "Cover notes",
    "office-website/overview": "Επισκόπηση ιστοσελίδας γραφείου",
    "office-website/requests": "Αιτήματα ιστοσελίδας",
    "office-website/analytics": "Στατιστικά ιστοσελίδας",
    "office-website": "Διαχείριση ιστοσελίδας γραφείου",
    "branches": "Υποκαταστήματα",
    "bank-connections": "Τραπεζικές συνδέσεις",
    "marketing": "Καμπάνιες CRM",
    "crm-groups": "Ομάδες CRM",
    "crm-settings": "Ρυθμίσεις CRM",
    "intelligence-settings": "Ρυθμίσεις AI",
    "delivery-tracking": "Παρακολούθηση αποστολών",
    "document-manager": "Διαχειριστής εγγράφων",
    "partner-portals": "Πύλες συνεργατών",
    "api-keys": "Κλειδιά API",
    "dias": "Κωδικοί ΔΙΑΣ",
    "kepyo": "ΚΕΠΥΟ",
    "magnetic-import": "Μαγνητικές εισαγωγές",
    "over-commissions": "Επιπλέον προμήθειες",
    "over-commission-statements": "Καταστάσεις επιπλέον προμηθειών",
    "over-commission-bridges": "Γέφυρες επιπλέον προμηθειών",
    "goals": "Στόχοι παραγωγής",
    "production-stats": "Στατιστικά παραγωγής",
    "commission-runs": "Εκκαθαρίσεις προμηθειών",
    "company-bridges": "Γέφυρες ασφαλιστικών",
    "insurance-companies": "Ασφαλιστικές εταιρείες",
    "companies-agencies": "Εταιρείες και πρακτορεία",
    "production-companies-agencies": "Εταιρείες και πρακτορεία παραγωγής",
    "endorsements": "Πρόσθετες πράξεις",
    "cancellations": "Ακυρώσεις",
    "credit-notes": "Πιστωτικά",
    "commission-rules": "Κανόνες προμηθειών",
    "lookups": "Κατάλογοι παραμέτρων",
    "parametric-files": "Παραμετρικά αρχεία",
    "company-parametrics": "Παραμετρικά ασφαλιστικών",
    "quote-builder": "Δημιουργία προσφοράς",
    "workflows": "Ροές εργασίας",
    "churn": "Πρόβλεψη απώλειας πελατών",
    "report-builder": "Δημιουργός αναφορών",
    "print-pay": "Εκτυπώνω και πληρώνω",
    "plafond": "Όρια και plafond",
    "risk-profiles": "Προφίλ κινδύνου",
    "agency-offices": "Διαχείριση γραφείων",
    "garages": "Συνεργεία",
    "claim-provisions": "Προβλέψεις ζημιών",
    "indemnities": "Αποζημιώσεις ζημιών",
    "name-days": "Εορτολόγιο",
    "instructions": "Εσωτερικές οδηγίες γραφείου",
    "backups": "Αντίγραφα ασφαλείας",
    "support-request": "Αίτημα υποστήριξης",
    "mydata": "myDATA",
    "document-designer": "Σχεδιαστής εγγράφων",
    "friendly-settlements": "Φιλικοί διακανονισμοί",
    "customer-merge": "Συγχώνευση πελατών",
    "persistency": "Persistency χαρτοφυλακίου",
    "all-tools": "Όλα τα εργαλεία",
    "ermes": "ΕΡΜΗΣ επικοινωνίες",
    "documentation": "Οδηγίες χρήσης",
    "platform/documentation": "Επεξεργασία οδηγού πλατφόρμας",
    "platform/landing": "Επεξεργασία δημόσιας αρχικής",
    "carrier-bridges-hub": "Κέντρο γεφυρών εταιρειών",
    "carrier-bridges": "Εισαγωγές ασφαλιστικών",
    "collection-files-bridges": "Γέφυρες αρχείων εισπράξεων",
    "bridge-code-mappings": "Αντιστοιχίσεις κωδικών γεφυρών",
    "production-lists": "Λίστες παραγωγής",
    "producer-production": "Παραγωγή συνεργάτη",
    "producer-statistics": "Στατιστικά συνεργάτη",
    "producer-goals": "Στόχοι συνεργάτη",
    "renewals": "Ανανεώσεις",
    "financials": "Οικονομικά",
    "receipts": "Εισπράξεις",
    "payments": "Πληρωμές",
    "financial-movements": "Οικονομικές κινήσεις",
    "cash": "Ταμείο",
    "gl": "Γενικό καθολικό",
    "platform/carriers": "Κατάλογος ασφαλιστικών πλατφόρμας",
    "platform/oc-bridges": "Γέφυρες επιπλέον προμηθειών πλατφόρμας",
    "platform/finance": "Οικονομικά πλατφόρμας",
    "platform/broadcast": "Μαζικές ανακοινώσεις",
    "platform/backups": "Αντίγραφα πλατφόρμας",
    "platform/storage": "Αποθηκευτικός χώρος πλατφόρμας",
    "platform/jobs": "Εργασίες υποβάθρου",
    "platform/status": "Κατάσταση υπηρεσίας",
    "platform/breach-incidents": "Περιστατικά ασφάλειας",
    "platform/compliance": "Συμμόρφωση πλατφόρμας",
    "platform/support": "Υποστήριξη πλατφόρμας",
    "integration-settings": "Ρυθμίσεις συνδέσεων",
    "named-reports": "Ονομαστικές αναφορές",
    "config-hub": "Κέντρο παραμετροποίησης",
    "advance-payments": "Προκαταβολές",
    "reconciliation": "Συμφωνίες οικονομικών",
    "tachypayments": "Ταχείες πληρωμές",
    "info-center": "Κέντρο ενημέρωσης",
    "vehicle-models": "Μοντέλα οχημάτων",
}


def route_label(route: str) -> str:
    if route in ROUTE_LABELS:
        return ROUTE_LABELS[route]
    text = route.replace(":id", "ID").replace(":token", "token").replace("/", " · ")
    text = text.replace("-", " ")
    return "Σελίδα BackOffice · " + text


def route_sections() -> list[dict]:
    app_source = (ROOT / "src" / "Frontend" / "web" / "src" / "App.tsx").read_text(encoding="utf-8")
    marker = app_source.find('path="/app/*"')
    if marker < 0:
        return []
    routes = re.findall(r'<Route path="([^"]+)"', app_source[marker:])
    # Preserve source order while removing aliases and the catch-all route.
    unique = []
    for route in [""] + routes:
        if route in ROUTE_EXCLUSIONS or route in unique:
            continue
        unique.append(route)
    result = []
    for route in unique:
        label = route_label(route)
        path = "/app" + (f"/{route}" if route else "")
        image_by_route = {
            "": "dashboard.jpg",
            "dashboard": "dashboard.jpg",
            "customers": "customers.jpg",
            "customers/:id": "customer-profile.jpg",
            "policies": "production-lists.jpg",
            "contracts/:id": "contract-profile.jpg",
            "vehicles": "customer-profile.jpg",
            "production-lists": "production-lists.jpg",
            "production-companies-agencies": "company-list.jpg",
            "companies-agencies": "company-list.jpg",
            "insurance-companies": "company-list.jpg",
            "company-parametrics": "company-parametrics.jpg",
            "reports": "company-stats.jpg",
            "legal-templates": "forms.jpg",
            "documentation": "documentation.jpg",
            "agency-settings": "office-settings.jpg",
            "agency-and-profile": "office-settings.jpg",
            "marketing": "workspace-cards.jpg",
            "intelligence-workbench": "front-dashboard.jpg",
        }
        result.append(S(
            f"route-{slug(route or 'home')}",
            label,
            f"Η σελίδα «{label}» είναι διαθέσιμη στη διαδρομή {path}. Χρησιμοποιήστε το sidebar για πλοήγηση, την αναζήτηση και τα φίλτρα για περιορισμό αποτελεσμάτων, και τις ενέργειες της γραμμής για προβολή ή επεξεργασία.",
            image_by_route.get(route),
            [
                (.22, .18, "Πλοήγηση από το sidebar", "#1167B1"),
                (.46, .24, "Αναζήτηση και φίλτρα", "#1167B1"),
                (.84, .20, "Νέα / κύρια ενέργεια", "#1B8A4B"),
                (.84, .63, "Ενέργειες γραμμής", "#D99000"),
            ],
            route=route,
        ))
    return result


SECTIONS.extend(route_sections())


def bullet(text: str, styles: dict) -> Paragraph:
    return Paragraph(html_text("• " + text), styles["Bullet"])


def build_story():
    st = make_styles()
    story = [Spacer(1, 34 * mm), para("KALYPSIS", ParagraphStyle("CoverBrand", parent=st["GuideTitle"], fontSize=34, leading=38, textColor=NAVY)), para("Οδηγός χρήσης BackOffice", ParagraphStyle("CoverTitle", parent=st["GuideTitle"], fontSize=25, leading=30, textColor=BLUE)), Spacer(1, 8 * mm)]
    cover = Table([[para("Πλήρης οδηγός πλοήγησης, παραγωγής, συμβολαίων, οικονομικών, παραμετροποίησης, CRM, FrontOffice και εποπτείας γραφείων.\n\nΠεριλαμβάνει εσωτερικό ευρετήριο PDF, annotated screenshots με βέλη, πρακτικά βήματα, σημεία ελέγχου και καθημερινή ρουτίνα.", st["Body"])]], colWidths=[130 * mm])
    cover.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.white), ("BOX", (0, 0), (-1, -1), 1, CYAN), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
    story += [cover, Spacer(1, 8 * mm), para("Έκδοση 2026 · Για διαχειριστές, υποδιαχειριστές και υπαλλήλους ασφαλιστικών γραφείων", st["Small"]), PageBreak()]
    story += [para("Περιεχόμενα και τρόπος χρήσης", st["GuideTitle"]), para("Κάντε κλικ σε οποιοδήποτε κεφάλαιο του PDF για άμεση μετάβαση. Τα βέλη στα screenshots δείχνουν το κουμπί ή το πεδίο που περιγράφεται.", st["Body"]), Spacer(1, 3 * mm)]
    entries = []
    for index, item in enumerate(SECTIONS, 1):
        title = item["title"]
        key = slug(f"{index}. {title}")
        entries.append(Paragraph(f'<link href="#{key}" color="#1167B1"><b>{index:02d}</b> · {html.escape(title)}</link>', st["Toc"]))
    rows = []
    midpoint = (len(entries) + 1) // 2
    for row in range(midpoint):
        rows.append([entries[row], entries[row + midpoint] if row + midpoint < len(entries) else ""])
    toc = Table(rows, colWidths=[75 * mm, 75 * mm], splitByRow=1)
    toc.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE), ("BOX", (0, 0), (-1, -1), .5, colors.HexColor("#C8D7E8")), ("INNERGRID", (0, 0), (-1, -1), .25, colors.HexColor("#DCE7F1")), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story += [toc, PageBreak()]
    for index, item in enumerate(SECTIONS, 1):
        title, intro = item["title"], item["intro"]
        story += [para(f"{index}. {title}", st["GuideH1"]), para(intro, st["Body"]), para("Πώς το χρησιμοποιείς", st["GuideH2"]), bullet(f"Άνοιξε το sidebar και επίλεξε «{title}» ή χρησιμοποίησε την αναζήτηση σελίδων.", st), bullet("Έλεγξε πρώτα την επιλογή γραφείου και τα δικαιώματα του λογαριασμού σου.", st)]
        if item.get("route") is not None:
            route_path = "/app" + (f"/{item['route']}" if item["route"] else "")
            story.append(Paragraph(
                f'<b>Διαδρομή:</b> <link href="https://mykalypsis.gr{html.escape(route_path)}" color="#1167B1">{html.escape(route_path)}</link>',
                st["Small"],
            ))
        if item["name"] not in {"dashboard", "troubleshooting"}:
            story.append(bullet("Χρησιμοποίησε αναζήτηση και φίλτρα πριν ανοίξεις ή επεξεργαστείς μια εγγραφή.", st))
        raw = annotated_screen(ASSETS / item["image"] if item["image"] else None, title, index, item["callouts"])
        reader = ImageReader(io.BytesIO(raw))
        image_w, image_h = reader.getSize()
        width = 155 * mm
        height = min(width * image_h / image_w, 90 * mm)
        caption = ("Screenshot της λειτουργίας με σημειωμένα κουμπιά και βέλη. "
                   "Όπου δεν υπάρχει διαθέσιμη λήψη, εμφανίζεται ενδεικτική οθόνη της ίδιας ροής.")
        story += [Spacer(1, 2 * mm), PdfImage(io.BytesIO(raw), width=width, height=height), para(caption, st["Caption"]), para("Σημεία ελέγχου", st["GuideH2"]), bullet("Οι αλλαγές αποθηκεύονται μόνο μετά το πράσινο κουμπί αποθήκευσης και το μήνυμα επιτυχίας.", st), bullet("Για διαγραφή, ακύρωση ή μαζική ενέργεια επιβεβαίωσε το popup και έλεγξε το ιστορικό.", st), para("Συμβουλή: ξεκίνα με μικρό φίλτρο, έλεγξε τα αποτελέσματα και μετά κάνε εξαγωγή ή μαζική ενέργεια.", st["Tip"]), PageBreak()]
    story += [para("Γρήγορη καθημερινή ρουτίνα", st["GuideH1"]), para("Προτεινόμενη σειρά για ασφαλή λειτουργία γραφείου:", st["Body"])]
    for text in ["Έλεγξε dashboard, ειδοποιήσεις λήξεων και οφειλές.", "Άνοιξε τις λίστες παραγωγής και έλεγξε νέες εισαγωγές και αντιστοιχίσεις.", "Κατέγραψε εισπράξεις και πληρωμές και συμφώνησε το ταμείο.", "Επεξεργάσου follow-ups, ραντεβού και επικοινωνίες CRM.", "Πάρε αντίγραφο/εξαγωγή των κρίσιμων λιστών και εγγράφων.", "Για κάθε απρόσμενη αλλαγή αναζήτησε πρώτα το audit log."]:
        story.append(bullet(text, st))
    story.append(para("Ο οδηγός ενημερώνεται μαζί με την πλατφόρμα. Για υποστήριξη στείλε URL, screenshot και τα βήματα αναπαραγωγής.", st["Tip"]))
    return story


def main():
    register_fonts()
    if not LETTERHEAD.exists():
        raise FileNotFoundError(f"Λείπει το letterhead: {LETTERHEAD}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = GuideDoc(str(OUT))
    doc.build(build_story())
    print(f"Created {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
