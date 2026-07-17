import { Box, Card, Chip, Container, Divider, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import GavelIcon from "@mui/icons-material/Gavel";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CookieIcon from "@mui/icons-material/Cookie";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import PolicyIcon from "@mui/icons-material/Policy";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import BugReportIcon from "@mui/icons-material/BugReport";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import CodeIcon from "@mui/icons-material/Code";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useTranslation } from "react-i18next";
import type { SvgIconComponent } from "@mui/icons-material";

/*
 * Legal Hub — plain white background, black type, no gold accents.
 * Matches the minimal single-column shell every individual policy page
 * uses, so the whole legal experience feels like one plain-text
 * document set instead of a mix of styles.
 */

interface LegalDoc {
  to: string;
  code: string;
  title: string;
  subtitle: string;
  Icon: SvgIconComponent;
  tag?: string;
  version?: string;
}

const commercial: LegalDoc[] = [
  {
    to: "/subscription-agreement",
    code: "MSA-01",
    title: "Σύμβαση Παροχής Υπηρεσιών Πλατφόρμας",
    subtitle: "Η κύρια εμπορική σύμβαση: όροι παροχής, οικονομικά, διάρκεια, εγγυήσεις, ευθύνη, δωσιδικία.",
    Icon: HandshakeIcon,
    tag: "Master Agreement",
    version: "v1.0"
  },
  {
    to: "/dpa",
    code: "DPA-01",
    title: "Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων (DPA)",
    subtitle: "Άρθρο 28 GDPR. Καθορίζει τη σχέση Kalypsis-Processor / Γραφείο-Controller για τα δεδομένα των πελατών σας.",
    Icon: ShieldOutlinedIcon,
    tag: "GDPR Art. 28",
    version: "v1.0"
  },
  {
    to: "/sla",
    code: "SLA-01",
    title: "Συμφωνία Επιπέδου Υπηρεσίας (SLA)",
    subtitle: "Διαθεσιμότητα ≥99,5% μηνιαία, χρόνοι απόκρισης υποστήριξης ανά σοβαρότητα, backups, credits.",
    Icon: CloudDoneIcon,
    tag: "Παράρτημα MSA",
    version: "v1.0"
  },
  {
    to: "/acceptable-use",
    code: "AUP-01",
    title: "Πολιτική Αποδεκτής Χρήσης (AUP)",
    subtitle: "Τι επιτρέπεται και τι όχι στην Πλατφόρμα. Παραβίαση = άμεση αναστολή.",
    Icon: PolicyIcon,
    tag: "Παράρτημα MSA",
    version: "v1.0"
  }
];

