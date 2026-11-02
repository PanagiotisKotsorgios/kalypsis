import { Box, Button, Container, Stack, Typography } from "@mui/material";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useOptionalAuthUser } from "../auth/AuthContext";
import { CLI_REPOSITORY, cliContributionUrl } from "./CliProjectLink";
import { KalypsisLogo } from "./KalypsisLogo";

const MAP_URL =
  "https://www.xo.gr/maps/anazitisi-diefthynsis/epar-od-mesolongiou-alykon-tourlidas-mesolongi-30200/";

const HOURS = [
  { el: "Δευτέρα", en: "Monday", hours: "09:00 – 17:00" },
  { el: "Τρίτη", en: "Tuesday", hours: "09:00 – 17:00" },
  { el: "Τετάρτη", en: "Wednesday", hours: "09:00 – 17:00" },
  { el: "Πέμπτη", en: "Thursday", hours: "09:00 – 17:00" },
  { el: "Παρασκευή", en: "Friday", hours: "09:00 – 17:00" },
  { el: "Σάββατο", en: "Saturday", hours: "09:00 – 13:00" },
  { el: "Κυριακή", en: "Sunday", hours: null },
];

const linkSx = {
  color: "rgba(231,241,252,.76)",
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  width: "fit-content",
  fontSize: 13.5,
  lineHeight: 1.65,
  textDecoration: "none",
  transition: "color 160ms ease",
  "&:hover": { color: "#fff", textDecoration: "underline" },
  "&:focus-visible": {
    outline: "2px solid #8bd0ff",
    outlineOffset: 3,
    borderRadius: 1,
  },
} as const;

const columnHeadingSx = {
  mb: 2,
  color: "#fff",
  fontSize: 12,
  fontWeight: 850,
  letterSpacing: ".13em",
  textTransform: "uppercase",
} as const;

