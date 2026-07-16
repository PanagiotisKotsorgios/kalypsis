import { Box, Card, Chip, Container, Stack, Typography } from "@mui/material";
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

// Legal Hub — μοναδικό σημείο ανάγνωσης όλων των νομικών εγγράφων
// πριν κάθε γραφείο αρχίσει να χρησιμοποιεί την πλατφόρμα. Public route,
// προσβάσιμο και σε επισκέπτες που θέλουν να δουν τι υπογράφουν πριν την
// εγγραφή.
//
// Ομαδοποίηση:
//   Α. ΕΜΠΟΡΙΚΕΣ ΣΥΜΒΑΣΕΙΣ — τα «signable»: MSA + DPA + SLA + AUP
//   Β. ΠΟΛΙΤΙΚΕΣ ΤΡΙΤΩΝ — Terms of Use / Privacy / Cookies (για επισκέπτες)

interface LegalDoc {
  to: string;
  title: string;
  subtitle: string;
  Icon: SvgIconComponent;
  tag?: string;
  version?: string;
}

const commercial: LegalDoc[] = [
  {
    to: "/subscription-agreement",
    title: "Σύμβαση Παροχής Υπηρεσιών Πλατφόρμας",
    subtitle: "Η κύρια εμπορική σύμβαση: όροι παροχής, οικονομικά, διάρκεια, εγγυήσεις, ευθύνη, δωσιδικία.",
    Icon: HandshakeIcon,
    tag: "Master Agreement",
    version: "v1.0"
  },
  {
    to: "/dpa",
    title: "Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων (DPA)",
    subtitle: "Άρθρο 28 GDPR. Καθορίζει τη σχέση Kalypsis-Processor / Γραφείο-Controller για τα δεδομένα των πελατών σας.",
    Icon: ShieldOutlinedIcon,
    tag: "GDPR Art. 28",
    version: "v1.0"
  },
  {
    to: "/sla",
    title: "Συμφωνία Επιπέδου Υπηρεσίας (SLA)",
    subtitle: "Διαθεσιμότητα ≥99,5% μηνιαία, χρόνοι απόκρισης υποστήριξης ανά σοβαρότητα, backups, credits.",
    Icon: CloudDoneIcon,
    tag: "Παράρτημα MSA",
    version: "v1.0"
  },
  {
    to: "/acceptable-use",
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
    title: "Λίστα Sub-processors",
    subtitle: "Τρίτοι πάροχοι (Hetzner, Brevo) + change log. 30-day notice πριν από κάθε αλλαγή.",
    Icon: AccountTreeIcon,
    tag: "GDPR Άρθρο 28"
  },
  {
    to: "/ropa",
    title: "Μητρώο Δραστηριοτήτων Επεξεργασίας (RoPA)",
    subtitle: "Δραστηριότητες επεξεργασίας ως Controller + Processor.",
    Icon: ListAltIcon,
    tag: "GDPR Άρθρο 30"
  },
  {
    to: "/data-retention-schedule",
    title: "Πίνακας Διατήρησης Δεδομένων",
    subtitle: "Ενοποιημένη λίστα περιόδων διατήρησης ανά κατηγορία με νομικές αναφορές.",
    Icon: ListAltIcon,
    tag: "GDPR Άρθρο 5(1)(ε)"
  },
  {
    to: "/complaints-policy",
    title: "Διαδικασία Χειρισμού Παραπόνων",
    subtitle: "Πώς υποβάλλετε παράπονο και τι χρόνο απόκρισης θα έχετε (Ν. 4583/2018).",
    Icon: ReportProblemIcon,
    tag: "Ν. 4583/2018"
  },
  {
    to: "/security-disclosure",
    title: "Πολιτική Υπεύθυνης Γνωστοποίησης Ευπαθειών",
    subtitle: "Πώς οι security researchers αναφέρουν ευπάθειες + safe-harbor.",
    Icon: BugReportIcon,
    tag: "RFC 9116"
  },
  {
    to: "/refund-policy",
    title: "Πολιτική Επιστροφών & Καταγγελίας Συνδρομής",
    subtitle: "30ήμερη δοκιμή, 14-day παράθυρο επιστροφής καλής θελήσεως, SLA credits.",
    Icon: MoneyOffIcon
  },
  {
    to: "/client-portal-terms",
    title: "Όροι Χρήσης Πύλης Ασφαλισμένου",
    subtitle: "Ισχύουν για ασφαλισμένους που συνδέονται στην πύλη τους (όχι για γραφεία).",
    Icon: PersonOutlineIcon
  },
  {
    to: "/accessibility",
    title: "Δήλωση Προσβασιμότητας",
    subtitle: "WCAG 2.1 AA — κατάσταση συμμόρφωσης, γνωστά ζητήματα, επικοινωνία.",
    Icon: AccessibilityNewIcon,
    tag: "EU 2016/2102"
  },
  {
    to: "/code-of-conduct",
    title: "Κώδικας Δεοντολογίας",
    subtitle: "Ακεραιότητα, anti-bribery, whistleblowing, σύγκρουση συμφερόντων.",
    Icon: WorkOutlineIcon
  },
  {
    to: "/oss-licenses",
    title: "Αναγνώριση Βιβλιοθηκών Ανοικτού Κώδικα",
    subtitle: "OSS attributions για κάθε third-party βιβλιοθήκη.",
    Icon: CodeIcon
  }
];

