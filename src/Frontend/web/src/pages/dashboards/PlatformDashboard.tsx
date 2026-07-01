import {
  Alert,
  Box,
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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../../api/client";
import { money, date, dateTime } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { Link as RouterLink } from "react-router-dom";

interface PlatformKpi {
  tenants: number;
  activeTenants: number;
  users: number;
  activeUsers7d: number;
  activeUsers30d: number;
  customers: number;
  activePolicies: number;
  openClaims: number;
  openRequests: number;
  totalPremiumVolume: number;
  monthlyPremiumVolume: number;
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
  newCustomersByMonth: SeriesPoint[];
  monthlyPremium: SeriesPoint[];
  topTenantsByPremium: TenantHeadline[];
  topTenantsByCustomers: TenantHeadline[];
  recentTenants: TenantHeadline[];
  recentActivity: PlatformActivity[];
  health: SystemHealth;
}

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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πίνακας Πλατφόρμας</Typography>
          <Typography color="text.secondary">
            Καλώς ήρθατε, {user?.firstName ?? user?.email} — επισκόπηση όλων των γραφείων
          </Typography>
        </Box>
        <Chip
          label={r.health.apiOk ? "API healthy" : "API degraded"}
          color={r.health.apiOk ? "success" : "error"}
          icon={<HealthAndSafetyIcon />}
        />
      </Stack>

      {/* ============ Primary KPI row ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }
      }}>
        <BigKpi
          icon={<BusinessIcon />} label="Συνολικά γραφεία"
          primary={intFmt.format(r.kpis.tenants)}
          secondary={`${intFmt.format(r.kpis.activeTenants)} ενεργά`}
          accent={theme.palette.primary.main}
        />
        <BigKpi
          icon={<GroupsIcon />} label="Συνολικοί χρήστες"
          primary={intFmt.format(r.kpis.users)}
          secondary={`${intFmt.format(r.kpis.activeUsers30d)} ενεργοί / 30ημ`}
          accent={theme.palette.info.main}
        />
        <BigKpi
          icon={<EuroIcon />} label="Συνολική παραγωγή"
          primary={moneyFmt.format(r.kpis.totalPremiumVolume)}
          secondary={`${moneyFmt.format(r.kpis.monthlyPremiumVolume)} αυτόν τον μήνα`}
          accent={theme.palette.success.main}
        />
        <BigKpi
          icon={<SecurityIcon />} label="Ασφάλεια"
          primary={`${intFmt.format(r.health.failedLoginAttempts24h)} ⚠`}
          secondary={`${intFmt.format(r.health.lockedAccounts)} κλειδωμένοι · ${intFmt.format(r.health.auditEvents24h)} audit /24h`}
          accent={theme.palette.warning.main}
        />
      </Box>

      {/* ============ Operational counters ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }
      }}>
        <SmallKpi label="Πελάτες" value={intFmt.format(r.kpis.customers)} accent={theme.palette.primary.main} />
        <SmallKpi label="Ενεργά συμβόλαια" value={intFmt.format(r.kpis.activePolicies)} accent={theme.palette.success.main} />
        <SmallKpi label="Ανοιχτά αιτήματα" value={intFmt.format(r.kpis.openRequests)} accent={theme.palette.info.main} />
        <SmallKpi label="Ανοιχτές ζημιές" value={intFmt.format(r.kpis.openClaims)} accent={theme.palette.error.main} />
        <SmallKpi label="Ειδοποιήσεις 30ημ" value={intFmt.format(r.health.totalNotifications30d)} accent={theme.palette.secondary.main} />
      </Box>

      {/* ============ Charts row 1 ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Παραγωγή πλατφόρμας ανά μήνα</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.monthlyPremium.map(p => ({ month: p.label, premium: Number(p.value) }))}>
                  <defs>
                    <linearGradient id="premiumFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => money(v as number)} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => moneyFmt.format(v as number)} />
                  <Area type="monotone" dataKey="premium" stroke={theme.palette.primary.main}
                        strokeWidth={3} fill="url(#premiumFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Subscription mix</Typography>
            <Box sx={{ height: 280 }}>
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
      </Box>

      {/* ============ Charts row 2 ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Νέα γραφεία ανά μήνα</Typography>
            <Box sx={{ height: 240 }}>
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

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Νέοι πελάτες ανά μήνα</Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.newCustomersByMonth.map(p => ({ month: p.label, value: p.value }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke={theme.palette.info.main} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ============ Top tenants tables ============ */}
      <Box sx={{
        display: "grid", gap: 2, mb: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }
      }}>
        <TopTenantsCard
          title="Top γραφεία ανά παραγωγή"
          rows={r.topTenantsByPremium}
          metricLabel="Παραγωγή"
          metricFmt={(t) => moneyFmt.format(t.premium)}
        />
        <TopTenantsCard
          title="Top γραφεία ανά πελάτες"
          rows={r.topTenantsByCustomers}
          metricLabel="Πελάτες"
          metricFmt={(t) => intFmt.format(t.customers)}
        />
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
                        <Chip size="small" label={`${t.customers} πελ.`} variant="outlined" />
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
                {r.recentActivity.map((a, i) => (
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

      {/* ============ System health summary ============ */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>Υγεία συστήματος</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
            <HealthTile label="API status" value={r.health.apiOk ? "OK" : "DEGRADED"} good={r.health.apiOk} />
            <HealthTile label="Failed logins" value={intFmt.format(r.health.failedLoginAttempts24h)} good={r.health.failedLoginAttempts24h < 10} />
            <HealthTile label="Locked accounts" value={intFmt.format(r.health.lockedAccounts)} good={r.health.lockedAccounts === 0} />
            <HealthTile label="Audit events / 24h" value={intFmt.format(r.health.auditEvents24h)} good={true} />
            <HealthTile label="Anonymized πελάτες" value={intFmt.format(r.health.anonymizedCustomers)} good={true} />
            <HealthTile label="Ειδοποιήσεις 30ημ" value={intFmt.format(r.health.totalNotifications30d)} good={true} />
            <HealthTile label="Ενεργοί 7ημ" value={intFmt.format(r.kpis.activeUsers7d)} good={r.kpis.activeUsers7d > 0} />
            <HealthTile label="Ενεργοί 30ημ" value={intFmt.format(r.kpis.activeUsers30d)} good={r.kpis.activeUsers30d > 0} />
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

function TopTenantsCard({
  title, rows, metricLabel, metricFmt
}: {
  title: string;
  rows: TenantHeadline[];
  metricLabel: string;
  metricFmt: (t: TenantHeadline) => string;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" mb={2}>{title}</Typography>
        {rows.length === 0 ? <Typography color="text.secondary">—</Typography> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Γραφείο</TableCell>
                <TableCell>Πλάνο</TableCell>
                <TableCell align="right">Χρήστες</TableCell>
                <TableCell align="right">Πελάτες</TableCell>
                <TableCell align="right">{metricLabel}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.tenantId} hover>
                  <TableCell>
                    <Typography
                      component={RouterLink}
                      to={`/app/tenants/${t.tenantId}`}
                      sx={{ color: "primary.main", fontWeight: 600, textDecoration: "none" }}
                    >
                      {t.name}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={PLAN_LABEL[t.plan] ?? t.plan} variant="outlined" /></TableCell>
                  <TableCell align="right">{intFmt.format(t.users)}</TableCell>
                  <TableCell align="right">{intFmt.format(t.customers)}</TableCell>
                  <TableCell align="right"><strong>{metricFmt(t)}</strong></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
