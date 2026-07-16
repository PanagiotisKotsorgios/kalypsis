import { Alert, Box, Card, Chip, Container, Divider, Stack, Typography } from "@mui/material";
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
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useTranslation } from "react-i18next";
import type { SvgIconComponent } from "@mui/icons-material";

/*
 * Legal Hub — the single index of every legal document a γραφείο needs to
 * read + accept before using the platform. Rendered both as a public route
 * (/legal — visitor-facing, no shell) and as an authenticated route
 * (/app/legal — inside the AppShell so the operator keeps their sidebar).
 * The `basePath` prop lets App.tsx tell the hub which URL family to link to
 * so navigation stays in-shell or in-public consistently.
 *
 * Visually this is intentionally styled like a law firm's client portal:
 * dark serif header, thin rules, monospaced document IDs. It replaced the
 * earlier "marketing card" look which felt out of place for binding
 * contracts.
 */

interface LegalDoc {
  to: string;
  code: string;              // short cite for the mono ID chip (e.g. "MSA-01")
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
  {
    to: "/sub-processors",
    code: "SUB-01",
    title: "Λίστα Sub-processors",
    subtitle: "Τρίτοι πάροχοι (Hetzner, Brevo) + change log. 30-day notice πριν από κάθε αλλαγή.",
    Icon: AccountTreeIcon,
    tag: "GDPR Άρθρο 28"
  },
  {
    to: "/ropa",
    code: "ROPA-01",
    title: "Μητρώο Δραστηριοτήτων Επεξεργασίας (RoPA)",
    subtitle: "Δραστηριότητες επεξεργασίας ως Controller + Processor.",
    Icon: ListAltIcon,
    tag: "GDPR Άρθρο 30"
  },
  {
    to: "/data-retention-schedule",
    code: "RET-01",
    title: "Πίνακας Διατήρησης Δεδομένων",
    subtitle: "Ενοποιημένη λίστα περιόδων διατήρησης ανά κατηγορία με νομικές αναφορές.",
    Icon: ListAltIcon,
    tag: "GDPR Άρθρο 5(1)(ε)"
  },
  {
    to: "/complaints-policy",
    code: "COMP-01",
    title: "Διαδικασία Χειρισμού Παραπόνων",
    subtitle: "Πώς υποβάλλετε παράπονο και τι χρόνο απόκρισης θα έχετε (Ν. 4583/2018).",
    Icon: ReportProblemIcon,
    tag: "Ν. 4583/2018"
  },
  {
    to: "/security-disclosure",
    code: "SEC-01",
    title: "Πολιτική Υπεύθυνης Γνωστοποίησης Ευπαθειών",
    subtitle: "Πώς οι security researchers αναφέρουν ευπάθειες + safe-harbor.",
    Icon: BugReportIcon,
    tag: "RFC 9116"
  },
  {
    to: "/refund-policy",
    code: "REF-01",
    title: "Πολιτική Επιστροφών & Καταγγελίας Συνδρομής",
    subtitle: "30ήμερη δοκιμή, 14-day παράθυρο επιστροφής καλής θελήσεως, SLA credits.",
    Icon: MoneyOffIcon
  },
  {
    to: "/client-portal-terms",
    code: "PORT-01",
    title: "Όροι Χρήσης Πύλης Ασφαλισμένου",
    subtitle: "Ισχύουν για ασφαλισμένους που συνδέονται στην πύλη τους (όχι για γραφεία).",
    Icon: PersonOutlineIcon
  },
  {
    to: "/accessibility",
    code: "ACC-01",
    title: "Δήλωση Προσβασιμότητας",
    subtitle: "WCAG 2.1 AA — κατάσταση συμμόρφωσης, γνωστά ζητήματα, επικοινωνία.",
    Icon: AccessibilityNewIcon,
    tag: "EU 2016/2102"
  },
  {
    to: "/code-of-conduct",
    code: "COC-01",
    title: "Κώδικας Δεοντολογίας",
    subtitle: "Ακεραιότητα, anti-bribery, whistleblowing, σύγκρουση συμφερόντων.",
    Icon: WorkOutlineIcon
  },
  {
    to: "/oss-licenses",
    code: "OSS-01",
    title: "Αναγνώριση Βιβλιοθηκών Ανοικτού Κώδικα",
    subtitle: "OSS attributions για κάθε third-party βιβλιοθήκη.",
    Icon: CodeIcon
  }
];

