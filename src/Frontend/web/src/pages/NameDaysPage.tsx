import { useEffect, useState } from "react";
import {
  Alert, Avatar, Badge, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, LinearProgress, MenuItem, Paper, Popover, Stack, Switch,
  Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CakeIcon from "@mui/icons-material/Cake";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import UpcomingIcon from "@mui/icons-material/Upcoming";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import HistoryIcon from "@mui/icons-material/History";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import SendIcon from "@mui/icons-material/Send";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";
import { useAuth } from "../auth/AuthContext";

/* ============================================================================
   Εορτολόγιο πελατών — advanced UI.

   Six tabs:
     1) Σήμερα        — who celebrates today (customer list with quick actions)
     2) Επόμενες      — 7/30 day lookahead
     3) Ημερολόγιο    — month grid with name-day chips per day
     4) Κατάλογος     — the underlying name-day definitions (CRUD)
     5) Πρότυπα ευχών — SMS/Email greeting templates with placeholders + preview
     6) Ιστορικό      — sent-wishes audit log

   Notes and templates are persisted per-user in localStorage; sent-wish log
   entries too. Server endpoints can drop straight in later — the shapes are
   stable.
   ========================================================================= */

const MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];
const MONTHS_LONG = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];

interface NameDayDto { id: string; name: string; month: number; day: number; notes: string | null; isActive: boolean; }
interface CelebrantDto {
  customerId: string; customerName: string; customerNumber: string;
  phone: string | null; email: string | null; nameDay: string;
}

// -----------------------------------------------------------------------------
// Local persistence helpers.
// -----------------------------------------------------------------------------
type WishKind = "Email" | "SMS";
interface WishTemplate {
  id: string; name: string; kind: WishKind; subject: string; body: string;
}
interface WishLogEntry {
  id: string; sentAt: string; customerName: string; customerId: string;
  templateName: string; kind: WishKind; contact: string;
}
interface CustomerNote { customerId: string; note: string; updatedAt: string; }

const useLocalStore = <T,>(key: string, initial: T[]) => {
  const [value, setValue] = useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }, [key, value]);
  return [value, setValue] as const;
};

// -----------------------------------------------------------------------------
// Root page.
// -----------------------------------------------------------------------------
export function NameDaysPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("kalypsis:nameDays:tab") ?? "0");
      return Number.isFinite(v) && v >= 0 && v <= 5 ? v : 0;
    } catch { return 0; }
  });
  const changeTab = (v: number) => {
    setTab(v);
    try { localStorage.setItem("kalypsis:nameDays:tab", String(v)); } catch { /* quota */ }
  };

  const now = new Date();
  const todayQ = useQuery({
    queryKey: ["celebrants", now.getDate(), now.getMonth() + 1],
    queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", {
      params: { day: now.getDate(), month: now.getMonth() + 1 }
    })).data,
  });
  const tomorrow = new Date(now.getTime() + 24 * 3600e3);
  const tomorrowQ = useQuery({
    queryKey: ["celebrants", tomorrow.getDate(), tomorrow.getMonth() + 1],
    queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", {
      params: { day: tomorrow.getDate(), month: tomorrow.getMonth() + 1 }
    })).data,
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap" gap={2}>
        <CakeIcon sx={{ fontSize: 42, color: "#d6336c" }} />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("nameDays.title", "Εορτολόγιο Πελατών")}</Typography>
            <HelpHint id="page.nameDays" />
          </Stack>
          <Typography color="text.secondary">{t("nameDays.subtitle", "Ενημερωθείτε ποιοι πελάτες γιορτάζουν και στείλτε ευχές με ένα κλικ.")}</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <Kpi
          label={t("nameDays.kpi.today", "Σήμερα")}
          value={todayQ.data?.length ?? 0}
          color="#d6336c"
          loading={todayQ.isLoading}
          icon={<CakeIcon />}
        />
        <Kpi
          label={t("nameDays.kpi.tomorrow", "Αύριο")}
          value={tomorrowQ.data?.length ?? 0}
          color="#ff9800"
          loading={tomorrowQ.isLoading}
          icon={<UpcomingIcon />}
        />
        <UpcomingCountKpi days={7} label={t("nameDays.kpi.next7", "Επόμενες 7 μέρες")} color="#1976d2" />
        <UpcomingCountKpi days={30} label={t("nameDays.kpi.next30", "Επόμενες 30 μέρες")} color="#673ab7" />
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => changeTab(v)}
        variant="scrollable"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab icon={<CakeIcon fontSize="small" />}             iconPosition="start" label={t("nameDays.tab.today", "Σήμερα")} />
        <Tab icon={<UpcomingIcon fontSize="small" />}         iconPosition="start" label={t("nameDays.tab.upcoming", "Επόμενες")} />
        <Tab icon={<CalendarMonthIcon fontSize="small" />}    iconPosition="start" label={t("nameDays.tab.calendar", "Ημερολόγιο")} />
        <Tab icon={<ListAltIcon fontSize="small" />}          iconPosition="start" label={t("nameDays.tab.catalog", "Κατάλογος")} />
        <Tab icon={<DesignServicesIcon fontSize="small" />}   iconPosition="start" label={t("nameDays.tab.templates", "Πρότυπα ευχών")} />
        <Tab icon={<HistoryIcon fontSize="small" />}          iconPosition="start" label={t("nameDays.tab.history", "Ιστορικό")} />
      </Tabs>

      {tab === 0 && <TodayCelebrantsTab />}
      {tab === 1 && <UpcomingTab />}
      {tab === 2 && <CalendarTab />}
      {tab === 3 && <CatalogTab />}
      {tab === 4 && <TemplatesTab />}
      {tab === 5 && <HistoryTab />}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Small pieces.
