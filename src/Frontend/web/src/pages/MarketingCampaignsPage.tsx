import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

const STATUSES = ["Draft","Scheduled","Sent"] as const;
type Status = typeof STATUSES[number];
const SEGMENTS = ["all","expiring","with_email"] as const;
type Segment = typeof SEGMENTS[number];

interface CampaignDto {
  id: string; name: string; subject: string; bodyHtml: string;
  segmentKey: string | null; status: Status;
  recipients: number; sent: number; sentAt: string | null; scheduledFor: string | null; createdAt: string;
}

export function MarketingCampaignsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignDto | null>(null);

  const q = useQuery({ queryKey: ["marketing-campaigns"], queryFn: async () => (await api.get<CampaignDto[]>("/marketing-campaigns")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/marketing-campaigns/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: e => setErr(extractErrorMessage(e)) });
  const send = useMutation({ mutationFn: async (id: string) => api.post(`/marketing-campaigns/${id}/send`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  const colors: Record<Status, "default" | "info" | "success"> = { Draft: "default", Scheduled: "info", Sent: "success" };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("marketing.title")}</Typography>
          <Typography color="text.secondary">{t("marketing.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("marketing.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("marketing.name")}</TableCell>
              <TableCell>{t("marketing.subject")}</TableCell>
              <TableCell>{t("marketing.segment")}</TableCell>
              <TableCell align="right">{t("marketing.recipients")}</TableCell>
              <TableCell>{t("marketing.sentAt")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("marketing.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography fontWeight={700}>{c.name}</Typography></TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.subject}</TableCell>
                  <TableCell>{c.segmentKey ? t(`marketing.segmentLabel.${c.segmentKey}`) : "—"}</TableCell>
                  <TableCell align="right">{c.recipients}</TableCell>
                  <TableCell>{c.sentAt ? new Date(c.sentAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[c.status]} label={t(`marketing.statusLabel.${c.status}`)} /></TableCell>
                  <TableCell align="right">
                    {c.status !== "Sent" && (
                      <IconButton size="small" color="primary" title={t("marketing.send")} onClick={() => { if (confirm(t("marketing.sendConfirm"))) send.mutate(c.id); }}>
                        <SendIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setEditing(c)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(c.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: CampaignDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({ name: "", subject: "", bodyHtml: "", segmentKey: "all" as Segment, status: "Draft" as Status, scheduledFor: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      name: item.name, subject: item.subject, bodyHtml: item.bodyHtml,
      segmentKey: (item.segmentKey as Segment) || "all", status: item.status,
      scheduledFor: item.scheduledFor ? item.scheduledFor.slice(0, 16) : ""
    });
    else if (open) setForm({ name: "", subject: "", bodyHtml: "<p>Καλησπέρα από το γραφείο μας...</p>", segmentKey: "all", status: "Draft", scheduledFor: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(), subject: form.subject.trim(), bodyHtml: form.bodyHtml,
        segmentKey: form.segmentKey, status: form.status,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null
      };
      if (editing) return (await api.put(`/marketing-campaigns/${item!.id}`, body)).data;
      return (await api.post("/marketing-campaigns", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? t("marketing.editTitle") : t("marketing.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("marketing.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField required label={t("marketing.subject")} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("marketing.segment")} value={form.segmentKey} onChange={e => setForm({ ...form, segmentKey: e.target.value as Segment })} fullWidth>
              {SEGMENTS.map(s => <MenuItem key={s} value={s}>{t(`marketing.segmentLabel.${s}`)}</MenuItem>)}
            </TextField>
            <TextField select label={t("common.status")} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`marketing.statusLabel.${s}`)}</MenuItem>)}
            </TextField>
            <TextField type="datetime-local" label={t("marketing.scheduleFor")} InputLabelProps={{ shrink: true }}
              value={form.scheduledFor} onChange={e => setForm({ ...form, scheduledFor: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("marketing.bodyHtml")} multiline rows={10} value={form.bodyHtml}
            onChange={e => setForm({ ...form, bodyHtml: e.target.value })} fullWidth
            helperText={t("marketing.bodyHelp")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.subject.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
