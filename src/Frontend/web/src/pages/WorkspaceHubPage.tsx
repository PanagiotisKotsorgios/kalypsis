import { Alert, AlertTitle, Box, Button, ButtonBase, Card, CardActionArea, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
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
import { useQuery } from "@tanstack/react-query";
// Recharts is no longer imported directly here — mini-charts render through
// the shared ModernDashboard components below, so the hub matches the
// dashboards' gradient/animation language pixel-for-pixel.
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PolicyIcon from "@mui/icons-material/Policy";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import EuroIcon from "@mui/icons-material/Euro";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace, WORKSPACE_DEFAULT_ROUTE } from "../auth/WorkspaceContext";
import { api } from "../api/client";
import {
  AnimatedKpiCard, ChartCard, ModernAreaChart, ModernBarChart, ModernDonutChart, ModernDualLineChart,
} from "../components/ModernDashboard";

interface PackageMeta {
  code: PackageCode;
  icon: React.ReactNode;
  image: string;
  nameKey: string;
  bodyKey: string;
}

// Workspace cards are available for every operational package and are filtered
// by the tenant's active packages and the current user's permissions.
const PACKAGES: PackageMeta[] = [
  { code: "BackOffice",   icon: <AccountBalanceIcon />, image: "/images/workspace-backoffice.svg", nameKey: "ws.BackOffice.name",   bodyKey: "ws.BackOffice.body" },
  { code: "Crm",          icon: <PeopleIcon />,         image: "/images/workspace-crm.svg",       nameKey: "ws.Crm.name",          bodyKey: "ws.Crm.body" },
  { code: "Intelligence", icon: <InsightsIcon />,      image: "/images/workspace-intelligence.svg?v=20261002", nameKey: "ws.Intelligence.name", bodyKey: "ws.Intelligence.body" },
  { code: "FrontOffice", icon: <LanguageIcon />, image: "/images/workspace-crm.svg", nameKey: "ws.FrontOffice.name", bodyKey: "ws.FrontOffice.body" },
  { code: "Integrations", icon: <HubIcon />, image: "/images/workspace-backoffice.svg", nameKey: "ws.Integrations.name", bodyKey: "ws.Integrations.body" },
  { code: "Ermes", icon: <MailOutlineIcon />, image: "/images/workspace-ermes.svg", nameKey: "ws.Ermes.name", bodyKey: "ws.Ermes.body" }
];
// Kept for type safety — this icon is used by the compact sidebar, not by a
// workspace card.
void RequestQuoteIcon;

// Restrained palette — navy as primary, cyan as the single accent
// (matches the redesigned landing page). No gold/brown.
const INK = "#0b2545";
const INK_SOFT = "#3d4f6b";
const ACCENT = "#1f7bb3";

interface DashKpis {
  customers: number;
  activePolicies: number;
  expiringSoon: number;
  monthlyPremium: number;
  openClaims: number;
  openRequests: number;
}
interface DashSeries { label: string; value: number }
interface CarrierShare { carrier: string; policies: number; premium: number }
interface AgencyReport {
  kpis: DashKpis;
  policiesByType: DashSeries[];
  policiesByStatus: DashSeries[];
  claimsByStatus: DashSeries[];
  monthlyPremium: DashSeries[];
  topCarriers: CarrierShare[];
}

// Palette for the categorical charts — soft, restrained, navy/cyan biased.
const CHART_PALETTE = ["#1f7bb3", "#0b2545", "#6fd2ff", "#3d4f6b", "#a7c1d9", "#6b8aa9"];
const STATUS_PALETTE: Record<string, string> = {
  Active: "#16a34a", PendingRenewal: "#d97706", Expired: "#a3a3a3",
  Cancelled: "#dc2626", Renewed: "#1f7bb3", Draft: "#94a3b8", Prospect: "#d97706"
};

