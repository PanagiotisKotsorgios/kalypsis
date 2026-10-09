import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { exportRowsCsv } from "../utils/exportCsv";

type Portfolio = {
  from: string; to: string; generatedAt: string; aiConfigured: boolean;
  kpis: { customers: number; policies: number; activePolicies: number; premium: number; netPremium: number; atRiskPolicies: number; criticalPolicies: number; expiring30Days: number; openClaims: number; claimExposure: number; unpaidPolicies: number };
  policies: { id: string; policyNumber: string; customerName: string; carrier: string; policyType: string; status: string; endDate: string; premium: number; score: number; band: string; claimsCount: number; claimExposure: number; nextAction: string }[];
  customers: { id: string; name: string; email?: string; policyCount: number; premium: number; score: number; band: string; openClaims: number; nextAction: string }[];
  trend: { month: string; newPolicies: number; renewals: number; cancellations: number; expiring: number; premium: number; claims: number }[];
  riskBands: { key: string; value: number }[];
  aiUsage: { invocations: number; successful: number; failed: number; totalTokens: number; estimatedCostEur: number; suggestion: string; budgetPercent: number; costPercent: number; blocked: boolean };
};

const bandLabels: Record<string, string> = { Safe: "Ασφαλείς", Watch: "Παρακολούθηση", "At-risk": "Σε κίνδυνο", Critical: "Κρίσιμοι" };
const statusLabels: Record<string, string> = { Active: "Ενεργό", Prospect: "Πιθανό", Cancelled: "Ακυρωμένο", Expired: "Ληγμένο", Pending: "Σε εκκρεμότητα" };
const money = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value || 0);

