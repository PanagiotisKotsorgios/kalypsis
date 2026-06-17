import { useEffect, useState } from "react";
import {
  Box, Button, Card, CardContent, Container, IconButton, Stack, Typography
} from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";
import LogoutIcon from "@mui/icons-material/Logout";
import EmailIcon from "@mui/icons-material/Email";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { LanguageToggle } from "../components/LanguageToggle";

/**
 * Full-screen branded "Coming soon" page shown to agency users while we run
 * the launch period with only the Customer Portal live. Their accounts work,
 * backend data is preserved — the UI is just gated.
 */
export function UnderMaintenancePage() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [eta, setEta] = useState("");

  // Soft countdown to the next public milestone (visual reassurance).
  useEffect(() => {
    const tick = () => {
      const target = new Date();
      target.setMonth(target.getMonth() + 1, 1);
      target.setHours(0, 0, 0, 0);
      const diff = target.getTime() - Date.now();
      const days = Math.max(0, Math.floor(diff / 86_400_000));
      const hours = Math.max(0, Math.floor((diff % 86_400_000) / 3_600_000));
      setEta(`${days}d ${hours}h`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleSignOut = () => {
    signOut();
    navigate("/", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        background:
          "radial-gradient(circle at 20% 20%, rgba(30,167,225,0.12) 0%, transparent 55%)," +
          "radial-gradient(circle at 80% 30%, rgba(246,166,35,0.10) 0%, transparent 55%)," +
          "linear-gradient(160deg, #0b2545 0%, #13315c 50%, #1d4e89 100%)",
        color: "common.white",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Top bar with logout + language toggle */}
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <KalypsisLogo size={64} crop color="light" />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{
              "& .MuiButton-root": {
                color: "common.white",
                borderColor: "rgba(255,255,255,0.35)",
                "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" }
              }
            }}>
              <LanguageToggle />
            </Box>
            <IconButton
              onClick={handleSignOut}
              title={t("auth.logout")}
              sx={{ color: "common.white", border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <LogoutIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Body */}
      <Container maxWidth="md" sx={{ flex: 1, display: "flex", alignItems: "center", py: 6 }}>
        <Card
          sx={{
            width: "100%",
            borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 40px 100px -20px rgba(0,0,0,0.45)"
          }}
        >
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
            <Box
              sx={{
                width: 96,
                height: 96,
                mx: "auto",
                mb: 3,
                borderRadius: "50%",
                bgcolor: "rgba(246,166,35,0.15)",
                color: "#f6a623",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pulse 2.4s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { boxShadow: "0 0 0 0 rgba(246,166,35,0.45)" },
                  "50%":      { boxShadow: "0 0 0 18px rgba(246,166,35,0)" }
                }
              }}
            >
              <ConstructionIcon sx={{ fontSize: 48 }} />
            </Box>

            <Typography
              variant="overline"
              sx={{ letterSpacing: 2.5, opacity: 0.7, color: "secondary.main", fontWeight: 800 }}
            >
              {t("maintenance.eyebrow")}
            </Typography>

            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                letterSpacing: -1,
                mt: 1,
                mb: 2,
                fontSize: { xs: 30, md: 42 },
                lineHeight: 1.15
              }}
            >
              {t("maintenance.title", { name: user?.firstName ?? "" })}
            </Typography>

            <Typography sx={{ opacity: 0.9, fontSize: 17, maxWidth: 540, mx: "auto", lineHeight: 1.7 }}>
              {t("maintenance.body")}
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              justifyContent="center"
              alignItems="center"
              mt={4}
              mb={2}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{
                px: 2, py: 1, borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)"
              }}>
                <ScheduleIcon sx={{ color: "secondary.main", fontSize: 20 }} />
                <Typography sx={{ fontWeight: 600 }}>
                  {t("maintenance.eta", { eta })}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{
                px: 2, py: 1, borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)"
              }}>
                <VerifiedIcon sx={{ color: "#7be295", fontSize: 20 }} />
                <Typography sx={{ fontWeight: 600 }}>
                  {t("maintenance.dataSafe")}
                </Typography>
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={4} justifyContent="center">
              <Button
                component="a"
                href="mailto:hello@kalypsis.gr"
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<EmailIcon />}
                sx={{ px: 4, py: 1.5, fontWeight: 700 }}
              >
                {t("maintenance.contactCta")}
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outlined"
                size="large"
                startIcon={<LogoutIcon />}
                sx={{
                  px: 4,
                  py: 1.5,
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.4)",
                  "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" }
                }}
              >
                {t("maintenance.logout")}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>

      <Box sx={{ textAlign: "center", py: 3, opacity: 0.6 }}>
        <Typography variant="caption" sx={{ letterSpacing: 1 }}>
          © {new Date().getFullYear()} Kalypsis Insurance Platform
        </Typography>
      </Box>
    </Box>
  );
}
