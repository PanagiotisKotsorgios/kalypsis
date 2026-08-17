import { Alert, AlertTitle, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useState as useLocalState } from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import PeopleIcon from "@mui/icons-material/People";
import InsightsIcon from "@mui/icons-material/Insights";
import HubIcon from "@mui/icons-material/Hub";
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
import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace, WORKSPACE_DEFAULT_ROUTE } from "../auth/WorkspaceContext";
import { api } from "../api/client";
import {
  AnimatedKpiCard, ModernAreaChart, ModernBarChart, ModernDonutChart,
} from "../components/ModernDashboard";

interface PackageMeta {
  code: PackageCode;
  icon: React.ReactNode;
  nameKey: string;
  bodyKey: string;
}

// Phase 15.1 — for now only BackOffice + Crm (client portal) are operational.
// Other workspaces are intentionally hidden until they're production-ready.
const PACKAGES: PackageMeta[] = [
  { code: "BackOffice",   icon: <AccountBalanceIcon />, nameKey: "ws.BackOffice.name",   bodyKey: "ws.BackOffice.body" },
  { code: "Crm",          icon: <PeopleIcon />,         nameKey: "ws.Crm.name",          bodyKey: "ws.Crm.body" }
];
// Kept for type safety — re-enable these by moving them into PACKAGES above.
void RequestQuoteIcon; void InsightsIcon; void HubIcon;

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
  Cancelled: "#dc2626", Renewed: "#1f7bb3", Draft: "#94a3b8"
};

// Backend returns PolicyStatus / PolicyType / ClaimStatus / ServiceRequestStatus
// enum names verbatim. The workspace hub previously piped them into charts
// unchanged, so operators saw «Active / Cancelled / Auto / …» instead of
// the Greek strings the rest of the app uses. Map them here so every donut,
// bar and area chart on the hub reads natively.
const STATUS_LABELS: Record<string, string> = {
  Draft: "Πρόχειρο", Active: "Ενεργό", Expired: "Έληξε", Cancelled: "Ακυρωμένο",
  Renewed: "Ανανεώθηκε", PendingRenewal: "Προς ανανέωση",
  Undelivered: "Απαράδοτο", AwaitingIssue: "Προς έκδοση",
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
  const { enter } = useWorkspace();
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

      {/* Grid — only rendered when the tenant actually has ≥ 2 packages
          enabled. Tenants on a single package see the dashboard summary
          above and nothing else: no workspace picker, no "locked" cards
          for packages they haven't bought. PlatformAdmin/Employee always
          get every card via the bypass flag so they can still preview
          each workspace. */}
      {(() => {
        const enabledPackages = PACKAGES.filter(p => isPlatformBypass || has(p.code));
        // Hide the grid entirely when only 0 or 1 package is enabled.
        if (enabledPackages.length < 2) return null;
        return (
      <Box sx={{
        display: "grid",
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }
      }}>
        {enabledPackages.map((pkg) => {
          const enabled = isPlatformBypass || has(pkg.code);
          return (
            <Card
              key={pkg.code}
              variant="outlined"
              sx={{
                position: "relative",
                // Permanent navy-tinted frame — matches the KPI + chart
                // containers so the whole hub reads as one design system.
                borderColor: (theme) => enabled
                  ? (theme.palette.mode === "dark" ? "rgba(148,191,230,0.32)" : "rgba(11,37,69,0.32)")
                  : "divider",
                borderWidth: 1.5,
                borderRadius: 2.5,
                bgcolor: "background.paper",
                opacity: enabled ? 1 : 0.65,
                overflow: "hidden",
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
                  transform: "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 360ms cubic-bezier(.22,.61,.36,1)"
                } : {},
                "&:hover::after": enabled ? { transform: "scaleX(1)" } : {}
              }}
            >
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
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, height: "100%", display: "flex", flexDirection: "column" }}>
                  {/* Header — themed icon badge, matching the AnimatedKpiCard style
                      used on the dashboards. No monospace I/II tag anymore. */}
                  <Box sx={{
                    width: 48, height: 48,
                    borderRadius: 1.5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: enabled ? `${INK}12` : "action.disabledBackground",
                    color: enabled ? INK : "text.disabled",
                    mb: 2,
                    "& svg": { fontSize: 26 }
                  }}>
                    {enabled ? pkg.icon : <LockOutlinedIcon />}
                  </Box>

                  <Typography variant="h5" sx={{
                    fontWeight: 700,
                    color: enabled ? "text.primary" : "text.disabled",
                    lineHeight: 1.25,
                    mb: 1,
                    letterSpacing: "-0.005em"
                  }}>
                    {t(pkg.nameKey)}
                  </Typography>

                  <Typography sx={{
                    color: "text.secondary",
                    fontSize: 14,
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
                    color: enabled ? "primary.main" : "text.disabled",
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
function DashboardSummary() {
  const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const intFmt   = new Intl.NumberFormat("el-GR");
  const q = useQuery({
    queryKey: ["agency-report-hub"],
    queryFn: async () => (await api.get<AgencyReport>("/reports/agency")).data,
    staleTime: 60_000
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
        <AnimatedKpiCard index={0} label="Πελάτες" value={k.customers}
          accent={INK} icon={<PeopleAltIcon />} />
        <AnimatedKpiCard index={1} label="Ενεργά συμβόλαια" value={k.activePolicies}
          accent="#16a34a" icon={<PolicyIcon />} />
        <AnimatedKpiCard index={2} label="Λήγουν σύντομα" value={k.expiringSoon}
          accent="#a05a00" icon={<EventBusyIcon />} />
        <AnimatedKpiCard index={3} label="Ασφάλιστρα μήνα" value={k.monthlyPremium} currency
          accent={ACCENT} icon={<EuroIcon />} />
        <MiniChartCard title="Παραγωγή 6 μηνών"
          rightLabel={moneyFmt.format(series.reduce((s, p) => s + p.value, 0))}
          kind="area" isEmpty={premiumSpark.every(v => !v)}>
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
          kind="donut" isEmpty={statuses.length === 0 || statuses.every(s => !s.value)}>
          <ModernDonutChart
            data={statuses.map(s => ({ label: trStatus(s.label), value: s.value }))}
            colors={statusColors}
            format={(v) => intFmt.format(v)}
          />
        </MiniChartCard>

        <MiniChartCard title="Κορυφαίες εταιρίες"
          rightLabel={carriers.length > 0 ? carriers[0].carrier : "—"} height={150}
          kind="bar" isEmpty={carriers.length === 0}>
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
          kind="area" isEmpty={secondaryData.length === 0 || secondaryData.every(x => !x.value)}>
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

function MiniChartCard({ title, rightLabel, children, height = 76, kind, isEmpty }: {
  title: string; rightLabel?: string; children: React.ReactNode; height?: number;
  /** Optional chart-type hint so the empty-state hover shows a matching skeleton. */
  kind?: "area" | "bar" | "donut";
  /** True when the underlying data has zero rows — enables the hover skeleton. */
  isEmpty?: boolean;
}) {
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
