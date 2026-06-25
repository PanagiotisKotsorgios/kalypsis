import { Box, Card, CardActionArea, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import PeopleIcon from "@mui/icons-material/People";
import InsightsIcon from "@mui/icons-material/Insights";
import HubIcon from "@mui/icons-material/Hub";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace, WORKSPACE_DEFAULT_ROUTE } from "../auth/WorkspaceContext";

interface PackageMeta {
  code: PackageCode;
  icon: React.ReactNode;
  tagKey: string;
  nameKey: string;
  bodyKey: string;
}

// Phase 15.1 — for now only BackOffice + Crm (client portal) are operational.
// Other workspaces are intentionally hidden until they're production-ready.
const PACKAGES: PackageMeta[] = [
  { code: "BackOffice",   icon: <AccountBalanceIcon />, tagKey: "tag.I",   nameKey: "ws.BackOffice.name",   bodyKey: "ws.BackOffice.body" },
  { code: "Crm",          icon: <PeopleIcon />,         tagKey: "tag.II",  nameKey: "ws.Crm.name",          bodyKey: "ws.Crm.body" }
];
// Kept for type safety — re-enable these by moving them into PACKAGES above.
void RequestQuoteIcon; void InsightsIcon; void HubIcon;

// One palette across all five. Dark navy border + gold accent only.
const INK = "#0b2545";
const GOLD = "#b08a3e";

export function WorkspaceHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has, isPlatformBypass, loading } = usePackages();
  const { enter } = useWorkspace();

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("ws.hub.morning");
    if (h < 18) return t("ws.hub.afternoon");
    return t("ws.hub.evening");
  })();

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb: { xs: 4, md: 6 } }}>
        <Typography sx={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: { xs: 30, md: 40 },
          color: INK,
          lineHeight: 1.1,
          fontWeight: 600,
          letterSpacing: "-0.01em"
        }}>
          {greeting},{" "}
          <Box component="span" sx={{ color: GOLD, fontStyle: "italic" }}>
            {user?.firstName ?? ""}
          </Box>
          .
        </Typography>
        <Typography sx={{ mt: 1.5, color: "text.secondary", fontSize: { xs: 15, md: 16.5 }, maxWidth: 720, lineHeight: 1.55 }}>
          {t("ws.hub.lead")}
        </Typography>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: "grid",
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }
      }}>
        {PACKAGES.map((pkg) => {
          const enabled = isPlatformBypass || has(pkg.code);
          return (
            <Card
              key={pkg.code}
              variant="outlined"
              sx={{
                position: "relative",
                borderColor: enabled ? INK : "divider",
                borderWidth: enabled ? 1.5 : 1,
                bgcolor: "background.paper",
                opacity: enabled ? 1 : 0.65,
                overflow: "hidden",
                transition: "transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms cubic-bezier(.22,.61,.36,1), border-color 220ms ease",
                "&:hover": enabled ? {
                  transform: "translateY(-3px)",
                  borderColor: INK,
                  boxShadow: `0 12px 24px -12px ${INK}30, 0 2px 0 0 ${GOLD}`
                } : {},
                "&:active": enabled ? { transform: "translateY(-1px)", transition: "transform 80ms ease" } : {},
                // Subtle gold underline that grows in on hover
                "&::after": enabled ? {
                  content: '""',
                  position: "absolute",
                  left: 0, right: 0, bottom: 0,
                  height: 2,
                  background: GOLD,
                  transform: "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 360ms cubic-bezier(.22,.61,.36,1)"
                } : {},
                "&:hover::after": enabled ? { transform: "scaleX(1)" } : {}
              }}
            >
              <CardActionArea
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) { navigate("/pricing"); return; }
                  enter(pkg.code);
                  navigate(WORKSPACE_DEFAULT_ROUTE[pkg.code]);
                }}
                sx={{ height: "100%", alignItems: "stretch" }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, height: "100%", display: "flex", flexDirection: "column" }}>
                  {/* Header row */}
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box sx={{
                      width: 44, height: 44,
                      border: "1.5px solid",
                      borderColor: INK,
                      color: enabled ? INK : "text.disabled",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 0,
                      "& svg": { fontSize: 24 }
                    }}>
                      {enabled ? pkg.icon : <LockOutlinedIcon />}
                    </Box>
                    <Box sx={{
                      px: 1, py: 0.5,
                      border: "1px solid",
                      borderColor: enabled ? GOLD : "divider",
                      color: enabled ? GOLD : "text.disabled",
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em"
                    }}>
                      {t(`ws.${pkg.tagKey}`)}
                    </Box>
                  </Stack>

                  <Typography sx={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: { xs: 19, md: 21 },
                    fontWeight: 600,
                    color: enabled ? INK : "text.disabled",
                    lineHeight: 1.2,
                    mb: 1.5,
                    letterSpacing: "-0.005em"
                  }}>
                    {t(pkg.nameKey)}
                  </Typography>

                  <Typography sx={{
                    color: "text.secondary",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    flex: 1
                  }}>
                    {t(pkg.bodyKey)}
                  </Typography>

                  {/* Footer arrow */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{
                    mt: 2.5, pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    color: enabled ? INK : "text.disabled",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase"
                  }}>
                    <span>{enabled ? t("ws.hub.open") : t("ws.hub.locked")}</span>
                    {enabled && <ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      {/* Footnote */}
      <Box sx={{ mt: { xs: 5, md: 6 }, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {t("ws.hub.footnote")}
        </Typography>
      </Box>
    </Box>
  );
}
