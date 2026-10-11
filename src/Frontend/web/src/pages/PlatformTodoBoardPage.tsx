import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, Checkbox, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputLabel, MenuItem, Popover, Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchIcon from "@mui/icons-material/Search";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type ColumnType = "text" | "date" | "select" | "tags";
interface TodoColumn {
  id: string;
  label: string;
  type: ColumnType;
  width?: number;
  options?: string[];
}
interface TodoRow {
  id: string;
  cells: Record<string, string>;
  colors: Record<string, string>;
}
interface TodoBoard {
  columns: TodoColumn[];
  rows: TodoRow[];
}
interface BoardResponse { board: TodoBoard | null; updatedAt: string | null; }
interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

const STATUS_OPTIONS = ["Προς εκτέλεση", "Σε εξέλιξη", "Ολοκληρώθηκε", "Σε αναμονή"];
const PRIORITY_OPTIONS = ["Χαμηλή", "Κανονική", "Υψηλή", "Επείγον"];
const COLOR_OPTIONS = [
  { value: "", label: "Χωρίς χρώμα", swatch: "#ffffff" },
  { value: "#e9f3ff", label: "Απαλό μπλε", swatch: "#e9f3ff" },
  { value: "#e9f8ef", label: "Απαλό πράσινο", swatch: "#e9f8ef" },
  { value: "#fff8dc", label: "Απαλό κίτρινο", swatch: "#fff8dc" },
  { value: "#fff0f0", label: "Απαλό κόκκινο", swatch: "#fff0f0" },
  { value: "#f3efff", label: "Απαλό μωβ", swatch: "#f3efff" },
  { value: "#eef1f5", label: "Απαλό γκρι", swatch: "#eef1f5" },
];

const defaultColumns = (): TodoColumn[] => [
  { id: "task", label: "Εργασία", type: "text", width: 260 },
  { id: "assignee", label: "Υπεύθυνος", type: "select", width: 190 },
  { id: "status", label: "Κατάσταση", type: "select", options: STATUS_OPTIONS, width: 170 },
  { id: "priority", label: "Προτεραιότητα", type: "select", options: PRIORITY_OPTIONS, width: 145 },
  { id: "dueDate", label: "Προθεσμία", type: "date", width: 150 },
  { id: "tags", label: "Ετικέτες", type: "tags", width: 220 },
  { id: "notes", label: "Σημειώσεις", type: "text", width: 300 },
];

const newRow = (columns: TodoColumn[]): TodoRow => ({
  id: crypto.randomUUID(),
  cells: Object.fromEntries(columns.map(c => [c.id, c.id === "status" ? "Προς εκτέλεση" : c.id === "priority" ? "Κανονική" : ""])),
  colors: {},
});

const emptyBoard = (): TodoBoard => ({ columns: defaultColumns(), rows: [] });

