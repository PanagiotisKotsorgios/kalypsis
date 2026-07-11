import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment,
  MenuItem, Popover, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import FlagIcon from "@mui/icons-material/Flag";
import SearchIcon from "@mui/icons-material/Search";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import ViewListIcon from "@mui/icons-material/ViewList";
import TableRowsIcon from "@mui/icons-material/TableRows";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PendingIcon from "@mui/icons-material/Pending";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import PersonIcon from "@mui/icons-material/Person";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { NumberedPager, TableToolbar } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { date, dateTime } from "../utils/format";
import { useAuth } from "../auth/AuthContext";

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
const PRIORITY_RANK: Record<TaskPriority, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const STATUS_COLUMN: TaskStatus[] = ["Open", "InProgress", "Completed", "Cancelled"];
const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  Open:       <PendingIcon fontSize="small" />,
  InProgress: <PlayArrowIcon fontSize="small" />,
  Completed:  <CheckCircleIcon fontSize="small" />,
  Cancelled:  <CancelIcon fontSize="small" />,
};
const STATUS_COLOR: Record<TaskStatus, "default" | "primary" | "success" | "error"> = {
  Open: "default", InProgress: "primary", Completed: "success", Cancelled: "error"
};

type ViewMode = "kanban" | "list" | "table";
type DueBucket = "all" | "overdue" | "today" | "week" | "month" | "none";

interface Filters {
  search: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  assignedToUserId: string;
  customerId: string;
  dueBucket: DueBucket;
  showCompleted: boolean;
}

const EMPTY_FILTERS: Filters = {
  search: "", statuses: [], priorities: [],
  assignedToUserId: "", customerId: "", dueBucket: "all", showCompleted: true,
};

/** LocalStorage-backed state helper — persists across sessions. */
const useLocalState = <T,>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value]);
  return [value, setValue];
};

