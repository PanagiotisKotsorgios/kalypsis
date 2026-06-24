import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BuildIcon from "@mui/icons-material/Build";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface GarageDto {
  id: string; code: string; name: string; afm: string | null;
  address: string | null; city: string | null; postalCode: string | null;
  phone: string | null; email: string | null; specialty: string | null;
  isApproved: boolean; iban: string | null; isActive: boolean; notes: string | null;
}

export function GaragesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GarageDto | null>(null);

  const q = useQuery({ queryKey: ["garages"], queryFn: async () => (await api.get<GarageDto[]>("/garages")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/garages/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["garages"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BuildIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("garages.title")}</Typography>
              <HelpHint id="page.garages" />
            </Stack>
            <Typography color="text.secondary">{t("garages.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>{t("garages.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("garages.code")}</TableCell>
              <TableCell>{t("garages.name")}</TableCell>
              <TableCell>{t("garages.city")}</TableCell>
              <TableCell>{t("garages.phone")}</TableCell>
              <TableCell>{t("garages.specialty")}</TableCell>
              <TableCell>{t("garages.approved")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("garages.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(g => (
                <TableRow key={g.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{g.code}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{g.city ?? "—"}</TableCell>
                  <TableCell>{g.phone ?? "—"}</TableCell>
                  <TableCell>{g.specialty ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={g.isApproved ? "success" : "default"} label={g.isApproved ? "✓" : "—"} /></TableCell>
                  <TableCell><Chip size="small" color={g.isActive ? "success" : "default"} label={g.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(g)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(g.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["garages"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["garages"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: GarageDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({
    code: "", name: "", afm: "", address: "", city: "", postalCode: "",
    phone: "", email: "", specialty: "", isApproved: true, iban: "", isActive: true, notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (item) setForm({
      code: item.code, name: item.name, afm: item.afm ?? "", address: item.address ?? "",
      city: item.city ?? "", postalCode: item.postalCode ?? "", phone: item.phone ?? "",
      email: item.email ?? "", specialty: item.specialty ?? "", isApproved: item.isApproved,
      iban: item.iban ?? "", isActive: item.isActive, notes: item.notes ?? ""
    });
    else if (open) setForm({
      code: "", name: "", afm: "", address: "", city: "", postalCode: "",
      phone: "", email: "", specialty: "", isApproved: true, iban: "", isActive: true, notes: ""
    });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(), name: form.name.trim(), afm: form.afm || null,
        address: form.address || null, city: form.city || null, postalCode: form.postalCode || null,
        phone: form.phone || null, email: form.email || null, specialty: form.specialty || null,
        isApproved: form.isApproved, iban: form.iban || null, isActive: form.isActive, notes: form.notes || null
      };
      if (editing) return (await api.put(`/garages/${item!.id}`, body)).data;
      return (await api.post("/garages", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("garages.editTitle") : t("garages.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("garages.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField required label={t("garages.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth sx={{ flex: 2 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.afm")} value={form.afm} onChange={e => setForm({ ...form, afm: e.target.value })} fullWidth />
            <TextField label={t("garages.specialty")} value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} fullWidth placeholder="car / motorcycle / glass" />
          </Stack>
          <TextField label={t("garages.address")} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.city")} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} fullWidth />
            <TextField label={t("garages.postalCode")} value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} sx={{ width: 140 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("garages.phone")} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label={t("garages.email")} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("garages.iban")} value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction="row" spacing={4}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isApproved} onChange={e => setForm({ ...form, isApproved: e.target.checked })} />
              <Typography>{t("garages.approved")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
            </Stack>
          </Stack>
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
