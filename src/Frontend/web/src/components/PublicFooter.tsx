import { Box, Container, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const RULE = "#e5e9ef";

/**
 * Pre-login footer used across landing / contact / legal pages.
 * Two rows:
 *   1. Copyright + legal links.
 *   2. Legal entity strip — sole-proprietor identity («Παναγιώτης
 *      Κοτσοργιός · ΑΦΜ 176091030 · ΔΟΥ Μεσολογγίου · έδρα … · Email»)
 *      rendered small so it reads as a credits line, not marketing copy.
 *      This is the identity the terms/privacy pages point back to.
 */
export function PublicFooter() {
  return (
    <Box component="footer" sx={{
      bgcolor: "#ffffff",
      borderTop: `1px solid ${RULE}`,
      mt: { xs: 4, md: 6 }
    }}>
      <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 }, py: { xs: 2.5, md: 3 } }}>
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

        {/* Legal identity strip — sole-proprietor details required for the
            terms/privacy pages to actually point at a real, verifiable
            business. Rendered small + wrapped so it reads as a credits
            line, not marketing copy. */}
        <Box sx={{
          mt: { xs: 2, md: 2.5 },
          pt: { xs: 2, md: 2.5 },
          borderTop: `1px solid ${RULE}`,
          display: "flex", flexWrap: "wrap", gap: { xs: 1, md: 2 },
          fontSize: 12, color: NAVY_SOFT, lineHeight: 1.55
        }}>
          <Box sx={{ fontWeight: 600, color: NAVY }}>Παναγιώτης Κοτσοργιός</Box>
          <Divider />
          <span>ΑΦΜ 176091030</span>
          <Divider />
          <span>ΔΟΥ Μεσολογγίου</span>
          <Divider />
          <span>Εργατικές Κατοικίες Λιμάνι Μεσολογγίου 113, 30200 Μεσολόγγι</span>
          <Divider />
          <Box component="a" href="mailto:info@mykalypsis.gr" sx={{
            color: NAVY_SOFT, textDecoration: "none",
            "&:hover": { color: NAVY, textDecoration: "underline" }
          }}>
            info@mykalypsis.gr
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function Divider() {
  return (
    <Box aria-hidden sx={{
      color: "#cbd6e2", display: { xs: "none", sm: "inline" },
      userSelect: "none"
    }}>·</Box>
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