export function PublicFooter() {
  const { i18n } = useTranslation();
  const user = useOptionalAuthUser();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  const copy = english
    ? {
        explore: "Explore Kalypsis",
        company: "Company & support",
        location: "Visit us",
        hours: "Business hours",
        description:
          "Software for insurance offices, built around clear workflows, reliable information and practical support.",
        software: "Custom software",
        desktop: "Kalypsis Desktop",
        releases: "Desktop releases",
        hosting: "Cloud hosting",
        pricing: "Plans & pricing",
        faq: "Frequently asked questions",
        portal: "Partner project portal",
        projectAdmin: "Project portal administration",
        contact: "Contact us",
        login: "Sign in",
        address: "Epar. Od. Messolongiou – Alykon Tourlidas, 302 00 Messolonghi, Aetolia-Acarnania",
        relocation: "Registered office relocation in progress",
        relocationNote: "Our registered office is currently in the process of being transferred.",
        closed: "Closed",
        cliTitle: "KALYPSIS CLI · Public project",
        cliBody: "Explore the Windows command-line tools, documentation and contribution guide.",
        repository: "Explore on GitHub",
        contribute: "Contribute",
        legal: "Legal",
        terms: "Terms of use",
        privacy: "Privacy",
        cookies: "Cookies",
        acceptableUse: "Acceptable use",
        accessibility: "Accessibility",
        rights: "All rights reserved.",
      }
    : {
        explore: "Εξερευνήστε το Kalypsis",
        company: "Εταιρεία & υποστήριξη",
        location: "Επισκεφθείτε μας",
        hours: "Ωράριο λειτουργίας",
        description:
          "Λογισμικό για ασφαλιστικά γραφεία, σχεδιασμένο γύρω από τις καθημερινές ροές εργασίας, την αξιόπιστη πληροφορία και την ουσιαστική υποστήριξη.",
        software: "Εξειδικευμένο λογισμικό",
        desktop: "Kalypsis Desktop",
        releases: "Εκδόσεις Desktop",
        hosting: "Cloud φιλοξενία",
        pricing: "Πακέτα & τιμές",
        faq: "Συχνές ερωτήσεις",
        portal: "Portal συνεργατών",
        projectAdmin: "Διαχείριση έργων portal",
        contact: "Επικοινωνία",
        login: "Σύνδεση",
        address: "Επαρ. Οδ. Μεσολογγίου – Αλυκών Τουρλίδας, 302 00 Μεσολόγγι, Αιτωλοακαρνανία",
        relocation: "Σε διαδικασία μεταφοράς έδρας",
        relocationNote: "Η έδρα της εταιρείας βρίσκεται σε διαδικασία μεταφοράς.",
        closed: "Κλειστό",
        cliTitle: "KALYPSIS CLI · Δημόσιο έργο",
        cliBody:
          "Γνωρίστε τα εργαλεία γραμμής εντολών για Windows, την τεκμηρίωση και τον οδηγό συνεισφοράς.",
        repository: "Δείτε το στο GitHub",
        contribute: "Συνεισφέρετε",
        legal: "Νομικά",
        terms: "Όροι χρήσης",
        privacy: "Απόρρητο",
        cookies: "Cookies",
        acceptableUse: "Αποδεκτή χρήση",
        accessibility: "Προσβασιμότητα",
        rights: "Με επιφύλαξη παντός δικαιώματος.",
      };

  return (
    <Box
      component="footer"
      sx={{
        mt: { xs: 5, md: 8 },
        color: "#e7f1fc",
        background:
          "radial-gradient(ellipse at 12% 0%,rgba(54,130,194,.2),transparent 35%),linear-gradient(135deg,#07182a 0%,#0b2545 58%,#102d4b 100%)",
        borderTop: "3px solid transparent",
        borderImage: "linear-gradient(90deg,#0b2545,#4fb8f5,#0b2545) 1",
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 2.5, md: 5 }, pt: { xs: 5, md: 7 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2,minmax(0,1fr))",
              lg: "1.25fr .8fr 1fr 1.05fr",
            },
            gap: { xs: 4, md: 5 },
            pb: { xs: 4, md: 5 },
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ px: 0.8, py: 0.35, bgcolor: "#fff", borderRadius: 1.5, lineHeight: 0 }}>
                <KalypsisLogo size={36} crop />
              </Box>
              <Box>
                <Typography sx={{ color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: ".08em" }}>
                  KALYPSIS
                </Typography>
                <Typography sx={{ color: "#91b5d5", fontSize: 11, fontWeight: 700, letterSpacing: ".12em" }}>
                  SOFTWARE SOLUTIONS
                </Typography>
              </Box>
            </Stack>
            <Typography sx={{ maxWidth: 350, color: "rgba(231,241,252,.75)", fontSize: 13.5, lineHeight: 1.8 }}>
              {copy.description}
            </Typography>

            <Box sx={{ p: 2, border: "1px solid rgba(164,202,235,.2)", borderRadius: 2.5, bgcolor: "rgba(255,255,255,.045)" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <GitHubIcon sx={{ color: "#a6d9ff", fontSize: 19 }} />
                <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
                  {copy.cliTitle}
                </Typography>
              </Stack>
              <Typography sx={{ mt: 0.75, color: "rgba(231,241,252,.7)", fontSize: 12.5, lineHeight: 1.65 }}>
                {copy.cliBody}
              </Typography>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                <Button
                  component="a"
                  href={CLI_REPOSITORY}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  startIcon={<TerminalRoundedIcon />}
                  sx={footerButtonSx}
                >
                  {copy.repository}
                </Button>
                <Button
                  component="a"
                  href={cliContributionUrl(english)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  startIcon={<CodeRoundedIcon />}
                  sx={footerButtonSx}
                >
                  {copy.contribute}
                </Button>
              </Stack>
            </Box>
          </Stack>

          <Box>
            <Typography sx={columnHeadingSx}>{copy.explore}</Typography>
            <Stack spacing={1.15} alignItems="flex-start">
              <FooterLink to="/custom-software-solutions">{copy.software}</FooterLink>
              <FooterLink to="/download">{copy.desktop}</FooterLink>
              <FooterLink to="/download/releases">{copy.releases}</FooterLink>
              <FooterLink to="/hosting">{copy.hosting}</FooterLink>
              <FooterLink to="/pricing">{copy.pricing}</FooterLink>
              <FooterLink to="/faq">{copy.faq}</FooterLink>
              <FooterLink to="/custom-software-solutions/login">{copy.portal}</FooterLink>
            </Stack>
          </Box>

          <Box>
            <Typography sx={columnHeadingSx}>{copy.company}</Typography>
            <Stack spacing={1.5} alignItems="flex-start">
              <FooterLink to="/contact">{copy.contact}</FooterLink>
              <FooterLink to="/login">{copy.login}</FooterLink>
              {user?.role === "PlatformAdmin" && (
                <FooterLink to="/platform/custom-software-projects">{copy.projectAdmin}</FooterLink>
              )}
              <Box component="a" href="mailto:info@mykalypsis.gr" sx={linkSx}>
                <EmailOutlinedIcon sx={{ fontSize: 17, color: "#8bd0ff" }} />
                info@mykalypsis.gr
              </Box>
              <Box component="a" href="tel:+302631028971" sx={linkSx}>
                <PhoneOutlinedIcon sx={{ fontSize: 17, color: "#8bd0ff" }} />
                26310 28971
              </Box>
              <Box component="a" href={MAP_URL} target="_blank" rel="noopener noreferrer" sx={{ ...linkSx, alignItems: "flex-start", maxWidth: 320 }}>
                <LocationOnOutlinedIcon sx={{ mt: 0.2, flexShrink: 0, fontSize: 18, color: "#8bd0ff" }} />
                <Box component="span">{copy.address}</Box>
              </Box>
              <Box sx={{ mt: 0.5, p: 1.5, border: "1px solid rgba(164,202,235,.2)", borderRadius: 2, bgcolor: "rgba(255,255,255,.045)" }}>
                <Typography sx={{ color: "#fff", fontSize: 12.5, fontWeight: 800 }}>
                  {copy.relocation}
                </Typography>
                <Typography sx={{ mt: 0.5, color: "rgba(231,241,252,.68)", fontSize: 11.5, lineHeight: 1.6 }}>
                  {copy.relocationNote}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography sx={columnHeadingSx}>{copy.hours}</Typography>
            <Box
              component="table"
              aria-label={copy.hours}
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                color: "rgba(231,241,252,.76)",
                fontSize: 12.5,
                "& td": { py: 0.65, borderBottom: "1px solid rgba(164,202,235,.12)" },
                "& td:last-of-type": { textAlign: "right", whiteSpace: "nowrap", pl: 1 },
                "& tr:last-of-type td": { borderBottom: 0 },
              }}
            >
              <tbody>
                {HOURS.map((row) => (
                  <Box component="tr" key={row.en}>
                    <Box component="td">{english ? row.en : row.el}</Box>
                    <Box component="td">{row.hours ?? copy.closed}</Box>
                  </Box>
                ))}
              </tbody>
            </Box>
            <Stack spacing={1.15} alignItems="flex-start" sx={{ mt: 2.5 }}>
              <Typography sx={{ ...columnHeadingSx, mb: 0 }}>{copy.legal}</Typography>
              <FooterLink to="/terms">{copy.terms}</FooterLink>
              <FooterLink to="/privacy">{copy.privacy}</FooterLink>
              <FooterLink to="/cookies">{copy.cookies}</FooterLink>
              <FooterLink to="/acceptable-use">{copy.acceptableUse}</FooterLink>
              <FooterLink to="/accessibility">{copy.accessibility}</FooterLink>
            </Stack>
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ py: 2.5, borderTop: "1px solid rgba(164,202,235,.18)" }}
        >
          <Typography sx={{ color: "rgba(231,241,252,.62)", fontSize: 12 }}>
            © {new Date().getFullYear()} KALYPSIS SOFTWARE SOLUTIONS. {copy.rights}
          </Typography>
          <Stack direction="row" spacing={2.5} useFlexGap flexWrap="wrap">
            <FooterLink to="/contact">{copy.contact}</FooterLink>
            <FooterLink to="/terms">{copy.terms}</FooterLink>
            <FooterLink to="/privacy">{copy.privacy}</FooterLink>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Box component={RouterLink} to={to} sx={linkSx}>
      {children}
    </Box>
  );
}

const footerButtonSx = {
  color: "#d8ecff",
  border: "1px solid rgba(164,202,235,.22)",
  borderRadius: 1.5,
  fontSize: 11.5,
  fontWeight: 750,
  textTransform: "none",
  "&:hover": { bgcolor: "rgba(255,255,255,.1)", borderColor: "rgba(164,202,235,.45)" },
} as const;
