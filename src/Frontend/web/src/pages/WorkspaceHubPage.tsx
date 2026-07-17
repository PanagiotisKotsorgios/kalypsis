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
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line
} from "recharts";
import { useAuth } from "../auth/AuthContext";
import { usePackages, type PackageCode } from "../auth/PackagesContext";
import { useWorkspace, WORKSPACE_DEFAULT_ROUTE } from "../auth/WorkspaceContext";
import { api } from "../api/client";

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
                borderColor: enabled ? INK : "divider",
                borderWidth: enabled ? 1.5 : 1,
                bgcolor: "background.paper",
                opacity: enabled ? 1 : 0.65,
                overflow: "hidden",
                transition: "transform 220ms cubic-bezier(.22,.61,.36,1), box-shadow 220ms cubic-bezier(.22,.61,.36,1), border-color 220ms ease",
                "&:hover": enabled ? {
                  transform: "translateY(-3px)",
                  borderColor: INK,
                  boxShadow: `0 12px 24px -12px ${INK}30, 0 2px 0 0 ${ACCENT}`
                } : {},
                "&:active": enabled ? { transform: "translateY(-1px)", transition: "transform 80ms ease" } : {},
                // Cyan accent line that grows in on hover (was gold).
                "&::after": enabled ? {
                  content: '""',
                  position: "absolute",
                  left: 0, right: 0, bottom: 0,
                  height: 2,
                  background: ACCENT,
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
                      borderColor: enabled ? ACCENT : "divider",
                      color: enabled ? ACCENT : "text.disabled",
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

  return (
    <Box sx={{ mb: { xs: 4, md: 5 } }}>
      {/* KPI row + monthly chart */}
      <Box sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr) 1.5fr" }
      }}>
        <Tile label="Πελάτες"           value={intFmt.format(k.customers)} />
        <Tile label="Ενεργά συμβόλαια"  value={intFmt.format(k.activePolicies)} />
        <Tile label="Λήγουν σύντομα"    value={intFmt.format(k.expiringSoon)} accent="warning" />
        <Tile label="Ασφάλιστρα μήνα"   value={moneyFmt.format(k.monthlyPremium)} />
        <MiniChartCard title="Παραγωγή 6 μηνών"
          rightLabel={moneyFmt.format(series.reduce((s, p) => s + p.value, 0))}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="hubArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={ACCENT} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <RTooltip
                contentStyle={{ borderRadius: 8, border: `1px solid #e5e9ef`, fontSize: 12 }}
                formatter={(v: any) => moneyFmt.format(Number(v) || 0)} />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2}
                fill="url(#hubArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </MiniChartCard>
      </Box>

      {/* Second row — three small charts side-by-side. Each ~140 px tall. */}
      <Box sx={{
        mt: 1.5,
        display: "grid", gap: 1.5,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }
      }}>
        {/* Donut — policies by status */}
        <MiniChartCard title="Συμβόλαια ανά κατάσταση"
          rightLabel={`${intFmt.format(statuses.reduce((s, x) => s + x.value, 0))}`} height={150}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statuses} dataKey="value" nameKey="label"
                cx="35%" cy="50%" innerRadius={28} outerRadius={50}
                paddingAngle={2} strokeWidth={0}>
                {statuses.map((s, i) =>
                  <Cell key={s.label} fill={STATUS_PALETTE[s.label] ?? CHART_PALETTE[i % CHART_PALETTE.length]} />
                )}
              </Pie>
              <RTooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e9ef", fontSize: 12 }}
                formatter={(v: any, n: any) => [intFmt.format(Number(v) || 0), n]} />
            </PieChart>
          </ResponsiveContainer>
          <DonutLegend items={statuses} colorOf={(label, i) =>
            STATUS_PALETTE[label] ?? CHART_PALETTE[i % CHART_PALETTE.length]} />
        </MiniChartCard>

        {/* Horizontal-ish bar — top 5 carriers by premium */}
        <MiniChartCard title="Κορυφαίες εταιρίες"
          rightLabel={carriers.length > 0 ? carriers[0].carrier : "—"} height={150}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={carriers} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="carrier" tick={{ fontSize: 10, fill: INK_SOFT }}
                tickLine={false} interval={0} />
              <YAxis hide />
              <RTooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e9ef", fontSize: 12 }}
                formatter={(v: any) => moneyFmt.format(Number(v) || 0)} />
              <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
                {carriers.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MiniChartCard>

        {/* Small line — claims by status (or policies-by-type fallback) */}
        <MiniChartCard
          title={claims.length > 0 ? "Ζημίες ανά κατάσταση" : "Κατανομή κλάδων"}
          rightLabel={`${intFmt.format((claims.length > 0 ? claims : types).reduce((s, x) => s + x.value, 0))}`}
          height={150}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={claims.length > 0 ? claims : types} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: INK_SOFT }} tickLine={false} interval={0} />
              <YAxis hide />
              <RTooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e9ef", fontSize: 12 }}
                formatter={(v: any) => intFmt.format(Number(v) || 0)} />
              <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5}
                dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </MiniChartCard>
      </Box>
    </Box>
  );
}

function MiniChartCard({ title, rightLabel, children, height = 76 }: {
  title: string; rightLabel?: string; children: React.ReactNode; height?: number;
}) {
  return (
    <Box sx={{
      border: "1px solid", borderColor: "divider",
      borderRadius: 2, p: 1.5, bgcolor: "#fff"
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
      <Box sx={{ height }}>
        {children}
      </Box>
    </Box>
  );
}

function DonutLegend({ items, colorOf }: {
  items: DashSeries[]; colorOf: (label: string, i: number) => string;
}) {
  return (
    <Stack spacing={0.4} sx={{
      position: "relative", mt: -7.5, ml: "65%", maxHeight: 75, overflow: "hidden"
    }}>
      {items.slice(0, 4).map((s, i) => (
        <Stack key={s.label} direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: colorOf(s.label, i) }} />
          <Typography sx={{ fontSize: 10.5, color: "#3d4f6b", fontWeight: 600, lineHeight: 1 }}>
            {s.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  return (
    <Box sx={{
      border: "1px solid", borderColor: "divider",
      borderRadius: 2, p: 1.75, bgcolor: "#fff"
    }}>
      <Typography sx={{
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: INK_SOFT, fontWeight: 700, mb: 0.5
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: accent === "warning" ? "#a05a00" : INK,
        letterSpacing: "-0.01em", lineHeight: 1.1
      }}>
        {value}
      </Typography>
    </Box>
  );
}
