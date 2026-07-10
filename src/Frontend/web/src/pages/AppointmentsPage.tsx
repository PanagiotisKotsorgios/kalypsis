import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import ViewListIcon from "@mui/icons-material/ViewList";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { AppointmentsCalendar, type CalendarEvent } from "../components/AppointmentsCalendar";

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

// Lightweight task shape — only the fields the calendar cares about.
// Full task management still lives on the Tasks page; the appointments
// calendar just overlays them as blue dots so operators can see the
// day's full workload at a glance.
type TaskStatusLite = "Open" | "InProgress" | "Completed" | "Cancelled";
interface TaskLite {
  id: string;
  title: string;
  status: TaskStatusLite;
  dueAt: string | null;
  assignedToUserName: string | null;
  customerDisplay: string | null;
  policyNumber: string | null;
  description: string | null;
}

const STATUS_COLOR: Record<Status, "default" | "info" | "success" | "error"> = { Scheduled: "info", Done: "success", Cancelled: "error" };
const TASK_STATUS_COLOR: Record<TaskStatusLite, "default" | "primary" | "success" | "error"> = {
  Open: "primary", InProgress: "primary", Completed: "success", Cancelled: "error",
};

type ViewMode = "list" | "calendar";
const VIEW_STORAGE_KEY = "kalypsis:appointments:view";

export function AppointmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppointmentDto | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      return saved === "list" || saved === "calendar" ? saved : "calendar";
    } catch { return "calendar"; }
  });

  const q = useQuery({ queryKey: ["appointments"], queryFn: async () => (await api.get<AppointmentDto[]>("/appointments")).data });
  // Tasks are only fetched when the calendar is up — the list view never
  // rendered them and shouldn't pay the network hit.
  const tasksQ = useQuery({
    queryKey: ["appointments-calendar-tasks"],
    enabled: view === "calendar",
    queryFn: async () => (await api.get<TaskLite[]>("/tasks")).data,
  });
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

  // Map the two entity types into the calendar's shared event shape. Doing
  // this once here keeps the calendar component decoupled from our DTOs.
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const appts: CalendarEvent[] = items.map(a => ({
      id: `appt:${a.id}`,
      bucket: "appointment",
      title: a.title,
      at: a.startsAt,
      until: a.endsAt,
      meta: [a.assignedToUserName, a.customerName, a.policyNumber].filter(Boolean).join(" · ") || undefined,
      detail: [a.location ? `📍 ${a.location}` : null, a.description].filter(Boolean).join("\n") || undefined,
      statusLabel: t(`appointments.status.${a.status}`, a.status) as string,
      statusColor: STATUS_COLOR[a.status],
    }));
    const tasks: CalendarEvent[] = (tasksQ.data ?? [])
      .filter(t => !!t.dueAt)
      .map(tk => ({
        id: `task:${tk.id}`,
        bucket: "task",
        title: tk.title,
        at: tk.dueAt!,
        meta: [tk.assignedToUserName, tk.customerDisplay, tk.policyNumber].filter(Boolean).join(" · ") || undefined,
        detail: tk.description ?? undefined,
        statusLabel: t(`tasks.statuses.${tk.status}`, tk.status) as string,
        statusColor: TASK_STATUS_COLOR[tk.status],
      }));
    return [...appts, ...tasks];
  }, [items, tasksQ.data, t]);

  const persistView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* quota */ }
  };

  const openCreateForDay = (dayIso: string) => {
    setCreatePrefillDate(dayIso);
    setCreateOpen(true);
  };

  const openEventEdit = (e: CalendarEvent) => {
    if (e.bucket !== "appointment") return; // tasks stay on the Tasks page
    const raw = items.find(a => `appt:${a.id}` === e.id);
    if (raw) setEditing(raw);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("appointments.title")}</Typography>
            <HelpHint id="page.appointments" />
          </Stack>
          <Typography color="text.secondary">{t("appointments.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, next) => next && persistView(next)}
            aria-label={String(t("appointments.viewMode", "Προβολή"))}
          >
            <ToggleButton value="calendar" aria-label="calendar" sx={{ px: 1.5 }}>
              <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5 }} />
              {t("appointments.viewCalendar", "Ημερολόγιο")}
            </ToggleButton>
            <ToggleButton value="list" aria-label="list" sx={{ px: 1.5 }}>
              <ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />
              {t("appointments.viewList", "Λίστα")}
            </ToggleButton>
          </ToggleButtonGroup>
          <DataExportButton entity="appointments" />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setCreatePrefillDate(null); setCreateOpen(true); }}>
            {t("appointments.create")}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {view === "calendar" ? (
        q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : (
          <AppointmentsCalendar
            events={calendarEvents}
            onCreateForDay={openCreateForDay}
            onEventClick={openEventEdit}
          />
        )
      ) : q.isLoading ? (
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

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null} prefillDate={createPrefillDate}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["appointments"] }); setCreateOpen(false); setCreatePrefillDate(null); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing} prefillDate={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["appointments"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, prefillDate, onSaved }: { open: boolean; onClose: () => void; item: AppointmentDto | null; prefillDate?: string | null; onSaved: () => void; }) {
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
      // If the user clicked a day in the calendar, honor that date and set
      // the start to 09:00 local — most agencies book from morning first.
      const now = new Date();
      const base = prefillDate
        ? (() => { const d = new Date(`${prefillDate}T09:00:00`); return Number.isNaN(d.getTime()) ? now : d; })()
        : now;
      const plusHour = new Date(base.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setForm({
        title: "", description: "", location: "",
        startsAt: fmt(base), endsAt: fmt(plusHour),
        status: "Scheduled", assignedToUserId: "", customerId: "", policyId: ""
      });
    }
  }, [item, open, prefillDate]);

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
            <SearchableTextField label={t("appointments.status_")} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {(["Scheduled","Done","Cancelled"] as const).map(s => <MenuItem key={s} value={s}>{t(`appointments.status.${s}`)}</MenuItem>)}
            </SearchableTextField>
            <SearchableSelect
              label={t("appointments.assignedTo")}
              value={form.assignedToUserId}
              onChange={(v) => setForm({ ...form, assignedToUserId: v })}
              emptyLabel="—"
              options={(usersQ.data ?? []).map(u => ({
                value: u.id, label: `${u.firstName} ${u.lastName}`.trim(),
              }))}
            />
          </Stack>
          <SearchableSelect
            label={t("appointments.customer")}
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            emptyLabel="—"
            options={(custsQ.data ?? []).map(c => ({
              value: c.id,
              label: c.type === "Individual"
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : (c.companyName ?? ""),
            }))}
          />
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