const governance: LegalDoc[] = [
  { to: "/sub-processors", code: "SUB-01", title: "Λίστα Sub-processors",
    subtitle: "Τρίτοι πάροχοι (Hetzner, Brevo) + change log. 30-day notice πριν από κάθε αλλαγή.",
    Icon: AccountTreeIcon, tag: "GDPR Άρθρο 28" },
  { to: "/ropa", code: "ROPA-01", title: "Μητρώο Δραστηριοτήτων Επεξεργασίας (RoPA)",
    subtitle: "Δραστηριότητες επεξεργασίας ως Controller + Processor.",
    Icon: ListAltIcon, tag: "GDPR Άρθρο 30" },
  { to: "/data-retention-schedule", code: "RET-01", title: "Πίνακας Διατήρησης Δεδομένων",
    subtitle: "Ενοποιημένη λίστα περιόδων διατήρησης ανά κατηγορία με νομικές αναφορές.",
    Icon: ListAltIcon, tag: "GDPR Άρθρο 5(1)(ε)" },
  { to: "/complaints-policy", code: "COMP-01", title: "Διαδικασία Χειρισμού Παραπόνων",
    subtitle: "Πώς υποβάλλετε παράπονο και τι χρόνο απόκρισης θα έχετε (Ν. 4583/2018).",
    Icon: ReportProblemIcon, tag: "Ν. 4583/2018" },
  { to: "/security-disclosure", code: "SEC-01", title: "Πολιτική Υπεύθυνης Γνωστοποίησης Ευπαθειών",
    subtitle: "Πώς οι security researchers αναφέρουν ευπάθειες + safe-harbor.",
    Icon: BugReportIcon, tag: "RFC 9116" },
  { to: "/refund-policy", code: "REF-01", title: "Πολιτική Επιστροφών & Καταγγελίας Συνδρομής",
    subtitle: "30ήμερη δοκιμή, 14-day παράθυρο επιστροφής καλής θελήσεως, SLA credits.",
    Icon: MoneyOffIcon },
  { to: "/client-portal-terms", code: "PORT-01", title: "Όροι Χρήσης Πύλης Ασφαλισμένου",
    subtitle: "Ισχύουν για ασφαλισμένους που συνδέονται στην πύλη τους (όχι για γραφεία).",
    Icon: PersonOutlineIcon },
  { to: "/accessibility", code: "ACC-01", title: "Δήλωση Προσβασιμότητας",
    subtitle: "WCAG 2.1 AA — κατάσταση συμμόρφωσης, γνωστά ζητήματα, επικοινωνία.",
    Icon: AccessibilityNewIcon, tag: "EU 2016/2102" },
  { to: "/code-of-conduct", code: "COC-01", title: "Κώδικας Δεοντολογίας",
    subtitle: "Ακεραιότητα, anti-bribery, whistleblowing, σύγκρουση συμφερόντων.",
    Icon: WorkOutlineIcon },
  { to: "/oss-licenses", code: "OSS-01", title: "Αναγνώριση Βιβλιοθηκών Ανοικτού Κώδικα",
    subtitle: "OSS attributions για κάθε third-party βιβλιοθήκη.",
    Icon: CodeIcon }
];

const policies: LegalDoc[] = [
  { to: "/terms", code: "TOS-01", title: "Όροι Χρήσης Ιστοσελίδας",
    subtitle: "Ισχύουν για επισκέπτες του δημόσιου δικτυακού τόπου (mykalypsis.gr).",
    Icon: DescriptionOutlinedIcon },
  { to: "/privacy", code: "PRIV-01", title: "Πολιτική Απορρήτου",
    subtitle: "Πώς επεξεργαζόμαστε τα δικά σας δεδομένα (όχι των πελατών σας).",
    Icon: ShieldOutlinedIcon, tag: "GDPR" },
  { to: "/cookies", code: "COO-01", title: "Πολιτική Cookies",
    subtitle: "Ποια cookies χρησιμοποιούμε και πώς μπορείτε να τα ρυθμίσετε.",
    Icon: CookieIcon }
];

/**
 * @param basePath prefix all doc links with this string (e.g. "/app/legal"
 *   for authenticated shell, empty string for the public root).
 */
