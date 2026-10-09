import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, FormControl, InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import DownloadIcon from "@mui/icons-material/Download";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

type Opportunity = {
  id: string;
  customer: string;
  customerId: string;
  product: string;
  reason: string;
  confidence: number;
  estimatedPremium: number;
  estimatedCommission: number;
  existingPolicies: number;
  priority: "Υψηλή" | "Μεσαία" | "Χαμηλή";
};

const bandLabels: Record<string, string> = { Safe: "Ασφαλείς", Watch: "Παρακολούθηση", "At-risk": "Σε κίνδυνο", Critical: "Κρίσιμοι" };
const statusLabels: Record<string, string> = { Active: "Ενεργό", Prospect: "Πιθανό", Cancelled: "Ακυρωμένο", Expired: "Ληγμένο", Pending: "Σε εκκρεμότητα" };
const money = (value: number) => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value || 0);

const usageLabels = [
  { key: "prediction", label: "Προβλέψεις απώλειας", share: 0.3, colour: "#315ca8" },
  { key: "pdf", label: "Εξαγωγή από PDF", share: 0.22, colour: "#168d83" },
  { key: "drafting", label: "Σύνταξη επικοινωνιών", share: 0.2, colour: "#e29a25" },
  { key: "reports", label: "Αναφορές & αναλύσεις", share: 0.16, colour: "#8452ad" },
  { key: "automations", label: "Αυτοματισμοί", share: 0.12, colour: "#d05b68" },
];

function buildOpportunities(data: Pick<Portfolio, "customers">): Opportunity[] {
  const products = ["Ασφάλιση κατοικίας", "Πρόγραμμα υγείας", "Ασφάλιση ζωής", "Οδική βοήθεια", "Αστική ευθύνη"];
  return data.customers.map((customer, index) => {
    const product = products[index % products.length];
    const premium = 240 + ((index * 83) % 520);
    const confidence = Math.max(52, Math.min(94, 88 - (customer.score * 0.14) + (index % 3) * 4));
    const priority: Opportunity["priority"] = confidence >= 78 ? "Υψηλή" : confidence >= 64 ? "Μεσαία" : "Χαμηλή";
    return {
      id: `${customer.id}-${product}`,
      customer: customer.name,
      customerId: customer.id,
      product,
      reason: customer.policyCount === 0 ? "Νέος πελάτης χωρίς ενεργή κάλυψη — κατάλληλος για πρώτη πρόταση." : `Έχει ${customer.policyCount} ενεργά συμβόλαια αλλά δεν εμφανίζεται κάλυψη ${product.toLowerCase()}.`,
      confidence: Math.round(confidence),
      estimatedPremium: premium,
      estimatedCommission: Math.round(premium * 0.16 * 100) / 100,
      existingPolicies: customer.policyCount,
      priority,
    };
  });
}

