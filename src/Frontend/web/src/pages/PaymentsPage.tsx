import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { money, date } from "../utils/format";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";

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
  transactionReference: string | null;
  policyId: string | null; policyNumber: string | null;
}

// Same shape as receipts — swap the label for the external reference input
// based on the payment method so a bank transfer records a wire ref, a cheque
// records a cheque number, etc.
function txRefLabelFor(method: Method): string {
  switch (method) {
    case "Cash": return "Αριθμός παραστατικού";
    case "Card": return "Αριθμός συναλλαγής POS";
    case "BankTransfer": return "Αριθμός τραπεζικής συναλλαγής";
    case "Cheque": return "Αριθμός επιταγής";
    case "PromissoryNote": return "Αριθμός γραμματίου";
    default: return "Αριθμός αναφοράς";
  }
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
  const paymentCols = useColumnPreferences("payments", [
    { key: "number",      label: "Αριθμός πληρωμής", alwaysVisible: true },
    { key: "date",        label: "Ημερομηνία" },
    { key: "beneficiary", label: "Δικαιούχος" },
    { key: "status",      label: "Κατάσταση" },
    { key: "method",      label: "Τρόπος" },
    { key: "policy",      label: "Συμβόλαιο", defaultVisible: false },
    { key: "txRef",       label: "Αναφορά συναλλαγής", defaultVisible: false },
    { key: "amount",      label: "Ποσό" },
    { key: "netted",      label: "Συμψηφισμός" },
  ]);
  const cashOutTotal = filteredRows.reduce((s, p) => s + (p.amount - p.commissionsNetted), 0);

  // Right-click sort + hide. Client-side against the already-filtered rows.
  const [sortKey, setSortKey] = useState<keyof PaymentDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const arr = filteredRows.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);
  const inferType = (key: string): ColumnType =>
    key === "date" ? "date" : (key === "amount" || key === "netted") ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof PaymentDto> = {
        number: "number", date: "paidOn", beneficiary: "beneficiaryName",
        method: "method", policy: "policyNumber", txRef: "transactionReference",
        amount: "amount", netted: "commissionsNetted",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
    onHide: (key) => paymentCols.toggleVisibility(key),
  });
  const rowMenu = useRowContextMenu<PaymentDto>({
    entityLabel: "πληρωμής",
    onDelete: (p) => { if (confirm(t("common.confirmDelete"))) del.mutate(p.id); },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Stack direction="row" alignItems="center" spacing={0.5}><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("payments.title")}</Typography><HelpHint id="page.payments" /></Stack>
          <Typography color="text.secondary">{t("payments.subtitle")}</Typography></Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">Σύνολο · Συμψηφισμός · Καθαρή εκροή</Typography>
            <Typography variant="body1" fontWeight={800}>
              {money(total)} · −{money(netted)} · {money(cashOutTotal)}
            </Typography>
          </Box>
          <DataExportButton entity="payments" search={search} />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("payments.create")}</Button>
        </Stack>
      </Stack>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" alignItems={{ md: "center" }} useFlexGap>
          <TextField size="small" placeholder="Αναζήτηση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό εντολής, δικαιούχο ή σημείωση." />
            }} />
          <FilterFieldWrap tip="Φιλτράρετε τις πληρωμές ανά τύπο δικαιούχου (Συνεργάτης, Πελάτης, Εταιρεία).">
            <SearchableTextField size="small" label="Δικαιούχος"
              value={benFilter} onChange={(e) => setBenFilter(e.target.value as BType | "")}
              sx={{ minWidth: 160, width: "100%" }}>
              <MenuItem value="">Όλοι</MenuItem>
              {BENEFICIARIES.map(b => <MenuItem key={b} value={b}>{t(`payments.benType.${b}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε ανά τρόπο πληρωμής (Μετρητά, Κάρτα, Μεταφορά κ.λπ.).">
            <SearchableTextField size="small" label="Μέθοδος"
              value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as Method | "")}
              sx={{ minWidth: 150, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία πληρωμής από — εμφανίζει πληρωμές από αυτήν την ημέρα και μετά.">
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία πληρωμής έως — εμφανίζει πληρωμές μέχρι αυτήν την ημέρα.">
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
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
              {paymentCols.visibleColumns.map(c => (
                <TableCell
                  key={c.key}
                  align={c.key === "amount" || c.key === "netted" ? "right" : "left"}
                  onContextMenu={(e) => headerMenu.open(e, { key: c.key, label: c.label, type: inferType(c.key), canHide: !c.alwaysVisible })}
                  sx={{ userSelect: "none" }}
                >
                  {c.label}
                </TableCell>
              ))}
              <TableCell align="right" padding="checkbox">
                <ColumnPreferencesButton
                  orderedColumns={paymentCols.orderedColumns}
                  hiddenSet={paymentCols.hiddenSet}
                  toggleVisibility={paymentCols.toggleVisibility}
                  moveColumn={paymentCols.moveColumn}
                  reset={paymentCols.reset}
                />
              </TableCell>
            </TableRow></TableHead>
            <TableBody>
              {sortedRows.length === 0 && (
                <TableRow><TableCell colSpan={paymentCols.visibleColumns.length + 1} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("payments.empty")}</TableCell></TableRow>
              )}
              {sortedRows.map(p => {
                const cashOut = p.amount - p.commissionsNetted;
                const fullyNetted = p.amount > 0 && p.commissionsNetted >= p.amount;
                return (
                <TableRow key={p.id} hover onContextMenu={(e) => rowMenu.open(e, p)}>
                  {paymentCols.visibleColumns.map(c => {
                    switch (c.key) {
                      case "number":
                        return <TableCell key={c.key}><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{p.number}</Typography></TableCell>;
                      case "date":
                        return <TableCell key={c.key}>{date(p.paidOn)}</TableCell>;
                      case "beneficiary":
                        return (
                          <TableCell key={c.key}>
                            {p.beneficiaryInsuranceCompanyName ?? p.beneficiaryProducerName ?? p.beneficiaryName ?? "—"}
                            <Typography variant="caption" color="text.secondary"> · {t(`payments.benType.${p.beneficiaryType}`)}</Typography>
                          </TableCell>
                        );
                      case "status":
                        return (
                          <TableCell key={c.key}>
                            <Chip size="small"
                              color={fullyNetted ? "success" : cashOut === 0 ? "info" : "warning"}
                              label={fullyNetted ? "Πλήρης συμψηφισμός" : cashOut === 0 ? "Συμψηφισμένο" : "Εκκρεμεί καταβολή"}
                              sx={{ fontWeight: 700 }} />
                          </TableCell>
                        );
                      case "method":
                        return <TableCell key={c.key}>{t(`paymentMethod.${p.method}`)}</TableCell>;
                      case "policy":
                        return <TableCell key={c.key}>{p.policyNumber ?? "—"}</TableCell>;
                      case "txRef":
                        return <TableCell key={c.key} sx={{ fontFamily: "monospace", fontSize: 12 }}>{p.transactionReference ?? "—"}</TableCell>;
                      case "amount":
                        return <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>{money(p.amount, p.currency)}</TableCell>;
                      case "netted":
                        return <TableCell key={c.key} align="right" sx={{ color: "text.secondary" }}>{money(p.commissionsNetted)}</TableCell>;
                      default: return <TableCell key={c.key}>—</TableCell>;
                    }
                  })}
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
      {headerMenu.menu}
      {rowMenu.menu}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["payments"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const companies = useQuery({ queryKey: ["insurance-companies-lite-used"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies", { params: { onlyUsed: true } })).data });
  const producers = useQuery({ queryKey: ["producers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    number: "", paidOn: today, beneficiaryType: "InsuranceCompany" as BType,
    beneficiaryInsuranceCompanyId: "", beneficiaryProducerId: "", beneficiaryName: "",
    method: "BankTransfer" as Method, amount: 0, commissionsNetted: 0, currency: "EUR", notes: "",
    transactionReference: "", policyId: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm(f => ({ ...f, number: `P-${Date.now().toString().slice(-6)}`, paidOn: today, amount: 0, commissionsNetted: 0, transactionReference: "", policyId: "" })); /* eslint-disable-next-line */ }, [open]);

  // Policies list for the current beneficiary carrier — used when the operator
  // wants to attach a payment against a specific contract (e.g. mid-term
  // settlement). Empty for producer/vendor beneficiaries.
  const carrierPolicies = useQuery({
    queryKey: ["carrier-policies-for-payment", form.beneficiaryInsuranceCompanyId],
    enabled: open && form.beneficiaryType === "InsuranceCompany" && !!form.beneficiaryInsuranceCompanyId,
    queryFn: async () => (await api.get<{ id: string; policyNumber: string; premium: number; customerName?: string }[]>(
      "/policies", { params: { insuranceCompanyId: form.beneficiaryInsuranceCompanyId } })).data
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), paidOn: form.paidOn, beneficiaryType: form.beneficiaryType,
        beneficiaryInsuranceCompanyId: form.beneficiaryType === "InsuranceCompany" ? form.beneficiaryInsuranceCompanyId || null : null,
        beneficiaryProducerId: form.beneficiaryType === "Producer" ? form.beneficiaryProducerId || null : null,
        beneficiaryName: form.beneficiaryName || null,
        method: form.method, amount: Number(form.amount), commissionsNetted: Number(form.commissionsNetted),
        currency: form.currency.toUpperCase(), notes: form.notes || null,
        transactionReference: form.transactionReference.trim() || null,
        policyId: form.beneficiaryType === "InsuranceCompany" && form.policyId ? form.policyId : null
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
            <TextField required label="Αριθμός πληρωμής" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Μοναδικός αριθμός εντολής πληρωμής. Προσυμπληρώνεται — μπορείτε να τον αλλάξετε." /> }} />
            <TextField type="date" label={t("payments.date")} InputLabelProps={{ shrink: true }} value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία εκτέλεσης πληρωμής." /> }} />
          </Stack>
          <FilterFieldWrap tip="Τύπος δικαιούχου: Ασφαλιστική εταιρεία, Συνεργάτης, Προμηθευτής. Καθορίζει τα επόμενα πεδία.">
            <SearchableTextField label={t("payments.benType")} value={form.beneficiaryType} onChange={e => setForm({ ...form, beneficiaryType: e.target.value as BType })} fullWidth>
              {BENEFICIARIES.map(b => <MenuItem key={b} value={b}>{t(`payments.benType.${b}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          {form.beneficiaryType === "InsuranceCompany" && (
            <SearchableSelect
              label={t("payments.companyBen")}
              value={form.beneficiaryInsuranceCompanyId}
              onChange={(v) => setForm({ ...form, beneficiaryInsuranceCompanyId: v, policyId: "" })}
              options={(companies.data ?? []).map(c => ({ value: c.id, label: c.name }))}
            />
          )}
          {form.beneficiaryType === "InsuranceCompany" && form.beneficiaryInsuranceCompanyId && (
            <SearchableSelect
              label="Συμβόλαιο (προαιρετικό)"
              value={form.policyId}
              onChange={(v) => setForm({ ...form, policyId: v })}
              emptyLabel="— Καμία σύνδεση —"
              options={(carrierPolicies.data ?? []).map(p => ({
                value: p.id,
                label: p.policyNumber,
                hint: `${p.customerName ?? ""} · ${money(p.premium)}`,
              }))}
            />
          )}
          {form.beneficiaryType === "Producer" && (
            <SearchableSelect
              label={t("payments.producerBen")}
              value={form.beneficiaryProducerId}
              onChange={(v) => setForm({ ...form, beneficiaryProducerId: v })}
              options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
            />
          )}
          {form.beneficiaryType === "Vendor" && (
            <TextField label={t("payments.vendorName")} value={form.beneficiaryName} onChange={e => setForm({ ...form, beneficiaryName: e.target.value })} fullWidth />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FilterFieldWrap tip="Τρόπος πληρωμής (Μετρητά, Μεταφορά, Κάρτα κ.λπ.).">
              <SearchableTextField label={t("payments.method")} value={form.method} onChange={e => setForm({ ...form, method: e.target.value as Method })} fullWidth>
                {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
              </SearchableTextField>
            </FilterFieldWrap>
            <TextField type="number" required label={t("payments.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Μικτό ποσό πληρωμής προς τον δικαιούχο (πριν από συμψηφισμό προμηθειών)." /> }} />
            <TextField type="number" label={t("payments.netted")} value={form.commissionsNetted} onChange={e => setForm({ ...form, commissionsNetted: Number(e.target.value) })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Ποσό προμηθειών που συμψηφίστηκαν από την πληρωμή (νετάρισμα). Καθαρή πληρωμή = Ποσό - Συμψηφισμός." /> }} />
          </Stack>
          <TextField label={txRefLabelFor(form.method)} value={form.transactionReference}
            onChange={e => setForm({ ...form, transactionReference: e.target.value })}
            placeholder="π.χ. αρ. συναλλαγής, αρ. επιταγής"
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Αναφορά συναλλαγής (αρ. εντολής, αρ. επιταγής, IBAN κ.λπ.) — για έλεγχο και συμφωνία." /> }} />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Προαιρετικές σημειώσεις για την πληρωμή." /> }} />
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