const policies: LegalDoc[] = [
  {
    to: "/terms",
    title: "Όροι Χρήσης Ιστοσελίδας",
    subtitle: "Ισχύουν για επισκέπτες του δημόσιου δικτυακού τόπου (mykalypsis.gr).",
    Icon: DescriptionOutlinedIcon
  },
  {
    to: "/privacy",
    title: "Πολιτική Απορρήτου",
    subtitle: "Πώς επεξεργαζόμαστε τα δικά σας δεδομένα (όχι των πελατών σας).",
    Icon: ShieldOutlinedIcon,
    tag: "GDPR"
  },
  {
    to: "/cookies",
    title: "Πολιτική Cookies",
    subtitle: "Ποια cookies χρησιμοποιούμε και πώς μπορείτε να τα ρυθμίσετε.",
    Icon: CookieIcon
  }
];

export function LegalHubPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f7f9fc", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Stack direction="row" alignItems="center" spacing={2} mb={4}>
          <GavelIcon sx={{ fontSize: 40 }} color="primary" />
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>
              {t("legalHub.eyebrow", "Νομικά Έγγραφα Kalypsis")}
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {t("legalHub.title", "Πρώτα Βήματα — Τι Πρέπει να Διαβάσετε")}
            </Typography>
            <Typography color="text.secondary" mt={0.5}>
              {t("legalHub.subtitle",
                "Πριν χρησιμοποιήσετε την Πλατφόρμα, το γραφείο σας πρέπει να διαβάσει και να αποδεχθεί τα ακόλουθα έγγραφα.")}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="h6" fontWeight={700} mb={1.5}>
          {t("legalHub.commercial", "Α. Εμπορικές Συμβάσεις (προς αποδοχή)")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t("legalHub.commercialBody",
            "Οι τέσσερις παρακάτω συμβάσεις γίνονται δεσμευτικές με την αποδοχή σας εντός της Πλατφόρμας. Η αποδοχή τους καταγράφεται με timestamp και IP για non-repudiation.")}
        </Typography>
        <Stack spacing={1.5} mb={5}>
          {commercial.map(d => <DocRow key={d.to} doc={d} />)}
        </Stack>

        <Typography variant="h6" fontWeight={700} mb={1.5}>
          {t("legalHub.governance", "Β. Πολιτικές Διακυβέρνησης & Συμμόρφωσης")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t("legalHub.governanceBody",
            "Πλαίσιο εσωτερικών διαδικασιών και ρυθμιστικής συμμόρφωσης της Kalypsis — διαθέσιμο δημόσια για διαφάνεια.")}
        </Typography>
        <Stack spacing={1.5} mb={5}>
          {governance.map(d => <DocRow key={d.to} doc={d} />)}
        </Stack>

        <Typography variant="h6" fontWeight={700} mb={1.5}>
          {t("legalHub.policies", "Γ. Δημόσιες Πολιτικές Ιστοσελίδας")}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t("legalHub.policiesBody",
            "Ισχύουν για κάθε επισκέπτη του δικτυακού τόπου, ανεξάρτητα από τη σύναψη εμπορικής σύμβασης.")}
        </Typography>
        <Stack spacing={1.5}>
          {policies.map(d => <DocRow key={d.to} doc={d} />)}
        </Stack>

        <Card sx={{ mt: 5, p: 3, bgcolor: "#0b2545", color: "#fff" }}>
          <Typography variant="h6" fontWeight={700} mb={1}>
            {t("legalHub.summaryTitle", "Σε λίγα λόγια")}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {t("legalHub.summaryBody",
              "Η Σύμβαση Παροχής Υπηρεσιών είναι το «κύριο» συμβόλαιο. Το DPA καλύπτει την επεξεργασία δεδομένων των πελατών σας (Άρθρο 28 GDPR). Η SLA καθορίζει το επίπεδο υπηρεσίας που εγγυόμαστε. Η AUP περιγράφει τι επιτρέπεται και τι όχι. Και τα τέσσερα αποτελούν ενιαίο σύνολο.")}
          </Typography>
        </Card>
      </Container>
    </Box>
  );
}

function DocRow({ doc }: { doc: LegalDoc }) {
  const { Icon } = doc;
  return (
    <Card
      component={RouterLink}
      to={doc.to}
      sx={{
        p: 2,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 2,
        transition: "all 0.15s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: 2,
          transform: "translateY(-1px)"
        }
      }}
      variant="outlined"
    >
      <Box sx={{
        width: 44, height: 44, borderRadius: 1.5,
        bgcolor: "rgba(11,37,69,0.06)", color: "primary.main",
        display: "grid", placeItems: "center", flexShrink: 0
      }}>
        <Icon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={0.3} flexWrap="wrap">
          <Typography fontWeight={700}>{doc.title}</Typography>
          {doc.tag && <Chip size="small" label={doc.tag} color="primary" variant="outlined" />}
          {doc.version && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {doc.version}
            </Typography>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">{doc.subtitle}</Typography>
      </Box>
      <ArrowForwardIcon color="action" />
    </Card>
  );
}
