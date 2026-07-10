import { useMemo, useState } from "react";
import {
  Badge, Box, Card, IconButton, Popover, Stack, Tooltip, Typography,
  Chip
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useTranslation } from "react-i18next";

/**
 * Shared shape the calendar knows how to render. Every event has a bucket
 * that decides its dot colour: "appointment" → red, "task" → blue. The
 * calling page maps its domain entities into this shape before passing.
 */
export interface CalendarEvent {
  id: string;
  bucket: "appointment" | "task";
  title: string;
  /** ISO string. Used for placement and hover tooltip. */
  at: string;
  /** Optional end (for appointments). Not required. */
  until?: string;
  /** Short chip label — usually assignee/customer, shown in the hover pop. */
  meta?: string;
  /** Full detail rendered in the hover popover; falls back to `title`. */
  detail?: string;
  /** Status-style badge shown at the right of each hover entry. */
  statusLabel?: string;
  statusColor?: "default" | "primary" | "secondary" | "info" | "success" | "warning" | "error";
}

interface Props {
  events: CalendarEvent[];
  /** Optional click on empty area of a day — usually opens a "create for this
   *  date" dialog with startsAt prefilled. */
  onCreateForDay?: (dayIsoDate: string) => void;
  /** Optional click on a single event pill / dot — usually opens the edit dialog. */
  onEventClick?: (event: CalendarEvent) => void;
}

/** Sunday-based day-of-week → Monday-based index (Mon=0…Sun=6). */
const isoDow = (d: Date) => (d.getDay() + 6) % 7;

