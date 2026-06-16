import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface BranchDto { id: string; code: string; name: string; description: string | null; fieldsJson: string | null; coveragesJson: string | null; isActive: boolean; }

export function BranchesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDto | null>(null);

  const q = useQuery({ queryKey: ["branches"], queryFn: async () => (await api.get<BranchDto[]>("/branches")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["branches"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("branches.title")}</Typography>
          <Typography color="text.secondary">{t("branches.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("branches.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("branches.code")}</TableCell>
              <TableCell>{t("branches.name")}</TableCell>
              <TableCell>{t("common.description")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("branches.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(b => (
                <TableRow key={b.id} hover>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{b.code}</Typography></TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{b.description ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={b.isActive ? "success" : "default"} label={b.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["branches"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["branches"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: BranchDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({ code: "", name: "", description: "", fieldsJson: "", coveragesJson: "", isActive: true });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({ code: item.code, name: item.name, description: item.description ?? "", fieldsJson: item.fieldsJson ?? "", coveragesJson: item.coveragesJson ?? "", isActive: item.isActive });
    else if (open) setForm({ code: "", name: "", description: "", fieldsJson: "", coveragesJson: "", isActive: true });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { code: form.code.trim(), name: form.name.trim(), description: form.description || null, fieldsJson: form.fieldsJson || null, coveragesJson: form.coveragesJson || null, isActive: form.isActive };
      if (editing) return (await api.put(`/branches/${item!.id}`, body)).data;
      return (await api.post("/branches", body)).data;
    },
    onSuccess: onSaved, onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("branches.editTitle") : t("branches.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("branches.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("branches.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <TextField label={t("common.description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <TextField label={t("branches.fieldsJson")} value={form.fieldsJson} onChange={e => setForm({ ...form, fieldsJson: e.target.value })} fullWidth multiline rows={3} placeholder='[{"key":"plate","label":"Πινακίδα","type":"text"}]' />
          <TextField label={t("branches.coveragesJson")} value={form.coveragesJson} onChange={e => setForm({ ...form, coveragesJson: e.target.value })} fullWidth multiline rows={3} placeholder='[{"code":"BASIC","label":"Βασική"}]' />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.code.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
