import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider,
  Grid, IconButton, MenuItem, Pagination, Paper, Stack, Tab, Tabs, TextField,
  Tooltip, Typography,
} from "@mui/material";
import CalculateRoundedIcon from "@mui/icons-material/CalculateRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface Branding { displayName: string; logoUrl?: string | null; primaryColor: string; secondaryColor: string; welcomeMessage?: string | null; }
interface MeDto { accessId: string; loginCode: string; producerName: string; officeName: string; branding: Branding; permissions: string[]; }
interface WorkspaceDto { totalQuotes: number; quotesThisMonth: number; activeQuotes: number; expiringThisWeek: number; permissions: string[]; canIssuePolicies: boolean; canViewCustomers: boolean; slug: string; officeName: string; }
interface CustomerDto { id: string; name: string; email?: string | null; phone?: string | null; }
interface OfferDto { id: string; carrierCode: string; carrierProductCode?: string | null; premium: number; currency: string; commission?: number | null; coverageSummary?: string | null; validUntil?: string | null; selected: boolean; }
interface QuoteDto { id: string; quoteNumber: string; productType: string; status: string; customerName?: string | null; customerId?: string | null; createdAt: string; expiresAt?: string | null; selectedOfferId?: string | null; offers: OfferDto[]; riskInputsJson: string; }
interface QuotePageDto { items: QuoteDto[]; total: number; page: number; pageSize: number; }
interface ApplicationDto { id: string; applicationNumber: string; status: string; quoteNumber: string; carrierCode: string; }

const branches = [
  { label: "Οχημάτων", productType: "Auto", icon: "🚗" }, { label: "Περιουσίας", productType: "Home", icon: "🏠" },
  { label: "Υγείας", productType: "Health", icon: "🩺" }, { label: "Ζωής", productType: "Life", icon: "❤️" },
  { label: "Επαγγελματικής ευθύνης", productType: "Business", icon: "💼" }, { label: "Σκαφών", productType: "Travel", icon: "⛵" },
  { label: "Προσωπικού ατυχήματος", productType: "Other", icon: "🛡️" }, { label: "Νομικής προστασίας", productType: "Other", icon: "⚖️" },
];
const statusLabel: Record<string, string> = { Draft: "Πρόχειρη", Submitted: "Υποβλήθηκε", Quoted: "Έτοιμη", Bound: "Επιλέχθηκε", Expired: "Ληγμένη", Rejected: "Απορρίφθηκε" };
const money = (value: number, currency = "EUR") => new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(value);

export function InsureOnePartnerDashboardPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [latest, setLatest] = useState<QuoteDto | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const me = useQuery({ queryKey: ["insureone-me"], queryFn: async () => (await api.get<MeDto>("/insureone/me")).data, retry: false });
  const workspace = useQuery({ queryKey: ["insureone-workspace"], queryFn: async () => (await api.get<WorkspaceDto>("/insureone/workspace")).data, retry: false, enabled: !!me.data });
  if (me.isLoading) return <Loading />;
  if (me.isError || !me.data) return <Container sx={{ py: 8 }}><Alert severity="error">{extractErrorMessage(me.error, "Δεν ήταν δυνατή η φόρτωση του InsureOne.")}</Alert></Container>;
  const data = me.data;
  const logout = () => { signOut(); navigate(`/insureone/${encodeURIComponent(slug)}/login`, { replace: true }); };
  return <Box sx={{ minHeight: "100vh", bgcolor: "#eef6fc", background: `linear-gradient(140deg, ${data.branding.primaryColor}12, #eef6fc 55%, ${data.branding.secondaryColor}10)`, py: { xs: 1, md: 3 } }}>
    <Container maxWidth="xl">
      <Card elevation={0} sx={{ borderRadius: 4, border: "1px solid #d6e5f2", overflow: "hidden", mb: 2 }}>
        <Box sx={{ bgcolor: data.branding.secondaryColor, color: "white", px: { xs: 2, md: 4 }, py: { xs: 2, md: 2.5 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
            {data.branding.logoUrl ? <Box component="img" src={data.branding.logoUrl} alt={`Λογότυπο ${data.branding.displayName}`} sx={{ width: 92, height: 54, objectFit: "contain", bgcolor: "white", borderRadius: 2, p: .75 }} /> : <Box sx={{ width: 54, height: 54, borderRadius: 2, bgcolor: data.branding.primaryColor, display: "grid", placeItems: "center", fontWeight: 900 }}>IO</Box>}
            <Box minWidth={0}><Typography variant="overline" sx={{ opacity: .78, letterSpacing: ".12em" }}>InsureOne · Συνεργάτης</Typography><Typography variant="h5" fontWeight={900} noWrap>{data.branding.displayName}</Typography><Typography sx={{ opacity: .84 }} noWrap>{data.producerName} · {data.officeName}</Typography></Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center"><Chip label={`Κωδικός: ${data.loginCode}`} sx={{ color: "white", bgcolor: "rgba(255,255,255,.15)" }} /><Button color="inherit" variant="outlined" startIcon={<LogoutRoundedIcon />} onClick={logout} sx={{ borderColor: "rgba(255,255,255,.55)" }}>Αποσύνδεση</Button></Stack>
        </Box>
      </Card>
      {data.branding.welcomeMessage && <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>{data.branding.welcomeMessage}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")} sx={{ mb: 2 }}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <WorkspaceMetrics data={workspace.data} />
      <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: "hidden", borderColor: "#d6e5f2" }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ bgcolor: "#f8fbfe", borderBottom: "1px solid #e1edf5", "& .MuiTab-root": { fontWeight: 800, textTransform: "none" } }}><Tab value="new" icon={<CalculateRoundedIcon fontSize="small" />} iconPosition="start" label="Νέα τιμολόγηση" /><Tab value="history" icon={<HistoryRoundedIcon fontSize="small" />} iconPosition="start" label="Ιστορικό προσφορών" /></Tabs>
        <Box sx={{ p: { xs: 1.5, md: 3 } }}>{tab === "new" ? <QuoteComposer branding={data.branding} canCreate={workspace.data?.permissions.some(x => ["quoting.create", "quotes.save"].includes(x)) ?? false} canViewCustomers={workspace.data?.canViewCustomers ?? false} onCreated={(quote) => { setLatest(quote); void queryClient.invalidateQueries({ queryKey: ["insureone-workspace"] }); }} onError={setError} /> : <QuoteHistory canSaveQuotes={workspace.data?.permissions.some(x => ["quoting.create", "quotes.save"].includes(x)) ?? false} onError={setError} onSelected={setLatest} />}</Box>
      </Paper>
      {latest && <QuoteResult quote={latest} branding={data.branding} canSaveQuotes={workspace.data?.permissions.some(x => ["quoting.create", "quotes.save"].includes(x)) ?? false} canIssuePolicies={workspace.data?.canIssuePolicies ?? false} onError={setError} onNotice={setNotice} onUpdated={setLatest} />}
    </Container>
  </Box>;
}

