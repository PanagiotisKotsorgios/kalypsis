import { useMemo, useState } from "react";
import { FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Badge, Box, Button, Card, Checkbox, Chip, CircularProgress, IconButton,
  MenuItem, Popover, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Typography
} from "@mui/material";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ViewListIcon from "@mui/icons-material/ViewList";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { money, date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

interface UpcomingRow {
  policyId: string;
  policyNumber: string;
  customerDisplay: string;
  insuranceCompanyName: string;
  policyType: string;
  endDate: string;
  premium: number;
  currency: string;
  daysToRenewal: number;
}

const WINDOWS = [
  { value: 30, label: "30 ημέρες" },
  { value: 60, label: "60 ημέρες" },
  { value: 90, label: "90 ημέρες" },
  { value: 180, label: "6 μήνες" },
  { value: 365, label: "12 μήνες" },
];

const WEEKDAYS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];

export function RenewalsPage() {
  const qc = useQueryClient();
  const [windowDays, setWindowDays] = useState(90);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ anchor: HTMLElement; rows: UpcomingRow[] } | null>(null);

  const q = useQuery({
    queryKey: ["renewals-upcoming", windowDays],
    queryFn: async () => (await api.get<UpcomingRow[]>("/renewals/upcoming",
      { params: { days: windowDays } })).data
  });

  const bulk = useMutation({
    mutationFn: async () => (await api.post<number>("/renewals/bulk", {
      policyIds: Array.from(selected), renewalTermDays: 365
    })).data,
    onSuccess: (n) => {
      setSuccess(`Ανανεώθηκαν ${n} συμβόλαια.`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ["renewals-upcoming"] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const rows = q.data ?? [];

  const grouped = useMemo(() => {
    const out = new Map<string, UpcomingRow[]>();
    for (const r of rows) {
      const key = r.endDate.slice(0, 7);
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    return Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const byDay = useMemo(() => {
    const out = new Map<string, UpcomingRow[]>();
    for (const r of rows) {
      const key = r.endDate.slice(0, 10);
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    return out;
  }, [rows]);

  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("el-GR", { month: "long", year: "numeric" });
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleMonth = (monthRows: UpcomingRow[]) => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = monthRows.every(r => next.has(r.policyId));
      if (allSelected) monthRows.forEach(r => next.delete(r.policyId));
      else monthRows.forEach(r => next.add(r.policyId));
      return next;
    });
  };

  // Build a 6-week grid for the calendar view. First column is Monday.
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const isoDow = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(year, month, 1 - isoDow);
    const cells: { date: Date; iso: string; inMonth: boolean; }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cells.push({ date: d, iso, inMonth: d.getMonth() === month });
    }
    return cells;
  }, [cursor]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EventRepeatIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Ανανεώσεις</Typography>
            <Typography color="text.secondary">
              Συμβόλαια που λήγουν εντός του παραθύρου. Επιλέξτε για μαζική ανανέωση.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="list"><ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />Λίστα</ToggleButton>
            <ToggleButton value="calendar"><CalendarViewMonthIcon fontSize="small" sx={{ mr: 0.5 }} />Ημερολόγιο</ToggleButton>
          </ToggleButtonGroup>
          <FilterFieldWrap tip="Χρονικό παράθυρο εμφάνισης — δείχνει τα συμβόλαια που λήγουν εντός τόσων ημερών.">
            <SearchableTextField size="small" label="Παράθυρο" value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))} sx={{ minWidth: 150, width: "100%" }}>
              {WINDOWS.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <Button
            variant="contained" startIcon={<AutorenewIcon />}
            disabled={selected.size === 0 || bulk.isPending}
            onClick={() => {
              if (confirm(`Ανανέωση ${selected.size} συμβολαίων;`)) bulk.mutate();
            }}
            sx={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 220 }}>
            {bulk.isPending ? <CircularProgress size={18} color="inherit" />
              : `Μαζική ανανέωση (${selected.size})`}
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }} variant="outlined">
          <Typography color="text.secondary">
            Καμία ανανέωση εντός του παραθύρου.
          </Typography>
        </Card>
      ) : view === "list" ? (
        <Stack spacing={2}>
          {grouped.map(([month, monthRows]) => {
            const monthTotal = monthRows.reduce((s, r) => s + r.premium, 0);
            const allSel = monthRows.every(r => selected.has(r.policyId));
            return (
              <Card key={month} variant="outlined">
                <Stack direction="row" alignItems="center" spacing={2}
                  sx={{ p: 2, bgcolor: "rgba(11,37,69,0.04)" }}>
                  <Checkbox checked={allSel} indeterminate={!allSel && monthRows.some(r => selected.has(r.policyId))}
                    onChange={() => toggleMonth(monthRows)} />
                  <Typography fontWeight={800} sx={{ flex: 1, textTransform: "capitalize" }}>
                    {monthLabel(month)}
                  </Typography>
                  <Chip size="small" label={`${monthRows.length} συμβόλαια`} />
                  <Typography fontWeight={700}>{money(monthTotal)}</Typography>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={42} />
                      <TableCell>Αρ. συμβολαίου</TableCell>
                      <TableCell>Πελάτης</TableCell>
                      <TableCell>Εταιρία</TableCell>
                      <TableCell>Κλάδος</TableCell>
                      <TableCell>Λήξη</TableCell>
                      <TableCell align="right">Ημέρες</TableCell>
                      <TableCell align="right">Ασφάλιστρο</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthRows.map(r => (
                      <TableRow key={r.policyId} hover>
                        <TableCell>
                          <Checkbox checked={selected.has(r.policyId)} onChange={() => toggle(r.policyId)} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                        <TableCell>{r.customerDisplay}</TableCell>
                        <TableCell>{r.insuranceCompanyName}</TableCell>
                        <TableCell>{r.policyType}</TableCell>
                        <TableCell>{date(r.endDate)}</TableCell>
                        <TableCell align="right">
                          <Chip size="small"
                            color={r.daysToRenewal <= 14 ? "error" : r.daysToRenewal <= 30 ? "warning" : "default"}
                            label={r.daysToRenewal} />
                        </TableCell>
                        <TableCell align="right">{money(r.premium, r.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={800} sx={{ flex: 1, textTransform: "capitalize" }}>
              {cursor.toLocaleDateString("el-GR", { month: "long", year: "numeric" })}
            </Typography>
            <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
          <Box sx={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5,
          }}>
            {WEEKDAYS.map(w => (
              <Box key={w} sx={{
                textAlign: "center", fontSize: 12, fontWeight: 700, color: "text.secondary", py: 0.5
              }}>{w}</Box>
            ))}
            {grid.map(cell => {
              const dayRows = byDay.get(cell.iso) ?? [];
              const isToday = cell.iso === new Date().toISOString().slice(0, 10);
              const daySum = dayRows.reduce((s, r) => s + r.premium, 0);
              return (
                <Box key={cell.iso}
                  onClick={(e) => dayRows.length > 0 && setPopover({ anchor: e.currentTarget, rows: dayRows })}
                  sx={{
                    minHeight: 84, border: 1, borderColor: isToday ? "primary.main" : "divider",
                    borderWidth: isToday ? 2 : 1,
                    borderRadius: 1, p: 1,
                    bgcolor: cell.inMonth ? "background.paper" : "rgba(0,0,0,0.02)",
                    opacity: cell.inMonth ? 1 : 0.5,
                    cursor: dayRows.length > 0 ? "pointer" : "default",
                    "&:hover": dayRows.length > 0 ? { bgcolor: "rgba(11,37,69,0.05)" } : undefined,
                  }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" fontWeight={isToday ? 800 : 600}>
                      {cell.date.getDate()}
                    </Typography>
                    {dayRows.length > 0 && (
                      <Badge badgeContent={dayRows.length} color="primary" sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }}>
                        <Box sx={{ width: 4 }} />
                      </Badge>
                    )}
                  </Stack>
                  {dayRows.length > 0 && (
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontWeight: 700, color: "primary.main" }}>
                      {money(daySum)}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          <Popover open={!!popover} anchorEl={popover?.anchor} onClose={() => setPopover(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            transformOrigin={{ vertical: "top", horizontal: "center" }}
            slotProps={{ paper: { sx: { minWidth: 380, maxWidth: 480, maxHeight: 360 } } }}>
            <Box sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} mb={1} display="block">
                {popover && date(popover.rows[0].endDate)} — {popover?.rows.length} συμβόλαια
              </Typography>
              <Table size="small">
                <TableBody>
                  {popover?.rows.map(r => (
                    <TableRow key={r.policyId} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.has(r.policyId)} onChange={() => toggle(r.policyId)} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{r.policyNumber}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{r.customerDisplay}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700 }}>{money(r.premium, r.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Popover>
        </Card>
      )}
    </Box>
  );
}
