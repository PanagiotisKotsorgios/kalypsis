import { useMemo, useState } from "react";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from "@mui/material";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";
import {
  notificationActionTarget,
  notificationCategoryLabel,
  notificationSearchText,
  notificationSeverity
} from "../utils/notificationPresentation";

interface NotificationDto {
  id: string;
  title: string;
  body: string;
  category: string | null;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "unread" | "read";
type PeriodFilter = "all" | "today" | "7d" | "30d";
type SortOrder = "newest" | "oldest";
const PAGE_SIZE = 20;

const NAVY = "#0b2545";
const TEXT_MUTED = "#456079";
const BORDER = "#d9e1ea";
const NOTIFICATION_TONES = {
  success: { color: "#147a46", soft: "#e3f4ea" },
  warning: { color: "#494197", soft: "#e9e8fb" },
  error: { color: "#b42318", soft: "#fde7e5" },
  info: { color: "#1d4e89", soft: "#e5effb" }
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function matchesPeriod(createdAt: string, period: PeriodFilter) {
  if (period === "all") return true;
  const date = new Date(createdAt);
  const now = new Date();
  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showInlineFilters = useMediaQuery("(min-width:1500px)");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["notifications-bell"] });
    void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<NotificationDto[]>("/notifications")).data
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      setMessage("Όλες οι ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες.");
      invalidate();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: (_, id) => {
      setMessage("Η ειδοποίηση διαγράφηκε.");
      setSelectedIds(current => current.filter(value => value !== id));
      invalidate();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const deleteRead = useMutation({
    mutationFn: async () => api.delete<{ count: number }>("/notifications/read"),
    onSuccess: (res) => {
      setMessage(`Διαγράφηκαν ${res.data.count} αναγνωσμένες ειδοποιήσεις.`);
      setPage(1);
      invalidate();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const markSelectedRead = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map(id => api.post(`/notifications/${id}/read`))),
    onSuccess: (_, ids) => {
      setMessage(`${ids.length} ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες.`);
      setSelectedIds([]);
      invalidate();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const deleteSelected = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map(id => api.delete(`/notifications/${id}`))),
    onSuccess: (_, ids) => {
      setMessage(`Διαγράφηκαν ${ids.length} ειδοποιήσεις.`);
      setSelectedIds([]);
      invalidate();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const rows = listQuery.data ?? [];
  const unreadCount = rows.filter((n) => !n.isRead).length;
  const readCount = rows.length - unreadCount;

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of rows) {
      const raw = (n.category ?? "").trim();
      if (!raw) continue;
      map.set(raw, notificationCategoryLabel(raw));
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "el"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((n) => {
        if (status === "unread" && n.isRead) return false;
        if (status === "read" && !n.isRead) return false;
        if (category !== "all" && (n.category ?? "") !== category) return false;
        if (!matchesPeriod(n.createdAt, period)) return false;
        return !q || notificationSearchText(n).includes(q);
      })
      .sort((a, b) => {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return sort === "newest" ? diff : -diff;
      });
  }, [rows, search, status, category, period, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageIds = pageRows.map(row => row.id);
  const selectedSet = new Set(selectedIds);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedSet.has(id));
  const somePageSelected = pageIds.some(id => selectedSet.has(id));
  const togglePage = () => setSelectedIds(current => allPageSelected
    ? current.filter(id => !pageIds.includes(id))
    : [...new Set([...current, ...pageIds])]);
  const toggleOne = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const resetPage = () => setPage(1);
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setPeriod("all");
    setSort("newest");
    resetPage();
  };

  const activeFilterCount = [search.trim(), status !== "all", category !== "all", period !== "all", sort !== "newest"]
    .filter(Boolean).length;

  const filterFields = (stacked = false) => <Stack direction={stacked ? "column" : "row"} spacing={1} alignItems="stretch" sx={{ width: "100%" }}>
    <TextField size="small" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder="Αναζήτηση…"
      sx={{ flex: 1, minWidth: stacked ? 0 : 220 }}
      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: TEXT_MUTED }} /></InputAdornment>, endAdornment: <FilterHelp title="Αναζήτηση σε τίτλο, κείμενο ή τύπο ειδοποίησης." /> }} />
    <FilterFieldWrap tip="Φιλτράρετε τις ειδοποιήσεις ανά κατάσταση: όλες, μη αναγνωσμένες ή αναγνωσμένες.">
      <SearchableTextField select size="small" label="Κατάσταση" value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); resetPage(); }} sx={{ minWidth: stacked ? 0 : 160, width: "100%" }}>
        <MenuItem value="all">Όλες</MenuItem><MenuItem value="unread">Μη αναγνωσμένες</MenuItem><MenuItem value="read">Αναγνωσμένες</MenuItem>
      </SearchableTextField>
    </FilterFieldWrap>
    <FilterFieldWrap tip="Φιλτράρετε ανά τύπο ειδοποίησης.">
      <SearchableTextField select size="small" label="Τύπος" value={category} onChange={(e) => { setCategory(e.target.value); resetPage(); }} sx={{ minWidth: stacked ? 0 : 180, width: "100%" }}>
        <MenuItem value="all">Όλοι οι τύποι</MenuItem>{categories.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
      </SearchableTextField>
    </FilterFieldWrap>
    <FilterFieldWrap tip="Χρονικό παράθυρο εμφάνισης.">
      <SearchableTextField select size="small" label="Περίοδος" value={period} onChange={(e) => { setPeriod(e.target.value as PeriodFilter); resetPage(); }} sx={{ minWidth: stacked ? 0 : 145, width: "100%" }}>
        <MenuItem value="all">Όλες</MenuItem><MenuItem value="today">Σήμερα</MenuItem><MenuItem value="7d">Τελευταίες 7 ημέρες</MenuItem><MenuItem value="30d">Τελευταίες 30 ημέρες</MenuItem>
      </SearchableTextField>
    </FilterFieldWrap>
    <FilterFieldWrap tip="Σειρά εμφάνισης.">
      <SearchableTextField select size="small" label="Σειρά" value={sort} onChange={(e) => { setSort(e.target.value as SortOrder); resetPage(); }} sx={{ minWidth: stacked ? 0 : 145, width: "100%" }}>
        <MenuItem value="newest">Νεότερες πρώτα</MenuItem><MenuItem value="oldest">Παλαιότερες πρώτα</MenuItem>
      </SearchableTextField>
    </FilterFieldWrap>
  </Stack>;

  return (
    <Box>
      <Card
        sx={{
          mb: 1.25,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
          bgcolor: "background.paper",
          color: NAVY,
          boxShadow: "0 10px 30px rgba(11,37,69,0.06)"
        }}
      >
        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(30,167,225,0.10)",
                  color: "secondary.main",
                  border: "1px solid rgba(30,167,225,0.22)"
                }}
              >
                <NotificationsIcon />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -0.4 }}>
                  {t("notifications.title")}
                </Typography>
                <Typography color="text.secondary">
                  {unreadCount > 0 ? t("notifications.subtitle", { count: unreadCount }) : "Όλες οι ειδοποιήσεις είναι ενημερωμένες."}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
              <Button
                startIcon={<DoneAllIcon />}
                variant="outlined"
                onClick={() => markAll.mutate()}
                disabled={unreadCount === 0 || markAll.isPending}
                sx={{ fontWeight: 800 }}
              >
                {t("notifications.markAll")}
              </Button>
              <Button
                startIcon={<ClearAllIcon />}
                variant="outlined"
                onClick={() => {
                  if (window.confirm("Να διαγραφούν όλες οι αναγνωσμένες ειδοποιήσεις;")) deleteRead.mutate();
                }}
                disabled={readCount === 0 || deleteRead.isPending}
                sx={{ fontWeight: 800 }}
              >
                Διαγραφή αναγνωσμένων
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Card sx={{ mb: 1.25, border: `1px solid ${BORDER}`, boxShadow: "0 8px 22px rgba(11,37,69,0.05)" }}>
        <CardContent sx={{ px: 1.5, py: 1.25 }}>
          {showInlineFilters ? filterFields() : <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" startIcon={<FilterAltOutlinedIcon />} onClick={() => setFiltersOpen(true)} sx={{
              bgcolor: "#159b59", color: "#fff", fontWeight: 850, px: 2,
              "&:hover": { bgcolor: "#117f49", color: "#fff" }
            }}>
              Φίλτρα{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          </Stack>}

          {(search || status !== "all" || category !== "all" || period !== "all") && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Ενεργά φίλτρα · {filtered.length} αποτελέσματα
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  resetFilters();
                }}
               color="error" variant="contained">Καθαρισμός φίλτρων</Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3, bgcolor: "#edf3f9" } }}>
        <DialogTitle sx={{ color: NAVY, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          Φίλτρα ειδοποιήσεων
          <IconButton onClick={() => setFiltersOpen(false)} aria-label="Κλείσιμο φίλτρων" size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2, bgcolor: "#f8fafc" }}>{filterFields(true)}</DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button color="error" variant="contained" onClick={resetFilters}>Καθαρισμός</Button>
          <Button variant="contained" onClick={() => setFiltersOpen(false)} sx={{ bgcolor: "#159b59", color: "#fff", fontWeight: 850, "&:hover": { bgcolor: "#117f49" } }}>Εφαρμογή</Button>
        </DialogActions>
      </Dialog>

      {listQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card sx={{ border: `1px solid ${BORDER}` }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <NotificationsIcon sx={{ fontSize: 44, color: TEXT_MUTED, mb: 1 }} />
            <Typography color="text.secondary">{t("notifications.empty")}</Typography>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card sx={{ border: `1px solid ${BORDER}` }}>
          <CardContent sx={{ textAlign: "center", py: 8 }}>
            <Typography sx={{ fontWeight: 800, color: NAVY, mb: 0.5 }}>Δεν βρέθηκαν ειδοποιήσεις</Typography>
            <Typography color="text.secondary">Αλλάξτε ή καθαρίστε τα φίλτρα για να δείτε περισσότερα αποτελέσματα.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ border: `1px solid ${BORDER}`, bgcolor: "#f8fafc", boxShadow: "0 10px 28px rgba(11,37,69,0.07)", overflow: "hidden" }}>
          {selectedIds.length > 0 && <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
            sx={{ px: 1.5, py: 1, bgcolor: "#e3effc", borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ color: NAVY, fontWeight: 850, fontSize: 13 }}>{selectedIds.length} επιλεγμένες ειδοποιήσεις</Typography>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" variant="contained" startIcon={<MarkEmailReadIcon />} disabled={markSelectedRead.isPending}
                onClick={() => markSelectedRead.mutate(selectedIds)} sx={{ bgcolor: "#159b59", color: "#fff", fontWeight: 850, "&:hover": { bgcolor: "#117f49" } }}>
                Σήμανση ως αναγνωσμένες
              </Button>
              <Button size="small" color="error" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={deleteSelected.isPending}
                onClick={() => { if (window.confirm(`Να διαγραφούν οι ${selectedIds.length} επιλεγμένες ειδοποιήσεις;`)) deleteSelected.mutate(selectedIds); }} sx={{ fontWeight: 850 }}>
                Διαγραφή
              </Button>
            </Stack>
          </Stack>}
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 880, tableLayout: "fixed" }} aria-label="Πίνακας ειδοποιήσεων">
              <TableHead>
                <TableRow sx={{ bgcolor: "#12395f" }}>
                  <TableCell padding="checkbox" sx={{ width: 44, py: 0.4 }}>
                    <Checkbox size="small" checked={allPageSelected} indeterminate={!allPageSelected && somePageSelected} onChange={togglePage}
                      inputProps={{ "aria-label": "Επιλογή όλων των ειδοποιήσεων της σελίδας" }} sx={{ color: "#fff", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "#fff" } }} />
                  </TableCell>
                  <TableCell sx={{ width: "42%", color: "#fff", fontWeight: 850, py: 1.1 }}>Ειδοποίηση</TableCell>
                  <TableCell sx={{ width: "17%", color: "#fff", fontWeight: 850 }}>Κατηγορία</TableCell>
                  <TableCell sx={{ width: "16%", color: "#fff", fontWeight: 850 }}>Ημερομηνία</TableCell>
                  <TableCell sx={{ width: "12%", color: "#fff", fontWeight: 850 }}>Κατάσταση</TableCell>
                  <TableCell align="right" sx={{ width: "13%", color: "#fff", fontWeight: 850 }}>Ενέργειες</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((n, index) => {
                  const sev = notificationSeverity(n.category);
                  const tone = NOTIFICATION_TONES[sev];
                  const color = tone.color;
                  const target = notificationActionTarget(n.link);
                  return (
                    <TableRow key={n.id} hover sx={{
                      bgcolor: n.isRead ? (index % 2 === 0 ? "#f8fafc" : "#eef2f6") : "#e7f1fc",
                      borderLeft: `4px solid ${n.isRead ? "#b9c9da" : "#087ceb"}`,
                      "&:hover": { bgcolor: "#dceafb" },
                      "& td": { borderColor: "#dce5ef", py: 0.85, px: 1.25, verticalAlign: "middle" }
                    }}>
                      <TableCell padding="checkbox" sx={{ pl: "8px !important", pr: "4px !important" }}>
                        <Checkbox size="small" checked={selectedSet.has(n.id)} onChange={() => toggleOne(n.id)} inputProps={{ "aria-label": `Επιλογή ειδοποίησης ${n.title}` }} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: NAVY, fontSize: 13.25, fontWeight: n.isRead ? 750 : 900, lineHeight: 1.3 }} noWrap title={n.title}>
                          {n.title}
                        </Typography>
                        <Typography sx={{ color: TEXT_MUTED, fontSize: 11.75, lineHeight: 1.35, mt: 0.25 }} noWrap title={n.body}>
                          {n.body}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={notificationCategoryLabel(n.category)} sx={{
                          maxWidth: "100%", height: 24, bgcolor: tone.soft, color,
                          border: `1px solid ${color}42`, fontWeight: 850, fontSize: 10.5,
                          "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" }
                        }} />
                      </TableCell>
                      <TableCell sx={{ color: TEXT_MUTED, fontSize: 11.75, whiteSpace: "nowrap" }}>{formatDate(n.createdAt)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={n.isRead ? "Αναγνωσμένη" : "Νέα"} sx={{
                          height: 23, fontWeight: 850, fontSize: 10.5,
                          bgcolor: n.isRead ? "#e7edf4" : "#087ceb", color: n.isRead ? "#49637f" : "#fff"
                        }} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {target && <Tooltip title="Άνοιγμα">
                            <IconButton component={RouterLink} to={target} size="small" onClick={() => !n.isRead && markRead.mutate(n.id)} sx={{ width: 30, height: 30, bgcolor: "#e1effd", color: "#075fae", "&:hover": { bgcolor: "#cbe3fb" } }}>
                              <OpenInNewIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>}
                          {!n.isRead && <Tooltip title={t("notifications.markRead")}>
                            <IconButton size="small" onClick={() => markRead.mutate(n.id)} disabled={markRead.isPending} sx={{ width: 30, height: 30, bgcolor: "#e3f4ea", color: "#147a46", "&:hover": { bgcolor: "#ccebd9" } }}>
                              <MarkEmailReadIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>}
                          <Tooltip title="Διαγραφή ειδοποίησης">
                            <IconButton size="small" onClick={() => { if (window.confirm("Να διαγραφεί αυτή η ειδοποίηση;")) deleteOne.mutate(n.id); }} disabled={deleteOne.isPending}
                              sx={{ width: 30, height: 30, bgcolor: "#fde7e5", color: "#b42318", "&:hover": { bgcolor: "#f8cfcb" } }}>
                              <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.25}
            sx={{ px: 1.5, py: 1.15, borderTop: `1px solid ${BORDER}`, bgcolor: "#edf3f9" }}>
            <Typography variant="body2" sx={{ color: TEXT_MUTED, fontWeight: 650 }}>
              Εμφάνιση {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} από {filtered.length}
            </Typography>
            <Pagination count={totalPages} page={safePage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" showFirstButton showLastButton size="small" />
          </Stack>
        </Card>
      )}
    </Box>
  );
}
