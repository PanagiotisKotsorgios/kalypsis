import { useMemo, useRef, useState } from "react";
import {
  Badge, Box, Button, Chip, ClickAwayListener, Divider, Fade, IconButton,
  InputAdornment, Paper, Popper, Stack, TextField, Typography
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

interface UnreadCount { count: number }
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

/** Map a category to one of three traffic-light buckets. */
function severityOf(cat: string | null): "success" | "warning" | "error" | "info" {
  const c = (cat ?? "").toLowerCase();
  if (/(error|fail|cancel|expir|overdue|reject|critical|crit)/.test(c)) return "error";
  if (/(warn|caution|attention|pending|due|review)/.test(c))            return "warning";
  if (/(success|paid|approved|done|complete|resolved|ok)/.test(c))      return "success";
  return "info";
}
const SEV_BG: Record<string, string> = {
  success: "#16a34a", warning: "#d97706", error: "#dc2626", info: "#1f7bb3"
};
const SEV_TINT: Record<string, string> = {
  success: "rgba(22,163,74,0.08)",
  warning: "rgba(217,119,6,0.08)",
  error:   "rgba(220,38,38,0.08)",
  info:    "rgba(31,123,179,0.06)"
};

const PAGE_SIZE = 6;

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"all" | "success" | "warning" | "error" | "info" | "unread">("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Unread badge (lightweight) — always running.
  const countQ = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get<UnreadCount>("/notifications/unread-count")).data,
    refetchInterval: 60_000,
    staleTime: 30_000
  });
  const count = countQ.data?.count ?? 0;

  // Full list — only fetched while the popover is open to avoid a fixed payload.
  const listQ = useQuery({
    queryKey: ["notifications-bell"],
    queryFn: async () => (await api.get<NotificationDto[]>("/notifications")).data,
    enabled: open,
    staleTime: 30_000
  });
  const all = listQ.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter(n => {
      if (severity === "unread") { if (n.isRead) return false; }
      else if (severity !== "all" && severityOf(n.category) !== severity) return false;
      if (s) {
        const hay = `${n.title} ${n.body} ${n.category ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [all, search, severity]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset paging when filter/search changes
  const resetPaging = () => { setPage(1); setExpandedId(null); };

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-bell"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });
  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-bell"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  // Counts per severity for the filter chips.
  const sevCount = (s: typeof severity) => s === "all" ? all.length
    : s === "unread" ? all.filter(n => !n.isRead).length
    : all.filter(n => severityOf(n.category) === s).length;

  return (
    <>
      <IconButton
        ref={anchorRef}
        onClick={() => setOpen(v => !v)}
        title={t("notifications.title")}
        aria-haspopup="dialog" aria-expanded={open}
        sx={{ color: "inherit" }}
      >
        <Badge badgeContent={count} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popper open={open} anchorEl={anchorRef.current}
        placement="bottom-end" transition
        sx={{ zIndex: 1500 }}
        modifiers={[
          { name: "offset", options: { offset: [0, 10] } },
          { name: "preventOverflow", options: { padding: 12 } }
        ]}>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={180}>
            <Paper elevation={0} sx={{
              width: { xs: "calc(100vw - 32px)", sm: 460 },
              maxHeight: "calc(100vh - 100px)",
              display: "flex", flexDirection: "column",
              border: "1px solid #e5e9ef", borderRadius: 2,
              boxShadow: "0 24px 60px rgba(11,37,69,0.18), 0 4px 12px rgba(11,37,69,0.06)"
            }}>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  {/* Header */}
                  <Stack direction="row" alignItems="center" justifyContent="space-between"
                    sx={{ p: 2, borderBottom: "1px solid #e5e9ef" }}>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#0b2545" }}>
                        {t("notifications.title")}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#3d4f6b" }}>
                        {count > 0
                          ? t("notifications.subtitle", { count })
                          : "Όλα ενημερωμένα"}
                      </Typography>
                    </Box>
                    {count > 0 && (
                      <Button size="small" startIcon={<DoneAllIcon />}
                        onClick={() => markAll.mutate()} disabled={markAll.isPending}
                        sx={{ fontSize: 12.5, textTransform: "none", fontWeight: 700 }}>
                        {t("notifications.markAll")}
                      </Button>
                    )}
                  </Stack>

                  {/* Search */}
                  <Box sx={{ p: 1.5, borderBottom: "1px solid #e5e9ef" }}>
                    <TextField size="small" fullWidth
                      placeholder="Αναζήτηση σε ειδοποιήσεις…"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: "#3d4f6b" }} />
                        </InputAdornment>
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: 14 }
                      }} />

                    {/* Severity filter chips */}
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1.25, gap: 0.5 }}>
                      {([
                        { k: "all",     l: "Όλα" },
                        { k: "unread",  l: "Μη αναγνωσμένες" },
                        { k: "success", l: "Επιτυχία" },
                        { k: "warning", l: "Προσοχή" },
                        { k: "error",   l: "Σφάλματα" },
                        { k: "info",    l: "Πληροφορίες" }
                      ] as const).map(opt => {
                        const active = severity === opt.k;
                        const sevColor = opt.k === "all" || opt.k === "unread"
                          ? "#0b2545"
                          : SEV_BG[opt.k];
                        return (
                          <Chip key={opt.k} size="small" label={`${opt.l} · ${sevCount(opt.k)}`}
                            onClick={() => { setSeverity(opt.k); resetPaging(); }}
                            sx={{
                              borderRadius: 1.5, fontSize: 11.5, fontWeight: 700,
                              height: 24, px: 0.5,
                              border: "1px solid", borderColor: active ? sevColor : "#e5e9ef",
                              bgcolor: active ? sevColor : "#fff",
                              color: active ? "#fff" : "#0b2545",
                              "&:hover": { bgcolor: active ? sevColor : "rgba(31,123,179,0.06)" }
                            }} />
                        );
                      })}
                    </Stack>
                  </Box>

                  {/* List */}
                  <Box sx={{ overflowY: "auto", flex: 1, minHeight: 220 }}>
                    {listQ.isLoading && (
                      <Box sx={{ p: 3, textAlign: "center", color: "#3d4f6b", fontSize: 13 }}>
                        Φόρτωση…
                      </Box>
                    )}
                    {!listQ.isLoading && filtered.length === 0 && (
                      <Box sx={{ p: 4, textAlign: "center", color: "#3d4f6b", fontSize: 13 }}>
                        {search || severity !== "all"
                          ? "Δεν βρέθηκαν ειδοποιήσεις με αυτά τα φίλτρα."
                          : t("notifications.empty")}
                      </Box>
                    )}
                    {paged.map((n) => {
                      const sev = severityOf(n.category);
                      const isExpanded = expandedId === n.id;
                      return (
                        <Box key={n.id}
                          sx={{
                            position: "relative",
                            px: 2, py: 1.5,
                            cursor: "pointer",
                            borderLeft: "3px solid", borderLeftColor: SEV_BG[sev],
                            borderBottom: "1px solid #f1f4f8",
                            bgcolor: n.isRead ? "#fff" : SEV_TINT[sev],
                            "&:hover": { bgcolor: SEV_TINT[sev] }
                          }}
                          onClick={() => {
                            setExpandedId(prev => prev === n.id ? null : n.id);
                            if (!n.isRead) markRead.mutate(n.id);
                          }}>
                          <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                                {n.category && (
                                  <Chip size="small" label={n.category}
                                    sx={{
                                      height: 18, fontSize: 10, fontWeight: 700,
                                      bgcolor: SEV_BG[sev], color: "#fff",
                                      "& .MuiChip-label": { px: 0.85 }
                                    }} />
                                )}
                                <Typography sx={{ fontSize: 11, color: "#3d4f6b" }}>
                                  {new Date(n.createdAt).toLocaleString("el-GR", {
                                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                  })}
                                </Typography>
                                {!n.isRead && (
                                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: SEV_BG[sev], ml: 0.5 }} />
                                )}
                              </Stack>
                              <Typography sx={{
                                fontSize: 14, fontWeight: n.isRead ? 600 : 800,
                                color: "#0b2545",
                                lineHeight: 1.3,
                                ...(isExpanded ? {} : {
                                  display: "-webkit-box",
                                  WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                                  overflow: "hidden"
                                })
                              }}>
                                {n.title}
                              </Typography>
                              <Typography sx={{
                                fontSize: 12.5, color: "#3d4f6b",
                                mt: 0.25,
                                lineHeight: 1.5,
                                whiteSpace: isExpanded ? "pre-wrap" : "normal",
                                ...(isExpanded ? {} : {
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                  overflow: "hidden"
                                })
                              }}>
                                {n.body}
                              </Typography>
                              {isExpanded && n.link && (
                                <Button size="small"
                                  onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(n.link!); }}
                                  sx={{ mt: 1, fontSize: 12.5, textTransform: "none", fontWeight: 700, p: 0 }}>
                                  Άνοιγμα →
                                </Button>
                              )}
                            </Box>
                            {!n.isRead && (
                              <IconButton size="small" title={t("notifications.markRead")}
                                onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                                sx={{ color: "#3d4f6b" }}>
                                <MarkEmailReadIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Pager */}
                  {totalPages > 1 && (
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5}
                      sx={{ p: 1, borderTop: "1px solid #e5e9ef" }}>
                      <IconButton size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeftIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ fontSize: 12.5, color: "#0b2545", fontWeight: 700 }}>
                        {page} / {totalPages}
                      </Typography>
                      <IconButton size="small" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}

                  <Divider />
                  <Box sx={{ p: 1, textAlign: "center" }}>
                    <Button size="small" onClick={() => { setOpen(false); navigate("/app/notifications"); }}
                      sx={{ fontSize: 12.5, textTransform: "none", fontWeight: 700 }}>
                      Εμφάνιση όλων →
                    </Button>
                  </Box>
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
}
