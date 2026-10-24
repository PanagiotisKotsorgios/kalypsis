import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Radio, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import UndoIcon from "@mui/icons-material/Undo";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import { api, extractErrorMessage } from "../../api/client";
import { SearchableSelect } from "../SearchableSelect";
import { ResponsiveFilterPanel } from "../ResponsiveFilterPanel";
import { profileDialogPaperSx } from "./ProfileFieldEditor";

export interface OwnershipPerson {
  id: string; customerId: string | null; name: string; vatNumber: string; percentage: number | null;
  acquiredOn: string | null; capacity: string; notes: string;
}
export interface OwnershipEvent {
  id: string; kind: string; date: string; recordedAt: string; reason: string; reference: string; notes: string;
  before: OwnershipPerson[]; after: OwnershipPerson[]; beforePrimaryId: string; afterPrimaryId: string;
  fromId: string | null; toId: string | null; percentage: number | null; reversesId: string | null; actor: string;
}
export interface OwnershipLedger { version: number; revision: number; primaryOwnerId: string; owners: OwnershipPerson[]; events: OwnershipEvent[] }
export interface OwnershipWorkspace { ledger: OwnershipLedger; plate: string; vin: string }
interface CoverageOwner { key: string; customerId?: string; customerDisplay: string; customerVat?: string | null; from: string; to: string; policyNumbers: string[] }
interface CustomerOption { id: string; customerNumber?: string; firstName?: string; lastName?: string; companyName?: string; vatNumber?: string }
type Draft = Omit<OwnershipPerson, "percentage"> & { percentage: string };
type Mode = "add" | "replace" | "transfer" | "reverse";
export const ownershipKind = (value: string) => ({ Initial: "Αρχική καταχώρηση", Correction: "Μεταβολή / διόρθωση", FullTransfer: "Ολική μεταβίβαση ποσοστού", PartialTransfer: "Μερική μεταβίβαση", Reversal: "Αναίρεση μεταβολής" }[value] ?? value);
export const localOwnershipDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function filterOwnershipEvents(events: OwnershipEvent[], search: string, from: string, to: string) {
  const needle = search.trim().toLocaleLowerCase("el-GR");
  return [...events].reverse().filter(e => (!from || e.date >= from) && (!to || e.date <= to)
    && (!needle || [ownershipKind(e.kind), e.reason, e.reference, e.notes, e.actor, ...e.before.map(p => p.name), ...e.after.map(p => p.name)].join(" ").toLocaleLowerCase("el-GR").includes(needle)));
}
export function ownershipPercentage(value: string) {
  const text = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) <= 0 || Number(text) > 100) throw new Error("Το ποσοστό πρέπει να είναι από 0,01% έως 100%, με έως δύο δεκαδικά.");
  return Number(text);
}
export const useVehicleOwnership = (policyId?: string, enabled = true) => useQuery({ queryKey: ["vehicle-ownership", policyId], enabled: enabled && !!policyId,
  queryFn: async () => (await api.get<OwnershipWorkspace>(`/policies/${policyId}/vehicle/ownership`)).data });
const tableStyle = { "& th": { bgcolor: "#e1e9f1", color: "#183b5d", fontWeight: 800, whiteSpace: "nowrap" }, "& td": { py: .45, fontSize: ".77rem" }, "& tbody tr:nth-of-type(even)": { bgcolor: "#edf1f5" }, "& tbody tr:hover": { bgcolor: "#e0effa" } };
const dateLabel = (value?: string | null) => value ? new Date(value + "T00:00:00").toLocaleDateString("el-GR") : "—";
const percent = (n?: number | null) => n == null ? "—" : `${n.toLocaleString("el-GR", { maximumFractionDigits: 2 })}%`;
const draft = (owner?: OwnershipPerson): Draft => owner ? { ...owner, percentage: owner.percentage == null ? "" : String(owner.percentage) }
  : { id: crypto.randomUUID(), customerId: null, name: "", vatNumber: "", percentage: "", acquiredOn: null, capacity: "", notes: "" };
