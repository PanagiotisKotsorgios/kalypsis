import { Box, Container, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const RULE = "#e5e9ef";

/**
 * Minimal pre-login footer to match the restrained white landing page —
 * copyright on the left, three legal links in the middle, Google Play badge
 * on the right. No newsletter, no socials, no address — those belong on the
 * Contact page.
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
            <FooterLink to="/terms"   label="Όροι Χρήσης" />
            <FooterLink to="/privacy" label="Απόρρητο" />
            <FooterLink to="/cookies" label="Cookies" />
          </Stack>

          <GooglePlayBadge />
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Box component={RouterLink} to={to}
      sx={{
        color: NAVY_SOFT, fontSize: 13, textDecoration: "none",
        transition: "color 180ms ease",
        "&:hover": { color: NAVY, textDecoration: "underline" }
      }}>
      {label}
    </Box>
  );
}

/** Subtle, monochrome Google Play badge that doesn't break the white page. */
function GooglePlayBadge() {
  return (
    <Box
      component="a"
      href="https://play.google.com/store/apps/details?id=gr.kalypsis.app"
      target="_blank" rel="noopener noreferrer"
      aria-label="Get it on Google Play"
      sx={{
        display: "inline-flex", alignItems: "center", gap: 1,
        px: 1.75, py: 0.9, borderRadius: 1.5,
        bgcolor: "#000", border: "1px solid #000",
        textDecoration: "none",
        transition: "background 180ms ease",
        "&:hover": { bgcolor: NAVY }
      }}>
      <PlaySvg />
      <Box>
        <Typography sx={{
          color: "rgba(255,255,255,0.72)", fontSize: 9, lineHeight: 1,
          letterSpacing: "0.08em", textTransform: "uppercase"
        }}>
          Get it on
        </Typography>
        <Typography sx={{ color: "#fff", fontSize: 14, lineHeight: 1.15, fontWeight: 600 }}>
          Google Play
        </Typography>
      </Box>
    </Box>
  );
}

function PlaySvg() {
  // Monochrome white triangle — keeps the footer typographic and quiet.
  return (
    <Box component="svg" viewBox="0 0 24 24" sx={{ width: 18, height: 18 }} aria-hidden>
      <path fill="#ffffff" d="M3.5 1.6v20.8c0 .5.4.9.9 1l16-11.4-16-11.4c-.5.1-.9.5-.9 1z" />
    </Box>
  );
}
