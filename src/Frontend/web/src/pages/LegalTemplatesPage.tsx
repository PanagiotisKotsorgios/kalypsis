import { useEffect, useMemo, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, Chip,
  CircularProgress, Divider, Stack, TextField, Tooltip, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintIcon from "@mui/icons-material/Print";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GavelIcon from "@mui/icons-material/Gavel";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

// Νομικά templates ανά γραφείο. Κάθε γραφείο-controller έχει την υποχρέωση
// να δώσει στους πελάτες του συγκεκριμένα έντυπα ενημέρωσης + να συλλέξει
// ρητές συγκαταθέσεις όπου απαιτείται. Η σελίδα αυτή τα παρέχει έτοιμα με
// pre-fill από τα Ρυθμίσεις Γραφείου· ο operator μπορεί να τα προσαρμόσει,
// να τα σώσει τοπικά στο γραφείο του, να τα εκτυπώσει, να τα αποθηκεύσει ως
// PDF (μέσω του native print dialog) ή να τα επαναφέρει στην προεπιλογή.

interface AgencyProfile {
  name: string;
  vatNumber: string | null;
  addressLine: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  tteRegistrationNumber: string | null;
  tteRegistrationYear: number | null;
}

const AGENCY_PLACEHOLDER: AgencyProfile = {
  name: "[Επωνυμία Γραφείου]",
  vatNumber: null,
  addressLine: null,
  contactEmail: null,
  contactPhone: null,
  tteRegistrationNumber: null,
  tteRegistrationYear: null,
};

type TemplateKey = "gdpr13" | "gdpr9" | "idd" | "aml";
const STORAGE_PREFIX = "kalypsis.legalTemplate.";

interface TemplateMeta {
  key: TemplateKey;
  title: string;
  legalBase: string;
  when: string;
  build: (p: AgencyProfile) => string;
}

const TEMPLATES: TemplateMeta[] = [
  { key: "gdpr13", title: "1. Ενημέρωση Υποκειμένου Δεδομένων",
    legalBase: "Άρθρο 13 GDPR",
    when: "Δίδεται σε ΚΑΘΕ πελάτη κατά τη στιγμή συλλογής των στοιχείων του.",
    build: buildGdpr13Text },
  { key: "gdpr9", title: "2. Ρητή Συγκατάθεση Επεξεργασίας Δεδομένων Υγείας",
    legalBase: "Άρθρο 9 GDPR",
    when: "Απαιτείται ΜΟΝΟ για συμβόλαια Ζωής, Υγείας, Ατυχημάτων ή όπου συλλέγονται ιατρικά δεδομένα.",
    build: buildGdpr9Text },
  { key: "idd", title: "3. Ανάλυση Απαιτήσεων και Αναγκών Πελάτη (Demands & Needs)",
    legalBase: "Ν. 4583/2018, Άρθρο 27 (IDD)",
    when: "Υποχρεωτικό για ΚΑΘΕ πρόταση ασφαλιστικού προϊόντος πριν την υπογραφή.",
    build: buildIddText },
  { key: "aml", title: "4. Δήλωση Πραγματικού Δικαιούχου & Πηγής Χρημάτων (KYC/AML)",
    legalBase: "Ν. 4557/2018 (Anti-Money Laundering)",
    when: "Υποχρεωτικό για συμβόλαια Ζωής/Επενδυτικά ή συμβόλαια αξίας ≥15.000€ ετησίως.",
    build: buildAmlText },
];

export function LegalTemplatesPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<TemplateKey | false>("gdpr13");

  const q = useQuery({
    queryKey: ["agency-profile"],
    queryFn: async () => (await api.get<AgencyProfile>("/agency-profile")).data
  });

  const p = q.data ?? AGENCY_PLACEHOLDER;

  const missingFields: string[] = [];
  if (!p.vatNumber) missingFields.push("ΑΦΜ");
  if (!p.addressLine) missingFields.push("Διεύθυνση");
  if (!p.tteRegistrationNumber) missingFields.push("Αρ. Μητρώου ΤτΕ");
  if (!p.contactEmail) missingFields.push("Email");

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <GavelIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("legalTemplates.title", "Νομικά Έντυπα Πελατών")}
          </Typography>
          <Typography color="text.secondary">
            {t("legalTemplates.subtitle",
              "Πρότυπα εντύπων που πρέπει να δίνει το γραφείο στους πελάτες του βάσει GDPR & Ν. 4583/2018.")}
          </Typography>
        </Box>
      </Stack>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {missingFields.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("legalTemplates.missingFields",
                "Λείπουν στοιχεία γραφείου: {{list}}. Συμπληρώστε τα στις Ρυθμίσεις Γραφείου για πλήρη προ-γέμιση.", {
                list: missingFields.join(", ")
              })}
            </Alert>
          )}

          <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Οδηγία χρήσης:</strong> Ανοίξτε το έντυπο, επεξεργαστείτε αν
              χρειάζεται με «Επεξεργασία» και αποθηκεύστε τις αλλαγές με «Αποθήκευση».
              Οι αλλαγές παραμένουν στο γραφείο σας. Πατήστε «Εκτύπωση» ή
              «Αποθήκευση PDF» και επιλέξτε <em>«Αποθήκευση ως PDF»</em> στον διάλογο
              εκτύπωσης του browser. Με «Επαναφορά» επιστρέφετε στο πρότυπο κείμενο.
            </Typography>
          </Card>

          {TEMPLATES.map(meta => (
            <TemplateAccordion
              key={meta.key}
              meta={meta}
              agency={p}
              opened={opened}
              onToggle={setOpened}
            />
          ))}
        </>
      )}
    </Box>
  );
}

