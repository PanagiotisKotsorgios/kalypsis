import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import GroupsIcon from "@mui/icons-material/Groups";
import EuroIcon from "@mui/icons-material/Euro";
import SecurityIcon from "@mui/icons-material/Security";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import PaymentsIcon from "@mui/icons-material/Payments";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../../api/client";
import { date, dateTime } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { Link as RouterLink } from "react-router-dom";

/**
 * SuperAdmin dashboard — SaaS-focused metrics only.
 *
 * The old page mixed insurance-domain counters (customers, active policies,
 * open claims, premium volume) into the platform view. Those numbers belong
 * to individual tenants; the platform operator needs a different lens:
 * how many offices, how many users, how much revenue, what pricing is in
 * play. Insurance-domain data is intentionally excluded here — it lives in
 * the per-tenant impersonation view.
 */

interface PlatformKpi {
  tenants: number;
  activeTenants: number;
  users: number;
  activeUsers7d: number;
  activeUsers30d: number;
  /* The remaining fields (customers, activePolicies, openClaims, openRequests,
     totalPremiumVolume, monthlyPremiumVolume) are still returned by the
     backend for other consumers but deliberately ignored on this screen. */
}
interface SeriesPoint { label: string; value: number }
interface SubscriptionShare { plan: string; tenants: number }
interface TenantHeadline {
  tenantId: string;
  name: string;
  plan: string;
  users: number;
  customers: number;
  policies: number;
  premium: number;
  createdAt: string;
  onboardingCompletedAt?: string | null;
}
interface PlatformActivity { kind: string; label: string; occurredAt: string }
interface SystemHealth {
  apiOk: boolean;
  totalNotifications30d: number;
  failedLoginAttempts24h: number;
  lockedAccounts: number;
  anonymizedCustomers: number;
  auditEvents24h: number;
}
interface PlatformReport {
  kpis: PlatformKpi;
  subscriptionMix: SubscriptionShare[];
  newTenantsByMonth: SeriesPoint[];
  recentTenants: TenantHeadline[];
  recentActivity: PlatformActivity[];
  health: SystemHealth;
}

interface BillingSummary {
  monthlyTotal: number;
  annualTotal: number;
  tenantsTotal: number;
  tenantsWithRevenue: number;
  averageRevenuePerTenant: number;
  currency: string;
  byPackage: { package: string; tenantCount: number; monthlyTotal: number }[];
}

interface PlanDef {
  code: string;
  tagline: string;
  pricePerYear: number;
  includedOffices: number;
  includedUsers: number;
  extraOfficePerYear: number;
  extraUserPerYear: number;
  packages: string[];
}
interface AddonDef { code: string; description: string; pricePerYear: number }
interface ServiceDef { code: string; description: string; unitLabel: string; unitPrice: number }
interface PricingCatalog { version: number; plans: PlanDef[]; addons: AddonDef[]; services: ServiceDef[] }

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat("el-GR");
const PLAN_LABEL: Record<string, string> = {
  Trial: "Trial",
  Starter: "Starter",
  Professional: "Professional",
  Enterprise: "Enterprise"
};

