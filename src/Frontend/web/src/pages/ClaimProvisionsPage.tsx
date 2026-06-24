import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SavingsIcon from "@mui/icons-material/Savings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface ProvisionDto {
  id: string; claimId: string; claimNumber: string;
  reserveAmount: number; incurredButNotReported: number | null;
  currency: string; evaluationDate: string; assessorName: string | null; notes: string | null;
}
interface ClaimLite { id: string; claimNumber: string; }

export function ClaimProvisionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["provisions"], queryFn: async () => (await api.get<ProvisionDto[]>("/claim-provisions")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-provisions/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["provisions"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const totalReserve = (q.data ?? []).reduce((s, p) => s + p.reserveAmount, 0);
  const totalIbnr = (q.data ?? []).reduce((s, p) => s + (p.incurredButNotReported ?? 0), 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SavingsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("provisions.title")}</Typography>
              <HelpHint id="page.provisions" />
            </Stack>
            <Typography color="text.secondary">{t("provisions.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("provisions.totalsLabel")}</Typography>
            <Typography variant="body1" fontWeight={800}>
              {t("provisions.reserve")} {totalReserve.toFixed(2)} € · IBNR {totalIbnr.toFixed(2)} €
            </Typography>
          </Box>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("provisions.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("provisions.claim")}</TableCell>
              <TableCell>{t("provisions.evaluationDate")}</TableCell>
              <TableCell>{t("provisions.assessor")}</TableCell>
              <TableCell align="right">{t("provisions.reserve")}</TableCell>
              <TableCell align="right">IBNR</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("provisions.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(p => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{p.claimNumber}</TableCell>
                  <TableCell>{p.evaluationDate}</TableCell>
                  <TableCell>{p.assessorName ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{p.reserveAmount.toFixed(2)} {p.currency}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{(p.incurredButNotReported ?? 0).toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["provisions"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    claimId: "", reserveAmount: 0, incurredButNotReported: "",
    currency: "EUR", evaluationDate: today, assessorName: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const claims = useQuery({ queryKey: ["claims-lite"], enabled: open,
    queryFn: async () => (await api.get<ClaimLite[]>("/claims")).data });

  useEffect(() => { if (open) setForm({ claimId: "", reserveAmount: 0, incurredButNotReported: "", currency: "EUR", evaluationDate: today, assessorName: "", notes: "" }); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/claim-provisions", {
      claimId: form.claimId, reserveAmount: Number(form.reserveAmount),
      incurredButNotReported: form.incurredButNotReported ? Number(form.incurredButNotReported) : null,
      currency: form.currency, evaluationDate: form.evaluationDate,
      assessorName: form.assessorName || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("provisions.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select required label={t("provisions.claim")} value={form.claimId}
            onChange={e => setForm({ ...form, claimId: e.target.value })} fullWidth>
            {(claims.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.claimNumber}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required type="number" label={t("provisions.reserve")} value={form.reserveAmount}
              onChange={e => setForm({ ...form, reserveAmount: Number(e.target.value) })} fullWidth />
            <TextField type="number" label="IBNR" value={form.incurredButNotReported}
              onChange={e => setForm({ ...form, incurredButNotReported: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("provisions.evaluationDate")} InputLabelProps={{ shrink: true }}
              value={form.evaluationDate} onChange={e => setForm({ ...form, evaluationDate: e.target.value })} fullWidth />
            <TextField label={t("provisions.assessor")} value={form.assessorName}
              onChange={e => setForm({ ...form, assessorName: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.claimId || form.reserveAmount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