function Loading() { return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#eef6fc" }}><CircularProgress /></Box>; }
function WorkspaceMetrics({ data }: { data?: WorkspaceDto }) {
  const items = [{ label: "Σύνολο προσφορών", value: data?.totalQuotes ?? 0, color: "#0b5cab" }, { label: "Αυτόν τον μήνα", value: data?.quotesThisMonth ?? 0, color: "#168f9a" }, { label: "Ενεργές προσφορές", value: data?.activeQuotes ?? 0, color: "#167a55" }, { label: "Λήγουν σύντομα", value: data?.expiringThisWeek ?? 0, color: "#b36b00" }];
  return <Grid container spacing={1.5}>{items.map(item => <Grid item xs={6} md={3} key={item.label}><Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#d6e5f2", bgcolor: "rgba(255,255,255,.8)" }}><CardContent sx={{ p: { xs: 1.5, md: 2 } }}><Typography variant="body2" color="text.secondary" fontWeight={700}>{item.label}</Typography><Typography variant="h4" fontWeight={900} sx={{ color: item.color }}>{item.value}</Typography></CardContent></Card></Grid>)}</Grid>;
}

function QuoteComposer({ branding, canCreate, canViewCustomers, onCreated, onError }: { branding: Branding; canCreate: boolean; canViewCustomers: boolean; onCreated: (quote: QuoteDto) => void; onError: (message: string) => void }) {
  const [branch, setBranch] = useState(branches[0].productType); const [customerId, setCustomerId] = useState<string | null>(null); const [customerSearch, setCustomerSearch] = useState(""); const [plate, setPlate] = useState(""); const [model, setModel] = useState(""); const [year, setYear] = useState(""); const [value, setValue] = useState(""); const [notes, setNotes] = useState("");
  const customers = useQuery({ queryKey: ["insureone-customers", customerSearch], queryFn: async () => (await api.get<CustomerDto[]>("/insureone/customers", { params: { search: customerSearch } })).data, enabled: canViewCustomers && customerSearch.trim().length >= 2 });
  const create = useMutation({ mutationFn: async () => (await api.post<QuoteDto>("/insureone/quotes", { productType: branch, customerId, riskInputsJson: JSON.stringify({ plate, model, firstRegistrationYear: year, insuredValue: value, notes }) })).data, onSuccess: onCreated, onError: e => onError(extractErrorMessage(e, "Δεν δημιουργήθηκε η προσφορά.")) });
  if (!canCreate) return <Alert severity="info" sx={{ borderRadius: 3 }}>Ο διαχειριστής του γραφείου δεν έχει ενεργοποιήσει τη δημιουργία προσφορών για τον λογαριασμό σας.</Alert>;
  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1}><Box><Typography variant="h5" fontWeight={900} color="#123a64">Νέα προσφορά</Typography><Typography color="text.secondary">Συμπληρώστε τα βασικά στοιχεία και ζητήστε συγκρίσιμες τιμές από τις ενεργές γέφυρες.</Typography></Box><Chip label="Τα δεδομένα παραμένουν στο γραφείο σας" color="success" variant="outlined" /></Stack>
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={4}><TextField select fullWidth label="Κλάδος ασφάλισης" value={branch} onChange={e => setBranch(e.target.value)}>{branches.map(x => <MenuItem value={x.productType} key={x.label}>{x.icon} {x.label}</MenuItem>)}</TextField></Grid>
      <Grid item xs={12} md={8}><TextField fullWidth label="Πελάτης (προαιρετικά)" value={customerId ? (customers.data?.find(x => x.id === customerId)?.name ?? customerSearch) : customerSearch} onChange={e => { setCustomerId(null); setCustomerSearch(e.target.value); }} InputProps={{ startAdornment: <SearchRoundedIcon sx={{ color: "text.disabled", mr: .75 }} /> }} helperText={canViewCustomers ? "Αναζητήστε με όνομα, email ή τηλέφωνο." : "Η προσφορά θα δημιουργηθεί χωρίς σύνδεση πελάτη."} />{canViewCustomers && customers.data && customers.data.length > 0 && !customerId && <Paper variant="outlined" sx={{ mt: .5, maxHeight: 180, overflow: "auto" }}>{customers.data.map(customer => <Box key={customer.id} onClick={() => { setCustomerId(customer.id); setCustomerSearch(customer.name); }} sx={{ px: 1.5, py: 1, cursor: "pointer", "&:hover": { bgcolor: "#eef7fc" } }}><Typography fontWeight={750}>{customer.name}</Typography><Typography variant="caption" color="text.secondary">{customer.email ?? customer.phone ?? ""}</Typography></Box>)}</Paper>}</Grid>
      <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Αρ. κυκλοφορίας" value={plate} onChange={e => setPlate(e.target.value)} /></Grid><Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Κατασκευαστής / μοντέλο" value={model} onChange={e => setModel(e.target.value)} /></Grid><Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Έτος / διάρκεια" value={year} onChange={e => setYear(e.target.value)} /></Grid><Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Ασφαλιζόμενη αξία" value={value} onChange={e => setValue(e.target.value)} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Σημειώσεις κινδύνου" value={notes} onChange={e => setNotes(e.target.value)} /></Grid>
    </Grid>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Typography variant="body2" color="text.secondary">Η τελική τιμή εξαρτάται από τις ενεργές διασυνδέσεις του γραφείου.</Typography><Button variant="contained" size="large" startIcon={<CalculateRoundedIcon />} onClick={() => create.mutate()} disabled={create.isPending} sx={{ bgcolor: branding.primaryColor, fontWeight: 850, px: 3 }}>{create.isPending ? <CircularProgress size={20} color="inherit" /> : "Υπολογισμός προσφορών"}</Button></Stack>
  </Stack>;
}

function QuoteHistory({ canSaveQuotes, onError, onSelected }: { canSaveQuotes: boolean; onError: (message: string) => void; onSelected: (quote: QuoteDto) => void }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [status, setStatus] = useState("");
  const query = useQuery({ queryKey: ["insureone-quotes", search, status, page], queryFn: async () => (await api.get<QuotePageDto>("/insureone/quotes", { params: { search, status: status || undefined, page, pageSize: 10 } })).data });
  const download = async () => { try { const response = await api.get<Blob>("/insureone/quotes/export", { params: { status: status || undefined }, responseType: "blob" }); const url = URL.createObjectURL(response.data); const a = document.createElement("a"); a.href = url; a.download = "insureone-quotes.csv"; a.click(); URL.revokeObjectURL(url); } catch (e) { onError(extractErrorMessage(e, "Δεν ήταν δυνατή η εξαγωγή.")); } };
  return <Stack spacing={1.5}><Stack direction={{ xs: "column", md: "row" }} gap={1} justifyContent="space-between"><TextField size="small" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Αναζήτηση προσφοράς ή πελάτη" InputProps={{ startAdornment: <SearchRoundedIcon sx={{ mr: .75, color: "text.disabled" }} /> }} sx={{ minWidth: { md: 360 } }} /><Stack direction="row" gap={1}><TextField select size="small" label="Κατάσταση" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} sx={{ minWidth: 160 }}><MenuItem value="">Όλες</MenuItem>{Object.entries(statusLabel).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField><Tooltip title="Εξαγωγή ιστορικού"><IconButton onClick={() => void download()} sx={{ border: "1px solid #c9dbea", borderRadius: 1.5, color: "#0b5cab" }}><DownloadRoundedIcon /></IconButton></Tooltip></Stack></Stack>{query.isLoading ? <Box sx={{ display: "grid", placeItems: "center", py: 5 }}><CircularProgress /></Box> : query.isError ? <Alert severity="error">{extractErrorMessage(query.error)}</Alert> : <Stack spacing={1}>{query.data?.items.map(quote => <QuoteHistoryRow key={quote.id} quote={quote} canSaveQuotes={canSaveQuotes} onError={onError} onSelected={onSelected} />)}{query.data?.items.length === 0 && <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>Δεν υπάρχουν προσφορές με αυτά τα φίλτρα.</Typography>}</Stack>}{(query.data?.total ?? 0) > 10 && <Pagination page={page} count={Math.ceil((query.data?.total ?? 0) / 10)} onChange={(_, value) => setPage(value)} color="primary" />}</Stack>;
}

function QuoteHistoryRow({ quote, canSaveQuotes, onError, onSelected }: { quote: QuoteDto; canSaveQuotes: boolean; onError: (message: string) => void; onSelected: (quote: QuoteDto) => void }) {
  const qc = useQueryClient(); const select = useMutation({ mutationFn: (offerId: string) => api.post<QuoteDto>(`/insureone/quotes/${quote.id}/offers/${offerId}/select`), onSuccess: response => { onSelected(response.data); void qc.invalidateQueries({ queryKey: ["insureone-quotes"] }); }, onError: e => onError(extractErrorMessage(e)) }); const best = quote.offers[0];
  return <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: quote.status === "Bound" ? "#9ad4b4" : "#dce8f1" }}><CardContent sx={{ p: { xs: 1.5, md: 2 } }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}><Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography fontWeight={900}>{quote.quoteNumber}</Typography><Chip size="small" label={statusLabel[quote.status] ?? quote.status} color={quote.status === "Bound" ? "success" : quote.status === "Rejected" ? "error" : "primary"} variant="outlined" /></Stack><Typography variant="body2" color="text.secondary">{quote.productType} · {quote.customerName ?? "Χωρίς σύνδεση πελάτη"} · {new Date(quote.createdAt).toLocaleString("el-GR")}</Typography></Box><Stack direction="row" alignItems="center" gap={1}>{best && <Typography fontWeight={900} color="#0b5cab">από {money(best.premium, best.currency)}</Typography>}{canSaveQuotes && best && !quote.selectedOfferId && <Button size="small" variant="contained" onClick={() => select.mutate(best.id)} disabled={select.isPending} startIcon={<CheckCircleRoundedIcon />}>Επιλογή</Button>}</Stack></Stack><Divider sx={{ my: 1.25 }} /><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{quote.offers.map(offer => <Chip key={offer.id} size="small" label={`${offer.carrierCode} · ${money(offer.premium, offer.currency)}${offer.selected ? " · Επιλεγμένη" : ""}`} color={offer.selected ? "success" : "default"} onClick={() => canSaveQuotes && !offer.selected ? select.mutate(offer.id) : undefined} clickable={canSaveQuotes && !offer.selected} />)}</Stack></CardContent></Card>;
}

