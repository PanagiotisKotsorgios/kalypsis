import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import GavelIcon from "@mui/icons-material/Gavel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface SubmissionDto {
  id: string; submissionNumber: string; transmissionKind: string;
  periodFrom: string; periodTo: string; submittedAt: string;
  status: string; invoiceCount: number; totalAmount: number; currency: string;
  aadeMark: string | null; aadeUid: string | null; errorMessage: string | null; notes: string | null;
}

const KINDS = ["Income", "Expense", "Cancel"];
const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error"> = {
  Pending: "warning", Accepted: "success", Rejected: "error"
};

export function MyDataSubmissionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [marking, setMarking] = useState<SubmissionDto | null>(null);

  const q = useQuery({ queryKey: ["mydata"], queryFn: async () => (await api.get<SubmissionDto[]>("/mydata/submissions")).data });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <GavelIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("mydata.title")}</Typography>
              <HelpHint id="page.mydata" />
            </Stack>
            <Typography color="text.secondary">{t("mydata.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("mydata.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("mydata.number")}</TableCell>
              <TableCell>{t("mydata.kind")}</TableCell>
              <TableCell>{t("mydata.period")}</TableCell>
              <TableCell>{t("mydata.submittedAt")}</TableCell>
              <TableCell align="right">{t("mydata.count")}</TableCell>
              <TableCell align="right">{t("mydata.total")}</TableCell>
              <TableCell>MARK</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("mydata.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(s => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{s.submissionNumber}</TableCell>
                  <TableCell>{s.transmissionKind}</TableCell>
                  <TableCell>{s.periodFrom} → {s.periodTo}</TableCell>
                  <TableCell>{new Date(s.submittedAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell align="right">{s.invoiceCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{s.totalAmount.toFixed(2)} {s.currency}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{s.aadeMark ?? "—"}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.status] ?? "default"} label={s.status} /></TableCell>
                  <TableCell align="right">
                    {s.status === "Pending" && <Button size="small" variant="outlined" onClick={() => setMarking(s)}>{t("mydata.markResult")}</Button>}
                    {s.errorMessage && <Typography variant="caption" color="error">{s.errorMessage}</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["mydata"] }); setCreateOpen(false); }} />
      <MarkDialog submission={marking} onClose={() => setMarking(null)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["mydata"] }); setMarking(null); }} />
    </Box>
  );
}

function CreateDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const monthStart = new Date(); monthStart.setDate(1);
  const today = new Date();
  const [form, setForm] = useState({
    transmissionKind: "Income",
    periodFrom: monthStart.toISOString().slice(0, 10),
    periodTo: today.toISOString().slice(0, 10),
    invoiceCount: 0, totalAmount: 0, currency: "EUR", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/mydata/submissions", {
      transmissionKind: form.transmissionKind,
      periodFrom: form.periodFrom, periodTo: form.periodTo,
      invoiceCount: Number(form.invoiceCount), totalAmount: Number(form.totalAmount),
      currency: form.currency.toUpperCase(), notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("mydata.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select label={t("mydata.kind")} value={form.transmissionKind}
            onChange={e => setForm({ ...form, transmissionKind: e.target.value })} fullWidth>
            {KINDS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("mydata.periodFrom")} InputLabelProps={{ shrink: true }}
              value={form.periodFrom} onChange={e => setForm({ ...form, periodFrom: e.target.value })} fullWidth />
            <TextField type="date" label={t("mydata.periodTo")} InputLabelProps={{ shrink: true }}
              value={form.periodTo} onChange={e => setForm({ ...form, periodTo: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("mydata.count")} value={form.invoiceCount}
              onChange={e => setForm({ ...form, invoiceCount: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("mydata.total")} value={form.totalAmount}
              onChange={e => setForm({ ...form, totalAmount: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField label={t("common.notes")} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("mydata.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MarkDialog({ submission, onClose, onSaved }: { submission: SubmissionDto | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ status: "Accepted", aadeMark: "", aadeUid: "", errorMessage: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setForm({ status: "Accepted", aadeMark: "", aadeUid: "", errorMessage: "" }); }, [submission?.id]);
  const save = useMutation({
    mutationFn: async () => (await api.post(`/mydata/submissions/${submission!.id}/mark`, {
      status: form.status,
      aadeMark: form.aadeMark || null, aadeUid: form.aadeUid || null,
      errorMessage: form.errorMessage || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  if (!submission) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("mydata.markTitle")} {submission.submissionNumber}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select label={t("common.status")} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth>
            <MenuItem value="Accepted">Accepted</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </TextField>
          {form.status === "Accepted" ? (
            <>
              <TextField label="MARK" value={form.aadeMark} onChange={e => setForm({ ...form, aadeMark: e.target.value })} fullWidth />
              <TextField label="UID" value={form.aadeUid} onChange={e => setForm({ ...form, aadeUid: e.target.value })} fullWidth />
            </>
          ) : (
            <TextField label={t("mydata.errorMessage")} value={form.errorMessage}
              onChange={e => setForm({ ...form, errorMessage: e.target.value })} fullWidth multiline rows={3} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
