import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

type Status = "Scheduled" | "Done" | "Cancelled";
interface AppointmentDto {
  id: string; title: string; description: string | null; location: string | null;
  startsAt: string; endsAt: string; status: Status;
  assignedToUserId: string | null; assignedToUserName: string | null;
  customerId: string | null; customerName: string | null;
  policyId: string | null; policyNumber: string | null;
}
interface UserLite { id: string; firstName: string; lastName: string }
interface CustomerLite { id: string; type: "Individual" | "Company"; firstName?: string; lastName?: string; companyName?: string }

const STATUS_COLOR: Record<Status, "default" | "info" | "success" | "error"> = { Scheduled: "info", Done: "success", Cancelled: "error" };

export function AppointmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentDto | null>(null);

  const q = useQuery({ queryKey: ["appointments"], queryFn: async () => (await api.get<AppointmentDto[]>("/appointments")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["appointments"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const items = q.data ?? [];
  const grouped = items.reduce((acc, a) => {
    const day = new Date(a.startsAt).toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
    (acc[day] ??= []).push(a);
    return acc;
  }, {} as Record<string, AppointmentDto[]>);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("appointments.title")}</Typography>
          <Typography color="text.secondary">{t("appointments.subtitle")}</Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("appointments.create")}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
          {t("appointments.empty")}
        </Card>
      ) : (
        <Stack spacing={3}>
          {Object.entries(grouped).map(([day, list]) => (
            <Box key={day}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>{day}</Typography>
              <Stack spacing={1.5} mt={1}>
                {list.map((a) => (
                  <Card key={a.id}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
                            <EventIcon fontSize="small" color="action" />
                            <Typography fontWeight={700}>{a.title}</Typography>
                            <Chip label={t(`appointments.status.${a.status}`)} size="small" color={STATUS_COLOR[a.status]} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(a.startsAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {new Date(a.endsAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                            {a.location && <> · {a.location}</>}
                          </Typography>
                          {a.description && <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{a.description}</Typography>}
                          <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" gap={0.5}>
                            {a.assignedToUserName && <Chip label={a.assignedToUserName} size="small" variant="outlined" />}
                            {a.customerName && <Chip label={a.customerName} size="small" variant="outlined" />}
                            {a.policyNumber && <Chip label={a.policyNumber} size="small" variant="outlined" />}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => setEditing(a)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(a.id); }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["appointments"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["appointments"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: AppointmentDto | null; onSaved: () => void; }) {
  const { t } = useTranslation();
  const editing = !!item;

  const usersQ = useQuery({ queryKey: ["users-staff"], enabled: open, queryFn: async () => (await api.get<UserLite[]>("/users")).data });
  const custsQ = useQuery({ queryKey: ["customers-lite"], enabled: open, queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data });

  const [form, setForm] = useState({
    title: "", description: "", location: "",
    startsAt: "", endsAt: "", status: "Scheduled" as Status,
    assignedToUserId: "", customerId: "", policyId: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title, description: item.description ?? "", location: item.location ?? "",
        startsAt: item.startsAt.slice(0, 16), endsAt: item.endsAt.slice(0, 16),
        status: item.status, assignedToUserId: item.assignedToUserId ?? "",
        customerId: item.customerId ?? "", policyId: item.policyId ?? ""
      });
    } else if (open) {
      const now = new Date();
      const plusHour = new Date(now.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setForm({
        title: "", description: "", location: "",
        startsAt: fmt(now), endsAt: fmt(plusHour),
        status: "Scheduled", assignedToUserId: "", customerId: "", policyId: ""
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        location: form.location || null,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        status: form.status,
        assignedToUserId: form.assignedToUserId || null,
        customerId: form.customerId || null,
        policyId: form.policyId || null
      };
      if (editing) return (await api.put(`/appointments/${item!.id}`, body)).data;
      return (await api.post("/appointments", body)).data;
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("appointments.editTitle") : t("appointments.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("appointments.titleField")} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth />
          <TextField label={t("appointments.location")} value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="datetime-local" label={t("appointments.startsAt")} InputLabelProps={{ shrink: true }}
              value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} fullWidth />
            <TextField type="datetime-local" label={t("appointments.endsAt")} InputLabelProps={{ shrink: true }}
              value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("appointments.status_")} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {(["Scheduled","Done","Cancelled"] as const).map(s => <MenuItem key={s} value={s}>{t(`appointments.status.${s}`)}</MenuItem>)}
            </TextField>
            <TextField select label={t("appointments.assignedTo")} value={form.assignedToUserId}
              onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {(usersQ.data ?? []).map(u => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField select label={t("appointments.customer")} value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })} fullWidth>
            <MenuItem value="">—</MenuItem>
            {(custsQ.data ?? []).map(c => (
              <MenuItem key={c.id} value={c.id}>
                {c.type === "Individual" ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.companyName}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t("appointments.notes")} multiline rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
