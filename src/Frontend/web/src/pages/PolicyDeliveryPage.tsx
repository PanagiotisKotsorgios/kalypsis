import { useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface DeliveryRow {
  policyId: string; policyNumber: string; customerName: string;
  startDate: string; premium: number; currency: string;
  deliveredAt: string | null; deliveredTo: string | null; deliveryMethod: string | null;
}

const METHODS = ["Hand", "Post", "Email", "Courier"];

interface PolicyDeliveryPageProps {
  embedded?: boolean;
}

export function PolicyDeliveryPage({ embedded = false }: PolicyDeliveryPageProps = {}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markOpen, setMarkOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["delivery-pending"], queryFn: async () =>
    (await api.get<DeliveryRow[]>("/policy-delivery/pending")).data });

  const toggle = (id: string) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
  };
  const toggleAll = () => {
    if (selected.size === (q.data ?? []).length) setSelected(new Set());
    else setSelected(new Set((q.data ?? []).map(r => r.policyId)));
  };

  const markButton = (
    <Button variant="contained" size="large" disabled={selected.size === 0} onClick={() => setMarkOpen(true)}>
      {t("delivery.markSelected", { count: selected.size })}
    </Button>
  );

  return (
    <Box>
      {embedded ? (
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} mb={2} gap={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
              <HelpHint id="page.delivery" />
            </Stack>
            <Typography variant="body2" color="text.secondary">{t("delivery.subtitle")}</Typography>
          </Box>
          {markButton}
        </Stack>
      ) : (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <LocalShippingIcon sx={{ fontSize: 36 }} color="primary" />
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("delivery.title")}</Typography>
                <HelpHint id="page.delivery" />
              </Stack>
              <Typography color="text.secondary">{t("delivery.subtitle")}</Typography>
            </Box>
          </Stack>
          {markButton}
        </Stack>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell padding="checkbox">
                <Checkbox indeterminate={selected.size > 0 && selected.size < (q.data ?? []).length}
                  checked={selected.size > 0 && selected.size === (q.data ?? []).length}
                  onChange={toggleAll} />
              </TableCell>
              <TableCell>{t("delivery.policyNumber")}</TableCell>
              <TableCell>{t("delivery.customer")}</TableCell>
              <TableCell>{t("delivery.startDate")}</TableCell>
              <TableCell align="right">{t("delivery.premium")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("delivery.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(r => (
                <TableRow key={r.policyId} hover selected={selected.has(r.policyId)} onClick={() => toggle(r.policyId)} sx={{ cursor: "pointer" }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.has(r.policyId)} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>{r.startDate}</TableCell>
                  <TableCell align="right">{r.premium.toFixed(2)} {r.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <MarkDialog open={markOpen} onClose={() => setMarkOpen(false)} policyIds={Array.from(selected)}
        onMarked={() => { void qc.invalidateQueries({ queryKey: ["delivery-pending"] }); setSelected(new Set()); setMarkOpen(false); }} />
    </Box>
  );
}

function MarkDialog({ open, onClose, policyIds, onMarked }: { open: boolean; onClose: () => void; policyIds: string[]; onMarked: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ deliveredAt: today, deliveredTo: "", deliveryMethod: "Hand" });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post<number>("/policy-delivery/mark-delivered", {
      policyIds, deliveredAt: form.deliveredAt,
      deliveredTo: form.deliveredTo || null, deliveryMethod: form.deliveryMethod
    })).data,
    onSuccess: onMarked, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("delivery.markDialog", { count: policyIds.length })}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField type="date" label={t("delivery.deliveredAt")} InputLabelProps={{ shrink: true }}
            value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} fullWidth />
          <TextField label={t("delivery.deliveredTo")} value={form.deliveredTo}
            onChange={e => setForm({ ...form, deliveredTo: e.target.value })} fullWidth
            placeholder={t("delivery.deliveredToPlaceholder")} />
          <TextField select label={t("delivery.method")} value={form.deliveryMethod}
            onChange={e => setForm({ ...form, deliveryMethod: e.target.value })} fullWidth>
            {METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
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
