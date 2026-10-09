import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Grid,
  IconButton, MenuItem, Paper, Select, Stack, Switch, TextField, Typography
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { api, extractErrorMessage } from "../api/client";

type AnyRecord = Record<string, any>;
type PortalData = {
  tenant?: AnyRecord;
  office?: AnyRecord;
  customer: AnyRecord;
  policies: AnyRecord[];
  documents: AnyRecord[];
  greenCards: AnyRecord[];
  consents: AnyRecord[];
  claims: AnyRecord[];
  requests: AnyRecord[];
  notifications: AnyRecord[];
  summary: { totalPolicies: number; activePolicies: number; documents: number; openClaims: number; pendingRequests: number };
};

const policyLabels: Record<string, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπό"
};
const statusLabels: Record<string, string> = {
  Active: "Ενεργό", Draft: "Πρόχειρο", Expired: "Έληξε", Cancelled: "Ακυρωμένο",
  Renewed: "Ανανεωμένο", PendingRenewal: "Σε ανανέωση", Undelivered: "Δεν παραδόθηκε",
  AwaitingIssue: "Αναμονή έκδοσης", Prospect: "Υποψήφιο"
};
const requestTypes: Record<string, string> = {
  NewPolicy: "Νέο συμβόλαιο", AccidentReport: "Δήλωση ζημιάς", DocumentRequest: "Αίτημα εγγράφου",
  PolicyChange: "Αλλαγή συμβολαίου", GeneralQuestion: "Γενική ερώτηση"
};
const requestStatuses: Record<string, string> = {
  Submitted: "Υποβλήθηκε", InReview: "Σε εξέταση", AwaitingCustomerInfo: "Αναμονή στοιχείων",
  Resolved: "Ολοκληρώθηκε", Closed: "Κλειστό", Rejected: "Απορρίφθηκε"
};
const consentLabels: Record<string, string> = {
  EmailMarketing: "Ενημερωτικά email και προσφορές",
  SmsMarketing: "Ενημερωτικά SMS και προσφορές",
  ViberMarketing: "Ενημερώσεις Viber",
  PhoneMarketing: "Τηλεφωνική επικοινωνία για προσφορές",
  DataSharingPartners: "Κοινοποίηση σε συνεργάτες του γραφείου"
};
const consentTypes = Object.keys(consentLabels);

const fmtDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(new Date(value)) : "—";
const fmtDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const fmtMoney = (value?: number | null, currency = "EUR") => value == null
  ? "—" : new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(value);