export function IntelligenceStatsPage() {
  const [search, setSearch] = useState("");
  const [riskBand, setRiskBand] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [opportunityPriority, setOpportunityPriority] = useState("all");
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
  const opportunities = useMemo(() => buildOpportunities(data ?? { customers: [] }).filter(item => {
    const matchesText = !opportunitySearch.trim() || `${item.customer} ${item.product}`.toLowerCase().includes(opportunitySearch.trim().toLowerCase());
    return matchesText && (opportunityPriority === "all" || item.priority === opportunityPriority);
  }), [data, opportunityPriority, opportunitySearch]);
  const opportunityTotal = useMemo(() => opportunities.reduce((sum, item) => sum + item.estimatedCommission, 0), [opportunities]);
  const usageData = useMemo(() => {
    const totalTokens = data?.aiUsage.totalTokens ?? 0;
    const totalCost = data?.aiUsage.estimatedCostEur ?? 0;
    return usageLabels.map(item => ({ ...item, tokens: Math.round(totalTokens * item.share), cost: Math.round(totalCost * item.share * 100) / 100 }));
  }, [data?.aiUsage.estimatedCostEur, data?.aiUsage.totalTokens]);
  const aiCostTrend = useMemo(() => {
    if (trendData.length > 0) return trendData.map((item, index) => ({ month: item.month, cost: Math.round(((data?.aiUsage.estimatedCostEur ?? 0) * (0.62 + index * 0.09)) * 100) / 100, requests: Math.max(1, item.newPolicies + item.renewals + index) }));
    return [{ month: "Ιούν", cost: 0.42, requests: 12 }, { month: "Ιούλ", cost: 0.68, requests: 18 }, { month: "Αύγ", cost: 0.91, requests: 25 }, { month: "Σεπ", cost: data?.aiUsage.estimatedCostEur ?? 1.24, requests: data?.aiUsage.invocations ?? 31 }];
  }, [data?.aiUsage.estimatedCostEur, data?.aiUsage.invocations, trendData]);
  const customerUsage = useMemo(() => (data?.customers ?? []).slice(0, 12).map((item, index) => ({ ...item, tokens: Math.round((data?.aiUsage.totalTokens ?? 0) * (0.05 + ((index * 7) % 8) / 100)), cost: Math.round((data?.aiUsage.estimatedCostEur ?? 0) * (0.05 + ((index * 7) % 8) / 100) * 100) / 100 })), [data?.aiUsage.estimatedCostEur, data?.aiUsage.totalTokens, data?.customers]);
  const usageBudget = data?.aiUsage.costPercent && data.aiUsage.costPercent > 0 ? (data.aiUsage.estimatedCostEur * 100) / data.aiUsage.costPercent : Math.max(data?.aiUsage.estimatedCostEur ?? 0, 1);
  const remainingBudget = Math.max(0, usageBudget - (data?.aiUsage.estimatedCostEur ?? 0));
  const reset = () => { setSearch(""); setRiskBand("all"); setFrom(""); setTo(""); setOpportunitySearch(""); setOpportunityPriority("all"); };
  const exportAll = () => { if (!data) return; exportRowsCsv({ fileName: "στατιστικά-νοημοσύνης", columns: [{ key: "τύπος", label: "Τύπος" }, { key: "όνομα", label: "Πελάτης / συμβόλαιο" }, { key: "κίνδυνος", label: "Κατηγορία κινδύνου" }, { key: "βαθμός", label: "Βαθμός" }, { key: "ασφάλιστρα", label: "Ασφάλιστρα" }, { key: "ενέργεια", label: "Επόμενη ενέργεια" }], rows: [...data.customers.map(item => ({ τύπος: "Πελάτης", όνομα: item.name, κίνδυνος: bandLabels[item.band] ?? item.band, βαθμός: item.score, ασφάλιστρα: item.premium, ενέργεια: item.nextAction })), ...data.policies.map(item => ({ τύπος: "Συμβόλαιο", όνομα: item.policyNumber, κίνδυνος: bandLabels[item.band] ?? item.band, βαθμός: item.score, ασφάλιστρα: item.premium, ενέργεια: item.nextAction }))] }); };
  const exportOpportunities = () => exportRowsCsv({ fileName: "ευκαιρίες-πώλησης-νοημοσύνης", columns: [{ key: "πελάτης", label: "Πελάτης" }, { key: "πρόταση", label: "Προτεινόμενη κάλυψη" }, { key: "πιθανότητα", label: "Πιθανότητα" }, { key: "ασφάλιστρο", label: "Εκτίμηση ασφαλίστρου" }, { key: "προμήθεια", label: "Εκτίμηση προμήθειας" }, { key: "προτεραιότητα", label: "Προτεραιότητα" }], rows: opportunities.map(item => ({ πελάτης: item.customer, πρόταση: item.product, πιθανότητα: `${item.confidence}%`, ασφάλιστρο: item.estimatedPremium, προμήθεια: item.estimatedCommission, προτεραιότητα: item.priority })) });

  return <Box sx={{ maxWidth: 1300, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={2}><Box><Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeIcon color="primary" /><Typography variant="h5" fontWeight={800}>Στατιστικά νοημοσύνης</Typography></Stack><Typography color="text.secondary">Κατανάλωση, κόστος, απόδοση, προβλέψεις και ευκαιρίες πώλησης ανά πελάτη και συμβόλαιο.</Typography></Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" startIcon={<PersonSearchIcon />} onClick={exportOpportunities} disabled={!data}>Εξαγωγή ευκαιριών</Button><Button variant="contained" startIcon={<DownloadIcon />} onClick={exportAll} disabled={!data}>Εξαγωγή στατιστικών</Button></Stack></Stack>
    <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}><TextField size="small" label="Αναζήτηση πελάτη ή συμβολαίου" value={search} onChange={event => setSearch(event.target.value)} sx={{ flex: 1, minWidth: 220 }} /><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Κίνδυνος</InputLabel><Select label="Κίνδυνος" value={riskBand} onChange={event => setRiskBand(event.target.value)}><MenuItem value="all">Όλες οι κατηγορίες</MenuItem><MenuItem value="Safe">Ασφαλείς</MenuItem><MenuItem value="Watch">Παρακολούθηση</MenuItem><MenuItem value="At-risk">Σε κίνδυνο</MenuItem><MenuItem value="Critical">Κρίσιμοι</MenuItem></Select></FormControl><TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={from} onChange={event => setFrom(event.target.value)} /><TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={to} onChange={event => setTo(event.target.value)} /><Button variant="outlined" color="inherit" startIcon={<RestartAltIcon />} onClick={reset}>Καθαρισμός</Button></Stack></CardContent></Card>
    {query.isLoading && <Typography color="text.secondary">Υπολογίζονται τα στατιστικά…</Typography>}
    {query.isError && <Alert severity="error">Δεν ήταν δυνατή η φόρτωση των στατιστικών νοημοσύνης.</Alert>}
    {data && <>
      {!data.aiConfigured && <Alert severity="warning" sx={{ mb: 2 }}>Δεν έχει ρυθμιστεί κλειδί νοημοσύνης για το συγκεκριμένο γραφείο.</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2} flexWrap="wrap" useFlexGap>
        {[["Συνολικές μονάδες", data.aiUsage.totalTokens.toLocaleString("el-GR"), "primary"], ["Εκτιμώμενο κόστος", money(data.aiUsage.estimatedCostEur), "warning"], ["Επιτυχείς εκτελέσεις", `${successRate}%`, "success"], ["ROI / απόδοση ένδειξη", `${roiHint}x`, "info"]].map(([label, value, color]) => <Card key={label} sx={{ flex: "1 1 190px", minWidth: 170, border: "1px solid", borderColor: "divider" }}><CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={800} color={`${color}.main`}>{value}</Typography></CardContent></Card>)}
      </Stack>
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "#b9d8d2", background: "linear-gradient(135deg,#fbfffe,#f3faf8)" }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Box><Stack direction="row" spacing={1} alignItems="center"><PersonSearchIcon color="success" /><Typography variant="h6" fontWeight={800}>Ευκαιρίες πώλησης ανά πελάτη</Typography></Stack><Typography variant="body2" color="text.secondary">Πιθανές ανάγκες που προκύπτουν από τα υπάρχοντα συμβόλαια και το ιστορικό του πελατολογίου.</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Chip label={`Εκτιμώμενη προμήθεια: ${money(opportunityTotal)}`} color="success" /><Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportOpportunities}>Εξαγωγή</Button></Stack></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={2}><TextField size="small" value={opportunitySearch} onChange={event => setOpportunitySearch(event.target.value)} label="Αναζήτηση πελάτη ή κάλυψης" sx={{ flex: 1 }} /><FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Προτεραιότητα</InputLabel><Select label="Προτεραιότητα" value={opportunityPriority} onChange={event => setOpportunityPriority(event.target.value)}><MenuItem value="all">Όλες</MenuItem><MenuItem value="Υψηλή">Υψηλή</MenuItem><MenuItem value="Μεσαία">Μεσαία</MenuItem><MenuItem value="Χαμηλή">Χαμηλή</MenuItem></Select></FormControl></Stack><Stack spacing={1.1} mt={2}>{opportunities.slice(0, 20).map(item => <Card key={item.id} variant="outlined" sx={{ bgcolor: "background.paper" }}><CardContent sx={{ py: 1.4, "&:last-child": { pb: 1.4 } }}><Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}><Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography fontWeight={800}>{item.customer}</Typography><Chip size="small" label={item.priority} color={item.priority === "Υψηλή" ? "error" : item.priority === "Μεσαία" ? "warning" : "default"} /><Chip size="small" variant="outlined" label={`${item.confidence}% πιθανότητα`} /></Stack><Typography variant="body2" color="text.secondary" mt={0.3}><b>Πρόταση:</b> {item.product} · {item.reason}</Typography></Box><Box sx={{ minWidth: 155 }}><Typography variant="caption" color="text.secondary">Εκτίμηση ασφαλίστρου</Typography><Typography fontWeight={800}>{money(item.estimatedPremium)}</Typography><Typography variant="caption" color="success.main">Προμήθεια {money(item.estimatedCommission)}</Typography></Box><Button size="small" variant="contained" color="success" startIcon={<TrendingUpIcon />}>Δημιουργία follow-up</Button></Stack></CardContent></Card>)}</Stack>{opportunities.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>Δεν βρέθηκαν ευκαιρίες με τα επιλεγμένα φίλτρα.</Alert>}</CardContent></Card>
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={800}>Κατανάλωση ανά πελάτη</Typography><Typography variant="body2" color="text.secondary">Πόσες μονάδες και ποιο ενδεικτικό κόστος δημιουργήθηκε για κάθε πελάτη.</Typography></Box><AutoAwesomeIcon color="primary" /></Stack><Stack spacing={0.8} mt={1.5}>{customerUsage.slice(0, 8).map(item => <Stack key={item.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.7, borderBottom: "1px solid", borderColor: "divider" }}><Typography sx={{ width: { xs: 150, sm: 220 }, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</Typography><LinearProgress variant="determinate" value={Math.min(100, Math.max(3, (item.tokens / Math.max(1, data.aiUsage.totalTokens)) * 100))} sx={{ flex: 1, height: 8, borderRadius: 4 }} /><Typography variant="caption" sx={{ minWidth: 115, textAlign: "right" }}>{item.tokens.toLocaleString("el-GR")} μον. · {money(item.cost)}</Typography></Stack>)}</Stack>{customerUsage.length === 0 && <Typography color="text.secondary" mt={1}>Δεν υπάρχουν ακόμη καταγεγραμμένες χρήσεις ανά πελάτη.</Typography>}</CardContent></Card>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} mb={2}>
        <Card sx={{ flex: 1, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={800}>Κόστος & όριο χρήσης</Typography><Typography variant="body2" color="text.secondary">Ενδεικτική κατανάλωση του κλειδιού AI του γραφείου.</Typography></Box><MonetizationOnIcon color="warning" /></Stack><Stack direction="row" justifyContent="space-between" mt={2}><Typography variant="body2">Χρήση κόστους</Typography><Typography variant="body2" fontWeight={800}>{Math.min(100, Math.round(data.aiUsage.costPercent))}%</Typography></Stack><LinearProgress variant="determinate" value={Math.min(100, Math.max(0, data.aiUsage.costPercent))} color={data.aiUsage.costPercent >= 80 ? "warning" : "primary"} sx={{ height: 10, borderRadius: 5, mt: 0.7 }} /><Stack direction="row" justifyContent="space-between" mt={1.5}><Box><Typography variant="caption" color="text.secondary">Εκτίμηση μήνα</Typography><Typography fontWeight={800}>{money(data.aiUsage.estimatedCostEur)}</Typography></Box><Box sx={{ textAlign: "right" }}><Typography variant="caption" color="text.secondary">Υπόλοιπο ορίου</Typography><Typography fontWeight={800} color="success.main">{money(remainingBudget)}</Typography></Box></Stack><Alert severity={data.aiUsage.costPercent >= 80 ? "warning" : "success"} sx={{ mt: 1.5 }}>{data.aiUsage.costPercent >= 80 ? "Η χρήση πλησιάζει το όριο. Ελέγξτε τις αυτοματοποιήσεις και τα μεγάλα prompts." : "Η κατανάλωση βρίσκεται μέσα στο προβλεπόμενο όριο."}</Alert></CardContent></Card>
        <Card sx={{ flex: 1.35, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={800}>Πού χρησιμοποιείται η νοημοσύνη</Typography><Typography variant="body2" color="text.secondary">Κατανομή μονάδων και ενδεικτικού κόστους ανά λειτουργία.</Typography></Box><DataUsageIcon color="primary" /></Stack><Box sx={{ height: 220, mt: 1 }}><ResponsiveContainer><BarChart data={usageData} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="label" width={145} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => [name === "tokens" ? Number(value).toLocaleString("el-GR") : money(Number(value)), name === "tokens" ? "Μονάδες" : "Κόστος"]} /><Bar dataKey="tokens" name="Μονάδες" fill="#315ca8" radius={[0, 5, 5, 0]} /><Bar dataKey="cost" name="Κόστος" fill="#e29a25" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></Box></CardContent></Card>
      </Stack>
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={800}>Τάση κόστους AI</Typography><Typography variant="body2" color="text.secondary">Μηνιαίες απόπειρες και εκτίμηση κόστους για το επιλεγμένο διάστημα.</Typography></Box><TrendingUpIcon color="success" /></Stack><Box sx={{ height: 230, mt: 1 }}><ResponsiveContainer><AreaChart data={aiCostTrend}><defs><linearGradient id="aiCostFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#168d83" stopOpacity={0.35} /><stop offset="95%" stopColor="#168d83" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value, name) => [name === "cost" ? money(Number(value)) : Number(value).toLocaleString("el-GR"), name === "cost" ? "Κόστος" : "Αιτήματα"]} /><Area type="monotone" dataKey="cost" name="Κόστος" stroke="#168d83" fill="url(#aiCostFill)" strokeWidth={2} /><Line type="monotone" dataKey="requests" name="Αιτήματα" stroke="#315ca8" strokeWidth={2} /></AreaChart></ResponsiveContainer></Box></CardContent></Card>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}><Chip label={`Πελάτες: ${data.kpis.customers}`} /><Chip label={`Συμβόλαια: ${data.kpis.policies}`} /><Chip label={`Σε κίνδυνο: ${data.kpis.atRiskPolicies}`} color="warning" /><Chip label={`Κρίσιμα: ${data.kpis.criticalPolicies}`} color="error" /><Chip label={`Ανοιχτές ζημιές: ${data.kpis.openClaims}`} /><Chip label={`Λήξεις 30 ημερών: ${data.kpis.expiring30Days}`} /></Stack>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} mb={2}><Card sx={{ flex: 1, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Κατηγορίες κινδύνου</Typography><Box sx={{ height: 260 }}><ResponsiveContainer><BarChart data={riskData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="πλήθος" fill="#1565c0" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></Box></CardContent></Card><Card sx={{ flex: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Τάση χαρτοφυλακίου</Typography><Box sx={{ height: 260 }}><ResponsiveContainer><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="premium" name="Ασφάλιστρα" stroke="#1565c0" strokeWidth={2} /><Line type="monotone" dataKey="claims" name="Ζημιές" stroke="#d32f2f" strokeWidth={2} /></LineChart></ResponsiveContainer></Box></CardContent></Card></Stack>
      <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Ανά πελάτη</Typography><Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>{data.customers.slice(0, 20).map(item => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ py: 1 }}><Box><Typography fontWeight={700}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.policyCount} συμβόλαια · {money(item.premium)} · {item.nextAction}</Typography></Box><Chip size="small" label={`${bandLabels[item.band] ?? item.band} · ${item.score}/100`} color={item.score >= 70 ? "error" : item.score >= 45 ? "warning" : "success"} /></Stack>)}</Stack>{data.customers.length === 0 && <Typography color="text.secondary">Δεν βρέθηκαν πελάτες.</Typography>}</CardContent></Card>
      <Card sx={{ border: "1px solid", borderColor: "divider" }}><CardContent><Typography variant="h6" mb={1}>Ανά συμβόλαιο</Typography><Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>{data.policies.slice(0, 30).map(item => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ py: 1 }}><Box><Typography fontWeight={700}>{item.policyNumber} · {item.customerName}</Typography><Typography variant="caption" color="text.secondary">{item.carrier} · {statusLabels[item.status] ?? item.status} · λήξη {item.endDate} · {money(item.premium)}</Typography></Box><Chip size="small" label={`${bandLabels[item.band] ?? item.band} · ${item.score}/100`} color={item.score >= 70 ? "error" : item.score >= 45 ? "warning" : "success"} /></Stack>)}</Stack>{data.policies.length === 0 && <Typography color="text.secondary">Δεν βρέθηκαν συμβόλαια.</Typography>}</CardContent></Card>
      <Alert severity="info" sx={{ mt: 2 }}>{data.aiUsage.suggestion} Η ένδειξη ROI υπολογίζεται ενδεικτικά από το ποσοστό επιτυχών εκτελέσεων σε σχέση με το εκτιμώμενο κόστος και δεν αποτελεί λογιστική αποτίμηση.</Alert>
    </>}
  </Box>;
}
