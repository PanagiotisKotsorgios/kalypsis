import { Box, Button, Container, Stack, Typography } from "@mui/material";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
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
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;

  const links = english
    ? {
        explore: "Explore Kalypsis",
        company: "Company & support",
        location: "Visit us",
        hours: "Business hours",
        description:
          "Software for insurance offices, built around clear workflows, reliable information and practical support.",
        software: "Custom software",
        desktop: "Kalypsis Desktop",
        pricing: "Plans & pricing",
        faq: "Frequently asked questions",
        contact: "Contact us",
        login: "Sign in",
        email: "Email",
        phone: "Call",
        address: "Epar. Od. Messolongiou – Alykon Tourlidas, 302 00 Messolonghi, Aetolia-Acarnania",
        relocation: "Registered office relocation in progress",
        relocationNote:
          "Our registered office is currently in the process of being transferred.",
        closed: "Closed",
        cliTitle: "KALYPSIS CLI · Open-source project",
        cliBody:
          "Explore the Windows command-line tools, documentation and contribution guide.",
        repository: "Explore on GitHub",
        contribute: "Contribute",
        legal: "Legal",
        terms: "Terms of use",
        privacy: "Privacy",
        cookies: "Cookies",
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
        pricing: "Πακέτα & τιμές",
        faq: "Συχνές ερωτήσεις",
        contact: "Επικοινωνία",
        login: "Σύνδεση",
        email: "Email",
        phone: "Τηλέφωνο",
        address:
          "Επαρ. Οδ. Μεσολογγίου – Αλυκών Τουρλίδας, 302 00 Μεσολόγγι, Αιτωλοακαρνανία",
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
              <Box
                sx={{
                  px: 0.8,
                  py: 0.35,
                  bgcolor: "#fff",
                  borderRadius: 1.5,
                  lineHeight: 0,
                }}
              >
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
              {links.description}
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                p: 2,
                border: "1px solid rgba(164,202,235,.2)",
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,.045)",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <GitHubIcon sx={{ color: "#a6d9ff", fontSize: 19 }} />
                <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
                  {links.cliTitle}
                </Typography>
              </Stack>
              <Typography sx={{ mt: 0.75, color: "rgba(231,241,252,.7)", fontSize: 12.5, lineHeight: 1.65 }}>
                {links.cliBody}
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
                  {links.repository}
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
                  {links.contribute}
                </Button>
              </Stack>
            </Box>
          </Stack>

          <Box>
            <Typography sx={columnHeadingSx}>{links.explore}</Typography>
            <Stack spacing={1.15} alignItems="flex-start">
              <FooterLink to="/custom-software-solutions">{links.software}</FooterLink>
              <FooterLink to="/download">{links.desktop}</FooterLink>
              <FooterLink to="/pricing">{links.pricing}</FooterLink>
              <FooterLink to="/faq">{links.faq}</FooterLink>
            </Stack>
          </Box>

          <Box>
            <Typography sx={columnHeadingSx}>{links.company}</Typography>
            <Stack spacing={1.5} alignItems="flex-start">
              <FooterLink to="/contact">{links.contact}</FooterLink>
              <FooterLink to="/login">{links.login}</FooterLink>
              <Box component="a" href="mailto:info@mykalypsis.gr" sx={linkSx}>
                <EmailOutlinedIcon sx={{ fontSize: 17, color: "#8bd0ff" }} />
                info@mykalypsis.gr
              </Box>
              <Box component="a" href="tel:+302631028971" sx={linkSx}>
                <PhoneOutlinedIcon sx={{ fontSize: 17, color: "#8bd0ff" }} />
                26310 28971
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography sx={columnHeadingSx}>{links.location}</Typography>
            <Stack spacing={1.25} alignItems="flex-start">
              <Box
                component="a"
                href={MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ ...linkSx, alignItems: "flex-start", maxWidth: 320 }}
              >
                <LocationOnOutlinedIcon sx={{ mt: 0.2, flexShrink: 0, fontSize: 18, color: "#8bd0ff" }} />
                <Box component="span">{links.address}</Box>
                <ArrowOutwardRoundedIcon sx={{ mt: 0.2, flexShrink: 0, fontSize: 14 }} />
              </Box>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.15,
                  py: 0.65,
                  color: "#ffe3a3",
                  bgcolor: "rgba(180,123,24,.14)",
                  border: "1px solid rgba(255,211,125,.3)",
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                <LocationOnOutlinedIcon sx={{ fontSize: 15 }} />
                {links.relocation}
              </Box>
              <Typography sx={{ color: "rgba(231,241,252,.58)", fontSize: 12, lineHeight: 1.65 }}>
                {links.relocationNote}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "auto 1fr" },
            gap: 2.5,
            alignItems: "start",
            py: 2.5,
            borderTop: "1px solid rgba(177,208,235,.18)",
            borderBottom: "1px solid rgba(177,208,235,.18)",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTimeOutlinedIcon sx={{ color: "#8bd0ff", fontSize: 18 }} />
            <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {links.hours}
            </Typography>
          </Stack>
          <Box
            component="ul"
            aria-label={links.hours}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))", lg: "repeat(7,minmax(0,1fr))" },
              gap: { xs: 1, md: 1.5 },
              p: 0,
              m: 0,
              listStyle: "none",
            }}
          >
            {HOURS.map((day) => (
              <Box
                component="li"
                key={day.en}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.35,
                  px: 1.25,
                  py: 1,
                  bgcolor: "rgba(255,255,255,.045)",
                  border: "1px solid rgba(177,208,235,.12)",
                  borderRadius: 1.5,
                }}
              >
                <Typography sx={{ color: "rgba(231,241,252,.65)", fontSize: 11.5, fontWeight: 700 }}>
                  {english ? day.en : day.el}
                </Typography>
                <Typography sx={{ color: day.hours ? "#fff" : "#c2cee0", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {day.hours ?? links.closed}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          sx={{ py: 2.5 }}
        >
          <Typography sx={{ color: "rgba(231,241,252,.6)", fontSize: 12.5 }}>
            © {new Date().getFullYear()} KALYPSIS SOFTWARE SOLUTIONS. {links.rights}
          </Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={{ xs: 1.5, sm: 2.5 }} alignItems="center">
            <Typography sx={{ color: "#8aa8c3", fontSize: 11.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {links.legal}
            </Typography>
            <FooterLink to="/terms">{links.terms}</FooterLink>
            <FooterLink to="/privacy">{links.privacy}</FooterLink>
            <FooterLink to="/cookies">{links.cookies}</FooterLink>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <Box component={RouterLink} to={to} sx={linkSx}>
      {children}
    </Box>
  );
}

const footerButtonSx = {
  color: "#d8efff",
  border: "1px solid rgba(156,205,240,.3)",
  borderRadius: 1.5,
  px: 1.25,
  fontSize: 11.5,
  fontWeight: 750,
  textTransform: "none",
  "&:hover": { bgcolor: "rgba(255,255,255,.1)", borderColor: "#8bd0ff" },
} as const;