const policies: LegalDoc[] = [
  {
    to: "/terms",
    code: "TOS-01",
    title: "Όροι Χρήσης Ιστοσελίδας",
    subtitle: "Ισχύουν για επισκέπτες του δημόσιου δικτυακού τόπου (mykalypsis.gr).",
    Icon: DescriptionOutlinedIcon
  },
  {
    to: "/privacy",
    code: "PRIV-01",
    title: "Πολιτική Απορρήτου",
    subtitle: "Πώς επεξεργαζόμαστε τα δικά σας δεδομένα (όχι των πελατών σας).",
    Icon: ShieldOutlinedIcon,
    tag: "GDPR"
  },
  {
    to: "/cookies",
    code: "COO-01",
    title: "Πολιτική Cookies",
    subtitle: "Ποια cookies χρησιμοποιούμε και πώς μπορείτε να τα ρυθμίσετε.",
    Icon: CookieIcon
  }
];

/**
 * @param basePath prefix all doc links with this string (e.g. "/app/legal"
 *   for authenticated shell, empty string for the public root). When rendered
 *   inside AppShell we prepend so clicks stay in-app; on the public route
 *   we leave it empty so /dpa stays /dpa.
 */
export function LegalHubPage({ basePath = "" }: { basePath?: string } = {}) {
  const { t } = useTranslation();

  const today = new Date().toLocaleDateString("el-GR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#f6f6f4",   // warm off-white — reads as document paper
      color: "#0b0f14",
      py: { xs: 4, md: 6 }
    }}>
      <Container maxWidth="md">
        {/* Masthead — dark serif band */}
        <Box sx={{
          bgcolor: "#0b0f14",
          color: "#f8f6f0",
          borderRadius: 0.5,
          px: { xs: 3, md: 5 },
          py: { xs: 4, md: 5 },
          mb: 5,
          borderTop: "6px solid #b08a3e"     // subtle brand rule at top
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
            <GavelIcon sx={{ fontSize: 22, color: "#b08a3e" }} />
            <Typography variant="overline"
              sx={{ letterSpacing: 3, fontWeight: 700, color: "#b08a3e", fontSize: 11 }}>
              {t("legalHub.eyebrow", "ΝΟΜΙΚΑ ΕΓΓΡΑΦΑ · KALYPSIS")}
            </Typography>
          </Stack>
          <Typography sx={{
            fontFamily: "var(--display, 'Playfair Display', 'Times New Roman', serif)",
            fontWeight: 700,
            fontSize: { xs: 32, md: 44 },
            lineHeight: 1.1,
            mb: 2
          }}>
            {t("legalHub.title", "Νομικό Πλαίσιο & Συμφωνίες Χρήστη")}
          </Typography>
          <Divider sx={{ bgcolor: "rgba(248,246,240,0.15)", mb: 2 }} />
          <Typography sx={{ color: "rgba(248,246,240,0.75)", fontSize: 15, lineHeight: 1.55 }}>
            {t("legalHub.subtitle",
              "Πριν από τη χρήση της Πλατφόρμας, το γραφείο σας οφείλει να διαβάσει και να αποδεχθεί τις παρακάτω συμβάσεις. Η αποδοχή καταγράφεται με χρονοσφραγίδα και διεύθυνση IP και συνιστά έγκυρη ηλεκτρονική υπογραφή σύμφωνα με τον Κανονισμό eIDAS (EU 910/2014) και τον Ν. 4624/2019.")}
          </Typography>
          <Stack direction="row" spacing={3} mt={2.5} sx={{ opacity: 0.6, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            <Typography variant="caption" sx={{ letterSpacing: 1.5 }}>Ισχύει από: {today}</Typography>
            <Typography variant="caption" sx={{ letterSpacing: 1.5 }}>Δικαιοδοσία: Ελλάδα</Typography>
            <Typography variant="caption" sx={{ letterSpacing: 1.5 }}>Γλώσσα: EL</Typography>
          </Stack>
        </Box>

        <SectionHeader
          number="I"
          title={t("legalHub.commercial", "Εμπορικές Συμβάσεις — Προς Αποδοχή")}
          intro={t("legalHub.commercialBody",
            "Οι κάτωθι τέσσερις συμβάσεις αποκτούν δεσμευτική ισχύ με την ηλεκτρονική αποδοχή σας εντός της Πλατφόρμας. Η αποδοχή τους καταγράφεται με χρονοσφραγίδα, διεύθυνση IP και ταυτότητα χρήστη και συνιστά μη-αποκηρύξιμη ηλεκτρονική υπογραφή.")}
        />
        <Stack spacing={1.5} mb={6}>
          {commercial.map(d => <DocRow key={d.to} doc={d} basePath={basePath} accent />)}
        </Stack>

        <SectionHeader
          number="II"
          title={t("legalHub.governance", "Πολιτικές Διακυβέρνησης & Συμμόρφωσης")}
          intro={t("legalHub.governanceBody",
            "Πλαίσιο εσωτερικών διαδικασιών και ρυθμιστικής συμμόρφωσης της Kalypsis — δημόσια αναρτημένο για λόγους διαφάνειας προς πελάτες, εποπτικές αρχές και εξωτερικούς ελεγκτές.")}
        />
        <Stack spacing={1.5} mb={6}>
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

        {/* Signature footer — reinforces the legal weight of click-through */}
        <Card sx={{
          mt: 6,
          borderRadius: 0.5,
          border: "1px solid #0b0f14",
          bgcolor: "#fff",
          p: 0
        }} elevation={0}>
          <Box sx={{ bgcolor: "#0b0f14", color: "#f8f6f0", px: 3, py: 1.5,
            display: "flex", alignItems: "center", gap: 1.5 }}>
            <VerifiedUserOutlinedIcon sx={{ color: "#b08a3e", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, letterSpacing: 1.5, fontSize: 12, textTransform: "uppercase" }}>
              {t("legalHub.summaryTitle", "Νομική Σημείωση")}
            </Typography>
          </Box>
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ lineHeight: 1.75, color: "#0b0f14" }}>
              {t("legalHub.summaryBody",
                "Η Σύμβαση Παροχής Υπηρεσιών (MSA) αποτελεί τη θεμελιώδη εμπορική συμφωνία. Το Παράρτημα Επεξεργασίας Δεδομένων (DPA) ρυθμίζει την επεξεργασία δεδομένων των πελατών σας κατά το Άρθρο 28 GDPR. Η SLA προσδιορίζει τα επίπεδα υπηρεσίας και τους μηχανισμούς αποζημίωσης. Η AUP οριοθετεί την επιτρεπόμενη χρήση. Και τα τέσσερα εν συνόλω συνιστούν την ενιαία συμβατική σχέση μεταξύ της Kalypsis και του γραφείου σας.")}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" sx={{ border: "none", bgcolor: "transparent", p: 0, "& .MuiAlert-icon": { color: "#0b0f14" } }}>
              <Typography variant="caption" sx={{ color: "#0b0f14", fontWeight: 600 }}>
                Εγκυρότητα ηλεκτρονικής υπογραφής
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: "#3a4551", fontSize: 13 }}>
                Η αποδοχή μέσω επιλογής («check-box») εντός της Πλατφόρμας συνιστά έγκυρη ηλεκτρονική
                υπογραφή κατά την έννοια του Άρθρου 3 παρ. 10 του Κανονισμού (EE) 910/2014 (eIDAS) και
                του Ν. 4624/2019. Για κάθε αποδοχή τηρείται καταγραφή του ID χρήστη, χρονοσφραγίδας UTC
                και της IP προέλευσης. Εάν το γραφείο σας απαιτεί επιπλέον φυσική υπογραφή για
                εσωτερικούς ή ελεγκτικούς λόγους, μπορείτε να κατεβάσετε αντίτυπο κάθε εγγράφου από την
                αντίστοιχη σελίδα.
              </Typography>
            </Alert>
          </Box>
        </Card>

        {/* Footer legal ID */}
        <Typography variant="caption" sx={{
          display: "block", mt: 4, textAlign: "center", color: "#3a4551",
          letterSpacing: 1.5, fontSize: 11
        }}>
          KALYPSIS PLATFORM · LEGAL FRAMEWORK · Έκδοση 1.0 · {today}
        </Typography>
      </Container>
    </Box>
  );
}

