import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SyncIcon from "@mui/icons-material/Sync";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface BankConnectionDto { id: string; bankName: string; iban: string | null; bic: string | null; accountName: string | null; isActive: boolean; notes: string | null; lastSyncedAt: string | null; }

export function BankConnectionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BankConnectionDto | null>(null);

  const q = useQuery({ queryKey: ["bank-connections"], queryFn: async () => (await api.get<BankConnectionDto[]>("/bank-connections")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/bank-connections/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bank-connections"] }),
    onError: e => setErr(extractErrorMessage(e)) });
  const sync = useMutation({ mutationFn: async (id: string) => api.post(`/bank-connections/${id}/sync`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bank-connections"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("bankConnections.title")}</Typography>
          <Typography color="text.secondary">{t("bankConnections.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("bankConnections.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("bankConnections.bank")}</TableCell>
              <TableCell>IBAN</TableCell>
              <TableCell>BIC</TableCell>
              <TableCell>{t("bankConnections.accountName")}</TableCell>
              <TableCell>{t("bankConnections.lastSync")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("bankConnections.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(b => (
                <TableRow key={b.id} hover>
                  <TableCell><Typography fontWeight={700}>{b.bankName}</Typography></TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{b.iban ?? "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{b.bic ?? "—"}</TableCell>
                  <TableCell>{b.accountName ?? "—"}</TableCell>
                  <TableCell>{b.lastSyncedAt ? new Date(b.lastSyncedAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell><Chip size="small" color={b.isActive ? "success" : "default"} label={b.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title={t("bankConnections.sync")} onClick={() => sync.mutate(b.id)}><SyncIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setEditing(b)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(b.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["bank-connections"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["bank-connections"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: BankConnectionDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({ bankName: "", iban: "", bic: "", accountName: "", isActive: true, notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({ bankName: item.bankName, iban: item.iban ?? "", bic: item.bic ?? "", accountName: item.accountName ?? "", isActive: item.isActive, notes: item.notes ?? "" });
    else if (open) setForm({ bankName: "", iban: "", bic: "", accountName: "", isActive: true, notes: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { bankName: form.bankName.trim(), iban: form.iban || null, bic: form.bic || null, accountName: form.accountName || null, isActive: form.isActive, notes: form.notes || null };
      if (editing) return (await api.put(`/bank-connections/${item!.id}`, body)).data;
      return (await api.post("/bank-connections", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("bankConnections.editTitle") : t("bankConnections.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("bankConnections.bank")} value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="IBAN" value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} fullWidth />
            <TextField label="BIC" value={form.bic} onChange={e => setForm({ ...form, bic: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("bankConnections.accountName")} value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.bankName.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
