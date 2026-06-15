import { Box, Container, Stack, Typography, Link, Divider } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KalypsisLogo } from "./KalypsisLogo";

export function PublicFooter() {
  const { t } = useTranslation();
  return (
    <Box id="contact" component="footer" sx={{ bgcolor: "#061a36", color: "rgba(255,255,255,0.85)", pt: 8, pb: 4 }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr 1fr 1fr" }
          }}
        >
          <Stack spacing={2}>
            <KalypsisLogo size={64} color="light" />
            <Typography variant="body2" sx={{ opacity: 0.78, maxWidth: 360, lineHeight: 1.7 }}>
              {t("footer.intro")}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.65, mt: 1 }}>
              {t("footer.compliance")}
            </Typography>
          </Stack>

          <FooterColumn
            heading={t("footer.product")}
            links={[
              { to: "/#features", label: t("publicNav.platform") },
              { to: "/#for-agencies", label: t("publicNav.forAgencies") },
              { to: "/#for-agents", label: t("publicNav.forAgents") },
              { to: "/#pricing", label: t("publicNav.pricing") }
            ]}
          />

          <FooterColumn
            heading={t("footer.company")}
            links={[
              { to: "/#about", label: t("footer.about") },
              { to: "/#faq", label: t("footer.faq") },
              { to: "/register", label: t("publicNav.register") },
              { to: "/login", label: t("publicNav.signIn") }
            ]}
          />

          <Stack spacing={1.5}>
            <Typography sx={{ color: "common.white", fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>
              {t("footer.contact")}
            </Typography>
            <Stack spacing={0.5} sx={{ opacity: 0.85, fontSize: 14 }}>
              <Box>Λ. Κηφισίας 268, 152 32 Χαλάνδρι</Box>
              <Box>+30 210 600 0000</Box>
              <Box>hello@kalypsis.gr</Box>
              <Box>support@kalypsis.gr</Box>
            </Stack>
          </Stack>
        </Box>

        <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.12)" }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          sx={{ opacity: 0.7, fontSize: 13 }}
        >
          <Box>© {new Date().getFullYear()} Kalypsis Insurance Platform — {t("app.tagline")}</Box>
          <Stack direction="row" spacing={3}>
            <Link component={RouterLink} to="/#terms" color="inherit" underline="hover">
              {t("footer.terms")}
            </Link>
            <Link component={RouterLink} to="/#privacy" color="inherit" underline="hover">
              {t("footer.privacy")}
            </Link>
            <Link component={RouterLink} to="/#cookies" color="inherit" underline="hover">
              {t("footer.cookies")}
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterColumn({
  heading,
  links
}: {
  heading: string;
  links: { to: string; label: string }[];
}) {
  return (
    <Stack spacing={1.4}>
      <Typography sx={{ color: "common.white", fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>
        {heading}
      </Typography>
      {links.map((link) => (
        <Link
          key={link.to + link.label}
          component={RouterLink}
          to={link.to}
          underline="none"
          sx={{ color: "rgba(255,255,255,0.78)", fontSize: 14, "&:hover": { color: "common.white" } }}
        >
          {link.label}
        </Link>
      ))}
    </Stack>
  );
}
