import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";

const KINDS = ["Cheque","PromissoryNote"] as const;
const STATUSES = ["Open","Paid","Bounced","Cancelled"] as const;
type Kind = typeof KINDS[number]; type Status = typeof STATUSES[number];
interface SecurityDto {
  id: string; number: string; kind: Kind; status: Status;
  customerId: string; customerName: string;
  issuingBankId: string | null; issuingBankName: string | null;
  issueDate: string; maturityDate: string; paidDate: string | null;
  amount: number; currency: string; notes: string | null;
}

export function SecuritiesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SecurityDto | null>(null);

  const q = useQuery({ queryKey: ["securities"], queryFn: async () => (await api.get<SecurityDto[]>("/securities")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/securities/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["securities"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  const colors: Record<Status, "info"|"success"|"error"|"default"> = { Open: "info", Paid: "success", Bounced: "error", Cancelled: "default" };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("securities.title")}</Typography>
          <Typography color="text.secondary">{t("securities.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("securities.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("securities.number")}</TableCell>
              <TableCell>{t("securities.kind")}</TableCell>
              <TableCell>{t("securities.customer")}</TableCell>
              <TableCell>{t("securities.bank")}</TableCell>
              <TableCell>{t("securities.issued")}</TableCell>
              <TableCell>{t("securities.maturity")}</TableCell>
              <TableCell align="right">{t("securities.amount")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("securities.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(s => {
                const overdue = s.status === "Open" && new Date(s.maturityDate) < new Date();
                return (
                  <TableRow key={s.id} hover>
                    <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{s.number}</Typography></TableCell>
                    <TableCell>{t(`securities.kindLabel.${s.kind}`)}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>{s.issuingBankName ?? "—"}</TableCell>
                    <TableCell>{s.issueDate}</TableCell>
                    <TableCell sx={{ color: overdue ? "error.main" : undefined, fontWeight: overdue ? 700 : undefined }}>{s.maturityDate}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(s.amount, s.currency)}</TableCell>
                    <TableCell><Chip size="small" color={colors[s.status]} label={t(`securities.statusLabel.${s.status}`)} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditing(s)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(s.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["securities"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["securities"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: SecurityDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string }[]>("/customers")).data });
  const banks = useQuery({ queryKey: ["bank-connections-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; bankName: string }[]>("/bank-connections")).data });

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date(); month.setDate(month.getDate() + 60);
  const [form, setForm] = useState({
    number: "", kind: "Cheque" as Kind, status: "Open" as Status, customerId: "", issuingBankId: "",
    issueDate: today, maturityDate: month.toISOString().slice(0, 10), paidDate: "",
    amount: 0, currency: "EUR", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      number: item.number, kind: item.kind, status: item.status,
      customerId: item.customerId, issuingBankId: item.issuingBankId ?? "",
      issueDate: item.issueDate, maturityDate: item.maturityDate, paidDate: item.paidDate ?? "",
      amount: item.amount, currency: item.currency, notes: item.notes ?? ""
    });
    else if (open) setForm({
      number: `S-${Date.now().toString().slice(-6)}`, kind: "Cheque", status: "Open",
      customerId: "", issuingBankId: "", issueDate: today, maturityDate: month.toISOString().slice(0, 10),
      paidDate: "", amount: 0, currency: "EUR", notes: ""
    });
    // eslint-disable-next-line
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), kind: form.kind, status: form.status,
        customerId: form.customerId, issuingBankId: form.issuingBankId || null,
        issueDate: form.issueDate, maturityDate: form.maturityDate,
        paidDate: form.paidDate || null,
        amount: Number(form.amount), currency: form.currency.toUpperCase(), notes: form.notes || null
      };
      if (editing) return (await api.put(`/securities/${item!.id}`, body)).data;
      return (await api.post("/securities", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("securities.editTitle") : t("securities.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("securities.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <TextField select label={t("securities.kind")} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })} fullWidth>
              {KINDS.map(k => <MenuItem key={k} value={k}>{t(`securities.kindLabel.${k}`)}</MenuItem>)}
            </TextField>
            <TextField select label={t("common.status")} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`securities.statusLabel.${s}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField select required label={t("securities.customer")} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} fullWidth>
            {(customers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.type === "Individual" ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.companyName}</MenuItem>)}
          </TextField>
          <TextField select label={t("securities.bank")} value={form.issuingBankId} onChange={e => setForm({ ...form, issuingBankId: e.target.value })} fullWidth>
            <MenuItem value="">—</MenuItem>
            {(banks.data ?? []).map(b => <MenuItem key={b.id} value={b.id}>{b.bankName}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("securities.issued")} InputLabelProps={{ shrink: true }} value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("securities.maturity")} InputLabelProps={{ shrink: true }} value={form.maturityDate} onChange={e => setForm({ ...form, maturityDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("securities.paid")} InputLabelProps={{ shrink: true }} value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" required label={t("securities.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.number.trim() || !form.customerId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
