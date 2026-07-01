import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography
} from "@mui/material";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { dateTime } from "../utils/format";

interface ExportDto { id: string; year: number; month: number; runAt: string; status: "Pending"|"Running"|"Completed"|"Failed"; entries: number; fileName: string | null; notes: string | null; }

export function AccountingExportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const q = useQuery({ queryKey: ["accounting-exports"], queryFn: async () => (await api.get<ExportDto[]>("/accounting-exports")).data });
  const run = useMutation({
    mutationFn: async () => (await api.post("/accounting-exports", { year, month })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["accounting-exports"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const statusColor = (s: ExportDto["status"]) => ({ Pending: "default", Running: "info", Completed: "success", Failed: "error" } as const)[s];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("accounting.title")}</Typography>
          <Typography color="text.secondary">{t("accounting.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField size="small" select label={t("accounting.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <TextField size="small" select label={t("accounting.month")} value={month} onChange={e => setMonth(Number(e.target.value))} sx={{ minWidth: 120 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, "0")}</MenuItem>)}
          </TextField>
          <Button startIcon={<PlayCircleIcon />} variant="contained" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <CircularProgress size={18} /> : t("accounting.run")}
          </Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
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
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("accounting.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(x => (
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
        </Card>
      )}
    </Box>
  );
}
