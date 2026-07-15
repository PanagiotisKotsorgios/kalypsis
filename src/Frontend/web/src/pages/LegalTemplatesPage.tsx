import { useRef, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, Chip,
  CircularProgress, Divider, Stack, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintIcon from "@mui/icons-material/Print";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GavelIcon from "@mui/icons-material/Gavel";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

// Νομικά templates ανά γραφείο. Κάθε γραφείο-controller έχει την υποχρέωση
// να δώσει στους πελάτες του συγκεκριμένα έντυπα ενημέρωσης + να συλλέξει
// ρητές συγκαταθέσεις όπου απαιτείται. Η σελίδα αυτή τα παρέχει έτοιμα με
// pre-fill από τα Ρυθμίσεις Γραφείου, με κουμπί Εκτύπωσης (browser print)
// και Αντιγραφής (clipboard) ώστε ο operator να τα εκτυπώσει και να τα δώσει
// στον πελάτη ή να τα ενσωματώσει σε δικό του PDF.

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

export function LegalTemplatesPage() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<string | false>("gdpr13");
  const printRef = useRef<HTMLDivElement>(null);

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

  const [copied, setCopied] = useState<string | null>(null);
  const doCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard blocked */ }
  };

  // Print μόνο του τρέχοντος template — κρύβει το υπόλοιπο app μέσω CSS class.
  const doPrint = () => window.print();

  return (
    <Box>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-target, .print-target * { visibility: visible; }
          .print-target { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Stack direction="row" alignItems="center" spacing={2} mb={3} className="no-print">
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
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }} className="no-print">
          <CircularProgress />
        </Box>
      ) : (
        <>
          {missingFields.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} className="no-print">
              {t("legalTemplates.missingFields",
                "Λείπουν στοιχεία γραφείου: {{list}}. Συμπληρώστε τα στις Ρυθμίσεις Γραφείου για πλήρη προ-γέμιση.", {
                list: missingFields.join(", ")
              })}
            </Alert>
          )}

          <Card variant="outlined" sx={{ p: 2, mb: 2 }} className="no-print">
            <Typography variant="body2" color="text.secondary">
              <strong>Οδηγία χρήσης:</strong> Ανοίξτε το έντυπο που θέλετε, πατήστε
              «Εκτύπωση» για φυσικό αντίγραφο ή «Αντιγραφή» για να το ενσωματώσετε σε
              δικό σας PDF. Κάθε έντυπο έχει pre-filled τα στοιχεία σας από τα{" "}
              <em>Ρυθμίσεις Γραφείου</em>. Παραδίδονται στον πελάτη κατά τη στιγμή
              συλλογής των δεδομένων (Άρθρο 13 GDPR).
            </Typography>
          </Card>

          <TemplateAccordion
            id="gdpr13"
            opened={opened}
            onToggle={setOpened}
            title="1. Ενημέρωση Υποκειμένου Δεδομένων"
            legalBase="Άρθρο 13 GDPR"
            when="Δίδεται σε ΚΑΘΕ πελάτη κατά τη στιγμή συλλογής των στοιχείων του."
            content={buildGdpr13Text(p)}
            copied={copied === "gdpr13"}
            onCopy={txt => doCopy("gdpr13", txt)}
            onPrint={doPrint}
            printRef={opened === "gdpr13" ? printRef : undefined}
          />

          <TemplateAccordion
            id="gdpr9"
            opened={opened}
            onToggle={setOpened}
            title="2. Ρητή Συγκατάθεση Επεξεργασίας Δεδομένων Υγείας"
            legalBase="Άρθρο 9 GDPR"
            when="Απαιτείται ΜΟΝΟ για συμβόλαια Ζωής, Υγείας, Ατυχημάτων ή όπου συλλέγονται ιατρικά δεδομένα."
            content={buildGdpr9Text(p)}
            copied={copied === "gdpr9"}
            onCopy={txt => doCopy("gdpr9", txt)}
            onPrint={doPrint}
            printRef={opened === "gdpr9" ? printRef : undefined}
          />

          <TemplateAccordion
            id="idd"
            opened={opened}
            onToggle={setOpened}
            title="3. Ανάλυση Απαιτήσεων και Αναγκών Πελάτη (Demands & Needs)"
            legalBase="Ν. 4583/2018, Άρθρο 27 (IDD)"
            when="Υποχρεωτικό για ΚΑΘΕ πρόταση ασφαλιστικού προϊόντος πριν την υπογραφή."
            content={buildIddText(p)}
            copied={copied === "idd"}
            onCopy={txt => doCopy("idd", txt)}
            onPrint={doPrint}
            printRef={opened === "idd" ? printRef : undefined}
          />

          <TemplateAccordion
            id="aml"
            opened={opened}
            onToggle={setOpened}
            title="4. Δήλωση Πραγματικού Δικαιούχου & Πηγής Χρημάτων (KYC/AML)"
            legalBase="Ν. 4557/2018 (Anti-Money Laundering)"
            when="Υποχρεωτικό για συμβόλαια Ζωής/Επενδυτικά ή συμβόλαια αξίας ≥15.000€ ετησίως."
            content={buildAmlText(p)}
            copied={copied === "aml"}
            onCopy={txt => doCopy("aml", txt)}
            onPrint={doPrint}
            printRef={opened === "aml" ? printRef : undefined}
          />
        </>
      )}
    </Box>
  );
}

/* ---------------------- Reusable accordion + preview ---------------------- */

function TemplateAccordion({
  id, opened, onToggle, title, legalBase, when, content, copied, onCopy, onPrint, printRef
}: {
  id: string;
  opened: string | false;
  onToggle: (v: string | false) => void;
  title: string;
  legalBase: string;
  when: string;
  content: string;
  copied: boolean;
  onCopy: (text: string) => void;
  onPrint: () => void;
  printRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <Accordion
      expanded={opened === id}
      onChange={(_, exp) => onToggle(exp ? id : false)}
      sx={{ mb: 1 }}
      className={opened === id ? "" : "no-print"}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} className="no-print">
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={700}>{title}</Typography>
          <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
            <Chip size="small" label={legalBase} color="primary" variant="outlined" />
            <Typography variant="caption" color="text.secondary">{when}</Typography>
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack direction="row" spacing={1} mb={2} className="no-print">
          <Button size="small" startIcon={<PrintIcon />} variant="contained"
            onClick={onPrint}>Εκτύπωση</Button>
          <Button size="small" startIcon={<ContentCopyIcon />} variant="outlined"
            onClick={() => onCopy(content)}
            color={copied ? "success" : "primary"}>
            {copied ? "Αντιγράφηκε" : "Αντιγραφή κειμένου"}
          </Button>
        </Stack>
        <Divider sx={{ mb: 2 }} className="no-print" />
        <Box
          ref={printRef}
          className="print-target"
          sx={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: 13.5,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            color: "#0b2545",
            "@media print": { fontSize: 11.5 }
          }}
        >
          {content}
        </Box>
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
  οποτεδήποτε χωρίς αναδρομική επίπτωση, με έγγραφη δήλωση στο{" "}
${p.contactEmail ?? "[email γραφείου]"}.
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