const displayCustomer = (customer: AnyRecord) => customer.type === "Company"
  ? customer.companyName || "Εταιρικός πελάτης"
  : `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Πελάτης";
const policyLabel = (policy: AnyRecord) => policyLabels[policy.policyType] ?? policy.policyType ?? "Συμβόλαιο";

function EmptyState({ children }: { children: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>{children}</Paper>;
}

function Field({ label, value, color }: { label: string; value?: ReactNode; color?: string }) {
  return <Paper variant="outlined" sx={{ p: 1.15, minHeight: 62, bgcolor: color ?? "#f8fafc", borderColor: "#dbe4ee" }}>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: .25 }}>{label}</Typography>
    <Typography sx={{ fontWeight: 650, wordBreak: "break-word" }}>{value || "—"}</Typography>
  </Paper>;
}

function PortalDialog({ open, onClose, title, children, maxWidth = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: "sm" | "md" | "lg" }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} scroll="paper">
    <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, borderBottom: "1px solid #e2e8f0" }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
      <IconButton aria-label="Κλείσιμο" onClick={onClose}><CloseIcon /></IconButton>
    </DialogTitle>
    {children}
  </Dialog>;
}

function PolicyDetails({ policy, documents, onPreview, onDownload }: { policy: AnyRecord; documents: AnyRecord[]; onPreview: (doc: AnyRecord) => void; onDownload: (doc: AnyRecord) => void }) {
  const covers = Array.isArray(policy.covers) ? policy.covers : [];
  const objects = Array.isArray(policy.objects) ? policy.objects : [];
  const relatedDocs = documents.filter(d => d.policyId === policy.id);
  return <DialogContent dividers>
    <Grid container spacing={1.25}>
      <Grid item xs={12} sm={6}><Field label="Αριθμός συμβολαίου" value={policy.policyNumber} color="#eef6ff" /></Grid>
      <Grid item xs={12} sm={6}><Field label="Κλάδος" value={policyLabel(policy)} color="#eef6ff" /></Grid>
      <Grid item xs={12} sm={6}><Field label="Ασφαλιστική εταιρεία" value={policy.insuranceCompany} /></Grid>
      <Grid item xs={12} sm={6}><Field label="Κατάσταση" value={<Chip size="small" color={policy.status === "Active" ? "success" : "default"} label={statusLabels[policy.status] ?? policy.status} />} /></Grid>
      <Grid item xs={12} sm={6}><Field label="Έναρξη" value={fmtDate(policy.startDate)} /></Grid>
      <Grid item xs={12} sm={6}><Field label="Λήξη" value={fmtDate(policy.endDate)} /></Grid>
      <Grid item xs={12} sm={4}><Field label="Ασφάλιστρο" value={fmtMoney(policy.premium, policy.currency)} color="#f0fbf4" /></Grid>
      <Grid item xs={12} sm={4}><Field label="Καθαρό ασφάλιστρο" value={fmtMoney(policy.netPremium, policy.currency)} color="#f0fbf4" /></Grid>
      <Grid item xs={12} sm={4}><Field label="Παράδοση" value={fmtDate(policy.deliveredAt ?? policy.handoverDate)} color="#f0fbf4" /></Grid>
      <Grid item xs={12}><Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 800 }}>Καλύψεις</Typography><Divider sx={{ mb: 1 }} />
        {covers.length === 0 ? <Typography color="text.secondary">Δεν έχουν καταχωρηθεί αναλυτικές καλύψεις.</Typography> : <Stack spacing={.7}>{covers.map((cover: AnyRecord, index: number) => <Paper key={`${cover.coverCode ?? cover.coverName}-${index}`} variant="outlined" sx={{ p: 1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 700 }}>{cover.coverName || cover.coverCode || "Κάλυψη"}</Typography>{cover.coverageAmount != null && <Typography variant="caption" color="text.secondary">Κεφάλαιο: {fmtMoney(cover.coverageAmount, policy.currency)}</Typography>}</Box><Typography sx={{ fontWeight: 700 }}>{fmtMoney(cover.grossPremium ?? cover.netPremium, policy.currency)}</Typography></Stack></Paper>)}</Stack>}
      </Grid>
      <Grid item xs={12}><Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 800 }}>Όχημα / ασφαλιζόμενο αντικείμενο</Typography><Divider sx={{ mb: 1 }} />
        {objects.length === 0 && !policy.vehicleRegistrationPlate ? <Typography color="text.secondary">Δεν έχει συνδεθεί όχημα ή άλλο αντικείμενο.</Typography> : <Stack spacing={.7}>{objects.map((object: AnyRecord, index: number) => <Field key={object.id ?? index} label={object.objectKind || "Αντικείμενο"} value={[object.identifier, object.description, object.characteristic].filter(Boolean).join(" · ")} />)}{policy.vehicleRegistrationPlate && <Field label="Αριθμός κυκλοφορίας" value={policy.vehicleRegistrationPlate} />}</Stack>}
      </Grid>
      <Grid item xs={12}><Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 800 }}>Έγγραφα συμβολαίου</Typography><Divider sx={{ mb: 1 }} />
        {relatedDocs.length === 0 ? <Typography color="text.secondary">Δεν υπάρχει συνημμένο έγγραφο από το γραφείο.</Typography> : <Stack spacing={.6}>{relatedDocs.map(doc => <Stack key={doc.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: .8, border: "1px solid #e2e8f0", borderRadius: 1 }}><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 650 }}>{doc.fileName}</Typography><Typography variant="caption" color="text.secondary">{doc.documentType || "Έγγραφο"} · {fmtDate(doc.createdAt)}</Typography></Box><Stack direction="row" spacing={.5}><Button size="small" startIcon={<VisibilityIcon />} onClick={() => onPreview(doc)}>Προεπισκόπηση</Button><Button size="small" startIcon={<DownloadIcon />} onClick={() => onDownload(doc)}>Λήψη</Button></Stack></Stack>)}</Stack>}
      </Grid>
    </Grid>
  </DialogContent>;
}

function DocumentPreview({ doc, open, onClose }: { doc: AnyRecord | null; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    setUrl(null); setError(null);
    if (!open || !doc) return undefined;
    setLoading(true);
    api.get<Blob>(`/documents/${doc.id}/preview`, { responseType: "blob" }).then(response => {
      current = URL.createObjectURL(new Blob([response.data], { type: doc.mimeType || "application/pdf" }));
      setUrl(current);
    }).catch(e => setError(extractErrorMessage(e))).finally(() => setLoading(false));
    return () => { if (current) URL.revokeObjectURL(current); };
  }, [doc, open]);
  return <PortalDialog open={open} onClose={onClose} title={doc?.fileName ?? "Προεπισκόπηση εγγράφου"} maxWidth="lg">
    <DialogContent dividers sx={{ p: 0, minHeight: 560, bgcolor: "#f1f5f9" }}>
      {loading && <Box sx={{ display: "grid", placeItems: "center", minHeight: 520 }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
      {!loading && !error && url && <Box component="iframe" title="Προεπισκόπηση εγγράφου" src={url} sx={{ width: "100%", height: 650, border: 0, display: "block", bgcolor: "white" }} />}
      {!loading && !error && !url && <EmptyState>Η προεπισκόπηση δεν είναι διαθέσιμη για αυτό το αρχείο.</EmptyState>}
    </DialogContent>
    <DialogActions><Button onClick={() => window.print()} startIcon={<PrintIcon />}>Εκτύπωση</Button><Button color="error" onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </PortalDialog>;
}

function RequestDetails({ request, open, onClose }: { request: AnyRecord | null; open: boolean; onClose: () => void }) {
  if (!request) return null;
  const messages = Array.isArray(request.messages) ? request.messages : [];
  return <PortalDialog open={open} onClose={onClose} title={`${request.requestNumber ?? "Αίτημα"} · ${request.subject}`}>
    <DialogContent dividers><Stack spacing={1.2}><Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={requestTypes[request.type] ?? request.type} /><Chip color="info" label={requestStatuses[request.status] ?? request.status} /><Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>{fmtDateTime(request.createdAt)}</Typography></Stack><Field label="Περιγραφή" value={request.description} /><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Ιστορικό επικοινωνίας</Typography>{messages.length === 0 ? <Typography color="text.secondary">Δεν έχουν σταλεί απαντήσεις ακόμη.</Typography> : <Stack spacing={.8}>{messages.map((message: AnyRecord) => <Paper key={message.id} sx={{ p: 1.1, bgcolor: message.authorRole === "Customer" ? "#eef6ff" : "#f0fbf4" }}><Stack direction="row" justifyContent="space-between"><Typography variant="caption" sx={{ fontWeight: 800 }}>{message.authorRole === "Customer" ? "Εσείς" : "Το γραφείο"}</Typography><Typography variant="caption" color="text.secondary">{fmtDateTime(message.createdAt)}</Typography></Stack><Typography sx={{ whiteSpace: "pre-wrap" }}>{message.body}</Typography></Paper>)}</Stack>}</Stack></DialogContent><DialogActions><Button color="error" onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </PortalDialog>;
}

function ProfileSection({ customer, onSaved }: { customer: AnyRecord; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<AnyRecord>({});
  useEffect(() => setForm({ firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", companyName: customer.companyName ?? "", email: customer.email ?? "", phone: customer.phone ?? "", mobilePhone: customer.mobilePhone ?? "", altPhone: customer.altPhone ?? "", address: customer.address ?? "", city: customer.city ?? "", postalCode: customer.postalCode ?? "", region: customer.region ?? "", occupation: customer.occupation ?? "", birthDate: customer.birthDate ? String(customer.birthDate).slice(0, 10) : "", notes: customer.notes ?? "" }), [customer]);
  const save = useMutation({ mutationFn: async () => api.put("/me/portal/profile", { ...form, birthDate: form.birthDate || null }), onSuccess: () => { setEditing(false); setSuccess("Τα στοιχεία σας αποθηκεύτηκαν."); onSaved(); }, onError: e => setError(extractErrorMessage(e)) });
  const set = (key: string) => (event: ChangeEvent<HTMLInputElement>) => setForm((old: AnyRecord) => ({ ...old, [key]: event.target.value }));
  const input = (key: string, label: string, props: AnyRecord = {}) => <TextField fullWidth size="small" label={label} value={form[key] ?? ""} onChange={set(key)} {...props} />;
  return <Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Τα στοιχεία μου</Typography><Typography variant="body2" color="text.secondary">Ενημερώστε τα στοιχεία επικοινωνίας σας και κρατήστε το γραφείο ενήμερο.</Typography></Box><Stack direction="row" spacing={1}>{editing && <Button color="error" onClick={() => setEditing(false)}>Ακύρωση</Button>}<Button variant="contained" color={editing ? "success" : "primary"} startIcon={editing ? undefined : <EditIcon />} onClick={() => setEditing(v => !v)}>{editing ? "Αποθήκευση" : "Επεξεργασία"}</Button></Stack></Stack>{success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 1 }}>{success}</Alert>}{error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}{editing ? <Grid container spacing={1.2}><Grid item xs={12} sm={6}>{input("firstName", "Όνομα")}</Grid><Grid item xs={12} sm={6}>{input("lastName", "Επώνυμο")}</Grid><Grid item xs={12} sm={6}>{input("companyName", "Επωνυμία")}</Grid><Grid item xs={12} sm={6}>{input("occupation", "Επάγγελμα")}</Grid><Grid item xs={12} sm={6}>{input("email", "Email", { type: "email" })}</Grid><Grid item xs={12} sm={6}>{input("phone", "Τηλέφωνο")}</Grid><Grid item xs={12} sm={6}>{input("mobilePhone", "Κινητό")}</Grid><Grid item xs={12} sm={6}>{input("altPhone", "Εναλλακτικό τηλέφωνο")}</Grid><Grid item xs={12} sm={8}>{input("address", "Διεύθυνση")}</Grid><Grid item xs={12} sm={4}>{input("postalCode", "Τ.Κ.")}</Grid><Grid item xs={12} sm={6}>{input("city", "Πόλη")}</Grid><Grid item xs={12} sm={6}>{input("region", "Περιφέρεια")}</Grid><Grid item xs={12} sm={6}>{input("birthDate", "Ημερομηνία γέννησης", { type: "date", InputLabelProps: { shrink: true } })}</Grid><Grid item xs={12}>{input("notes", "Σημειώσεις", { multiline: true, minRows: 3 })}</Grid><Grid item xs={12}><Button variant="contained" color="success" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Αποθήκευση…" : "Αποθήκευση στοιχείων"}</Button></Grid></Grid> : <Grid container spacing={1.2}><Grid item xs={12} sm={6}><Field label="Ονοματεπώνυμο" value={displayCustomer(customer)} /></Grid><Grid item xs={12} sm={6}><Field label="Επωνυμία" value={customer.companyName} /></Grid><Grid item xs={12} sm={6}><Field label="Email" value={customer.email} /></Grid><Grid item xs={12} sm={6}><Field label="Τηλέφωνα" value={[customer.phone, customer.mobilePhone, customer.altPhone].filter(Boolean).join(" · ")} /></Grid><Grid item xs={12} sm={8}><Field label="Διεύθυνση" value={[customer.address, customer.city, customer.postalCode, customer.region].filter(Boolean).join(", ")} /></Grid><Grid item xs={12} sm={4}><Field label="Ημερομηνία γέννησης" value={fmtDate(customer.birthDate)} /></Grid><Grid item xs={12} sm={6}><Field label="Επάγγελμα" value={customer.occupation} /></Grid><Grid item xs={12}><Field label="Σημειώσεις" value={customer.notes} /></Grid></Grid>}</CardContent></Card>;
}

export function CustomerPortalPage() {
  const [params, setParams] = useSearchParams();
  const section = params.get("tab") ?? "overview";
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [policy, setPolicy] = useState<AnyRecord | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AnyRecord | null>(null);
  const [request, setRequest] = useState<AnyRecord | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ type: "NewPolicy", subject: "", description: "", relatedPolicyId: "" });
  const [policySearch, setPolicySearch] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const q = useQuery({ queryKey: ["customer-portal"], queryFn: async () => (await api.get<PortalData>("/me/portal")).data, staleTime: 20_000 });
  const data = q.data;
  const createRequest = useMutation({ mutationFn: async () => api.post("/me/portal/requests", { ...requestForm, relatedPolicyId: requestForm.relatedPolicyId || null, incidentDate: null, incidentLocation: null, otherPartyInfo: null }), onSuccess: async () => { setRequestOpen(false); setRequestForm({ type: "NewPolicy", subject: "", description: "", relatedPolicyId: "" }); setAlert({ severity: "success", text: "Το αίτημά σας στάλθηκε στο γραφείο." }); await queryClient.invalidateQueries({ queryKey: ["customer-portal"] }); }, onError: e => setAlert({ severity: "error", text: extractErrorMessage(e) }) });
  const markRead = useMutation({ mutationFn: async (id: string) => api.post(`/me/portal/notifications/${id}/read`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-portal"] }) });
  const download = async (doc: AnyRecord) => { try { const response = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" }); const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = doc.fileName || "έγγραφο"; anchor.click(); URL.revokeObjectURL(url); } catch (e) { setAlert({ severity: "error", text: extractErrorMessage(e) }); } };
  const setSection = (value: string) => setParams(value === "overview" ? {} : { tab: value });
  const policies = useMemo(() => (data?.policies ?? []).filter(p => (!policyStatus || p.status === policyStatus) && (!policySearch || [p.policyNumber, p.insuranceCompany, p.vehicleRegistrationPlate, policyLabel(p)].some(v => String(v ?? "").toLowerCase().includes(policySearch.toLowerCase())))), [data, policySearch, policyStatus]);
  const documents = useMemo(() => (data?.documents ?? []).filter(d => !documentSearch || [d.fileName, d.documentType, d.mimeType].some(v => String(v ?? "").toLowerCase().includes(documentSearch.toLowerCase()))), [data, documentSearch]);
  const requests = useMemo(() => (data?.requests ?? []).filter(r => (!requestStatus || r.status === requestStatus) && (!requestSearch || [r.requestNumber, r.subject, requestTypes[r.type]].some(v => String(v ?? "").toLowerCase().includes(requestSearch.toLowerCase())))), [data, requestSearch, requestStatus]);

  if (q.isLoading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 360 }}><CircularProgress /></Box>;
  if (q.isError || !data) return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση της πύλης πελάτη. {q.error ? extractErrorMessage(q.error) : ""}</Alert>;
  const brand = data.tenant?.brandColorHex || "#123c69";
  const activePolicies = data.policies.filter(p => p.status === "Active");
  const stat = (icon: ReactNode, label: string, value: number, color: string) => <Card sx={{ height: "100%", minWidth: 0, borderTop: `4px solid ${color}` }}><CardContent sx={{ py: { xs: 1.1, sm: 1.5 }, px: { xs: 1.2, sm: 2 }, "&:last-child": { pb: { xs: 1.1, sm: 1.5 } } }}><Stack direction="row" spacing={.7} alignItems="center"><Box sx={{ color, display: "flex" }}>{icon}</Box><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{label}</Typography></Stack><Typography variant="h5" sx={{ fontWeight: 800, mt: .25 }}>{value}</Typography></CardContent></Card>;

  return <Box sx={{ maxWidth: 1280, mx: "auto", p: { xs: .75, sm: 1, md: 2 } }}>
    <Card sx={{ mb: 2, overflow: "hidden", background: `linear-gradient(110deg, ${brand}, #1d6b8f)`, color: "white" }}><CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>{data.tenant?.logoUrl ? <Box component="img" src={data.tenant.logoUrl} alt="Λογότυπο γραφείου" sx={{ width: 56, height: 56, objectFit: "contain", bgcolor: "white", borderRadius: 1, p: .5 }} /> : <DescriptionIcon sx={{ fontSize: 48 }} />}<Box><Typography variant="overline" sx={{ opacity: .85 }}>Πύλη πελάτη</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>Καλώς ήρθατε, {displayCustomer(data.customer)}</Typography><Typography variant="body2" sx={{ opacity: .9 }}>{data.office?.name ?? data.tenant?.name} · Τα συμβόλαια, τα έγγραφα και τα αιτήματά σας σε ένα ασφαλές σημείο.</Typography></Box></CardContent></Card>
    {alert && <Alert severity={alert.severity} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.text}</Alert>}

    {section === "overview" && <><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>{stat(<DescriptionIcon />, "Συμβόλαια", data.summary.totalPolicies, "#1976d2")}{stat(<DescriptionIcon />, "Ενεργά", data.summary.activePolicies, "#2e7d32")}{stat(<FolderIcon />, "Έγγραφα", data.summary.documents, "#7b1fa2")}{stat(<ReportProblemIcon />, "Ανοιχτές ζημιές", data.summary.openClaims, "#c62828")}{stat(<AssignmentIcon />, "Εκκρεμή αιτήματα", data.summary.pendingRequests, "#ed6c02")}</Stack><Grid container spacing={2}><Grid item xs={12} md={7}><Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 800 }}>Τα ενεργά συμβόλαιά σας</Typography><Button size="small" onClick={() => setSection("policies")}>Όλα τα συμβόλαια</Button></Stack>{activePolicies.length === 0 ? <EmptyState>Δεν υπάρχουν ενεργά συμβόλαια.</EmptyState> : <Stack spacing={.8}>{activePolicies.slice(0, 5).map(p => <Paper key={p.id} variant="outlined" sx={{ p: 1.2, cursor: "pointer", "&:hover": { bgcolor: "#f1f7fc" } }} onClick={() => setPolicy(p)}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography sx={{ fontWeight: 800 }}>{p.policyNumber} · {policyLabel(p)}</Typography><Typography variant="body2" color="text.secondary">{p.insuranceCompany} · {fmtDate(p.startDate)} — {fmtDate(p.endDate)}</Typography></Box><Chip size="small" color="success" label={statusLabels[p.status] ?? p.status} /></Stack></Paper>)}</Stack>}</CardContent></Card></Grid><Grid item xs={12} md={5}><Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Στοιχεία γραφείου</Typography><Typography sx={{ fontWeight: 700 }}>{data.office?.name ?? data.tenant?.name}</Typography><Typography variant="body2">{data.office?.address ?? data.tenant?.addressLine ?? ""} {data.office?.city ?? ""}</Typography><Typography variant="body2">{data.office?.phone ?? data.tenant?.contactPhone ?? ""}</Typography><Typography variant="body2">{data.office?.email ?? data.tenant?.contactEmail ?? ""}</Typography><Divider sx={{ my: 1.5 }} /><Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => setRequestOpen(true)}>Νέο αίτημα / νέο συμβόλαιο</Button></CardContent></Card></Grid></Grid></>}

    {section === "policies" && <Card><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Τα συμβόλαιά μου</Typography><Typography variant="body2" color="text.secondary">Πατήστε σε ένα συμβόλαιο για αναλυτική καρτέλα, καλύψεις και έγγραφα.</Typography></Box><Button variant="contained" startIcon={<AddIcon />} onClick={() => setRequestOpen(true)}>Νέο συμβόλαιο</Button></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}><TextField size="small" fullWidth placeholder="Αναζήτηση αριθμού, εταιρείας ή πινακίδας" value={policySearch} onChange={e => setPolicySearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .7, color: "text.secondary" }} /> }} /><Select size="small" value={policyStatus} displayEmpty onChange={e => setPolicyStatus(e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Όλες οι καταστάσεις</MenuItem>{Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></Stack>{policies.length === 0 ? <EmptyState>Δεν βρέθηκαν συμβόλαια με αυτά τα φίλτρα.</EmptyState> : <Stack spacing={.8}>{policies.map(p => <Paper key={p.id} variant="outlined" sx={{ p: 1.25, cursor: "pointer", "&:hover": { bgcolor: "#f1f7fc", borderColor: brand } }} onClick={() => setPolicy(p)}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 800 }}>{p.policyNumber} · {policyLabel(p)}</Typography><Typography variant="body2">{p.insuranceCompany} {p.producer ? `· ${p.producer}` : ""}</Typography><Typography variant="body2" color="text.secondary">{fmtDate(p.startDate)} — {fmtDate(p.endDate)} · Ασφάλιστρο: {fmtMoney(p.premium, p.currency)}{p.vehicleRegistrationPlate ? ` · ${p.vehicleRegistrationPlate}` : ""}</Typography></Box><Chip size="small" color={p.status === "Active" ? "success" : "default"} label={statusLabels[p.status] ?? p.status} /></Stack></Paper>)}</Stack>}</CardContent></Card>}

    {section === "documents" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Έγγραφα και PDF</Typography><TextField size="small" fullWidth sx={{ mb: 1.5 }} placeholder="Αναζήτηση εγγράφου" value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .7, color: "text.secondary" }} /> }} />{documents.length === 0 ? <EmptyState>Δεν έχουν αναρτηθεί έγγραφα από το γραφείο.</EmptyState> : <Stack spacing={.8}>{documents.map(d => <Paper key={d.id} variant="outlined" sx={{ p: 1.1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 750 }}>{d.fileName}</Typography><Typography variant="caption" color="text.secondary">{d.documentType || "Έγγραφο"} · {fmtDate(d.createdAt)} · {d.mimeType || ""}</Typography></Box><Stack direction="row" spacing={.5}><Button size="small" startIcon={<VisibilityIcon />} onClick={() => setPreviewDoc(d)}>Προεπισκόπηση</Button><Button size="small" startIcon={<DownloadIcon />} onClick={() => download(d)}>Λήψη</Button></Stack></Stack></Paper>)}</Stack>}</CardContent></Card>}
    {section === "documents" && <GreenCardsCard cards={data.greenCards} />}

    {section === "green-cards" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Πράσινες κάρτες</Typography>{data.greenCards.length === 0 ? <EmptyState>Δεν έχουν καταχωρηθεί πράσινες κάρτες.</EmptyState> : <Stack spacing={.8}>{data.greenCards.map(g => <Paper key={g.id} variant="outlined" sx={{ p: 1.1 }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 750 }}>{g.cardNumber} · {g.policyNumber}</Typography><Typography variant="body2">Όχημα: {g.vehicleRegistrationPlate} {g.vehicleMakeModel ? `· ${g.vehicleMakeModel}` : ""}</Typography><Typography variant="body2" color="text.secondary">Ισχύς: {fmtDate(g.validFrom)} — {fmtDate(g.validTo)} · Χώρες: {g.territories || "—"}</Typography></Box><Chip size="small" color="success" label={statusLabels[g.status] ?? g.status ?? "Ενεργή"} /></Stack></Paper>)}</Stack>}</CardContent></Card>}

    {section === "requests" && <Card><CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>Αιτήματα προς το γραφείο</Typography><Typography variant="body2" color="text.secondary">Νέο συμβόλαιο, αλλαγές, έγγραφα και απαντήσεις σε ένα ιστορικό.</Typography></Box><Button variant="contained" startIcon={<SendIcon />} onClick={() => setRequestOpen(true)}>Νέο αίτημα</Button></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}><TextField size="small" fullWidth placeholder="Αναζήτηση αιτήματος" value={requestSearch} onChange={e => setRequestSearch(e.target.value)} /><Select size="small" value={requestStatus} displayEmpty onChange={e => setRequestStatus(e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Όλες οι καταστάσεις</MenuItem>{Object.entries(requestStatuses).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></Stack>{requests.length === 0 ? <EmptyState>Δεν υπάρχουν αιτήματα.</EmptyState> : <Stack spacing={.8}>{requests.map(r => <Paper key={r.id} variant="outlined" sx={{ p: 1.15, cursor: "pointer", "&:hover": { bgcolor: "#f1f7fc" } }} onClick={() => setRequest(r)}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography sx={{ fontWeight: 800 }}>{r.requestNumber} · {r.subject}</Typography><Typography variant="body2" color="text.secondary">{requestTypes[r.type] ?? r.type} · {fmtDateTime(r.createdAt)}</Typography></Box><Chip size="small" color={r.status === "Resolved" ? "success" : "default"} label={requestStatuses[r.status] ?? r.status} /></Stack></Paper>)}</Stack>}</CardContent></Card>}
    {section === "requests" && <ClaimsCard claims={data.claims} />}

    {section === "claims" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Ζημιές</Typography>{data.claims.length === 0 ? <EmptyState>Δεν έχουν καταχωρηθεί ζημιές.</EmptyState> : <Stack spacing={.8}>{data.claims.map(c => <Paper key={c.id} variant="outlined" sx={{ p: 1.1 }}><Typography sx={{ fontWeight: 750 }}>{c.claimNumber} · {c.policyNumber}</Typography><Typography variant="body2">Ημερομηνία συμβάντος: {fmtDate(c.incidentDate)} · Κατάσταση: {c.status}</Typography><Typography variant="body2" color="text.secondary">{c.description || "Χωρίς περιγραφή"}</Typography></Paper>)}</Stack>}</CardContent></Card>}

    {section === "notifications" && <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Ειδοποιήσεις</Typography>{data.notifications.length === 0 ? <EmptyState>Δεν υπάρχουν ειδοποιήσεις.</EmptyState> : <Stack spacing={.8}>{data.notifications.map(n => <Paper key={n.id} variant="outlined" sx={{ p: 1.1, bgcolor: n.isRead ? "transparent" : "#eef6ff" }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 750 }}>{n.title}</Typography><Typography variant="body2">{n.body}</Typography><Typography variant="caption" color="text.secondary">{fmtDateTime(n.createdAt)}</Typography></Box>{!n.isRead && <Button size="small" onClick={() => markRead.mutate(n.id)}>Σήμανση ως αναγνωσμένη</Button>}</Stack></Paper>)}</Stack>}</CardContent></Card>}

    {section === "consents" && <ConsentSection consents={data.consents} onChanged={() => queryClient.invalidateQueries({ queryKey: ["customer-portal"] })} onError={text => setAlert({ severity: "error", text })} />}
    {section === "profile" && <ProfileSection customer={data.customer} onSaved={() => queryClient.invalidateQueries({ queryKey: ["customer-portal"] })} />}
    {section === "profile" && <ConsentSection consents={data.consents} onChanged={() => queryClient.invalidateQueries({ queryKey: ["customer-portal"] })} onError={text => setAlert({ severity: "error", text })} />}

    <PortalDialog open={Boolean(policy)} onClose={() => setPolicy(null)} title={policy ? `${policyLabel(policy)} · ${policy.policyNumber}` : "Συμβόλαιο"} maxWidth="lg">{policy && <PolicyDetails policy={policy} documents={data.documents} onPreview={setPreviewDoc} onDownload={download} />}</PortalDialog>
    <DocumentPreview doc={previewDoc} open={Boolean(previewDoc)} onClose={() => setPreviewDoc(null)} />
    <RequestDetails request={request} open={Boolean(request)} onClose={() => setRequest(null)} />
    <PortalDialog open={requestOpen} onClose={() => setRequestOpen(false)} title="Νέο αίτημα προς το γραφείο"><DialogContent dividers><Stack spacing={1.4}><TextField select label="Τύπος αιτήματος" value={requestForm.type} onChange={e => setRequestForm({ ...requestForm, type: e.target.value })}>{Object.entries(requestTypes).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><TextField required label="Θέμα" value={requestForm.subject} onChange={e => setRequestForm({ ...requestForm, subject: e.target.value })} /><TextField select label="Σχετικό συμβόλαιο (προαιρετικό)" value={requestForm.relatedPolicyId} onChange={e => setRequestForm({ ...requestForm, relatedPolicyId: e.target.value })}><MenuItem value="">Κανένα</MenuItem>{data.policies.map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber} · {policyLabel(p)}</MenuItem>)}</TextField><TextField required multiline minRows={5} label="Περιγράψτε το αίτημά σας" value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} /></Stack></DialogContent><DialogActions><Button color="error" onClick={() => setRequestOpen(false)}>Ακύρωση</Button><Button variant="contained" startIcon={<SendIcon />} disabled={createRequest.isPending || !requestForm.subject.trim() || !requestForm.description.trim()} onClick={() => createRequest.mutate()}>{createRequest.isPending ? "Αποστολή…" : "Αποστολή αιτήματος"}</Button></DialogActions></PortalDialog>
  </Box>;
}

