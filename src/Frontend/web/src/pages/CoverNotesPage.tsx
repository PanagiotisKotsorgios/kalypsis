import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";

const TYPES = ["Auto","Home","Health","Life","Business","Travel","Other"] as const;
const STATUSES = ["Active","Converted","Expired","Cancelled"] as const;
type Status = typeof STATUSES[number];
interface CoverNoteDto {
  id: string; number: string; customerId: string; customerName: string;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  policyType: typeof TYPES[number]; validFrom: string; validUntil: string;
  estimatedPremium: number | null; currency: string; status: Status;
  convertedToPolicyId: string | null; subject: string | null; notes: string | null;
}

export function CoverNotesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CoverNoteDto | null>(null);

  const q = useQuery({ queryKey: ["cover-notes"], queryFn: async () => (await api.get<CoverNoteDto[]>("/cover-notes")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/cover-notes/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cover-notes"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const colors: Record<Status, "info" | "success" | "warning" | "default"> = { Active: "info", Converted: "success", Expired: "warning", Cancelled: "default" };

  const printNote = (n: CoverNoteDto) => {
    const w = window.open("", "_blank", "width=700,height=900");
    if (!w) return;
    w.document.write(`<html><head><title>${n.number}</title>
      <style>body{font-family:system-ui;padding:32px}h1{margin:0}h2{margin:0 0 4px;color:#444}.row{margin:8px 0}b{display:inline-block;width:160px;color:#666}</style>
      </head><body>
      <h2>COVER NOTE / ΠΡΟΣΩΡΙΝΟ ΠΙΣΤΟΠΟΙΗΤΙΚΟ</h2>
      <h1>${n.number}</h1>
      <div class="row"><b>Πελάτης</b>${n.customerName}</div>
      <div class="row"><b>Εταιρεία</b>${n.insuranceCompanyName ?? "—"}</div>
      <div class="row"><b>Κλάδος</b>${n.policyType}</div>
      <div class="row"><b>Ισχύς</b>${n.validFrom} → ${n.validUntil}</div>
      <div class="row"><b>Εκτιμώμενο</b>${n.estimatedPremium ?? "—"} ${n.currency}</div>
      <div class="row"><b>Θέμα</b>${n.subject ?? "—"}</div>
      <hr/><p>Παράγεται αυτόματα από Kalypsis Insurance Platform.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("coverNotes.title")}</Typography>
          <Typography color="text.secondary">{t("coverNotes.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("coverNotes.create")}</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("coverNotes.number")}</TableCell>
              <TableCell>{t("coverNotes.customer")}</TableCell>
              <TableCell>{t("coverNotes.type")}</TableCell>
              <TableCell>{t("coverNotes.validity")}</TableCell>
              <TableCell align="right">{t("coverNotes.premium")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("coverNotes.empty")}</TableCell></TableRow>
              )}
              {(q.data ?? []).map(n => (
                <TableRow key={n.id} hover>
                  <TableCell><Typography fontWeight={700}>{n.number}</Typography></TableCell>
                  <TableCell>{n.customerName}</TableCell>
                  <TableCell>{t(`policyType.${n.policyType}`)}</TableCell>
                  <TableCell>{n.validFrom} → {n.validUntil}</TableCell>
                  <TableCell align="right">{n.estimatedPremium != null ? money(n.estimatedPremium, n.currency) : "—"}</TableCell>
                  <TableCell><Chip size="small" color={colors[n.status]} label={t(`coverNotes.status.${n.status}`)} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title={t("coverNotes.print")} onClick={() => printNote(n)}><PrintIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setEditing(n)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(n.id); }}>
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
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cover-notes"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cover-notes"] }); setEditing(null); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: CoverNoteDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string; }[]>("/customers")).data });
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies")).data });

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date(); month.setDate(month.getDate() + 30);
  const [form, setForm] = useState({
    number: "", customerId: "", insuranceCompanyId: "", policyType: "Auto" as typeof TYPES[number],
    validFrom: today, validUntil: month.toISOString().slice(0, 10),
    estimatedPremium: "" as string | number, currency: "EUR", status: "Active" as Status,
    subject: "", notes: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      number: item.number, customerId: item.customerId, insuranceCompanyId: item.insuranceCompanyId ?? "",
      policyType: item.policyType, validFrom: item.validFrom, validUntil: item.validUntil,
      estimatedPremium: item.estimatedPremium ?? "", currency: item.currency, status: item.status,
      subject: item.subject ?? "", notes: item.notes ?? ""
    });
    else if (open) setForm({
      number: `CN-${Date.now().toString().slice(-6)}`, customerId: "", insuranceCompanyId: "",
      policyType: "Auto", validFrom: today, validUntil: month.toISOString().slice(0, 10),
      estimatedPremium: "", currency: "EUR", status: "Active", subject: "", notes: ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), customerId: form.customerId,
        insuranceCompanyId: form.insuranceCompanyId || null,
        policyType: form.policyType, validFrom: form.validFrom, validUntil: form.validUntil,
        estimatedPremium: form.estimatedPremium === "" ? null : Number(form.estimatedPremium),
        currency: form.currency, status: form.status,
        subject: form.subject || null, notes: form.notes || null
      };
      if (editing) return (await api.put(`/cover-notes/${item!.id}`, body)).data;
      return (await api.post("/cover-notes", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("coverNotes.editTitle") : t("coverNotes.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField required label={t("coverNotes.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
          <SearchableSelect
            label={t("coverNotes.customer")}
            required
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            options={(customers.data ?? []).map(c => ({
              value: c.id,
              label: c.type === "Individual"
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : (c.companyName ?? ""),
            }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("coverNotes.type")} value={form.policyType}
              onChange={e => setForm({ ...form, policyType: e.target.value as typeof TYPES[number] })} fullWidth>
              {TYPES.map(p => <MenuItem key={p} value={p}>{t(`policyType.${p}`)}</MenuItem>)}
            </TextField>
            <SearchableSelect
              label={t("coverNotes.company")}
              value={form.insuranceCompanyId}
              onChange={(v) => setForm({ ...form, insuranceCompanyId: v })}
              emptyLabel="—"
              options={(companies.data ?? []).map(c => ({ value: c.id, label: c.name }))}
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("coverNotes.from")} InputLabelProps={{ shrink: true }}
              value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} fullWidth />
            <TextField type="date" label={t("coverNotes.until")} InputLabelProps={{ shrink: true }}
              value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label={t("coverNotes.premium")} value={form.estimatedPremium}
              onChange={e => setForm({ ...form, estimatedPremium: e.target.value })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
            <TextField select label={t("common.status")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Status })} fullWidth>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`coverNotes.status.${s}`)}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label={t("coverNotes.subject")} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.number.trim() || !form.customerId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
