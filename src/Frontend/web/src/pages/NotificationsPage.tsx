import { useMemo, useState } from "react";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";
import {
  NOTIFICATION_SEVERITY_COLOR,
  NOTIFICATION_SEVERITY_TINT,
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

const NAVY = "#0b2545";
const TEXT_MUTED = "#456079";
const BORDER = "#d9e1ea";

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
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    onSuccess: () => {
      setMessage("Η ειδοποίηση διαγράφηκε.");
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = () => setPage(1);

  return (
    <Box>
      <Card
        sx={{
          mb: 2.5,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
          bgcolor: "background.paper",
          color: NAVY,
          boxShadow: "0 10px 30px rgba(11,37,69,0.06)"
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
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

          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2.25 }}>
            <Chip label={`Σύνολο · ${rows.length}`} sx={{ bgcolor: "rgba(11,37,69,0.06)", color: NAVY, fontWeight: 800 }} />
            <Chip label={`Μη αναγνωσμένες · ${unreadCount}`} sx={{ bgcolor: "rgba(30,167,225,0.10)", color: NAVY, fontWeight: 800 }} />
            <Chip label={`Αναγνωσμένες · ${readCount}`} sx={{ bgcolor: "rgba(11,37,69,0.04)", color: TEXT_MUTED, fontWeight: 800 }} />
          </Stack>
        </CardContent>
      </Card>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}

      <Card sx={{ mb: 2, border: `1px solid ${BORDER}`, boxShadow: "0 10px 30px rgba(11,37,69,0.06)" }}>
        <CardContent sx={{ px: 1.5, py: 1.25 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} alignItems={{ xs: "stretch", lg: "center" }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Αναζήτηση…"
              sx={{ flex: 1, minWidth: 220 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: TEXT_MUTED }} /></InputAdornment>,
                endAdornment: <FilterHelp title="Αναζήτηση σε τίτλο, κείμενο ή τύπο ειδοποίησης." />
              }}
            />
            <FilterFieldWrap tip="Φιλτράρετε τις ειδοποιήσεις ανά κατάσταση: όλες, μη αναγνωσμένες ή αναγνωσμένες.">
              <SearchableTextField select size="small" label="Κατάσταση" value={status}
                onChange={(e) => { setStatus(e.target.value as StatusFilter); resetPage(); }}
                sx={{ minWidth: 160, width: "100%" }}>
                <MenuItem value="all">Όλες</MenuItem>
                <MenuItem value="unread">Μη αναγνωσμένες</MenuItem>
                <MenuItem value="read">Αναγνωσμένες</MenuItem>
              </SearchableTextField>
            </FilterFieldWrap>
            <FilterFieldWrap tip="Φιλτράρετε ανά τύπο ειδοποίησης (Ανανέωση, Ζημιά, Πληρωμή κ.λπ.).">
              <SearchableTextField select size="small" label="Τύπος" value={category}
                onChange={(e) => { setCategory(e.target.value); resetPage(); }}
                sx={{ minWidth: 180, width: "100%" }}>
                <MenuItem value="all">Όλοι οι τύποι</MenuItem>
                {categories.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </SearchableTextField>
            </FilterFieldWrap>
            <FilterFieldWrap tip="Χρονικό παράθυρο εμφάνισης: σήμερα, τελευταίες 7 ή 30 ημέρες.">
              <SearchableTextField select size="small" label="Περίοδος" value={period}
                onChange={(e) => { setPeriod(e.target.value as PeriodFilter); resetPage(); }}
                sx={{ minWidth: 140, width: "100%" }}>
                <MenuItem value="all">Όλες</MenuItem>
                <MenuItem value="today">Σήμερα</MenuItem>
                <MenuItem value="7d">Τελευταίες 7 ημέρες</MenuItem>
                <MenuItem value="30d">Τελευταίες 30 ημέρες</MenuItem>
              </SearchableTextField>
            </FilterFieldWrap>
            <FilterFieldWrap tip="Σειρά εμφάνισης: πρώτα οι νεότερες ή πρώτα οι παλαιότερες.">
              <SearchableTextField select size="small" label="Σειρά" value={sort}
                onChange={(e) => { setSort(e.target.value as SortOrder); resetPage(); }}
                sx={{ minWidth: 135, width: "100%" }}>
                <MenuItem value="newest">Νεότερες πρώτα</MenuItem>
                <MenuItem value="oldest">Παλαιότερες πρώτα</MenuItem>
              </SearchableTextField>
            </FilterFieldWrap>
            <FilterFieldWrap tip="Πόσες ειδοποιήσεις εμφανίζονται ανά σελίδα.">
              <SearchableTextField select size="small" label="Ανά σελίδα" value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
                sx={{ minWidth: 120, width: "100%" }}>
                {[10, 20, 50].map(size => <MenuItem key={size} value={size}>{size}</MenuItem>)}
              </SearchableTextField>
            </FilterFieldWrap>
          </Stack>

          {(search || status !== "all" || category !== "all" || period !== "all") && (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Ενεργά φίλτρα · {filtered.length} αποτελέσματα
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setCategory("all");
                  setPeriod("all");
                  setSort("newest");
                  resetPage();
                }}
              >
                Καθαρισμός φίλτρων
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

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
        <Stack spacing={1.25}>
          {pageRows.map((n) => {
            const sev = notificationSeverity(n.category);
            const color = NOTIFICATION_SEVERITY_COLOR[sev];
            const target = notificationActionTarget(n.link);
            return (
              <Card
                key={n.id}
                sx={{
                  border: `1px solid ${n.isRead ? BORDER : color}`,
                  borderLeft: "5px solid",
                  borderLeftColor: color,
                  bgcolor: n.isRead ? "background.paper" : NOTIFICATION_SEVERITY_TINT[sev],
                  boxShadow: n.isRead ? "0 8px 22px rgba(11,37,69,0.05)" : "0 14px 34px rgba(11,37,69,0.10)",
                  transition: "transform 120ms ease, box-shadow 120ms ease",
                  "&:hover": { transform: "translateY(-1px)", boxShadow: "0 16px 38px rgba(11,37,69,0.12)" }
                }}
              >
                <CardContent sx={{ p: { xs: 1.75, md: 2.25 } }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "flex-start" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                        <Chip
                          size="small"
                          label={notificationCategoryLabel(n.category)}
                          sx={{
                            bgcolor: color,
                            color: "#fff",
                            fontWeight: 850,
                            letterSpacing: 0.1
                          }}
                        />
                        <Typography variant="caption" sx={{ color: TEXT_MUTED, fontWeight: 650 }}>
                          {formatDate(n.createdAt)}
                        </Typography>
                        <Chip
                          size="small"
                          variant={n.isRead ? "outlined" : "filled"}
                          label={n.isRead ? "Αναγνωσμένη" : "Νέα"}
                          sx={{
                            height: 22,
                            fontWeight: 800,
                            bgcolor: n.isRead ? "transparent" : NAVY,
                            color: n.isRead ? TEXT_MUTED : "#fff",
                            borderColor: n.isRead ? BORDER : NAVY
                          }}
                        />
                      </Stack>

                      <Typography sx={{ fontWeight: n.isRead ? 750 : 900, color: NAVY, mb: 0.55, fontSize: 17 }}>
                        {n.title}
                      </Typography>
                      <Typography sx={{ color: TEXT_MUTED, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                        {n.body}
                      </Typography>
                    </Box>

                    <Stack direction={{ xs: "row", md: "column" }} spacing={0.75} alignItems={{ xs: "center", md: "flex-end" }} justifyContent="flex-start">
                      {target && (
                        <Button
                          component={RouterLink}
                          to={target}
                          size="small"
                          variant="contained"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => !n.isRead && markRead.mutate(n.id)}
                          sx={{ fontWeight: 850, bgcolor: NAVY, "&:hover": { bgcolor: "#061a36" } }}
                        >
                          Άνοιγμα
                        </Button>
                      )}
                      {!n.isRead && (
                        <Tooltip title={t("notifications.markRead")}>
                          <IconButton
                            size="small"
                            onClick={() => markRead.mutate(n.id)}
                            disabled={markRead.isPending}
                            sx={{ color: NAVY, border: `1px solid ${BORDER}` }}
                          >
                            <MarkEmailReadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Διαγραφή ειδοποίησης">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm("Να διαγραφεί αυτή η ειδοποίηση;")) deleteOne.mutate(n.id);
                          }}
                          disabled={deleteOne.isPending}
                          sx={{ border: `1px solid ${BORDER}`, bgcolor: "#fff" }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          <Card sx={{ border: `1px solid ${BORDER}`, boxShadow: "none" }}>
            <CardContent sx={{ py: 1.5 }}>
              <Stack direction={{ xs: "column", md: "row" }} alignItems="center" justifyContent="space-between" gap={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Εμφάνιση {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} από {filtered.length}
                </Typography>
                <Pagination
                  count={totalPages}
                  page={safePage}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