/** Format a Date as a local YYYY-MM-DD (no timezone conversion). */
const toDayIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const sameYmd = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function AppointmentsCalendar({ events, onCreateForDay, onEventClick }: Props) {
  const { t } = useTranslation();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [hoveredDay, setHoveredDay] = useState<{ el: HTMLElement; iso: string } | null>(null);

  // Group events by local Y-M-D once — the grid re-reads this on every render.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.at);
      if (Number.isNaN(d.getTime())) continue;
      const key = toDayIso(d);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    // Sort each day chronologically so the hover popover reads top-to-bottom.
    for (const arr of map.values()) arr.sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [events]);

  // Build the 6-row grid: leading blanks from the prev month, current month
  // days, and trailing blanks from the next month. Always 42 cells so the
  // grid height doesn't jitter month-to-month.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = isoDow(first);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const list: { date: Date; inMonth: boolean }[] = [];
    for (let i = lead - 1; i >= 0; i--) {
      list.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), -i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
    }
    while (list.length < 42) {
      const last = list[list.length - 1].date;
      list.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return list;
  }, [cursor]);

  const weekdayHeads = useMemo(() => {
    // Monday-first weekday abbreviations, localised via toLocaleDateString.
    const monday = new Date(2024, 0, 1); // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toLocaleDateString(undefined, { weekday: "short" });
    });
  }, []);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const hoveredList = hoveredDay ? eventsByDay.get(hoveredDay.iso) ?? [] : [];

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton
          size="small"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label={String(t("calendar.prevMonth", "Προηγούμενος μήνας"))}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 800, textTransform: "capitalize", minWidth: 180 }}>
          {monthLabel}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label={String(t("calendar.nextMonth", "Επόμενος μήνας"))}
        >
          <ChevronRightIcon />
        </IconButton>
        <Tooltip title={t("calendar.today", "Σήμερα")}>
          <IconButton
            size="small"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            <CalendarTodayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Legend />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
        }}
      >
        {weekdayHeads.map((w) => (
          <Typography
            key={w}
            variant="caption"
            sx={{
              textAlign: "center",
              fontWeight: 800,
              color: "text.secondary",
              py: 0.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            {w}
          </Typography>
        ))}

        {cells.map(({ date, inMonth }) => {
          const iso = toDayIso(date);
          const dayEvents = eventsByDay.get(iso) ?? [];
          const isToday = sameYmd(date, today);
          const apptCount = dayEvents.filter(e => e.bucket === "appointment").length;
          const taskCount = dayEvents.filter(e => e.bucket === "task").length;
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;

          return (
            <Box
              key={iso}
              onMouseEnter={(e) => setHoveredDay({ el: e.currentTarget, iso })}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={(e) => {
                // Only trigger create when clicking the empty area of the
                // cell — event pills below handle their own clicks.
                if ((e.target as HTMLElement).closest("[data-event-pill]")) return;
                onCreateForDay?.(iso);
              }}
              sx={{
                position: "relative",
                minHeight: 110,
                p: 0.75,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: isToday ? "primary.main" : "divider",
                bgcolor: inMonth ? "background.paper" : "action.hover",
                opacity: inMonth ? 1 : 0.55,
                cursor: onCreateForDay ? "pointer" : "default",
                transition: "border-color 120ms, box-shadow 120ms",
                "&:hover": {
                  borderColor: "primary.light",
                  boxShadow: 1,
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isToday ? 900 : 600,
                    color: isToday ? "primary.main" : inMonth ? "text.primary" : "text.disabled",
                    lineHeight: 1,
                  }}
                >
                  {date.getDate()}
                </Typography>
                <Stack direction="row" spacing={0.25}>
                  {apptCount > 0 && (
                    <Badge
                      badgeContent={apptCount}
                      color="error"
                      overlap="circular"
                      sx={{ "& .MuiBadge-badge": { fontSize: 9, height: 14, minWidth: 14, right: -2, top: 8 } }}
                    >
                      <FiberManualRecordIcon sx={{ color: "error.main", fontSize: 12 }} />
                    </Badge>
                  )}
                  {taskCount > 0 && (
                    <Badge
                      badgeContent={taskCount}
                      color="primary"
                      overlap="circular"
                      sx={{ "& .MuiBadge-badge": { fontSize: 9, height: 14, minWidth: 14, right: -2, top: 8 } }}
                    >
                      <FiberManualRecordIcon sx={{ color: "info.main", fontSize: 12 }} />
                    </Badge>
                  )}
                </Stack>
              </Stack>

              <Stack spacing={0.25} mt={0.5}>
                {visible.map((e) => (
                  <Box
                    key={e.id}
                    data-event-pill
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick?.(e);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.75,
                      bgcolor: e.bucket === "appointment" ? "error.lighter" : "info.lighter",
                      color: e.bucket === "appointment" ? "error.dark" : "info.dark",
                      fontSize: 11,
                      lineHeight: 1.2,
                      cursor: onEventClick ? "pointer" : "default",
                      "&:hover": onEventClick ? { filter: "brightness(0.96)" } : undefined,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    // MUI palette doesn't ship `error.lighter` / `info.lighter`
                    // by default — the sx above degrades to a solid tinted
                    // color if the theme lacks them, which is fine.
                    style={{
                      backgroundColor:
                        e.bucket === "appointment"
                          ? "rgba(211, 47, 47, 0.10)"
                          : "rgba(2, 136, 209, 0.10)",
                    }}
                  >
                    <FiberManualRecordIcon
                      sx={{
                        fontSize: 8,
                        color: e.bucket === "appointment" ? "error.main" : "info.main",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {shortTime(e.at)} {e.title}
                    </span>
                  </Box>
                ))}
                {overflow > 0 && (
                  <Typography variant="caption" sx={{ color: "text.secondary", pl: 0.5 }}>
                    +{overflow} {t("calendar.more", "ακόμη")}
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Popover
        open={Boolean(hoveredDay) && hoveredList.length > 0}
        anchorEl={hoveredDay?.el ?? null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setHoveredDay(null)}
        disableRestoreFocus
        disableScrollLock
        sx={{ pointerEvents: "none" }}
        slotProps={{ paper: { sx: { pointerEvents: "auto", p: 1.5, maxWidth: 380 } } }}
      >
        {hoveredDay && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
              {new Date(hoveredDay.iso).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Typography>
            <Stack spacing={0.75}>
              {hoveredList.map(e => (
                <Box key={e.id} sx={{ borderLeft: 3, borderColor: e.bucket === "appointment" ? "error.main" : "info.main", pl: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                      {shortTime(e.at)}{e.until ? ` – ${shortTime(e.until)}` : ""} · {e.title}
                    </Typography>
                    {e.statusLabel && (
                      <Chip size="small" color={e.statusColor ?? "default"} label={e.statusLabel} />
                    )}
                  </Stack>
                  {e.detail && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-wrap" }}>
                      {e.detail}
                    </Typography>
                  )}
                  {e.meta && (
                    <Typography variant="caption" color="text.disabled">{e.meta}</Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Popover>
    </Card>
  );
}

function shortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function Legend() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <FiberManualRecordIcon sx={{ color: "error.main", fontSize: 12 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t("calendar.appointments", "Ραντεβού")}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <FiberManualRecordIcon sx={{ color: "info.main", fontSize: 12 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t("calendar.tasks", "Εργασίες")}
        </Typography>
      </Stack>
    </Stack>
  );
}
