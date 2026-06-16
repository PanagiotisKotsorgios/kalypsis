import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderIcon from "@mui/icons-material/Folder";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface FolderDto { id: string; name: string; description: string | null; customerId: string | null; customerName: string | null; parentFolderId: string | null; color: string; }
interface CustomerLite { id: string; type: string; firstName?: string; lastName?: string; companyName?: string; }

export function DocumentManagerPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({ queryKey: ["document-folders"], queryFn: async () => (await api.get<FolderDto[]>("/document-folders")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/document-folders/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["document-folders"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("documentManager.title")}</Typography>
          <Typography color="text.secondary">{t("documentManager.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("documentManager.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (q.data ?? []).length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary", borderStyle: "dashed" }}>
          {t("documentManager.empty")}
        </Card>
      ) : (
        <Grid container spacing={2}>
          {(q.data ?? []).map(f => (
            <Grid item xs={12} sm={6} md={4} key={f.id}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <FolderIcon sx={{ color: f.color }} />
                        <Typography fontWeight={700} noWrap>{f.name}</Typography>
                      </Stack>
                      {f.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{f.description}</Typography>}
                      {f.customerName && <Typography variant="caption" color="text.secondary">{f.customerName}</Typography>}
                    </Box>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(f.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["document-folders"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data });
  const [form, setForm] = useState({ name: "", description: "", customerId: "", color: "#0b2545" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm({ name: "", description: "", customerId: "", color: "#0b2545" }); }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), description: form.description || null, customerId: form.customerId || null, parentFolderId: null, color: form.color };
      return (await api.post("/document-folders", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("documentManager.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("documentManager.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label={t("common.description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
          <TextField select label={t("documentManager.customer")} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} fullWidth>
            <MenuItem value="">—</MenuItem>
            {(customers.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.type === "Individual" ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.companyName}</MenuItem>)}
          </TextField>
          <TextField type="color" label={t("documentManager.color")} value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} sx={{ width: 140 }} />
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
