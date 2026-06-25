import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { ExportButton } from "../components/ExportButton";

const METHODS = ["Cash","Card","BankTransfer","Cheque","PromissoryNote","Other"] as const;
type Method = typeof METHODS[number];
const BENEFICIARIES = ["InsuranceCompany","Producer","Vendor"] as const;
type BType = typeof BENEFICIARIES[number];
interface PaymentDto {
  id: string; number: string; paidOn: string; beneficiaryType: BType;
  beneficiaryInsuranceCompanyId: string | null; beneficiaryInsuranceCompanyName: string | null;
  beneficiaryProducerId: string | null; beneficiaryProducerName: string | null;
  beneficiaryName: string | null;
  method: Method; amount: number; commissionsNetted: number; currency: string; notes: string | null;
}

export function PaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<Method | "">("");
  const [benFilter, setBenFilter] = useState<BType | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  const q = useQuery({ queryKey: ["payments"], queryFn: async () => (await api.get<PaymentDto[]>("/payments")).data });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payments"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const rawRows = q.data ?? [];
  const filteredRows = rawRows.filter(p => {
    if (methodFilter && p.method !== methodFilter) return false;
    if (benFilter && p.beneficiaryType !== benFilter) return false;
    if (fromDate && p.paidOn < fromDate) return false;
    if (toDate   && p.paidOn > toDate)   return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${p.number} ${p.beneficiaryInsuranceCompanyName ?? ""} ${p.beneficiaryProducerName ?? ""} ${p.beneficiaryName ?? ""} ${p.notes ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const total  = filteredRows.reduce((s, p) => s + p.amount, 0);
  const netted = filteredRows.reduce((s, p) => s + p.commissionsNetted, 0);
  const cashOutTotal = filteredRows.reduce((s, p) => s + (p.amount - p.commissionsNetted), 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Stack direction="row" alignItems="center" spacing={0.5}><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("payments.title")}</Typography><HelpHint id="page.payments" /></Stack>
          <Typography color="text.secondary">{t("payments.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">Σύνολο · Συμψηφισμός · Καθαρή εκροή</Typography>
            <Typography variant="body1" fontWeight={800}>
              {total.toFixed(2)} € · −{netted.toFixed(2)} € · {cashOutTotal.toFixed(2)} €
            </Typography>
          </Box>
          <ExportButton href="/api/exports/payments.csv" />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("payments.create")}</Button>
        </Stack>
      </Stack>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" placeholder="Αριθμός, δικαιούχος, σημείωση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Δικαιούχος"
            value={benFilter} onChange={(e) => setBenFilter(e.target.value as BType | "")}
            sx={{ minWidth: 180 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {BENEFICIARIES.map(b => <MenuItem key={b} value={b}>{t(`payments.benType.${b}`)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Μέθοδος"
            value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as Method | "")}
            sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλες</MenuItem>
            {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="small" onClick={() => {
            setSearch(""); setMethodFilter(""); setBenFilter(""); setFromDate(""); setToDate("");
          }}>Καθαρισμός</Button>
        </Stack>
      </Card>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("payments.number")}</TableCell>
              <TableCell>{t("payments.date")}</TableCell>
              <TableCell>{t("payments.beneficiary")}</TableCell>
              <TableCell>Κατάσταση</TableCell>
              <TableCell>{t("payments.method")}</TableCell>
              <TableCell align="right">{t("payments.amount")}</TableCell>
              <TableCell align="right">{t("payments.netted")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("payments.empty")}</TableCell></TableRow>
              )}
              {filteredRows.map(p => {
                const cashOut = p.amount - p.commissionsNetted;
                const fullyNetted = p.amount > 0 && p.commissionsNetted >= p.amount;
                return (
                <TableRow key={p.id} hover>
                  <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{p.number}</Typography></TableCell>
                  <TableCell>{p.paidOn}</TableCell>
                  <TableCell>{p.beneficiaryInsuranceCompanyName ?? p.beneficiaryProducerName ?? p.beneficiaryName ?? "—"} <Typography variant="caption" color="text.secondary"> · {t(`payments.benType.${p.beneficiaryType}`)}</Typography></TableCell>
                  <TableCell>
                    <Chip size="small"
                      color={fullyNetted ? "success" : cashOut === 0 ? "info" : "warning"}
                      label={fullyNetted ? "Πλήρης συμψηφισμός" : cashOut === 0 ? "Συμψηφισμένο" : "Εκκρεμεί καταβολή"}
                      sx={{ fontWeight: 700 }} />
                  </TableCell>
                  <TableCell>{t(`paymentMethod.${p.method}`)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{p.amount.toFixed(2)} {p.currency}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{p.commissionsNetted.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["payments"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const companies = useQuery({ queryKey: ["insurance-companies-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies")).data });
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    number: "", paidOn: today, beneficiaryType: "InsuranceCompany" as BType,
    beneficiaryInsuranceCompanyId: "", beneficiaryProducerId: "", beneficiaryName: "",
    method: "BankTransfer" as Method, amount: 0, commissionsNetted: 0, currency: "EUR", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm(f => ({ ...f, number: `P-${Date.now().toString().slice(-6)}`, paidOn: today, amount: 0, commissionsNetted: 0 })); /* eslint-disable-next-line */ }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), paidOn: form.paidOn, beneficiaryType: form.beneficiaryType,
        beneficiaryInsuranceCompanyId: form.beneficiaryType === "InsuranceCompany" ? form.beneficiaryInsuranceCompanyId || null : null,
        beneficiaryProducerId: form.beneficiaryType === "Producer" ? form.beneficiaryProducerId || null : null,
        beneficiaryName: form.beneficiaryName || null,
        method: form.method, amount: Number(form.amount), commissionsNetted: Number(form.commissionsNetted),
        currency: form.currency.toUpperCase(), notes: form.notes || null
      };
      return (await api.post("/payments", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("payments.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("payments.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <TextField type="date" label={t("payments.date")} InputLabelProps={{ shrink: true }} value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} fullWidth />
          </Stack>
          <TextField select label={t("payments.benType")} value={form.beneficiaryType} onChange={e => setForm({ ...form, beneficiaryType: e.target.value as BType })} fullWidth>
            {BENEFICIARIES.map(b => <MenuItem key={b} value={b}>{t(`payments.benType.${b}`)}</MenuItem>)}
          </TextField>
          {form.beneficiaryType === "InsuranceCompany" && (
            <TextField select label={t("payments.companyBen")} value={form.beneficiaryInsuranceCompanyId} onChange={e => setForm({ ...form, beneficiaryInsuranceCompanyId: e.target.value })} fullWidth>
              {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          )}
          {form.beneficiaryType === "Producer" && (
            <TextField select label={t("payments.producerBen")} value={form.beneficiaryProducerId} onChange={e => setForm({ ...form, beneficiaryProducerId: e.target.value })} fullWidth>
              {(producers.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          )}
          {form.beneficiaryType === "Vendor" && (
            <TextField label={t("payments.vendorName")} value={form.beneficiaryName} onChange={e => setForm({ ...form, beneficiaryName: e.target.value })} fullWidth />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label={t("payments.method")} value={form.method} onChange={e => setForm({ ...form, method: e.target.value as Method })} fullWidth>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
            </TextField>
            <TextField type="number" required label={t("payments.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField type="number" label={t("payments.netted")} value={form.commissionsNetted} onChange={e => setForm({ ...form, commissionsNetted: Number(e.target.value) })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.number.trim() || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
