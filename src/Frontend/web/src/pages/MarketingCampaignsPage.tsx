import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Checkbox, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { dateTime } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

const STATUSES = ["Draft","Scheduled","Sent"] as const;
type Status = typeof STATUSES[number];
const SEGMENTS = ["all","expiring","with_email"] as const;
type Segment = typeof SEGMENTS[number];
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;
const CHANNELS = ["Email", "Sms", "Viber"] as const;
type Channel = typeof CHANNELS[number];

interface CampaignDto {
  id: string; name: string; subject: string; bodyHtml: string; smsBody: string | null; viberBody: string | null;
  channels: Channel[]; segmentKey: string | null; occupationFilter: string | null; needKindFilter: string | null;
  onlyUninsuredNeeds: boolean; status: Status;
  recipients: number; sent: number; failed: number; sentAt: string | null; scheduledFor: string | null; createdAt: string;
}

interface CampaignForm {
  name: string; subject: string; bodyHtml: string; smsBody: string; viberBody: string;
  channels: Channel[]; segmentKey: Segment; occupationFilter: string; needKindFilter: string;
  onlyUninsuredNeeds: boolean; status: Status; scheduledFor: string;
}
const EMPTY_CAMPAIGN: CampaignForm = {
  name: "", subject: "", bodyHtml: "", smsBody: "", viberBody: "", channels: ["Email"],
  segmentKey: "all", occupationFilter: "", needKindFilter: "", onlyUninsuredNeeds: false,
  status: "Draft", scheduledFor: ""
};

