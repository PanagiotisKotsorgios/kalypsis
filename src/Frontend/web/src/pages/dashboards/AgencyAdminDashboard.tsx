import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography, alpha, useTheme
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleIcon from "@mui/icons-material/People";
import PolicyIcon from "@mui/icons-material/Policy";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import EuroIcon from "@mui/icons-material/Euro";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../auth/WorkspaceContext";
import {
  AnimatedKpiCard, ChartCard, ModernAreaChart, ModernBarChart, ModernDonutChart,
} from "../../components/ModernDashboard";

interface KpiDto {
  customers: number;
  activePolicies: number;
  expiringSoon: number;
  monthlyPremium: number;
  openClaims: number;
  openRequests: number;
}
interface SeriesPoint { label: string; value: number }
interface CarrierShare { carrier: string; policies: number; premium: number }
interface AgencyReportDto {
  kpis: KpiDto;
  policiesByType: SeriesPoint[];
  policiesByStatus: SeriesPoint[];
  claimsByStatus: SeriesPoint[];
  requestsByStatus: SeriesPoint[];
  monthlyPremium: SeriesPoint[];
  topCarriers: CarrierShare[];
}

const TYPE_LABELS: Record<string, string> = {
  Auto: "Αυτοκινήτου", Home: "Κατοικίας", Health: "Υγείας", Life: "Ζωής",
  Business: "Επιχείρησης", Travel: "Ταξιδίου", Other: "Άλλο"
};
const STATUS_LABELS: Record<string, string> = {
  Draft: "Πρόχειρο", Active: "Ενεργό", Expired: "Έληξε", Cancelled: "Ακυρωμένο",
  Renewed: "Ανανεώθηκε", PendingRenewal: "Προς ανανέωση"
};
// The reports backend returns Status.ToString() for claim/request breakdowns.
// Map to Greek here so tooltips + axis labels read natively.
const BREAKDOWN_LABELS: Record<string, string> = {
  Open: "Ανοιχτή", InReview: "Υπό εξέταση", Approved: "Εγκεκριμένη",
  Rejected: "Απορρίφθηκε", Closed: "Κλειστή", Reopened: "Επανάνοιξη",
  Pending: "Εκκρεμεί", InProgress: "Σε εξέλιξη", Completed: "Ολοκληρώθηκε",
  Cancelled: "Ακυρώθηκε",
};

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function AgencyAdminDashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { exitToHub } = useWorkspace();

  const q = useQuery({
    queryKey: ["report", "agency"],
    queryFn: async () => (await api.get<AgencyReportDto>("/reports/agency")).data
  });

  if (q.isLoading) {
    return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  }
  if (q.isError || !q.data) {
    return <Typography color="error">Αδυναμία φόρτωσης πίνακα ελέγχου.</Typography>;
  }
  const r = q.data;

  const monthlySpark = r.monthlyPremium.slice(-8).map(p => Number(p.value));

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} size="small"
        onClick={() => { exitToHub(); navigate("/app"); }}
        sx={{ mb: 2, color: "text.secondary" }}>
        Επιστροφή στον αρχικό Πίνακα Ελέγχου
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πίνακας ελέγχου διαχειριστή</Typography>
          <Typography color="text.secondary">{user?.tenantName} — επισκόπηση γραφείου</Typography>
        </Box>
        <Chip label="Όλο το γραφείο" color="primary" />
      </Stack>

      {/* KPI strip — 6 animated cards, one per key metric. */}
      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }
      }}>
        <AnimatedKpiCard index={0} label="Πελάτες"           value={r.kpis.customers}
                         accent={theme.palette.primary.main} icon={<PeopleIcon />} />
        <AnimatedKpiCard index={1} label="Ενεργά συμβόλαια"  value={r.kpis.activePolicies}
                         accent={theme.palette.success.main} icon={<PolicyIcon />} />
        <AnimatedKpiCard index={2} label="Λήγουν σύντομα"    value={r.kpis.expiringSoon}
                         accent={theme.palette.warning.main} icon={<EventBusyIcon />} />
        <AnimatedKpiCard index={3} label="Μηνιαία παραγωγή"  value={r.kpis.monthlyPremium} currency
                         accent={theme.palette.secondary.main} icon={<EuroIcon />} spark={monthlySpark} />
        <AnimatedKpiCard index={4} label="Ανοιχτές ζημιές"   value={r.kpis.openClaims}
                         accent={theme.palette.error.main} icon={<ReportProblemIcon />} />
        <AnimatedKpiCard index={5} label="Ανοιχτά αιτήματα"  value={r.kpis.openRequests}
                         accent={theme.palette.info.main} icon={<SupportAgentIcon />} />
      </Box>

      {/* Main chart row — trend area + donut. */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" } }}>
        <ChartCard title="Παραγωγή ανά μήνα" subtitle="Ασφάλιστρα σε € — 12 μήνες">
          <ModernAreaChart data={r.monthlyPremium} color={theme.palette.primary.main}
                           format={(v) => moneyFmt.format(v)} />
        </ChartCard>
        <ChartCard title="Κατανομή τύπων" subtitle="Ενεργά συμβόλαια ανά κλάδο">
          <ModernDonutChart data={r.policiesByType.map(p => ({
            label: TYPE_LABELS[p.label] ?? p.label, value: p.value
          }))} />
        </ChartCard>
      </Box>

      {/* Secondary row — statuses + carrier ranking. */}
      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <ChartCard title="Συμβόλαια ανά κατάσταση" subtitle="Ενεργά / Έληξαν / Ακυρώθηκαν / …" height={260}>
          <ModernBarChart data={r.policiesByStatus.map(p => ({
            label: STATUS_LABELS[p.label] ?? p.label, value: p.value
          }))} color={theme.palette.primary.main} />
        </ChartCard>
        <ChartCard title="Top ασφαλιστικές" subtitle="Ασφάλιστρα ανά ασφαλιστική εταιρεία" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.topCarriers.map(c => ({ name: c.carrier, premium: Number(c.premium) }))}
                      layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="carrierGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={theme.palette.secondary.main} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={theme.palette.secondary.main} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => moneyFmt.format(v as number)}
                     tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140}
                     tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: alpha(theme.palette.secondary.main, 0.08) }}
                       formatter={(v) => moneyFmt.format(v as number)}
                       contentStyle={{
                         border: "1px solid rgba(15,23,42,0.12)", borderRadius: 8,
                         boxShadow: "0 10px 32px -12px rgba(15,42,80,0.28)", padding: "8px 12px", fontSize: 12
                       }} />
              <Bar dataKey="premium" name="Ασφάλιστρα" fill="url(#carrierGrad)"
                   radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Box>

      {/* Breakdown row — claims + requests. */}
      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <BreakdownCard title="Ζημιές ανά κατάσταση" series={r.claimsByStatus}
                       accent={alpha(theme.palette.error.main, 0.85)} />
        <BreakdownCard title="Αιτήματα ανά κατάσταση" series={r.requestsByStatus}
                       accent={alpha(theme.palette.info.main, 0.85)} />
      </Box>
    </Box>
  );
}

function BreakdownCard({ title, series, accent }: { title: string; series: SeriesPoint[]; accent: string }) {
  return (
    <Card sx={{ borderRadius: 2.5 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
        <Box sx={{ height: 220 }}>
          <ModernBarChart color={accent}
            data={series.map(s => ({ label: BREAKDOWN_LABELS[s.label] ?? s.label, value: s.value }))} />
        </Box>
      </CardContent>
    </Card>
  );
}