const person = (row: Draft): OwnershipPerson => ({ ...row, percentage: ownershipPercentage(row.percentage) });
const customerName = (c: CustomerOption) => [c.lastName, c.firstName].filter(Boolean).join(" ") || c.companyName || "";

export function VehicleOwnershipManager({ policyId, canWrite, onChanged, zIndex = 1300, coverageHistory = [] }: { policyId: string; canWrite: boolean; onChanged: () => void; zIndex?: number; coverageHistory?: CoverageOwner[] }) {
  const q = useVehicleOwnership(policyId), qc = useQueryClient();
  const ledger = q.data?.ledger;
  const [mode, setMode] = useState<Mode | null>(null), [rows, setRows] = useState<Draft[]>([]), [primary, setPrimary] = useState("");
  const [expected, setExpected] = useState(0), [date, setDate] = useState(localOwnershipDate()), [reason, setReason] = useState(""), [reference, setReference] = useState(""), [notes, setNotes] = useState("");
  const [fromId, setFromId] = useState(""), [existingTo, setExistingTo] = useState(""), [recipient, setRecipient] = useState<Draft | null>(null), [share, setShare] = useState("");
  const [full, setFull] = useState(true), [makePrimary, setMakePrimary] = useState(false), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false), [error, setError] = useState(""), [toast, setToast] = useState(false);
  const [search, setSearch] = useState(""), [start, setStart] = useState(""), [end, setEnd] = useState(""), [page, setPage] = useState(0), [ownerSearch, setOwnerSearch] = useState("");
  const [detail, setDetail] = useState<OwnershipEvent | null>(null), [policyHistory, setPolicyHistory] = useState(false);
  const customers = useQuery({ queryKey: ["vehicle-ownership-customers"], enabled: mode !== null && canWrite,
    queryFn: async () => (await api.get<CustomerOption[]>("/customers")).data });
  const history = filterOwnershipEvents(ledger?.events ?? [], search, start, end), currentPage = Math.min(page, Math.max(0, Math.ceil(history.length / 10) - 1));
  const displayedOwners = (ledger?.owners ?? []).filter(p => [p.name, p.vatNumber, p.capacity].join(" ").toLocaleLowerCase("el-GR").includes(ownerSearch.toLocaleLowerCase("el-GR")));
  const open = (nextMode: Mode) => {
    if (!ledger) return;
    const next = ledger.owners.map(draft);
    if (ledger.revision === 0 && next.length === 1 && !next[0].percentage) next[0].percentage = "100";
    setRows(nextMode === "add" ? [...next, draft()] : next); setPrimary(ledger.primaryOwnerId); setExpected(ledger.revision);
    setFromId(ledger.owners[0]?.id ?? ""); setRecipient(draft()); setExistingTo(""); setShare(""); setFull(true); setMakePrimary(false);
    setDate(localOwnershipDate()); setReason(nextMode === "transfer" ? "Πώληση" : nextMode === "add" ? "Προσθήκη συνιδιοκτήτη" : nextMode === "reverse" ? "Διόρθωση εσφαλμένης μεταβολής" : ledger.revision === 0 ? "Αρχική καταχώρηση" : "Διόρθωση καταχώρησης");
    setReference(""); setNotes(""); setError(""); setDirty(false); setMode(nextMode);
  };
  const save = useMutation({ mutationFn: async () => {
    if (!ledger || !mode) return;
    const from = ledger.owners.find(p => p.id === fromId);
    const target = existingTo ? ledger.owners.find(p => p.id === existingTo)! : recipient!;
    const body = { expectedRevision: expected, operation: mode === "add" ? "replace" : mode, change: { date, reason, reference, notes },
      owners: mode === "add" || mode === "replace" ? rows.map(person) : undefined, primaryOwnerId: primary,
      fromOwnerId: fromId, recipient: mode === "transfer" ? { ...target, percentage: null } : undefined,
      percentage: mode === "transfer" ? full ? from?.percentage : ownershipPercentage(share) : undefined, makePrimary };
    return (await api.post<OwnershipWorkspace>(`/policies/${policyId}/vehicle/ownership`, body)).data;
  }, onSuccess: data => { if (data) qc.setQueryData(["vehicle-ownership", policyId], data); setMode(null); setDirty(false); setToast(true); onChanged(); void qc.invalidateQueries({ queryKey: ["vehicle-ownership-register"] }); }, onError: ex => setError(extractErrorMessage(ex)) });
  const requestClose = () => { if (save.isPending) return; if (dirty) setDiscard(true); else setMode(null); };
  const mark = () => { setDirty(true); setError(""); };
  const from = ledger?.owners.find(p => p.id === fromId);
  const total = rows.reduce((sum, p) => sum + Math.round((Number(p.percentage.replace(",", ".")) || 0) * 100), 0) / 100;
  return <Stack spacing={1}>
    {q.isLoading && <Typography>Φόρτωση ιδιοκτησίας…</Typography>}
    {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
    <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">
      {canWrite && <>
        <Button variant="contained" color="success" startIcon={<AddIcon />} disabled={!ledger} onClick={() => open("add")}>Προσθήκη ιδιοκτήτη</Button>
        <Button variant="contained" color="success" startIcon={<EditIcon />} disabled={!ledger} onClick={() => open("replace")}>Επεξεργασία ιδιοκτητών</Button>
        <Button variant="contained" color="primary" startIcon={<SwapHorizIcon />} disabled={!ledger?.revision} onClick={() => open("transfer")}>Μεταβίβαση</Button>
        <Button variant="contained" color="error" startIcon={<UndoIcon />} disabled={!ledger?.events.length || ["Initial", "Reversal"].includes(ledger.events.at(-1)?.kind ?? "Initial")} onClick={() => open("reverse")}>Αναίρεση τελευταίας</Button>
      </>}
      <Button variant="outlined" onClick={() => setPolicyHistory(true)}>Ιστορικό συμβολαίων</Button>
    </Stack>
    {ledger?.revision === 0 && <Alert severity="info">Καταχωρήστε τους ιδιοκτήτες και τα πραγματικά ποσοστά τους πριν από την πρώτη μεταβίβαση.</Alert>}
    <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" gap={1}><Typography variant="subtitle2" fontWeight={800}>Τρέχοντες ιδιοκτήτες</Typography><Chip size="small" label={`${ledger?.owners.length ?? 0} ιδιοκτήτες`} sx={{ bgcolor: "#159b59", color: "white" }} /><TextField size="small" label="Αναζήτηση ιδιοκτήτη / ΑΦΜ" value={ownerSearch} onChange={e => setOwnerSearch(e.target.value)} sx={{ ml: "auto", maxWidth: 300 }} /></Stack>
    <Box sx={{ overflowX: "auto" }}><Table size="small" sx={tableStyle}><TableHead><TableRow>{["Ιδιοκτήτης", "ΑΦΜ", "Ποσοστό", "Απόκτηση", "Ιδιότητα", "Σημειώσεις", "Ενέργειες"].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
      {displayedOwners.map(p => <TableRow key={p.id}><TableCell sx={{ minWidth: 170 }}>{p.name} {p.id === ledger?.primaryOwnerId && <Chip size="small" label="Βασικός" color="success" />}</TableCell><TableCell>{p.vatNumber || "—"}</TableCell><TableCell sx={{ fontWeight: 800 }}>{percent(p.percentage)}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{dateLabel(p.acquiredOn)}</TableCell><TableCell>{p.capacity || "—"}</TableCell><TableCell sx={{ maxWidth: 240, whiteSpace: "pre-wrap" }}>{p.notes || "—"}</TableCell><TableCell>{p.customerId && <Button component={RouterLink} to={`/app/customers/${p.customerId}`} size="small" variant="contained" color="success">Καρτέλα πελάτη</Button>}</TableCell></TableRow>)}
      {!displayedOwners.length && <TableRow><TableCell colSpan={7}>Δεν βρέθηκαν ιδιοκτήτες.</TableCell></TableRow>}
    </TableBody></Table></Box>
    <Stack direction="row" gap={1} alignItems="center"><Typography variant="subtitle2" fontWeight={800}>Μεταβιβάσεις & ιστορικό ιδιοκτησίας</Typography><Chip size="small" label={`${history.length} εγγραφές`} sx={{ bgcolor: "#159b59", color: "white" }} /></Stack>
    <ResponsiveFilterPanel overlayZIndex={zIndex + 30} title="Φίλτρα ιστορικού ιδιοκτησίας" compactAt="md" compactButtonSx={{ bgcolor: "success.main", color: "white" }} cardSx={{ p: .6 }}>
      <Stack direction="row" gap={1} useFlexGap flexWrap="wrap"><TextField size="small" label="Αναζήτηση μεταβολής" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ flex: "1 1 200px" }} />
        <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={start} onChange={e => { setStart(e.target.value); setPage(0); }} sx={{ minWidth: 155 }} /><TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={end} onChange={e => { setEnd(e.target.value); setPage(0); }} sx={{ minWidth: 155 }} />
        <Button variant="contained" color="error" onClick={() => { setSearch(""); setStart(""); setEnd(""); setPage(0); }}>Καθαρισμός</Button></Stack>
    </ResponsiveFilterPanel>
    <Box sx={{ overflowX: "auto" }}><Table size="small" sx={tableStyle}><TableHead><TableRow>{["Ημερομηνία", "Μεταβολή", "Από", "Προς", "Ποσοστό", "Αιτιολογία", "Αναφορά", "Ενέργειες"].map(h => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
      {history.slice(currentPage * 10, currentPage * 10 + 10).map(e => <TableRow key={e.id}><TableCell sx={{ whiteSpace: "nowrap" }}>{dateLabel(e.date)}</TableCell><TableCell>{ownershipKind(e.kind)}</TableCell><TableCell>{e.before.filter(p => !e.fromId || p.id === e.fromId).map(p => p.name).join(", ")}</TableCell><TableCell>{e.after.filter(p => !e.toId || p.id === e.toId).map(p => p.name).join(", ")}</TableCell><TableCell>{percent(e.percentage)}</TableCell><TableCell>{e.reason}</TableCell><TableCell>{e.reference || "—"}</TableCell><TableCell><Button variant="contained" color="success" size="small" onClick={() => setDetail(e)}>Λεπτομέρειες</Button></TableCell></TableRow>)}
      {!history.length && <TableRow><TableCell colSpan={8}>Δεν υπάρχουν καταχωρημένες μεταβιβάσεις ή μεταβολές.</TableCell></TableRow>}
    </TableBody></Table></Box>
    {history.length > 10 && <TablePagination component="div" count={history.length} page={currentPage} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />}
    <Dialog open={mode !== null} onClose={requestClose} fullWidth maxWidth="lg" sx={{ zIndex: zIndex + 10 }} PaperProps={{ sx: profileDialogPaperSx }}>
      <DialogTitle sx={{ bgcolor: "#0b305c", color: "white", py: 1 }}>{mode === "add" ? "Προσθήκη ιδιοκτήτη" : mode === "transfer" ? "Μεταβίβαση οχήματος" : mode === "reverse" ? "Αναίρεση τελευταίας μεταβολής" : "Επεξεργασία ιδιοκτητών"}</DialogTitle>
      <DialogContent dividers sx={{ p: 1.25 }}>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {customers.isError && <Alert severity="error">Δεν φορτώθηκε η λίστα πελατών. {extractErrorMessage(customers.error)}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, pt: .7 }}>
          <TextField size="small" type="date" label="Ημερομηνία μεταβολής" InputLabelProps={{ shrink: true }} inputProps={{ max: localOwnershipDate(), min: ledger?.events.at(-1)?.date ?? "1900-01-01" }} value={date} onChange={e => { setDate(e.target.value); mark(); }} />
          <Autocomplete freeSolo options={["Πώληση", "Δωρεά", "Γονική παροχή", "Κληρονομιά", "Προσθήκη συνιδιοκτήτη", "Αφαίρεση συνιδιοκτήτη", "Διόρθωση καταχώρησης"]} inputValue={reason} onInputChange={(_, value) => { setReason(value); mark(); }} renderInput={params => <TextField {...params} size="small" label="Αιτιολογία" inputProps={{ ...params.inputProps, maxLength: 500 }} />} />
          <TextField size="small" label="Αρ. εγγράφου / αναφορά" value={reference} inputProps={{ maxLength: 120 }} onChange={e => { setReference(e.target.value); mark(); }} /><TextField size="small" label="Σημειώσεις μεταβολής" multiline minRows={2} value={notes} inputProps={{ maxLength: 2000 }} onChange={e => { setNotes(e.target.value); mark(); }} />
        </Box>
        {mode === "transfer" && <Stack spacing={1} sx={{ mt: 1.5 }}>
          <SearchableSelect label="Από ιδιοκτήτη" value={fromId} onChange={id => { setFromId(id); mark(); }} options={(ledger?.owners ?? []).map(p => ({ value: p.id, label: `${p.name} · ${percent(p.percentage)}` }))} />
          <SearchableSelect label="Προς νέο ή υπάρχοντα συνιδιοκτήτη" value={existingTo} onChange={id => { setExistingTo(id); mark(); }} options={[{ value: "", label: "Νέος ιδιοκτήτης" }, ...(ledger?.owners ?? []).filter(p => p.id !== fromId).map(p => ({ value: p.id, label: p.name }))]} />
          <Stack direction="row" alignItems="center" gap={1}><Button variant={full ? "contained" : "outlined"} onClick={() => { setFull(!full); mark(); }}>{full ? "Όλο το διαθέσιμο ποσοστό" : "Μερική μεταβίβαση"}</Button><TextField size="small" label="Ποσοστό που μεταβιβάζεται (%)" value={full ? from?.percentage ?? "" : share} disabled={full} onChange={e => { setShare(e.target.value); mark(); }} /></Stack>
          {!existingTo && recipient && <OwnerForm row={recipient} customers={customers.data ?? []} onChange={row => { setRecipient(row); mark(); }} transfer />}
          <Button disabled={full && from?.id === ledger?.primaryOwnerId} variant={makePrimary || full && from?.id === ledger?.primaryOwnerId ? "contained" : "outlined"} color="success" onClick={() => { setMakePrimary(!makePrimary); mark(); }}>Νέος ιδιοκτήτης ως βασικός πελάτης: {makePrimary || full && from?.id === ledger?.primaryOwnerId ? "Ναι" : "Όχι"}</Button>
        </Stack>}
        {(mode === "add" || mode === "replace") && <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Chip label={`Σύνολο: ${percent(total)} · στόχος 100%`} color={total === 100 && rows.every(p => !!p.percentage) ? "success" : "error"} sx={{ alignSelf: "flex-start" }} />
          {rows.map((row, index) => <Box key={row.id} sx={{ p: 1, bgcolor: index % 2 ? "#eaf1f7" : "#f5f8fc", border: "1px solid #cad8e6", borderRadius: 1 }}>
            <Stack direction="row" alignItems="center"><Radio checked={primary === row.id} disabled={!row.customerId} onChange={() => { setPrimary(row.id); mark(); }} inputProps={{ "aria-label": `Βασικός ιδιοκτήτης ${index + 1}` }} /><Typography variant="subtitle2">Ιδιοκτήτης {index + 1}{primary === row.id ? " · Βασικός" : ""}</Typography><IconButton color="error" aria-label={`Αφαίρεση ιδιοκτήτη ${index + 1}`} onClick={() => { setRows(rows.filter(p => p.id !== row.id)); mark(); }} sx={{ ml: "auto" }}><DeleteOutlineIcon /></IconButton></Stack>
            <OwnerForm row={row} customers={customers.data ?? []} onChange={next => { setRows(rows.map(p => p.id === row.id ? next : p)); mark(); }} />
          </Box>)}
          <Button variant="contained" color="success" startIcon={<AddIcon />} disabled={rows.length >= 100} onClick={() => { setRows([...rows, draft()]); mark(); }}>Προσθήκη ιδιοκτήτη</Button>
        </Stack>}
        {mode === "reverse" && <Alert severity="info" sx={{ mt: 1 }}>Θα καταχωρηθεί νέα εγγραφή που επαναφέρει την ιδιοκτησία πριν από την τελευταία μεταβολή. Το ιστορικό διατηρείται.</Alert>}
      </DialogContent>
      <DialogActions><Button variant="contained" color="success" disabled={save.isPending || customers.isLoading} onClick={() => { setError(""); save.mutate(); }}>{save.isPending ? "Αποθήκευση…" : mode === "transfer" ? "Καταχώρηση μεταβίβασης" : "Αποθήκευση"}</Button><Button variant="contained" color="error" startIcon={<CloseIcon />} disabled={save.isPending} onClick={requestClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <Dialog open={discard} onClose={() => setDiscard(false)} sx={{ zIndex: zIndex + 20 }}><DialogTitle>Μη αποθηκευμένες αλλαγές</DialogTitle><DialogContent>Να απορριφθούν οι αλλαγές ιδιοκτησίας;</DialogContent><DialogActions><Button onClick={() => setDiscard(false)}>Επιστροφή</Button><Button color="error" variant="contained" onClick={() => { setDiscard(false); setMode(null); setDirty(false); }}>Απόρριψη</Button></DialogActions></Dialog>
    <OwnershipEventDialog event={detail} onClose={() => setDetail(null)} zIndex={zIndex + 10} />
    <Dialog open={policyHistory} onClose={() => setPolicyHistory(false)} fullWidth maxWidth="lg" sx={{ zIndex: zIndex + 10 }}><DialogTitle>Ιστορικό συμβολαίων</DialogTitle><DialogContent><Box sx={{ overflowX: "auto" }}><Table size="small" sx={tableStyle}><TableHead><TableRow><TableCell>Πελάτης συμβολαίου</TableCell><TableCell>ΑΦΜ</TableCell><TableCell>Πρώτη κάλυψη</TableCell><TableCell>Τελευταία κάλυψη</TableCell><TableCell>Συμβόλαια</TableCell></TableRow></TableHead><TableBody>{coverageHistory.map(row => <TableRow key={row.key}><TableCell>{row.customerDisplay}</TableCell><TableCell>{row.customerVat || "—"}</TableCell><TableCell>{dateLabel(row.from)}</TableCell><TableCell>{dateLabel(row.to)}</TableCell><TableCell>{row.policyNumbers.join(", ")}</TableCell></TableRow>)}</TableBody></Table></Box></DialogContent><DialogActions><Button variant="contained" color="error" onClick={() => setPolicyHistory(false)}>Κλείσιμο</Button></DialogActions></Dialog>
    <Snackbar open={toast} autoHideDuration={3500} onClose={() => setToast(false)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert severity="success">Η ιδιοκτησία αποθηκεύτηκε επιτυχώς.</Alert></Snackbar>
  </Stack>;
}
function OwnerForm({ row, customers, onChange, transfer = false }: { row: Draft; customers: CustomerOption[]; onChange: (row: Draft) => void; transfer?: boolean }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, pt: .5 }}>
    <Box sx={{ gridColumn: "1 / -1" }}><SearchableSelect label="Σύνδεση με πελάτη γραφείου" value={row.customerId ?? ""} options={[{ value: "", label: "Χωρίς σύνδεση με πελάτη" }, ...customers.map(c => ({ value: c.id, label: `${customerName(c)} · ${c.customerNumber ?? ""} · ${c.vatNumber ?? ""}` }))]}
      onChange={id => { const c = customers.find(c => c.id === id); onChange({ ...row, customerId: id || null, name: c ? customerName(c) : row.name, vatNumber: c?.vatNumber ?? (id ? "" : row.vatNumber) }); }} /></Box>
    <TextField size="small" label="Ονοματεπώνυμο / επωνυμία" value={row.name} disabled={!!row.customerId} inputProps={{ maxLength: 200 }} onChange={e => onChange({ ...row, name: e.target.value })} />
    <TextField size="small" label="ΑΦΜ" value={row.vatNumber} disabled={!!row.customerId} inputProps={{ maxLength: 9, inputMode: "numeric" }} onChange={e => onChange({ ...row, vatNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
    {!transfer && <><TextField size="small" label="Ποσοστό ιδιοκτησίας (%)" value={row.percentage} inputProps={{ inputMode: "decimal" }} onChange={e => onChange({ ...row, percentage: e.target.value })} /><TextField size="small" type="date" label="Ημερομηνία απόκτησης" InputLabelProps={{ shrink: true }} inputProps={{ max: localOwnershipDate() }} value={row.acquiredOn ?? ""} onChange={e => onChange({ ...row, acquiredOn: e.target.value || null })} /></>}
    <TextField size="small" label="Ιδιότητα" value={row.capacity} inputProps={{ maxLength: 120 }} onChange={e => onChange({ ...row, capacity: e.target.value })} /><TextField size="small" label="Σημειώσεις ιδιοκτήτη" value={row.notes} inputProps={{ maxLength: 2000 }} onChange={e => onChange({ ...row, notes: e.target.value })} />
  </Box>;
}
function OwnershipEventDialog({ event, onClose, zIndex }: { event: OwnershipEvent | null; onClose: () => void; zIndex: number }) {
  return <Dialog open={!!event} onClose={onClose} fullWidth maxWidth="lg" sx={{ zIndex }}><DialogTitle sx={{ bgcolor: "#0b305c", color: "white" }}>{ownershipKind(event?.kind ?? "")}</DialogTitle><DialogContent dividers>
    <Typography sx={{ mb: 1 }}>{dateLabel(event?.date)} · {event?.reason} · {event?.reference || "Χωρίς αναφορά"}</Typography><Typography sx={{ mb: 1 }}>{event?.notes}</Typography>
    {(["before", "after"] as const).map(key => <Box key={key} sx={{ mb: 1.5, overflowX: "auto" }}><Typography variant="subtitle2" fontWeight={800}>{key === "before" ? "Πριν" : "Μετά"}</Typography><Table size="small" sx={tableStyle}><TableHead><TableRow><TableCell>Ιδιοκτήτης</TableCell><TableCell>ΑΦΜ</TableCell><TableCell>Ποσοστό</TableCell><TableCell>Βασικός</TableCell><TableCell>Απόκτηση</TableCell><TableCell>Σημειώσεις</TableCell></TableRow></TableHead><TableBody>{event?.[key].map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.vatNumber || "—"}</TableCell><TableCell>{percent(p.percentage)}</TableCell><TableCell>{p.id === (key === "before" ? event.beforePrimaryId : event.afterPrimaryId) ? "Ναι" : "Όχι"}</TableCell><TableCell>{dateLabel(p.acquiredOn)}</TableCell><TableCell>{p.notes || "—"}</TableCell></TableRow>)}</TableBody></Table></Box>)}
    <Typography variant="caption">Καταχώρηση: {event ? new Date(event.recordedAt).toLocaleString("el-GR") : ""} · {event?.actor}</Typography>
  </DialogContent><DialogActions><Button variant="contained" color="error" onClick={onClose}>Κλείσιμο</Button></DialogActions></Dialog>;
}
