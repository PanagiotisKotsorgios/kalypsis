import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../auth/WorkspaceContext";
import {
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
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { money } from "../../utils/format";

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

// Recharts uses the dataKey as the series display name in tooltips + legends
// by default — passing an explicit `name` prop overrides that with a Greek
// label so nothing surfaces in English when the operator hovers.
const SERIES_NAME_PREMIUM = "Ασφάλιστρα";
const SERIES_NAME_COUNT = "Πλήθος";

// The reports backend returns `Status.ToString()` (English enum names) for
// claim + request breakdowns. Map to Greek on the frontend so the X-axis
// labels + tooltips read natively.
const BREAKDOWN_LABELS: Record<string, string> = {
  // Claim statuses
  Open: "Ανοιχτή", InReview: "Υπό εξέταση", Approved: "Εγκεκριμένη",
  Rejected: "Απορρίφθηκε", Closed: "Κλειστή", Reopened: "Επανάνοιξη",
  // Request statuses
  Pending: "Εκκρεμεί", InProgress: "Σε εξέλιξη", Completed: "Ολοκληρώθηκε",
  Cancelled: "Ακυρώθηκε",
};

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat("el-GR");

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

  const pieColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
    "#8b5cf6",
    "#ec4899"
  ];

  const typeData = r.policiesByType.map(p => ({ name: TYPE_LABELS[p.label] ?? p.label, value: p.value }));
  const statusData = r.policiesByStatus.map(p => ({ name: STATUS_LABELS[p.label] ?? p.label, value: p.value }));
  const monthlyData = r.monthlyPremium.map(p => ({ month: p.label, premium: Number(p.value) }));
  const carrierData = r.topCarriers.map(c => ({ name: c.carrier, premium: Number(c.premium), policies: c.policies }));

  return (
    <Box>
      {/* Back-to-hub button — exits BackOffice workspace and returns to the package selector. */}
      <Button
        startIcon={<ArrowBackIcon />}
        size="small"
        onClick={() => { exitToHub(); navigate("/app"); }}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Επιστροφή στον αρχικό Πίνακα Ελέγχου
      </Button>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Πίνακας ελέγχου διαχειριστή</Typography>
          <Typography color="text.secondary">
            {user?.tenantName} — επισκόπηση γραφείου
          </Typography>
        </Box>
        <Chip label="Όλο το γραφείο" color="primary" />
      </Stack>

      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }
      }}>
        <KpiCard label="Πελάτες" value={intFmt.format(r.kpis.customers)} accent={theme.palette.primary.main} />
        <KpiCard label="Ενεργά συμβόλαια" value={intFmt.format(r.kpis.activePolicies)} accent={theme.palette.success.main} />
        <KpiCard label="Λήγουν σύντομα" value={intFmt.format(r.kpis.expiringSoon)} accent={theme.palette.warning.main} />
        <KpiCard label="Μηνιαία παραγωγή" value={moneyFmt.format(r.kpis.monthlyPremium)} accent={theme.palette.secondary.main} />
        <KpiCard label="Ανοιχτές ζημιές" value={intFmt.format(r.kpis.openClaims)} accent={theme.palette.error.main} />
        <KpiCard label="Ανοιχτά αιτήματα" value={intFmt.format(r.kpis.openRequests)} accent={theme.palette.info.main} />
      </Box>

      <Box sx={{
        display: "grid", gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Παραγωγή ανά μήνα</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => money(v as number)} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => moneyFmt.format(v as number)} />
                  <Line type="monotone" dataKey="premium" name={SERIES_NAME_PREMIUM} stroke={theme.palette.primary.main} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Κατανομή τύπων</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                       innerRadius={56} outerRadius={100} paddingAngle={2}>
                    {typeData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{
        display: "grid", gap: 2, mt: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Συμβόλαια ανά κατάσταση</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name={SERIES_NAME_COUNT} fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Top ασφαλιστικές</Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tickFormatter={(v) => moneyFmt.format(v as number)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
                  <Tooltip formatter={(v, n) => n === SERIES_NAME_PREMIUM ? moneyFmt.format(v as number) : v} />
                  <Bar dataKey="premium" name={SERIES_NAME_PREMIUM} fill={theme.palette.secondary.main} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <BreakdownCard title="Ζημιές ανά κατάσταση" series={r.claimsByStatus} accent={alpha(theme.palette.error.main, 0.85)} />
        <BreakdownCard title="Αιτήματα ανά κατάσταση" series={r.requestsByStatus} accent={alpha(theme.palette.info.main, 0.85)} />
      </Box>
    </Box>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card sx={{ borderLeft: `4px solid ${accent}` }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={800}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, series, accent }: { title: string; series: SeriesPoint[]; accent: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" mb={2}>{title}</Typography>
        <Box sx={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series.map(s => ({ name: BREAKDOWN_LABELS[s.label] ?? s.label, value: s.value }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name={SERIES_NAME_COUNT} fill={accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
