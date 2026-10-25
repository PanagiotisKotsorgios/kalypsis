import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import LinkIcon from "@mui/icons-material/Link";
import EditIcon from "@mui/icons-material/EditOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "./SearchableSelect";

interface LedgerLine {
  id: string; partyKind: string; partyId: string; partyName: string; entryDate: string; dueDate: string | null;
  debit: number; credit: number; openDebit: number; openCredit: number; currency: string; description: string;
  documentNumber: string | null; policyId: string | null; collectionCentreCode: string | null; costCentreCode: string | null; notes: string | null;
  isAutomatic: boolean;
}
interface LedgerAccount {
  partyKind: string; partyId: string; partyName: string; entries: LedgerLine[]; balances: Record<string, number>;
  overdue: Record<string, number>; age1To30: Record<string, number>; age31To60: Record<string, number>;
  age61To90: Record<string, number>; ageOver90: Record<string, number>;
}

export function PartyLedgerDialog({ open, onClose, partyKind, partyId, partyName }: {
  open: boolean; onClose: () => void; partyKind: "Customer" | "Producer" | "InsuranceCompany";
  partyId: string; partyName: string;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerLine | null>(null);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["party-ledger", partyKind, partyId], enabled: open && !!partyId,
    queryFn: async () => (await api.get<LedgerAccount>(`/party-ledger/${partyKind}/${partyId}`)).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/party-ledger/entries/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["party-ledger", partyKind, partyId] }), onError: e => setError(extractErrorMessage(e)) });
  const totals = useMemo(() => Object.entries(q.data?.balances ?? {}), [q.data]);
  const aged = (map?: Record<string, number>) => Object.entries(map ?? {}).map(([cur, v]) => `${money(v, cur)}`).join(" · ") || "—";
  return <>
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>Καρτέλα συναλλασσομένου · {q.data?.partyName ?? partyName}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
        {q.isLoading ? <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box> : q.isError ? <Alert severity="error">{extractErrorMessage(q.error)}</Alert> : <>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ my: 1.5 }}>
            {totals.map(([cur, value]) => <Typography key={cur} sx={{ px: 1.25, py: .65, borderRadius: 1, bgcolor: value > 0 ? "#fde9ea" : "#e7f5ee", color: value > 0 ? "#a51f2d" : "#176b45", fontWeight: 800 }}>Υπόλοιπο {cur}: {money(value, cur)}</Typography>)}
            <Typography sx={{ px: 1.25, py: .65, borderRadius: 1, bgcolor: "#fff3e0", color: "#8a4b08", fontWeight: 700 }}>Ληξιπρόθεσμα: {aged(q.data?.overdue)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Stack direction="row" gap={.7} flexWrap="wrap">
              <Typography variant="caption">1–30 ημ.: {aged(q.data?.age1To30)}</Typography><Typography variant="caption">31–60 ημ.: {aged(q.data?.age31To60)}</Typography>
              <Typography variant="caption">61–90 ημ.: {aged(q.data?.age61To90)}</Typography><Typography variant="caption">90+ ημ.: {aged(q.data?.ageOver90)}</Typography>
            </Stack>
            <Stack direction="row" gap={1}>
              <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={() => setAllocationOpen(true)}>Συμψηφισμός χειροκίνητων</Button>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Νέα κίνηση</Button>
            </Stack>
          </Stack>
          <Box sx={{ overflowX: "auto", maxHeight: "60vh" }}><Table size="small" stickyHeader>
            <TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Λήξη</TableCell><TableCell>Παραστατικό</TableCell><TableCell>Περιγραφή</TableCell><TableCell align="right">Χρέωση</TableCell><TableCell align="right">Πίστωση</TableCell><TableCell align="right">Ανοικτό</TableCell><TableCell>Κέντρο</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>{(q.data?.entries ?? []).map(x => <TableRow key={x.id} hover>
              <TableCell>{new Date(x.entryDate).toLocaleDateString("el-GR")}</TableCell><TableCell>{x.dueDate ? new Date(x.dueDate).toLocaleDateString("el-GR") : "—"}</TableCell>
              <TableCell>{x.documentNumber || "—"}</TableCell><TableCell><Typography fontWeight={600}>{x.description}</Typography>{x.isAutomatic && <Typography variant="caption" color="primary.main">Αυτόματη καταχώρηση · από παραστατικό</Typography>}{x.notes && <Typography variant="caption" color="text.secondary">{x.notes}</Typography>}</TableCell>
              <TableCell align="right">{x.debit ? money(x.debit, x.currency) : "—"}</TableCell><TableCell align="right">{x.credit ? money(x.credit, x.currency) : "—"}</TableCell>
              <TableCell align="right" sx={{ color: x.openDebit > 0 ? "error.main" : "success.main", fontWeight: 700 }}>{x.openDebit ? money(x.openDebit, x.currency) : x.openCredit ? money(x.openCredit, x.currency) : "—"}</TableCell>
              <TableCell>{x.costCentreCode || x.collectionCentreCode || "—"}</TableCell><TableCell align="right">{!x.isAutomatic && <><IconButton size="small" title="Επεξεργασία" onClick={() => { setEditingEntry(x); setAddOpen(true); }}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" title="Διαγραφή" onClick={() => del.mutate(x.id)}><DeleteIcon fontSize="small" /></IconButton></>}</TableCell>
            </TableRow>)}{!q.data?.entries.length && <TableRow><TableCell colSpan={9} align="center">Δεν υπάρχουν κινήσεις για αυτόν τον συναλλασσόμενο.</TableCell></TableRow>}</TableBody>
          </Table></Box>
        </>}
      </DialogContent><DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <LedgerEntryDialog open={addOpen} onClose={() => { setAddOpen(false); setEditingEntry(null); }} partyKind={partyKind} partyId={partyId} item={editingEntry}
      onSaved={() => { setAddOpen(false); setEditingEntry(null); void qc.invalidateQueries({ queryKey: ["party-ledger", partyKind, partyId] }); }} />
    <AllocationDialog open={allocationOpen} onClose={() => setAllocationOpen(false)} entries={q.data?.entries ?? []}
      onSaved={() => { setAllocationOpen(false); void qc.invalidateQueries({ queryKey: ["party-ledger", partyKind, partyId] }); }} />
  </>;
}

