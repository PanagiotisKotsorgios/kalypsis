import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";

interface AccessDto {
  id: string; producerId: string; producerName: string;
  isActive: boolean; canIssuePolicies: boolean; canViewCommissions: boolean; canViewCustomers: boolean;
  notes: string | null; lastLoginAt: string | null;
}

export function PartnerPortalsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AccessDto | null>(null);

  const q = useQuery({ queryKey: ["partner-portal-accesses"], queryFn: async () => (await api.get<AccessDto[]>("/partner-portal-accesses")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/partner-portal-accesses/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["partner-portal-accesses"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("partnerPortals.title")}</Typography>
          <Typography color="text.secondary">{t("partnerPortals.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("partnerPortals.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("partnerPortals.producer")}</TableCell>
              <TableCell>{t("partnerPortals.permissions")}</TableCell>
              <TableCell>{t("partnerPortals.lastLogin")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("partnerPortals.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(a => (
                <TableRow key={a.id} hover>
                  <TableCell><Typography fontWeight={700}>{a.producerName}</Typography></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {a.canIssuePolicies && <Chip size="small" label={t("partnerPortals.issue")} color="primary" />}
                      {a.canViewCommissions && <Chip size="small" label={t("partnerPortals.commissions")} variant="outlined" />}
                      {a.canViewCustomers && <Chip size="small" label={t("partnerPortals.customers")} variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell><Chip size="small" color={a.isActive ? "success" : "default"} label={a.isActive ? t("common.active") : t("common.inactive")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(a)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(a.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["partner-portal-accesses"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["partner-portal-accesses"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: AccessDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });

  const [form, setForm] = useState({ producerId: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, notes: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({ producerId: item.producerId, isActive: item.isActive, canIssuePolicies: item.canIssuePolicies, canViewCommissions: item.canViewCommissions, canViewCustomers: item.canViewCustomers, notes: item.notes ?? "" });
    else if (open) setForm({ producerId: "", isActive: true, canIssuePolicies: false, canViewCommissions: true, canViewCustomers: true, notes: "" });
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { producerId: form.producerId, isActive: form.isActive, canIssuePolicies: form.canIssuePolicies, canViewCommissions: form.canViewCommissions, canViewCustomers: form.canViewCustomers, notes: form.notes || null };
      if (editing) return (await api.put(`/partner-portal-accesses/${item!.id}`, body)).data;
      return (await api.post("/partner-portal-accesses", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("partnerPortals.editTitle") : t("partnerPortals.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <SearchableSelect
            label={t("partnerPortals.producer")}
            required
            disabled={editing}
            value={form.producerId}
            onChange={(v) => setForm({ ...form, producerId: v })}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <Stack spacing={1}>
            {[
              { key: "isActive", label: t("common.active") },
              { key: "canIssuePolicies", label: t("partnerPortals.canIssue") },
              { key: "canViewCommissions", label: t("partnerPortals.canViewCommissions") },
              { key: "canViewCustomers", label: t("partnerPortals.canViewCustomers") }
            ].map(o => (
              <Stack key={o.key} direction="row" alignItems="center" spacing={1}>
                <Switch checked={(form as Record<string, unknown>)[o.key] as boolean} onChange={e => setForm({ ...form, [o.key]: e.target.checked })} />
                <Typography>{o.label}</Typography>
              </Stack>
            ))}
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.producerId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