function GreenCardsCard({ cards }: { cards: AnyRecord[] }) {
  return <Card sx={{ mt: 1.25 }}><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Πράσινες κάρτες</Typography>{cards.length === 0 ? <EmptyState>Δεν έχουν καταχωρηθεί πράσινες κάρτες.</EmptyState> : <Stack spacing={.8}>{cards.map(card => <Paper key={card.id} variant="outlined" sx={{ p: 1.1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 750 }}>{card.cardNumber} · {card.policyNumber}</Typography><Typography variant="body2">Όχημα: {card.vehicleRegistrationPlate} {card.vehicleMakeModel ? `· ${card.vehicleMakeModel}` : ""}</Typography><Typography variant="body2" color="text.secondary">Ισχύς: {fmtDate(card.validFrom)} — {fmtDate(card.validTo)} · Χώρες: {card.territories || "—"}</Typography></Box><Chip size="small" color="success" label={statusLabels[card.status] ?? card.status ?? "Ενεργή"} /></Stack></Paper>)}</Stack>}</CardContent></Card>;
}

function ClaimsCard({ claims }: { claims: AnyRecord[] }) {
  return <Card sx={{ mt: 1.25 }}><CardContent><Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Ζημιές</Typography>{claims.length === 0 ? <EmptyState>Δεν έχουν καταχωρηθεί ζημιές.</EmptyState> : <Stack spacing={.8}>{claims.map(claim => <Paper key={claim.id} variant="outlined" sx={{ p: 1.1 }}><Typography sx={{ fontWeight: 750 }}>{claim.claimNumber} · {claim.policyNumber}</Typography><Typography variant="body2">Ημερομηνία συμβάντος: {fmtDate(claim.incidentDate)} · Κατάσταση: {claim.status}</Typography><Typography variant="body2" color="text.secondary">{claim.description || "Χωρίς περιγραφή"}</Typography></Paper>)}</Stack>}</CardContent></Card>;
}

