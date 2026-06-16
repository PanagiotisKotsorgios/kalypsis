import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

const METHODS = ["Cash","Card","BankTransfer","Cheque","PromissoryNote","Other"] as const;
type Method = typeof METHODS[number];
interface ReceiptDto {
  id: string; number: string; receivedOn: string;
  customerId: string; customerName: string;
  policyId: string | null; policyNumber: string | null;
  method: Method; amount: number; currency: string; notes: string | null;
}

export function ReceiptsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["receipts"], queryFn: async () => (await api.get<ReceiptDto[]>("/receipts")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/receipts/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["receipts"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const total = (q.data ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("receipts.title")}</Typography>
          <Typography color="text.secondary">{t("receipts.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("receipts.totalShown")}</Typography>
            <Typography variant="h5" fontWeight={800}>{total.toFixed(2)} €</Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("receipts.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("receipts.number")}</TableCell>
              <TableCell>{t("receipts.date")}</TableCell>
              <TableCell>{t("receipts.customer")}</TableCell>
              <TableCell>{t("receipts.policy")}</TableCell>
              <TableCell>{t("receipts.method")}</TableCell>
              <TableCell align="right">{t("receipts.amount")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("receipts.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{r.number}</Typography></TableCell>
                  <TableCell>{r.receivedOn}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>{r.policyNumber ?? "—"}</TableCell>
                  <TableCell>{t(`paymentMethod.${r.method}`)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{r.amount.toFixed(2)} {r.currency}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["receipts"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string; }[]>("/customers")).data });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ number: "", receivedOn: today, customerId: "", policyId: "", method: "Cash" as Method, amount: 0, currency: "EUR", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) setForm({ number: `R-${Date.now().toString().slice(-6)}`, receivedOn: today, customerId: "", policyId: "", method: "Cash", amount: 0, currency: "EUR", notes: "" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { number: form.number.trim(), receivedOn: form.receivedOn, customerId: form.customerId,
        policyId: form.policyId || null, method: form.method, amount: Number(form.amount),
        currency: form.currency.toUpperCase(), notes: form.notes || null };
      return (await api.post("/receipts", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("receipts.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("receipts.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <TextField type="date" label={t("receipts.date")} InputLabelProps={{ shrink: true }} value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} fullWidth />
          </Stack>
          <TextField select required label={t("receipts.customer")} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} fullWidth>
            {(customers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.type === "Individual" ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.companyName}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("receipts.method")} value={form.method} onChange={e => setForm({ ...form, method: e.target.value as Method })} fullWidth>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
            </TextField>
            <TextField type="number" required label={t("receipts.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.number.trim() || !form.customerId || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
