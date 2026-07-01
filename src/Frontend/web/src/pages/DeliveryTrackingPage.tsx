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
import { date } from "../utils/format";

const CHANNELS = ["Email","Courier","InPerson","Portal"] as const;
const STATUSES = ["Pending","InTransit","Delivered","Failed"] as const;
type Channel = typeof CHANNELS[number]; type Status = typeof STATUSES[number];

interface DeliveryDto {
  id: string; policyId: string; policyNumber: string; channel: Channel; status: Status;
  dispatchedAt: string | null; deliveredAt: string | null; acknowledgedAt: string | null;
  reference: string | null; notes: string | null;
}
interface PolicyLite { id: string; policyNumber: string; }

export function DeliveryTrackingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryDto | null>(null);

  const q = useQuery({ queryKey: ["delivery-records"], queryFn: async () => (await api.get<DeliveryDto[]>("/delivery-records")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/delivery-records/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["delivery-records"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  const colors: Record<Status, "default"|"info"|"success"|"error"> = { Pending: "default", InTransit: "info", Delivered: "success", Failed: "error" };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
          <Typography color="text.secondary">{t("delivery.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("delivery.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("delivery.policy")}</TableCell>
              <TableCell>{t("delivery.channel")}</TableCell>
              <TableCell>{t("delivery.dispatched")}</TableCell>
              <TableCell>{t("delivery.delivered")}</TableCell>
              <TableCell>{t("delivery.acknowledged")}</TableCell>
              <TableCell>{t("delivery.reference")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("delivery.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(d => (
                <TableRow key={d.id} hover>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{d.policyNumber}</Typography></TableCell>
                  <TableCell>{t(`delivery.channelLabel.${d.channel}`)}</TableCell>
                  <TableCell>{d.dispatchedAt ? date(d.dispatchedAt) : "—"}</TableCell>
                  <TableCell>{d.deliveredAt ? date(d.deliveredAt) : "—"}</TableCell>
                  <TableCell>{d.acknowledgedAt ? date(d.acknowledgedAt) : "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{d.reference ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[d.status]} label={t(`delivery.statusLabel.${d.status}`)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(d)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(d.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["delivery-records"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["delivery-records"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: DeliveryDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const policies = useQuery({ queryKey: ["policies-lite"], enabled: open,
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data });

  const [form, setForm] = useState({ policyId: "", channel: "Email" as Channel, status: "Pending" as Status,
    dispatchedAt: "", deliveredAt: "", acknowledgedAt: "", reference: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      policyId: item.policyId, channel: item.channel, status: item.status,
      dispatchedAt: item.dispatchedAt ? item.dispatchedAt.slice(0, 16) : "",
      deliveredAt: item.deliveredAt ? item.deliveredAt.slice(0, 16) : "",
      acknowledgedAt: item.acknowledgedAt ? item.acknowledgedAt.slice(0, 16) : "",
      reference: item.reference ?? "", notes: item.notes ?? ""
    });
    else if (open) setForm({ policyId: "", channel: "Email", status: "Pending", dispatchedAt: "", deliveredAt: "", acknowledgedAt: "", reference: "", notes: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const iso = (s: string) => s ? new Date(s).toISOString() : null;
      const body = {
        policyId: form.policyId, channel: form.channel, status: form.status,
        dispatchedAt: iso(form.dispatchedAt), deliveredAt: iso(form.deliveredAt), acknowledgedAt: iso(form.acknowledgedAt),
        reference: form.reference || null, notes: form.notes || null
      };
      if (editing) return (await api.put(`/delivery-records/${item!.id}`, body)).data;
      return (await api.post("/delivery-records", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("delivery.editTitle") : t("delivery.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField select required label={t("delivery.policy")} value={form.policyId} onChange={e => setForm({ ...form, policyId: e.target.value })} fullWidth>
            {(policies.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("delivery.channel")} value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value as Channel })} fullWidth>
              {CHANNELS.map(c => <MenuItem key={c} value={c}>{t(`delivery.channelLabel.${c}`)}</MenuItem>)}
            </TextField>
            <TextField select label={t("common.status")} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`delivery.statusLabel.${s}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="datetime-local" label={t("delivery.dispatched")} InputLabelProps={{ shrink: true }} value={form.dispatchedAt} onChange={e => setForm({ ...form, dispatchedAt: e.target.value })} fullWidth />
            <TextField type="datetime-local" label={t("delivery.delivered")} InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} fullWidth />
            <TextField type="datetime-local" label={t("delivery.acknowledged")} InputLabelProps={{ shrink: true }} value={form.acknowledgedAt} onChange={e => setForm({ ...form, acknowledgedAt: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("delivery.reference")} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.policyId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