// Backend returns PolicyStatus / PolicyType / ClaimStatus / ServiceRequestStatus
// enum names verbatim. The workspace hub previously piped them into charts
// unchanged, so operators saw «Active / Cancelled / Auto / …» instead of
// the Greek strings the rest of the app uses. Map them here so every donut,
// bar and area chart on the hub reads natively.
const STATUS_LABELS: Record<string, string> = {
  Draft: "Πρόχειρο", Active: "Ενεργό", Expired: "Έληξε", Cancelled: "Ακυρωμένο",
  Renewed: "Ανανεώθηκε", PendingRenewal: "Προς ανανέωση",
  Undelivered: "Απαράδοτο", AwaitingIssue: "Προς έκδοση", Prospect: "Πιθανό συμβόλαιο",
  // Claim / request breakdowns share this map — enum names are unique.
  Open: "Ανοιχτή", Reported: "Αναφέρθηκε", UnderReview: "Υπό εξέταση", InReview: "Υπό εξέταση",
  Approved: "Εγκεκριμένη", Rejected: "Απορρίφθηκε", Closed: "Κλειστή",
  Reopened: "Επανάνοιξη", Pending: "Εκκρεμεί", InProgress: "Σε εξέλιξη",
  Completed: "Ολοκληρώθηκε", Resolved: "Επιλύθηκε", Paid: "Πληρώθηκε",
};
const TYPE_LABELS: Record<string, string> = {
  Auto: "Οχήματα", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Marine: "Μεταφορές", Other: "Άλλο"
};
const trStatus = (v: string) => STATUS_LABELS[v] ?? v;
const trType   = (v: string) => TYPE_LABELS[v] ?? v;

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


      <DashboardSummary />

      {/* Grid — rendered for every package the tenant actually owns. This is
          important for a single-package office too: the operator must still
          have a visible entry point for that package's workspace. */}
      {(() => {
        const enabledPackages = PACKAGES.filter(p => isPlatformBypass || has(p.code));
        if (enabledPackages.length === 0) return null;
        return (
      <Box sx={{
        display: "grid",
        gap: { xs: 2, md: 2.5 },
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
                // Permanent navy-tinted frame — matches the KPI + chart
                // containers so the whole hub reads as one design system.
                borderColor: (theme) => active
                  ? (theme.palette.mode === "dark" ? "#6fd2ff" : ACCENT)
                  : enabled
                    ? (theme.palette.mode === "dark" ? "rgba(148,191,230,0.32)" : "rgba(11,37,69,0.32)")
                  : "divider",
                borderWidth: active ? 2.5 : 1.5,
                borderRadius: 2.5,
                bgcolor: active ? (theme) => theme.palette.mode === "dark" ? "rgba(31,123,179,0.16)" : "rgba(31,123,179,0.06)" : "background.paper",
                opacity: enabled ? 1 : 0.65,
                overflow: "hidden",
                boxShadow: active ? 5 : undefined,
                transition: "transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms cubic-bezier(.22,.61,.36,1), border-color 220ms ease",
                "&:hover": enabled ? {
                  transform: "translateY(-3px)",
                  borderColor: "primary.main",
                  boxShadow: 6,
                } : {},
                "&:active": enabled ? { transform: "translateY(-1px)", transition: "transform 80ms ease" } : {},
                // Accent line pinned to the bottom — grows in on hover.
                "&::after": enabled ? {
                  content: '""',
                  position: "absolute",
                  left: 0, right: 0, bottom: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${ACCENT}, ${INK})`,
                  transform: active ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 360ms cubic-bezier(.22,.61,.36,1)"
                } : {},
                "&:hover::after": enabled ? { transform: "scaleX(1)" } : {}
              }}
            >
              {active && (
                <Box sx={{
                  position: "absolute", top: 12, right: 14, zIndex: 3,
                  display: "inline-flex", alignItems: "center", gap: 0.5,
                  px: 1, py: 0.45, borderRadius: 99,
                  bgcolor: ACCENT, color: "#fff",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                  boxShadow: `0 3px 10px ${ACCENT}55`,
                }}>
                  <CheckCircleIcon sx={{ fontSize: 15 }} />
                  Ενεργό
                </Box>
              )}
              {/* Permanent L-bracket ornament in the bottom-right corner —
                  two thick navy strokes making the card feel like a labeled,
                  bordered container even when idle. Sits behind the click
                  surface via pointer-events: none. */}
              {enabled && (
                <>
                  <Box aria-hidden sx={{
                    position: "absolute",
                    right: 14, bottom: 14, width: 76, height: 3,
                    bgcolor: INK, borderRadius: 1,
                    pointerEvents: "none",
                    boxShadow: `0 1px 0 ${INK}20`,
                  }} />
                  <Box aria-hidden sx={{
                    position: "absolute",
                    right: 14, bottom: 14, width: 3, height: 42,
                    bgcolor: ACCENT, borderRadius: 1,
                    pointerEvents: "none",
                    boxShadow: `0 0 0 1px ${ACCENT}20`,
                  }} />
                </>
              )}
              <CardActionArea
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) { navigate("/pricing"); return; }
                  enter(pkg.code);
                  navigate(WORKSPACE_DEFAULT_ROUTE[pkg.code]);
                }}
                sx={{ height: "100%", alignItems: "stretch" }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
                  <Box
                    component="img"
                    src={pkg.image}
                    alt=""
                    aria-hidden="true"
                    sx={{
                      position: "absolute",
                      top: { xs: 14, md: 18 },
                      right: { xs: 10, md: 18 },
                      // Keep the illustration clear of the heading.  The
                      // artwork has an opaque background, so an oversized
                      // image can otherwise cover the end of
                      // “BackOffice — Λογιστήριο” on compact cards.
                      width: { xs: 118, sm: 142, md: 158 },
                      height: { xs: 86, sm: 102, md: 114 },
                      objectFit: "contain",
                      opacity: enabled ? 0.92 : 0.22,
                      zIndex: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                      transition: "transform 260ms ease, opacity 220ms ease"
                    }}
                  />
                  {/* Header — themed icon badge, matching the AnimatedKpiCard style
                      used on the dashboards. No monospace I/II tag anymore. */}
                  <Box sx={{
                    width: 48, height: 48,
                    borderRadius: 1.5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: enabled ? `${INK}12` : "action.disabledBackground",
                    color: enabled ? INK : "text.disabled",
                    mb: 2,
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
                    position: "relative",
                    zIndex: 1,
                    letterSpacing: "-0.005em"
                  }}>
                    {t(pkg.nameKey)}
                  </Typography>

                  <Typography sx={{
                    color: "text.secondary",
                    fontSize: 14,
                    lineHeight: 1.55,
                    position: "relative",
                    zIndex: 1,
                    flex: 1
                  }}>
                    {t(pkg.bodyKey)}
                  </Typography>

                  {/* Footer arrow */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{
                    mt: 2.5, pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    position: "relative",
                    zIndex: 1,
                    color: enabled ? "primary.main" : "text.disabled",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase"
                  }}>
                    <span>{active ? "Ενεργό πακέτο" : enabled ? t("ws.hub.open") : t("ws.hub.locked")}</span>
                    {active ? <CheckCircleIcon sx={{ fontSize: 17 }} /> : enabled && <ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  </Stack>
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

/* ============================================================================
   Compact dashboard summary — sits between the greeting and the workspace
   cards. Four KPI tiles + one tiny monthly-premium area chart so the user
   has a glance at how the agency is doing without leaving the hub.
   ============================================================================ */
function LegacyDashboardSummary() {
  const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const intFmt   = new Intl.NumberFormat("el-GR");
  const q = useQuery({
    queryKey: ["agency-report-hub"],
    queryFn: async () => (await api.get<AgencyReport>("/reports/agency")).data,
    staleTime: 60_000
  });
  const [openPanels, setOpenPanels] = useLocalState<Set<string>>(() => new Set());
  const togglePanel = (key: string) => setOpenPanels(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (q.isLoading) return null; // silent — hub already has plenty above the fold
  if (!q.data)     return null;
  const k = q.data.kpis;
  const series = q.data.monthlyPremium.slice(-6);
  const statuses = q.data.policiesByStatus ?? [];
  const carriers = (q.data.topCarriers ?? []).slice(0, 5);
  const claims   = q.data.claimsByStatus ?? [];
  const types    = q.data.policiesByType ?? [];

  const premiumSpark = series.map(p => Number(p.value));
  const secondaryData = claims.length > 0 ? claims : types;
  const secondaryTitle = claims.length > 0 ? "Ζημίες ανά κατάσταση" : "Κατανομή κλάδων";
  // Palette override so the status donut keeps its meaningful colours
  // (green = active, red = cancelled, …) instead of the default rainbow.
  const statusColors = statuses.map((s, i) =>
    STATUS_PALETTE[s.label] ?? CHART_PALETTE[i % CHART_PALETTE.length]);

  return (
    <Box sx={{ mb: { xs: 4, md: 5 } }}>
      {/* KPI row + monthly chart — animated cards, matching the dashboard style. */}
      <Box sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr) 1.5fr" }
      }}>
        <SummaryMetric label="Πελάτες" value={k.customers} accent={INK} icon={<PeopleAltIcon />}
          open={openPanels.has("customers")} onToggle={() => togglePanel("customers")} index={0} />
        <SummaryMetric label="Ενεργά συμβόλαια" value={k.activePolicies} accent="#16a34a" icon={<PolicyIcon />}
          open={openPanels.has("activePolicies")} onToggle={() => togglePanel("activePolicies")} index={1} />
        <SummaryMetric label="Λήγουν σύντομα" value={k.expiringSoon} accent="#a05a00" icon={<EventBusyIcon />}
          open={openPanels.has("expiringSoon")} onToggle={() => togglePanel("expiringSoon")} index={2} />
        <SummaryMetric label="Ασφάλιστρα μήνα" value={k.monthlyPremium} currency accent={ACCENT} icon={<EuroIcon />}
          open={openPanels.has("monthlyPremium")} onToggle={() => togglePanel("monthlyPremium")} index={3} />
        <MiniChartCard title="Παραγωγή 6 μηνών"
          rightLabel={moneyFmt.format(series.reduce((s, p) => s + p.value, 0))}
          kind="area" isEmpty={premiumSpark.every(v => !v)}
          open={openPanels.has("monthlyTrend")} onToggle={() => togglePanel("monthlyTrend")}>
          <ModernAreaChart data={series} color={ACCENT}
            format={(v) => moneyFmt.format(v)} />
        </MiniChartCard>
      </Box>

      {/* Second row — three small charts side-by-side. Each ~150 px tall.
          Each card advertises its chart kind + empty-state so the hover
          skeleton hints at what would appear once data is loaded. */}
      <Box sx={{
        mt: 1.5,
        display: "grid", gap: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }
      }}>
        <MiniChartCard title="Συμβόλαια ανά κατάσταση"
          rightLabel={`${intFmt.format(statuses.reduce((s, x) => s + x.value, 0))}`} height={150}
          kind="donut" isEmpty={statuses.length === 0 || statuses.every(s => !s.value)}
          open={openPanels.has("status")} onToggle={() => togglePanel("status")}>
          <ModernDonutChart
            data={statuses.map(s => ({ label: trStatus(s.label), value: s.value }))}
            colors={statusColors}
            format={(v) => intFmt.format(v)}
          />
        </MiniChartCard>

        <MiniChartCard title="Κορυφαίες εταιρίες"
          rightLabel={carriers.length > 0 ? carriers[0].carrier : "—"} height={150}
          kind="bar" isEmpty={carriers.length === 0}
          open={openPanels.has("carriers")} onToggle={() => togglePanel("carriers")}>
          <ModernBarChart
            data={carriers.map(c => ({ label: c.carrier, value: Number(c.premium) }))}
            color={ACCENT}
            format={(v) => moneyFmt.format(v)}
          />
        </MiniChartCard>

        <MiniChartCard
          title={secondaryTitle}
          rightLabel={`${intFmt.format(secondaryData.reduce((s, x) => s + x.value, 0))}`}
          height={150}
          kind="area" isEmpty={secondaryData.length === 0 || secondaryData.every(x => !x.value)}
          open={openPanels.has("secondary")} onToggle={() => togglePanel("secondary")}>
          <ModernAreaChart
            data={secondaryData.map(x => ({
              label: claims.length > 0 ? trStatus(x.label) : trType(x.label),
              value: x.value,
            }))}
            color={INK}
            format={(v) => intFmt.format(v)}
          />
        </MiniChartCard>
      </Box>
    </Box>
  );
}

void LegacyDashboardSummary;

function DashboardSummary() {
  const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const intFmt = new Intl.NumberFormat("el-GR");
  const q = useQuery({
    queryKey: ["agency-report-hub"],
    queryFn: async () => (await api.get<AgencyReport>("/reports/agency")).data,
    staleTime: 60_000,
  });
  const [showAnalytics, setShowAnalytics] = useLocalState(false);

  if (q.isLoading || !q.data) return null;

  const k = q.data.kpis;
  const series = q.data.monthlyPremium.slice(-6);
  const statuses = q.data.policiesByStatus ?? [];
  const carriers = (q.data.topCarriers ?? []).slice(0, 5);
  const claims = q.data.claimsByStatus ?? [];
  const types = q.data.policiesByType ?? [];

  const monthlyData = series.map(point => ({ label: point.label, value: Number(point.value) }));
  const cumulativeData = monthlyData.reduce<{ label: string; a: number; b: number }[]>((result, point) => {
    const previous = result[result.length - 1]?.b ?? 0;
    result.push({ label: point.label, a: point.value, b: previous + point.value });
    return result;
  }, []);
  const statusData = statuses.map(item => ({ label: trStatus(item.label), value: item.value }));
  const carrierData = carriers.map(item => ({ label: item.carrier, value: Number(item.premium) }));
  const typeData = types.map(item => ({ label: trType(item.label), value: item.value }));
  const claimData = claims.map(item => ({ label: trStatus(item.label), value: item.value }));
  const statusColors = statuses.map((item, index) => STATUS_PALETTE[item.label] ?? CHART_PALETTE[index % CHART_PALETTE.length]);

  return (
    <Box sx={{ mb: { xs: 4, md: 5 } }}>
      {!showAnalytics ? (
        <Card variant="outlined" sx={{
          borderRadius: 2.5,
          border: "1.5px solid",
          borderColor: "rgba(11,37,69,0.28)",
          bgcolor: "background.paper",
          overflow: "hidden",
          animation: "summaryPanelIn 260ms ease both",
          "@keyframes summaryPanelIn": { from: { opacity: 0, transform: "scale(.985)" }, to: { opacity: 1, transform: "scale(1)" } },
        }}>
          <CardActionArea onClick={() => setShowAnalytics(true)} sx={{ p: { xs: 1.75, md: 2.25 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, bgcolor: `${ACCENT}15`, flexShrink: 0 }}>
                <InsightsIcon />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 800, color: INK, fontSize: { xs: 15, md: 17 } }}>
                  Στατιστικά &amp; γραφήματα
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ανοίξτε όλους τους δείκτες και τις αναλύσεις του γραφείου σε ένα ενιαίο panel · 6 δείκτες · 6 γραφήματα
                </Typography>
              </Box>
              <ExpandMoreIcon color="action" />
            </Stack>
          </CardActionArea>
        </Card>
      ) : (
        <Card variant="outlined" sx={{
          borderRadius: 2.5,
          border: "1.5px solid",
          borderColor: "rgba(11,37,69,0.28)",
          bgcolor: "background.paper",
          overflow: "hidden",
          animation: "summaryPanelIn 260ms ease both",
          "@keyframes summaryPanelIn": { from: { opacity: 0, transform: "scale(.985)" }, to: { opacity: 1, transform: "scale(1)" } },
        }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2.25 }, "&:last-child": { pb: { xs: 1.5, md: 2.25 } } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1.25} sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <InsightsIcon sx={{ color: ACCENT }} />
                <Box>
                  <Typography sx={{ fontWeight: 800, color: INK }}>Στατιστικά &amp; γραφήματα</Typography>
                  <Typography variant="caption" color="text.secondary">Συγκεντρωτική εικόνα παραγωγής, συμβολαίων και ζημιών</Typography>
                </Box>
              </Stack>
              <Button variant="outlined" size="small" onClick={() => setShowAnalytics(false)} endIcon={<ExpandLessIcon />}
                sx={{ alignSelf: { xs: "flex-start", sm: "auto" }, borderColor: "rgba(11,37,69,0.3)", color: INK, fontWeight: 700 }}>
                Απόκρυψη
              </Button>
            </Stack>

            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" }, mb: 1.5 }}>
              <AnimatedKpiCard index={0} label="Πελάτες" value={k.customers} accent={INK} icon={<PeopleAltIcon />} />
              <AnimatedKpiCard index={1} label="Ενεργά συμβόλαια" value={k.activePolicies} accent="#16a34a" icon={<PolicyIcon />} />
              <AnimatedKpiCard index={2} label="Λήγουν σύντομα" value={k.expiringSoon} accent="#a05a00" icon={<EventBusyIcon />} />
              <AnimatedKpiCard index={3} label="Ασφάλιστρα μήνα" value={k.monthlyPremium} currency accent={ACCENT} icon={<EuroIcon />} />
              <AnimatedKpiCard index={4} label="Ανοιχτές ζημιές" value={k.openClaims} accent="#dc2626" icon={<ReportProblemIcon />} />
              <AnimatedKpiCard index={5} label="Εκκρεμή αιτήματα" value={k.openRequests} accent="#7c3aed" icon={<AssignmentLateIcon />} />
            </Box>

            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
              <ChartCard title="Ασφάλιστρα τελευταίων 6 μηνών" subtitle={moneyFmt.format(monthlyData.reduce((sum, item) => sum + item.value, 0))} height={220}>
                {monthlyData.length > 0 ? <ModernAreaChart data={monthlyData} color={ACCENT} format={(value) => moneyFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
              <ChartCard title="Συσσωρευμένα ασφάλιστρα" subtitle="Συνολική πορεία περιόδου" height={220}>
                {cumulativeData.length > 0 ? <ModernDualLineChart data={cumulativeData} aLabel="Μηνιαία" bLabel="Συσσωρευμένα" aColor={ACCENT} bColor={INK} format={(value) => moneyFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
              <ChartCard title="Συμβόλαια ανά κατάσταση" subtitle={`${intFmt.format(statusData.reduce((sum, item) => sum + item.value, 0))} συνολικά`} height={220}>
                {statusData.length > 0 ? <ModernDonutChart data={statusData} colors={statusColors} format={(value) => intFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
              <ChartCard title="Κλάδοι συμβολαίων" subtitle="Κατανομή χαρτοφυλακίου" height={220}>
                {typeData.length > 0 ? <ModernBarChart data={typeData} color={INK} format={(value) => intFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
              <ChartCard title="Κορυφαίες ασφαλιστικές" subtitle="Με βάση τα ασφάλιστρα" height={220}>
                {carrierData.length > 0 ? <ModernBarChart data={carrierData} color={ACCENT} format={(value) => moneyFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
              <ChartCard title="Ζημιές ανά κατάσταση" subtitle="Ανοιχτές και ολοκληρωμένες ζημιές" height={220}>
                {claimData.length > 0 ? <ModernDonutChart data={claimData} colors={["#dc2626", "#d97706", "#16a34a", "#64748b"]} format={(value) => intFmt.format(value)} /> : <HubChartEmpty />}
              </ChartCard>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function HubChartEmpty() {
  return (
    <Stack sx={{ height: "100%" }} alignItems="center" justifyContent="center" spacing={0.5}>
      <Typography variant="body2" color="text.secondary">Δεν υπάρχουν δεδομένα ακόμη</Typography>
      <Typography variant="caption" color="text.disabled">Τα στοιχεία θα εμφανιστούν μόλις καταχωρηθούν εγγραφές.</Typography>
    </Stack>
  );
}

function SummaryMetric({ label, value, currency, accent, icon, open, onToggle, index }: {
  label: string;
  value: number;
  currency?: boolean;
  accent: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  if (!open) {
    return (
      <Card variant="outlined" sx={{
        borderRadius: 2.5,
        border: "1.5px solid",
        borderColor: `${accent}55`,
        bgcolor: "background.paper",
        minHeight: 112,
        animation: "summaryPanelIn 260ms ease both",
        animationDelay: `${index * 40}ms`,
        "@keyframes summaryPanelIn": { from: { opacity: 0, transform: "scale(.98)" }, to: { opacity: 1, transform: "scale(1)" } },
      }}>
        <CardActionArea onClick={onToggle} sx={{ height: "100%", minHeight: 112, p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", color: accent, bgcolor: `${accent}15`, flexShrink: 0 }}>
              {icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.2, letterSpacing: "0.08em" }}>{label}</Typography>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>Πατήστε για προβολή</Typography>
            </Box>
            <ExpandMoreIcon color="action" />
          </Stack>
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Box sx={{ position: "relative", minWidth: 0 }}>
      <Box sx={{ position: "absolute", zIndex: 2, right: 5, top: 4 }}>
        <ButtonBase onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={`Απόκρυψη ${label}`} sx={{ borderRadius: 1, p: 0.25, color: "text.secondary", "&:hover": { bgcolor: "action.hover" } }}>
          <ExpandLessIcon fontSize="small" />
        </ButtonBase>
      </Box>
      <Box onClick={onToggle} sx={{ cursor: "pointer" }}>
        <AnimatedKpiCard index={index} label={label} value={value} currency={currency} accent={accent} icon={icon} />
      </Box>
    </Box>
  );
}

function MiniChartCard({ title, rightLabel, children, height = 76, kind, isEmpty, open, onToggle }: {
  title: string; rightLabel?: string; children: React.ReactNode; height?: number;
  /** Optional chart-type hint so the empty-state hover shows a matching skeleton. */
  kind?: "area" | "bar" | "donut";
  /** True when the underlying data has zero rows — enables the hover skeleton. */
  isEmpty?: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (!open) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2.5, border: "1.5px solid", borderColor: "rgba(11,37,69,0.25)", bgcolor: "background.paper", minHeight: 112 }}>
        <CardActionArea onClick={onToggle} sx={{ minHeight: 112, p: 1.75 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_SOFT, fontWeight: 700 }}>{title}</Typography>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>Πατήστε για προβολή γραφήματος</Typography>
            </Box>
            <ExpandMoreIcon color="action" />
          </Stack>
        </CardActionArea>
      </Card>
    );
  }

  return (
    <Box sx={{
      // Permanent navy-tinted frame so the chart reads as a container even
      // when its data is empty — matches the AnimatedKpiCard treatment.
      border: "1.5px solid",
      borderColor: (theme) => theme.palette.mode === "dark"
        ? "rgba(148,191,230,0.28)"
        : "rgba(11,37,69,0.28)",
      borderRadius: 2.5, p: 1.75, bgcolor: "background.paper",
      transition: "border-color 220ms ease, box-shadow 220ms ease, transform 220ms ease",
      "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-1px)" },
      // Hover-only visibility for the empty-state skeleton — swap opacity so
      // the placeholder feels like an "initialising" preview rather than a
      // permanent watermark. The skeleton itself is drawn below.
      "&:hover .chart-empty-skeleton": { opacity: 0.55, transform: "translateY(0) scale(1)" }
    }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ px: 0.5, mb: 0.5 }}>
        <Typography sx={{
          fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
          color: INK_SOFT, fontWeight: 700
        }}>
          {title}
        </Typography>
        {rightLabel && (
          <Typography sx={{ fontSize: 12, color: ACCENT, fontWeight: 700, maxWidth: "55%",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {rightLabel}
          </Typography>
        )}
        <ButtonBase onClick={onToggle} aria-label={`Απόκρυψη ${title}`} sx={{ borderRadius: 1, p: 0.25, color: "text.secondary", "&:hover": { bgcolor: "action.hover" } }}>
          <ExpandLessIcon fontSize="small" />
        </ButtonBase>
      </Stack>
      <Box sx={{ position: "relative", height }}>
        {children}
        {isEmpty && kind && (
          <Box className="chart-empty-skeleton" aria-hidden sx={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            opacity: 0,
            transform: "translateY(4px) scale(.98)",
            transition: "opacity 260ms ease, transform 420ms cubic-bezier(.22,.61,.36,1)",
          }}>
            <EmptyChartSkeleton kind={kind} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Tile + DonutLegend removed — the hub now renders KPI tiles via
// AnimatedKpiCard and donut charts via ModernDonutChart (native legend),
// matching the shared dashboard design system.

/**
 * Hover-triggered SVG skeleton drawn inside empty mini-chart cards. Kind
 * picks between a bar cluster, a donut ring and an area silhouette so the
 * placeholder hints at what the chart would look like once populated. Pure
 * dashed navy strokes — no fills — so it reads as an "outline preview".
 */
function EmptyChartSkeleton({ kind }: { kind: "area" | "bar" | "donut" }) {
  const stroke = INK;
  const strokeSoft = INK_SOFT;
  if (kind === "bar") {
    // Five ascending dashed bars — the classic "no data" bar preview.
    const bars = [22, 34, 18, 46, 30];
    return (
      <svg viewBox="0 0 120 60" width="90%" height="90%" preserveAspectRatio="none">
        {bars.map((h, i) => (
          <rect key={i} x={6 + i * 22} y={56 - h} width={14} height={h}
                fill="none" stroke={stroke} strokeWidth={1.5}
                strokeDasharray="3 3" rx={2} />
        ))}
        <line x1="0" y1="56" x2="120" y2="56" stroke={strokeSoft}
              strokeWidth={1} strokeDasharray="2 4" />
      </svg>
    );
  }
  if (kind === "donut") {
    // Dashed ring + a subtle wedge indicator so the shape reads as a donut.
    return (
      <svg viewBox="0 0 120 60" width="90%" height="90%" preserveAspectRatio="xMidYMid meet">
        <circle cx="60" cy="30" r="22" fill="none" stroke={stroke}
                strokeWidth={2} strokeDasharray="4 4" />
        <circle cx="60" cy="30" r="10" fill="none" stroke={strokeSoft}
                strokeWidth={1} strokeDasharray="2 3" />
        <path d="M60 8 A22 22 0 0 1 82 30" fill="none" stroke={ACCENT}
              strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  // Area / line — a dashed silhouette with a filled baseline hint.
  return (
    <svg viewBox="0 0 120 60" width="95%" height="95%" preserveAspectRatio="none">
      <polyline points="4,46 24,32 44,38 64,20 84,26 104,12 116,18"
                fill="none" stroke={stroke} strokeWidth={1.8}
                strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="4,56 24,56 44,56 64,56 84,56 104,56 116,56"
                fill="none" stroke={strokeSoft} strokeWidth={1}
                strokeDasharray="2 4" />
    </svg>
  );
}
