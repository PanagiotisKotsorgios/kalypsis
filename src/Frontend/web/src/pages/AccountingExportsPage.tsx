import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography
} from "@mui/material";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { dateTime } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

interface ExportDto { id: string; year: number; month: number; runAt: string; status: "Pending"|"Running"|"Completed"|"Failed"; entries: number; fileName: string | null; notes: string | null; }

export function AccountingExportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // History filters — the exports list grows one-per-run so a search +
  // year/status filter + pagination keep it navigable across seasons.
  const [historyYear, setHistoryYear] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ExportDto["status"] | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const q = useQuery({ queryKey: ["accounting-exports"], queryFn: async () => (await api.get<ExportDto[]>("/accounting-exports")).data });
  const run = useMutation({
    mutationFn: async () => (await api.post("/accounting-exports", { year, month })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["accounting-exports"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const statusColor = (s: ExportDto["status"]) => ({ Pending: "default", Running: "info", Completed: "success", Failed: "error" } as const)[s];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter(x => {
      if (needle) {
        const hay = `${x.year}-${x.month} ${x.fileName ?? ""} ${x.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (historyYear && String(x.year) !== historyYear) return false;
      if (statusFilter && x.status !== statusFilter) return false;
      return true;
    });
  }, [q.data, search, historyYear, statusFilter]);
  useEffect(() => { setPage(0); }, [search, historyYear, statusFilter]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("accounting.title")}</Typography>
          <Typography color="text.secondary">{t("accounting.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SearchableTextField size="small" select label={t("accounting.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" select label={t("accounting.month")} value={month} onChange={e => setMonth(Number(e.target.value))} sx={{ minWidth: 120 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, "0")}</MenuItem>)}
          </SearchableTextField>
          <Button startIcon={<PlayCircleIcon />} variant="contained" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <CircularProgress size={18} /> : t("accounting.run")}
          </Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* History filter card — separate from the top-right «run new export»
          controls so the operator can drill into the archive without
          re-picking the year they want to run next. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: αρχείο, περίοδος, σημείωση…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <TextField select size="small" label="Έτος αρχείου" fullWidth
            value={historyYear} onChange={(e) => setHistoryYear(e.target.value)}>
            <MenuItem value="">Όλα</MenuItem>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y =>
              <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Κατάσταση" fullWidth
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ExportDto["status"] | "")}>
            <MenuItem value="">Όλες</MenuItem>
            {(["Pending", "Running", "Completed", "Failed"] as const).map(s =>
              <MenuItem key={s} value={s}>{t(`accounting.statusLabel.${s}`)}</MenuItem>)}
          </TextField>
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setHistoryYear(""); setStatusFilter(""); }}
            sx={{ gridColumn: { md: "1 / -1" } }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("accounting.period")}</TableCell>
              <TableCell>{t("accounting.runAt")}</TableCell>
              <TableCell align="right">{t("accounting.entries")}</TableCell>
              <TableCell>{t("accounting.fileName")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("accounting.empty")}</TableCell></TableRow>
              )}
              {paged.map(x => (
                <TableRow key={x.id} hover>
                  <TableCell><Typography fontWeight={700}>{x.year}-{x.month.toString().padStart(2, "0")}</Typography></TableCell>
                  <TableCell>{dateTime(x.runAt)}</TableCell>
                  <TableCell align="right">{x.entries}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{x.fileName ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={statusColor(x.status)} label={t(`accounting.statusLabel.${x.status}`)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}
    </Box>
  );
}
