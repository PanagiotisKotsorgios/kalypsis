import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableTextField } from "../components/SearchableTextField";

export function PeriodLocksPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scope, setScope] = useState("All");
  const [lockDate, setLockDate] = useState(new Date().toISOString().slice(0, 10));
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["period-locks"], queryFn: async () => (await api.get<any[]>("/period-locks")).data });
  const save = useMutation({
    mutationFn: async () => (await api.post("/period-locks", { scope, lockedBefore: lockDate, autoAdvanceDaily: autoAdvance, reason: reason || null })).data,
    onSuccess: () => { setReason(""); void qc.invalidateQueries({ queryKey: ["period-locks"] }); },
  });
  return <Box>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
      <LockClockIcon color="primary" sx={{ fontSize: 30 }} />
      <Box><Typography variant="h5" fontWeight={850}>Κλειδώματα περιόδων</Typography><Typography variant="body2" color="text.secondary">Προστατέψτε οριστικοποιημένες εγγραφές του γραφείου από αναδρομικές αλλαγές.</Typography></Box>
    </Stack>
    {save.isError && <Alert severity="error" sx={{ mb: 1.5 }}>{extractErrorMessage(save.error)}</Alert>}
    <Card variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "180px 190px auto minmax(220px,1fr) auto" }, gap: 1.25, alignItems: "center" }}>
        <SearchableTextField size="small" label={t("configHub.scope")} value={scope} onChange={e => setScope(e.target.value)}>
          {["All", "Policies", "Receipts", "Claims"].map(s => <MenuItem key={s} value={s}>{String(t(`workflowScope.${s}`, s))}</MenuItem>)}
        </SearchableTextField>
        <TextField size="small" type="date" label={t("configHub.lockedBefore")} InputLabelProps={{ shrink: true }} value={lockDate} onChange={e => setLockDate(e.target.value)} />
        <Stack direction="row" alignItems="center" spacing={.5}><Switch size="small" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} /><Typography variant="body2">{t("configHub.autoAdvance")}</Typography></Stack>
        <TextField size="small" label={t("configHub.reason")} value={reason} onChange={e => setReason(e.target.value)} />
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <CircularProgress size={18} /> : t("common.save")}</Button>
      </Box>
    </Card>
    <Card variant="outlined" sx={{ overflowX: "auto" }}>
      {q.isLoading ? <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box> : <Table size="small">
        <TableHead><TableRow><TableCell>{t("configHub.scope")}</TableCell><TableCell>{t("configHub.lockedBefore")}</TableCell><TableCell>{t("configHub.autoAdvance")}</TableCell><TableCell>{t("configHub.reason")}</TableCell></TableRow></TableHead>
        <TableBody>{(q.data ?? []).map((p: any) => <TableRow key={p.id}><TableCell sx={{ fontWeight: 700 }}>{String(t(`workflowScope.${p.scope}`, p.scope))}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{p.lockedBefore}</TableCell><TableCell>{p.autoAdvanceDaily ? <Chip size="small" color="info" label="Αυτόματο" /> : "—"}</TableCell><TableCell>{p.reason ?? "—"}</TableCell></TableRow>)}</TableBody>
      </Table>}
    </Card>
  </Box>;
}
