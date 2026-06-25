import {
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../auth/WorkspaceContext";

interface AgencyUserKpi {
  myCustomers: number;
  myPolicies: number;
  myExpiringSoon: number;
  myOpenRequests: number;
  myOpenClaims: number;
  myMonthlyPremium: number;
}
interface SeriesPoint { label: string; value: number }
interface TimelineItem { kind: string; label: string; occurredAt: string }
interface UpcomingRenewal { policyNumber: string; customerDisplay: string; endDate: string; premium: number; daysUntil: number }
interface AgencyUserReport {
  kpis: AgencyUserKpi;
  myPoliciesByType: SeriesPoint[];
  myPoliciesByStatus: SeriesPoint[];
  myMonthlyPremium: SeriesPoint[];
  recentActivity: TimelineItem[];
  upcomingRenewals: UpcomingRenewal[];
}

const TYPE_LABELS: Record<string, string> = {
  Auto: "Αυτοκινήτου", Home: "Κατοικίας", Health: "Υγείας", Life: "Ζωής",
  Business: "Επιχείρησης", Travel: "Ταξιδίου", Other: "Άλλο"
};
const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat("el-GR");

export function AgencyUserDashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { exitToHub } = useWorkspace();

  const q = useQuery({
    queryKey: ["report", "agency-user"],
    queryFn: async () => (await api.get<AgencyUserReport>("/reports/agency-user")).data
  });

  if (q.isLoading) {
    return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  }
  if (q.isError || !q.data) {
    return <Typography color="error">Αδυναμία φόρτωσης πίνακα ελέγχου.</Typography>;
  }
  const r = q.data;

  const pieColors = [
    theme.palette.primary.main, theme.palette.secondary.main, theme.palette.success.main,
    theme.palette.warning.main, theme.palette.error.main, theme.palette.info.main, "#8b5cf6"
  ];

  return (
    <Box>
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
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Καλώς ήρθατε, {user?.firstName ?? user?.email}
          </Typography>
          <Typography color="text.secondary">Τα προσωπικά μου στατιστικά</Typography>
        </Box>
        <Chip label="Δικά μου δεδομένα" color="secondary" />
      </Stack>

      <Box sx={{
        display: "grid", gap: 2, mb: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }
      }}>
        <KpiCard label="Πελάτες μου" value={intFmt.format(r.kpis.myCustomers)} accent={theme.palette.primary.main} />
        <KpiCard label="Συμβόλαια μου" value={intFmt.format(r.kpis.myPolicies)} accent={theme.palette.success.main} />
        <KpiCard label="Λήγουν 30 ημ." value={intFmt.format(r.kpis.myExpiringSoon)} accent={theme.palette.warning.main} />
        <KpiCard label="Παραγωγή μήνα" value={moneyFmt.format(r.kpis.myMonthlyPremium)} accent={theme.palette.secondary.main} />
        <KpiCard label="Ζημιές μου" value={intFmt.format(r.kpis.myOpenClaims)} accent={theme.palette.error.main} />
        <KpiCard label="Αιτήματα μου" value={intFmt.format(r.kpis.myOpenRequests)} accent={theme.palette.info.main} />
      </Box>

      <Box sx={{
        display: "grid", gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }
      }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Η παραγωγή μου τους τελευταίους μήνες</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.myMonthlyPremium.map(p => ({ month: p.label, premium: Number(p.value) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v as number).toLocaleString("el-GR")} €`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => moneyFmt.format(v as number)} />
                  <Line type="monotone" dataKey="premium" stroke={theme.palette.secondary.main} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Κατανομή τύπων (δικά μου)</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={r.myPoliciesByType.map(p => ({ name: TYPE_LABELS[p.label] ?? p.label, value: p.value }))}
                    dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={95} paddingAngle={2}
                  >
                    {r.myPoliciesByType.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Επερχόμενες ανανεώσεις</Typography>
            {r.upcomingRenewals.length === 0 ? (
              <Typography color="text.secondary">Καμία ανανέωση στις επόμενες 30 ημέρες.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Συμβόλαιο</TableCell>
                    <TableCell>Πελάτης</TableCell>
                    <TableCell>Λήξη</TableCell>
                    <TableCell align="right">Ασφάλιστρο</TableCell>
                    <TableCell align="right">Σε ημέρες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.upcomingRenewals.map((u) => (
                    <TableRow key={u.policyNumber} hover>
                      <TableCell><strong>{u.policyNumber}</strong></TableCell>
                      <TableCell>{u.customerDisplay}</TableCell>
                      <TableCell>{u.endDate}</TableCell>
                      <TableCell align="right">{moneyFmt.format(u.premium)}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={u.daysUntil}
                              color={u.daysUntil <= 7 ? "error" : u.daysUntil <= 15 ? "warning" : "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Πρόσφατη δραστηριότητα</Typography>
            {r.recentActivity.length === 0 ? (
              <Typography color="text.secondary">Καμία πρόσφατη δραστηριότητα.</Typography>
            ) : (
              <Stack spacing={1.5} divider={<Divider />}>
                {r.recentActivity.map((it, i) => (
                  <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip
                        size="small"
                        label={it.kind === "request" ? "Αίτημα" : it.kind === "claim" ? "Ζημιά" : it.kind}
                        color={it.kind === "claim" ? "error" : "primary"}
                        variant="outlined"
                      />
                      <Typography fontWeight={500}>{it.label}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(it.occurredAt).toLocaleDateString("el-GR")}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
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
