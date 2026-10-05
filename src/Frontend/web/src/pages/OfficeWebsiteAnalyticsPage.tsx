import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { exportActionSx } from "../components/actionButtonStyles";
import InsightsIcon from "@mui/icons-material/Insights";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { AnimatedKpiCard, ChartCard, ModernAreaChart, ModernBarChart, ModernDonutChart } from "../components/ModernDashboard";

type Metric = { label: string; value: number };
type Day = { label: string; views: number; visitors: number; requests: number };
type Analytics = {
  from: string; to: string; pageViews: number; uniqueVisitors: number; ctaClicks: number;
  formSubmissions: number; conversionRate: number; daily: Day[]; topPages: Metric[];
  sources: Metric[]; devices: Metric[]; requestStatuses: Metric[];
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const initialFrom = () => { const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d); };

export function OfficeWebsiteAnalyticsPage() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(() => isoDate(new Date()));
  const query = useQuery({
    queryKey: ["office-website-analytics", from, to],
    queryFn: async () => (await api.get<Analytics>("/office-website/analytics", { params: { from, to } })).data,
  });
  const data = query.data;
  const dailyViews = useMemo(() => (data?.daily ?? []).map(x => ({ label: x.label, value: x.views })), [data]);
  const dailyRequests = useMemo(() => (data?.daily ?? []).map(x => ({ label: x.label, value: x.requests })), [data]);
  const download = async () => {
    const response = await api.get<Blob>("/office-website/analytics/export.csv", { params: { from, to }, responseType: "blob" });
    const url = URL.createObjectURL(response.data); const a = document.createElement("a"); a.href = url; a.download = `website-analytics-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const setPeriod = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days + 1); setFrom(isoDate(d)); setTo(isoDate(new Date())); };
  if (query.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (query.isError || !data) return <Alert severity="error">{extractErrorMessage(query.error)}</Alert>;
  return <Box>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2} mb={3}>
      <Stack direction="row" spacing={1.5} alignItems="center"><InsightsIcon color="primary" sx={{ fontSize: 38 }} /><Box><Typography variant="h4" sx={{ fontWeight: 800 }}>Επισκεψιμότητα & στατιστικά</Typography><Typography color="text.secondary">Κατανοήστε τι λειτουργεί στην ιστοσελίδα σας και ποια ενδιαφέροντα μετατρέπονται σε αιτήματα.</Typography></Box></Stack>
      <Button variant="outlined" startIcon={<DownloadIcon />} sx={exportActionSx} onClick={() => void download()}>Εξαγωγή CSV</Button>
    </Stack>
    <Card variant="outlined" sx={{ mb: 2.5 }}><CardContent><Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={700}>Περίοδος</Typography><Button size="small" onClick={() => setPeriod(7)}>7 ημέρες</Button><Button size="small" onClick={() => setPeriod(30)}>30 ημέρες</Button><Button size="small" onClick={() => setPeriod(90)}>90 ημέρες</Button></Stack><Stack direction="row" spacing={1}><input aria-label="Από" type="date" value={from} onChange={e => setFrom(e.target.value)} /><input aria-label="Έως" type="date" value={to} onChange={e => setTo(e.target.value)} /></Stack></Stack></CardContent></Card>
    <Alert severity="info" sx={{ mb: 2.5 }}>Τα analytics είναι first-party και ανώνυμα: δεν αποθηκεύεται IP ή όνομα επισκέπτη. Οι μετρήσεις ενεργοποιούνται μόνο για τη δημοσιευμένη ιστοσελίδα.</Alert>
    <Grid container spacing={2.5} mb={2.5}>
      <Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Προβολές σελίδων" value={data.pageViews} icon={<VisibilityIcon />} accent="#1f7bb3" /></Grid>
      <Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Μοναδικοί επισκέπτες" value={data.uniqueVisitors} icon={<PeopleAltIcon />} accent="#14a77a" /></Grid>
      <Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Κλικ / ενέργειες" value={data.ctaClicks} icon={<TouchAppIcon />} accent="#e58b25" /></Grid>
      <Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Αιτήματα ενδιαφέροντος" value={data.formSubmissions} icon={<MarkEmailReadIcon />} accent="#8b5cf6" /></Grid>
    </Grid>
    <Grid container spacing={2.5}>
      <Grid item xs={12} md={8}><ChartCard title="Επισκεψιμότητα ανά ημέρα" subtitle="Προβολές σελίδων"><ModernAreaChart data={dailyViews} color="#1f7bb3" /></ChartCard></Grid>
      <Grid item xs={12} md={4}><ChartCard title="Αιτήματα ανά ημέρα" subtitle="Πότε υπάρχει ενδιαφέρον"><ModernBarChart data={dailyRequests} color="#14a77a" /></ChartCard></Grid>
      <Grid item xs={12} md={4}><ChartCard title="Πηγές επισκεπτών" subtitle="UTM ή άμεση επίσκεψη" height={260}><ModernDonutChart data={data.sources} /></ChartCard></Grid>
      <Grid item xs={12} md={4}><ChartCard title="Συσκευές" subtitle="Desktop / mobile" height={260}><ModernDonutChart data={data.devices} colors={["#1f7bb3", "#14a77a", "#e58b25"]} /></ChartCard></Grid>
      <Grid item xs={12} md={4}><ChartCard title="Κατάσταση αιτημάτων" subtitle={`Conversion rate ${data.conversionRate.toFixed(2)}%`} height={260}><ModernDonutChart data={data.requestStatuses} /></ChartCard></Grid>
      <Grid item xs={12} md={6}><MetricList title="Δημοφιλέστερες σελίδες" rows={data.topPages} /></Grid>
      <Grid item xs={12} md={6}><MetricList title="Τι να προσέξετε" rows={data.sources} /></Grid>
    </Grid>
  </Box>;
}

function MetricList({ title, rows }: { title: string; rows: Metric[] }) {
  return <Card variant="outlined"><CardContent><Typography variant="h6" fontWeight={800} mb={1.5}>{title}</Typography>{rows.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα για την επιλεγμένη περίοδο.</Typography> : rows.map((row, index) => <Stack key={`${row.label}-${index}`} direction="row" alignItems="center" justifyContent="space-between" py={1} sx={{ borderBottom: index === rows.length - 1 ? 0 : 1, borderColor: "divider" }}><Typography noWrap sx={{ maxWidth: "75%" }}>{row.label}</Typography><Chip size="small" label={row.value} /></Stack>)}</CardContent></Card>;
}
