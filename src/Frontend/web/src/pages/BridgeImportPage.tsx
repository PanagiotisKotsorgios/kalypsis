import { useRef, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface Bridge { id: string; name: string; insuranceCompanyName?: string; isActive: boolean; }
interface BridgeRun {
  id: string; bridgeId: string; bridgeName: string;
  startedAt: string; completedAt: string | null;
  status: string; sourceFile: string | null;
  rowsTotal: number; rowsCreated: number; rowsSkipped: number; rowsFailed: number;
  errorMessage: string | null;
}

const STATUS_COLOR: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Running: "warning", Completed: "success", Failed: "error"
};

export function BridgeImportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [bridgeId, setBridgeId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bridges = useQuery({ queryKey: ["bridges"],
    queryFn: async () => (await api.get<Bridge[]>("/company-bridges")).data });
  const runs = useQuery({ queryKey: ["bridge-runs", bridgeId],
    queryFn: async () => (await api.get<BridgeRun[]>("/bridge-runs", { params: bridgeId ? { bridgeId } : {} })).data,
    refetchInterval: 8_000 });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("bridgeId", bridgeId);
      fd.append("file", file);
      return (await api.post<BridgeRun>("/bridge-runs/import", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (r) => {
      setInfo(t("bridge.imported", { created: r.rowsCreated, skipped: r.rowsSkipped, failed: r.rowsFailed }));
      qc.invalidateQueries({ queryKey: ["bridge-runs"] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <CloudUploadIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("bridge.title")}</Typography>
            <HelpHint id="page.bridge" />
          </Stack>
          <Typography color="text.secondary">{t("bridge.subtitle")}</Typography>
        </Box>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography fontWeight={700} mb={2}>{t("bridge.upload.title")}</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("bridge.csvFormat")}<br />
          <Box component="pre" sx={{ mt: 1, mb: 0, fontFamily: "monospace", fontSize: 12, color: "text.secondary" }}>
            PolicyNumber,CustomerVat,CustomerName,PolicyType,StartDate,EndDate,Premium,Currency{"\n"}
            POL-2026-001,801234567,Παπαδόπουλος Γ.,Auto,2026-01-15,2027-01-15,650.00,EUR
          </Box>
        </Alert>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <TextField select required label={t("bridge.selectBridge")} value={bridgeId} onChange={e => setBridgeId(e.target.value)} sx={{ minWidth: 280 }}>
            {(bridges.data ?? []).map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            {(bridges.data ?? []).length === 0 && <MenuItem disabled value="">{t("bridge.noBridges")}</MenuItem>}
          </TextField>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          <Button variant="contained" startIcon={<CloudUploadIcon />} disabled={!bridgeId || upload.isPending}
            onClick={() => fileRef.current?.click()}>
            {upload.isPending ? <CircularProgress size={18} /> : t("bridge.uploadCsv")}
          </Button>
        </Stack>
      </Card>

      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <Typography fontWeight={700}>{t("bridge.runHistory")}</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField select size="small" label={t("bridge.filterBridge")} value={bridgeId} onChange={e => setBridgeId(e.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">{t("common.all")}</MenuItem>
          {(bridges.data ?? []).map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
        </TextField>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => qc.invalidateQueries({ queryKey: ["bridge-runs"] })}>
          {t("common.refresh")}
        </Button>
      </Stack>

      {runs.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("bridge.bridge")}</TableCell>
              <TableCell>{t("bridge.startedAt")}</TableCell>
              <TableCell>{t("bridge.file")}</TableCell>
              <TableCell align="right">{t("bridge.total")}</TableCell>
              <TableCell align="right">{t("bridge.created")}</TableCell>
              <TableCell align="right">{t("bridge.skipped")}</TableCell>
              <TableCell align="right">{t("bridge.failed")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(runs.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>{t("bridge.noRuns")}</TableCell></TableRow>
              )}
              {(runs.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.bridgeName}</TableCell>
                  <TableCell>{new Date(r.startedAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{r.sourceFile ?? "—"}</TableCell>
                  <TableCell align="right">{r.rowsTotal}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>{r.rowsCreated}</TableCell>
                  <TableCell align="right" sx={{ color: "warning.main" }}>{r.rowsSkipped}</TableCell>
                  <TableCell align="right" sx={{ color: "error.main" }}>{r.rowsFailed}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[r.status] ?? "default"} label={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
