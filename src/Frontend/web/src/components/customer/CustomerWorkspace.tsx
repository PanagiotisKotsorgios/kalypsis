import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Pagination, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { AuditFieldChanges } from "../audit/AuditFieldChanges";
import type { AuditFieldChange } from "../audit/auditValues";

export function CustomerPopup({ open, title, onClose, children, wide = false }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const titleId = useId();
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth={wide ? "lg" : "md"}
    aria-labelledby={titleId} PaperProps={{ sx: { m: { xs: 1, sm: 2 }, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 24px)", bgcolor: "#edf3f9", borderRadius: 2 } }}>
    <DialogTitle id={titleId} sx={{ py: 1.25, color: "#102d55", fontSize: "1.1rem", fontWeight: 800 }}>{title}</DialogTitle>
    <DialogContent dividers sx={{ px: { xs: 1, sm: 1.5 }, pt: 2, pb: { xs: 1, sm: 1.5 }, minWidth: 0 }}>{children}</DialogContent>
    <DialogActions><Button variant="contained" color="error" startIcon={<CloseIcon />} onClick={onClose}>Κλείσιμο</Button></DialogActions>
  </Dialog>;
}

const tableStyle = {
  border: "1px solid #d6e3f0", borderRadius: 1.5, bgcolor: "#f8fafc", overflow: "auto",
  "& th": { bgcolor: "#e9eef4", fontWeight: 800, whiteSpace: "nowrap", color: "#102d55" },
  "& td": { borderColor: "#dfe5ed" },
  "& tbody tr:nth-of-type(even)": { bgcolor: "#f0f2f5" },
};
function DataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <TableContainer sx={tableStyle} tabIndex={0}>
    <Table size="small"><TableHead><TableRow>{headings.map((h, i) => <TableCell key={i}>{h}</TableCell>)}</TableRow></TableHead>
      <TableBody>{children}</TableBody></Table>
  </TableContainer>;
}
const dateText = (value?: string | null) => value ? new Date(value).toLocaleDateString("el-GR") : "—";
const money = (value: number, currency: string) => `${value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
const matches = (text: string, search: string) => normalize(text).includes(normalize(search.trim()));
const kinds: Record<string, string> = { Note: "Σημείωση", Phone: "Τηλέφωνο", Email: "Email", Meeting: "Συνάντηση", Sms: "SMS", WalkIn: "Επίσκεψη" };
const directions: Record<string, string> = { Internal: "Εσωτερική", Inbound: "Εισερχόμενη", Outbound: "Εξερχόμενη" };
const outcomes: Record<string, string> = { None: "Δεν έχει οριστεί", Resolved: "Ολοκληρώθηκε", FollowUpRequired: "Χρειάζεται συνέχεια", NoAnswer: "Χωρίς απάντηση", Cancelled: "Ακυρώθηκε" };
interface Communication {
  id: string; kind: string; direction: string; outcome: string; occurredAt: string; subject: string;
  body?: string | null; durationSeconds?: number | null; relatedPolicyId?: string | null; relatedPolicyNumber?: string | null;
}
const localTime = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const newCommunication = (): Communication => ({
  id: "", kind: "Note", direction: "Internal", outcome: "None", occurredAt: new Date().toISOString(), subject: "", body: "",
});

export function CustomerCommunicationManager({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "AgencyAdmin" ||
    !!user?.permissions.includes("customers.write");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Communication | null>(null);
  const [viewing, setViewing] = useState<Communication | null>(null);
  const [deleting, setDeleting] = useState<Communication | null>(null);
  const [toast, setToast] = useState("");
  const q = useQuery({
    queryKey: ["customer-communications", customerId],
    queryFn: async () => (await api.get<Communication[]>(`/customers/${customerId}/communications`)).data,
  });
  const changed = () => {
    void qc.invalidateQueries({ queryKey: ["customer-communications", customerId] });
    void qc.invalidateQueries({ queryKey: ["customer-history", customerId] });
  };
  const remove = useMutation({
    mutationFn: (row: Communication) => api.delete(`/customers/${customerId}/communications/${row.id}`),
    onSuccess: () => { changed(); setDeleting(null); setToast("Η επικοινωνία διαγράφηκε."); },
  });
  const rows = (q.data ?? []).filter(r => (!kind || r.kind === kind) &&
    (!from || r.occurredAt >= new Date(`${from}T00:00:00`).toISOString()) &&
    (!to || r.occurredAt <= new Date(`${to}T23:59:59.999`).toISOString()) &&
    matches(`${r.subject} ${r.body ?? ""} ${r.relatedPolicyNumber ?? ""}`, search));
  return <Stack spacing={1.25}>
    <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
      <TextField size="small" label="Αναζήτηση θέματος / συμβολαίου" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: "1 1 220px" }} />
      <TextField size="small" select label="Τύπος" value={kind} onChange={e => setKind(e.target.value)} sx={{ minWidth: 150 }}>
        <MenuItem value="">Όλοι</MenuItem>{Object.entries(kinds).map(([v, label]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
      </TextField>
      <TextField size="small" type="date" label="Από" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
      <TextField size="small" type="date" label="Έως" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
      {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(newCommunication())}>Προσθήκη</Button>}
    </Stack>
    {q.isLoading ? <CircularProgress size={24} /> : q.isError ? <Alert severity="error">{extractErrorMessage(q.error)}</Alert> : rows.length === 0 ?
      <Alert severity="info">Δεν βρέθηκαν επικοινωνίες με αυτά τα φίλτρα.</Alert> :
      <DataTable headings={["Ημερομηνία", "Τύπος", "Θέμα / συμβόλαιο", "Αποτέλεσμα", "Ενέργειες"]}>
        {rows.map(row => <TableRow key={row.id}>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{dateText(row.occurredAt)}</TableCell><TableCell>{kinds[row.kind] ?? row.kind}</TableCell>
          <TableCell sx={{ minWidth: 170, overflowWrap: "anywhere" }}>{row.subject}{row.relatedPolicyNumber && <Typography variant="caption" display="block">{row.relatedPolicyNumber}</Typography>}</TableCell>
          <TableCell>{outcomes[row.outcome] ?? row.outcome}</TableCell>
          <TableCell><Stack direction="row">
            <Tooltip title="Προβολή"><IconButton size="small" aria-label={`Προβολή ${row.subject}`} onClick={() => setViewing(row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
            {canEdit && <><Tooltip title="Επεξεργασία"><IconButton size="small" color="success" aria-label={`Επεξεργασία ${row.subject}`} onClick={() => setEditing(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Διαγραφή"><IconButton size="small" color="error" aria-label={`Διαγραφή ${row.subject}`} onClick={() => { remove.reset(); setDeleting(row); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip></>}
          </Stack></TableCell>
        </TableRow>)}
      </DataTable>}
    {editing && <CommunicationEditor key={editing.id || "new"} customerId={customerId} row={editing} onClose={() => setEditing(null)} onSaved={() => { changed(); setEditing(null); setToast("Η επικοινωνία αποθηκεύτηκε."); }} />}
    <CustomerPopup open={!!viewing} title={viewing?.subject ?? "Επικοινωνία"} onClose={() => setViewing(null)}>
      <Stack spacing={1}><Typography>{dateText(viewing?.occurredAt)} · {kinds[viewing?.kind ?? ""]} · {directions[viewing?.direction ?? ""]}</Typography>
        <Typography>{outcomes[viewing?.outcome ?? ""]} {viewing?.relatedPolicyNumber && `· ${viewing.relatedPolicyNumber}`}</Typography>
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{viewing?.body || "Δεν υπάρχουν πρόσθετες σημειώσεις."}</Typography>
      </Stack>
    </CustomerPopup>
    <Dialog open={!!deleting} onClose={() => !remove.isPending && setDeleting(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Διαγραφή επικοινωνίας;</DialogTitle><DialogContent>
        <Typography>{deleting?.subject}</Typography>{remove.isError && <Alert severity="error">{extractErrorMessage(remove.error)}</Alert>}
      </DialogContent><DialogActions><Button disabled={remove.isPending} onClick={() => setDeleting(null)}>Ακύρωση</Button>
        <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>Διαγραφή</Button></DialogActions>
    </Dialog>
    <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast("")}><Alert severity="success">{toast}</Alert></Snackbar>
  </Stack>;
}

function CommunicationEditor({ customerId, row, onClose, onSaved }: { customerId: string; row: Communication; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...row, occurredAt: localTime(row.occurredAt) });
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const policies = useQuery({ queryKey: ["customer-policies", customerId], queryFn: async () =>
    (await api.get<{ id: string; policyNumber: string }[]>("/policies", { params: { customerId } })).data });
  const update = (key: keyof Communication, value: string | number | null) => { setForm(f => ({ ...f, [key]: value })); setDirty(true); };
  const save = useMutation({
    mutationFn: () => {
      const { id, relatedPolicyNumber, ...body } = form;
      const payload = { ...body, occurredAt: new Date(body.occurredAt).toISOString(), relatedPolicyId: body.relatedPolicyId || null };
      return id ? api.put(`/customers/${customerId}/communications/${id}`, payload) : api.post(`/customers/${customerId}/communications`, payload);
    },
    onSuccess: onSaved,
  });
  const close = () => { if (!save.isPending) { if (dirty) setDiscard(true); else onClose(); } };
  return <Dialog open onClose={close} fullWidth maxWidth="sm">
    <Box component="form" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <DialogTitle>{row.id ? "Επεξεργασία επικοινωνίας" : "Νέα επικοινωνία"}</DialogTitle>
      <DialogContent dividers><Stack spacing={1.5}>
        <TextField required size="small" label="Θέμα" value={form.subject} inputProps={{ maxLength: 200 }} onChange={e => update("subject", e.target.value)} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          {([["kind", "Τύπος", kinds], ["direction", "Κατεύθυνση", directions], ["outcome", "Αποτέλεσμα", outcomes]] as const).map(([key, label, options]) =>
            <TextField key={key} select size="small" label={label} value={form[key]} onChange={e => update(key, e.target.value)}>
              {Object.entries(options).map(([v, text]) => <MenuItem key={v} value={v}>{text}</MenuItem>)}
            </TextField>)}
          <TextField required size="small" type="datetime-local" label="Ημερομηνία & ώρα" value={form.occurredAt} onChange={e => update("occurredAt", e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="number" label="Διάρκεια (δευτερόλεπτα)" value={form.durationSeconds ?? ""} inputProps={{ min: 0, step: 1 }} onChange={e => update("durationSeconds", e.target.value === "" ? null : Number(e.target.value))} />
          <TextField select size="small" label="Συμβόλαιο" value={form.relatedPolicyId ?? ""} onChange={e => update("relatedPolicyId", e.target.value)}>
            <MenuItem value="">Χωρίς σύνδεση</MenuItem>
            {form.relatedPolicyId && !policies.data?.some(p => p.id === form.relatedPolicyId) && <MenuItem value={form.relatedPolicyId}>{form.relatedPolicyNumber || "Τρέχον συμβόλαιο"}</MenuItem>}
            {policies.data?.map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber}</MenuItem>)}
          </TextField>
        </Box>
        <TextField multiline minRows={4} label="Σημειώσεις" value={form.body ?? ""} inputProps={{ maxLength: 4000 }} onChange={e => update("body", e.target.value)} />
        {save.isError && <Alert severity="error">{extractErrorMessage(save.error)}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button color="error" onClick={close} disabled={save.isPending}>Ακύρωση</Button>
        <Button type="submit" color="success" variant="contained" startIcon={<SaveIcon />} disabled={save.isPending || !form.subject.trim()}>{save.isPending ? "Αποθήκευση…" : "Αποθήκευση"}</Button></DialogActions>
    </Box>
    <Dialog open={discard} onClose={() => setDiscard(false)}><DialogTitle>Μη αποθηκευμένες αλλαγές</DialogTitle><DialogContent>Να κλείσει η φόρμα χωρίς αποθήκευση;</DialogContent>
      <DialogActions><Button onClick={() => setDiscard(false)}>Επιστροφή</Button><Button color="error" onClick={onClose}>Απόρριψη αλλαγών</Button></DialogActions></Dialog>
  </Dialog>;
}

interface Account {
  entries: { id: string; policyId?: string | null; policyNumber?: string | null; kind: string; amount: number; currency: string; date: string }[];
  installments: { id: string; policyId: string; policyNumber: string; dueDate: string; amount: number; paidAt?: string | null; isOverdue: boolean }[];
}
interface Credit { id: string; creditNoteNumber: string; policyId?: string | null; status: string; amount: number; currency: string; description: string; issuedAt: string }
export function CustomerObligations({ customerId }: { customerId: string }) {
  const [search, setSearch] = useState("");
  const account = useQuery({ queryKey: ["customer-account", customerId, "pending"], queryFn: async () => (await api.get<Account>(`/customers/${customerId}/account`)).data, refetchInterval: 30000, retry: false });
  const credits = useQuery({ queryKey: ["customer-credit-notes", customerId], queryFn: async () => (await api.get<Credit[]>("/credit-notes", { params: { customerId } })).data, refetchInterval: 30000, retry: false });
  const balances = useMemo(() => {
    const totals = new Map<string, { policyId?: string | null; number: string; currency: string; amount: number }>();
    for (const e of account.data?.entries ?? []) {
      if (e.kind !== "CustomerCharge" && e.kind !== "CustomerCredit") continue;
      const key = `${e.policyId ?? "account"}-${e.currency}`;
      const total = totals.get(key) ?? { policyId: e.policyId, number: e.policyNumber || "Λογαριασμός πελάτη", currency: e.currency, amount: 0 };
      total.amount += e.kind === "CustomerCharge" ? e.amount : -e.amount;
      totals.set(key, total);
    }
    return [...totals.values()].filter(p => p.amount > .005);
  }, [account.data]);
  const installments = (account.data?.installments ?? []).filter(i => !i.paidAt && matches(i.policyNumber, search));
  return <Stack spacing={1}>
    <TextField size="small" label="Αναζήτηση συμβολαίου / πιστωτικού" value={search} onChange={e => setSearch(e.target.value)} />
    <Typography fontWeight={800}>Ανοιχτά υπόλοιπα ανά συμβόλαιο</Typography>
    {account.isLoading ? <CircularProgress size={24} /> : account.isError ? <Alert severity="error">{extractErrorMessage(account.error)}</Alert> :
      balances.filter(p => matches(p.number, search)).length === 0 ? <Alert severity="success">Δεν υπάρχουν ανοιχτά υπόλοιπα για την αναζήτηση.</Alert> :
        <DataTable headings={["Συμβόλαιο", "Οφειλόμενο υπόλοιπο"]}>
          {balances.filter(p => matches(p.number, search)).map(p => <TableRow key={`${p.policyId}-${p.currency}`}>
            <TableCell>{p.policyId ? <Button component={RouterLink} to={`/app/policies?focus=${p.policyId}`}>{p.number}</Button> : p.number}</TableCell>
            <TableCell sx={{ color: "error.dark", fontWeight: 800 }}>{money(p.amount, p.currency)}</TableCell>
          </TableRow>)}
        </DataTable>}
    <Typography variant="caption" color="text.secondary">Τα πιστωτικά και οι δόσεις αναφέρονται χωριστά. Δεν προστίθενται ξανά στα υπόλοιπα κινήσεων.</Typography>
    <Typography fontWeight={800}>Ανεξόφλητες δόσεις</Typography>
    {!account.isError && !account.isLoading && (installments.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν ανεξόφλητες δόσεις.</Typography> :
      <DataTable headings={["Συμβόλαιο", "Προθεσμία", "Ποσό", "Κατάσταση"]}>
        {installments.map(i => <TableRow key={i.id}><TableCell>{i.policyNumber}</TableCell><TableCell>{dateText(i.dueDate)}</TableCell>
          <TableCell>{money(i.amount, account.data?.entries.find(e => e.policyId === i.policyId)?.currency ?? "")}</TableCell>
          <TableCell><Chip size="small" color={i.isOverdue ? "error" : "warning"} label={i.isOverdue ? "Ληξιπρόθεσμη" : "Προς εξόφληση"} /></TableCell></TableRow>)}
      </DataTable>)}
    <Typography fontWeight={800}>Πιστωτικά προς τακτοποίηση</Typography>
    {credits.isLoading ? <CircularProgress size={24} /> : credits.isError ? <Alert severity="error">{extractErrorMessage(credits.error)}</Alert> :
      <DataTable headings={["Πιστωτικό", "Συμβόλαιο", "Περιγραφή", "Ποσό", "Κατάσταση"]}>
        {(credits.data ?? []).filter(c => ["Issued", "Draft"].includes(c.status) && matches(`${c.creditNoteNumber} ${c.description} ${account.data?.entries.find(e => e.policyId === c.policyId)?.policyNumber ?? ""}`, search)).map(c =>
          <TableRow key={c.id}><TableCell>{c.creditNoteNumber}</TableCell><TableCell>{account.data?.entries.find(e => e.policyId === c.policyId)?.policyNumber ?? "—"}</TableCell><TableCell>{c.description}</TableCell>
            <TableCell>{money(c.amount, c.currency)}</TableCell><TableCell>{c.status === "Issued" ? "Εκδοθέν · μη συμψηφισμένο" : "Πρόχειρο · δεν έχει εκδοθεί"}</TableCell></TableRow>)}
        {!(credits.data ?? []).some(c => ["Issued", "Draft"].includes(c.status) && matches(`${c.creditNoteNumber} ${c.description} ${account.data?.entries.find(e => e.policyId === c.policyId)?.policyNumber ?? ""}`, search)) &&
          <TableRow><TableCell colSpan={5}>Δεν υπάρχουν πιστωτικά προς τακτοποίηση για την αναζήτηση.</TableCell></TableRow>}
      </DataTable>}
  </Stack>;
}

interface HistoryRow { id: string; date: string; kind: string; title: string; reference?: string | null; details?: string | null; changes?: AuditFieldChange[] | null }
const historyKinds: Record<string, string> = { customer: "Στοιχεία πελάτη", policy: "Συμβόλαια", endorsement: "Πρόσθετες πράξεις", cancellation: "Ακυρώσεις", communication: "Επικοινωνίες", claim: "Ζημιές", receipt: "Εισπράξεις", credit: "Πιστωτικά", consent: "Συγκαταθέσεις", document: "Έγγραφα", task: "Εργασίες" };
export function CustomerHistory({ customerId }: { customerId: string }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const q = useQuery({
    queryKey: ["customer-history", customerId, debounced, kind, from, to, page],
    queryFn: async () => (await api.get<{ items: HistoryRow[]; total: number; page: number; pageSize: number }>(`/customers/${customerId}/history`, {
      params: { search: debounced || undefined, kind: kind || undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined, page },
    })).data,
    refetchInterval: 30000,
  });
  return <Stack spacing={1}>
    <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
      <TextField size="small" label="Αναζήτηση ιστορικού" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: "1 1 200px" }} />
      <TextField size="small" select label="Κατηγορία" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
        <MenuItem value="">Όλο το ιστορικό</MenuItem>{Object.entries(historyKinds).map(([v, text]) => <MenuItem key={v} value={v}>{text}</MenuItem>)}
      </TextField>
      <TextField size="small" type="date" label="Από" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
      <TextField size="small" type="date" label="Έως" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
    </Stack>
    <Typography variant="caption" color="text.secondary">Καταχωρήσεις και διαθέσιμες καταγεγραμμένες αλλαγές. Παλαιότερες αλλαγές χωρίς καταγραφή δεν ανακατασκευάζονται.</Typography>
    {q.isLoading ? <CircularProgress size={24} /> : q.isError ? <Alert severity="error">{extractErrorMessage(q.error)}</Alert> : !q.data?.items.length ?
      <Alert severity="info">Δεν βρέθηκαν εγγραφές ιστορικού.</Alert> :
      <><DataTable headings={["Ημερομηνία", "Κατηγορία", "Ενέργεια", "Αναφορά", ""]}>
        {q.data.items.map(row => <TableRow key={row.id}>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(row.date).toLocaleString("el-GR")}</TableCell>
          <TableCell>{historyKinds[row.kind] ?? row.kind}</TableCell><TableCell>{row.title}</TableCell><TableCell>{row.reference || "—"}</TableCell>
          <TableCell><Button size="small" variant="contained" color="success" sx={{ color: "#fff", "&:hover": { color: "#fff", bgcolor: "success.dark" } }} onClick={() => setSelected(row)}>Λεπτομέρειες</Button></TableCell>
        </TableRow>)}
      </DataTable><Pagination size="small" count={Math.ceil(q.data.total / q.data.pageSize)} page={q.data.page} onChange={(_, value) => setPage(value)} /></>}
    <CustomerPopup open={!!selected} title={selected?.title ?? "Λεπτομέρειες"} onClose={() => setSelected(null)}>
      <Typography fontWeight={700}>{selected?.reference}</Typography>
      {selected?.changes?.length ? <AuditFieldChanges changes={selected.changes} /> : <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 1 }}>{selected?.details || "Δεν υπάρχουν πρόσθετες καταγεγραμμένες λεπτομέρειες."}</Typography>}
    </CustomerPopup>
  </Stack>;
}