function QuoteResult({ quote, branding, canSaveQuotes, canIssuePolicies, onError, onNotice, onUpdated }: { quote: QuoteDto; branding: Branding; canSaveQuotes: boolean; canIssuePolicies: boolean; onError: (message: string) => void; onNotice: (message: string) => void; onUpdated: (quote: QuoteDto) => void }) {
  const [submitting, setSubmitting] = useState(false); const select = useMutation({ mutationFn: (offerId: string) => api.post<QuoteDto>(`/insureone/quotes/${quote.id}/offers/${offerId}/select`), onSuccess: response => onUpdated(response.data), onError: e => onError(extractErrorMessage(e)) }); const application = useMutation({ mutationFn: () => api.post<ApplicationDto>(`/insureone/quotes/${quote.id}/application`, { startDate: null, endDate: null }), onSuccess: response => { setSubmitting(false); onNotice(`Η αίτηση ${response.data.applicationNumber} υποβλήθηκε προς ${response.data.carrierCode}.`); }, onError: e => { setSubmitting(false); onError(extractErrorMessage(e)); } });
  if (!quote.offers.length) return <Alert severity="warning" sx={{ mt: 2, borderRadius: 3 }}>Η προσφορά δημιουργήθηκε, αλλά δεν επέστρεψε διαθέσιμη τιμή. Ελέγξτε τις ενεργές γέφυρες στο γραφείο.</Alert>;
  return <Card sx={{ mt: 2, borderRadius: 3, border: `1px solid ${branding.primaryColor}55`, background: `linear-gradient(135deg, ${branding.primaryColor}0b, #fff)` }}><CardContent><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1} mb={1.5}><Box><Typography variant="h6" fontWeight={900} color="#123a64">Αποτελέσματα {quote.quoteNumber}</Typography><Typography variant="body2" color="text.secondary">{quote.customerName ?? "Χωρίς σύνδεση πελάτη"} · {quote.productType}</Typography></Box><Chip label={`${quote.offers.length} διαθέσιμες τιμές`} color="primary" variant="outlined" /></Stack><Grid container spacing={1.25}>{quote.offers.map(offer => <Grid item xs={12} md={6} key={offer.id}><Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5, borderColor: offer.selected ? "#1e8e5a" : "#dce8f1", bgcolor: offer.selected ? "#f0fbf5" : "#fff" }}><CardContent sx={{ p: 1.75 }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}><Box><Typography fontWeight={900}>{offer.carrierCode}</Typography><Typography variant="body2" color="text.secondary">{offer.carrierProductCode ?? "Πρόγραμμα"}</Typography></Box><Typography variant="h6" fontWeight={900} color={branding.primaryColor}>{money(offer.premium, offer.currency)}</Typography></Stack><Typography variant="body2" sx={{ mt: 1, minHeight: 40 }}>{offer.coverageSummary ?? "Περιλαμβάνονται οι καλύψεις του προγράμματος."}</Typography><Stack direction="row" justifyContent="flex-end" mt={1.25}>{offer.selected ? <Chip size="small" color="success" icon={<CheckCircleRoundedIcon />} label="Επιλεγμένη" /> : <Button size="small" variant="outlined" onClick={() => canSaveQuotes && select.mutate(offer.id)} disabled={!canSaveQuotes || select.isPending}>Επιλογή προσφοράς</Button>}</Stack></CardContent></Card></Grid>)}</Grid>{quote.selectedOfferId && canIssuePolicies && <Stack direction="row" justifyContent="flex-end" mt={2}><Button variant="contained" startIcon={<SendRoundedIcon />} onClick={() => { setSubmitting(true); application.mutate(); }} disabled={submitting || application.isPending} sx={{ bgcolor: "#16804f", fontWeight: 850 }}>{submitting ? <CircularProgress size={18} color="inherit" /> : "Υποβολή προς έκδοση"}</Button></Stack>}</CardContent></Card>;
}
