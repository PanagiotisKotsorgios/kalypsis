import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Dialog, DialogTitle, Grid, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DownloadIcon from "@mui/icons-material/Download";
import SendIcon from "@mui/icons-material/Send";
import { api, extractErrorMessage } from "../api/client";

type PortalData = {
  tenant?: { name?: string; logoUrl?: string; brandColorHex?: string; contactEmail?: string; contactPhone?: string; addressLine?: string };
  office?: { name?: string; city?: string; address?: string; phone?: string; email?: string };
  customer: Record<string, any>;
  policies: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  greenCards: Array<Record<string, any>>;
  consents: Array<Record<string, any>>;
  claims: Array<Record<string, any>>;
  requests: Array<Record<string, any>>;
  notifications: Array<Record<string, any>>;
  summary: { totalPolicies: number; activePolicies: number; documents: number; openClaims: number; pendingRequests: number };
};

const policyLabels: Record<string, string> = { Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπό" };
const statusLabels: Record<string, string> = { Active: "Ενεργό", Draft: "Πρόχειρο", Expired: "Έληξε", Cancelled: "Ακυρωμένο", Renewed: "Ανανεωμένο", PendingRenewal: "Σε ανανέωση", Undelivered: "Δεν παραδόθηκε", AwaitingIssue: "Αναμονή έκδοσης", Prospect: "Υποψήφιο" };
const requestTypes: Record<string, string> = { NewPolicy: "Νέο συμβόλαιο", AccidentReport: "Δήλωση ζημιάς", DocumentRequest: "Αίτημα εγγράφου", PolicyChange: "Αλλαγή συμβολαίου", GeneralQuestion: "Γενική ερώτηση" };
const requestStatuses: Record<string, string> = { Submitted: "Υποβλήθηκε", InReview: "Σε εξέταση", AwaitingCustomerInfo: "Αναμονή στοιχείων", Resolved: "Ολοκληρώθηκε", Closed: "Κλειστό", Rejected: "Απορρίφθηκε" };

const fmtDate = (v?: string | null) => v ? new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(new Date(v)) : "—";
const fmtMoney = (v?: number | null, currency = "EUR") => v == null ? "—" : new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(v);
const displayCustomer = (c: Record<string, any>) => c.type === "Company" ? c.companyName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();

export function CustomerPortalPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ type: "GeneralQuestion", subject: "", description: "", relatedPolicyId: "" });
  const q = useQuery({ queryKey: ["customer-portal"], queryFn: async () => (await api.get<PortalData>("/me/portal")).data, staleTime: 20_000 });
  const createRequest = useMutation({
    mutationFn: async () => api.post("/me/portal/requests", { ...form, relatedPolicyId: form.relatedPolicyId || null, incidentDate: null, incidentLocation: null, otherPartyInfo: null }),
    onSuccess: async () => { setRequestOpen(false); setForm({ type: "GeneralQuestion", subject: "", description: "", relatedPolicyId: "" }); await queryClient.invalidateQueries({ queryKey: ["customer-portal"] }); },
  });
  const data = q.data;
  const activePolicies = useMemo(() => data?.policies.filter(p => p.status === "Active") ?? [], [data]);

  if (q.isLoading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 360 }}><CircularProgress /></Box>;
  if (q.isError || !data) return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση της πύλης. {q.error ? extractErrorMessage(q.error) : ""}</Alert>;
  const brand = data.tenant?.brandColorHex || "#123c69";

  const download = async (id: string, name: string) => {
    const res = await api.get(`/documents/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const selectTab = (value: string) => setParams(value === "overview" ? {} : { tab: value });
  const stat = (icon: ReactNode, label: string, value: number, color: string) => <Card sx={{ flex: 1, minWidth: 150, borderTop: `4px solid ${color}` }}><CardContent sx={{ py: 1.5 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ color }}>{icon}</Box><Typography variant="caption" color="text.secondary">{label}</Typography></Stack><Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography></CardContent></Card>;

  return <Box sx={{ maxWidth: 1280, mx: "auto", p: { xs: 1, md: 2 } }}>
    <Card sx={{ mb: 2, overflow: "hidden", background: `linear-gradient(110deg, ${brand}, #1d6b8f)`, color: "white" }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
        {data.tenant?.logoUrl ? <Box component="img" src={data.tenant.logoUrl} sx={{ width: 56, height: 56, objectFit: "contain", bgcolor: "white", borderRadius: 1, p: .5 }} /> : <DescriptionIcon sx={{ fontSize: 48 }} />}
        <Box><Typography variant="overline" sx={{ opacity: .8 }}>Πύλη πελάτη</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>Καλώς ήρθατε, {displayCustomer(data.customer)}</Typography><Typography variant="body2" sx={{ opacity: .9 }}>{data.office?.name ?? data.tenant?.name} · Τα έγγραφα και τα συμβόλαιά σας σε ένα σημείο.</Typography></Box>
      </CardContent>
    </Card>
    <Tabs value={tab} onChange={(_, v) => selectTab(v)} variant="scrollable" sx={{ mb: 2, bgcolor: "background.paper", borderRadius: 1, border: "1px solid #d7e0ea" }}>
      <Tab value="overview" icon={<DashboardIcon />} iconPosition="start" label="Σύνοψη" />
      <Tab value="policies" icon={<DescriptionIcon />} iconPosition="start" label="Συμβόλαια" />
      <Tab value="documents" icon={<FolderIcon />} iconPosition="start" label="Έγγραφα" />
      <Tab value="green-cards" label="Πράσινες κάρτες" />
      <Tab value="requests" icon={<AssignmentIcon />} iconPosition="start" label="Αιτήματα" />
      <Tab value="claims" icon={<ReportProblemIcon />} iconPosition="start" label="Ζημιές" />
      <Tab value="notifications" icon={<NotificationsIcon />} iconPosition="start" label="Ειδοποιήσεις" />
      <Tab value="consents" label="Συγκαταθέσεις" />
      <Tab value="profile" label="Προφίλ" />
    </Tabs>

    {tab === "overview" && <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        {stat(<DescriptionIcon />, "Συμβόλαια", data.summary.totalPolicies, "#1976d2")}{stat(<DescriptionIcon />, "Ενεργά", data.summary.activePolicies, "#2e7d32")}{stat(<FolderIcon />, "Έγγραφα", data.summary.documents, "#7b1fa2")}{stat(<ReportProblemIcon />, "Ανοιχτές ζημιές", data.summary.openClaims, "#c62828")}{stat(<AssignmentIcon />, "Εκκρεμή αιτήματα", data.summary.pendingRequests, "#ed6c02")}
      </Stack>
      <Grid container spacing={2}><Grid item xs={12} md={7}><Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Τα ενεργά συμβόλαιά σας</Typography>{activePolicies.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν ενεργά συμβόλαια.</Typography> : activePolicies.map(p => <Paper key={p.id} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontWeight: 700 }}>{p.policyNumber} · {policyLabels[p.policyType] ?? p.policyType}</Typography><Typography variant="body2" color="text.secondary">{p.insuranceCompany} · {fmtDate(p.startDate)} — {fmtDate(p.endDate)}</Typography></Box><Chip size="small" color="success" label={statusLabels[p.status] ?? p.status} /></Stack></Paper>)}</CardContent></Card></Grid><Grid item xs={12} md={5}><Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Στοιχεία γραφείου</Typography><Typography>{data.office?.name ?? data.tenant?.name}</Typography><Typography variant="body2">{data.office?.address ?? data.tenant?.addressLine ?? ""} {data.office?.city ?? ""}</Typography><Typography variant="body2">{data.office?.phone ?? data.tenant?.contactPhone ?? ""}</Typography><Typography variant="body2">{data.office?.email ?? data.tenant?.contactEmail ?? ""}</Typography></CardContent></Card></Grid></Grid>
    </>}

    {tab === "policies" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Όλα τα συμβόλαια</Typography>{data.policies.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν συμβόλαια.</Typography> : data.policies.map(p => <Paper key={p.id} variant="outlined" sx={{ p: 1.4, mb: 1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 800 }}>{p.policyNumber} · {policyLabels[p.policyType] ?? p.policyType}</Typography><Typography variant="body2">{p.insuranceCompany} {p.producer ? `· ${p.producer}` : ""}</Typography><Typography variant="body2" color="text.secondary">Ισχύς: {fmtDate(p.startDate)} — {fmtDate(p.endDate)} · Ασφάλιστρο: {fmtMoney(p.premium, p.currency)}</Typography>{p.vehicleRegistrationPlate && <Typography variant="body2">Πινακίδα: {p.vehicleRegistrationPlate}</Typography>}</Box><Chip size="small" label={statusLabels[p.status] ?? p.status} color={p.status === "Active" ? "success" : "default"} /></Stack></Paper>)}</CardContent></Card>}

    {tab === "documents" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Έγγραφα</Typography>{data.documents.length === 0 ? <Typography color="text.secondary">Δεν έχουν αναρτηθεί έγγραφα.</Typography> : data.documents.map(d => <Paper key={d.id} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontWeight: 700 }}>{d.fileName}</Typography><Typography variant="caption" color="text.secondary">{fmtDate(d.createdAt)} · {d.mimeType}</Typography></Box><Button size="small" startIcon={<DownloadIcon />} onClick={() => download(d.id, d.fileName)}>Λήψη</Button></Stack></Paper>)}</CardContent></Card>}

    {tab === "green-cards" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Πράσινες κάρτες</Typography>{data.greenCards.length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί πράσινες κάρτες.</Typography> : data.greenCards.map(g => <Paper key={g.id} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Stack direction="row" justifyContent="space-between"><Box><Typography sx={{ fontWeight: 700 }}>{g.cardNumber} · {g.policyNumber}</Typography><Typography variant="body2">Όχημα: {g.vehicleRegistrationPlate} {g.vehicleMakeModel ? `· ${g.vehicleMakeModel}` : ""}</Typography><Typography variant="body2" color="text.secondary">Ισχύς: {fmtDate(g.validFrom)} — {fmtDate(g.validTo)} · Χώρες: {g.territories || "—"}</Typography></Box><Chip size="small" label={g.status} color="success" /></Stack></Paper>)}</CardContent></Card>}

    {tab === "requests" && <Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 800 }}>Αιτήματα εξυπηρέτησης</Typography><Button variant="contained" startIcon={<SendIcon />} onClick={() => setRequestOpen(true)}>Νέο αίτημα</Button></Stack>{data.requests.length === 0 ? <Typography color="text.secondary">Δεν έχουν υποβληθεί αιτήματα.</Typography> : data.requests.map(r => <Paper key={r.id} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Stack direction="row" justifyContent="space-between"><Box><Typography sx={{ fontWeight: 700 }}>{r.requestNumber} · {r.subject}</Typography><Typography variant="body2" color="text.secondary">{requestTypes[r.type] ?? r.type} · {fmtDate(r.createdAt)}</Typography></Box><Chip size="small" label={requestStatuses[r.status] ?? r.status} /></Stack></Paper>)}</CardContent></Card>}

    {tab === "claims" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Ζημιές</Typography>{data.claims.length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί ζημιές.</Typography> : data.claims.map(c => <Paper key={c.id} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{c.claimNumber} · {c.policyNumber}</Typography><Typography variant="body2">Ημερομηνία συμβάντος: {fmtDate(c.incidentDate)} · Κατάσταση: {c.status}</Typography><Typography variant="body2" color="text.secondary">{c.description || "Χωρίς περιγραφή"}</Typography></Paper>)}</CardContent></Card>}

    {tab === "notifications" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Ειδοποιήσεις</Typography>{data.notifications.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν ειδοποιήσεις.</Typography> : data.notifications.map(n => <Paper key={n.id} variant="outlined" sx={{ p: 1.2, mb: 1, bgcolor: n.isRead ? "transparent" : "#eef6ff" }}><Typography sx={{ fontWeight: 700 }}>{n.title}</Typography><Typography variant="body2">{n.body}</Typography><Typography variant="caption" color="text.secondary">{fmtDate(n.createdAt)}</Typography></Paper>)}</CardContent></Card>}

    {tab === "consents" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Συγκαταθέσεις και προτιμήσεις επικοινωνίας</Typography>{data.consents.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες συγκαταθέσεις.</Typography> : data.consents.map((c, i) => <Paper key={c.id ?? i} variant="outlined" sx={{ p: 1.2, mb: 1 }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 700 }}>{c.type ?? c.consentType ?? "Συγκατάθεση"}</Typography><Chip size="small" label={c.status ?? (c.granted ? "Ενεργή" : "Ανενεργή")} color={c.status === "Revoked" || c.granted === false ? "default" : "success"} /></Stack><Typography variant="caption" color="text.secondary">{fmtDate(c.grantedAt ?? c.createdAt)}</Typography></Paper>)}</CardContent></Card>}

    {tab === "profile" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Το προφίλ μου</Typography><Grid container spacing={1}>{[["Ονοματεπώνυμο", displayCustomer(data.customer)], ["Email", data.customer.email], ["Τηλέφωνο", data.customer.phone], ["Κινητό", data.customer.mobilePhone], ["Διεύθυνση", `${data.customer.address ?? ""}, ${data.customer.city ?? ""} ${data.customer.postalCode ?? ""}`], ["Επάγγελμα", data.customer.occupation], ["Ημερομηνία γέννησης", fmtDate(data.customer.birthDate)]].map(([l, v]) => <Grid item xs={12} sm={6} key={l}><Paper variant="outlined" sx={{ p: 1 }}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography>{v || "—"}</Typography></Paper></Grid>)}</Grid></CardContent></Card>}

    <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Νέο αίτημα προς το γραφείο</DialogTitle><CardContent><Stack spacing={1.5}><TextField select label="Τύπος" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(requestTypes).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField><TextField label="Θέμα" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required /><TextField select label="Σχετικό συμβόλαιο (προαιρετικό)" value={form.relatedPolicyId} onChange={e => setForm({ ...form, relatedPolicyId: e.target.value })}><MenuItem value="">Κανένα</MenuItem>{data.policies.map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber}</MenuItem>)}</TextField><TextField label="Περιγραφή" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline minRows={4} required /></Stack></CardContent><Divider /><Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}><Button color="error" onClick={() => setRequestOpen(false)}>Ακύρωση</Button><Button variant="contained" onClick={() => createRequest.mutate()} disabled={createRequest.isPending || !form.subject || !form.description} startIcon={<SendIcon />}>Υποβολή</Button></Box></Dialog>
  </Box>;
}

export default CustomerPortalPage;
