import { Box, Button, Container, Stack, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import TerminalIcon from "@mui/icons-material/Terminal";
import CodeIcon from "@mui/icons-material/Code";
import { useTranslation } from "react-i18next";
import { CliProjectLink, CLI_REPOSITORY, cliContributionUrl } from "./CliProjectLink";
import { Link as RouterLink } from "react-router-dom";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const RULE = "#e5e9ef";

/**
 * Minimal pre-login footer — copyright on the left, three legal links on
 * the right. The legal entity identity (name / ΑΦΜ / ΔΟΥ / έδρα / email)
 * lives inside the Terms + Privacy pages themselves; not needed here.
 */
export function PublicFooter() {
  const { i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  return (
    <Box component="footer" sx={{
      bgcolor: "#ffffff",
      borderTop: `1px solid ${RULE}`,
      mt: { xs: 4, md: 6 }
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 2.5, md: 3 } }}>
        <Stack direction={{ xs: "column", md: "row" }} useFlexGap gap={2} alignItems={{ xs: "flex-start", md: "center" }} sx={{ pb: 2.5, mb: 2.5, borderBottom: `1px solid ${RULE}` }}>
          <Stack direction="row" gap={1.25} alignItems="center" sx={{ flex: 1 }}><GitHubIcon sx={{ color: NAVY }} /><Box><Typography sx={{ color: NAVY, fontWeight: 800, fontSize: 15 }}>KALYPSIS CLI</Typography><Typography sx={{ color: NAVY_SOFT, fontSize: 12 }}>{english ? "Windows command-line project · In preparation" : "Έργο γραμμής εντολών για Windows · Υπό προετοιμασία"}</Typography></Box></Stack>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignItems="center">
            <CliProjectLink />
            <Button component="a" href={CLI_REPOSITORY} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<TerminalIcon />} sx={{ color: NAVY, borderColor: "#B8CBDF", textTransform: "none" }}>{english ? "About the Windows CLI" : "Το CLI για Windows"}</Button>
            <Button component="a" href={cliContributionUrl(english)} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<CodeIcon />} sx={{ bgcolor: NAVY, color: "#fff", textTransform: "none", "&:hover": { bgcolor: "#164874" } }}>{english ? "Become a contributor" : "Γίνετε συντελεστής"}</Button>
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Typography sx={{ color: NAVY_SOFT, fontSize: 13, letterSpacing: "0.01em" }}>
            © {new Date().getFullYear()} Kalypsis
          </Typography>

          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
            <FooterLink to="/contact" label="Επικοινωνία / Αναφορά Προβλήματος" emphasized />
            <FooterLink to="/terms"   label="Όροι Χρήσης" />
            <FooterLink to="/privacy" label="Απόρρητο" />
            <FooterLink to="/cookies" label="Cookies" />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLink({ to, label, emphasized }: { to: string; label: string; emphasized?: boolean }) {
  return (
    <Box component={RouterLink} to={to}
      sx={{
        color: emphasized ? NAVY : NAVY_SOFT,
        fontSize: 13,
        fontWeight: emphasized ? 700 : 400,
        textDecoration: "none",
        transition: "color 180ms ease",
        "&:hover": { color: NAVY, textDecoration: "underline" }
      }}>
      {label}
    </Box>
  );
}