export function LegalHubPage({ basePath = "" }: { basePath?: string } = {}) {
  const { t } = useTranslation();
  const today = new Date().toLocaleDateString("el-GR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#ffffff",
      color: "#000000",
      py: { xs: 4, md: 6 }
    }}>
      <Container maxWidth="md">
        {/* Masthead — plain, no dark bar, no gold rule */}
        <Box sx={{ mb: 5 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <GavelIcon sx={{ fontSize: 20, color: "#000" }} />
            <Typography sx={{
              fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
              color: "#000", fontWeight: 700
            }}>
              {t("legalHub.eyebrow", "ΝΟΜΙΚΑ ΕΓΓΡΑΦΑ · KALYPSIS")}
            </Typography>
          </Stack>
          <Typography component="h1" sx={{
            fontWeight: 800,
            fontSize: { xs: 32, md: 44 },
            lineHeight: 1.15,
            mb: 2, color: "#000"
          }}>
            {t("legalHub.title", "Νομικό Πλαίσιο & Συμφωνίες Χρήστη")}
          </Typography>
          <Typography sx={{ color: "#000", fontSize: { xs: 16, md: 17 }, lineHeight: 1.65, mb: 2 }}>
            {t("legalHub.subtitle",
              "Πριν από τη χρήση της Πλατφόρμας, το γραφείο σας οφείλει να διαβάσει και να αποδεχθεί τις παρακάτω συμβάσεις. Η αποδοχή καταγράφεται με χρονοσφραγίδα και διεύθυνση IP και συνιστά έγκυρη ηλεκτρονική υπογραφή σύμφωνα με τον Κανονισμό eIDAS (EU 910/2014) και τον Ν. 4624/2019.")}
          </Typography>
          <Stack direction="row" spacing={2.5} sx={{ fontSize: 13, color: "#000" }} flexWrap="wrap">
            <span><strong>Ισχύει από:</strong> {today}</span>
            <span><strong>Δικαιοδοσία:</strong> Ελλάδα</span>
            <span><strong>Γλώσσα:</strong> EL</span>
          </Stack>
          <Divider sx={{ mt: 3, borderColor: "#000" }} />
        </Box>

        <SectionHeader
          number="I"
          title={t("legalHub.commercial", "Εμπορικές Συμβάσεις — Προς Αποδοχή")}
          intro={t("legalHub.commercialBody",
            "Οι κάτωθι τέσσερις συμβάσεις αποκτούν δεσμευτική ισχύ με την ηλεκτρονική αποδοχή σας εντός της Πλατφόρμας. Η αποδοχή τους καταγράφεται με χρονοσφραγίδα, διεύθυνση IP και ταυτότητα χρήστη και συνιστά μη-αποκηρύξιμη ηλεκτρονική υπογραφή.")}
        />
        <Stack spacing={1.5} mb={5}>
          {commercial.map(d => <DocRow key={d.to} doc={d} basePath={basePath} />)}
        </Stack>

        <SectionHeader
          number="II"
          title={t("legalHub.governance", "Πολιτικές Διακυβέρνησης & Συμμόρφωσης")}
          intro={t("legalHub.governanceBody",
            "Πλαίσιο εσωτερικών διαδικασιών και ρυθμιστικής συμμόρφωσης της Kalypsis — δημόσια αναρτημένο για λόγους διαφάνειας προς πελάτες, εποπτικές αρχές και εξωτερικούς ελεγκτές.")}
        />
        <Stack spacing={1.5} mb={5}>
          {governance.map(d => <DocRow key={d.to} doc={d} basePath={basePath} />)}
        </Stack>

        <SectionHeader
          number="III"
          title={t("legalHub.policies", "Δημόσιες Πολιτικές Ιστοσελίδας")}
          intro={t("legalHub.policiesBody",
            "Ισχύουν για κάθε επισκέπτη του δημόσιου δικτυακού τόπου, ανεξαρτήτως τυχόν εμπορικής σχέσης με την Kalypsis.")}
        />
        <Stack spacing={1.5}>
          {policies.map(d => <DocRow key={d.to} doc={d} basePath={basePath} />)}
        </Stack>

        {/* Signature footer — plain black on white */}
        <Box sx={{ mt: 6, pt: 4, borderTop: "1px solid #000" }}>
          <Typography sx={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase",
            fontWeight: 700, mb: 1.5, color: "#000" }}>
            {t("legalHub.summaryTitle", "Νομική Σημείωση")}
          </Typography>
          <Typography sx={{ fontSize: { xs: 15, md: 16 }, lineHeight: 1.7, color: "#000", mb: 2.5 }}>
            {t("legalHub.summaryBody",
              "Η Σύμβαση Παροχής Υπηρεσιών (MSA) αποτελεί τη θεμελιώδη εμπορική συμφωνία. Το Παράρτημα Επεξεργασίας Δεδομένων (DPA) ρυθμίζει την επεξεργασία δεδομένων των πελατών σας κατά το Άρθρο 28 GDPR. Η SLA προσδιορίζει τα επίπεδα υπηρεσίας και τους μηχανισμούς αποζημίωσης. Η AUP οριοθετεί την επιτρεπόμενη χρήση. Και τα τέσσερα εν συνόλω συνιστούν την ενιαία συμβατική σχέση μεταξύ της Kalypsis και του γραφείου σας.")}
          </Typography>
          <Box sx={{ p: 2, border: "1px solid #000" }}>
            <Typography sx={{ fontSize: 13, color: "#000", fontWeight: 700, mb: 0.75 }}>
              Εγκυρότητα ηλεκτρονικής υπογραφής
            </Typography>
            <Typography sx={{ fontSize: 14, color: "#000", lineHeight: 1.6 }}>
              Η αποδοχή μέσω επιλογής («check-box») εντός της Πλατφόρμας συνιστά έγκυρη ηλεκτρονική
              υπογραφή κατά την έννοια του Άρθρου 3 παρ. 10 του Κανονισμού (EE) 910/2014 (eIDAS) και
              του Ν. 4624/2019. Για κάθε αποδοχή τηρείται καταγραφή του ID χρήστη, χρονοσφραγίδας UTC
              και της IP προέλευσης. Εάν το γραφείο σας απαιτεί επιπλέον φυσική υπογραφή για
              εσωτερικούς ή ελεγκτικούς λόγους, μπορείτε να κατεβάσετε αντίτυπο κάθε εγγράφου από την
              αντίστοιχη σελίδα.
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ display: "block", mt: 4, textAlign: "center",
          color: "#000", letterSpacing: 1.5, fontSize: 11 }}>
          KALYPSIS PLATFORM · LEGAL FRAMEWORK · Έκδοση 1.0 · {today}
        </Typography>
      </Container>
    </Box>
  );
}

