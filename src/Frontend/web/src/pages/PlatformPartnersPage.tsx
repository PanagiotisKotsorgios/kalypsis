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

interface PartnerDto {
  id: string;
  name: string;
  logoUrl: string | null;
  url: string | null;
  displayOrder: number;
  isActive: boolean;
}

export function PlatformPartnersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerDto | null>(null);

  const q = useQuery({
    queryKey: ["platform-partners"],
    queryFn: async () => (await api.get<PartnerDto[]>("/platform/partners")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/partners/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["platform-partners"] }); void qc.invalidateQueries({ queryKey: ["public-partners"] }); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("platformPartners.title")}</Typography>
          <Typography color="text.secondary">{t("platformPartners.subtitle")}</Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          {t("platformPartners.create")}
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={70}>{t("platformPartners.order")}</TableCell>
                <TableCell>{t("platformPartners.name")}</TableCell>
                <TableCell>{t("platformPartners.url")}</TableCell>
                <TableCell>{t("common.status")}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>
                    {t("platformPartners.empty")}
                  </TableCell>
                </TableRow>
              )}
              {(q.data ?? []).map(p => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{p.displayOrder}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {p.logoUrl && (
                        <Box component="img" src={p.logoUrl} alt="" sx={{
                          width: 36, height: 36, objectFit: "contain",
                          border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper"
                        }} />
                      )}
                      <Typography fontWeight={700}>{p.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: 13 }}>
                    {p.url ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={p.isActive ? "success" : "default"}
                      label={p.isActive ? t("common.active") : t("common.inactive")} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        item={null}
        nextOrder={(q.data?.length ?? 0) * 10 + 10}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-partners"] });
          void qc.invalidateQueries({ queryKey: ["public-partners"] });
          setCreateOpen(false);
        }}
      />
      <FormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editing}
        nextOrder={0}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-partners"] });
          void qc.invalidateQueries({ queryKey: ["public-partners"] });
          setEditing(null);
        }}
      />
    </Box>
  );
}

function FormDialog({
  open, onClose, item, nextOrder, onSaved
}: {
  open: boolean;
  onClose: () => void;
  item: PartnerDto | null;
  nextOrder: number;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!item;
  const [form, setForm] = useState({
    name: "", logoUrl: "", url: "", displayOrder: 10, isActive: true
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        logoUrl: item.logoUrl ?? "",
        url: item.url ?? "",
        displayOrder: item.displayOrder,
        isActive: item.isActive
      });
    } else if (open) {
      setForm({ name: "", logoUrl: "", url: "", displayOrder: nextOrder || 10, isActive: true });
    }
  }, [item, open, nextOrder]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || null,
        url: form.url.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive
      };
      if (editing) return (await api.put(`/platform/partners/${item!.id}`, body)).data;
      return (await api.post("/platform/partners", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("platformPartners.editTitle") : t("platformPartners.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField
            required label={t("platformPartners.name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth
            helperText={t("platformPartners.nameHelp")}
          />
          <TextField
            label={t("platformPartners.logoUrl")} value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} fullWidth
            placeholder="https://..."
          />
          <TextField
            label={t("platformPartners.url")} value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })} fullWidth
            placeholder="https://..."
          />
          <TextField
            type="number" label={t("platformPartners.order")} value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} fullWidth
            helperText={t("platformPartners.orderHelp")}
          />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
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