/* ---------------------- Reusable accordion + preview ---------------------- */

function TemplateAccordion({
  meta, agency, opened, onToggle
}: {
  meta: TemplateMeta;
  agency: AgencyProfile;
  opened: TemplateKey | false;
  onToggle: (v: TemplateKey | false) => void;
}) {
  const storageKey = STORAGE_PREFIX + meta.key;
  const defaultText = useMemo(() => meta.build(agency), [meta, agency]);

  // Load persisted override on mount. Falls back to defaultText when none.
  const [text, setText] = useState<string>(defaultText);
  const [hasOverride, setHasOverride] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    if (stored) { setText(stored); setHasOverride(true); }
    else       { setText(defaultText); setHasOverride(false); }
  }, [storageKey, defaultText]);

  const beginEdit = () => { setDraft(text); setEditing(true); };
  const cancelEdit = () => { setEditing(false); };
  const saveEdit = () => {
    setText(draft);
    try {
      localStorage.setItem(storageKey, draft);
      setHasOverride(true);
      setNotice("Το έντυπο αποθηκεύτηκε τοπικά στον browser του γραφείου σας.");
      setTimeout(() => setNotice(null), 3000);
    } catch { setNotice("Δεν ήταν δυνατή η αποθήκευση (localStorage)."); }
    setEditing(false);
  };
  const resetToDefault = () => {
    if (!confirm("Επαναφορά του εντύπου στο αρχικό πρότυπο κείμενο; Οι αλλαγές σας θα χαθούν.")) return;
    localStorage.removeItem(storageKey);
    setText(defaultText);
    setHasOverride(false);
    setEditing(false);
    setNotice("Το έντυπο επαναφέρθηκε στην προεπιλογή.");
    setTimeout(() => setNotice(null), 3000);
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  // Renders the template into a hidden iframe and fires the browser's print
  // dialog against it. The dialog offers "Save as PDF" natively on all
  // modern browsers, so we don't need a client-side PDF library.
  const printOrPdf = (mode: "print" | "pdf") => {
    const safeTitle = meta.title.replace(/[<>&"']/g, "");
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="el"><head><meta charset="utf-8" /><title>${safeTitle}</title>
<style>
  @page { size: A4 portrait; margin: 16mm 14mm; }
  html, body { margin: 0; padding: 0; color: #0b2545; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { padding: 8px 10px; }
  h1 { font-size: 18px; color: #0b2545; margin: 0 0 12px; letter-spacing: 0.2px; border-bottom: 2px solid #0b2545; padding-bottom: 6px; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 11.5px; line-height: 1.7; margin: 0; }
  footer { margin-top: 18px; font-size: 9px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 6px; text-align: center; }
</style>
</head><body><main>
  <h1>${safeTitle}</h1>
  <pre>${escaped}</pre>
  <footer>Δημιουργήθηκε από το Kalypsis · https://mykalypsis.gr</footer>
</main></body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed"; iframe.style.right = "0"; iframe.style.bottom = "0";
    iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
    iframe.style.opacity = "0"; iframe.style.pointerEvents = "none";
    let printed = false;
    iframe.addEventListener("load", () => {
      if (printed) return;
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc?.body || doc.body.children.length === 0) return;
      printed = true;
      try {
        win.addEventListener("afterprint", () => setTimeout(() => iframe.remove(), 500), { once: true });
        win.focus();
        win.print();
      } catch { iframe.remove(); }
    });
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    if (mode === "pdf") {
      setNotice("Στον διάλογο εκτύπωσης επιλέξτε «Save as PDF» / «Αποθήκευση ως PDF».");
      setTimeout(() => setNotice(null), 5000);
    }
  };

  return (
    <Accordion
      expanded={opened === meta.key}
      onChange={(_, exp) => onToggle(exp ? meta.key : false)}
      sx={{ mb: 1 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography fontWeight={700}>{meta.title}</Typography>
            {hasOverride && <Chip size="small" color="warning" variant="outlined" label="Προσαρμοσμένο" />}
          </Stack>
          <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
            <Chip size="small" label={meta.legalBase} color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary">{meta.when}</Typography>
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
          {!editing ? (
            <>
              <Button size="small" startIcon={<EditIcon />} variant="outlined" onClick={beginEdit}>
                Επεξεργασία
              </Button>
              <Button size="small" startIcon={<PrintIcon />} variant="contained" onClick={() => printOrPdf("print")}>
                Εκτύπωση
              </Button>
              <Button size="small" startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={() => printOrPdf("pdf")}>
                Αποθήκευση PDF
              </Button>
              <Button size="small" startIcon={<ContentCopyIcon />} variant="outlined"
                onClick={doCopy}
                color={copied ? "success" : "primary"}>
                {copied ? "Αντιγράφηκε" : "Αντιγραφή κειμένου"}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Tooltip title={hasOverride ? "Αναιρεί τις αποθηκευμένες αλλαγές σας" : "Ήδη στο πρότυπο κείμενο"}>
                <span>
                  <Button size="small" startIcon={<RestartAltIcon />} variant="outlined" color="error"
                    disabled={!hasOverride} onClick={resetToDefault}>
                    Επαναφορά προεπιλογής
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <Button size="small" startIcon={<SaveIcon />} variant="contained" color="success" onClick={saveEdit}>
                Αποθήκευση
              </Button>
              <Button size="small" variant="outlined" onClick={cancelEdit}>
                Άκυρο
              </Button>
            </>
          )}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {editing ? (
          <TextField
            fullWidth multiline minRows={22} value={draft}
            onChange={e => setDraft(e.target.value)}
            InputProps={{
              sx: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, lineHeight: 1.55 }
            }}
          />
        ) : (
          <Box sx={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#0b2545"
          }}>
            {text}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/* ---------------------- Template content builders ---------------------- */

function agencyHeader(p: AgencyProfile): string {
  const tte = p.tteRegistrationNumber
    ? `Αρ. Μητρώου ΤτΕ: ${p.tteRegistrationNumber}${p.tteRegistrationYear ? ` (${p.tteRegistrationYear})` : ""}`
    : "Αρ. Μητρώου ΤτΕ: [ΣΥΜΠΛΗΡΩΣΤΕ]";
  return [
    p.name,
    p.addressLine ?? "[Διεύθυνση]",
    p.vatNumber ? `ΑΦΜ: ${p.vatNumber}` : "ΑΦΜ: [ΣΥΜΠΛΗΡΩΣΤΕ]",
    tte,
    p.contactEmail ? `Email: ${p.contactEmail}` : "Email: [ΣΥΜΠΛΗΡΩΣΤΕ]",
    p.contactPhone ? `Τηλ.: ${p.contactPhone}` : "",
  ].filter(Boolean).join("\n");
}

function buildGdpr13Text(p: AgencyProfile): string {
  return `ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΠΡΟΣΩΠΙΚΩΝ ΔΕΔΟΜΕΝΩΝ
(Άρθρο 13 GDPR — Κανονισμός (ΕΕ) 2016/679)

ΥΠΕΥΘΥΝΟΣ ΕΠΕΞΕΡΓΑΣΙΑΣ:
${agencyHeader(p)}

1. ΣΤΟΙΧΕΙΑ ΠΟΥ ΣΥΛΛΕΓΟΥΜΕ
Στοιχεία ταυτοποίησης (ονοματεπώνυμο, ΑΦΜ, ΑΜΚΑ, αρ. ταυτότητας/διαβατηρίου,
δίπλωμα οδήγησης), επικοινωνίας (email, τηλέφωνα, διεύθυνση), οικονομικά
(IBAN, ασφαλιστικές οφειλές), ασφαλιστικά (κάλυψη, ζημιές). Για συμβόλαια
Ζωής/Υγείας ενδέχεται να ζητηθούν και δεδομένα υγείας (ειδική κατηγορία —
Άρθρο 9 GDPR) βάσει ξεχωριστής ρητής συγκατάθεσης.

2. ΣΚΟΠΟΙ & ΝΟΜΙΚΗ ΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ
α) Παροχή υπηρεσιών ασφαλιστικής διαμεσολάβησης — εκτέλεση σύμβασης
   (Άρθρο 6§1 στοιχ. β GDPR).
β) Συμμόρφωση με νομικές υποχρεώσεις (φορολογικές, AML/KYC) —
   Άρθρο 6§1 στοιχ. γ GDPR.
γ) Έννομο συμφέρον για διαχείριση σχέσης και βελτίωση υπηρεσιών —
   Άρθρο 6§1 στοιχ. στ GDPR.
δ) Marketing επικοινωνία — βάσει ρητής συγκατάθεσής σας (ανακλητή ανά πάσα
   στιγμή).

3. ΑΠΟΔΕΚΤΕΣ ΤΩΝ ΔΕΔΟΜΕΝΩΝ
- Ασφαλιστικές εταιρείες με τις οποίες συνεργαζόμαστε, μόνο όσον αφορά τα
  δικά τους συμβόλαια.
- Πάροχος τεχνολογίας «Kalypsis» (Παναγιώτης Κοτσοργιός, Μεσολόγγι) —
  ενεργεί ως Εκτελών την Επεξεργασία δυνάμει σύμβασης του Άρθρου 28 GDPR,
  με υποδομή cloud εντός ΕΟΧ (Hetzner, Γερμανία).
- Πάροχος αποστολής email «Brevo» (Γαλλία), μόνο για επικοινωνία.
- Αρμόδιες αρχές όπου το απαιτεί ο νόμος (ΑΑΔΕ, ΤτΕ, ΑΠΔΠΧ).

4. ΔΙΑΒΙΒΑΣΕΙΣ ΕΚΤΟΣ ΕΟΧ
Δεν πραγματοποιούνται τακτικές διαβιβάσεις εκτός Ευρωπαϊκού Οικονομικού
Χώρου. Έκτακτες διαβιβάσεις γίνονται μόνο με τις εγγυήσεις του Άρθρου 46 GDPR.

5. ΔΙΑΡΚΕΙΑ ΔΙΑΤΗΡΗΣΗΣ
Τα δεδομένα διατηρούνται όσο ισχύει η ασφαλιστική σχέση και για 10 έτη μετά
τη λήξη, βάσει του Ν. 4308/2014 (φορολογικές υποχρεώσεις) και της γενικής
παραγραφής των αξιώσεων.

6. ΔΙΚΑΙΩΜΑΤΑ ΣΑΣ (Άρθρα 15-22 GDPR)
- Πρόσβαση στα δεδομένα σας.
- Διόρθωση ανακριβών δεδομένων.
- Διαγραφή («δικαίωμα στη λήθη»), όπου δεν συγκρούεται με νομικές
  υποχρεώσεις διατήρησης.
- Περιορισμός επεξεργασίας.
- Φορητότητα σε δομημένο μηχαναγνώσιμο μορφότυπο.
- Εναντίωση σε επεξεργασία βάσει έννομου συμφέροντος.
- Ανάκληση συγκατάθεσης, χωρίς αναδρομική επίπτωση.

Άσκηση δικαιωμάτων: ${p.contactEmail ?? "[email γραφείου]"}

Καταγγελία στην ΑΠΔΠΧ:
Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα, Κηφισίας 1-3, 115 23 Αθήνα,
τηλ. 210 6475600, complaints@dpa.gr

7. ΥΠΟΧΡΕΩΤΙΚΟΣ ΧΑΡΑΚΤΗΡΑΣ ΠΑΡΟΧΗΣ ΔΕΔΟΜΕΝΩΝ
Η παροχή των στοιχείων που ζητούνται είναι αναγκαία για τη σύναψη και
εκτέλεση της ασφαλιστικής σύμβασης. Άρνηση παροχής συνεπάγεται αδυναμία
παροχής της υπηρεσίας.

Ημερομηνία: ....../....../..........      Ο/Η πελάτης/-ισσα:
                                            (Ονοματεπώνυμο & Υπογραφή)

_____________________________              _____________________________
`;
}

function buildGdpr9Text(p: AgencyProfile): string {
  return `ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ΔΕΔΟΜΕΝΩΝ ΥΓΕΙΑΣ
(Άρθρο 9§2 στοιχ. α GDPR — Ειδικές Κατηγορίες Δεδομένων)

ΥΠΕΥΘΥΝΟΣ ΕΠΕΞΕΡΓΑΣΙΑΣ:
${agencyHeader(p)}

Ο/Η υπογράφων/-ουσα:

Ονοματεπώνυμο: __________________________________________________

ΑΜΚΑ: ___________________________  ΑΦΜ: _________________________

ΔΗΛΩΝΩ ΡΗΤΩΣ ΚΑΙ ΕΝ ΕΠΙΓΝΩΣΕΙ ΟΤΙ:

Συναινώ ελεύθερα, ρητά και ενημερωμένα στη συλλογή και επεξεργασία των
δεδομένων μου που αφορούν την υγεία μου (ιατρικό ιστορικό, εργαστηριακές
εξετάσεις, διαγνώσεις, νοσηλείες, φαρμακευτική αγωγή), από τον Υπεύθυνο
Επεξεργασίας και τις συνεργαζόμενες ασφαλιστικές εταιρείες, αποκλειστικά
για τους παρακάτω σκοπούς:

α) Αξιολόγηση του κινδύνου και σύναψη ασφαλιστικού συμβολαίου Ζωής /
   Υγείας / Ατυχημάτων.
β) Εξέταση αιτημάτων αποζημίωσης / πληρωμής ασφαλιστικού ποσού.
γ) Συμμόρφωση με νομικές υποχρεώσεις που σχετίζονται με τα ανωτέρω.

Έχω ενημερωθεί ότι:
- Η συγκατάθεσή μου είναι ελεύθερη και ρητή, και μπορώ να την ανακαλέσω
  οποτεδήποτε χωρίς αναδρομική επίπτωση, με έγγραφη δήλωση στο ${p.contactEmail ?? "[email γραφείου]"}.
- Χωρίς τη συγκατάθεσή μου δεν είναι εφικτή η σύναψη ή η εξέλιξη του
  συμβολαίου Ζωής/Υγείας/Ατυχημάτων.
- Έχω δικαίωμα πρόσβασης, διόρθωσης, περιορισμού και διαγραφής των
  δεδομένων μου (Άρθρα 15-22 GDPR).

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη:  _______________________________

(Για ανηλίκους: Υπογραφή κηδεμόνα)
`;
}

function buildIddText(p: AgencyProfile): string {
  return `ΑΝΑΛΥΣΗ ΑΠΑΙΤΗΣΕΩΝ & ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ
(Ν. 4583/2018 Άρθρο 27 — Insurance Distribution Directive)

ΑΣΦΑΛΙΣΤΙΚΟΣ ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ:
${agencyHeader(p)}

Α. ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ
Ονοματεπώνυμο: __________________________________________________
ΑΦΜ: _____________________  Τηλέφωνο: __________________________
Email: ____________________________________________________________

Β. ΔΗΛΩΘΕΙΣΕΣ ΑΝΑΓΚΕΣ ΠΕΛΑΤΗ
Ο πελάτης δήλωσε ότι επιθυμεί κάλυψη για:

 [ ] Αυτοκίνητο / Δίκυκλο           [ ] Ζωή / Ατύχημα
 [ ] Κατοικία / Πυρός                [ ] Υγεία / Νοσοκομειακό
 [ ] Επιχείρηση                      [ ] Ταξιδιωτική
 [ ] Αστική Ευθύνη                   [ ] Νομική Προστασία
 [ ] Άλλο: ______________________________________________________

Ειδικές απαιτήσεις / προτεραιότητες:
_____________________________________________________________________
_____________________________________________________________________

Γ. ΓΝΩΣΕΙΣ & ΕΜΠΕΙΡΙΑ (μόνο για επενδυτικά προϊόντα ΖΩΗΣ, IBIP)
Προηγούμενη εμπειρία σε επενδυτικά:  [ ] Καμία  [ ] Περιορισμένη  [ ] Σημαντική
Ανοχή σε επενδυτικό ρίσκο:   [ ] Χαμηλή  [ ] Μεσαία  [ ] Υψηλή

Δ. ΠΡΟΤΕΙΝΟΜΕΝΟ ΠΡΟΪΟΝ
Ασφαλιστική εταιρεία: _____________________________________________
Προϊόν / Πακέτο: __________________________________________________
Ετήσιο ασφάλιστρο: ___________________ €
Βασικές καλύψεις:
_____________________________________________________________________
_____________________________________________________________________

Ε. ΑΙΤΙΟΛΟΓΗΣΗ ΚΑΤΑΛΛΗΛΟΤΗΤΑΣ
Το προτεινόμενο προϊόν καλύπτει τις δηλωθείσες ανάγκες του πελάτη διότι:
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

ΣΤ. ΔΗΛΩΣΕΙΣ ΠΕΛΑΤΗ

 [ ] Έχω παραλάβει το τυποποιημένο έντυπο πληροφοριών IPID από τον
     διαμεσολαβητή.
 [ ] Έχω κατανοήσει τα βασικά χαρακτηριστικά, τους όρους και τις εξαιρέσεις
     του προϊόντος.
 [ ] Δηλώνω ότι όλα τα στοιχεία που έδωσα είναι αληθή και πλήρη.

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη: ____________________     Υπογραφή Διαμεσολαβητή: ____________________
`;
}

function buildAmlText(p: AgencyProfile): string {
  return `ΔΗΛΩΣΗ ΠΡΑΓΜΑΤΙΚΟΥ ΔΙΚΑΙΟΥΧΟΥ & ΠΗΓΗΣ ΧΡΗΜΑΤΩΝ
(Ν. 4557/2018 — Πρόληψη & Καταστολή Νομιμοποίησης Εσόδων από Εγκληματικές
Δραστηριότητες και Χρηματοδότησης Τρομοκρατίας)

ΑΣΦΑΛΙΣΤΙΚΟΣ ΔΙΑΜΕΣΟΛΑΒΗΤΗΣ:
${agencyHeader(p)}

Α. ΣΤΟΙΧΕΙΑ ΠΕΛΑΤΗ / ΑΝΤΙΣΥΜΒΑΛΛΟΜΕΝΟΥ
Ονοματεπώνυμο / Επωνυμία: _________________________________________
ΑΦΜ: _____________________  ΔΟΥ: _________________________________
Δ/νση: ____________________________________________________________
Επάγγελμα / Δραστηριότητα: _______________________________________

Β. ΠΡΑΓΜΑΤΙΚΟΣ ΔΙΚΑΙΟΥΧΟΣ (Άρθρο 20 Ν. 4557/2018)
Δηλώνω ότι:

 [ ] Είμαι ο πραγματικός δικαιούχος (φυσικό πρόσωπο που κατέχει ή ελέγχει
     τελικά την περιουσία / το συμβόλαιο).

 [ ] Πραγματικός δικαιούχος είναι τρίτο πρόσωπο:
     Ονοματεπώνυμο: _______________________________________________
     ΑΦΜ: _____________________ Σχέση με πελάτη: _______________________

Γ. ΠΟΛΙΤΙΚΩΣ ΕΚΤΕΘΕΙΜΕΝΟ ΠΡΟΣΩΠΟ (Politically Exposed Person)
Ο πελάτης ή ο πραγματικός δικαιούχος είναι/υπήρξε στα τελευταία 12 μήνες
πολιτικώς εκτεθειμένο πρόσωπο (πχ βουλευτής, δικαστής, ανώτατος αξιωματούχος,
στέλεχος διεθνούς οργανισμού) ή στενός συγγενής/σύνεργος τέτοιου προσώπου;

 [ ] ΟΧΙ           [ ] ΝΑΙ — Διευκρινίστε: ___________________________

Δ. ΠΗΓΗ ΧΡΗΜΑΤΩΝ ΠΟΥ ΘΑ ΧΡΗΣΙΜΟΠΟΙΗΘΟΥΝ ΓΙΑ ΤΗΝ ΠΛΗΡΩΜΗ ΑΣΦΑΛΙΣΤΡΩΝ

 [ ] Μισθός / Σύνταξη          [ ] Έσοδα επιχειρηματικής δραστηριότητας
 [ ] Αποταμιεύσεις               [ ] Πώληση περιουσιακού στοιχείου
 [ ] Κληρονομιά / Δωρεά          [ ] Έσοδα επενδύσεων
 [ ] Άλλο: _______________________________________________________

Ε. ΣΚΟΠΟΣ & ΦΥΣΗ ΤΗΣ ΕΠΙΧΕΙΡΗΜΑΤΙΚΗΣ ΣΧΕΣΗΣ
 [ ] Ασφάλιση αγαθού (αυτοκίνητο, κατοικία κτλ)
 [ ] Ασφάλιση Ζωής / Υγείας (αποταμιευτικό / επενδυτικό)
 [ ] Εταιρική ασφάλιση
 [ ] Άλλο: _______________________________________________________

Δηλώνω υπεύθυνα ότι όλα τα ανωτέρω στοιχεία είναι αληθή και ακριβή. Είμαι
ενήμερος/-η ότι τυχόν ψευδής δήλωση επισύρει τις προβλεπόμενες από τον Ν.
4557/2018 και τον Ποινικό Κώδικα κυρώσεις. Δεσμεύομαι να ενημερώσω τον
διαμεσολαβητή για κάθε μεταβολή των παραπάνω στοιχείων.

Ημερομηνία: ....../....../..........

Υπογραφή Πελάτη: ____________________     Υπογραφή Διαμεσολαβητή: ____________________
`;
}
