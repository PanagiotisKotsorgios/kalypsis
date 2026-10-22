import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BarChartIcon from "@mui/icons-material/BarChart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, extractErrorMessage } from "../api/client";

export interface ProducerStatistics {
  producerId: string; from: string; to: string; dateField: string; currency: string;
  currencies: string[]; carriers: { value: string; label: string }[];
  totalPolicies: number; activePolicies: number; renewedPolicies: number; cancelledPolicies: number; customers: number; claims: number;
  premium: number; netPremium: number | null; recordedCommissions: number;
  monthly: { month: string; policies: number; premium: number; recordedCommissions: number }[];
  byCarrier: StatisticGroup[]; byType: StatisticGroup[]; byStatus: StatisticGroup[];
}
interface StatisticGroup { key: string; name: string; policies: number; premium: number }
export interface ProducerStatisticsFilters { from: string; to: string; dateField: string; currency: string; insuranceCompanyId: string; policyType: string }
export const producerStatisticsRefreshMs = 30_000;
const COLORS = ["#087ceb", "#159b59", "#456b91", "#0b305c", "#00a6b6", "#7c65bb", "#d93547"];
const TYPE_LABELS: Record<string, string> = { Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά" };
const STATUS_LABELS: Record<string, string> = { Active: "Ενεργά", Expired: "Ληγμένα", Cancelled: "Ακυρωμένα", Renewed: "Ανανεωμένα", PendingRenewal: "Προς ανανέωση", Undelivered: "Απαράδοτα", AwaitingIssue: "Προς έκδοση" };
const money = (value: number | null, currency: string) => value == null ? "Δεν έχει οριστεί" : value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
const compactNumber = (value: number) => value.toLocaleString("el-GR", { notation: "compact", maximumFractionDigits: 1 });
const monthLabel = (value: string) => `${["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"][Number(value.slice(5)) - 1]} ${value.slice(2, 4)}`;
export function producerStatisticsParams(filters: ProducerStatisticsFilters) {
  return { from: filters.from, to: filters.to, dateField: filters.dateField,
    currency: filters.currency || undefined, insuranceCompanyId: filters.insuranceCompanyId || undefined, policyType: filters.policyType || undefined };
}
export function producerStatisticsCharts(data: ProducerStatistics) {
  return { monthly: data.monthly.map(row => ({ ...row, name: monthLabel(row.month) })),
    byCarrier: data.byCarrier, byType: data.byType.map(row => ({ ...row, name: TYPE_LABELS[row.key] ?? row.name })),
    byStatus: data.byStatus.map(row => ({ ...row, name: STATUS_LABELS[row.key] ?? row.name })) };
}
export function ProducerStatisticsDashboard({ data }: { data: ProducerStatistics }) {
  const charts = producerStatisticsCharts(data);
  const metrics = [["Συμβόλαια", data.totalPolicies], ["Ενεργά", data.activePolicies], ["Ανανεώσεις", data.renewedPolicies], ["Ακυρώσεις", data.cancelledPolicies],
    ["Μικτά ασφάλιστρα", money(data.premium, data.currency)], ["Καθαρά ασφάλιστρα", money(data.netPremium, data.currency)],
    ["Καταχωρημένες προμήθειες", money(data.recordedCommissions, data.currency)], ["Πελάτες / ζημιές", `${data.customers} / ${data.claims}`]];
  const chartCard = { p: 1.5, minWidth: 0, bgcolor: "#f8fafc", border: "1px solid #d5e0ec", borderRadius: 1.5, boxShadow: "none" };
  return <Stack spacing={1.25}>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: .75 }}>
      {metrics.map(([label, value]) => <Box key={label} sx={{ p: 1, borderRadius: 1, border: "1px solid #d5e0ec", bgcolor: "#e9eef4", minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: "block", color: "#536b89", fontWeight: 750 }}>{label}</Typography>
        <Typography sx={{ color: "#102c55", fontSize: { xs: ".95rem", sm: "1.1rem" }, fontWeight: 850, overflowWrap: "anywhere" }}>{value}</Typography>
      </Box>)}
    </Box>
    <Typography variant="caption" color="text.secondary">Τα ποσά αφορούν το {data.currency} και εξαιρούν ακυρωμένα συμβόλαια. Πρόχειρα ή πιθανά συμβόλαια και στοιχεία πιθανών πελατών/συνεργατών δεν προσμετρώνται.</Typography>
    {!data.totalPolicies ? <Alert severity="info">Δεν υπάρχουν δεδομένα για τα επιλεγμένα φίλτρα.</Alert> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
      <Card sx={chartCard}><Typography fontWeight={800} mb={1}>Εξέλιξη παραγωγής & προμηθειών · {data.currency}</Typography><Box sx={{ height: 270, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={charts.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#dfe5ed" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#536b89" }} minTickGap={25} /><YAxis tickFormatter={compactNumber} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={value => money(Number(value ?? 0), data.currency)} /><Legend wrapperStyle={{ fontSize: 12 }} />
          <Area name="Μικτά ασφάλιστρα" dataKey="premium" type="monotone" stroke="#087ceb" fill="#dcebfa" fillOpacity={.45} isAnimationActive={false} />
          <Area name="Καταχωρημένες προμήθειες" dataKey="recordedCommissions" type="monotone" stroke="#159b59" fill="#d7f0e2" isAnimationActive={false} />
        </AreaChart></ResponsiveContainer>
      </Box></Card>
      <Card sx={chartCard}><Typography fontWeight={800} mb={1}>Συμβόλαια ανά μήνα</Typography><Box sx={{ height: 270, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={charts.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#dfe5ed" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={25} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} /><Tooltip /><Bar name="Συμβόλαια" dataKey="policies" fill="#087ceb" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer>
      </Box></Card>
      <Card sx={chartCard}><Typography fontWeight={800} mb={1}>Παραγωγή ανά ασφαλιστική · {data.currency}</Typography><Box sx={{ height: Math.max(260, Math.min(620, charts.byCarrier.length * 36)), minWidth: 0, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height={Math.max(260, charts.byCarrier.length * 36)}><BarChart layout="vertical" data={charts.byCarrier} margin={{ top: 10, right: 15, left: 5, bottom: 10 }}>
          <CartesianGrid stroke="#dfe5ed" strokeDasharray="3 3" /><YAxis dataKey="name" type="category" width={115} tick={{ fontSize: 11 }} tickFormatter={value => String(value).length > 18 ? String(value).slice(0, 17) + "…" : String(value)} /><XAxis type="number" tickFormatter={compactNumber} tick={{ fontSize: 11 }} /><Tooltip formatter={value => money(Number(value ?? 0), data.currency)} />
          <Bar name="Μικτά ασφάλιστρα" dataKey="premium" fill="#456b91" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart></ResponsiveContainer>
      </Box></Card>
      <Card sx={chartCard}><Typography fontWeight={800} mb={1}>Συμβόλαια ανά κλάδο</Typography><Box sx={{ height: 280, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={charts.byType} dataKey="policies" nameKey="name" innerRadius="43%" outerRadius="70%" isAnimationActive={false}>
          {charts.byType.map((row, index) => <Cell key={row.key} fill={COLORS[index % COLORS.length]} />)}
        </Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>
      </Box></Card>
      <Card sx={{ ...chartCard, gridColumn: { lg: "1 / -1" } }}><Typography fontWeight={800} mb={1}>Κατάσταση συμβολαίων</Typography><Box sx={{ height: 260, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={charts.byStatus} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#dfe5ed" strokeDasharray="3 3" /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={115} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip />
          <Bar name="Συμβόλαια" dataKey="policies" radius={[0, 4, 4, 0]} isAnimationActive={false}>{charts.byStatus.map((row, index) => <Cell key={row.key} fill={row.key === "Cancelled" ? "#d93547" : row.key === "Active" ? "#159b59" : COLORS[index % COLORS.length]} />)}</Bar>
        </BarChart></ResponsiveContainer>
      </Box></Card>
    </Box>}
  </Stack>;
}

export function ProducerStatisticsDialog({ producerId, name, open, onClose }: { producerId: string; name: string; open: boolean; onClose: () => void }) {
  const today = new Date();
  const [filters, setFilters] = useState<ProducerStatisticsFilters>({ from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    dateField: "start", currency: "", insuranceCompanyId: "", policyType: "" });
  const valid = !!filters.from && !!filters.to && filters.from <= filters.to;
  const params = producerStatisticsParams(filters);
  const q = useQuery({ queryKey: ["producer-statistics", producerId, params], enabled: open && valid,
    queryFn: async () => (await api.get<ProducerStatistics>(`/producers/${producerId}/statistics`, { params })).data,
    refetchInterval: open && valid ? producerStatisticsRefreshMs : false });
  const [options, setOptions] = useState<Pick<ProducerStatistics, "carriers" | "currencies" | "currency">>({ carriers: [], currencies: [], currency: "EUR" });
  useEffect(() => { if (q.data) setOptions({ carriers: q.data.carriers, currencies: q.data.currencies, currency: q.data.currency }); }, [q.data]);
  const carriers = q.data?.carriers ?? options.carriers;
  const currencies = q.data?.currencies ?? options.currencies;
  const set = (key: keyof ProducerStatisticsFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" PaperProps={{ sx: { bgcolor: "#edf3f9", maxHeight: "calc(100dvh - 24px)", m: 1.5, width: "calc(100% - 24px)" } }}>
    <DialogTitle><Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between"><Stack direction="row" alignItems="center" spacing={1}><BarChartIcon sx={{ color: "#087ceb" }} /><Typography component="span" variant="h6" fontWeight={800}>Στατιστικά · {name}</Typography></Stack><Chip size="small" label="Ζωντανή ενημέρωση · 30″" sx={{ bgcolor: "#087ceb", color: "#fff", fontWeight: 750 }} /></Stack></DialogTitle>
    <DialogContent dividers><Stack spacing={1.25}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: 1, pt: .75 }}>
        <TextField select size="small" label="Πεδίο ημερομηνίας" value={filters.dateField} onChange={e => set("dateField", e.target.value)}><MenuItem value="start">Ημερομηνία έναρξης</MenuItem><MenuItem value="issued">Ημερομηνία έκδοσης</MenuItem><MenuItem value="created">Ημερομηνία καταχώρησης</MenuItem></TextField>
        <TextField fullWidth size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={filters.from} onChange={e => set("from", e.target.value)} />
        <TextField fullWidth size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={filters.to} onChange={e => set("to", e.target.value)} />
        <TextField select fullWidth size="small" label="Ασφαλιστική" value={filters.insuranceCompanyId} onChange={e => set("insuranceCompanyId", e.target.value)}><MenuItem value="">Όλες</MenuItem>{carriers.map(row => <MenuItem key={row.value} value={row.value}>{row.label}</MenuItem>)}</TextField>
        <TextField select fullWidth size="small" label="Κλάδος" value={filters.policyType} onChange={e => set("policyType", e.target.value)}><MenuItem value="">Όλοι</MenuItem>{Object.entries(TYPE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        <TextField select fullWidth size="small" label="Νόμισμα" value={filters.currency} onChange={e => set("currency", e.target.value)}><MenuItem value="">Αυτόματο ({q.data?.currency ?? options.currency})</MenuItem>{Array.from(new Set([...currencies, filters.currency].filter(Boolean))).map(currency => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}</TextField>
      </Box>
      {!valid && <Alert severity="warning">Επιλέξτε έγκυρες ημερομηνίες Από – Έως.</Alert>}
      {valid && q.isError && <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>}
      {valid && q.isLoading && <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress /></Box>}
      {valid && q.isFetching && !q.isLoading && <LinearProgress />}
      {valid && q.data && !q.isError && <ProducerStatisticsDashboard data={q.data} />}
    </Stack></DialogContent><DialogActions><Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 1 }}>{q.dataUpdatedAt ? `Τελευταία ενημέρωση: ${new Date(q.dataUpdatedAt).toLocaleTimeString("el-GR")}` : ""}</Typography><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}