// -----------------------------------------------------------------------------
function Kpi({ label, value, color, loading, icon }: {
  label: string; value: React.ReactNode; color?: string; loading?: boolean; icon?: React.ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ minWidth: 180, flex: "1 1 180px" }}>
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon && <Avatar sx={{ bgcolor: color ?? "primary.main", width: 32, height: 32 }}>{icon}</Avatar>}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: color ?? "text.primary", lineHeight: 1.1 }}>
              {loading ? <CircularProgress size={20} /> : value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function UpcomingCountKpi({ days, label, color }: { days: number; label: string; color: string }) {
  const now = new Date();
  const dates: { day: number; month: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 24 * 3600e3);
    dates.push({ day: d.getDate(), month: d.getMonth() + 1 });
  }
  const queries = useQueries({
    queries: dates.map(dm => ({
      queryKey: ["celebrants", dm.day, dm.month],
      queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", { params: dm })).data,
      staleTime: 60_000,
    })),
  });
  const total = queries.reduce((s, r) => s + (r.data?.length ?? 0), 0);
  const loading = queries.some(r => r.isLoading);
  return <Kpi label={label} value={total} color={color} loading={loading} icon={<UpcomingIcon />} />;
}

// -----------------------------------------------------------------------------
// Tab 1 — Today celebrants with quick actions + notes.
// -----------------------------------------------------------------------------
function TodayCelebrantsTab() {
  const { t } = useTranslation();
  const now = new Date();
  const [day, setDay] = useState(now.getDate());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["celebrants", day, month],
    queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", { params: { day, month } })).data,
  });
  const [notes, setNotes] = useLocalStore<CustomerNote>(
    `kalypsis:nameDays:notes:${user?.userId ?? "anon"}`,
    []
  );
  const upsertNote = (customerId: string, note: string) => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.customerId === customerId);
      const entry: CustomerNote = { customerId, note, updatedAt: new Date().toISOString() };
      if (idx < 0) return [entry, ...prev];
      const next = prev.slice(); next[idx] = entry; return next;
    });
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap">
        <Typography>{t("nameDays.lookupOn", "Προβολή ημερομηνίας:")}</Typography>
        <TextField
          type="number"
          label={t("nameDays.day", "Ημέρα")}
          value={day}
          onChange={e => setDay(Number(e.target.value))}
          sx={{ width: 100 }}
          inputProps={{ min: 1, max: 31 }}
        />
        <SearchableTextField
          label={t("nameDays.month", "Μήνας")}
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          sx={{ width: 150 }}
        >
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </SearchableTextField>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {(q.data ?? []).length} {t("nameDays.celebrate", "πελάτες γιορτάζουν")}
        </Typography>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {(q.data ?? []).length === 0 && (
            <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
              {t("nameDays.noCelebrants", "Δεν υπάρχουν πελάτες που γιορτάζουν αυτή τη μέρα.")}
            </Card>
          )}
          {(q.data ?? []).map(c => (
            <CelebrantCard
              key={c.customerId}
              c={c}
              note={notes.find(n => n.customerId === c.customerId)?.note ?? ""}
              onNoteChange={(v) => upsertNote(c.customerId, v)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function CelebrantCard({ c, note, onNoteChange }: { c: CelebrantDto; note: string; onNoteChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(note);
  useEffect(() => { setDraft(note); }, [note]);
  const initials = (c.customerName || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <Avatar sx={{ bgcolor: "#d6336c", fontWeight: 800 }}>{initials}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>{c.customerName}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>{c.customerNumber}</Typography>
          </Box>
          <Chip size="small" color="secondary" variant="outlined" label={c.nameDay} />
        </Stack>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mb={1}>
          {c.phone && (
            <Button size="small" variant="outlined" startIcon={<PhoneIcon fontSize="small" />} href={`tel:${c.phone}`}>
              {c.phone}
            </Button>
          )}
          {c.phone && (
            <Button size="small" variant="outlined" color="success" startIcon={<SmsIcon fontSize="small" />} href={`sms:${c.phone}`}>
              SMS
            </Button>
          )}
          {c.email && (
            <Button size="small" variant="outlined" color="primary" startIcon={<EmailIcon fontSize="small" />} href={`mailto:${c.email}?subject=${encodeURIComponent(t("nameDays.wishSubject", "Χρόνια Πολλά!") as string)}`}>
              {t("nameDays.wish", "Ευχή")}
            </Button>
          )}
          <Button size="small" component="a" href={`/app/customers/${c.customerId}`} sx={{ ml: "auto" }}>
            {t("nameDays.openCustomer", "Άνοιγμα καρτέλας")}
          </Button>
        </Stack>
        <Divider sx={{ my: 1 }} />
        {editingNote ? (
          <Stack spacing={1}>
            <TextField
              size="small"
              multiline
              rows={2}
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={t("nameDays.notePlaceholder", "Ιδιωτική σημείωση (μόνο για εσάς)") as string}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => { setEditingNote(false); setDraft(note); }}>{t("common.cancel", "Άκυρο")}</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="contained" onClick={() => { onNoteChange(draft); setEditingNote(false); }}>
                {t("common.save", "Αποθήκευση")}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <StickyNote2Icon fontSize="small" sx={{ color: "text.disabled", mt: 0.25 }} />
            <Typography variant="body2" color={note ? "text.primary" : "text.disabled"} sx={{ flex: 1, whiteSpace: "pre-wrap" }}>
              {note || t("nameDays.noNote", "Χωρίς σημείωση.")}
            </Typography>
            <IconButton size="small" onClick={() => setEditingNote(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Tab 2 — Upcoming (next N days).
// -----------------------------------------------------------------------------
function UpcomingTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const now = new Date();
  const targets: { day: number; month: number; date: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 24 * 3600e3);
    targets.push({ day: d.getDate(), month: d.getMonth() + 1, date: d });
  }
  const queries = useQueries({
    queries: targets.map(t => ({
      queryKey: ["celebrants", t.day, t.month],
      queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", {
        params: { day: t.day, month: t.month }
      })).data,
      staleTime: 60_000,
    })),
  });
  const loading = queries.some(q => q.isLoading);
  const rows = targets
    .map((t, i) => ({ ...t, celebrants: queries[i].data ?? [] }))
    .filter(r => r.celebrants.length > 0);

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap">
        <ToggleButtonGroup exclusive size="small" value={days} onChange={(_, v) => v && setDays(v)}>
          <ToggleButton value={7}>7 μέρες</ToggleButton>
          <ToggleButton value={14}>14 μέρες</ToggleButton>
          <ToggleButton value={30}>30 μέρες</ToggleButton>
          <ToggleButton value={60}>60 μέρες</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {rows.reduce((s, r) => s + r.celebrants.length, 0)} {t("nameDays.celebrateInRange", "εορτές στην περίοδο")}
        </Typography>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {rows.length === 0 && !loading && (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
          {t("nameDays.noUpcoming", "Καμία εορτή στην περίοδο.")}
        </Card>
      )}
      <Stack spacing={2}>
        {rows.map(r => (
          <Card key={`${r.month}-${r.day}`} variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={1} flexWrap="wrap">
                <Chip color="secondary" size="small" label={`${r.day} ${MONTHS_LONG[r.month - 1]}`} sx={{ fontWeight: 800 }} />
                <Typography variant="caption" color="text.secondary">
                  {r.date.toLocaleDateString("el-GR", { weekday: "long" })}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Chip size="small" label={`${r.celebrants.length} πελάτες`} />
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75}>
                {r.celebrants.map(c => (
                  <Chip
                    key={c.customerId}
                    size="small"
                    variant="outlined"
                    icon={<CakeIcon fontSize="small" />}
                    label={`${c.customerName} · ${c.nameDay}`}
                    onClick={() => window.open(`/app/customers/${c.customerId}`, "_blank")}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Tab 3 — Month calendar.
// -----------------------------------------------------------------------------
function CalendarTab() {
  const { t } = useTranslation();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [hoveredDay, setHoveredDay] = useState<{ el: HTMLElement; day: number } | null>(null);

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // One query per day of the current month. Cached aggressively so switching
  // months and coming back is instant.
  const queries = useQueries({
    queries: days.map(d => ({
      queryKey: ["celebrants", d, cursor.getMonth() + 1],
      queryFn: async () => (await api.get<CelebrantDto[]>("/name-days/celebrating", {
        params: { day: d, month: cursor.getMonth() + 1 }
      })).data,
      staleTime: 5 * 60_000,
    })),
  });
  const loading = queries.some(q => q.isLoading);
  const celebrantsByDay = new Map<number, CelebrantDto[]>();
  queries.forEach((q, i) => celebrantsByDay.set(days[i], q.data ?? []));

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const isoDow = (d: Date) => (d.getDay() + 6) % 7; // Monday-first
  const lead = isoDow(first);
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (const d of days) cells.push(d);
  while (cells.length < 42) cells.push(null);

  const weekdayHeads = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
  const hoveredCelebrants = hoveredDay ? celebrantsByDay.get(hoveredDay.day) ?? [] : [];

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 800, textTransform: "capitalize", minWidth: 200 }}>
          {MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}
        </Typography>
        <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRightIcon />
        </IconButton>
        <Button size="small" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
          {t("nameDays.today", "Σήμερα")}
        </Button>
        <Box sx={{ flex: 1 }} />
        {loading && <CircularProgress size={20} />}
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
        {weekdayHeads.map(w => (
          <Typography key={w} variant="caption" sx={{
            textAlign: "center", fontWeight: 800, color: "text.secondary",
            py: 0.5, textTransform: "uppercase", letterSpacing: 0.6
          }}>
            {w}
          </Typography>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <Box key={`e${idx}`} sx={{ minHeight: 100, opacity: 0.3, bgcolor: "action.hover", borderRadius: 1.5 }} />;
          const celebrants = celebrantsByDay.get(d) ?? [];
          const isToday = d === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
          const visible = celebrants.slice(0, 3);
          const overflow = celebrants.length - visible.length;
          return (
            <Box
              key={d}
              onMouseEnter={(e) => setHoveredDay({ el: e.currentTarget, day: d })}
              onMouseLeave={() => setHoveredDay(null)}
              sx={{
                position: "relative", minHeight: 100, p: 0.75, borderRadius: 1.5,
                border: "1px solid", borderColor: isToday ? "secondary.main" : "divider",
                bgcolor: "background.paper",
                transition: "border-color 120ms, box-shadow 120ms",
                "&:hover": { borderColor: "secondary.light", boxShadow: 1 }
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" sx={{
                  fontWeight: isToday ? 900 : 600,
                  color: isToday ? "secondary.main" : "text.primary", lineHeight: 1
                }}>
                  {d}
                </Typography>
                {celebrants.length > 0 && (
                  <Badge badgeContent={celebrants.length} color="secondary" overlap="circular"
                    sx={{ "& .MuiBadge-badge": { fontSize: 9, height: 14, minWidth: 14, right: -2, top: 8 } }}
                  >
                    <CakeIcon sx={{ color: "#d6336c", fontSize: 14 }} />
                  </Badge>
                )}
              </Stack>
              <Stack spacing={0.25} mt={0.5}>
                {visible.map(c => (
                  <Box
                    key={c.customerId}
                    onClick={() => window.open(`/app/customers/${c.customerId}`, "_blank")}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5, px: 0.5, py: 0.25,
                      borderRadius: 0.75, bgcolor: "rgba(214,51,108,0.10)", color: "#a8285a",
                      fontSize: 11, lineHeight: 1.2, cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {c.customerName}
                  </Box>
                ))}
                {overflow > 0 && (
                  <Typography variant="caption" sx={{ color: "text.secondary", pl: 0.5 }}>
                    +{overflow} ακόμη
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Popover
        open={Boolean(hoveredDay) && hoveredCelebrants.length > 0}
        anchorEl={hoveredDay?.el ?? null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setHoveredDay(null)}
        disableRestoreFocus
        disableScrollLock
        sx={{ pointerEvents: "none" }}
        slotProps={{ paper: { sx: { pointerEvents: "auto", p: 1.5, maxWidth: 360 } } }}
      >
        {hoveredDay && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
              {hoveredDay.day} {MONTHS_LONG[cursor.getMonth()]}
            </Typography>
            <Stack spacing={0.75}>
              {hoveredCelebrants.map(c => (
                <Box key={c.customerId} sx={{ borderLeft: 3, borderColor: "#d6336c", pl: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.customerName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.nameDay} · {c.customerNumber}
                    {c.phone && <> · {c.phone}</>}
                    {c.email && <> · {c.email}</>}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </Popover>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Tab 4 — Catalog (name-day definitions CRUD).
// -----------------------------------------------------------------------------
function CatalogTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["name-days", filter],
    queryFn: async () => (await api.get<NameDayDto[]>("/name-days", { params: filter ? { month: filter } : {} })).data
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/name-days/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["name-days"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Stack direction="row" spacing={2} mb={2}>
        <SearchableTextField
          label={t("nameDays.filterMonth", "Μήνας")}
          value={filter}
          onChange={e => setFilter(Number(e.target.value))}
          sx={{ width: 200 }}
        >
          <MenuItem value={0}>{t("common.all", "Όλα")}</MenuItem>
          {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
        </SearchableTextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("nameDays.add", "Προσθήκη")}
        </Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("nameDays.dayLabel", "Ημερομηνία")}</TableCell>
                <TableCell>{t("nameDays.name", "Όνομα")}</TableCell>
                <TableCell>{t("common.notes", "Σημειώσεις")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    {t("nameDays.emptyCatalog", "Ο κατάλογος είναι άδειος.")}
                  </TableCell>
                </TableRow>
              )}
              {(q.data ?? []).map(n => (
                <TableRow key={n.id} hover>
                  <TableCell>{n.day} {MONTHS[n.month - 1]}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{n.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{n.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { if (confirm(t("common.confirmDelete", "Επιβεβαίωση διαγραφής;"))) del.mutate(n.id); }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CatalogCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["name-days"] }); setCreateOpen(false); }}
      />
    </Box>
  );
}

function CatalogCreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", month: 1, day: 1, notes: "", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/name-days", {
      name: form.name.trim(), month: Number(form.month), day: Number(form.day),
      notes: form.notes || null, isActive: form.isActive
    })).data,
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  useEffect(() => {
    if (open) { setForm({ name: "", month: 1, day: 1, notes: "", isActive: true }); setErr(null); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("nameDays.addTitle", "Νέα εορτή")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField required label={t("nameDays.name", "Όνομα")} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} fullWidth placeholder="π.χ. Γιώργος" />
          <Stack direction="row" spacing={2}>
            <TextField type="number" required label={t("nameDays.day", "Ημέρα")} value={form.day}
              onChange={e => setForm({ ...form, day: Number(e.target.value) })} sx={{ width: 120 }} inputProps={{ min: 1, max: 31 }} />
            <SearchableTextField required label={t("nameDays.month", "Μήνας")} value={form.month}
              onChange={e => setForm({ ...form, month: Number(e.target.value) })} fullWidth>
              {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <TextField label={t("common.notes", "Σημειώσεις")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth placeholder="π.χ. Αγ. Γεωργίου" />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{t("nameDays.active", "Ενεργή")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 5 — Greeting templates.
// -----------------------------------------------------------------------------
const WISH_PLACEHOLDERS = [
  { key: "{customer}", desc: "Όνομα πελάτη" },
  { key: "{nameDay}",  desc: "Άγιος/εορτή" },
  { key: "{agency}",   desc: "Όνομα γραφείου" },
  { key: "{producer}", desc: "Ο ασφαλιστής σας" },
];

const DEFAULT_WISH_TEMPLATES: WishTemplate[] = [
  {
    id: "wish-email",
    name: "Ευχή Ονομαστικής — Email",
    kind: "Email",
    subject: "Χρόνια Πολλά!",
    body: "Αγαπητέ/ή {customer},\n\nΧρόνια Πολλά για την εορτή σας ({nameDay})! Σας ευχόμαστε υγεία, ευτυχία και κάθε καλό.\n\nΜε εκτίμηση,\n{producer}\n{agency}",
  },
  {
    id: "wish-sms",
    name: "Ευχή Ονομαστικής — SMS",
    kind: "SMS",
    subject: "",
    body: "{agency}: Χρόνια Πολλά {customer}! Σας ευχόμαστε υγεία και χαρά.",
  },
];

function TemplatesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [templates, setTemplates] = useLocalStore<WishTemplate>(
    `kalypsis:nameDays:templates:${user?.userId ?? "anon"}`,
    DEFAULT_WISH_TEMPLATES
  );
  const [editing, setEditing] = useState<WishTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const upsert = (tpl: WishTemplate) => setTemplates(prev => {
    const idx = prev.findIndex(p => p.id === tpl.id);
    if (idx < 0) return [tpl, ...prev];
    const next = prev.slice(); next[idx] = tpl; return next;
  });
  const remove = (id: string) => setTemplates(prev => prev.filter(t => t.id !== id));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {t("nameDays.templates.title", "Πρότυπα ευχών")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("nameDays.templates.subtitle", "Ετοιμάστε τις ευχές σας μία φορά — γεμίζουν αυτόματα με στοιχεία του πελάτη.")}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          {t("nameDays.templates.new", "Νέο πρότυπο")}
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {templates.length === 0 && (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed", gridColumn: "1 / -1" }}>
            {t("nameDays.templates.empty", "Δεν έχετε δημιουργήσει πρότυπα ακόμη.")}
          </Card>
        )}
        {templates.map(tpl => (
          <WishTemplateCard key={tpl.id} tpl={tpl} onEdit={() => setEditing(tpl)} onDelete={() => remove(tpl.id)} />
        ))}
      </Box>

      <WishTemplateEditor
        open={creating || !!editing}
        template={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(tpl) => { upsert(tpl); setCreating(false); setEditing(null); }}
      />
    </Box>
  );
}

function WishTemplateCard({ tpl, onEdit, onDelete }: { tpl: WishTemplate; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {tpl.kind === "Email" ? <EmailIcon fontSize="small" color="primary" /> : <SmsIcon fontSize="small" color="success" />}
            <Typography sx={{ fontWeight: 700 }}>{tpl.name}</Typography>
            <Chip size="small" variant="outlined" color={tpl.kind === "Email" ? "primary" : "success"} label={tpl.kind} />
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
            <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete", "Επιβεβαίωση διαγραφής;"))) onDelete(); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        {tpl.kind === "Email" && tpl.subject && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
            {t("nameDays.templates.subject", "Θέμα")}: {tpl.subject}
          </Typography>
        )}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
          {tpl.body}
        </Paper>
      </CardContent>
    </Card>
  );
}

function fillPlaceholders(text: string, sample: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => sample[k] ?? `{${k}}`);
}

function WishTemplateEditor({
  open, template, onClose, onSave
}: { open: boolean; template: WishTemplate | null; onClose: () => void; onSave: (tpl: WishTemplate) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<WishTemplate>(() => template ?? {
    id: `wish-${Date.now()}`, name: "", kind: "Email", subject: "", body: "",
  });
  useEffect(() => {
    if (template) setForm(template);
    else if (open) setForm({ id: `wish-${Date.now()}`, name: "", kind: "Email", subject: "", body: "" });
  }, [template, open]);

  const sample: Record<string, string> = {
    customer: "Γιώργος Παπαδόπουλος",
    nameDay: "Αγ. Γεωργίου",
    producer: "Α. Παπαδοπούλου",
    agency: "Ασφαλιστικό Γραφείο Kalypsis",
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{template ? t("common.save", "Αποθήκευση") : t("nameDays.templates.new", "Νέο πρότυπο")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" }, gap: 3, mt: 1 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label={t("nameDays.templates.name", "Όνομα προτύπου")} value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
              <SearchableTextField label={t("nameDays.templates.kind", "Τύπος")} value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value as WishKind })} sx={{ width: 160 }}>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
              </SearchableTextField>
            </Stack>
            {form.kind === "Email" && (
              <TextField label={t("nameDays.templates.subject", "Θέμα")} value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
            )}
            <TextField label={t("nameDays.templates.body", "Κείμενο")} value={form.body} multiline rows={10}
              onChange={e => setForm({ ...form, body: e.target.value })} fullWidth />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                {t("nameDays.templates.placeholders", "Διαθέσιμα placeholders")}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} mt={0.5}>
                {WISH_PLACEHOLDERS.map(p => (
                  <Tooltip key={p.key} title={p.desc}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={p.key}
                      onClick={() => setForm({ ...form, body: form.body + p.key })}
                      sx={{ cursor: "pointer", fontFamily: "monospace" }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          </Stack>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
              {t("nameDays.templates.preview", "Προεπισκόπηση")}
            </Typography>
            <Paper variant="outlined" sx={{ mt: 0.5, p: 2, bgcolor: form.kind === "Email" ? "#fdfdfd" : "#e8f5e9", minHeight: 260 }}>
              {form.kind === "Email" && (
                <Box sx={{ mb: 1, borderBottom: 1, borderColor: "divider", pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Subject:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {fillPlaceholders(form.subject || "Χρόνια Πολλά!", sample)}
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: form.kind === "SMS" ? "monospace" : undefined }}>
                {fillPlaceholders(form.body || "—", sample)}
              </Typography>
              {form.kind === "SMS" && (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
                  {fillPlaceholders(form.body || "", sample).length} χαρακτήρες
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Άκυρο")}</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim() || !form.body.trim()}>
          {t("common.save", "Αποθήκευση")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Tab 6 — Sent wishes log.
// -----------------------------------------------------------------------------
function HistoryTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [log] = useLocalStore<WishLogEntry>(
    `kalypsis:nameDays:wishLog:${user?.userId ?? "anon"}`,
    []
  );

  const byMonth = new Map<string, WishLogEntry[]>();
  for (const l of log) {
    const key = new Date(l.sentAt).toLocaleDateString("el-GR", { month: "long", year: "numeric" });
    (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(l);
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {t("nameDays.history.title", "Ιστορικό αποστολών ευχών")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("nameDays.history.subtitle", "Πλήρες αρχείο ευχών προς πελάτες.")}
          </Typography>
        </Box>
        <Chip icon={<SendIcon />} label={`${log.length} συνολικά`} color="secondary" />
      </Stack>

      {log.length === 0 && (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
          {t("nameDays.history.empty", "Δεν έχετε στείλει ακόμη ευχές μέσα από το σύστημα.")}
        </Card>
      )}

      {Array.from(byMonth.entries()).map(([month, entries]) => (
        <Box key={month} mb={2}>
          <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "capitalize" }}>{month}</Typography>
          <Card variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("nameDays.history.time", "Ώρα")}</TableCell>
                  <TableCell>{t("nameDays.history.customer", "Πελάτης")}</TableCell>
                  <TableCell>{t("nameDays.history.template", "Πρότυπο")}</TableCell>
                  <TableCell>{t("nameDays.history.channel", "Κανάλι")}</TableCell>
                  <TableCell>{t("nameDays.history.contact", "Παραλήπτης")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map(l => (
                  <TableRow key={l.id} hover>
                    <TableCell>{new Date(l.sentAt).toLocaleString("el-GR")}</TableCell>
                    <TableCell>
                      <a href={`/app/customers/${l.customerId}`} style={{ color: "inherit" }}>{l.customerName}</a>
                    </TableCell>
                    <TableCell>{l.templateName}</TableCell>
                    <TableCell>
                      <Chip size="small" color={l.kind === "Email" ? "primary" : "success"} variant="outlined" label={l.kind} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{l.contact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Box>
      ))}
    </Box>
  );
}