export function TasksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const storagePrefix = `kalypsis:tasks:${user?.userId ?? "anon"}`;

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await api.get<TaskDto[]>("/tasks")).data
  });
  const usersQuery = useQuery({
    queryKey: ["users-staff"],
    queryFn: async () => (await api.get<UserLite[]>("/users")).data
  });
  const customersQuery = useQuery({
    queryKey: ["customers-lite"],
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data
  });

  const [view, setView] = useLocalState<ViewMode>(`${storagePrefix}:view`, "kanban");
  const [filters, setFilters] = useLocalState<Filters>(`${storagePrefix}:filters`, EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map(id => api.delete(`/tasks/${id}`))),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setSelectedIds(new Set()); },
    onError: (err) => setError(extractErrorMessage(err))
  });
  const quickStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: TaskStatus }) => {
      // The PUT expects the full task shape; grab the fresh one from cache
      // then send it back with the new status. Simpler than a dedicated
      // patch endpoint and works with the existing server contract.
      const cache = (qc.getQueryData<TaskDto[]>(["tasks"]) ?? []);
      return Promise.all(ids.map(async id => {
        const cur = cache.find(x => x.id === id);
        if (!cur) return;
        return api.put(`/tasks/${id}`, {
          title: cur.title,
          description: cur.description,
          priority: cur.priority,
          status,
          assignedToUserId: cur.assignedToUserId,
          customerId: cur.customerId,
          policyId: cur.policyId,
          dueAt: cur.dueAt,
        });
      }));
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setSelectedIds(new Set()); },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const allTasks = tasksQuery.data ?? [];
  const filteredTasks = useMemo(() => filterTasks(allTasks, filters), [allTasks, filters]);
  const kpis = useMemo(() => computeKpis(allTasks), [allTasks]);
  const activeFilterCount = countActiveFilters(filters);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("tasks.title", "Εργασίες")}</Typography>
            <HelpHint id="page.tasks" />
          </Stack>
          <Typography color="text.secondary">
            {t("tasks.subtitle", "Παρακολούθηση των εργασιών του γραφείου — προτεραιότητα, προθεσμίες, ανάθεση.")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <DataExportButton entity="tasks" />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateOpen(true); }}>
            {t("tasks.create", "Νέα εργασία")}
          </Button>
        </Stack>
      </Stack>

      {/* KPI STRIP */}
      <Stack direction="row" spacing={1.5} mb={2.5} flexWrap="wrap" useFlexGap>
        <Kpi label="Ανοιχτές" value={kpis.open + kpis.inProgress} color="#1976d2" icon={<PendingIcon />} />
        <Kpi label="Ληξιπρόθεσμες" value={kpis.overdue} color="#d32f2f" icon={<WarningIcon />} />
        <Kpi label="Σήμερα" value={kpis.today} color="#ed6c02" icon={<EventIcon />} />
        <Kpi label="Αυτή τη βδομάδα" value={kpis.thisWeek} color="#9c27b0" icon={<EventIcon />} />
        <Kpi label="Υψηλή/Επείγον" value={kpis.highPri} color="#e91e63" icon={<FlagIcon />} />
        <Kpi label="Ολοκλ. τον μήνα" value={kpis.completedThisMonth} color="#2e7d32" icon={<CheckCircleIcon />} />
      </Stack>

      {/* FILTERS ROW */}
      <FiltersBar
        filters={filters}
        setFilters={setFilters}
        activeCount={activeFilterCount}
        users={usersQuery.data ?? []}
        customers={customersQuery.data ?? []}
      />

      {/* VIEW TOGGLE + SELECTION BAR */}
      <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="body2" color="text.secondary">
          {filteredTasks.length === allTasks.length
            ? `${filteredTasks.length.toLocaleString("el-GR")} εργασίες`
            : `${filteredTasks.length.toLocaleString("el-GR")} από ${allTasks.length.toLocaleString("el-GR")}`}
        </Typography>
        {selectedIds.size > 0 && (
          <BulkActionsBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onDelete={() => {
              if (confirm(`Διαγραφή ${selectedIds.size} εργασιών;`))
                bulkDelete.mutate(Array.from(selectedIds));
            }}
            onSetStatus={(s) => quickStatus.mutate({ ids: Array.from(selectedIds), status: s })}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="kanban"><ViewKanbanIcon fontSize="small" sx={{ mr: 0.5 }} />Kanban</ToggleButton>
          <ToggleButton value="list"><ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />Λίστα</ToggleButton>
          <ToggleButton value="table"><TableRowsIcon fontSize="small" sx={{ mr: 0.5 }} />Πίνακας</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {tasksQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : filteredTasks.length === 0 && allTasks.length > 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="subtitle1" color="text.secondary" mb={1}>
            Κανένα αποτέλεσμα με τα τρέχοντα φίλτρα.
          </Typography>
          <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)} startIcon={<ClearIcon />}>
            Καθαρισμός φίλτρων
          </Button>
        </Card>
      ) : allTasks.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
          {t("tasks.empty", "Δεν υπάρχουν εργασίες.")}
        </Card>
      ) : view === "kanban" ? (
        <KanbanView
          tasks={filteredTasks}
          onEdit={setEditing}
          onDelete={(id) => { if (confirm(t("tasks.confirmDelete", "Διαγραφή;"))) deleteMutation.mutate(id); }}
          onQuickStatus={(id, status) => quickStatus.mutate({ ids: [id], status })}
        />
      ) : view === "list" ? (
        <ListView
          tasks={filteredTasks}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onEdit={setEditing}
          onDelete={(id) => { if (confirm(t("tasks.confirmDelete", "Διαγραφή;"))) deleteMutation.mutate(id); }}
          onQuickStatus={(id, status) => quickStatus.mutate({ ids: [id], status })}
        />
      ) : (
        <TableView
          tasks={filteredTasks}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onEdit={setEditing}
          onDelete={(id) => { if (confirm(t("tasks.confirmDelete", "Διαγραφή;"))) deleteMutation.mutate(id); }}
        />
      )}

      <TaskFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        task={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setCreateOpen(false); }}
      />
      <TaskFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        task={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tasks"] }); setEditing(null); }}
      />
    </Box>
  );
}

