import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

const STATUSES = ["Pending","Paid","Cancelled"] as const;
type Status = typeof STATUSES[number];
interface DiasDto { id: string; policyId: string; policyNumber: string; rfCode: string; amount: number; currency: string; status: Status; paidAt: string | null; bankReference: string | null; dueDate: string; }
interface PolicyLite { id: string; policyNumber: string; }

export function DiasCodesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | "">("");

  const q = useQuery({ queryKey: ["dias-codes", statusFilter], queryFn: async () => (await api.get<DiasDto[]>("/dias-codes", { params: { status: statusFilter || undefined } })).data });
  const markPaid = useMutation({ mutationFn: async (id: string) => api.post(`/dias-codes/${id}/mark-paid`, { bankReference: prompt(t("dias.bankRefPrompt")) || null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dias-codes"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  const colors: Record<Status, "default"|"success"|"error"> = { Pending: "default", Paid: "success", Cancelled: "error" };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("dias.title")}</Typography>
          <Typography color="text.secondary">{t("dias.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2}>
          <SearchableTextField size="small" select label={t("common.status")} value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | "")} sx={{ minWidth: 160 }}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`dias.statusLabel.${s}`)}</MenuItem>)}
          </SearchableTextField>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("dias.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("dias.rfCode")}</TableCell>
              <TableCell>{t("dias.policy")}</TableCell>
              <TableCell align="right">{t("dias.amount")}</TableCell>
              <TableCell>{t("dias.dueDate")}</TableCell>
              <TableCell>{t("dias.paidAt")}</TableCell>
              <TableCell>{t("dias.bankRef")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("dias.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(d => (
                <TableRow key={d.id} hover>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{d.rfCode}</Typography></TableCell>
                  <TableCell>{d.policyNumber}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(d.amount, d.currency)}</TableCell>
                  <TableCell>{d.dueDate}</TableCell>
                  <TableCell>{d.paidAt ? new Date(d.paidAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{d.bankReference ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[d.status]} label={t(`dias.statusLabel.${d.status}`)} /></TableCell>
                  <TableCell align="right">
                    {d.status === "Pending" && (
                      <IconButton size="small" color="success" title={t("dias.markPaid")} onClick={() => markPaid.mutate(d.id)}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["dias-codes"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const policies = useQuery({ queryKey: ["policies-lite"], enabled: open,
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data });
  const future = new Date(); future.setDate(future.getDate() + 30);
  const [form, setForm] = useState({ policyId: "", amount: 0, currency: "EUR", dueDate: future.toISOString().slice(0, 10) });
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => (await api.post("/dias-codes", {
      policyId: form.policyId, amount: Number(form.amount), currency: form.currency.toUpperCase(), dueDate: form.dueDate
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("dias.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableSelect
            label={t("dias.policy")}
            required
            value={form.policyId}
            onChange={(v) => setForm({ ...form, policyId: v })}
            options={(policies.data ?? []).map(p => ({ value: p.id, label: p.policyNumber }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" required label={t("dias.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
            <TextField type="date" label={t("dias.dueDate")} InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.policyId || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