function LedgerEntryDialog({ open, onClose, partyKind, partyId, item, onSaved }: { open: boolean; onClose: () => void; partyKind: string; partyId: string; item: LedgerLine | null; onSaved: () => void }) {
  const [form, setForm] = useState({ entryDate: new Date().toISOString().slice(0, 10), dueDate: "", side: "Debit", amount: "", currency: "EUR", description: "", documentNumber: "", policyId: "", costCentreCode: "", collectionCentreCode: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (item) setForm({ entryDate: item.entryDate.slice(0, 10), dueDate: item.dueDate?.slice(0, 10) ?? "", side: item.debit > 0 ? "Debit" : "Credit", amount: String(item.debit || item.credit), currency: item.currency, description: item.description, documentNumber: item.documentNumber ?? "", policyId: item.policyId ?? "", costCentreCode: item.costCentreCode ?? "", collectionCentreCode: item.collectionCentreCode ?? "", notes: item.notes ?? "" }); else setForm({ entryDate: new Date().toISOString().slice(0, 10), dueDate: "", side: "Debit", amount: "", currency: "EUR", description: "", documentNumber: "", policyId: "", costCentreCode: "", collectionCentreCode: "", notes: "" }); setError(null); }, [item, open]);
  const save = useMutation({ mutationFn: async () => {
    const body = { partyKind, partyId,
    entryDate: new Date(form.entryDate).toISOString(), dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
    debit: form.side === "Debit" ? Number(form.amount) : 0, credit: form.side === "Credit" ? Number(form.amount) : 0,
    currency: form.currency, description: form.description, documentNumber: form.documentNumber || null,
    policyId: form.policyId || null, collectionCentreCode: form.collectionCentreCode || null,
    costCentreCode: form.costCentreCode || null, notes: form.notes || null };
    return item ? api.put(`/party-ledger/entries/${item.id}`, body) : api.post("/party-ledger", body);
  }, onSuccess: onSaved, onError: e => setError(extractErrorMessage(e)) });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{item ? "Επεξεργασία κίνησης" : "Νέα κίνηση λογαριασμού"}</DialogTitle><DialogContent>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}<Stack spacing={1.5} mt={1}>
      <Stack direction="row" gap={1}><TextField select label="Κίνηση" value={form.side} onChange={e => setForm({ ...form, side: e.target.value })} fullWidth><MenuItem value="Debit">Χρέωση</MenuItem><MenuItem value="Credit">Πίστωση</MenuItem></TextField><TextField type="number" label="Ποσό" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} fullWidth /></Stack>
      <Stack direction="row" gap={1}><TextField type="date" label="Ημερομηνία" InputLabelProps={{ shrink: true }} value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} fullWidth /><TextField type="date" label="Προθεσμία" InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} fullWidth /></Stack>
      <Stack direction="row" gap={1}><TextField label="Νόμισμα" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} /><TextField label="Αρ. παραστατικού" value={form.documentNumber} onChange={e => setForm({ ...form, documentNumber: e.target.value })} fullWidth /></Stack>
      <TextField label="Περιγραφή" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth />
      <Stack direction="row" gap={1}><TextField label="Κέντρο κόστους" value={form.costCentreCode} onChange={e => setForm({ ...form, costCentreCode: e.target.value })} fullWidth /><TextField label="Κέντρο είσπραξης" value={form.collectionCentreCode} onChange={e => setForm({ ...form, collectionCentreCode: e.target.value })} fullWidth /></Stack>
      <TextField label="Σημειώσεις" multiline minRows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
    </Stack>
  </DialogContent><DialogActions><Button onClick={onClose}>Άκυρο</Button><Button variant="contained" disabled={save.isPending || !form.description.trim() || Number(form.amount) <= 0} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>;
}

