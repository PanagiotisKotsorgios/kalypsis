import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

type ProducerStatus = "Active" | "Suspended" | "Terminated";

interface ProducerDto {
  id: string; code: string; name: string;
  email: string | null; phone: string | null;
  status: ProducerStatus; policyCount: number; createdAt: string;
}

const STATUS_COLOR: Record<ProducerStatus, "success" | "warning" | "default"> = {
  Active: "success", Suspended: "warning", Terminated: "default"
};

export function ProducersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProducerDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["producers"],
    queryFn: async () => (await api.get<ProducerDto[]>("/producers")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["producers"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rows = q.data ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("producers.title")}</Typography>
          <Typography color="text.secondary">{t("producers.subtitle")}</Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => { setError(null); setCreateOpen(true); }}>
          {t("producers.create")}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("producers.col.code")}</TableCell>
                  <TableCell>{t("producers.col.name")}</TableCell>
                  <TableCell>{t("producers.col.email")}</TableCell>
                  <TableCell>{t("producers.col.phone")}</TableCell>
                  <TableCell align="right">{t("producers.col.policies")}</TableCell>
                  <TableCell>{t("producers.col.status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell><Chip label={p.code} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography fontWeight={600}>{p.name}</Typography></TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell align="right">{p.policyCount}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[p.status]} label={t(`producers.statuses.${p.status}`)} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => { if (confirm(t("producers.confirmDelete", { name: p.name }))) del.mutate(p.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7}>
                    <Typography textAlign="center" color="text.secondary" py={4}>{t("producers.empty")}</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <ProducerDialog
        open={createOpen} onClose={() => setCreateOpen(false)} producer={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setCreateOpen(false); }}
      />
      <ProducerDialog
        open={!!editing} onClose={() => setEditing(null)} producer={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setEditing(null); }}
      />
    </Box>
  );
}

function ProducerDialog({ open, onClose, producer, onSaved }: {
  open: boolean; onClose: () => void; producer: ProducerDto | null; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!producer;
  const [form, setForm] = useState({ code: "", name: "", email: "", phone: "", status: "Active" as ProducerStatus });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (producer) {
      setForm({ code: producer.code, name: producer.name, email: producer.email ?? "", phone: producer.phone ?? "", status: producer.status });
    } else if (open) {
      setForm({ code: "", name: "", email: "", phone: "", status: "Active" });
    }
  }, [producer, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return (await api.put(`/producers/${producer!.id}`, form)).data;
      return (await api.post("/producers", form)).data;
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? t("producers.form.editTitle") : t("producers.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField label={t("producers.col.code")} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} fullWidth required disabled={editing} />
            <TextField select label={t("producers.col.status")} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ProducerStatus })} fullWidth>
              {(["Active","Suspended","Terminated"] as const).map(s => <MenuItem key={s} value={s}>{t(`producers.statuses.${s}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label={t("producers.col.name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
          <TextField label={t("producers.col.email")} type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField label={t("producers.col.phone")} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
