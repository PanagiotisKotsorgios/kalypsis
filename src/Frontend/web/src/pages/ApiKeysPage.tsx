import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";

interface ApiKeyDto { id: string; name: string; keyPrefix: string; scopes: string; isActive: boolean; lastUsedAt: string | null; expiresAt: string | null; createdAt: string; }
interface CreateResp { key: ApiKeyDto; plaintextSecret: string; }

export function ApiKeysPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreateResp | null>(null);

  const q = useQuery({ queryKey: ["api-keys"], queryFn: async () => (await api.get<ApiKeyDto[]>("/api-keys")).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("apiKeys.title")}</Typography>
          <Typography color="text.secondary">{t("apiKeys.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("apiKeys.create")}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("apiKeys.name")}</TableCell>
              <TableCell>{t("apiKeys.prefix")}</TableCell>
              <TableCell>{t("apiKeys.scopes")}</TableCell>
              <TableCell>{t("apiKeys.lastUsed")}</TableCell>
              <TableCell>{t("apiKeys.expires")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("apiKeys.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(k => (
                <TableRow key={k.id} hover>
                  <TableCell><Typography fontWeight={700}>{k.name}</Typography></TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{k.keyPrefix}…</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{k.scopes || "—"}</TableCell>
                  <TableCell>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("el-GR") : "—"}</TableCell>
                  <TableCell>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString("el-GR") : "—"}</TableCell>
                  <TableCell><Chip size="small" color={k.isActive ? "success" : "default"} label={k.isActive ? t("common.active") : t("apiKeys.revoked")} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("apiKeys.revokeConfirm"))) del.mutate(k.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(resp) => { void qc.invalidateQueries({ queryKey: ["api-keys"] }); setCreateOpen(false); setCreated(resp); }} />
      <SecretDialog secret={created} onClose={() => setCreated(null)} />
    </Box>
  );
}

function FormDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: CreateResp) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", scopes: "read", expiresAt: "" });
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), scopes: form.scopes || "", expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      const res = await api.post<CreateResp>("/api-keys", body);
      return res.data;
    },
    onSuccess: (data) => { setForm({ name: "", scopes: "read", expiresAt: "" }); onCreated(data); },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("apiKeys.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("apiKeys.name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label={t("apiKeys.scopes")} value={form.scopes} onChange={e => setForm({ ...form, scopes: e.target.value })} fullWidth helperText="e.g. read, read,write" />
          <TextField type="date" label={t("apiKeys.expires")} InputLabelProps={{ shrink: true }} value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SecretDialog({ secret, onClose }: { secret: CreateResp | null; onClose: () => void }) {
  const { t } = useTranslation();
  const copy = () => { if (secret) navigator.clipboard.writeText(secret.plaintextSecret); };
  return (
    <Dialog open={!!secret} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("apiKeys.secretTitle")}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>{t("apiKeys.secretWarning")}</Alert>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField value={secret?.plaintextSecret ?? ""} fullWidth InputProps={{ readOnly: true, sx: { fontFamily: "monospace" } }} />
          <IconButton onClick={copy}><ContentCopyIcon /></IconButton>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>{t("common.done")}</Button>
      </DialogActions>
    </Dialog>
  );
}
