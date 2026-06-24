import { Box, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "../components/LanguageToggle";

/**
 * Phase 8.6 — Site-wide maintenance page shown to EVERYONE (including
 * customers and not-yet-logged-in visitors) when
 * <c>MaintenanceModeEnabled</c> is on. Same calm dashboard-tone treatment as
 * <c>UnderMaintenancePage</c> but no sign-out button — there's no session
 * context at this layer.
 */
export function SiteMaintenancePage({ title, message }: { title?: string | null; message?: string | null }) {
  const { t } = useTranslation();

  const resolvedTitle = title?.trim() || t("siteMaintenance.title");
  const resolvedMessage = message?.trim() || t("siteMaintenance.body");

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      bgcolor: "background.default"
    }}>
      <Box sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: { xs: 2, md: 4 },
        py: 1.5
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Kalypsis
          </Typography>
          <LanguageToggle />
        </Stack>
      </Box>

      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", py: { xs: 6, md: 10 } }}>
        <Card variant="outlined" sx={{ width: "100%" }}>
          <CardContent sx={{ p: { xs: 4, md: 5 } }}>
            <Box sx={{
              width: 56, height: 56, mb: 3,
              borderRadius: 1,
              bgcolor: "action.hover",
              color: "text.secondary",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <BuildOutlinedIcon sx={{ fontSize: 30 }} />
            </Box>

            <Typography variant="caption" sx={{
              letterSpacing: "0.12em",
              color: "text.secondary",
              fontWeight: 700,
              textTransform: "uppercase",
              display: "block",
              mb: 1
            }}>
              {t("siteMaintenance.eyebrow")}
            </Typography>

            <Typography sx={{
              fontFamily: "Georgia, serif",
              fontSize: { xs: 24, md: 28 },
              fontWeight: 600,
              color: "text.primary",
              lineHeight: 1.2,
              mb: 2
            }}>
              {resolvedTitle}
            </Typography>

            <Typography sx={{ color: "text.secondary", fontSize: 15, lineHeight: 1.6 }}>
              {resolvedMessage}
            </Typography>
          </CardContent>
        </Card>
      </Container>

      <Box sx={{ textAlign: "center", py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          © {new Date().getFullYear()} Kalypsis Insurance Platform
        </Typography>
      </Box>
    </Box>
  );
}
