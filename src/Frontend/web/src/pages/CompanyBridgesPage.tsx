import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SyncIcon from "@mui/icons-material/Sync";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";

const KINDS = ["Manual","ApiPull","Email","Ftp","Webhook"] as const;
type Kind = typeof KINDS[number];

interface BridgeDto {
  id: string; name: string; insuranceCompanyId: string; insuranceCompanyName: string;
  kind: Kind; configJson: string | null;
  isActive: boolean; autoSync: boolean;
  lastSyncAt: string | null; lastSyncRows: number; lastSyncStatus: string | null;
  notes: string | null;
}

export function CompanyBridgesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BridgeDto | null>(null);

  const q = useQuery({ queryKey: ["company-bridges"], queryFn: async () => (await api.get<BridgeDto[]>("/company-bridges")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/company-bridges/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["company-bridges"] }),
    onError: e => setErr(extractErrorMessage(e))
  });
  const sync = useMutation({
    mutationFn: async (id: string) => api.post(`/company-bridges/${id}/sync`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["company-bridges"] }); void qc.invalidateQueries({ queryKey: ["magnetic-imports"] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("companyBridges.title")}</Typography>
          <Typography color="text.secondary">{t("companyBridges.subtitle")}</Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("companyBridges.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("companyBridges.name")}</TableCell>
              <TableCell>{t("companyBridges.company")}</TableCell>
              <TableCell>{t("companyBridges.kind")}</TableCell>
              <TableCell>{t("companyBridges.lastSync")}</TableCell>
              <TableCell>{t("companyBridges.lastStatus")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("companyBridges.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(b => (
                <TableRow key={b.id} hover>
                  <TableCell><Typography fontWeight={700}>{b.name}</Typography></TableCell>
                  <TableCell>{b.insuranceCompanyName}</TableCell>
                  <TableCell><Chip size="small" label={t(`companyBridges.kindLabel.${b.kind}`)} variant="outlined" /></TableCell>
                  <TableCell>
                    {b.lastSyncAt
                      ? <>{new Date(b.lastSyncAt).toLocaleString("el-GR")}{b.lastSyncRows > 0 && <Typography variant="caption" color="text.secondary"> · {b.lastSyncRows} rows</Typography>}</>
                      : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{b.lastSyncStatus ?? "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.3}>
                      <Chip size="small" color={b.isActive ? "success" : "default"} label={b.isActive ? t("common.active") : t("common.inactive")} />
                      {b.autoSync && <Chip size="small" color="primary" label="AUTO" />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" title={t("companyBridges.sync")} onClick={() => sync.mutate(b.id)} disabled={!b.isActive || sync.isPending}>
                      <SyncIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setEditing(b)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(b.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["company-bridges"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["company-bridges"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: BridgeDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies")).data });

  const [form, setForm] = useState({ name: "", insuranceCompanyId: "", kind: "Manual" as Kind, configJson: "", isActive: true, autoSync: false, notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      name: item.name, insuranceCompanyId: item.insuranceCompanyId, kind: item.kind,
      configJson: item.configJson ?? "", isActive: item.isActive, autoSync: item.autoSync, notes: item.notes ?? ""
    });
    else if (open) setForm({ name: "", insuranceCompanyId: "", kind: "Manual", configJson: "", isActive: true, autoSync: false, notes: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), insuranceCompanyId: form.insuranceCompanyId, kind: form.kind,
        configJson: form.configJson || null, isActive: form.isActive, autoSync: form.autoSync, notes: form.notes || null };
      if (editing) return (await api.put(`/company-bridges/${item!.id}`, body)).data;
      return (await api.post("/company-bridges", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("companyBridges.editTitle") : t("companyBridges.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("companyBridges.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <SearchableSelect
            label={t("companyBridges.company")}
            required
            value={form.insuranceCompanyId}
            onChange={(v) => setForm({ ...form, insuranceCompanyId: v })}
            options={(companies.data ?? []).map(c => ({ value: c.id, label: c.name }))}
          />
          <TextField select label={t("companyBridges.kind")} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })} fullWidth>
            {KINDS.map(k => <MenuItem key={k} value={k}>{t(`companyBridges.kindLabel.${k}`)}</MenuItem>)}
          </TextField>
          <TextField label={t("companyBridges.configJson")} value={form.configJson} onChange={e => setForm({ ...form, configJson: e.target.value })} fullWidth multiline rows={4}
            placeholder='{"endpoint":"https://...","apiKey":"...","mapping":{...}}' helperText={t("companyBridges.configHelp")} />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
          <Stack direction="row" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              <Typography>{form.isActive ? t("common.active") : t("common.inactive")}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.autoSync} onChange={e => setForm({ ...form, autoSync: e.target.checked })} />
              <Typography>{t("companyBridges.autoSync")}</Typography>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || !form.insuranceCompanyId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
