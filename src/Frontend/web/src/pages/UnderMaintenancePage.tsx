import { Box, Button, Card, CardContent, Container, IconButton, Stack, Typography } from "@mui/material";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import EmailIcon from "@mui/icons-material/Email";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageToggle } from "../components/LanguageToggle";
import { SessionCountdown } from "../components/SessionCountdown";

/**
 * Phase 8.6 — Launch-gate page shown to agency-side roles while the
 * <c>LaunchGateEnabled</c> platform setting is on. Calm, dashboard-matching
 * design — no neon, no glow, no pulse — matches the surrounding admin UI so
 * users feel they're inside the platform, just on a placeholder screen.
 *
 * Optional overrides come from <c>useMaintenance()</c>: if the superadmin sets
 * a custom title/message in the editor, they replace the i18n defaults.
 */
export function UnderMaintenancePage({ title, message }: { title?: string | null; message?: string | null }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => { signOut(); navigate("/", { replace: true }); };

  const resolvedTitle = title?.trim() || t("maintenance.title", { name: user?.firstName ?? "" });
  const resolvedMessage = message?.trim() || t("maintenance.body");

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      bgcolor: "background.default"   // grayish dashboard background
    }}>
      {/* Top bar — same look as AppLayout */}
      <Box sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: { xs: 2, md: 4 },
        py: 1.5
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600, color: "text.primary", letterSpacing: "-0.01em" }}>
            Kalypsis
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SessionCountdown />
            <LanguageToggle />
            <IconButton onClick={handleSignOut} title={t("auth.logout")} size="small">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Body */}
      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", py: { xs: 6, md: 10 } }}>
        <Card variant="outlined" sx={{ width: "100%" }}>
          <CardContent sx={{ p: { xs: 4, md: 5 } }}>
            {/* Static icon, no animation */}
            <Box sx={{
              width: 56, height: 56, mb: 3,
              borderRadius: 1,
              bgcolor: "action.hover",
              color: "text.secondary",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <ConstructionOutlinedIcon sx={{ fontSize: 30 }} />
            </Box>

            <Typography variant="caption" sx={{
              letterSpacing: "0.12em",
              color: "text.secondary",
              fontWeight: 700,
              textTransform: "uppercase",
              display: "block",
              mb: 1
            }}>
              {t("maintenance.eyebrow")}
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

            <Typography sx={{ color: "text.secondary", fontSize: 15, lineHeight: 1.6, mb: 4 }}>
              {resolvedMessage}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                component="a"
                href="mailto:info@mykalypsis.gr"
                variant="contained"
                startIcon={<EmailIcon />}
                disableElevation
              >
                {t("maintenance.contactCta")}
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outlined"
                startIcon={<LogoutIcon />}
              >
                {t("maintenance.logout")}
              </Button>
            </Stack>

            <Typography variant="caption" sx={{ display: "block", mt: 4, color: "text.disabled" }}>
              {t("maintenance.dataSafe")}
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
