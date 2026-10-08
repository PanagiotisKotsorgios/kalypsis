import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider,
  Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs,
  FormControlLabel, TextField, Typography,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SyncIcon from "@mui/icons-material/Sync";
import LinkIcon from "@mui/icons-material/Link";
import PreviewIcon from "@mui/icons-material/Preview";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type Status = {
  configured: boolean; enabled: boolean; baseUrl: string; environment: string;
  hasApiKey: boolean; maskedApiKey: string | null;
};
type TimologionClient = { id: string; legalName: string; vatNumber: string | null; email: string | null; phone: string | null };
type TimologionDocument = { id: string; type: string; status: string; series: string | null; number: number | null; issueDate: string; totalAmount: number; client?: { legalName: string } | null };
type TimologionPayment = { id: string; amount: number; method: string; receivedAt: string; client?: { legalName: string } | null; document?: { series: string | null; number: number | null } | null };

const emptyInvoice = { type: "invoice", clientId: "", description: "Υπηρεσία ασφαλιστικής διαμεσολάβησης", quantity: "1", unitPrice: "0", vatRate: "24" };

export function TimologionProviderPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [form, setForm] = useState({ baseUrl: "https://timologion.gr", apiKey: "", enabled: false, environment: "sandbox" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoice, setInvoice] = useState(emptyInvoice);
  const [draftId, setDraftId] = useState<string | null>(null);
  const status = useQuery({ queryKey: ["timologion-status"], queryFn: async () => (await api.get<Status>("/timologion/status")).data });
  useEffect(() => { if (status.data) setForm(f => ({ ...f, baseUrl: status.data.baseUrl, enabled: status.data.enabled, environment: status.data.environment })); }, [status.data]);
  const clients = useQuery({ queryKey: ["timologion-clients"], enabled: tab === 1 || tab === 4, queryFn: async () => (await api.get<{ clients: TimologionClient[] }>("/timologion/clients")).data.clients });
  const documents = useQuery({ queryKey: ["timologion-documents"], enabled: tab === 2, queryFn: async () => (await api.get<{ documents: TimologionDocument[] }>("/timologion/documents")).data.documents });
  const payments = useQuery({ queryKey: ["timologion-payments"], enabled: tab === 3, queryFn: async () => (await api.get<{ payments: TimologionPayment[] }>("/timologion/payments")).data.payments });
  const save = useMutation({ mutationFn: async () => (await api.put<Status>("/timologion/settings", form)).data,
    onSuccess: data => { setNotice({ tone: "success", text: "Οι ρυθμίσεις αποθηκεύτηκαν με ασφάλεια." }); setForm(f => ({ ...f, apiKey: "", baseUrl: data.baseUrl, enabled: data.enabled, environment: data.environment })); void qc.invalidateQueries({ queryKey: ["timologion-status"] }); },
    onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });
  const test = useMutation({ mutationFn: async () => (await api.post("/timologion/test")).data,
    onSuccess: () => setNotice({ tone: "success", text: "Η σύνδεση με το Timologion λειτουργεί." }), onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });
  const sync = useMutation({ mutationFn: async () => (await api.post<{ synced: number; failed: number }>("/timologion/sync/customers")).data,
    onSuccess: data => setNotice({ tone: data.failed ? "info" : "success", text: `Συγχρονίστηκαν ${data.synced} πελάτες${data.failed ? ` · ${data.failed} απέτυχαν` : ""}.` }), onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });
  const preview = useMutation({ mutationFn: async () => (await api.post("/timologion/invoices/preview", {
      type: invoice.type, clientId: invoice.clientId || null, lines: [{ description: invoice.description, quantity: Number(invoice.quantity), unitPrice: Number(invoice.unitPrice), vatRate: Number(invoice.vatRate), discountPct: 0, unit: "τεμ." }],
    })).data, onSuccess: () => setNotice({ tone: "success", text: "Η προεπισκόπηση υπολογίστηκε. Δεν δημιουργήθηκε και δεν διαβιβάστηκε παραστατικό." }), onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });
  const draft = useMutation({ mutationFn: async () => (await api.post<{ document: { id: string } }>("/timologion/invoices/draft", {
      type: invoice.type, clientId: invoice.clientId || null, lines: [{ description: invoice.description, quantity: Number(invoice.quantity), unitPrice: Number(invoice.unitPrice), vatRate: Number(invoice.vatRate), discountPct: 0, unit: "τεμ." }],
    })).data, onSuccess: data => { setDraftId(data.document.id); setNotice({ tone: "success", text: "Το πρόχειρο αποθηκεύτηκε στο Timologion. Δεν διαβιβάστηκε." }); void qc.invalidateQueries({ queryKey: ["timologion-documents"] }); }, onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });
  const issue = useMutation({ mutationFn: async () => {
      if (!draftId) throw new Error("Δημιούργησε πρώτα πρόχειρο.");
      const confirmed = window.prompt("Για πραγματική έκδοση πληκτρολόγησε ΕΚΔΟΣΗ") === "ΕΚΔΟΣΗ";
      if (!confirmed) throw new Error("Η έκδοση ακυρώθηκε.");
      return (await api.post("/timologion/invoices/issue", { documentId: draftId }, { headers: { "X-Kalypsis-Production-Confirm": "issue-production" } })).data;
    }, onSuccess: () => setNotice({ tone: "success", text: "Το παραστατικό διαβιβάστηκε από το Timologion." }), onError: e => setNotice({ tone: "error", text: extractErrorMessage(e) }) });

  const configured = status.data?.configured ?? false;
  const capabilityText = useMemo(() => configured ? "Συνδεδεμένο server-to-server· τα κλειδιά δεν εμφανίζονται στον browser." : "Δεν έχει συνδεθεί ακόμη πάροχος.", [configured]);

  if (status.isLoading) return <Box p={4}><CircularProgress /></Box>;
  return <Box>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} mb={3}>
      <Stack direction="row" spacing={2} alignItems="center"><ReceiptLongIcon color="primary" sx={{ fontSize: 42 }} /><Box><Typography variant="h4" fontWeight={800}>Πάροχος ηλεκτρονικής τιμολόγησης</Typography><Typography color="text.secondary">Timologion · Wrapp · myDATA, μέσα από το Kalypsis</Typography></Box></Stack>
      <Chip color={configured && status.data?.enabled ? "success" : "warning"} label={configured && status.data?.enabled ? "Ενεργό" : "Δεν έχει ενεργοποιηθεί"} />
    </Stack>
    {notice && <Alert severity={notice.tone} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.text}</Alert>}
    <Card variant="outlined" sx={{ mb: 2 }}><CardContent><Typography fontWeight={800} gutterBottom>Σύνδεση γραφείου</Typography><Typography variant="body2" color="text.secondary" mb={2}>{capabilityText} Η έκδοση παραγωγής παραμένει κλειδωμένη μέχρι να ενεργοποιηθεί ρητά από τον διαχειριστή και να επιβεβαιωθεί ξανά.</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField label="Διεύθυνση Timologion" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} fullWidth /><TextField label="Κλειδί API (εμφανίζεται μόνο κατά την αποθήκευση)" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} fullWidth /></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={2} alignItems={{ xs: "stretch", sm: "center" }}><TextField select SelectProps={{ native: true }} label="Περιβάλλον" value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })} sx={{ minWidth: 180 }}><option value="sandbox">Δοκιμή / προεπισκόπηση</option><option value="production">Παραγωγή</option></TextField><FormControlLabel control={<Checkbox checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />} label="Ενεργή σύνδεση" /><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση σύνδεσης</Button><Button variant="outlined" startIcon={<LinkIcon />} onClick={() => test.mutate()} disabled={!configured || test.isPending}>Έλεγχος σύνδεσης</Button><Button variant="outlined" startIcon={<SyncIcon />} onClick={() => sync.mutate()} disabled={!configured || sync.isPending}>Συγχρονισμός πελατών</Button></Stack>
      <Typography variant="caption" color="text.secondary" display="block" mt={2}>Δημιουργήστε κλειδί από τις ρυθμίσεις API του Timologion και επικολλήστε το εδώ. Το Kalypsis το αποθηκεύει κρυπτογραφημένο και δεν το επιστρέφει ποτέ.</Typography>
    </CardContent></Card>
    <Card variant="outlined"><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Επισκόπηση" /><Tab label="Πελάτες Timologion" /><Tab label="Παραστατικά" /><Tab label="Εισπράξεις" /><Tab label="Νέο πρόχειρο / προεπισκόπηση" /></Tabs><Divider />
      {tab === 0 && <CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>{["Πελάτες", "Παραστατικά", "Έκδοση", "Εξαγωγές"].map((label, i) => <Box key={label} sx={{ p: 2, flex: 1, bgcolor: "action.hover", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={800}>{i === 0 ? "Πλήρης συγχρονισμός" : i === 1 ? "Ιστορικό" : i === 2 ? "Με διπλή επιβεβαίωση" : "Από Timologion"}</Typography></Box>)}</Stack></CardContent>}
      {tab === 1 && <CardContent>{clients.isLoading ? <CircularProgress /> : <Stack spacing={1}>{(clients.data ?? []).map(c => <Box key={c.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}><Typography fontWeight={700}>{c.legalName}</Typography><Typography variant="body2" color="text.secondary">ΑΦΜ: {c.vatNumber ?? "—"} · {c.email ?? c.phone ?? "χωρίς στοιχεία επικοινωνίας"}</Typography></Box>)}</Stack>}</CardContent>}
      {tab === 2 && <CardContent>{documents.isLoading ? <CircularProgress /> : <Stack spacing={1}>{(documents.data ?? []).map(d => <Box key={d.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, display: "flex", justifyContent: "space-between", gap: 2 }}><Box><Typography fontWeight={700}>{d.series ?? ""}{d.number ?? "Πρόχειρο"} · {d.client?.legalName ?? "Χωρίς πελάτη"}</Typography><Typography variant="body2" color="text.secondary">{d.type} · {new Date(d.issueDate).toLocaleDateString("el-GR")}</Typography></Box><Chip size="small" label={d.status} /></Box>)}</Stack>}</CardContent>}
      {tab === 3 && <CardContent>{payments.isLoading ? <CircularProgress /> : <Stack spacing={1}>{(payments.data ?? []).map(p => <Box key={p.id} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, display: "flex", justifyContent: "space-between", gap: 2 }}><Box><Typography fontWeight={700}>{p.client?.legalName ?? "Χωρίς πελάτη"}</Typography><Typography variant="body2" color="text.secondary">{p.document ? `${p.document.series ?? ""}${p.document.number ?? ""}` : "Χωρίς σύνδεση παραστατικού"} · {p.method} · {new Date(p.receivedAt).toLocaleDateString("el-GR")}</Typography></Box><Typography fontWeight={800}>{Number(p.amount).toLocaleString("el-GR", { style: "currency", currency: "EUR" })}</Typography></Box>)}</Stack>}</CardContent>}
      {tab === 4 && <CardContent><Typography variant="body2" color="text.secondary" mb={2}>Η προεπισκόπηση είναι ασφαλής και δεν δημιουργεί παραστατικό. Η δημιουργία πρόχειρου δεν διαβιβάζει τίποτα. Η έκδοση παραγωγής είναι κλειδωμένη από προεπιλογή και απαιτεί ξεχωριστή ρύθμιση διαχειριστή.</Typography><Stack spacing={2} maxWidth={700}><TextField select SelectProps={{ native: true }} label="Τύπος" value={invoice.type} onChange={e => setInvoice({ ...invoice, type: e.target.value })}><option value="invoice">Τιμολόγιο</option><option value="service_invoice">Τιμολόγιο παροχής</option><option value="retail_receipt">Απόδειξη λιανικής</option><option value="credit_note">Πιστωτικό</option></TextField><TextField select SelectProps={{ native: true }} label="Πελάτης Kalypsis / Timologion" value={invoice.clientId} onChange={e => setInvoice({ ...invoice, clientId: e.target.value })}><option value="">Χωρίς πελάτη</option>{(clients.data ?? []).map(c => <option key={c.id} value={c.id}>{c.legalName}{c.vatNumber ? ` · ${c.vatNumber}` : ""}</option>)}</TextField><TextField label="Περιγραφή" value={invoice.description} onChange={e => setInvoice({ ...invoice, description: e.target.value })} /><Stack direction="row" spacing={2}><TextField type="number" label="Ποσότητα" value={invoice.quantity} onChange={e => setInvoice({ ...invoice, quantity: e.target.value })} fullWidth /><TextField type="number" label="Καθαρή αξία" value={invoice.unitPrice} onChange={e => setInvoice({ ...invoice, unitPrice: e.target.value })} fullWidth /><TextField type="number" label="ΦΠΑ %" value={invoice.vatRate} onChange={e => setInvoice({ ...invoice, vatRate: e.target.value })} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" startIcon={<PreviewIcon />} onClick={() => { setPreviewOpen(true); preview.mutate(); }} disabled={!configured || preview.isPending}>Προεπισκόπηση</Button><Button variant="contained" color="secondary" onClick={() => draft.mutate()} disabled={!configured || draft.isPending}>Αποθήκευση πρόχειρου</Button><Button variant="contained" color="success" onClick={() => issue.mutate()} disabled={!draftId || issue.isPending}>Έκδοση παραγωγής</Button></Stack>{draftId && <Typography variant="caption" color="text.secondary">Πρόχειρο έτοιμο για έλεγχο: {draftId}</Typography>}</Stack></CardContent>}
    </Card>
    <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Προεπισκόπηση παραστατικού</DialogTitle><DialogContent dividers>{preview.isPending ? <CircularProgress /> : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{JSON.stringify(preview.data, null, 2)}</pre>}</DialogContent><DialogActions><Button onClick={() => setPreviewOpen(false)}>Κλείσιμο</Button></DialogActions></Dialog>
  </Box>;
}