function userName(user: PlatformUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function cellIsOverdue(row: TodoRow) {
  const date = row.cells.dueDate;
  if (!date || row.cells.status === "Ολοκληρώθηκε") return false;
  const due = new Date(`${date}T23:59:59`);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
}

function cellIsDueSoon(row: TodoRow) {
  const date = row.cells.dueDate;
  if (!date || row.cells.status === "Ολοκληρώθηκε") return false;
  const due = new Date(`${date}T23:59:59`);
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  return Number.isFinite(due.getTime()) && due >= new Date() && due <= inSevenDays;
}

/** Private SuperAdmin worksheet. It deliberately lives outside tenant routes. */
export function PlatformTodoBoardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<TodoBoard>(emptyBoard);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Όλα");
  const [assigneeFilter, setAssigneeFilter] = useState("Όλοι");
  const [dueFilter, setDueFilter] = useState("Όλες");
  const [selected, setSelected] = useState<string[]>([]);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [colorCell, setColorCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [columnDialog, setColumnDialog] = useState<{ open: boolean; editingId?: string }>({ open: false });
  const [columnDraft, setColumnDraft] = useState({ label: "", type: "text" as ColumnType, options: "" });
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [confirmDeleteRows, setConfirmDeleteRows] = useState(false);
  const [notice, setNotice] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const boardQuery = useQuery({
    queryKey: ["platform-todo-board"],
    queryFn: async () => (await api.get<BoardResponse>("/platform/todo-board")).data,
    enabled: user?.role === "PlatformAdmin",
  });
  const usersQuery = useQuery({
    queryKey: ["platform-users", "todo-board"],
    queryFn: async () => (await api.get<PlatformUser[]>("/platform/users")).data,
    enabled: user?.role === "PlatformAdmin",
  });
  const saveMutation = useMutation({
    mutationFn: async (next: TodoBoard) => (await api.put<BoardResponse>("/platform/todo-board", { board: next })).data,
    onSuccess: (result) => {
      setDirty(false);
      setNotice({ severity: "success", text: "Ο πίνακας εργασιών αποθηκεύτηκε." });
      queryClient.setQueryData(["platform-todo-board"], result);
    },
    onError: (error) => setNotice({ severity: "error", text: extractErrorMessage(error) || "Δεν ήταν δυνατή η αποθήκευση." }),
  });

  useEffect(() => {
    const loaded = boardQuery.data?.board;
    if (!loaded) return;
    const columns = (loaded.columns ?? []).map(column => ({ ...column, width: column.width ?? 180 }));
    setBoard({ columns: columns.length ? columns : defaultColumns(), rows: loaded.rows ?? [] });
    setDirty(false);
  }, [boardQuery.data]);

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !saveMutation.isPending) saveMutation.mutate(board);
      }
    };
    window.addEventListener("keydown", saveOnShortcut);
    return () => window.removeEventListener("keydown", saveOnShortcut);
  }, [board, dirty, saveMutation]);

  const users = usersQuery.data ?? [];
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("el-GR");
    return board.rows.filter(row => {
      const haystack = Object.values(row.cells).join(" ").toLocaleLowerCase("el-GR");
      if (needle && !haystack.includes(needle)) return false;
      if (statusFilter !== "Όλα" && (row.cells.status || "Προς εκτέλεση") !== statusFilter) return false;
      if (assigneeFilter !== "Όλοι" && row.cells.assignee !== assigneeFilter) return false;
      if (dueFilter === "Εκπρόθεσμες" && !cellIsOverdue(row)) return false;
      if (dueFilter === "Επόμενες 7 ημέρες" && !cellIsDueSoon(row)) return false;
      if (dueFilter === "Χωρίς ημερομηνία" && row.cells.dueDate) return false;
      return true;
    });
  }, [assigneeFilter, board.rows, dueFilter, search, statusFilter]);

  const stats = useMemo(() => ({
    total: board.rows.length,
    completed: board.rows.filter(r => r.cells.status === "Ολοκληρώθηκε").length,
    overdue: board.rows.filter(cellIsOverdue).length,
    soon: board.rows.filter(cellIsDueSoon).length,
  }), [board.rows]);

  if (user?.role !== "PlatformAdmin") return <Navigate to="/app" replace />;
  if (boardQuery.isLoading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 360 }}><CircularProgress /></Box>;
  if (boardQuery.isError) return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση του πίνακα εργασιών.</Alert>;

  const markDirty = (next: TodoBoard) => { setBoard(next); setDirty(true); };
  const updateCell = (rowId: string, columnId: string, value: string) => markDirty({
    ...board,
    rows: board.rows.map(row => row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row),
  });
  const addRow = () => markDirty({ ...board, rows: [...board.rows, newRow(board.columns)] });
  const toggleRow = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const toggleAllVisible = () => {
    const ids = filteredRows.map(row => row.id);
    setSelected(current => ids.every(id => current.includes(id)) ? current.filter(id => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };
  const removeRows = () => {
    markDirty({ ...board, rows: board.rows.filter(row => !selected.includes(row.id)) });
    setSelected([]);
    setConfirmDeleteRows(false);
    setNotice({ severity: "success", text: "Οι επιλεγμένες εργασίες αφαιρέθηκαν από τον πίνακα." });
  };
  const setCellColor = (color: string) => {
    if (!colorCell) return;
    markDirty({ ...board, rows: board.rows.map(row => row.id === colorCell.rowId ? {
      ...row,
      colors: { ...row.colors, [colorCell.columnId]: color || undefined as unknown as string },
    } : row) });
    setColorAnchor(null);
    setColorCell(null);
  };
  const openAddColumn = () => {
    setColumnDraft({ label: "", type: "text", options: "" });
    setColumnDialog({ open: true });
  };
  const openEditColumn = (column: TodoColumn) => {
    setColumnDraft({ label: column.label, type: column.type, options: column.options?.join(", ") ?? "" });
    setColumnDialog({ open: true, editingId: column.id });
  };
  const saveColumn = () => {
    const label = columnDraft.label.trim();
    if (!label) return;
    const options = columnDraft.type === "select" ? columnDraft.options.split(",").map(x => x.trim()).filter(Boolean) : undefined;
    if (columnDialog.editingId) {
      markDirty({ ...board, columns: board.columns.map(column => column.id === columnDialog.editingId ? { ...column, label, type: columnDraft.type, options } : column) });
    } else {
      const id = `custom_${crypto.randomUUID()}`;
      const column: TodoColumn = { id, label, type: columnDraft.type, width: 190, options };
      markDirty({ ...board, columns: [...board.columns, column], rows: board.rows.map(row => ({ ...row, cells: { ...row.cells, [id]: "" } })) });
    }
    setColumnDialog({ open: false });
  };
  const removeColumn = () => {
    if (!deleteColumnId || board.columns.length <= 1) return;
    markDirty({
      columns: board.columns.filter(column => column.id !== deleteColumnId),
      rows: board.rows.map(row => {
        const cells = { ...row.cells }; const colors = { ...row.colors };
        delete cells[deleteColumnId]; delete colors[deleteColumnId];
        return { ...row, cells, colors };
      }),
    });
    setDeleteColumnId(null);
  };
  const resetDraft = () => { markDirty(emptyBoard()); setSelected([]); setSearch(""); setStatusFilter("Όλα"); setAssigneeFilter("Όλοι"); setDueFilter("Όλες"); };

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2} mb={2.5}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: "#e7f2ff", color: "#155aa8", display: "grid", placeItems: "center" }}><TableViewOutlinedIcon /></Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850, color: "#0b2545", letterSpacing: -.4 }}>Πίνακας εργασιών SuperAdmin</Typography>
            <Typography color="text.secondary" sx={{ mt: .35 }}>Προσωπικός δυναμικός πίνακας εργασιών, ημερομηνιών και εκκρεμοτήτων της KALYPSIS.</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void boardQuery.refetch()} disabled={dirty || boardQuery.isFetching}>Ανανέωση</Button>
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => saveMutation.mutate(board)} disabled={!dirty || saveMutation.isPending} sx={{ bgcolor: "#1261a0", fontWeight: 800 }}>{saveMutation.isPending ? "Αποθήκευση…" : "Αποθήκευση"}</Button>
        </Stack>
      </Stack>

      <Card sx={{ p: 1.5, mb: 2, borderRadius: 3, border: "1px solid #d7e6f4", background: "linear-gradient(135deg,#f7fbff 0%,#edf6ff 100%)" }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }}>
          <TextField size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση σε όλες τις εργασίες…" InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: .7, color: "text.secondary" }} /> }} sx={{ minWidth: { lg: 300 }, flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Κατάσταση</InputLabel><Select value={statusFilter} label="Κατάσταση" onChange={e => setStatusFilter(e.target.value)}><MenuItem value="Όλα">Όλες οι καταστάσεις</MenuItem>{STATUS_OPTIONS.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Υπεύθυνος</InputLabel><Select value={assigneeFilter} label="Υπεύθυνος" onChange={e => setAssigneeFilter(e.target.value)}><MenuItem value="Όλοι">Όλοι οι χρήστες</MenuItem>{users.filter(u => u.isActive).map(u => <MenuItem key={u.id} value={u.id}>{userName(u)}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Ημερομηνία</InputLabel><Select value={dueFilter} label="Ημερομηνία" onChange={e => setDueFilter(e.target.value)}><MenuItem value="Όλες">Όλες οι ημερομηνίες</MenuItem><MenuItem value="Εκπρόθεσμες">Εκπρόθεσμες</MenuItem><MenuItem value="Επόμενες 7 ημέρες">Επόμενες 7 ημέρες</MenuItem><MenuItem value="Χωρίς ημερομηνία">Χωρίς ημερομηνία</MenuItem></Select></FormControl>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", lg: "block" } }} />
          <Button variant="outlined" color="inherit" startIcon={<AddIcon />} onClick={addRow} sx={{ whiteSpace: "nowrap", color: "#155aa8", borderColor: "#9fc2e2" }}>Νέα εργασία</Button>
          <Button variant="outlined" color="inherit" startIcon={<ViewColumnOutlinedIcon />} onClick={openAddColumn} sx={{ whiteSpace: "nowrap", color: "#155aa8", borderColor: "#9fc2e2" }}>Νέα στήλη</Button>
          <Tooltip title="Καθαρισμός πρόχειρου και νέα κενή δομή"><Button variant="text" color="inherit" onClick={resetDraft} sx={{ whiteSpace: "nowrap", color: "#64748b" }}>Επαναφορά</Button></Tooltip>
        </Stack>
      </Card>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
        <Metric label="Σύνολο" value={stats.total} icon={<FilterAltOutlinedIcon />} color="#155aa8" />
        <Metric label="Ολοκληρωμένες" value={stats.completed} icon={<CheckCircleOutlineIcon />} color="#198754" />
        <Metric label="Εκπρόθεσμες" value={stats.overdue} icon={<CalendarMonthOutlinedIcon />} color="#c0392b" />
        <Metric label="Επόμενες 7 ημέρες" value={stats.soon} icon={<CalendarMonthOutlinedIcon />} color="#a56a00" />
        {selected.length > 0 && <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDeleteRows(true)} sx={{ ml: "auto", alignSelf: "center" }}>Διαγραφή {selected.length} επιλεγμένων</Button>}
      </Stack>

      <Card sx={{ borderRadius: 3, border: "1px solid #d8e5f1", overflow: "hidden", boxShadow: "0 12px 35px rgba(20,64,103,.08)" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 330px)", minHeight: 330, overflow: "auto", "&::-webkit-scrollbar": { height: 12, width: 12 }, "&::-webkit-scrollbar-thumb": { background: "#93b5d4", borderRadius: 6 }, "&::-webkit-scrollbar-track": { background: "#eef4fa" } }}>
          <Table stickyHeader size="small" sx={{ minWidth: Math.max(980, board.columns.reduce((sum, c) => sum + (c.width ?? 180), 80)) }}>
            <TableHead><TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: "#edf3f8", borderBottom: "2px solid #cbdbea" }}><Checkbox size="small" checked={filteredRows.length > 0 && filteredRows.every(row => selected.includes(row.id))} indeterminate={filteredRows.some(row => selected.includes(row.id)) && !filteredRows.every(row => selected.includes(row.id))} onChange={toggleAllVisible} /></TableCell>
              {board.columns.map(column => <TableCell key={column.id} sx={{ bgcolor: "#edf3f8", borderBottom: "2px solid #cbdbea", minWidth: column.width ?? 180, fontWeight: 850, color: "#243b53", whiteSpace: "nowrap" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={.5}><span>{column.label}</span><span><Tooltip title="Επεξεργασία στήλης"><IconButton size="small" onClick={() => openEditColumn(column)}><EditOutlinedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>{board.columns.length > 1 && <Tooltip title="Διαγραφή στήλης"><IconButton size="small" color="error" onClick={() => setDeleteColumnId(column.id)}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>}</span></Stack>
              </TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.length === 0 ? <TableRow><TableCell colSpan={board.columns.length + 1}><Box sx={{ py: 8, textAlign: "center", color: "text.secondary" }}><ArchiveOutlinedIcon sx={{ fontSize: 42, opacity: .35, mb: 1 }} /><Typography fontWeight={700}>Δεν υπάρχουν εργασίες με αυτά τα φίλτρα.</Typography><Typography variant="body2">Πατήστε «Νέα εργασία» για να δημιουργήσετε την πρώτη γραμμή.</Typography></Box></TableCell></TableRow> : filteredRows.map(row => <TableRow key={row.id} hover selected={selected.includes(row.id)}>
                <TableCell padding="checkbox"><Checkbox size="small" checked={selected.includes(row.id)} onChange={() => toggleRow(row.id)} /></TableCell>
                {board.columns.map(column => <TableCell key={`${row.id}-${column.id}`} sx={{ p: .65, verticalAlign: "top", backgroundColor: row.colors[column.id] || "transparent" }}>
                  <TodoCell column={column} row={row} users={users} onChange={value => updateCell(row.id, column.id, value)} onColorClick={event => { setColorCell({ rowId: row.id, columnId: column.id }); setColorAnchor(event.currentTarget); }} />
                </TableCell>)}
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ px: 2, py: 1.25, bgcolor: "#f8fbfe", borderTop: "1px solid #e3edf6" }}>
          <Typography variant="caption" color="text.secondary">{dirty ? "Υπάρχουν μη αποθηκευμένες αλλαγές." : boardQuery.data?.updatedAt ? `Τελευταία αποθήκευση: ${new Date(boardQuery.data.updatedAt).toLocaleString("el-GR")}` : "Δεν έχει αποθηκευτεί ακόμη πίνακας."}</Typography>
          <Typography variant="caption" color="text.secondary">Ctrl/Cmd + S για γρήγορη αποθήκευση · {filteredRows.length} από {board.rows.length} γραμμές</Typography>
        </Stack>
      </Card>

      <Popover open={Boolean(colorAnchor)} anchorEl={colorAnchor} onClose={() => { setColorAnchor(null); setColorCell(null); }} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <Box sx={{ p: 1.2, width: 205 }}><Typography variant="caption" fontWeight={800} color="text.secondary">Χρώμα κελιού</Typography><Stack spacing={.4} mt={.6}>{COLOR_OPTIONS.map(option => <Button key={option.value || "none"} size="small" onClick={() => setCellColor(option.value)} sx={{ justifyContent: "flex-start", color: "#243b53", textTransform: "none" }}><Box sx={{ width: 18, height: 18, mr: 1, borderRadius: .8, bgcolor: option.swatch, border: "1px solid #cbd5e1" }} />{option.label}</Button>)}</Stack></Box>
      </Popover>

      <Dialog open={columnDialog.open} onClose={() => setColumnDialog({ open: false })} fullWidth maxWidth="xs"><DialogTitle>{columnDialog.editingId ? "Επεξεργασία στήλης" : "Νέα δυναμική στήλη"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField autoFocus label="Όνομα στήλης" value={columnDraft.label} onChange={e => setColumnDraft(d => ({ ...d, label: e.target.value }))} fullWidth /><FormControl fullWidth><InputLabel>Τύπος κελιού</InputLabel><Select value={columnDraft.type} label="Τύπος κελιού" onChange={e => setColumnDraft(d => ({ ...d, type: e.target.value as ColumnType }))}><MenuItem value="text">Κείμενο</MenuItem><MenuItem value="date">Ημερομηνία</MenuItem><MenuItem value="select">Επιλογή από λίστα</MenuItem><MenuItem value="tags">Ετικέτες</MenuItem></Select></FormControl>{columnDraft.type === "select" && <TextField label="Επιλογές" helperText="Χωρίστε τις επιλογές με κόμμα" value={columnDraft.options} onChange={e => setColumnDraft(d => ({ ...d, options: e.target.value }))} fullWidth />}</Stack></DialogContent><DialogActions><Button color="error" onClick={() => setColumnDialog({ open: false })}>Ακύρωση</Button><Button variant="contained" onClick={saveColumn} disabled={!columnDraft.label.trim()}>Αποθήκευση</Button></DialogActions></Dialog>
      <Dialog open={Boolean(deleteColumnId)} onClose={() => setDeleteColumnId(null)}><DialogTitle>Διαγραφή στήλης;</DialogTitle><DialogContent><Typography>Τα δεδομένα της στήλης θα αφαιρεθούν από όλες τις γραμμές του προσωπικού πίνακα.</Typography></DialogContent><DialogActions><Button onClick={() => setDeleteColumnId(null)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={removeColumn}>Διαγραφή</Button></DialogActions></Dialog>
      <Dialog open={confirmDeleteRows} onClose={() => setConfirmDeleteRows(false)}><DialogTitle>Διαγραφή επιλεγμένων εργασιών;</DialogTitle><DialogContent><Typography>Θέλετε να αφαιρέσετε τις {selected.length} επιλεγμένες γραμμές; Η αλλαγή θα εφαρμοστεί μετά την αποθήκευση.</Typography></DialogContent><DialogActions><Button onClick={() => setConfirmDeleteRows(false)}>Ακύρωση</Button><Button color="error" variant="contained" onClick={removeRows}>Διαγραφή</Button></DialogActions></Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={4200} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}><Alert severity={notice?.severity} onClose={() => setNotice(null)}>{notice?.text}</Alert></Snackbar>
    </Box>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return <Card sx={{ minWidth: 150, flex: "1 1 150px", p: 1.25, borderRadius: 2.5, border: "1px solid #e0eaf3", display: "flex", alignItems: "center", gap: 1, boxShadow: "none" }}><Box sx={{ width: 30, height: 30, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: `${color}16`, color }}>{icon}</Box><Box><Typography variant="caption" color="text.secondary" display="block">{label}</Typography><Typography fontWeight={850} color={color}>{value}</Typography></Box></Card>;
}

function TodoCell({ column, row, users, onChange, onColorClick }: { column: TodoColumn; row: TodoRow; users: PlatformUser[]; onChange: (value: string) => void; onColorClick: (event: React.MouseEvent<HTMLElement>) => void }) {
  const value = row.cells[column.id] ?? "";
  const common = { size: "small" as const, variant: "standard" as const, fullWidth: true, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), InputProps: { disableUnderline: true }, sx: { "& .MuiInputBase-input": { fontSize: 13, py: .55, px: .45 } } };
  return <Stack direction="row" alignItems="flex-start" spacing={.25}><Box sx={{ flex: 1, minWidth: 0 }}>
    {column.id === "assignee" ? <FormControl variant="standard" size="small" fullWidth><Select value={value} displayEmpty onChange={event => onChange(event.target.value)} sx={{ fontSize: 13, "&:before, &:after": { display: "none" }, "& .MuiSelect-select": { py: .55, px: .45 } }}><MenuItem value=""><em>Χωρίς ανάθεση</em></MenuItem>{users.filter(u => u.isActive).map(u => <MenuItem key={u.id} value={u.id}>{userName(u)}</MenuItem>)}</Select></FormControl>
      : column.type === "select" ? <FormControl variant="standard" size="small" fullWidth><Select value={value} onChange={event => onChange(event.target.value)} sx={{ fontSize: 13, "&:before, &:after": { display: "none" }, "& .MuiSelect-select": { py: .55, px: .45 } }}>{(column.options ?? []).map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></FormControl>
      : <TextField {...common} type={column.type === "date" ? "date" : "text"} multiline={column.id === "notes"} minRows={column.id === "notes" ? 1 : undefined} placeholder={column.type === "tags" ? "π.χ. επείγον, οικονομικά" : ""} />}
  </Box><Tooltip title="Χρώμα κελιού"><IconButton size="small" onClick={onColorClick} sx={{ mt: .15, color: row.colors[column.id] ? "#155aa8" : "#94a3b8" }}><PaletteOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip></Stack>;
}