export function IntelligenceStatsPage() {
  const [search, setSearch] = useState("");
  const [riskBand, setRiskBand] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (riskBand !== "all") params.set("riskBand", riskBand);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("includeProspects", "true");
  const query = useQuery({ queryKey: ["intelligence-portfolio-stats", search, riskBand, from, to], queryFn: async () => (await api.get<Portfolio>(`/intelligence/portfolio?${params.toString()}`)).data });
  const data = query.data;
  const successRate = data?.aiUsage.invocations ? Math.round(data.aiUsage.successful * 100 / data.aiUsage.invocations) : 0;
  const roiHint = data?.aiUsage.estimatedCostEur ? Math.round(successRate / data.aiUsage.estimatedCostEur) : 0;
  const riskData = useMemo(() => (data?.riskBands ?? []).map(item => ({ name: bandLabels[item.key] ?? item.key, πλήθος: item.value })), [data?.riskBands]);
  const trendData = data?.trend ?? [];
  const reset = () => { setSearch(""); setRiskBand("all"); setFrom(""); setTo(""); };
  const exportAll = () => { if (!data) return; exportRowsCsv({ fileName: "στατιστικά-νοημοσύνης", columns: [{ key: "τύπος", label: "Τύπος" }, { key: "όνομα", label: "Πελάτης / συμβόλαιο" }, { key: "κίνδυνος", label: "Κατηγορία κινδύνου" }, { key: "βαθμός", label: "Βαθμός" }, { key: "ασφάλιστρα", label: "Ασφάλιστρα" }, { key: "ενέργεια", label: "Επόμενη ενέργεια" }], rows: [...data.customers.map(item => ({ τύπος: "Πελάτης", όνομα: item.name, κίνδυνος: bandLabels[item.band] ?? item.band, βαθμός: item.score, ασφάλιστρα: item.premium, ενέργεια: item.nextAction })), ...data.policies.map(item => ({ τύπος: "Συμβόλαιο", όνομα: item.policyNumber, κίνδυνος: bandLabels[item.band] ?? item.band, βαθμός: item.score, ασφάλιστρα: item.premium, ενέργεια: item.nextAction }))] }); };

  return <Box sx={{ maxWidth: 1300, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={2}><Box><Typography variant="h5" fontWeight={800}>Στατιστικά νοημοσύνης</Typography><Typography color="text.secondary">Κατανάλωση, κόστος, απόδοση και προβλέψεις του γραφείου ανά πελάτη και συμβόλαιο.</Typography></Box><Button variant="contained" startIcon={<DownloadIcon />} onClick={exportAll} disabled={!data}>Εξαγωγή στατιστικών</Button></Stack>
    <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}><TextField size="small" label="Αναζήτηση πελάτη ή συμβολαίου" value={search} onChange={event => setSearch(event.target.value)} sx={{ flex: 1, minWidth: 220 }} /><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Κίνδυνος</InputLabel><Select label="Κίνδυνος" value={riskBand} onChange={event => setRiskBand(event.target.value)}><MenuItem value="all">Όλες οι κατηγορίες</MenuItem><MenuItem value="Safe">Ασφαλείς</MenuItem><MenuItem value="Watch">Παρακολούθηση</MenuItem><MenuItem value="At-risk">Σε κίνδυνο</MenuItem><MenuItem value="Critical">Κρίσιμοι</MenuItem></Select></FormControl><TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={from} onChange={event => setFrom(event.target.value)} /><TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={to} onChange={event => setTo(event.target.value)} /><Button variant="outlined" color="inherit" startIcon={<RestartAltIcon />} onClick={reset}>Καθαρισμός</Button></Stack></CardContent></Card>
    {query.isLoading && <Typography color="text.secondary">Υπολογίζονται τα στατιστικά…</Typography>}
    {query.isError && <Alert severity="error">Δεν ήταν δυνατή η φόρτωση των στατιστικών νοημοσύνης.</Alert>}
    {data && <>
      {!data.aiConfigured && <Alert severity="warning" sx={{ mb: 2 }}>Δεν έχει ρυθμιστεί κλειδί νοημοσύνης για το συγκεκριμένο γραφείο.</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2} flexWrap="wrap" useFlexGap>
        {[["Συνολικές μονάδες", data.aiUsage.totalTokens.toLocaleString("el-GR"), "primary"], ["Εκτιμώμενο κόστος", money(data.aiUsage.estimatedCostEur), "warning"], ["Επιτυχείς εκτελέσεις", `${successRate}%`, "success"], ["ROI / απόδοση ένδειξη", `${roiHint}x`, "info"]].map(([label, value, color]) => <Card key={label} sx={{ flex: "1 1 190px", minWidth: 170, border: "1px solid", borderColor: "divider" }}><CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={800} color={`${color}.main`}>{value}</Typography></CardContent></Card>)}
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}><Chip label={`Πελάτες: ${data.kpis.customers}`} /><Chip label={`Συμβόλαια: ${data.kpis.policies}`} /><Chip label={`Σε κίνδυνο: ${data.kpis.atRiskPolicies}`} color="warning" /><Chip label={`Κρίσιμα: ${data.kpis.criticalPolicies}`} color="error" /><Chip label={`Ανοιχτές ζημιές: ${data.kpis.openClaims}`} /><Chip label={`Λήξεις 30 ημερών: ${data.kpis.expiring30Days}`} /></Stack>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} mb={2}><Card sx={{ flex: 1, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Κατηγορίες κινδύνου</Typography><Box sx={{ height: 260 }}><ResponsiveContainer><BarChart data={riskData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="πλήθος" fill="#1565c0" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></Box></CardContent></Card><Card sx={{ flex: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Τάση χαρτοφυλακίου</Typography><Box sx={{ height: 260 }}><ResponsiveContainer><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="premium" name="Ασφάλιστρα" stroke="#1565c0" strokeWidth={2} /><Line type="monotone" dataKey="claims" name="Ζημιές" stroke="#d32f2f" strokeWidth={2} /></LineChart></ResponsiveContainer></Box></CardContent></Card></Stack>
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Ανά πελάτη</Typography><Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>{data.customers.slice(0, 20).map(item => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ py: 1 }}><Box><Typography fontWeight={700}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.policyCount} συμβόλαια · {money(item.premium)} · {item.nextAction}</Typography></Box><Chip size="small" label={`${bandLabels[item.band] ?? item.band} · ${item.score}/100`} color={item.score >= 70 ? "error" : item.score >= 45 ? "warning" : "success"} /></Stack>)}</Stack>{data.customers.length === 0 && <Typography color="text.secondary">Δεν βρέθηκαν πελάτες.</Typography>}</CardContent></Card>
      <Card sx={{ border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Ανά συμβόλαιο</Typography><Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>{data.policies.slice(0, 30).map(item => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ py: 1 }}><Box><Typography fontWeight={700}>{item.policyNumber} · {item.customerName}</Typography><Typography variant="caption" color="text.secondary">{item.carrier} · {statusLabels[item.status] ?? item.status} · λήξη {item.endDate} · {money(item.premium)}</Typography></Box><Chip size="small" label={`${bandLabels[item.band] ?? item.band} · ${item.score}/100`} color={item.score >= 70 ? "error" : item.score >= 45 ? "warning" : "success"} /></Stack>)}</Stack>{data.policies.length === 0 && <Typography color="text.secondary">Δεν βρέθηκαν συμβόλαια.</Typography>}</CardContent></Card>
      <Alert severity="info" sx={{ mt: 2 }}>{data.aiUsage.suggestion} Η ένδειξη ROI υπολογίζεται ενδεικτικά από το ποσοστό επιτυχών εκτελέσεων σε σχέση με το εκτιμώμενο κόστος και δεν αποτελεί λογιστική αποτίμηση.</Alert>
    </>}
  </Box>;
}