function AllocationDialog({ open, onClose, entries, onSaved }: { open: boolean; onClose: () => void; entries: LedgerLine[]; onSaved: () => void }) {
  const debits = entries.filter(x => !x.isAutomatic && x.openDebit > 0); const credits = entries.filter(x => !x.isAutomatic && x.openCredit > 0);
  const [debitId, setDebitId] = useState(""); const [creditId, setCreditId] = useState(""); const [amount, setAmount] = useState(""); const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: async () => api.post("/party-ledger/allocations", { debitEntryId: debitId, creditEntryId: creditId, amount: Number(amount), allocatedOn: new Date().toISOString(), notes: null }), onSuccess: onSaved, onError: e => setError(extractErrorMessage(e)) });
  const option = (x: LedgerLine) => `${new Date(x.entryDate).toLocaleDateString("el-GR")} · ${x.description} · ${money(x.openDebit || x.openCredit, x.currency)}`;
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Συμψηφισμός χρέωσης και πίστωσης</DialogTitle><DialogContent>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}<Stack spacing={2} mt={1}>
      <SearchableSelect label="Χρέωση" value={debitId} onChange={setDebitId} options={debits.map(x => ({ value: x.id, label: option(x) }))} />
      <SearchableSelect label="Πίστωση" value={creditId} onChange={setCreditId} options={credits.map(x => ({ value: x.id, label: option(x) }))} />
      <TextField type="number" label="Ποσό συμψηφισμού" value={amount} onChange={e => setAmount(e.target.value)} fullWidth inputProps={{ min: 0, step: "0.01" }} />
      <Typography variant="caption" color="text.secondary">Ο συμψηφισμός συνδέει τις δύο γραμμές και δεν δημιουργεί δεύτερη οικονομική κίνηση.</Typography>
    </Stack>
  </DialogContent><DialogActions><Button onClick={onClose}>Άκυρο</Button><Button variant="contained" disabled={save.isPending || !debitId || !creditId || Number(amount) <= 0} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} /> : "Συμψηφισμός"}</Button></DialogActions></Dialog>;
}