function SectionHeader({ number, title, intro }: { number: string; title: string; intro: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="baseline" spacing={2} mb={0.5}>
        <Typography sx={{
          fontFamily: "var(--display, 'Playfair Display', 'Times New Roman', serif)",
          color: "#b08a3e",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1
        }}>{number}.</Typography>
        <Typography sx={{
          fontFamily: "var(--display, 'Playfair Display', 'Times New Roman', serif)",
          color: "#0b0f14",
          fontSize: { xs: 20, md: 24 },
          fontWeight: 700
        }}>{title}</Typography>
      </Stack>
      <Divider sx={{ mb: 1.5, borderColor: "#0b0f14", opacity: 0.15 }} />
      <Typography variant="body2" sx={{ color: "#3a4551", mb: 2, fontSize: 14, lineHeight: 1.65 }}>{intro}</Typography>
    </Box>
  );
}

function DocRow({ doc, basePath, accent }: { doc: LegalDoc; basePath: string; accent?: boolean }) {
  const { Icon } = doc;
  return (
    <Card
      component={RouterLink}
      to={`${basePath}${doc.to}`}
      elevation={0}
      sx={{
        p: 2.25,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 2,
        border: "1px solid",
        borderColor: accent ? "#0b0f14" : "rgba(11,15,20,0.12)",
        borderRadius: 0.5,
        bgcolor: "#ffffff",
        transition: "all 0.15s",
        "&:hover": {
          borderColor: "#b08a3e",
          bgcolor: "#fafaf7",
          boxShadow: "0 2px 8px rgba(11,15,20,0.08)"
        }
      }}
    >
      <Box sx={{
        width: 44, height: 44, borderRadius: 0.5,
        bgcolor: accent ? "#0b0f14" : "rgba(11,15,20,0.05)",
        color: accent ? "#b08a3e" : "#0b0f14",
        display: "grid", placeItems: "center", flexShrink: 0
      }}>
        <Icon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={0.3} flexWrap="wrap">
          <Typography sx={{ fontWeight: 700, color: "#0b0f14", fontSize: 15 }}>{doc.title}</Typography>
          <Typography variant="caption" sx={{
            fontFamily: "monospace",
            color: "#3a4551",
            bgcolor: "rgba(11,15,20,0.05)",
            px: 0.75, py: 0.15, borderRadius: 0.5,
            fontSize: 10, letterSpacing: 0.5
          }}>{doc.code}</Typography>
          {doc.tag && (
            <Chip size="small" label={doc.tag}
              sx={{
                bgcolor: "transparent",
                border: "1px solid rgba(11,15,20,0.25)",
                color: "#0b0f14",
                fontSize: 11,
                height: 22,
                fontWeight: 600
              }} />
          )}
          {doc.version && (
            <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#3a4551", fontSize: 11 }}>
              {doc.version}
            </Typography>
          )}
        </Stack>
        <Typography variant="body2" sx={{ color: "#3a4551", fontSize: 13.5, lineHeight: 1.55 }}>
          {doc.subtitle}
        </Typography>
      </Box>
      <ArrowForwardIcon sx={{ color: "#3a4551" }} />
    </Card>
  );
}