// -----------------------------------------------------------------------------
// KPI cards.
// -----------------------------------------------------------------------------
interface KpiSummary {
  open: number; inProgress: number; overdue: number; today: number; thisWeek: number;
  highPri: number; completedThisMonth: number;
}
function computeKpis(tasks: TaskDto[]): KpiSummary {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7)); // Monday-start
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return tasks.reduce((acc: KpiSummary, t) => {
    if (t.status === "Open") acc.open++;
    if (t.status === "InProgress") acc.inProgress++;
    const active = t.status !== "Completed" && t.status !== "Cancelled";
    if (t.dueAt && active) {
      const due = new Date(t.dueAt);
      if (due < now) acc.overdue++;
      if (due >= startOfToday && due < new Date(startOfToday.getTime() + 24 * 3600e3)) acc.today++;
      if (due >= startOfWeek && due < endOfWeek) acc.thisWeek++;
    }
    if (active && (t.priority === "High" || t.priority === "Urgent")) acc.highPri++;
    if (t.status === "Completed" && t.completedAt && new Date(t.completedAt) >= startOfMonth) acc.completedThisMonth++;
    return acc;
  }, { open: 0, inProgress: 0, overdue: 0, today: 0, thisWeek: 0, highPri: 0, completedThisMonth: 0 });
}

function Kpi({ label, value, color, icon }: { label: string; value: React.ReactNode; color?: string; icon?: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 155, flex: "1 1 155px" }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon && <Avatar sx={{ bgcolor: color ?? "primary.main", width: 30, height: 30 }}>{icon}</Avatar>}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", lineHeight: 1.1 }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: color ?? "text.primary", lineHeight: 1.1 }}>{value}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Filters.
// -----------------------------------------------------------------------------
function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.statuses.length) n++;
  if (f.priorities.length) n++;
  if (f.assignedToUserId) n++;
  if (f.customerId) n++;
  if (f.dueBucket !== "all") n++;
  if (!f.showCompleted) n++;
  return n;
}

