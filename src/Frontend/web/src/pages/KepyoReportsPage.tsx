import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography
} from "@mui/material";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface KepyoDto { id: string; year: number; runAt: string; status: "Pending"|"Running"|"Completed"|"Failed"; suppliers: number; customers: number; totalAmount: number; fileName: string | null; }

export function KepyoReportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear() - 1);

  const q = useQuery({ queryKey: ["kepyo-reports"], queryFn: async () => (await api.get<KepyoDto[]>("/kepyo-reports")).data });
  const run = useMutation({
    mutationFn: async () => (await api.post("/kepyo-reports", { year })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["kepyo-reports"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const color = (s: KepyoDto["status"]) => ({ Pending: "default", Running: "info", Completed: "success", Failed: "error" } as const)[s];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("kepyo.title")}</Typography>
          <Typography color="text.secondary">{t("kepyo.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField size="small" select label={t("kepyo.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <Button startIcon={<PlayCircleIcon />} variant="contained" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <CircularProgress size={18} /> : t("kepyo.run")}
          </Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("kepyo.year")}</TableCell>
              <TableCell>{t("kepyo.runAt")}</TableCell>
              <TableCell align="right">{t("kepyo.suppliers")}</TableCell>
              <TableCell align="right">{t("kepyo.customers")}</TableCell>
              <TableCell align="right">{t("kepyo.total")}</TableCell>
              <TableCell>{t("kepyo.fileName")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("kepyo.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={700}>{r.year}</Typography></TableCell>
                  <TableCell>{new Date(r.runAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell align="right">{r.suppliers}</TableCell>
                  <TableCell align="right">{r.customers}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{r.totalAmount.toFixed(2)} €</TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{r.fileName ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={color(r.status)} label={t(`accounting.statusLabel.${r.status}`)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
