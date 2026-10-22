import { Alert, AlertTitle, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useState as useLocalState } from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import PeopleIcon from "@mui/icons-material/People";
import InsightsIcon from "@mui/icons-material/Insights";
import HubIcon from "@mui/icons-material/Hub";
import LanguageIcon from "@mui/icons-material/Language";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace } from "../auth/WorkspaceContext";
import { AgencyAnalyticsPanel } from "../components/AgencyAnalyticsPanel";

interface PackageMeta {
  code: PackageCode;
  icon: React.ReactNode;
  image: string;
  nameKey: string;
  bodyKey: string;
  accent: string;
  surface: string;
}

// Workspace cards are available for every operational package and are filtered
// by the tenant's active packages and the current user's permissions.
const PACKAGES: PackageMeta[] = [
  { code: "BackOffice", icon: <AccountBalanceIcon />, image: "/images/kalypsis-backoffice.png", nameKey: "ws.BackOffice.name", bodyKey: "ws.BackOffice.body", accent: "#1678b8", surface: "#dcefff" },
  { code: "Crm", icon: <PeopleIcon />, image: "/images/kalypsis-crm-clientportal.png", nameKey: "ws.Crm.name", bodyKey: "ws.Crm.body", accent: "#258bb4", surface: "#def6f3" },
  { code: "Intelligence", icon: <InsightsIcon />, image: "/images/kalypsis-analytics-intelligence.png", nameKey: "ws.Intelligence.name", bodyKey: "ws.Intelligence.body", accent: "#4268b6", surface: "#e8eaff" },
  { code: "FrontOffice", icon: <LanguageIcon />, image: "/images/kalypsis-frontoffice.png", nameKey: "ws.FrontOffice.name", bodyKey: "ws.FrontOffice.body", accent: "#1597c7", surface: "#def4ff" },
  { code: "Integrations", icon: <HubIcon />, image: "/images/kalypsis-integrations-compliance.png", nameKey: "ws.Integrations.name", bodyKey: "ws.Integrations.body", accent: "#238e99", surface: "#dff6ef" },
  { code: "Ermes", icon: <MailOutlineIcon />, image: "/images/kalypsis-ermis-secure-messaging.png", nameKey: "ws.Ermes.name", bodyKey: "ws.Ermes.body", accent: "#315d91", surface: "#e4efff" }
];
// Kept for type safety — this icon is used by the compact sidebar, not by a
// workspace card.
void RequestQuoteIcon;

// Restrained palette — navy as primary, cyan as the single accent
// (matches the redesigned landing page). No gold/brown.
const INK = "#0b2545";
const INK_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";

