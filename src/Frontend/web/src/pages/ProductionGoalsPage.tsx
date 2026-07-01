import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";

const TYPES = ["","Auto","Home","Health","Life","Business","Travel","Other"] as const;
interface GoalDto { id: string; producerId: string | null; producerName: string | null; year: number; month: number | null; policyType: string | null; targetPremium: number; targetPolicies: number | null; notes: string | null; }

export function ProductionGoalsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GoalDto | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const q = useQuery({ queryKey: ["production-goals", year], queryFn: async () => (await api.get<GoalDto[]>("/production-goals", { params: { year } })).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/production-goals/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["production-goals"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("goals.title")}</Typography>
          <Typography color="text.secondary">{t("goals.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2}>
          <TextField size="small" select label={t("financials.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("goals.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("goals.producer")}</TableCell>
              <TableCell>{t("goals.period")}</TableCell>
              <TableCell>{t("goals.branch")}</TableCell>
              <TableCell align="right">{t("goals.targetPremium")}</TableCell>
              <TableCell align="right">{t("goals.targetPolicies")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("goals.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(g => (
                <TableRow key={g.id} hover>
                  <TableCell><Typography fontWeight={700}>{g.producerName ?? t("goals.agencyWide")}</Typography></TableCell>
                  <TableCell>{g.year}{g.month && ` · ${g.month.toString().padStart(2, "0")}`}</TableCell>
                  <TableCell>{g.policyType ? t(`policyType.${g.policyType}`) : t("common.all")}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(g.targetPremium)}</TableCell>
                  <TableCell align="right">{g.targetPolicies ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(g)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(g.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null} defaultYear={year}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-goals"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing} defaultYear={year}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["production-goals"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, defaultYear, onSaved }: { open: boolean; onClose: () => void; item: GoalDto | null; defaultYear: number; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });
  const [form, setForm] = useState({ producerId: "", year: defaultYear, month: "", policyType: "", targetPremium: 0, targetPolicies: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      producerId: item.producerId ?? "", year: item.year, month: item.month?.toString() ?? "",
      policyType: item.policyType ?? "", targetPremium: item.targetPremium,
      targetPolicies: item.targetPolicies?.toString() ?? "", notes: item.notes ?? ""
    });
    else if (open) setForm({ producerId: "", year: defaultYear, month: "", policyType: "", targetPremium: 0, targetPolicies: "", notes: "" });
  }, [item, open, defaultYear]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        producerId: form.producerId || null, year: Number(form.year),
        month: form.month === "" ? null : Number(form.month),
        policyType: form.policyType || null,
        targetPremium: Number(form.targetPremium),
        targetPolicies: form.targetPolicies === "" ? null : Number(form.targetPolicies),
        notes: form.notes || null
      };
      if (editing) return (await api.put(`/production-goals/${item!.id}`, body)).data;
      return (await api.post("/production-goals", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("goals.editTitle") : t("goals.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableSelect
            label={t("goals.producer")}
            value={form.producerId}
            onChange={(v) => setForm({ ...form, producerId: v })}
            emptyLabel={t("goals.agencyWide")}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("financials.year")} value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} fullWidth />
            <TextField select label={t("goals.month")} value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} fullWidth>
              <MenuItem value="">{t("goals.yearWide")}</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, "0")}</MenuItem>)}
            </TextField>
            <TextField select label={t("goals.branch")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} fullWidth>
              {TYPES.map(p => <MenuItem key={p || "_all"} value={p}>{p ? t(`policyType.${p}`) : t("common.all")}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" required label={t("goals.targetPremium")} value={form.targetPremium} onChange={e => setForm({ ...form, targetPremium: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("goals.targetPolicies")} value={form.targetPolicies} onChange={e => setForm({ ...form, targetPolicies: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
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
