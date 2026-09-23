import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
  YAxis,
} from "recharts";
import { api, extractErrorMessage } from "../api/client";
import { money, num } from "../utils/format";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type PolicyStatus = "Draft" | "Active" | "Expired" | "Cancelled" | "Renewed" | "PendingRenewal" | "Undelivered" | "AwaitingIssue";

interface MonthlyRow {
  month: number;
  premium: number;
  policyCount: number;
  expectedGrossCommission: number;
  expectedNetCommission: number;
}

interface TypeRow {
  policyType: PolicyType;
  premium: number;
  policyCount: number;
  expectedNetCommission: number;
}

interface StatusRow { status: PolicyStatus; premium: number; policyCount: number }

interface ProducerAnalytics {
  year: number;
  policyCount: number;
  totalPremium: number;
  expectedGrossCommission: number;
  expectedNetCommission: number;
  averageCommissionRatePercent: number;
  monthly: MonthlyRow[];
  byPolicyType: TypeRow[];
  byStatus: StatusRow[];
}

const MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
const TYPES: Array<{ value: PolicyType; label: string }> = [
  { value: "Auto", label: "Αυτοκίνητο" }, { value: "Home", label: "Κατοικία" },
  { value: "Health", label: "Υγείας" }, { value: "Life", label: "Ζωής" },
  { value: "Business", label: "Επιχείρησης" }, { value: "Travel", label: "Ταξιδιού" },
  { value: "Other", label: "Άλλο" },
];
const STATUSES: Array<{ value: PolicyStatus; label: string }> = [
  { value: "Draft", label: "Πρόχειρο" }, { value: "Active", label: "Ενεργό" },
  { value: "Expired", label: "Έληξε" }, { value: "Cancelled", label: "Ακυρωμένο" },
  { value: "Renewed", label: "Ανανεώθηκε" }, { value: "PendingRenewal", label: "Προς ανανέωση" },
  { value: "Undelivered", label: "Απαράδοτο" }, { value: "AwaitingIssue", label: "Αναμονή έκδοσης" },
];
const COLORS = ["#0b2545", "#1d4e89", "#1ea7e1", "#35a854", "#f6a623", "#9c27b0", "#708090"];

export function ProducerProductionAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [policyType, setPolicyType] = useState<PolicyType | "">("");
  const [status, setStatus] = useState<PolicyStatus | "">("");

  const analytics = useQuery({
    queryKey: ["producer-production-analytics", year, policyType, status],
    queryFn: async () => (await api.get<ProducerAnalytics>("/producer/me/production/analytics", {
      params: {
        year,
        ...(policyType ? { policyType } : {}),
        ...(status ? { status } : {}),
      },
    })).data,
  });

  const data = analytics.data;
  const monthly = (data?.monthly ?? []).map(item => ({
    ...item,
    label: MONTHS[item.month - 1],
  }));
  const types = (data?.byPolicyType ?? []).map(item => ({
    ...item,
    label: TYPES.find(type => type.value === item.policyType)?.label ?? item.policyType,
  }));
  const statuses = (data?.byStatus ?? []).map(item => ({
    ...item,
    label: STATUSES.find(option => option.value === item.status)?.label ?? item.status,
  }));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Στατιστικά παραγωγής</Typography>
        <Typography color="text.secondary">Η εξέλιξη της δικής σας παραγωγής και των αναμενόμενων προμηθειών σας.</Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" gap={2} flexWrap="wrap">
            <TextField
              size="small"
              type="number"
              label="Έτος"
              value={year}
              onChange={event => setYear(Number(event.target.value) || currentYear)}
              inputProps={{ min: 2000, max: 2100 }}
              sx={{ width: 120 }}
            />
            <TextField select size="small" label="Κλάδος" value={policyType}
              onChange={event => setPolicyType(event.target.value as PolicyType | "")} sx={{ minWidth: 170 }}>
              <MenuItem value="">Όλοι οι κλάδοι</MenuItem>
              {TYPES.map(type => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Κατάσταση" value={status}
              onChange={event => setStatus(event.target.value as PolicyStatus | "")} sx={{ minWidth: 175 }}>
              <MenuItem value="">Όλες οι καταστάσεις</MenuItem>
              {STATUSES.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {analytics.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : analytics.isError ? (
        <Alert severity="error">{extractErrorMessage(analytics.error, "Δεν ήταν δυνατή η φόρτωση των στατιστικών.")}</Alert>
      ) : data && (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Τα ποσά προμήθειας είναι η δική σας αναμενόμενη αμοιβή από τα συμβόλαιά σας. Δεν εμφανίζονται ποσά γραφείου ή άλλων συνεργατών.
          </Alert>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, mb: 3 }}>
            <Kpi label="Συμβόλαια" value={num(data.policyCount)} />
            <Kpi label="Παραγωγή" value={money(data.totalPremium)} />
            <Kpi label="Μικτή προμήθεια" value={money(data.expectedGrossCommission)} />
            <Kpi label="Καθαρή προμήθεια" value={money(data.expectedNetCommission)} emphasis />
            <Kpi label="Μέσο ποσοστό" value={`${num(data.averageCommissionRatePercent)}%`} />
          </Box>

          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, mb: 3 }}>
            <ChartCard title="Παραγωγή και καθαρή προμήθεια ανά μήνα">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis tickFormatter={value => money(Number(value))} fontSize={12} />
                  <Tooltip formatter={value => money(Number(value))} />
                  <Legend />
                  <Bar dataKey="premium" name="Παραγωγή" fill="#1d4e89" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expectedNetCommission" name="Καθαρή προμήθεια" fill="#35a854" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Παραγωγή ανά κλάδο">
              {types.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip formatter={value => money(Number(value))} />
                    <Legend />
                    <Pie data={types} dataKey="premium" nameKey="label" outerRadius={85} label>
                      {types.map((item, index) => <Cell key={item.policyType} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </Box>

          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" } }}>
            <ChartCard title="Πλήθος συμβολαίων ανά μήνα">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="policyCount" name="Συμβόλαια" fill="#1ea7e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Κατάσταση συμβολαίων">
              {statuses.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer>
                  <BarChart data={statuses} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis type="category" dataKey="label" width={105} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="policyCount" name="Συμβόλαια" fill="#f6a623" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </Box>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card sx={emphasis ? { border: "1px solid", borderColor: "success.light" } : undefined}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.7 }}>{label}</Typography>
        <Typography variant="h5" fontWeight={800} color={emphasis ? "success.dark" : undefined}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700} mb={2}>{title}</Typography>
        <Box sx={{ height: 310 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}><Typography color="text.secondary">Δεν υπάρχουν στοιχεία.</Typography></Box>;
}