export function MarketingCampaignsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const canWrite = user?.role === "AgencyAdmin" || user?.permissions.includes("marketing.write");
  const canSend = user?.role === "AgencyAdmin" || user?.permissions.includes("marketing.send");

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("marketing.title")}</Typography>
          <Typography color="text.secondary">{t("marketing.subtitle")}</Typography></Box>
        {canWrite && <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("marketing.create")}</Button>}
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("marketing.name")}</TableCell>
              <TableCell>{t("marketing.subject")}</TableCell>
              <TableCell>{t("marketing.segment")}</TableCell>
              <TableCell>Κανάλια</TableCell>
              <TableCell align="right">{t("marketing.recipients")}</TableCell>
              <TableCell>{t("marketing.sentAt")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("marketing.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(c => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography fontWeight={700}>{c.name}</Typography></TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{c.subject}</TableCell>
                  <TableCell>{c.segmentKey ? t(`marketing.segmentLabel.${c.segmentKey}`) : "—"}</TableCell>
                  <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap">{c.channels.map(channel => <Chip key={channel} size="small" label={channel} variant="outlined" />)}</Stack></TableCell>
                  <TableCell align="right">{c.recipients} / {c.sent}{c.failed > 0 ? ` (${c.failed} αποτυχίες)` : ""}</TableCell>
                  <TableCell>{c.sentAt ? dateTime(c.sentAt) : "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[c.status]} label={t(`marketing.statusLabel.${c.status}`)} /></TableCell>
                  <TableCell align="right">
                    {canSend && c.status !== "Sent" && (
                      <IconButton size="small" color="primary" title={t("marketing.send")} onClick={() => { if (confirm(t("marketing.sendConfirm"))) send.mutate(c.id); }}>
                        <SendIcon fontSize="small" />
                      </IconButton>
                    )}
                    {canWrite && <><IconButton size="small" onClick={() => setEditing(c)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(c.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton></>}
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
  const [form, setForm] = useState<any>({ ...EMPTY_CAMPAIGN });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      name: item.name, subject: item.subject, bodyHtml: item.bodyHtml,
      smsBody: item.smsBody ?? "", viberBody: item.viberBody ?? "", channels: item.channels,
      occupationFilter: item.occupationFilter ?? "", needKindFilter: item.needKindFilter ?? "", onlyUninsuredNeeds: item.onlyUninsuredNeeds,
      segmentKey: (item.segmentKey as Segment) || "all", status: item.status,
      scheduledFor: item.scheduledFor ? item.scheduledFor.slice(0, 16) : ""
    });
    else if (open) setForm({ name: "", subject: "", bodyHtml: "<p>Καλησπέρα από το γραφείο μας...</p>", segmentKey: "all", status: "Draft", scheduledFor: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(), subject: form.subject.trim(), bodyHtml: form.bodyHtml,
        smsBody: form.smsBody?.trim() || null,
        viberBody: form.viberBody?.trim() || null,
        channels: form.channels?.length ? form.channels : ["Email"],
        segmentKey: form.segmentKey, occupationFilter: form.occupationFilter?.trim() || null,
        needKindFilter: form.needKindFilter || null, onlyUninsuredNeeds: !!form.onlyUninsuredNeeds, status: form.status,
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
            <SearchableTextField label={t("marketing.segment")} value={form.segmentKey} onChange={e => setForm({ ...form, segmentKey: e.target.value as Segment })} fullWidth>
              {SEGMENTS.map(s => <MenuItem key={s} value={s}>{t(`marketing.segmentLabel.${s}`)}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("common.status")} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.filter(s => s !== "Sent").map(s => <MenuItem key={s} value={s}>{t(`marketing.statusLabel.${s}`)}</MenuItem>)}
            </SearchableTextField>
            <TextField type="datetime-local" label={t("marketing.scheduleFor")} InputLabelProps={{ shrink: true }}
              value={form.scheduledFor} onChange={e => setForm({ ...form, scheduledFor: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Επάγγελμα / κλάδος" value={form.occupationFilter ?? ""} onChange={e => setForm({ ...form, occupationFilter: e.target.value })} fullWidth placeholder="π.χ. εστίαση" />
            <SearchableTextField label="Ανάγκη / περιουσία" value={form.needKindFilter ?? ""} onChange={e => setForm({ ...form, needKindFilter: e.target.value })} fullWidth>
              <MenuItem value="">Όλες</MenuItem>
              {NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{kind}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {CHANNELS.map(channel => <FormControlLabel key={channel} label={channel} control={<Checkbox checked={(form.channels ?? ["Email"]).includes(channel)} onChange={e => {
              const current = form.channels ?? ["Email"];
              setForm({ ...form, channels: e.target.checked ? [...current, channel] : current.filter((c: Channel) => c !== channel) });
            }} />} />)}
            <FormControlLabel label="Μόνο χωρίς ενεργή κάλυψη" control={<Switch checked={!!form.onlyUninsuredNeeds} disabled={!form.needKindFilter} onChange={e => setForm({ ...form, onlyUninsuredNeeds: e.target.checked })} />} />
          </Stack>
          <Alert severity="info">Χρησιμοποιήστε μεταβλητές όπως <code>{"{{firstName}}"}</code>, <code>{"{{companyName}}"}</code> και <code>{"{{customerName}}"}</code>. Η αποστολή γίνεται μόνο σε πελάτες με ενεργή συγκατάθεση ανά κανάλι.</Alert>
          <TextField label={t("marketing.bodyHtml")} multiline rows={10} value={form.bodyHtml}
            onChange={e => setForm({ ...form, bodyHtml: e.target.value })} fullWidth
            helperText={t("marketing.bodyHelp")} />
          <TextField label="Κείμενο SMS (προαιρετικό)" multiline rows={3} value={form.smsBody ?? ""} onChange={e => setForm({ ...form, smsBody: e.target.value })} fullWidth helperText="Αν μείνει κενό, χρησιμοποιείται η απλή έκδοση του email." />
          <TextField label="Κείμενο Viber (προαιρετικό)" multiline rows={3} value={form.viberBody ?? ""} onChange={e => setForm({ ...form, viberBody: e.target.value })} fullWidth helperText="Αν μείνει κενό, χρησιμοποιείται το SMS/email κείμενο." />
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
