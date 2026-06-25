import { Box, Container, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const RULE = "#e5e9ef";

/**
 * Minimal pre-login footer to match the restrained white landing page —
 * copyright on the left and three legal links on the right. No newsletter,
 * no socials, no address — those belong on the Contact page.
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
