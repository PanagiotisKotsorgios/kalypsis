import { useMemo } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import EditNoteIcon from "@mui/icons-material/EditNote";
import InsightsIcon from "@mui/icons-material/Insights";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { AnimatedKpiCard, ChartCard, ModernAreaChart } from "../components/ModernDashboard";

type Website = { slug: string; siteName: string; isPublished: boolean; customDomain: string | null };
type RequestRow = { id: string; fullName: string; email: string; product: string | null; status: string; createdAt: string };
type Analytics = { pageViews: number; uniqueVisitors: number; formSubmissions: number; daily: { label: string; views: number; requests: number }[] };

export function OfficeWebsiteOverviewPage() {
  const navigate = useNavigate();
  const website = useQuery({ queryKey: ["office-website"], queryFn: async () => (await api.get<Website>("/office-website")).data });
  const requests = useQuery({ queryKey: ["office-website-requests"], queryFn: async () => (await api.get<RequestRow[]>("/office-website/requests")).data });
  const analytics = useQuery({ queryKey: ["office-website-overview-analytics"], queryFn: async () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return (await api.get<Analytics>("/office-website/analytics", { params: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } })).data; } });
  const pending = useMemo(() => (requests.data ?? []).filter(x => x.status === "New" || x.status === "InProgress").length, [requests.data]);
  if (website.isLoading || requests.isLoading || analytics.isLoading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  if (website.isError || requests.isError || analytics.isError || !website.data || !analytics.data) return <Alert severity="error">{extractErrorMessage(website.error || requests.error || analytics.error)}</Alert>;
  const site = website.data; const stats = analytics.data;
  return <Box>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2} mb={3}><Stack direction="row" spacing={1.5} alignItems="center"><InsightsIcon color="primary" sx={{ fontSize: 38 }} /><Box><Typography variant="h4" fontWeight={800}>Επισκόπηση ιστοσελίδας</Typography><Typography color="text.secondary">Μία καθαρή εικόνα της παρουσίας του γραφείου σας και των νέων ευκαιριών.</Typography></Box></Stack><Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => window.open(`/site/${site.slug}`, "_blank", "noopener,noreferrer")}>Προεπισκόπηση</Button><Button variant="contained" startIcon={<EditNoteIcon />} onClick={() => navigate("/app/office-website")}>Επεξεργασία</Button></Stack></Stack>
    <Card variant="outlined" sx={{ mb: 2.5, borderColor: site.isPublished ? "success.main" : "warning.main" }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between"><Box><Typography variant="h6" fontWeight={800}>{site.siteName}</Typography><Typography color="text.secondary">{site.customDomain || `/site/${site.slug}`}</Typography></Box><Chip color={site.isPublished ? "success" : "warning"} label={site.isPublished ? "Δημοσιευμένη" : "Πρόχειρο — δεν φαίνεται δημόσια"} /></Stack></CardContent></Card>
    <Grid container spacing={2.5} mb={2.5}><Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Προβολές 30 ημερών" value={stats.pageViews} icon={<InsightsIcon />} accent="#1f7bb3" /></Grid><Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Μοναδικοί επισκέπτες" value={stats.uniqueVisitors} icon={<AddBusinessIcon />} accent="#14a77a" /></Grid><Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Νέα αιτήματα" value={stats.formSubmissions} icon={<PendingActionsIcon />} accent="#e58b25" /></Grid><Grid item xs={12} sm={6} md={3}><AnimatedKpiCard label="Ανοιχτά αιτήματα" value={pending} icon={<PendingActionsIcon />} accent="#8b5cf6" /></Grid></Grid>
    <Grid container spacing={2.5}><Grid item xs={12} md={8}><ChartCard title="Πορεία επισκεψιμότητας" subtitle="Τελευταίες 30 ημέρες"><ModernAreaChart data={stats.daily.map(x => ({ label: x.label, value: x.views }))} color="#1f7bb3" /></ChartCard></Grid><Grid item xs={12} md={4}><Card variant="outlined"><CardContent><Typography variant="h6" fontWeight={800} mb={1.5}>Γρήγορες ενέργειες</Typography><Stack spacing={1}><Button fullWidth variant="outlined" onClick={() => navigate("/app/office-website/requests")}>Δείτε τα αιτήματα</Button><Button fullWidth variant="outlined" onClick={() => navigate("/app/office-website/analytics")}>Αναλυτικά στατιστικά</Button><Button fullWidth variant="outlined" onClick={() => navigate("/app/office-website")}>Άρθρα και προσφορές</Button></Stack></CardContent></Card></Grid></Grid>
    <Card variant="outlined" sx={{ mt: 2.5 }}><CardContent><Typography variant="h6" fontWeight={800} mb={1.5}>Πρόσφατα αιτήματα</Typography>{(requests.data ?? []).slice(0, 5).map(row => <Stack key={row.id} direction="row" justifyContent="space-between" alignItems="center" py={1} sx={{ borderBottom: 1, borderColor: "divider" }}><Box><Typography fontWeight={700}>{row.fullName}</Typography><Typography variant="body2" color="text.secondary">{row.product || "Γενικό ενδιαφέρον"} · {new Date(row.createdAt).toLocaleDateString("el-GR")}</Typography></Box><Chip size="small" label={row.status} /></Stack>)}{(requests.data ?? []).length === 0 && <Typography color="text.secondary">Δεν υπάρχουν ακόμη αιτήματα. Μοιραστείτε τη σελίδα σας για να ξεκινήσετε.</Typography>}</CardContent></Card>
  </Box>;
}
