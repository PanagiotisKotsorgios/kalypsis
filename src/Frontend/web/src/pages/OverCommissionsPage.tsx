import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";

const TYPES = ["","Auto","Home","Health","Life","Business","Travel","Other"] as const;
interface RuleDto {
  id: string; managerProducerId: string; managerName: string;
  subordinateProducerId: string; subordinateName: string;
  level: number; percentage: number; policyType: string | null;
  isActive: boolean; effectiveFrom: string; effectiveTo: string | null;
}

export function OverCommissionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDto | null>(null);

  const q = useQuery({ queryKey: ["over-commission-rules"], queryFn: async () => (await api.get<RuleDto[]>("/over-commission-rules")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/over-commission-rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["over-commission-rules"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("overCommissions.title")}</Typography>
          <Typography color="text.secondary">{t("overCommissions.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("overCommissions.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("overCommissions.level")}</TableCell>
              <TableCell>{t("overCommissions.manager")}</TableCell>
              <TableCell>{t("overCommissions.subordinate")}</TableCell>
              <TableCell>{t("overCommissions.branchType")}</TableCell>
              <TableCell align="right">{t("overCommissions.percentage")}</TableCell>
              <TableCell>{t("overCommissions.effective")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("overCommissions.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Chip size="small" label={`L${r.level}`} color="primary" /></TableCell>
                  <TableCell><Typography fontWeight={700}>{r.managerName}</Typography></TableCell>
                  <TableCell>{r.subordinateName}</TableCell>
                  <TableCell>{r.policyType ? t(`policyType.${r.policyType}`) : t("common.all")}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{r.percentage.toFixed(2)}%</TableCell>
                  <TableCell>{r.effectiveFrom}{r.effectiveTo && ` → ${r.effectiveTo}`}</TableCell>
                  <TableCell><Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["over-commission-rules"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["over-commission-rules"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: RuleDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ managerProducerId: "", subordinateProducerId: "", level: 1, percentage: 0, policyType: "", isActive: true, effectiveFrom: today, effectiveTo: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      managerProducerId: item.managerProducerId, subordinateProducerId: item.subordinateProducerId,
      level: item.level, percentage: item.percentage, policyType: item.policyType ?? "",
      isActive: item.isActive, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? ""
    });
    else if (open) setForm({ managerProducerId: "", subordinateProducerId: "", level: 1, percentage: 0, policyType: "", isActive: true, effectiveFrom: today, effectiveTo: "" });
    // eslint-disable-next-line
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        managerProducerId: form.managerProducerId, subordinateProducerId: form.subordinateProducerId,
        level: Number(form.level), percentage: Number(form.percentage),
        policyType: form.policyType || null, isActive: form.isActive,
        effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null
      };
      if (editing) return (await api.put(`/over-commission-rules/${item!.id}`, body)).data;
      return (await api.post("/over-commission-rules", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("overCommissions.editTitle") : t("overCommissions.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableSelect
            label={t("overCommissions.manager")}
            required
            value={form.managerProducerId}
            onChange={(v) => setForm({ ...form, managerProducerId: v })}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <SearchableSelect
            label={t("overCommissions.subordinate")}
            required
            value={form.subordinateProducerId}
            onChange={(v) => setForm({ ...form, subordinateProducerId: v })}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("overCommissions.level")} value={form.level} onChange={e => setForm({ ...form, level: Number(e.target.value) })} fullWidth>
              {[1,2,3,4,5,6,7,8,9].map(l => <MenuItem key={l} value={l}>L{l}</MenuItem>)}
            </TextField>
            <TextField type="number" required label={t("overCommissions.percentage")} value={form.percentage} onChange={e => setForm({ ...form, percentage: Number(e.target.value) })} fullWidth inputProps={{ step: 0.25, min: 0, max: 100 }} />
            <TextField select label={t("overCommissions.branchType")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} fullWidth>
              {TYPES.map(p => <MenuItem key={p || "_all"} value={p}>{p ? t(`policyType.${p}`) : t("common.all")}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("overCommissions.effectiveFrom")} InputLabelProps={{ shrink: true }} value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} fullWidth />
            <TextField type="date" label={t("overCommissions.effectiveTo")} InputLabelProps={{ shrink: true }} value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} fullWidth />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.managerProducerId || !form.subordinateProducerId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