export function WorkspaceHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has, isPlatformBypass, loading, packages, refresh } = usePackages();
  const { enter, workspace } = useWorkspace();
  const [manualRefreshing, setManualRefreshing] = useLocalState(false);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  // The sidebar filters every item behind a `package:` gate — a tenant with
  // zero enabled packages sees only "Οδηγίες / Backups / Νομικά" and thinks
  // the app is broken ("half the sidebar, no bridges"). Flag it plainly so
  // the AgencyAdmin knows to escalate + the SuperAdmin (bypass) knows why
  // a tenant they're impersonating looks empty.
  const noPackages = !isPlatformBypass && packages.size === 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("ws.hub.morning");
    if (h < 18) return t("ws.hub.afternoon");
    return t("ws.hub.evening");
  })();

  return (
    <Box>
      {/* Greeting — restrained navy, no gold accent */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography sx={{
          fontSize: { xs: 30, md: 40 },
          color: INK,
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: "-0.02em"
        }}>
          {greeting},{" "}
          <Box component="span" sx={{ color: ACCENT }}>
            {user?.firstName ?? ""}
          </Box>
          .
        </Typography>
        <Typography sx={{ mt: 1.5, color: INK_SOFT, fontSize: { xs: 15, md: 16.5 }, maxWidth: 720, lineHeight: 1.55 }}>
          {t("ws.hub.lead")}
        </Typography>
      </Box>

      {noPackages && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" color="inherit" startIcon={manualRefreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
              disabled={manualRefreshing}
              onClick={async () => {
                setManualRefreshing(true);
                try { await refresh(); }
                finally { setManualRefreshing(false); }
              }}>
              Ανανέωση
            </Button>
          }>
          <AlertTitle sx={{ fontWeight: 700 }}>Δεν υπάρχουν ενεργά πακέτα για το γραφείο σας</AlertTitle>
          Για αυτό το πλαϊνό μενού εμφανίζεται μισό — δεν βλέπετε γέφυρες, παραγωγή, οικονομικά
          ή παραμετροποίηση. Αν ο διαχειριστής της Kalypsis μόλις ενεργοποίησε πακέτα, πάτησε
          <strong> «Ανανέωση»</strong>. Αλλιώς επικοινώνησε στο{" "}
          <a href="mailto:info@mykalypsis.gr" style={{ color: "inherit", fontWeight: 700 }}>info@mykalypsis.gr</a>{" "}
          για ενεργοποίηση (BackOffice, CRM, κ.λπ.).
        </Alert>
      )}


      <AgencyAnalyticsPanel collapsible />

      {/* Grid — rendered for every package the tenant actually owns. This is
          important for a single-package office too: the operator must still
          have a visible entry point for that package's workspace. */}
      {(() => {
        const enabledPackages = PACKAGES.filter(p => isPlatformBypass || has(p.code));
        if (enabledPackages.length === 0) return null;
        return (
      <Box sx={{
        display: "grid",
        gap: { xs: 2.25, md: 2.75 },
        alignItems: "stretch",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }
      }}>
        {enabledPackages.map((pkg) => {
          const enabled = isPlatformBypass || has(pkg.code);
          const active = enabled && workspace === pkg.code;
          return (
            <Card
              key={pkg.code}
              variant="outlined"
              sx={{
                position: "relative",
                display: "flex",
                height: "100%",
                minHeight: { xs: 350, md: 382 },
                borderColor: active ? pkg.accent : `${pkg.accent}3f`,
                borderWidth: active ? 2 : 1,
                borderRadius: "20px",
                background: active
                  ? `linear-gradient(145deg, ${pkg.surface} 0%, ${pkg.surface}d9 61%, ${pkg.accent}1c 100%)`
                  : `linear-gradient(145deg, ${pkg.surface} 0%, ${pkg.surface}c9 64%, ${pkg.accent}17 100%)`,
                opacity: enabled ? 1 : 0.65,
                overflow: "hidden",
                boxShadow: active ? `0 12px 30px ${pkg.accent}25` : "0 8px 22px rgba(11,37,69,0.07)",
                transition: "transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms cubic-bezier(.22,.61,.36,1), border-color 220ms ease, background 220ms ease",
                "&:hover": enabled ? {
                  transform: "translateY(-3px)",
                  borderColor: pkg.accent,
                  boxShadow: `0 14px 30px ${pkg.accent}2b`,
                  background: `linear-gradient(145deg, ${pkg.surface} 0%, ${pkg.surface}e8 56%, ${pkg.accent}26 100%)`,
                  "& .workspace-package-art": { transform: "scale(1.02) translateY(-2px)" },
                  "& .workspace-package-arrow": { transform: "translateX(3px)" },
                } : {},
                "&:active": enabled ? { transform: "translateY(-1px)", transition: "transform 80ms ease" } : {},
                "&::before": {
                  content: '""',
                  position: "absolute",
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  right: -70,
                  top: -75,
                  background: `radial-gradient(circle, ${pkg.accent}22 0%, transparent 68%)`,
                  pointerEvents: "none",
                },
              }}
            >
              {active && (
                <Box sx={{
                  position: "absolute", top: 12, right: 14, zIndex: 3,
                  display: "inline-flex", alignItems: "center", gap: 0.5,
                  px: 1, py: 0.45, borderRadius: 99,
                  bgcolor: INK, color: "#fff",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                  boxShadow: `0 4px 12px ${INK}30`,
                }}>
                  <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#61d99b" }} />
                  Ενεργό
                </Box>
              )}
              <Box aria-hidden sx={{
                position: "absolute",
                width: 150,
                height: 100,
                left: -72,
                bottom: 50,
                borderRadius: "50%",
                background: `radial-gradient(ellipse, ${pkg.accent}16 0%, transparent 72%)`,
                pointerEvents: "none",
              }} />
              <CardActionArea
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) { navigate("/pricing"); return; }
                  enter(pkg.code);
                  // The hub is the stable landing surface. Selecting a package
                  // changes only the workspace context, which filters the
                  // sidebar without moving the user away from /app.
                  navigate("/app");
                }}
                sx={{
                  height: "100%",
                  alignItems: "stretch",
                  display: "flex",
                  flexDirection: "column",
                  "& .MuiCardActionArea-focusHighlight": { backgroundColor: `${pkg.accent}08` },
                }}
              >
                <CardContent sx={{
                  p: { xs: 2.5, md: 3.25 },
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  "&:last-child": { pb: { xs: 2.5, md: 3.25 } },
                }}>
                  <Box
                    component="img"
                    src={pkg.image}
                    alt={t(pkg.nameKey)}
                    className="workspace-package-art"
                    sx={{
                      position: "absolute",
                      top: { xs: 13, md: 16 },
                      right: { xs: 8, md: 13 },
                      width: { xs: 125, sm: 148, md: 174 },
                      height: { xs: 125, sm: 148, md: 174 },
                      objectFit: "contain",
                      opacity: enabled ? 0.95 : 0.22,
                      zIndex: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                      transition: "transform 260ms ease, opacity 220ms ease",
                    }}
                  />
                  {/* Secondary package icon; the supplied artwork remains the primary visual. */}
                  <Box sx={{
                    width: 50, height: 50,
                    borderRadius: 2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: enabled ? `${pkg.accent}16` : "action.disabledBackground",
                    color: enabled ? pkg.accent : "text.disabled",
                    border: "1px solid",
                    borderColor: enabled ? `${pkg.accent}30` : "divider",
                    mb: 2.5,
                    position: "relative",
                    zIndex: 1,
                    "& svg": { fontSize: 26 }
                  }}>
                    {enabled ? pkg.icon : <LockOutlinedIcon />}
                  </Box>

                  <Typography variant="h5" sx={{
                    fontWeight: 700,
                    color: enabled ? "text.primary" : "text.disabled",
                    lineHeight: 1.25,
                    mb: 1,
                    maxWidth: { xs: "68%", sm: "72%" },
                    position: "relative",
                    zIndex: 1,
                    letterSpacing: "-0.005em"
                  }}>
                    {t(pkg.nameKey)}
                  </Typography>

                  <Typography sx={{
                    color: enabled ? INK_SOFT : "text.disabled",
                    fontSize: { xs: 13.5, md: 14.25 },
                    lineHeight: 1.6,
                    maxWidth: { xs: "68%", sm: "70%" },
                    position: "relative",
                    zIndex: 1,
                    flex: 1
                  }}>
                    {t(pkg.bodyKey)}
                  </Typography>

                  <Box sx={{
                    mt: 3,
                    minHeight: 50,
                    px: 1.75,
                    py: 1,
                    borderRadius: "15px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    position: "relative",
                    zIndex: 1,
                    color: active ? "#fff" : enabled ? INK : "text.disabled",
                    background: active ? `linear-gradient(100deg, ${pkg.accent}, #145d94)` : `${pkg.accent}1c`,
                    border: "1px solid",
                    borderColor: active ? "transparent" : `${pkg.accent}26`,
                    fontWeight: 800,
                    fontSize: { xs: 12, md: 12.5 },
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    transition: "background 200ms ease, color 200ms ease",
                  }}>
                    <span>{active ? "ΕΝΕΡΓΟ ΠΑΚΕΤΟ ✓" : enabled ? t("ws.hub.open") : t("ws.hub.locked")}</span>
                    {!active && enabled && (
                      <Box className="workspace-package-arrow" sx={{
                        width: 30,
                        height: 30,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        color: pkg.accent,
                        bgcolor: "#fff",
                        transition: "transform 180ms ease",
                      }}>
                        <ArrowForwardIcon sx={{ fontSize: 17 }} />
                      </Box>
                    )}
                    {active && <CheckCircleIcon sx={{ fontSize: 20 }} />}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
        );
      })()}

      {/* Footnote */}
      <Box sx={{ mt: { xs: 5, md: 6 }, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {t("ws.hub.footnote")}
        </Typography>
      </Box>
    </Box>
  );
}
