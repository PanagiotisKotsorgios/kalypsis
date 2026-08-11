import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PeopleIcon from "@mui/icons-material/People";
import PolicyIcon from "@mui/icons-material/Policy";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import EuroIcon from "@mui/icons-material/Euro";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../auth/WorkspaceContext";
import { date } from "../../utils/format";
import {
  AnimatedKpiCard, ChartCard, ModernAreaChart, ModernDonutChart,
} from "../../components/ModernDashboard";

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

  // Sparkline data for the "Παραγωγή μήνα" KPI — last N monthly premiums.
  const premiumSpark = r.myMonthlyPremium.slice(-8).map(p => Number(p.value));

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
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }
      }}>
        <AnimatedKpiCard index={0} label="Πελάτες μου"      value={r.kpis.myCustomers}
                         accent={theme.palette.primary.main} icon={<PeopleIcon />} />
        <AnimatedKpiCard index={1} label="Συμβόλαια μου"    value={r.kpis.myPolicies}
                         accent={theme.palette.success.main} icon={<PolicyIcon />} />
        <AnimatedKpiCard index={2} label="Λήγουν 30 ημ."    value={r.kpis.myExpiringSoon}
                         accent={theme.palette.warning.main} icon={<EventBusyIcon />} />
        <AnimatedKpiCard index={3} label="Παραγωγή μήνα"    value={r.kpis.myMonthlyPremium} currency
                         accent={theme.palette.secondary.main} icon={<EuroIcon />} spark={premiumSpark} />
        <AnimatedKpiCard index={4} label="Ζημιές μου"       value={r.kpis.myOpenClaims}
                         accent={theme.palette.error.main} icon={<ReportProblemIcon />} />
        <AnimatedKpiCard index={5} label="Αιτήματα μου"     value={r.kpis.myOpenRequests}
                         accent={theme.palette.info.main} icon={<SupportAgentIcon />} />
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" } }}>
        <ChartCard title="Η παραγωγή μου τους τελευταίους μήνες" subtitle="Μηνιαία ασφάλιστρα (€)">
          <ModernAreaChart
            data={r.myMonthlyPremium}
            color={theme.palette.secondary.main}
            format={(v) => moneyFmt.format(v)}
          />
        </ChartCard>

        <ChartCard title="Κατανομή τύπων (δικά μου)" subtitle="Συμβόλαια ανά κλάδο">
          <ModernDonutChart
            data={r.myPoliciesByType.map(p => ({
              label: TYPE_LABELS[p.label] ?? p.label,
              value: p.value,
            }))}
          />
        </ChartCard>
      </Box>

      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Επερχόμενες ανανεώσεις</Typography>
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

        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Πρόσφατη δραστηριότητα</Typography>
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
                      {date(it.occurredAt)}
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