function ConsentSection({ consents, onChanged, onError }: { consents: AnyRecord[]; onChanged: () => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const isGranted = (type: string) => consents.some(c => (c.type ?? c.consentType) === type && c.status !== "Revoked" && c.granted !== false);
  const toggle = async (type: string, enabled: boolean) => { setBusy(type); try { if (enabled) await api.post("/me/consents", { type, method: "MobileApp", version: "portal-v1" }); else await api.post("/me/consents/revoke", { type, reason: "Αλλαγή προτίμησης από την πύλη πελάτη" }); onChanged(); } catch (e) { onError(extractErrorMessage(e)); } finally { setBusy(null); } };
  return <Card><CardContent><Typography variant="h6" sx={{ fontWeight: 800 }}>Προτιμήσεις επικοινωνίας</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Επιλέξτε αν επιτρέπετε στο γραφείο να σας στέλνει ενημερώσεις και προσφορές. Μπορείτε να αλλάξετε τις επιλογές σας οποτεδήποτε.</Typography><Stack spacing={.7}>{consentTypes.map(type => <Paper key={type} variant="outlined" sx={{ p: 1.15 }}><FormControlLabel control={<Switch checked={isGranted(type)} disabled={busy === type} onChange={(_, checked) => toggle(type, checked)} color="success" />} label={<Box><Typography sx={{ fontWeight: 700 }}>{consentLabels[type]}</Typography><Typography variant="caption" color="text.secondary">{isGranted(type) ? "Ενεργό" : "Ανενεργό"}</Typography></Box>} /></Paper>)}</Stack></CardContent></Card>;
}

export default CustomerPortalPage;
