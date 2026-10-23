import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { usePermission } from "../auth/permissions";
import { NumberedPager } from "./TableToolbar";
import { date } from "../utils/format";

export interface CarrierCommissionBalance {
  policyId: string; policyNumber: string; insuranceCompanyId: string; insuranceCompanyName: string;
  customerName: string; startDate: string; currency: string; paidDirectlyToCarrier: boolean;
  expected: number; received: number; outstanding: number; credit: number;
}
interface CommissionReceipt { id: string; policyId: string; receivedOn: string; amount: number; currency: string; notes: string | null; insuranceCompanyId: string | null; insuranceCompanyName: string | null; }
export const commissionAmount = (amount: number, currency: string) => `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
export function refreshCarrierCommissions(client: QueryClient, policyId: string) {
  for (const key of [["carrier-commissions"], ["carrier-commission-receipts", policyId], ["policy-detail", policyId], ["financial-movements"], ["financial-summary"]])
    void client.invalidateQueries({ queryKey: key });
}

export function CarrierCommissionReceiptsDialog({ policy, onClose }: { policy: CarrierCommissionBalance | null; onClose: () => void }) {
  const client = useQueryClient();
  const writable = usePermission("receipts.write");
  const [editing, setEditing] = useState<{ id: string; receivedOn: string; amount: string; notes: string } | null>(null);
  const [deleting, setDeleting] = useState<CommissionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["carrier-commission-receipts", policy?.policyId], enabled: !!policy,
    queryFn: async () => (await api.get<CommissionReceipt[]>(`/carrier-commissions/${policy!.policyId}/receipts`)).data });
  useEffect(() => { setEditing(null); setDeleting(null); setError(null); setSuccess(false); setPage(1); }, [policy?.policyId]);
  useEffect(() => { if (!success) return; const timer = setTimeout(() => setSuccess(false), 3500); return () => clearTimeout(timer); }, [success]);
  const saved = () => {
    if (policy) refreshCarrierCommissions(client, policy.policyId);
    setEditing(null); setDeleting(null); setSuccess(true); setError(null);
  };
  const save = useMutation({ mutationFn: async () => {
    if (!policy || !editing) throw new Error("Δεν έχει επιλεγεί συμβόλαιο.");
    if (!editing.amount.trim() || !Number.isFinite(Number(editing.amount)) || Number(editing.amount) <= 0 || !editing.receivedOn)
      throw new Error("Συμπληρώστε ημερομηνία και ποσό μεγαλύτερο από μηδέν.");
    return api.put(`/carrier-commissions/receipts/${editing.id}`, { policyId: policy.policyId,
      receivedOn: editing.receivedOn, amount: Number(editing.amount), notes: editing.notes.trim() || null });
  }, onSuccess: saved, onError: err => setError(extractErrorMessage(err)) });
  const remove = useMutation({ mutationFn: async () => api.delete(`/carrier-commissions/receipts/${deleting!.id}`),
    onSuccess: saved, onError: err => setError(extractErrorMessage(err)) });
  const rows = query.data ?? [];
  const received = rows.filter(row => row.currency === policy?.currency && row.insuranceCompanyId === policy?.insuranceCompanyId).reduce((sum, row) => sum + row.amount, 0);
  const expected = policy?.expected ?? 0;
  const busy = save.isPending || remove.isPending;
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const visiblePage = Math.min(page, pages);
  return <Dialog open={!!policy} onClose={busy ? undefined : onClose} fullWidth maxWidth="md" sx={{ zIndex: 1900 }}
    PaperProps={{ sx: { m: 1, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 24px)", bgcolor: "#edf3f9" } }}>
    <DialogTitle sx={{ fontWeight: 800, color: "#102d55" }}>Καταβολές προμήθειας ασφαλιστικής</DialogTitle>
    <DialogContent dividers sx={{ pt: 2 }}>
      <Typography fontWeight={700} sx={{ mb: 1 }}>{policy?.insuranceCompanyName} · {policy?.policyNumber}</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        {[["Προμήθεια γραφείου", expected], ["Καταβλήθηκαν", received], ["Μας οφείλει", Math.max(0, expected - received)], ["Υπερκαταβολή", Math.max(0, received - expected)]].map(([label, amount]) =>
          <Box key={label} sx={{ px: 1, py: .75, borderRadius: 1, border: "1px solid #9bafc4", bgcolor: label === "Μας οφείλει" && Number(amount) > .005 ? "#c62828" : "#f8fafc", color: label === "Μας οφείλει" && Number(amount) > .005 ? "#fff" : "#102d55" }}>
            <Typography fontSize={12}>{label}</Typography><Typography fontWeight={800}>{commissionAmount(Number(amount), policy?.currency ?? "EUR")}</Typography>
          </Box>)}
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}
      {query.isError && <Alert severity="error" sx={{ mb: 1 }}>{extractErrorMessage(query.error)}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }}>Η καταβολή και τα υπόλοιπα ενημερώθηκαν επιτυχώς.</Alert>}
      {writable && !editing && <Button variant="contained" color="success" startIcon={<AddIcon />} sx={{ mb: 1 }} onClick={() => {
        setError(null); setEditing({ id: crypto.randomUUID(), receivedOn: new Date().toISOString().slice(0, 10), amount: Math.max(0, expected - received).toFixed(2), notes: "" });
      }}>Νέα καταβολή / μερική εξόφληση</Button>}
      {editing && <Box component="form" onSubmit={event => { event.preventDefault(); if (!busy) save.mutate(); }} sx={{ p: 1.5, mb: 1.5, border: "1px solid #819ab5", borderRadius: 1, bgcolor: "#fff" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: .5 }}>
          <TextField size="small" type="date" label="Ημερομηνία καταβολής" value={editing.receivedOn} InputLabelProps={{ shrink: true }} fullWidth required disabled={busy}
            onChange={e => setEditing({ ...editing, receivedOn: e.target.value })} />
          <TextField size="small" type="number" label={`Προμήθεια γραφείου (${policy?.currency})`} value={editing.amount} fullWidth required autoFocus disabled={busy}
            helperText="Το μερίδιο γραφείου, χωρίς την προμήθεια συνεργάτη."
            inputProps={{ min: .01, step: .01, max: 999999999999.99 }} onChange={e => setEditing({ ...editing, amount: e.target.value })} />
        </Stack>
        <TextField size="small" label="Σημειώσεις / τραπεζική αναφορά" value={editing.notes} fullWidth multiline maxRows={3} sx={{ mt: 1.5 }} disabled={busy}
          inputProps={{ maxLength: 500 }} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
          <Button type="submit" variant="contained" color="success" startIcon={<SaveIcon />} disabled={busy}>Αποθήκευση</Button>
          <Button color="error" onClick={() => { setEditing(null); setError(null); }} disabled={busy}>Άκυρο</Button>
        </Stack>
      </Box>}
      {query.isLoading ? <CircularProgress size={24} /> : <>
        <TableContainer sx={{ maxHeight: 320, overflow: "auto", border: "1px solid #acbccd", borderRadius: 1 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 560, "& thead th": { bgcolor: "#e4eaf0", color: "#102d55", fontWeight: 800 }, "& tbody tr:nth-of-type(odd)": { bgcolor: "#f8fafc" }, "& tbody tr:nth-of-type(even)": { bgcolor: "#edf0f4" } }}>
            <TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell align="right">Καταβολή</TableCell><TableCell>Σημειώσεις / αναφορά</TableCell>{writable && <TableCell align="right">Ενέργειες</TableCell>}</TableRow></TableHead>
            <TableBody>{rows.slice((visiblePage - 1) * 10, visiblePage * 10).map(row => <TableRow key={row.id}>
              <TableCell>{date(row.receivedOn)}</TableCell><TableCell>{row.insuranceCompanyName ?? "—"}</TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{commissionAmount(row.amount, row.currency)}</TableCell>
              <TableCell sx={{ overflowWrap: "anywhere" }}>{row.notes || "—"}</TableCell>
              {writable && <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Tooltip title="Επεξεργασία καταβολής"><IconButton size="small" color="success" disabled={busy} onClick={() => { setError(null); setEditing({ id: row.id, receivedOn: row.receivedOn, amount: String(row.amount), notes: row.notes ?? "" }); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Διαγραφή καταβολής"><IconButton size="small" color="error" disabled={busy} onClick={() => setDeleting(row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </TableCell>}
            </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={writable ? 5 : 4}>Δεν έχουν καταχωρηθεί καταβολές από την ασφαλιστική.</TableCell></TableRow>}</TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 1 }}><NumberedPager page={visiblePage} totalPages={pages} onPage={setPage} totalRows={rows.length} pageSize={10} /></Box>
      </>}
    </DialogContent>
    <DialogActions><Button variant="contained" color="error" startIcon={<CloseIcon />} disabled={busy} onClick={onClose}>Κλείσιμο</Button></DialogActions>
    <Dialog open={!!deleting} onClose={busy ? undefined : () => setDeleting(null)} fullWidth maxWidth="xs" sx={{ zIndex: 1950 }}>
      <DialogTitle>Διαγραφή καταβολής</DialogTitle><DialogContent>Να διαγραφεί η καταβολή {commissionAmount(deleting?.amount ?? 0, deleting?.currency ?? "EUR")}; Το υπόλοιπο της ασφαλιστικής θα επανυπολογιστεί.</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setDeleting(null)}>Άκυρο</Button><Button color="error" variant="contained" disabled={busy} startIcon={<DeleteIcon />} onClick={() => remove.mutate()}>Διαγραφή</Button></DialogActions>
    </Dialog>
  </Dialog>;
}
