import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RuleIcon from "@mui/icons-material/Rule";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface RuleDto {
  id: string; name: string;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  policyType: string | null; coverCode: string | null; packageCode: string | null;
  valuesJson: string; priority: number; isActive: boolean; notes: string | null;
}

const TYPES = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Other"];

export function DefaultValueRulesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["dvr"], queryFn: async () => (await api.get<RuleDto[]>("/default-value-rules")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/default-value-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dvr"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      {!embedded && (
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <RuleIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("dvr.title")}</Typography>
              <HelpHint id="page.dvr" />
            </Stack>
            <Typography color="text.secondary">{t("dvr.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} size="large" onClick={() => setOpen({})}>{t("dvr.create")}</Button>
      </Stack>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>{t("dvr.howItWorks")}</Alert>
      {embedded && (
        <Stack direction="row" justifyContent="flex-end" mb={2}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen({})}>{t("dvr.create")}</Button>
        </Stack>
      )}
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("dvr.name")}</TableCell>
              <TableCell>{t("dvr.carrier")}</TableCell>
              <TableCell>{t("dvr.policyType")}</TableCell>
              <TableCell>{t("dvr.cover")}</TableCell>
              <TableCell>{t("dvr.package")}</TableCell>
              <TableCell>{t("dvr.values")}</TableCell>
              <TableCell align="right">{t("dvr.priority")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>{t("dvr.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell>{r.insuranceCompanyName ?? <em>{t("dvr.any")}</em>}</TableCell>
                  <TableCell>{r.policyType ?? <em>{t("dvr.any")}</em>}</TableCell>
                  <TableCell>{r.coverCode ?? <em>{t("dvr.any")}</em>}</TableCell>
                  <TableCell>{r.packageCode ?? <em>{t("dvr.any")}</em>}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.valuesJson}</TableCell>
                  <TableCell align="right">{r.priority}</TableCell>
                  <TableCell><Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setOpen(r)}><EditIcon fontSize="small" /></IconButton>
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
      <RuleDialog item={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["dvr"] }); setOpen(null); }} />
    </Box>
  );
}

function RuleDialog({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "", insuranceCompanyId: "", policyType: "", coverCode: "", packageCode: "",
    valuesJson: '{\n  "Currency": "EUR",\n  "PaymentFrequency": "Annual"\n}',
    priority: 0, isActive: true, notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const carriers = useQuery({ queryKey: ["carriers-for-dvr"], enabled: !!item,
    queryFn: async () => (await api.get<{id:string; name:string}[]>("/insurance-companies")).data });
  useEffect(() => {
    if (item && item.id) setForm({
      ...item,
      insuranceCompanyId: item.insuranceCompanyId ?? "",
      policyType: item.policyType ?? "",
      coverCode: item.coverCode ?? "",
      packageCode: item.packageCode ?? "",
      notes: item.notes ?? ""
    });
    else if (item) setForm({
      name: "", insuranceCompanyId: "", policyType: "", coverCode: "", packageCode: "",
      valuesJson: '{\n  "Currency": "EUR",\n  "PaymentFrequency": "Annual"\n}',
      priority: 0, isActive: true, notes: ""
    });
  }, [item]);
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        insuranceCompanyId: form.insuranceCompanyId || null,
        policyType: form.policyType || null,
        coverCode: form.coverCode || null,
        packageCode: form.packageCode || null,
        valuesJson: form.valuesJson,
        priority: Number(form.priority),
        isActive: form.isActive,
        notes: form.notes || null
      };
      if (item?.id) return (await api.put(`/default-value-rules/${item.id}`, body)).data;
      return (await api.post("/default-value-rules", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  if (!item) return null;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item.id ? t("dvr.edit") : t("dvr.create")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("dvr.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField type="number" label={t("dvr.priority")} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} sx={{ width: 140 }} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("dvr.carrier")} value={form.insuranceCompanyId} onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value })} fullWidth>
              <MenuItem value="">{t("dvr.any")}</MenuItem>
              {(carriers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label={t("dvr.policyType")} value={form.policyType} onChange={e => setForm({ ...form, policyType: e.target.value })} fullWidth>
              <MenuItem value="">{t("dvr.any")}</MenuItem>
              {TYPES.map(tp => <MenuItem key={tp} value={tp}>{tp}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label={t("dvr.cover")} value={form.coverCode} onChange={e => setForm({ ...form, coverCode: e.target.value })} fullWidth placeholder="BASIC / MTPL / EXTRA" />
            <TextField label={t("dvr.package")} value={form.packageCode} onChange={e => setForm({ ...form, packageCode: e.target.value })} fullWidth placeholder="STANDARD / SILVER / GOLD" />
          </Stack>
          <TextField label={t("dvr.values")} value={form.valuesJson}
            onChange={e => setForm({ ...form, valuesJson: e.target.value })}
            fullWidth multiline rows={6} sx={{ fontFamily: "monospace" }}
            helperText={t("dvr.valuesHelp")} />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}
