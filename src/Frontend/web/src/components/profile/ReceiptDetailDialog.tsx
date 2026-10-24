import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import ReceiptIcon from "@mui/icons-material/ReceiptLong";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
import { api, extractErrorMessage } from "../../api/client";
import { DetailProfileTabs } from "./DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, useProfileFieldEditor } from "./ProfileFieldEditor";
import { InlineCreateCustomerDialog } from "../InlineCreateCustomerDialog";
import layout from "./receipt-card-layout.json";
import { receiptBody, receiptValues, type ReceiptRecord } from "./receiptFields";

interface Card { receipt: ReceiptRecord; related: Record<string, string | null>; history: { date: string; action: string; user: string }[] }
interface Customer { id: string; type: string; firstName?: string; lastName?: string; companyName?: string; vatNumber?: string; customerNumber?: string; phone?: string; mobilePhone?: string; email?: string; address?: string; city?: string; postalCode?: string }
interface Policy { id: string; policyNumber: string; customerId: string; insuranceCompanyName: string; premium: number; currency: string }

export function ReceiptDetailDialog({ item, initialEditing = false, onClose, onSaved }: { item: ReceiptRecord | null; initialEditing?: boolean; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [created, setCreated] = useState<ReceiptRecord | null>(null);
  const record = created ?? item;
  const isNew = !record;
  const [staged, setStaged] = useState<Record<string, string>>(() => receiptValues(null));
  const [stagedDirty, setStagedDirty] = useState(false);
  const [inlineCustomer, setInlineCustomer] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const card = useQuery({ queryKey: ["receipt-card", record?.id], enabled: !!record, queryFn: async () => (await api.get<Card>(`/receipts/${record!.id}`)).data });
  const customers = useQuery({ queryKey: ["customers-lite"], queryFn: async () => (await api.get<Customer[]>("/customers")).data });
  const values = useMemo(() => isNew ? staged : receiptValues(card.data?.receipt ?? record), [isNew, staged, card.data, record]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["receipt-card", record?.id] });
    void qc.invalidateQueries({ queryKey: ["receipts"] });
    void qc.invalidateQueries({ queryKey: ["policy-payment-summary"] });
    void qc.invalidateQueries({ queryKey: ["financial-movements"] });
    onSaved();
  };
  const session = useProfileFieldEditor({ sessionKey: record?.id ?? "new-receipt", values, initialEditing: initialEditing || isNew,
    write: async (changes, accept) => {
      if (isNew) { setStaged(v => ({ ...v, ...changes, ...(changes.customerId && changes.customerId!==v.customerId && !("policyId" in changes) ? {policyId:""} : {}) })); setStagedDirty(true); accept(Object.keys(changes)); return; }
      const saved = (await api.patch<ReceiptRecord>(`/receipts/${record!.id}/fields`, changes)).data;
      qc.setQueryData<Card>(["receipt-card", record!.id], old => old ? { ...old, receipt: saved } : old);
      accept(Object.keys(changes));
    }, refresh: () => { if (!isNew) refresh(); },
    onClose: () => { if (isNew && stagedDirty && !window.confirm("Έχετε μη αποθηκευμένα στοιχεία είσπραξης. Θέλετε να κλείσετε χωρίς καταχώρηση;")) return; onClose(); },
  });
  const drafts = { ...values, ...session.drafts };
  const customerId = drafts.customerId;
  const policies = useQuery({ queryKey: ["customer-policies-for-receipt", customerId], enabled: !!customerId,
    queryFn: async () => (await api.get<Policy[]>("/policies", { params: { customerId } })).data });
  const customer = customers.data?.find(x => x.id === customerId);
  const policy = policies.data?.find(x => x.id === drafts.policyId);
  const payment = useQuery({ queryKey: ["policy-payment-summary", drafts.policyId], enabled: !!drafts.policyId,
    queryFn: async () => (await api.get<{ premium: number; paidAmount: number; remainingAmount: number; statusLabelGr: string }>(`/policies/${drafts.policyId}/payment-summary`)).data });
  useEffect(() => {
    if(isNew && payment.data && !drafts.amount) {
      session.change("amount",String(Number(payment.data.remainingAmount.toFixed(2))));
      if(policy?.currency) session.change("currency",policy.currency);
    }
  }, [payment.data]);
  const name = (c: Customer) => c.type === "Individual" ? `${c.lastName ?? ""} ${c.firstName ?? ""}`.trim() : c.companyName ?? "";
  const related: Record<string, string | null | undefined> = { ...card.data?.related,
    CustomerCode: customer?.customerNumber, CustomerVat: customer?.vatNumber, CustomerPhone: customer?.mobilePhone ?? customer?.phone,
    CustomerEmail: customer?.email, CustomerAddress: [customer?.address, customer?.city, customer?.postalCode].filter(Boolean).join(", "),
  };
  if (policy && payment.data) Object.assign(related, { Carrier: policy.insuranceCompanyName, premium: `${payment.data.premium.toFixed(2)} ${policy.currency}`, totalReceived: `${payment.data.paidAmount.toFixed(2)} ${policy.currency}`, remaining: `${payment.data.remainingAmount.toFixed(2)} ${policy.currency}`, paymentStatus: payment.data.statusLabelGr });
  const create = useMutation({ mutationFn: async () => (await api.post<ReceiptRecord>("/receipts", receiptBody(drafts))).data,
    onSuccess: saved => { setStagedDirty(false); setCreated(saved); refresh(); } });
  const acknowledge = useMutation({ mutationFn: async () => api.patch(`/receipts/${record!.id}/fields`, { deliveryAcknowledgedOn: new Date().toLocaleDateString("sv-SE"), deliveryAcknowledgedBy: customer ? name(customer) : "Γραφείο" }), onSuccess: refresh });
  const history = (card.data?.history ?? []).filter(x => `${x.action} ${x.user} ${new Date(x.date).toLocaleString("el-GR")}`.toLocaleLowerCase("el-GR").includes(historySearch.toLocaleLowerCase("el-GR")));
  const section = ["main", "parties", "financial", "history"][tab];
  const field = (f: typeof layout.fields[number]) => {
    let options = f.choices;
    if (f.key === "customerId") options = (customers.data ?? []).map(c => ({ value: c.id, label: `${name(c)} · ${c.customerNumber ?? ""}` }));
    if (f.key === "policyId") options = [{ value: "", label: "Χωρίς σύνδεση" }, ...(policies.data ?? []).map(p => ({ value: p.id, label: p.policyNumber }))];
    if (f.key === "kind") return <ProfileEditableField key={f.key} label={f.label} value="Είσπραξη πελάτη" readOnly />;
    let display = f.path.startsWith("@") ? related[f.path.slice(1)] ?? "" : undefined;
    if (display && (f.key === "createdAt" || f.key === "updatedAt")) display = new Date(display).toLocaleString("el-GR");
    return <ProfileEditableField key={f.key} label={f.label} field={f.key} session={{...session,change:(key,value)=>{session.change(key,value);if(key==="customerId"&&value!==drafts.customerId)session.change("policyId","");}}} value={display} readOnly={f.kind === "readonly"}
      options={options} type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"} multiline={f.kind === "multiline"} />;
  };
  return <Dialog open onClose={session.requestClose} maxWidth={false} PaperProps={{ sx: profileDialogPaperSx }}>
    <DialogTitle sx={{ py: 1, background: "linear-gradient(110deg,#092a58,#0d4f8d)", color: "white", flexShrink: 0 }}>
      <Typography component="span" fontSize={11}>ΚΑΡΤΕΛΑ ΕΙΣΠΡΑΞΗΣ</Typography><Typography fontWeight={800} fontSize={21}>{isNew ? "Νέα είσπραξη" : record.number}</Typography>
    </DialogTitle>
    <DialogContent sx={{ p: 1, minHeight: 0 }}>
      <DetailProfileTabs value={tab} onChange={setTab} items={layout.tabs.map(label => ({ label, icon: <ReceiptIcon /> }))} />
      <ProfileEditorFeedback session={{ ...session, toast: isNew && session.toast ? "Το πεδίο συμπληρώθηκε. Πατήστε Καταχώρηση είσπραξης για οριστική αποθήκευση." : session.toast }} />
      {(card.isError || create.isError || acknowledge.isError) && <Alert severity="error">{extractErrorMessage(card.error ?? create.error ?? acknowledge.error)}</Alert>}
      {card.isLoading && record && <CircularProgress size={20} />}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2,minmax(0,1fr))" }, gap: 1.5, py: .5 }}>
        {[0, 1].map(column => <Stack spacing={.5} key={column} sx={{ minWidth: 0 }}>{layout.fields.filter(f => f.section === section && f.column === column).map(field)}</Stack>)}
      </Box>
      {tab === 1 && session.editAll && <Button color="success" variant="contained" size="small" onClick={() => setInlineCustomer("")}>Νέος πελάτης</Button>}
      {tab === 2 && isNew && payment.data && <Button color="success" variant="contained" size="small" onClick={() => { session.change("amount", String(payment.data!.remainingAmount)); if (policy) session.change("currency", policy.currency); }}>Συμπλήρωση υπολοίπου συμβολαίου</Button>}
      {tab === 3 && <>
        <Button color="success" variant="contained" size="small" disabled={isNew || session.dirty || acknowledge.isPending} onClick={() => acknowledge.mutate()}>Δήλωση παραλαβής</Button>
        <TextField size="small" placeholder="Αναζήτηση ιστορικού…" value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }} sx={{ my: 1, display: "block" }} />
        <Box sx={{ overflow: "auto", maxHeight: 300 }}><Table size="small" stickyHeader sx={{ "& tbody tr:nth-of-type(even)": { bgcolor: "#e8eef4" }, "& td": { py: .6 } }}><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Ενέργεια</TableCell><TableCell>Χρήστης</TableCell></TableRow></TableHead><TableBody>
          {history.slice((historyPage - 1) * 10, historyPage * 10).map((h, i) => <TableRow key={i}><TableCell>{new Date(h.date).toLocaleString("el-GR")}</TableCell><TableCell>{{ Create: "Δημιουργία", Update: "Επεξεργασία", Added: "Δημιουργία", Modified: "Επεξεργασία" }[h.action] ?? h.action}</TableCell><TableCell>{h.user}</TableCell></TableRow>)}
          {!history.length && <TableRow><TableCell colSpan={3}>Δεν υπάρχουν καταγεγραμμένες μεταβολές.</TableCell></TableRow>}
        </TableBody></Table></Box><Stack direction="row" alignItems="center"><Button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Προηγούμενη</Button><Typography variant="caption">{historyPage} / {Math.max(1, Math.ceil(history.length / 10))}</Typography><Button disabled={historyPage * 10 >= history.length} onClick={() => setHistoryPage(p => p + 1)}>Επόμενη</Button></Stack>
      </>}
      <InlineCreateCustomerDialog open={inlineCustomer !== null} prefillText={inlineCustomer ?? ""} onClose={() => setInlineCustomer(null)} onCreated={c => { void qc.invalidateQueries({ queryKey: ["customers-lite"] }); session.change("customerId", c.id); session.change("policyId", ""); setInlineCustomer(null); }} />
    </DialogContent>
    <DialogActions sx={{ flexWrap: "wrap", gap: .5, p: 1, bgcolor: "#f8fbff" }}>
      {isNew ? <><Button color="success" variant="contained" startIcon={<SaveIcon />} disabled={create.isPending} onClick={() => create.mutate()}>Καταχώρηση είσπραξης</Button><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={session.requestClose}>Κλείσιμο</Button></> : <>
        <Button color="success" variant="contained" startIcon={<PrintIcon />} disabled={session.dirty} onClick={() => {
          const popup = window.open("", "_blank"); if (!popup) return;
          const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
          popup.document.write(`<html lang="el"><head><title>Απόδειξη ${escape(record.number)}</title><style>body{font:14px Arial;color:#193653;padding:24px}td{padding:6px;border-bottom:1px solid #ccc}h1{font-size:22px}</style></head><body><h1>Απόδειξη είσπραξης ${escape(record.number)}</h1><table>${layout.fields.filter(f => f.section === "main").map(f => { const raw = f.key === "kind" ? "Είσπραξη πελάτη" : values[f.key] ?? ""; const text = f.choices?.find(c => c.value === raw)?.label ?? raw; return `<tr><td>${escape(f.label)}</td><td>${escape(text)}</td></tr>`; }).join("")}</table><p>${escape(customer ? name(customer) : "")} · ${escape(policy?.policyNumber ?? "")}</p><small>KALYPSIS</small></body></html>`);
          popup.document.close(); popup.focus(); popup.print();
        }}>Εκτύπωση απόδειξης</Button><ProfileEditorActions session={session} label="είσπραξης" />
      </>}
    </DialogActions>
  </Dialog>;
}
