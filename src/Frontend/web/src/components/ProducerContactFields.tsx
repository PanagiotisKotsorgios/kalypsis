import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import HistoryIcon from "@mui/icons-material/History";
import { api, extractErrorMessage } from "../api/client";
import { ProfileEditableField, profileFieldGridSx, type ProfileFieldSession } from "./profile/ProfileFieldEditor";
import { customerFieldError } from "./customer/customerValidation";

export interface ProducerContactField { id: string; label: string; kind: "Email" | "Phone" | "Url" | "Text"; value: string }
export const PRODUCER_CONTACT_FIELDS = [["email", "Email"], ["secondaryEmail", "Δεύτερο email"], ["phone", "Τηλέφωνο"], ["secondaryPhone", "Δεύτερο τηλέφωνο"],
  ["address", "Διεύθυνση"], ["city", "Πόλη"], ["postalCode", "Τ.Κ."], ["website", "Ιστοσελίδα"]] as const;
export function producerContactError(kind: string, value: string) {
  return customerFieldError(kind === "Email" ? "email" : kind === "Phone" ? "phone" : kind === "Url" ? "photoUrl" : "notes", value);
}
export function ProducerContactFields({ producerId, values, session, fields, loading, error, retry }: {
  producerId: string; values: Record<string, string>; session?: ProfileFieldSession; fields: ProducerContactField[]; loading: boolean; error?: string; retry: () => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false), [removing, setRemoving] = useState<ProducerContactField | null>(null), [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState({ label: "", kind: "Email" as ProducerContactField["kind"], value: "" });
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState(""), [toast, setToast] = useState("");
  const add = async () => {
    if (!form.label.trim()) { setFormError("Συμπληρώστε τίτλο πεδίου."); return; }
    const invalid = producerContactError(form.kind, form.value);
    if (invalid) { setFormError(invalid); return; }
    try {
      setBusy(true); setFormError("");
      const row = (await api.post<ProducerContactField>(`/producers/${producerId}/contact-fields`, form)).data;
      qc.setQueryData<ProducerContactField[]>(["producer-contact-fields", producerId], previous => [...(previous ?? []), row]);
      await qc.invalidateQueries({ queryKey: ["producer-contact-fields", producerId] });
      setAdding(false); setToast("Το πεδίο επικοινωνίας προστέθηκε επιτυχώς.");
    } catch (err) { setFormError(extractErrorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      setBusy(true); setFormError("");
      await api.delete(`/producers/${producerId}/contact-fields/${removing.id}`);
      qc.setQueryData<ProducerContactField[]>(["producer-contact-fields", producerId], previous => (previous ?? []).filter(row => row.id !== removing.id));
      await qc.invalidateQueries({ queryKey: ["producer-contact-fields", producerId] });
      setRemoving(null); setToast("Το πρόσθετο πεδίο αφαιρέθηκε.");
    } catch (err) { setFormError(extractErrorMessage(err)); } finally { setBusy(false); }
  };
  return <Stack spacing={1}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
      <Typography fontWeight={800}>Στοιχεία επικοινωνίας</Typography><Stack direction="row" gap={.75} flexWrap="wrap">
        <Button size="small" variant="contained" startIcon={<HistoryIcon />} sx={{ bgcolor: "#456b91", color: "#fff", "&:hover": { bgcolor: "#365776" } }} onClick={() => setHistoryOpen(true)}>Ιστορικό επικοινωνίας</Button>
        {session && <Button size="small" color="success" variant="contained" startIcon={<AddIcon />} disabled={busy || session.busy || loading || !!error} onClick={() => { setForm({ label: "", kind: "Email", value: "" }); setFormError(""); setAdding(true); }}>Προσθήκη πεδίου επικοινωνίας</Button>}
      </Stack>
    </Stack>
    <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
      {[PRODUCER_CONTACT_FIELDS.slice(0, 4), PRODUCER_CONTACT_FIELDS.slice(4)].map((column, index) => <Stack key={index} spacing={.5} sx={{ minWidth: 0 }}>
        {column.map(([key, label]) => <ProfileEditableField key={key} field={session ? key : undefined} label={label} value={values[key]} session={session} type={/email/i.test(key) ? "email" : "text"} />)}
      </Stack>)}
    </Box>
    {loading && <CircularProgress size={22} />}
    {error && <Alert severity="error" action={<Button onClick={retry}>Επανάληψη</Button>}>{error}</Alert>}
    {!!fields.length && <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, alignItems: "start" }}>
      {[fields.slice(0, Math.ceil(fields.length / 2)), fields.slice(Math.ceil(fields.length / 2))].map((column, index) => <Stack key={index} spacing={.5} sx={{ minWidth: 0 }}>
        {column.map(row => <Box key={row.id} sx={{ display: "flex", gap: .35, alignItems: "center", minWidth: 0 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}><ProfileEditableField label={row.label} field={session ? "contact:" + row.id : undefined} session={session} value={values["contact:" + row.id] ?? row.value} type={row.kind === "Email" ? "email" : "text"} validate={value => producerContactError(row.kind, value)} /></Box>
          {session && <Tooltip title={session.dirty ? "Αποθηκεύστε ή ακυρώστε πρώτα τις αλλαγές" : "Αφαίρεση πρόσθετου πεδίου"}><span><IconButton size="small" color="error" disabled={busy || session.busy || session.dirty} aria-label={"Αφαίρεση " + row.label} onClick={() => { setFormError(""); setRemoving(row); }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>}
        </Box>)}
      </Stack>)}
    </Box>}
    <Dialog open={adding} onClose={() => { if (!busy) setAdding(false); }} fullWidth maxWidth="sm"><DialogTitle>Προσθήκη πεδίου επικοινωνίας</DialogTitle><DialogContent dividers><Stack spacing={1.5} sx={{ pt: .75 }}>
      {formError && <Alert severity="error">{formError}</Alert>}
      <TextField size="small" label="Τίτλος πεδίου" required fullWidth value={form.label} inputProps={{ maxLength: 160 }} onChange={e => setForm(previous => ({ ...previous, label: e.target.value }))} />
      <TextField select size="small" label="Τύπος" value={form.kind} onChange={e => setForm(previous => ({ ...previous, kind: e.target.value as ProducerContactField["kind"], value: "" }))}>{[["Email", "Email"], ["Phone", "Τηλέφωνο"], ["Url", "Ιστοσελίδα"], ["Text", "Άλλο στοιχείο επικοινωνίας"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField size="small" label="Περιεχόμενο" fullWidth type={form.kind === "Email" ? "email" : form.kind === "Phone" ? "tel" : form.kind === "Url" ? "url" : "text"} value={form.value} onChange={e => setForm(previous => ({ ...previous, value: e.target.value }))} />
    </Stack></DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} disabled={busy} onClick={() => setAdding(false)}>Κλείσιμο</Button><Button color="success" variant="contained" startIcon={<SaveIcon />} disabled={busy} onClick={() => void add()}>Αποθήκευση</Button></DialogActions></Dialog>
    <Dialog open={!!removing} onClose={() => { if (!busy) setRemoving(null); }} fullWidth maxWidth="xs"><DialogTitle>Αφαίρεση πεδίου επικοινωνίας</DialogTitle><DialogContent>{formError && <Alert severity="error">{formError}</Alert>}Να αφαιρεθεί το πεδίο «{removing?.label}»;</DialogContent><DialogActions><Button disabled={busy} onClick={() => setRemoving(null)}>Άκυρο</Button><Button color="error" variant="contained" startIcon={<DeleteIcon />} disabled={busy} onClick={() => void remove()}>Αφαίρεση</Button></DialogActions></Dialog>
    <ProducerCommunicationHistory key={producerId} producerId={producerId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert severity="success" onClose={() => setToast("")}>{toast}</Alert></Snackbar>
  </Stack>;
}

interface Communication { id: string; occurredAt: string; kind: number; outcome: number; subject: string; body: string | null }
const kinds: Record<number, string> = { 1: "Σημείωση", 2: "Τηλέφωνο", 3: "Email", 4: "Συνάντηση", 5: "SMS", 6: "Επίσκεψη" };
const outcomes: Record<number, string> = { 0: "Χωρίς αποτέλεσμα", 1: "Ολοκληρώθηκε", 2: "Απαιτείται συνέχεια", 3: "Δεν απάντησε", 4: "Ακυρώθηκε" };
export function ProducerCommunicationHistory({ producerId, open, onClose }: { producerId: string; open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["producer-communications", producerId], enabled: open,
    queryFn: async () => (await api.get<Communication[]>(`/crm/producers/${producerId}/communications`)).data });
  const rows = (q.data ?? []).filter(row => [row.subject, row.body, kinds[row.kind], outcomes[row.outcome]].some(value => (value ?? "").toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR"))));
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>Ιστορικό επικοινωνίας συνεργάτη</DialogTitle><DialogContent dividers sx={{ bgcolor: "#edf3f9" }}>
    <TextField size="small" fullWidth label="Αναζήτηση επικοινωνίας" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ mt: .75, mb: 1 }} />
    {q.isLoading && <CircularProgress size={24} />}{q.isError && <Alert severity="error" action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>}
    <Box sx={{ overflowX: "auto" }}><Table size="small" sx={{ minWidth: 600, "& th": { bgcolor: "#e9eef4", fontWeight: 800 } }}><TableHead><TableRow>{["Ημερομηνία", "Τρόπος", "Θέμα", "Αποτέλεσμα", "Σημειώσεις"].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((row, index) => <TableRow key={row.id} sx={{ bgcolor: index % 2 ? "#f0f2f5" : "#f8fafc" }}><TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(row.occurredAt).toLocaleString("el-GR")}</TableCell><TableCell>{kinds[row.kind] ?? "Επικοινωνία"}</TableCell><TableCell>{row.subject}</TableCell><TableCell>{outcomes[row.outcome] ?? "—"}</TableCell><TableCell sx={{ maxWidth: 300, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{row.body || "—"}</TableCell></TableRow>)}{!rows.length && !q.isLoading && !q.isError && <TableRow><TableCell colSpan={5}>Δεν υπάρχουν επικοινωνίες για αυτή την επιλογή.</TableCell></TableRow>}</TableBody></Table></Box>
    <TablePagination component="div" count={rows.length} page={visiblePage} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, next) => setPage(next)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
  </DialogContent><DialogActions><Button color="error" variant="contained" startIcon={<CloseIcon />} onClick={onClose}>Κλείσιμο</Button></DialogActions></Dialog>;
}
