import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentsIcon from "@mui/icons-material/Payments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

interface IndemnityDto {
  id: string; claimId: string; claimNumber: string;
  paymentNumber: string; paidOn: string; amount: number; currency: string;
  payeeType: string; payeeName: string | null; garageId: string | null; garageName: string | null;
  paymentMethod: string; reference: string | null; notes: string | null;
}
interface ClaimLite { id: string; claimNumber: string; }
interface GarageLite { id: string; name: string; }

const PAYEE_TYPES = ["Customer", "Garage", "Hospital", "Other"];
const METHODS = ["Cash", "BankTransfer", "Cheque", "Card", "Other"];

export function ClaimIndemnitiesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["indemnities"], queryFn: async () => (await api.get<IndemnityDto[]>("/indemnities")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/indemnities/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["indemnities"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const total = (q.data ?? []).reduce((s, i) => s + i.amount, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PaymentsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("indemnities.title")}</Typography>
              <HelpHint id="page.indemnities" />
            </Stack>
            <Typography color="text.secondary">{t("indemnities.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("indemnities.totalsLabel")}</Typography>
            <Typography variant="body1" fontWeight={800}>{money(total)}</Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("indemnities.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("indemnities.number")}</TableCell>
              <TableCell>{t("indemnities.claim")}</TableCell>
              <TableCell>{t("indemnities.paidOn")}</TableCell>
              <TableCell>{t("indemnities.payee")}</TableCell>
              <TableCell>{t("indemnities.method")}</TableCell>
              <TableCell align="right">{t("indemnities.amount")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("indemnities.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(i => (
                <TableRow key={i.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{i.paymentNumber}</TableCell>
                  <TableCell>{i.claimNumber}</TableCell>
                  <TableCell>{i.paidOn}</TableCell>
                  <TableCell>
                    {i.payeeType === "Garage" ? (i.garageName ?? "—") : (i.payeeName ?? "—")}
                    <Typography variant="caption" color="text.secondary"> · {i.payeeType}</Typography>
                  </TableCell>
                  <TableCell>{i.paymentMethod}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>{money(i.amount, i.currency)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(i.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["indemnities"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", paymentNumber: "", paidOn: today, amount: 0, currency: "EUR",
    payeeType: "Customer", payeeName: "", garageId: "", paymentMethod: "BankTransfer", reference: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });
  const garages = useQuery({ queryKey: ["garages-lite"], enabled: open,
    queryFn: async () => (await api.get<GarageLite[]>("/garages")).data });

  useEffect(() => {
    if (open) setForm({
      claimId: "", paymentNumber: `IND-${Date.now().toString().slice(-6)}`, paidOn: today, amount: 0, currency: "EUR",
      payeeType: "Customer", payeeName: "", garageId: "", paymentMethod: "BankTransfer", reference: "", notes: ""
    });
    // eslint-disable-next-line
  }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/indemnities", {
      claimId: form.claimId, paymentNumber: form.paymentNumber.trim(),
      paidOn: form.paidOn, amount: Number(form.amount), currency: form.currency.toUpperCase(),
      payeeType: form.payeeType,
      payeeName: form.payeeType === "Garage" ? null : (form.payeeName || null),
      garageId: form.payeeType === "Garage" ? (form.garageId || null) : null,
      paymentMethod: form.paymentMethod,
      reference: form.reference || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("indemnities.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <SearchableSelect
            label={t("indemnities.claim")}
            required
            value={form.claimId}
            onChange={(v) => setForm({ ...form, claimId: v })}
            options={(claims.data ?? []).map(c => ({ value: c.id, label: c.claimNumber }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("indemnities.number")} value={form.paymentNumber}
              onChange={e => setForm({ ...form, paymentNumber: e.target.value })} fullWidth />
            <TextField type="date" label={t("indemnities.paidOn")} InputLabelProps={{ shrink: true }}
              value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("indemnities.payeeType")} value={form.payeeType}
              onChange={e => setForm({ ...form, payeeType: e.target.value })} fullWidth>
              {PAYEE_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </SearchableTextField>
            {form.payeeType === "Garage" ? (
              <SearchableSelect
                label={t("garages.title")}
                value={form.garageId}
                onChange={(v) => setForm({ ...form, garageId: v })}
                options={(garages.data ?? []).map(g => ({ value: g.id, label: g.name }))}
              />
            ) : (
              <TextField label={t("indemnities.payeeName")} value={form.payeeName}
                onChange={e => setForm({ ...form, payeeName: e.target.value })} fullWidth />
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("indemnities.method")} value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })} fullWidth>
              {METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </SearchableTextField>
            <TextField required type="number" label={t("indemnities.amount")} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField label={t("indemnities.reference")} value={form.reference}
            onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth helperText={t("indemnities.referenceHelp")} />
          <TextField label={t("common.notes")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.claimId || !form.paymentNumber.trim() || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
