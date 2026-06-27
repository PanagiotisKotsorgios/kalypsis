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
import {
  NOTIFICATION_SEVERITY_COLOR,
  NOTIFICATION_SEVERITY_TINT,
  notificationActionTarget,
  notificationCategoryLabel,
  notificationSearchText,
  notificationSeverity
} from "../utils/notificationPresentation";

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

const PAGE_SIZE = 6;

type SeverityFilter = "all" | "success" | "warning" | "error" | "info" | "unread";

const FILTERS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "Όλες" },
  { key: "unread", label: "Μη αναγνωσμένες" },
  { key: "warning", label: "Προσοχή" },
  { key: "error", label: "Σφάλματα" },
  { key: "success", label: "Επιτυχίες" },
  { key: "info", label: "Ενημερώσεις" }
];

function shortDate(value: string) {
  return new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const countQ = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get<UnreadCount>("/notifications/unread-count")).data,
    refetchInterval: 60_000,
    staleTime: 30_000
  });
  const count = countQ.data?.count ?? 0;

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
      if (severity === "unread" && n.isRead) return false;
      if (severity !== "all" && severity !== "unread" && notificationSeverity(n.category) !== severity) return false;
      return !s || notificationSearchText(n).includes(s);
    });
  }, [all, search, severity]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPaging = () => {
    setPage(1);
    setExpandedId(null);
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-bell"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-bell"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const filterCount = (key: SeverityFilter) => key === "all"
    ? all.length
    : key === "unread"
      ? all.filter(n => !n.isRead).length
      : all.filter(n => notificationSeverity(n.category) === key).length;

  return (
    <>
      <IconButton
        ref={anchorRef}
        onClick={() => setOpen(v => !v)}
        title={t("notifications.title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        sx={{ color: "inherit" }}
      >
        <Badge badgeContent={count} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-end"
        transition
        sx={{ zIndex: 1500 }}
        modifiers={[
          { name: "offset", options: { offset: [0, 10] } },
          { name: "preventOverflow", options: { padding: 12 } }
        ]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={180}>
            <Paper
              elevation={0}
              sx={{
                width: { xs: "calc(100vw - 32px)", sm: 470 },
                maxHeight: "calc(100vh - 100px)",
                display: "flex",
                flexDirection: "column",
                border: "1px solid #d9e1ea",
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(11,37,69,0.18), 0 4px 12px rgba(11,37,69,0.06)"
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      p: 2,
                      bgcolor: "#fff",
                      borderBottom: "1px solid #e5e9ef"
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 850, color: "#0b2545" }}>
                        {t("notifications.title")}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#456079" }}>
                        {count > 0 ? t("notifications.subtitle", { count }) : "Όλα ενημερωμένα"}
                      </Typography>
                    </Box>
                    {count > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DoneAllIcon />}
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                        sx={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          borderColor: "#d9e1ea"
                        }}
                      >
                        {t("notifications.markAll")}
                      </Button>
                    )}
                  </Stack>

                  <Box sx={{ p: 1.5, borderBottom: "1px solid #e5e9ef", bgcolor: "#fbfcfe" }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Αναζήτηση σε ειδοποιήσεις…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        resetPaging();
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: 18, color: "#456079" }} />
                          </InputAdornment>
                        )
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 14, bgcolor: "#fff" } }}
                    />

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1.25, gap: 0.5 }}>
                      {FILTERS.map(opt => {
                        const active = severity === opt.key;
                        const color = opt.key === "all" || opt.key === "unread"
                          ? "#0b2545"
                          : NOTIFICATION_SEVERITY_COLOR[opt.key];
                        return (
                          <Chip
                            key={opt.key}
                            size="small"
                            label={`${opt.label} · ${filterCount(opt.key)}`}
                            onClick={() => {
                              setSeverity(opt.key);
                              resetPaging();
                            }}
                            sx={{
                              borderRadius: 1.5,
                              fontSize: 11.5,
                              fontWeight: 750,
                              height: 24,
                              border: "1px solid",
                              borderColor: active ? color : "#d9e1ea",
                              bgcolor: active ? color : "#fff",
                              color: active ? "#fff" : "#0b2545",
                              "&:hover": { bgcolor: active ? color : "rgba(29,78,137,0.06)" }
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>

                  <Box sx={{ overflowY: "auto", flex: 1, minHeight: 220 }}>
                    {listQ.isLoading && (
                      <Box sx={{ p: 3, textAlign: "center", color: "#456079", fontSize: 13 }}>
                        Φόρτωση…
                      </Box>
                    )}

                    {!listQ.isLoading && filtered.length === 0 && (
                      <Box sx={{ p: 4, textAlign: "center", color: "#456079", fontSize: 13 }}>
                        {search || severity !== "all"
                          ? "Δεν βρέθηκαν ειδοποιήσεις με αυτά τα φίλτρα."
                          : t("notifications.empty")}
                      </Box>
                    )}

                    {paged.map((n) => {
                      const sev = notificationSeverity(n.category);
                      const isExpanded = expandedId === n.id;
                      const sevColor = NOTIFICATION_SEVERITY_COLOR[sev];
                      const target = notificationActionTarget(n.link);
                      return (
                        <Box
                          key={n.id}
                          sx={{
                            position: "relative",
                            px: 2,
                            py: 1.5,
                            cursor: "pointer",
                            borderLeft: "4px solid",
                            borderLeftColor: sevColor,
                            borderBottom: "1px solid #eef2f6",
                            bgcolor: n.isRead ? "#fff" : NOTIFICATION_SEVERITY_TINT[sev],
                            "&:hover": { bgcolor: NOTIFICATION_SEVERITY_TINT[sev] }
                          }}
                          onClick={() => {
                            setExpandedId(prev => prev === n.id ? null : n.id);
                            if (!n.isRead) markRead.mutate(n.id);
                          }}
                        >
                          <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                                <Chip
                                  size="small"
                                  label={notificationCategoryLabel(n.category)}
                                  sx={{
                                    height: 20,
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    bgcolor: sevColor,
                                    color: "#fff",
                                    "& .MuiChip-label": { px: 0.9 }
                                  }}
                                />
                                <Typography sx={{ fontSize: 11.5, color: "#456079" }}>
                                  {shortDate(n.createdAt)}
                                </Typography>
                                {!n.isRead && (
                                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: sevColor, ml: 0.5 }} />
                                )}
                              </Stack>

                              <Typography
                                sx={{
                                  fontSize: 14,
                                  fontWeight: n.isRead ? 650 : 850,
                                  color: "#0b2545",
                                  lineHeight: 1.35,
                                  ...(isExpanded ? {} : {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden"
                                  })
                                }}
                              >
                                {n.title}
                              </Typography>

                              <Typography
                                sx={{
                                  fontSize: 12.75,
                                  color: "#456079",
                                  mt: 0.35,
                                  lineHeight: 1.5,
                                  whiteSpace: isExpanded ? "pre-wrap" : "normal",
                                  ...(isExpanded ? {} : {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden"
                                  })
                                }}
                              >
                                {n.body}
                              </Typography>

                              {isExpanded && target && (
                                <Button
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpen(false);
                                    navigate(target);
                                  }}
                                  sx={{ mt: 1, fontSize: 12.5, fontWeight: 800, p: 0 }}
                                >
                                  Άνοιγμα →
                                </Button>
                              )}
                            </Box>

                            {!n.isRead && (
                              <IconButton
                                size="small"
                                title={t("notifications.markRead")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead.mutate(n.id);
                                }}
                                sx={{ color: "#456079" }}
                              >
                                <MarkEmailReadIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>

                  {totalPages > 1 && (
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="center"
                      spacing={1.5}
                      sx={{ p: 1, borderTop: "1px solid #e5e9ef", bgcolor: "#fbfcfe" }}
                    >
                      <IconButton size="small" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeftIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ fontSize: 12.5, color: "#0b2545", fontWeight: 800 }}>
                        {safePage} / {totalPages}
                      </Typography>
                      <IconButton size="small" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}

                  <Divider />
                  <Box sx={{ p: 1, textAlign: "center", bgcolor: "#fff" }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setOpen(false);
                        navigate("/app/notifications");
                      }}
                      sx={{ fontSize: 12.5, fontWeight: 800 }}
                    >
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