function SectionHeader({ number, title, intro }: { number: string; title: string; intro: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="baseline" spacing={1.5} mb={1}>
        <Typography sx={{ color: "#000", fontSize: 22, fontWeight: 800 }}>{number}.</Typography>
        <Typography component="h2" sx={{ color: "#000", fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}>
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 1.5, borderColor: "#000" }} />
      <Typography sx={{ color: "#000", mb: 2, fontSize: { xs: 15, md: 16 }, lineHeight: 1.65 }}>
        {intro}
      </Typography>
    </Box>
  );
}

function DocRow({ doc, basePath }: { doc: LegalDoc; basePath: string }) {
  const { Icon } = doc;
  return (
    <Card
      component={RouterLink}
      to={`${basePath}${doc.to}`}
      elevation={0}
      sx={{
        p: 2.25,
        textDecoration: "none",
        color: "#000",
        display: "flex",
        alignItems: "center",
        gap: 2,
        border: "1px solid #000",
        borderRadius: 0.5,
        bgcolor: "#ffffff",
        transition: "background-color 0.15s",
        "&:hover": { bgcolor: "#f5f5f5" }
      }}
    >
      <Box sx={{
        width: 40, height: 40, borderRadius: 0.5,
        border: "1px solid #000",
        color: "#000",
        display: "grid", placeItems: "center", flexShrink: 0
      }}>
        <Icon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={0.5} flexWrap="wrap">
          <Typography sx={{ fontWeight: 800, color: "#000", fontSize: { xs: 16, md: 17 } }}>
            {doc.title}
          </Typography>
          <Typography sx={{
            fontFamily: "monospace", color: "#000",
            border: "1px solid #000",
            px: 0.75, py: 0.15, borderRadius: 0.5,
            fontSize: 10, letterSpacing: 0.5, fontWeight: 700
          }}>
            {doc.code}
          </Typography>
          {doc.tag && (
            <Chip size="small" label={doc.tag}
              sx={{ bgcolor: "transparent", border: "1px solid #000",
                color: "#000", fontSize: 11, height: 22, fontWeight: 600 }} />
          )}
          {doc.version && (
            <Typography sx={{ fontFamily: "monospace", color: "#000", fontSize: 11, fontWeight: 700 }}>
              {doc.version}
            </Typography>
          )}
        </Stack>
        <Typography sx={{ color: "#000", fontSize: { xs: 14, md: 15 }, lineHeight: 1.6 }}>
          {doc.subtitle}
        </Typography>
      </Box>
      <ArrowForwardIcon sx={{ color: "#000" }} />
    </Card>
  );
}
