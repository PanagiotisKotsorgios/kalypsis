import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
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
import { DataExportButton } from "../components/DataExportButton";

const POLICY_TYPES = ["Auto","Home","Health","Life","Business","Travel","Other"] as const;
type PolicyType = typeof POLICY_TYPES[number];
interface TariffDto {
  id: string; name: string; policyType: PolicyType;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  basePremium: number; currency: string; commissionPercent: number | null;
  factorsJson: string | null; notes: string | null;
  isActive: boolean; effectiveFrom: string; effectiveTo: string | null;
}
interface CompanyLite { id: string; name: string; }

export function TariffsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TariffDto | null>(null);

  const q = useQuery({ queryKey: ["tariffs"], queryFn: async () => (await api.get<TariffDto[]>("/tariffs")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/tariffs/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tariffs"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Stack direction="row" alignItems="center" spacing={0.5}><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("tariffs.title")}</Typography><HelpHint id="page.tariffs" /></Stack>
          <Typography color="text.secondary">{t("tariffs.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <DataExportButton entity="tariffs" />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
            {t("tariffs.create")}
          </Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("tariffs.col.name")}</TableCell>
                <TableCell>{t("tariffs.col.type")}</TableCell>
                <TableCell>{t("tariffs.col.company")}</TableCell>
                <TableCell align="right">{t("tariffs.col.premium")}</TableCell>
                <TableCell align="right">{t("tariffs.col.commission")}</TableCell>
                <TableCell>{t("tariffs.col.status")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("tariffs.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={600}>{r.name}</Typography></TableCell>
                  <TableCell>{t(`policyType.${r.policyType}`)}</TableCell>
                  <TableCell>{r.insuranceCompanyName ?? "—"}</TableCell>
                  <TableCell align="right">{r.basePremium.toFixed(2)} {r.currency}</TableCell>
                  <TableCell align="right">{r.commissionPercent != null ? `${r.commissionPercent.toFixed(2)}%` : "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? t("common.active") : t("common.inactive")} />
                  </TableCell>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tariffs"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["tariffs"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: TariffDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data.map(c => ({ id: c.id, name: c.name })) });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "", policyType: "Auto" as PolicyType, insuranceCompanyId: "",
    basePremium: 0, currency: "EUR", commissionPercent: "" as string | number,
    factorsJson: "", notes: "", isActive: true, effectiveFrom: today, effectiveTo: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      name: item.name, policyType: item.policyType, insuranceCompanyId: item.insuranceCompanyId ?? "",
      basePremium: item.basePremium, currency: item.currency, commissionPercent: item.commissionPercent ?? "",
      factorsJson: item.factorsJson ?? "", notes: item.notes ?? "", isActive: item.isActive,
      effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? ""
    });
    else if (open) setForm({
      name: "", policyType: "Auto", insuranceCompanyId: "", basePremium: 0, currency: "EUR",
      commissionPercent: "", factorsJson: "", notes: "", isActive: true, effectiveFrom: today, effectiveTo: ""
    });
  }, [item, open, today]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(), policyType: form.policyType,
        insuranceCompanyId: form.insuranceCompanyId || null,
        basePremium: Number(form.basePremium), currency: form.currency.toUpperCase(),
        commissionPercent: form.commissionPercent === "" ? null : Number(form.commissionPercent),
        factorsJson: form.factorsJson || null, notes: form.notes || null,
        isActive: form.isActive,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null
      };
      if (editing) return (await api.put(`/tariffs/${item!.id}`, body)).data;
      return (await api.post("/tariffs", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("tariffs.editTitle") : t("tariffs.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("tariffs.col.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("tariffs.col.type")} value={form.policyType}
              onChange={e => setForm({ ...form, policyType: e.target.value as PolicyType })} fullWidth>
              {POLICY_TYPES.map(p => <MenuItem key={p} value={p}>{t(`policyType.${p}`)}</MenuItem>)}
            </TextField>
            <TextField select label={t("tariffs.col.company")} value={form.insuranceCompanyId}
              onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("tariffs.col.premium")} value={form.basePremium}
              onChange={e => setForm({ ...form, basePremium: Number(e.target.value) })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
            <TextField type="number" label={t("tariffs.col.commission")} value={form.commissionPercent}
              onChange={e => setForm({ ...form, commissionPercent: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("tariffs.effectiveFrom")} InputLabelProps={{ shrink: true }}
              value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} fullWidth />
            <TextField type="date" label={t("tariffs.effectiveTo")} InputLabelProps={{ shrink: true }}
              value={form.effectiveTo} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("tariffs.factorsJson")} value={form.factorsJson} multiline rows={3}
            onChange={e => setForm({ ...form, factorsJson: e.target.value })} fullWidth
            placeholder='{"ageFactor": 1.1, "zone": {"A": 1.0, "B": 1.2}}' />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
