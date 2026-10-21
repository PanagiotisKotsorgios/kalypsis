import { useMemo, useRef, useState } from "react";
import {
  Badge, Box, Button, Chip, ClickAwayListener, Divider, Fade, IconButton,
  InputAdornment, MenuItem, Paper, Popper, Stack, TextField, Typography
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
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

const PAGE_SIZE = 7;

type SeverityFilter = "all" | "success" | "warning" | "error" | "info" | "unread";

const FILTERS: { key: SeverityFilter; label: string }[] = [
  { key: "all", label: "Όλες" },
  { key: "unread", label: "Μη αναγνωσμένες" },
  { key: "warning", label: "Προσοχή" },
  { key: "error", label: "Σφάλματα" },
  { key: "success", label: "Επιτυχίες" },
  { key: "info", label: "Ενημερώσεις" }
];

const FILTER_TONES: Record<SeverityFilter, { soft: string; text: string; active: string }> = {
  all: { soft: "#e6f0fb", text: "#0b4f8a", active: "#0b3a6e" },
  unread: { soft: "#dcecff", text: "#075fae", active: "#087ceb" },
  warning: { soft: "#fff0cf", text: "#8a5800", active: "#9a6200" },
  error: { soft: "#fde7e5", text: "#a52820", active: "#b42318" },
  success: { soft: "#e3f4ea", text: "#126d40", active: "#147a46" },
  info: { soft: "#e5effb", text: "#174f88", active: "#1d4e89" }
};

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
  const [category, setCategory] = useState("");
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
  const categoryOptions = useMemo(() => [...new Set(all.map(n => n.category?.trim()).filter((value): value is string => !!value))]
    .sort((a, b) => notificationCategoryLabel(a).localeCompare(notificationCategoryLabel(b), "el")), [all]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter(n => {
      if (severity === "unread" && n.isRead) return false;
      if (severity !== "all" && severity !== "unread" && notificationSeverity(n.category) !== severity) return false;
      if (category && n.category !== category) return false;
      return !s || notificationSearchText(n).includes(s);
    });
  }, [all, search, severity, category]);

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
                width: { xs: "calc(100vw - 20px)", sm: 560, md: 610 },
                maxHeight: "calc(100vh - 100px)",
                display: "flex",
                flexDirection: "column",
                border: "1px solid #d5e0ec",
                borderRadius: 3.5,
                overflow: "hidden",
                bgcolor: "#f8fbff",
                boxShadow: "0 26px 68px rgba(11,37,69,0.22), 0 5px 14px rgba(11,37,69,0.07)"
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      p: { xs: 1.25, sm: 1.5 },
                      gap: 1,
                      bgcolor: "#fff",
                      borderBottom: "1px solid #dfe7f0"
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: 1.75,
                        display: "grid", placeItems: "center", flexShrink: 0,
                        bgcolor: "#e3efff", color: "#0b5cad",
                      }}>
                        <NotificationsIcon sx={{ fontSize: 23 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: { xs: 17, sm: 19 }, fontWeight: 900, color: "#081b3a", lineHeight: 1.15 }}>
                          {t("notifications.title")}
                        </Typography>
                        <Typography sx={{ fontSize: 11.75, color: "#60728b", mt: 0.15 }}>
                          {count > 0 ? `${count} μη αναγνωσμένες` : "Όλα ενημερωμένα"}
                        </Typography>
                      </Box>
                    </Stack>
                    {count > 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DoneAllIcon />}
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                        sx={{
                          fontSize: { xs: 0, sm: 13 },
                          fontWeight: 800,
                          minWidth: { xs: 36, sm: 190 }, height: 36, px: { xs: 0.75, sm: 1.25 },
                          color: "#0b5cad", borderColor: "#9dc5ff", borderRadius: 2,
                          "&:hover": { bgcolor: "#edf5ff", borderColor: "#4b97f3" },
                          "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
                        }}
                      >
                        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t("notifications.markAll")}</Box>
                      </Button>
                    )}
                  </Stack>

                  <Box sx={{ p: { xs: 1, sm: 1.25 }, borderBottom: "1px solid #dfe7f0", bgcolor: "#edf5fd" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
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
                              <SearchIcon sx={{ fontSize: 21, color: "#173e69" }} />
                            </InputAdornment>
                          )
                        }}
                        sx={{ flex: 1, "& .MuiOutlinedInput-root": { height: 38, borderRadius: 1.75, fontSize: 13, bgcolor: "#fff" } }}
                      />
                      <TextField select size="small" value={category} onChange={(event) => { setCategory(event.target.value); resetPaging(); }}
                        aria-label="Κατηγορία ειδοποιήσεων" sx={{ width: { xs: "100%", sm: 185 }, "& .MuiOutlinedInput-root": { height: 38, borderRadius: 1.75, fontSize: 13, bgcolor: "#fff" } }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><FilterAltOutlinedIcon sx={{ fontSize: 20, color: "#173e69" }} /></InputAdornment> }}>
                        <MenuItem value="">Όλες οι κατηγορίες</MenuItem>
                        {categoryOptions.map(option => <MenuItem key={option} value={option}>{notificationCategoryLabel(option)}</MenuItem>)}
                      </TextField>
                    </Stack>

                    <Stack direction="row" spacing={0.75} flexWrap={{ xs: "nowrap", sm: "wrap" }} sx={{ mt: 1.25, gap: 0.5, overflowX: { xs: "auto", sm: "visible" }, pb: 0.25 }}>
                      {FILTERS.map(opt => {
                        const active = severity === opt.key;
                        const tone = FILTER_TONES[opt.key];
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
                              borderRadius: 2,
                              fontSize: 11.25,
                              fontWeight: 750,
                              height: 27,
                              flexShrink: 0,
                              border: "1px solid",
                              borderColor: active ? tone.active : `${tone.text}45`,
                              bgcolor: active ? tone.active : tone.soft,
                              color: active ? "#fff" : tone.text,
                              "&:hover": { bgcolor: active ? tone.active : tone.soft, color: active ? "#fff" : tone.text, filter: active ? "brightness(.88)" : "brightness(.96)" }
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>

                  <Box sx={{ overflowY: "auto", flex: 1, minHeight: 220 }}>
                    <Box sx={{
                      display: { xs: "none", sm: "grid" },
                      gridTemplateColumns: "38px minmax(0,1fr) 92px 118px 32px",
                      alignItems: "center", columnGap: 1, px: 1.25, py: 0.75,
                      bgcolor: "#173a60", color: "#fff", borderBottom: "1px solid #0d2c4d",
                    }}>
                      <Box />
                      <Typography variant="caption" fontWeight={800}>Ειδοποίηση</Typography>
                      <Typography variant="caption" fontWeight={800}>Ημερομηνία</Typography>
                      <Typography variant="caption" fontWeight={800}>Κατάσταση</Typography>
                      <Box />
                    </Box>
                    {listQ.isLoading && (
                      <Box sx={{ p: 3, textAlign: "center", color: "#456079", fontSize: 13 }}>
                        Φόρτωση…
                      </Box>
                    )}

                    {!listQ.isLoading && filtered.length === 0 && (
                      <Box sx={{ p: 4, textAlign: "center", color: "#456079", fontSize: 13 }}>
                        {search || severity !== "all" || category
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
                            px: { xs: 1.25, sm: 1.5 },
                            py: 0.85,
                            cursor: "pointer",
                            borderLeft: "3px solid",
                            borderLeftColor: sevColor,
                            borderBottom: "1px solid #dfe7f0",
                            bgcolor: n.isRead ? "#fff" : "#f1f7ff",
                            transition: "background-color 180ms ease",
                            "&:hover": { bgcolor: "#e7f1fc" }
                          }}
                          onClick={() => {
                            setExpandedId(prev => prev === n.id ? null : n.id);
                            if (!n.isRead) markRead.mutate(n.id);
                          }}
                        >
                          <Box sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "36px minmax(0,1fr) 30px", sm: "38px minmax(0,1fr) 92px 118px 32px" },
                            alignItems: "center", columnGap: 1,
                          }}>
                            <Box sx={{
                              width: 32, height: 32, borderRadius: 1.4, display: "grid", placeItems: "center",
                              bgcolor: "#e6f0fb", color: "#0b5cad", border: "1px solid #c8dcf1",
                            }}>
                              <ArticleOutlinedIcon fontSize="small" />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: 12.75,
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
                                  fontSize: 11.5,
                                  color: "#456079",
                                  mt: 0.35,
                                  lineHeight: 1.5,
                                  whiteSpace: isExpanded ? "pre-wrap" : "normal",
                                  ...(isExpanded ? {} : {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden"
                                  })
                                }}
                              >
                                {n.body}
                              </Typography>

                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6, display: { xs: "flex", sm: "none" } }}>
                                <Typography sx={{ fontSize: 11.25, color: "#60728b" }}>{shortDate(n.createdAt)}</Typography>
                                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: sevColor }} />
                                <Typography sx={{ fontSize: 11.25, color: sevColor, fontWeight: 750 }}>{notificationCategoryLabel(n.category)}</Typography>
                              </Stack>

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
                            <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: 10.75, color: "#38536f", whiteSpace: "nowrap" }}>
                              {shortDate(n.createdAt)}
                            </Typography>
                            <Chip size="small" label={notificationCategoryLabel(n.category)} icon={<Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: sevColor }} />}
                              sx={{
                                display: { xs: "none", sm: "inline-flex" }, maxWidth: 118, justifySelf: "start",
                                height: 24, fontSize: 9.75, fontWeight: 800, color: sevColor,
                                bgcolor: NOTIFICATION_SEVERITY_TINT[sev], border: `1px solid ${sevColor}26`,
                                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                                "& .MuiChip-icon": { ml: 1, mr: -0.25 },
                              }} />
                            <IconButton
                              size="small"
                              title={n.isRead ? "Αναγνωσμένη" : t("notifications.markRead")}
                              disabled={n.isRead}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!n.isRead) markRead.mutate(n.id);
                              }}
                              sx={{
                                width: 32, height: 32, border: "1px solid #cfdae7", borderRadius: 1.25,
                                color: n.isRead ? "#93a4b6" : "#173e69", bgcolor: "#fff",
                                "&:hover": { bgcolor: "#eaf3ff" },
                              }}
                            >
                              <MarkEmailReadIcon fontSize="small" />
                            </IconButton>
                          </Box>
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
