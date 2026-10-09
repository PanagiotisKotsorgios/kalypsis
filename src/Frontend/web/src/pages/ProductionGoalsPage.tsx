import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { exportRowsCsv } from "../utils/exportCsv";

const TYPES = ["","Auto","Home","Health","Life","Business","Travel","Other"] as const;
interface GoalDto { id: string; producerId: string | null; producerName: string | null; year: number; month: number | null; policyType: string | null; targetPremium: number; targetPolicies: number | null; notes: string | null; }

export function ProductionGoalsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GoalDto | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [producerFilter, setProducerFilter] = useState("");

  const q = useQuery({ queryKey: ["production-goals", year], queryFn: async () => (await api.get<GoalDto[]>("/production-goals", { params: { year } })).data });
  const filteredGoals = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return (q.data ?? []).filter(goal => {
      const text = `${goal.producerName ?? "Όλο το γραφείο"} ${goal.policyType ?? ""} ${goal.notes ?? ""}`.toLocaleLowerCase("el-GR");
      return (!term || text.includes(term)) && (!producerFilter || goal.producerId === producerFilter);
    });
  }, [q.data, search, producerFilter]);
  const producerOptions = useMemo(() => Array.from(new Map((q.data ?? []).filter(g => g.producerId && g.producerName).map(g => [g.producerId!, g.producerName!])).entries()), [q.data]);
  const exportGoals = () => void exportRowsCsv({
    fileName: `στόχοι-παραγωγής-${year}`,
    columns: [
      { key: "producerName", label: "Συνεργάτης" },
      { key: "period", label: "Περίοδος" },
      { key: "branch", label: "Κλάδος" },
      { key: "targetPremium", label: "Στόχος ασφαλίστρου" },
      { key: "targetPolicies", label: "Στόχος συμβολαίων" }
    ],
    rows: filteredGoals.map(g => ({ producerName: g.producerName ?? "Όλο το γραφείο", period: `${g.year}${g.month ? `-${String(g.month).padStart(2, "0")}` : ""}`, branch: g.policyType ?? "Όλοι οι κλάδοι", targetPremium: g.targetPremium, targetPolicies: g.targetPolicies ?? "" }))
  });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/production-goals/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["production-goals"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("goals.title")}</Typography>
          <Typography color="text.secondary">{t("goals.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2}>
          <SearchableTextField size="small" select label={t("financials.year")} value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </SearchableTextField>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)} sx={{ minWidth: 155, whiteSpace: "nowrap", flexShrink: 0 }}>{t("goals.create")}</Button>
        </Stack>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Card variant="outlined" sx={{ mb: 2, borderColor: "primary.light" }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} flexWrap="wrap">
            <TextField size="small" label="Αναζήτηση συνεργάτη ή κλάδου" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: { xs: "100%", sm: 260 }, flex: 1 }} />
            <SearchableTextField size="small" select label="Συνεργάτης" value={producerFilter} onChange={e => setProducerFilter(e.target.value)} sx={{ minWidth: 190 }}>
              <MenuItem value="">Όλοι οι συνεργάτες</MenuItem>
              {producerOptions.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
            </SearchableTextField>
            <Button color="error" variant="outlined" onClick={() => { setSearch(""); setProducerFilter(""); }}>Καθαρισμός</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportGoals} sx={{ whiteSpace: "nowrap" }}>Εξαγωγή CSV</Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: { md: "auto" } }}>{filteredGoals.length} στόχοι</Typography>
          </Stack>
        </CardContent>
      </Card>
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
              {filteredGoals.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("goals.empty")}</TableCell></TableRow>
              )}
              {filteredGoals.map(g => (
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
            <SearchableTextField label={t("goals.month")} value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} fullWidth>
              <MenuItem value="">{t("goals.yearWide")}</MenuItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, "0")}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("goals.branch")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} fullWidth>
              {TYPES.map(p => <MenuItem key={p || "_all"} value={p}>{p ? t(`policyType.${p}`) : t("common.all")}</MenuItem>)}
            </SearchableTextField>
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