function filterTasks(tasks: TaskDto[], f: Filters): TaskDto[] {
  const q = f.search.trim().toLowerCase();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return tasks.filter(t => {
    if (!f.showCompleted && (t.status === "Completed" || t.status === "Cancelled")) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(t.status)) return false;
    if (f.priorities.length > 0 && !f.priorities.includes(t.priority)) return false;
    if (f.assignedToUserId && t.assignedToUserId !== f.assignedToUserId) return false;
    if (f.customerId && t.customerId !== f.customerId) return false;
    if (q) {
      const hay = `${t.title} ${t.description ?? ""} ${t.customerDisplay ?? ""} ${t.policyNumber ?? ""} ${t.assignedToUserName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.dueBucket !== "all") {
      const active = t.status !== "Completed" && t.status !== "Cancelled";
      if (f.dueBucket === "none") { if (t.dueAt) return false; }
      else if (!t.dueAt || !active) return false;
      else {
        const due = new Date(t.dueAt);
        if (f.dueBucket === "overdue" && due >= now) return false;
        if (f.dueBucket === "today"   && (due < startOfToday || due >= new Date(startOfToday.getTime() + 24 * 3600e3))) return false;
        if (f.dueBucket === "week"    && (due < startOfWeek || due >= endOfWeek)) return false;
        if (f.dueBucket === "month"   && (due < startOfMonth || due >= endOfMonth)) return false;
      }
    }
    return true;
  });
}

function FiltersBar({
  filters, setFilters, activeCount, users, customers
}: {
  filters: Filters;
  setFilters: (v: Filters | ((prev: Filters) => Filters)) => void;
  activeCount: number;
  users: UserLite[];
  customers: CustomerLite[];
}) {
  const toggleInArray = <T extends string>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];

  return (
    <Card variant="outlined" sx={{ mb: 2, p: 1.5 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Αναζήτηση σε τίτλο, περιγραφή, πελάτη, συμβόλαιο, ανάθεση…"
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: filters.search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setFilters({ ...filters, search: "" })}><ClearIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ maxWidth: 480 }}
        />
        <SearchableSelect
          label="Ανάτεθηκε σε"
          value={filters.assignedToUserId}
          onChange={(v) => setFilters({ ...filters, assignedToUserId: v })}
          emptyLabel="Όλους"
          options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() }))}
        />
        <SearchableSelect
          label="Πελάτης"
          value={filters.customerId}
          onChange={(v) => setFilters({ ...filters, customerId: v })}
          emptyLabel="Όλοι"
          options={customers.map(c => ({
            value: c.id,
            label: c.type === "Individual"
              ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
              : (c.companyName ?? ""),
            hint: c.customerNumber,
          }))}
        />
        <SearchableTextField
          label="Προθεσμία"
          value={filters.dueBucket}
          onChange={e => setFilters({ ...filters, dueBucket: e.target.value as DueBucket })}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="all">Ανεξάρτητα</MenuItem>
          <MenuItem value="overdue">Ληξιπρόθεσμες</MenuItem>
          <MenuItem value="today">Σήμερα</MenuItem>
          <MenuItem value="week">Αυτή τη βδομάδα</MenuItem>
          <MenuItem value="month">Αυτόν τον μήνα</MenuItem>
          <MenuItem value="none">Χωρίς προθεσμία</MenuItem>
        </SearchableTextField>
        {activeCount > 0 && (
          <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)} startIcon={<ClearIcon fontSize="small" />}>
            Καθαρισμός ({activeCount})
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={1.5} flexWrap="wrap">
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" gap={0.5}>
          <FilterAltIcon fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.5 }}>Κατάσταση:</Typography>
          {STATUS_COLUMN.map(s => {
            const on = filters.statuses.includes(s);
            return (
              <Chip
                key={s}
                size="small"
                icon={STATUS_ICON[s] as React.ReactElement}
                label={statusLabel(s)}
                color={on ? STATUS_COLOR[s] : "default"}
                variant={on ? "filled" : "outlined"}
                onClick={() => setFilters({ ...filters, statuses: toggleInArray(filters.statuses, s) })}
                sx={{ cursor: "pointer" }}
              />
            );
          })}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" gap={0.5}>
          <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.5 }}>Προτεραιότητα:</Typography>
          {(["Urgent", "High", "Normal", "Low"] as TaskPriority[]).map(p => {
            const on = filters.priorities.includes(p);
            return (
              <Chip
                key={p}
                size="small"
                icon={<FlagIcon />}
                label={priorityLabel(p)}
                color={on ? PRIORITY_COLOR[p] : "default"}
                variant={on ? "filled" : "outlined"}
                onClick={() => setFilters({ ...filters, priorities: toggleInArray(filters.priorities, p) })}
                sx={{ cursor: "pointer" }}
              />
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}

function BulkActionsBar({
  count, onClear, onDelete, onSetStatus
}: { count: number; onClear: () => void; onDelete: () => void; onSetStatus: (s: TaskStatus) => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: "primary.main", color: "primary.contrastText", px: 1.5, py: 0.5, borderRadius: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{count} επιλεγμένες</Typography>
      <Button size="small" sx={{ color: "inherit" }} onClick={onClear}>Καθαρισμός</Button>
      <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.3)" }} />
      {STATUS_COLUMN.filter(s => s !== "Cancelled").map(s => (
        <Button
          key={s}
          size="small"
          sx={{ color: "inherit" }}
          onClick={() => onSetStatus(s)}
        >
          → {statusLabel(s)}
        </Button>
      ))}
      <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.3)" }} />
      <Button size="small" color="inherit" onClick={onDelete}>Διαγραφή</Button>
    </Stack>
  );
}

function statusLabel(s: TaskStatus): string {
  return { Open: "Ανοιχτή", InProgress: "Σε εξέλιξη", Completed: "Ολοκληρώθηκε", Cancelled: "Ακυρώθηκε" }[s];
}
function priorityLabel(p: TaskPriority): string {
  return { Low: "Χαμηλή", Normal: "Κανονική", High: "Υψηλή", Urgent: "Επείγον" }[p];
}

// -----------------------------------------------------------------------------
// Kanban view.
// -----------------------------------------------------------------------------
function KanbanView({
  tasks, onEdit, onDelete, onQuickStatus
}: {
  tasks: TaskDto[];
  onEdit: (t: TaskDto) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (id: string, status: TaskStatus) => void;
}) {
  const byStatus = STATUS_COLUMN.map(s => ({ status: s, items: tasks.filter(t => t.status === s) }));
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" } }}>
      {byStatus.map(col => (
        <Box key={col.status}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            {STATUS_ICON[col.status]}
            <Typography sx={{ fontWeight: 800, letterSpacing: 0.5 }}>{statusLabel(col.status)}</Typography>
            <Chip label={col.items.length} size="small" color={STATUS_COLOR[col.status]} />
          </Stack>
          <Stack spacing={1.5}>
            {col.items.length === 0 ? (
              <Card variant="outlined" sx={{ p: 2, textAlign: "center", color: "text.secondary", borderStyle: "dashed", fontSize: 12 }}>
                Άδειο
              </Card>
            ) : col.items.map(task => (
              <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onQuickStatus={onQuickStatus} compact />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function TaskCard({
  task, onEdit, onDelete, onQuickStatus, compact = false
}: {
  task: TaskDto;
  onEdit: (t: TaskDto) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (id: string, status: TaskStatus) => void;
  compact?: boolean;
}) {
  const active = task.status !== "Completed" && task.status !== "Cancelled";
  const overdue = active && task.dueAt && new Date(task.dueAt) < new Date();
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Card sx={{
      borderLeft: "4px solid",
      borderLeftColor: overdue ? "error.main" : `${PRIORITY_COLOR[task.priority]}.main`,
    }}>
      <CardContent sx={{ p: compact ? 1.5 : 2, "&:last-child": { pb: compact ? 1.5 : 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography fontWeight={700} sx={{ flex: 1, minWidth: 0, pr: 1 }}>{task.title}</Typography>
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Αλλαγή κατάστασης">
              <IconButton size="small" onClick={(e) => setStatusMenuAnchor(e.currentTarget)}>
                <UnfoldMoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => onEdit(task)}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => onDelete(task.id)}><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        </Stack>
        {task.description && !compact && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
            {task.description}
          </Typography>
        )}
        <Stack direction="row" spacing={0.5} alignItems="center" mt={1} flexWrap="wrap" gap={0.5}>
          <Chip icon={<FlagIcon />} label={priorityLabel(task.priority)} size="small" color={PRIORITY_COLOR[task.priority]} />
          {task.dueAt && (
            <Chip
              icon={<EventIcon />}
              label={date(task.dueAt)}
              size="small"
              color={overdue ? "error" : "default"}
              variant={overdue ? "filled" : "outlined"}
            />
          )}
          {task.assignedToUserName && (
            <Chip icon={<PersonIcon />} label={task.assignedToUserName} size="small" variant="outlined" />
          )}
          {task.customerDisplay && <Chip label={task.customerDisplay} size="small" variant="outlined" />}
          {task.policyNumber && <Chip label={task.policyNumber} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />}
        </Stack>
      </CardContent>
      <Popover
        open={Boolean(statusMenuAnchor)}
        anchorEl={statusMenuAnchor}
        onClose={() => setStatusMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack sx={{ p: 0.5 }}>
          {STATUS_COLUMN.map(s => (
            <Button
              key={s}
              size="small"
              startIcon={STATUS_ICON[s]}
              disabled={task.status === s}
              onClick={() => { onQuickStatus(task.id, s); setStatusMenuAnchor(null); }}
              sx={{ justifyContent: "flex-start" }}
            >
              {statusLabel(s)}
            </Button>
          ))}
        </Stack>
      </Popover>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// List view (paginated).
// -----------------------------------------------------------------------------
function ListView({
  tasks, selectedIds, setSelectedIds, onEdit, onDelete, onQuickStatus
}: {
  tasks: TaskDto[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onEdit: (t: TaskDto) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (id: string, status: TaskStatus) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<"dueAt" | "priority" | "createdAt">("dueAt");

  const sorted = useMemo(() => {
    const arr = tasks.slice();
    arr.sort((a, b) => {
      if (sortKey === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (sortKey === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      // dueAt: undated last, then ascending; overdue first inside undated set
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    });
    return arr;
  }, [tasks, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allSelected = pageItems.length > 0 && pageItems.every(t => selectedIds.has(t.id));

  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };
  const toggleAll = () => {
    const s = new Set(selectedIds);
    if (allSelected) pageItems.forEach(t => s.delete(t.id));
    else pageItems.forEach(t => s.add(t.id));
    setSelectedIds(s);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <FormControlLabel
          label="Επιλογή όλων στη σελίδα"
          sx={{ mr: 1 }}
          control={<Checkbox size="small" checked={allSelected} indeterminate={!allSelected && pageItems.some(t => selectedIds.has(t.id))} onChange={toggleAll} />}
        />
        <Box sx={{ flex: 1 }} />
        <SearchableTextField label="Ταξινόμηση" value={sortKey} onChange={e => setSortKey(e.target.value as any)} sx={{ width: 180 }}>
          <MenuItem value="dueAt">Προθεσμία</MenuItem>
          <MenuItem value="priority">Προτεραιότητα</MenuItem>
          <MenuItem value="createdAt">Πιο πρόσφατες</MenuItem>
        </SearchableTextField>
        <SearchableTextField label="Ανά σελίδα" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} sx={{ width: 120 }}>
          {[5, 10, 25, 50].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </SearchableTextField>
      </Stack>

      <Stack spacing={1.5}>
        {pageItems.map(task => (
          <Box key={task.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Checkbox size="small" checked={selectedIds.has(task.id)} onChange={() => toggle(task.id)} sx={{ mt: 1 }} />
            <Box sx={{ flex: 1 }}>
              <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onQuickStatus={onQuickStatus} />
            </Box>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
        <NumberedPager page={safePage} totalPages={totalPages} onPage={setPage} />
      </Box>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Table view (uses TableToolbar for print + export column picker + pager).
// -----------------------------------------------------------------------------
function TableView({
  tasks, selectedIds, setSelectedIds, onEdit, onDelete
}: {
  tasks: TaskDto[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onEdit: (t: TaskDto) => void;
  onDelete: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<keyof TaskDto | null>("dueAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [innerSearch, setInnerSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  // Right-click on a header opens sort A→Z / Z→A + Hide column.
  // Right-click on a body row opens Επεξεργασία / Διαγραφή.
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => { setSortKey(key as keyof TaskDto); setSortDir(dir); },
    onHide: (key) => { const s = new Set(hiddenCols); s.add(key); setHiddenCols(s); },
  });
  const rowMenu = useRowContextMenu<TaskDto>({
    entityLabel: "εργασίας",
    onEdit,
    onDelete: (t) => { if (confirm("Διαγραφή εργασίας;")) onDelete(t.id); },
  });

  const openHeader = (e: React.MouseEvent, key: string, label: string, type: ColumnType) =>
    headerMenu.open(e, { key, label, type, canHide: true });

  const searchable = (t: TaskDto) =>
    `${t.title} ${t.description ?? ""} ${t.customerDisplay ?? ""} ${t.policyNumber ?? ""} ${t.assignedToUserName ?? ""}`;

  const filtered = useMemo(() => {
    const q = innerSearch.trim().toLowerCase();
    const arr = q ? tasks.filter(t => searchable(t).toLowerCase().includes(q)) : tasks.slice();
    if (sortKey) {
      arr.sort((a, b) => {
        if (sortKey === "priority") {
          const cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          return sortDir === "asc" ? cmp : -cmp;
        }
        const va = (a[sortKey] as any) ?? "";
        const vb = (b[sortKey] as any) ?? "";
        const cmp = String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return arr;
  }, [tasks, innerSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allSelected = pageItems.length > 0 && pageItems.every(t => selectedIds.has(t.id));

  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };
  const toggleAll = () => {
    const s = new Set(selectedIds);
    if (allSelected) pageItems.forEach(t => s.delete(t.id));
    else pageItems.forEach(t => s.add(t.id));
    setSelectedIds(s);
  };
  const toggleSort = (k: keyof TaskDto) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const sortIcon = (k: keyof TaskDto) =>
    sortKey !== k ? <UnfoldMoreIcon fontSize="inherit" sx={{ opacity: 0.4, ml: 0.25, verticalAlign: "middle" }} />
    : sortDir === "asc" ? <KeyboardArrowUpIcon fontSize="inherit" sx={{ ml: 0.25, verticalAlign: "middle" }} />
    : <KeyboardArrowDownIcon fontSize="inherit" sx={{ ml: 0.25, verticalAlign: "middle" }} />;

  return (
    <Box>
      <TableToolbar<TaskDto>
        query={innerSearch}
        onQuery={s => { setInnerSearch(s); setPage(1); }}
        count={tasks.length}
        filteredCount={filtered.length}
        pageSize={pageSize}
        onPageSize={n => { setPageSize(n); setPage(1); }}
        exportRows={filtered}
        exportFileName={`tasks-${new Date().toISOString().slice(0, 10)}`}
        serverEntity="tasks"
        printTitle="Εργασίες"
        exportColumns={[
          { key: "title", label: "Τίτλος" },
          { key: "status", label: "Κατάσταση", map: (t) => statusLabel(t.status) },
          { key: "priority", label: "Προτεραιότητα", map: (t) => priorityLabel(t.priority) },
          { key: "assignedToUserName", label: "Ανάθεση" },
          { key: "customerDisplay", label: "Πελάτης" },
          { key: "policyNumber", label: "Συμβόλαιο" },
          { key: "dueAt", label: "Προθεσμία", map: (t) => t.dueAt ? dateTime(t.dueAt) : "" },
          { key: "completedAt", label: "Ολοκληρώθηκε", map: (t) => t.completedAt ? dateTime(t.completedAt) : "" },
          { key: "createdAt", label: "Δημιουργήθηκε", map: (t) => t.createdAt ? dateTime(t.createdAt) : "" },
        ]}
      />

      {hiddenCols.size > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 1 }}
          action={<Button size="small" onClick={() => setHiddenCols(new Set())}>Επαναφορά</Button>}
        >
          Απόκρυψη {hiddenCols.size} στήλης/-ων μέσω δεξιού κλικ.
        </Alert>
      )}

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && pageItems.some(t => selectedIds.has(t.id))} onChange={toggleAll} />
              </TableCell>
              {!hiddenCols.has("title") && (
                <TableCell
                  onClick={() => toggleSort("title")}
                  onContextMenu={(e) => openHeader(e, "title", "Τίτλος", "string")}
                  sx={{ cursor: "pointer", fontWeight: 700 }}
                >
                  Τίτλος{sortIcon("title")}
                </TableCell>
              )}
              {!hiddenCols.has("status") && (
                <TableCell
                  onClick={() => toggleSort("status")}
                  onContextMenu={(e) => openHeader(e, "status", "Κατάσταση", "string")}
                  sx={{ cursor: "pointer", fontWeight: 700 }}
                >
                  Κατάσταση{sortIcon("status")}
                </TableCell>
              )}
              {!hiddenCols.has("priority") && (
                <TableCell
                  onClick={() => toggleSort("priority")}
                  onContextMenu={(e) => openHeader(e, "priority", "Προτεραιότητα", "string")}
                  sx={{ cursor: "pointer", fontWeight: 700 }}
                >
                  Προτ.{sortIcon("priority")}
                </TableCell>
              )}
              {!hiddenCols.has("dueAt") && (
                <TableCell
                  onClick={() => toggleSort("dueAt")}
                  onContextMenu={(e) => openHeader(e, "dueAt", "Προθεσμία", "date")}
                  sx={{ cursor: "pointer", fontWeight: 700 }}
                >
                  Προθεσμία{sortIcon("dueAt")}
                </TableCell>
              )}
              {!hiddenCols.has("assignedToUserName") && (
                <TableCell
                  onClick={() => toggleSort("assignedToUserName")}
                  onContextMenu={(e) => openHeader(e, "assignedToUserName", "Ανάθεση", "string")}
                  sx={{ cursor: "pointer", fontWeight: 700 }}
                >
                  Ανάθεση{sortIcon("assignedToUserName")}
                </TableCell>
              )}
              {!hiddenCols.has("customerDisplay") && (
                <TableCell onContextMenu={(e) => openHeader(e, "customerDisplay", "Πελάτης", "string")}>Πελάτης</TableCell>
              )}
              {!hiddenCols.has("policyNumber") && (
                <TableCell onContextMenu={(e) => openHeader(e, "policyNumber", "Συμβόλαιο", "string")}>Συμβόλαιο</TableCell>
              )}
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={9 - hiddenCols.size} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  Κανένα αποτέλεσμα.
                </TableCell>
              </TableRow>
            )}
            {pageItems.map(t => {
              const active = t.status !== "Completed" && t.status !== "Cancelled";
              const overdue = active && t.dueAt && new Date(t.dueAt) < new Date();
              return (
                <TableRow
                  key={t.id}
                  hover
                  selected={selectedIds.has(t.id)}
                  onContextMenu={(e) => rowMenu.open(e, t)}
                  sx={overdue ? { bgcolor: "rgba(211, 47, 47, 0.05)" } : undefined}
                >
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={selectedIds.has(t.id)} onChange={() => toggle(t.id)} />
                  </TableCell>
                  {!hiddenCols.has("title") && <TableCell sx={{ fontWeight: 600 }}>{t.title}</TableCell>}
                  {!hiddenCols.has("status") && (
                    <TableCell>
                      <Chip size="small" icon={STATUS_ICON[t.status] as React.ReactElement} color={STATUS_COLOR[t.status]} label={statusLabel(t.status)} />
                    </TableCell>
                  )}
                  {!hiddenCols.has("priority") && (
                    <TableCell>
                      <Chip size="small" icon={<FlagIcon />} color={PRIORITY_COLOR[t.priority]} label={priorityLabel(t.priority)} />
                    </TableCell>
                  )}
                  {!hiddenCols.has("dueAt") && (
                    <TableCell>
                      {t.dueAt ? (
                        <Chip
                          size="small" icon={<EventIcon />} label={date(t.dueAt)}
                          color={overdue ? "error" : "default"} variant={overdue ? "filled" : "outlined"}
                        />
                      ) : "—"}
                    </TableCell>
                  )}
                  {!hiddenCols.has("assignedToUserName") && <TableCell>{t.assignedToUserName ?? "—"}</TableCell>}
                  {!hiddenCols.has("customerDisplay") && <TableCell>{t.customerDisplay ?? "—"}</TableCell>}
                  {!hiddenCols.has("policyNumber") && <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{t.policyNumber ?? "—"}</TableCell>}
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => onEdit(t)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => onDelete(t.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {headerMenu.menu}
      {rowMenu.menu}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
        <NumberedPager page={safePage} totalPages={totalPages} onPage={setPage} />
      </Box>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Form dialog (create/edit).
// -----------------------------------------------------------------------------
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
      <DialogTitle>{editing ? t("tasks.form.editTitle", "Επεξεργασία εργασίας") : t("tasks.form.createTitle", "Νέα εργασία")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required fullWidth label={t("tasks.form.titleField", "Τίτλος")} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth multiline rows={3} label={t("tasks.form.description", "Περιγραφή")} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label={t("tasks.form.priority", "Προτεραιότητα")} value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} fullWidth>
              {(["Low", "Normal", "High", "Urgent"] as const).map(p => (
                <MenuItem key={p} value={p}>{priorityLabel(p)}</MenuItem>
              ))}
            </SearchableTextField>
            {editing && (
              <SearchableTextField label={t("tasks.form.status", "Κατάσταση")} value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} fullWidth>
                {(["Open", "InProgress", "Completed", "Cancelled"] as const).map(s => (
                  <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>
                ))}
              </SearchableTextField>
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("tasks.form.assignedTo", "Ανάτεθηκε σε")}
              value={form.assignedToUserId}
              onChange={(v) => setForm({ ...form, assignedToUserId: v })}
              emptyLabel="—"
              options={(usersQuery.data ?? []).map(u => ({
                value: u.id, label: `${u.firstName} ${u.lastName}`.trim(),
              }))}
            />
            <TextField type="datetime-local" label={t("tasks.form.dueAt", "Προθεσμία")} InputLabelProps={{ shrink: true }}
              value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} fullWidth />
          </Stack>
          <SearchableSelect
            label={t("tasks.form.customer", "Πελάτης")}
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
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

