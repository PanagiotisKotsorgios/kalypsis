import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import FlagIcon from "@mui/icons-material/Flag";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { date } from "../utils/format";

type TaskStatus = "Open" | "InProgress" | "Completed" | "Cancelled";
type TaskPriority = "Low" | "Normal" | "High" | "Urgent";

interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  customerId: string | null;
  customerDisplay: string | null;
  policyId: string | null;
  policyNumber: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface UserLite { id: string; firstName: string; lastName: string }
interface CustomerLite { id: string; customerNumber: string; type: "Individual" | "Company"; firstName?: string; lastName?: string; companyName?: string }

const PRIORITY_COLOR: Record<TaskPriority, "default" | "info" | "warning" | "error"> = {
  Low: "default", Normal: "info", High: "warning", Urgent: "error"
};
const STATUS_COLUMN: TaskStatus[] = ["Open", "InProgress", "Completed", "Cancelled"];

export function TasksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await api.get<TaskDto[]>("/tasks")).data
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const tasks = tasksQuery.data ?? [];
  const byStatus = STATUS_COLUMN.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) }));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("tasks.title")}</Typography>
            <HelpHint id="page.tasks" />
          </Stack>
          <Typography color="text.secondary">{t("tasks.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <DataExportButton entity="tasks" />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateOpen(true); }}>
            {t("tasks.create")}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {tasksQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" } }}>
          {byStatus.map((col) => (
            <Box key={col.status}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Typography sx={{ fontWeight: 800, letterSpacing: 0.5 }}>{t(`tasks.statuses.${col.status}`)}</Typography>
                <Chip label={col.items.length} size="small" />
              </Stack>
              <Stack spacing={1.5}>
                {col.items.length === 0 ? (
                  <Card variant="outlined" sx={{ p: 2, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
                    {t("tasks.empty")}
                  </Card>
                ) : col.items.map((task) => {
                  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "Completed" && task.status !== "Cancelled";
                  return (
                    <Card key={task.id} sx={{
                      borderLeft: "4px solid",
                      borderLeftColor: overdue ? "error.main" : `${PRIORITY_COLOR[task.priority]}.main`,
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Typography fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>{task.title}</Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" onClick={() => setEditing(task)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error"
                              onClick={() => { if (confirm(t("tasks.confirmDelete"))) deleteMutation.mutate(task.id); }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                        {task.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                            {task.description}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={0.75} alignItems="center" mt={1.5} flexWrap="wrap" gap={0.5}>
                          <Chip icon={<FlagIcon />} label={t(`tasks.priorities.${task.priority}`)} size="small" color={PRIORITY_COLOR[task.priority]} />
                          {task.dueAt && (
                            <Chip icon={<EventIcon />} label={date(task.dueAt)} size="small"
                              color={overdue ? "error" : "default"} variant={overdue ? "filled" : "outlined"} />
                          )}
                          {task.assignedToUserName && <Chip label={task.assignedToUserName} size="small" variant="outlined" />}
                          {task.customerDisplay && <Chip label={task.customerDisplay} size="small" variant="outlined" />}
                          {task.policyNumber && <Chip label={task.policyNumber} size="small" variant="outlined" />}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <TaskFormDialog
        open={createOpen} onClose={() => setCreateOpen(false)} task={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setCreateOpen(false); }}
      />
      <TaskFormDialog
        open={!!editing} onClose={() => setEditing(null)} task={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setEditing(null); }}
      />
    </Box>
  );
}

function TaskFormDialog({ open, onClose, task, onSaved }: {
  open: boolean; onClose: () => void; task: TaskDto | null; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!task;

  const usersQuery = useQuery({
    queryKey: ["users-staff"], enabled: open,
    queryFn: async () => (await api.get<UserLite[]>("/users")).data
  });
  const customersQuery = useQuery({
    queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data
  });

  const [form, setForm] = useState({
    title: "", description: "", status: "Open" as TaskStatus, priority: "Normal" as TaskPriority,
    assignedToUserId: "", customerId: "", policyId: "", dueAt: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title, description: task.description ?? "",
        status: task.status, priority: task.priority,
        assignedToUserId: task.assignedToUserId ?? "",
        customerId: task.customerId ?? "",
        policyId: task.policyId ?? "",
        dueAt: task.dueAt ? task.dueAt.slice(0, 16) : ""
      });
    } else if (open) {
      setForm({
        title: "", description: "", status: "Open", priority: "Normal",
        assignedToUserId: "", customerId: "", policyId: "", dueAt: ""
      });
    }
  }, [task, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        description: form.description.trim() || null,
        priority: form.priority,
        assignedToUserId: form.assignedToUserId || null,
        customerId: form.customerId || null,
        policyId: form.policyId || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        ...(editing ? { status: form.status } : {})
      };
      if (editing) return (await api.put(`/tasks/${task!.id}`, body)).data;
      return (await api.post("/tasks", body)).data;
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("tasks.form.editTitle") : t("tasks.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required fullWidth label={t("tasks.form.titleField")} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth multiline rows={3} label={t("tasks.form.description")} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("tasks.form.priority")} value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} fullWidth>
              {(["Low","Normal","High","Urgent"] as const).map(p => <MenuItem key={p} value={p}>{t(`tasks.priorities.${p}`)}</MenuItem>)}
            </TextField>
            {editing && (
              <TextField select label={t("tasks.form.status")} value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} fullWidth>
                {(["Open","InProgress","Completed","Cancelled"] as const).map(s => <MenuItem key={s} value={s}>{t(`tasks.statuses.${s}`)}</MenuItem>)}
              </TextField>
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("tasks.form.assignedTo")}
              value={form.assignedToUserId}
              onChange={(v) => setForm({ ...form, assignedToUserId: v })}
              emptyLabel="—"
              options={(usersQuery.data ?? []).map(u => ({
                value: u.id, label: `${u.firstName} ${u.lastName}`.trim(),
              }))}
            />
            <TextField type="datetime-local" label={t("tasks.form.dueAt")} InputLabelProps={{ shrink: true }}
              value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} fullWidth />
          </Stack>
          <SearchableSelect
            label={t("tasks.form.customer")}
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            emptyLabel="—"
            options={(customersQuery.data ?? []).map(c => ({
              value: c.id,
              label: c.type === "Individual"
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : (c.companyName ?? ""),
              hint: c.customerNumber,
            }))}
          />
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