export function PlatformDashboard() {
  const theme = useTheme();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["report", "platform"],
    queryFn: async () => (await api.get<PlatformReport>("/reports/platform")).data
  });
  const billing = useQuery({
    queryKey: ["platform-billing", "summary"],
    queryFn: async () => (await api.get<BillingSummary>("/platform/billing/summary")).data
  });
  const pricing = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: async () => (await api.get<PricingCatalog>("/platform/pricing")).data
  });

  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError || !q.data) {
    return <Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Αδυναμία φόρτωσης."}</Alert>;
  }
  const r = q.data;

  const pieColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.error.main,
    "#8b5cf6"
  ];

  const mrr = billing.data?.monthlyTotal ?? 0;
  const arr = billing.data?.annualTotal ?? 0;
  const arpu = billing.data?.averageRevenuePerTenant ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πίνακας Πλατφόρμας</Typography>
          <Typography color="text.secondary">
            Καλώς ήρθατε, {user?.firstName ?? user?.email} — επισκόπηση SaaS λειτουργίας
          </Typography>
        </Box>
        <Chip
          label={r.health.apiOk ? "API healthy" : "API degraded"}
          color={r.health.apiOk ? "success" : "error"}
          icon={<HealthAndSafetyIcon />}
        />
      </Stack>

      {/* ============ Primary SaaS KPI row ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }
      }}>
        <BigKpi
          icon={<BusinessIcon />} label="Γραφεία"
          primary={intFmt.format(r.kpis.tenants)}
          secondary={`${intFmt.format(r.kpis.activeTenants)} ενεργά`}
          accent={theme.palette.primary.main}
        />
        <BigKpi
          icon={<GroupsIcon />} label="Χρήστες"
          primary={intFmt.format(r.kpis.users)}
          secondary={`${intFmt.format(r.kpis.activeUsers30d)} ενεργοί / 30ημ`}
          accent={theme.palette.info.main}
        />
        <BigKpi
          icon={<EuroIcon />} label="MRR"
          primary={moneyFmt.format(mrr)}
          secondary={`ARR ${moneyFmt.format(arr)}`}
          accent={theme.palette.success.main}
        />
        <BigKpi
          icon={<SecurityIcon />} label="Ασφάλεια"
          primary={`${intFmt.format(r.health.failedLoginAttempts24h)} ⚠`}
          secondary={`${intFmt.format(r.health.lockedAccounts)} κλειδωμένοι · ${intFmt.format(r.health.auditEvents24h)} audit /24h`}
          accent={theme.palette.warning.main}
        />
      </Box>

      {/* ============ SaaS operational counters ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }
      }}>
        <SmallKpi label="ARPU" value={moneyFmt.format(arpu)} accent={theme.palette.success.main} />
        <SmallKpi label="Γραφεία με έσοδα"
          value={billing.data ? `${billing.data.tenantsWithRevenue} / ${billing.data.tenantsTotal}` : "—"}
          accent={theme.palette.primary.main} />
        <SmallKpi label="Ενεργοί 7ημ" value={intFmt.format(r.kpis.activeUsers7d)} accent={theme.palette.info.main} />
        <SmallKpi label="Ειδοποιήσεις 30ημ" value={intFmt.format(r.health.totalNotifications30d)} accent={theme.palette.secondary.main} />
      </Box>

      {/* ============ Πώς χρεώνουμε — τρέχον πακέτο τιμών ============ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CreditCardIcon color="primary" />
              <Typography variant="h6">Πώς χρεώνουμε αυτή τη στιγμή</Typography>
            </Stack>
            <Button size="small" component={RouterLink} to="/app/platform/plans" variant="outlined">
              Επεξεργασία πλάνων
            </Button>
          </Stack>
          {!pricing.data ? <CircularProgress size={20} /> : (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" } }}>
              {pricing.data.plans.map(p => (
                <Box key={p.code} sx={{
                  border: 1, borderColor: "divider", borderRadius: 2, p: 2,
                  display: "flex", flexDirection: "column", gap: 0.5
                }}>
                  <Typography variant="overline" color="text.secondary">{p.code}</Typography>
                  <Typography variant="h5" fontWeight={800}>{moneyFmt.format(p.pricePerYear)}<Typography component="span" variant="caption" color="text.secondary"> /έτος</Typography></Typography>
                  <Typography variant="caption" color="text.secondary">{p.tagline}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Περιλαμβάνει {p.includedOffices} γραφεία · {p.includedUsers} χρήστες
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Extra γραφείο {moneyFmt.format(p.extraOfficePerYear)}/έτος · extra χρήστης {moneyFmt.format(p.extraUserPerYear)}/έτος
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {pricing.data && pricing.data.services.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" color="text.secondary">Έκτακτες υπηρεσίες</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mt={1}>
                {pricing.data.services.map(s => (
                  <Chip key={s.code} label={`${s.description}: ${moneyFmt.format(s.unitPrice)} / ${s.unitLabel}`} variant="outlined" size="small" />
                ))}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ Charts: subscription mix + new tenants ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Subscription mix</Typography>
              <Chip size="small" icon={<PaymentsIcon />} label={`${intFmt.format(r.subscriptionMix.reduce((s, x) => s + x.tenants, 0))} γραφεία`} variant="outlined" />
            </Stack>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={r.subscriptionMix.map(p => ({ name: PLAN_LABEL[p.plan] ?? p.plan, value: p.tenants }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={56} outerRadius={100} paddingAngle={2}
                  >
                    {r.subscriptionMix.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Νέα γραφεία ανά μήνα</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.newTenantsByMonth.map(p => ({ month: p.label, value: p.value }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={theme.palette.success.main} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ============ Recent feeds ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Πρόσφατα γραφεία</Typography>
            {r.recentTenants.length === 0 ? (
              <Typography color="text.secondary">—</Typography>
            ) : (
              <Stack spacing={1.5} divider={<Divider />}>
                {r.recentTenants.map((t) => (
                  <Stack key={t.tenantId} direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={700}
                        component={RouterLink} to={`/app/tenants/${t.tenantId}`}
                        sx={{ color: "primary.main", textDecoration: "none" }}>
                        {t.name}
                      </Typography>
                      <Stack direction="row" spacing={1} mt={0.5}>
                        <Chip size="small" label={PLAN_LABEL[t.plan] ?? t.plan} variant="outlined" />
                        <Chip size="small" label={`${t.users} χρ.`} variant="outlined" />
                        {t.onboardingCompletedAt && <Chip size="small" label="onboarded" color="success" />}
                      </Stack>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {date(t.createdAt)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Πρόσφατη δραστηριότητα</Typography>
            {r.recentActivity.length === 0 ? (
              <Typography color="text.secondary">—</Typography>
            ) : (
              <Stack spacing={1.5} divider={<Divider />}>
                {r.recentActivity.slice(0, 8).map((a, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip size="small"
                        label={a.kind === "tenant" ? "Γραφείο" : a.kind === "user" ? "Χρήστης" : a.kind === "audit" ? "Audit" : a.kind}
                        color={a.kind === "audit" ? "warning" : "primary"}
                        variant={a.kind === "audit" ? "outlined" : "filled"}
                      />
                      <Typography>{a.label}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {dateTime(a.occurredAt)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ============ Top tenants by users ============ */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Top γραφεία ανά χρήστες</Typography>
          {r.recentTenants.length === 0 ? <Typography color="text.secondary">—</Typography> : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Γραφείο</TableCell>
                  <TableCell>Πλάνο</TableCell>
                  <TableCell align="right">Χρήστες</TableCell>
                  <TableCell align="right">Ημ/νία έναρξης</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...r.recentTenants].sort((a, b) => b.users - a.users).slice(0, 10).map((t) => (
                  <TableRow key={t.tenantId} hover>
                    <TableCell>
                      <Typography component={RouterLink} to={`/app/tenants/${t.tenantId}`}
                        sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}>
                        {t.name}
                      </Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={PLAN_LABEL[t.plan] ?? t.plan} variant="outlined" /></TableCell>
                    <TableCell align="right"><strong>{intFmt.format(t.users)}</strong></TableCell>
                    <TableCell align="right">{date(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ============ System health summary ============ */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Υγεία συστήματος</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
            <HealthTile label="API status" value={r.health.apiOk ? "OK" : "DEGRADED"} good={r.health.apiOk} />
            <HealthTile label="Failed logins" value={intFmt.format(r.health.failedLoginAttempts24h)} good={r.health.failedLoginAttempts24h < 10} />
            <HealthTile label="Locked accounts" value={intFmt.format(r.health.lockedAccounts)} good={r.health.lockedAccounts === 0} />
            <HealthTile label="Audit events / 24h" value={intFmt.format(r.health.auditEvents24h)} good={true} />
            <HealthTile label="Ειδοποιήσεις 30ημ" value={intFmt.format(r.health.totalNotifications30d)} good={true} />
            <HealthTile label="Ενεργοί 7ημ" value={intFmt.format(r.kpis.activeUsers7d)} good={r.kpis.activeUsers7d > 0} />
            <HealthTile label="Ενεργοί 30ημ" value={intFmt.format(r.kpis.activeUsers30d)} good={r.kpis.activeUsers30d > 0} />
            <HealthTile label="Anonymized πελάτες" value={intFmt.format(r.health.anonymizedCustomers)} good={true} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function BigKpi({
  icon, label, primary, secondary, accent
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
}) {
  return (
    <Card sx={{ borderTop: `4px solid ${accent}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Box sx={{ color: accent, display: "flex" }}>{icon}</Box>
          <Typography variant="overline" color="text.secondary">{label}</Typography>
        </Stack>
        <Typography variant="h4" fontWeight={800}>{primary}</Typography>
        <Typography variant="caption" color="text.secondary">{secondary}</Typography>
      </CardContent>
    </Card>
  );
}

function SmallKpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card sx={{ borderLeft: `4px solid ${accent}` }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={800}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function HealthTile({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <Box sx={{
      p: 2,
      border: 1,
      borderRadius: 1,
      borderColor: "divider",
      backgroundColor: good ? "rgba(46,125,50,0.05)" : "rgba(237,108,2,0.06)"
    }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={700} color={good ? "success.dark" : "warning.dark"}>{value}</Typography>
    </Box>
  );
}
