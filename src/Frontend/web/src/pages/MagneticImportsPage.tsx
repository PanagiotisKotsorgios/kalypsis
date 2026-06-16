import { useRef, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface ImportDto { id: string; fileName: string; source: string; status: "Pending"|"Running"|"Completed"|"Failed"; rows: number; matched: number; failed: number; createdAt: string; completedAt: string | null; notes: string | null; }

export function MagneticImportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["magnetic-imports"], queryFn: async () => (await api.get<ImportDto[]>("/magnetic-imports")).data });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", source || "—");
      return (await api.post("/magnetic-imports", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => { if (fileRef.current) fileRef.current.value = ""; void qc.invalidateQueries({ queryKey: ["magnetic-imports"] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setErr(null);
    upload.mutate(f);
  };

  const color = (s: ImportDto["status"]) => ({ Pending: "default", Running: "info", Completed: "success", Failed: "error" } as const)[s];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("magnetic.title")}</Typography>
          <Typography color="text.secondary">{t("magnetic.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField size="small" label={t("magnetic.source")} value={source} onChange={e => setSource(e.target.value)} placeholder="Ασφαλιστική A" sx={{ minWidth: 200 }} />
          <input ref={fileRef} type="file" accept=".csv,.txt,.xml" hidden onChange={handleFile} />
          <Button startIcon={<UploadIcon />} variant="contained" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <CircularProgress size={18} /> : t("magnetic.upload")}
          </Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("magnetic.fileName")}</TableCell>
              <TableCell>{t("magnetic.source")}</TableCell>
              <TableCell align="right">{t("magnetic.rows")}</TableCell>
              <TableCell align="right">{t("magnetic.matched")}</TableCell>
              <TableCell align="right">{t("magnetic.failed")}</TableCell>
              <TableCell>{t("magnetic.completedAt")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("magnetic.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(m => (
                <TableRow key={m.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{m.fileName}</TableCell>
                  <TableCell>{m.source}</TableCell>
                  <TableCell align="right">{m.rows}</TableCell>
                  <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>{m.matched}</TableCell>
                  <TableCell align="right" sx={{ color: m.failed > 0 ? "error.main" : "text.secondary" }}>{m.failed}</TableCell>
                  <TableCell>{m.completedAt ? new Date(m.completedAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell><Chip size="small" color={color(m.status)} label={t(`accounting.statusLabel.${m.status}`)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}
