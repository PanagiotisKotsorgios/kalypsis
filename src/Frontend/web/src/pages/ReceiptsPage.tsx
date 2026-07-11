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
import { money, date } from "../utils/format";
import { useTableState } from "../components/useTableState";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { NumberedPager } from "../components/TableToolbar";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { InlineCreateCustomerDialog } from "../components/InlineCreateCustomerDialog";
import { useUndoable } from "../components/UndoToast";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";

const METHODS = ["Cash","Card","BankTransfer","Cheque","PromissoryNote","Other"] as const;
type Method = typeof METHODS[number];
interface ReceiptDto {
  id: string; number: string; receivedOn: string;
  customerId: string; customerName: string;
  policyId: string | null; policyNumber: string | null;
  method: Method; amount: number; currency: string; notes: string | null;
  transactionReference: string | null;
}

// Method-specific label for the external reference field. Cash receipts get
// the Ζ report id, card/POS gets the terminal transaction id, bank transfer
// gets the wire ref, cheque gets the cheque number. Falls back to a generic
// label so any other method still has somewhere to record a receipt trail.
function txRefLabelFor(method: Method): string {
  switch (method) {
    case "Cash": return "Αριθμός ταμειακής (Ζ)";
    case "Card": return "Αριθμός συναλλαγής POS";
    case "BankTransfer": return "Αριθμός τραπεζικής συναλλαγής";
    case "Cheque": return "Αριθμός επιταγής";
    case "PromissoryNote": return "Αριθμός γραμματίου";
    default: return "Αριθμός αναφοράς";
  }
}

interface PolicyPaymentSummary {
  policyId: string; policyNumber: string;
  premium: number; paidAmount: number; remainingAmount: number;
  status: "Unpaid" | "Partial" | "Paid" | "Overpaid";
  statusLabelGr: string; lastReceiptDate: string | null; receiptCount: number;
}

const STATUS_COLOR: Record<PolicyPaymentSummary["status"], "default" | "success" | "warning" | "error" | "info"> = {
  Paid: "success", Partial: "warning", Unpaid: "error", Overpaid: "info"
};

function PaidChip({ policyId }: { policyId: string | null }) {
  const q = useQuery({
    queryKey: ["policy-payment-summary", policyId],
    queryFn: async () => (await api.get<PolicyPaymentSummary>(`/policies/${policyId}/payment-summary`)).data,
    enabled: !!policyId, staleTime: 60_000
  });
  if (!policyId) return <Typography variant="caption" color="text.secondary">—</Typography>;
  if (q.isLoading) return <Chip size="small" label="…" />;
  if (!q.data) return <Chip size="small" label="?" />;
  return (
    <Chip size="small" color={STATUS_COLOR[q.data.status]}
      label={`${q.data.statusLabelGr} (${q.data.paidAmount.toFixed(0)}/${q.data.premium.toFixed(0)} €)`}
      sx={{ fontWeight: 700 }} />
  );
}

export function ReceiptsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<Method | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const q = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await api.get<ReceiptDto[]>("/receipts")).data
  });
  const { pushUndoable } = useUndoable();
  const del = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/receipts/${id}`); return id; },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["receipts"] });
      pushUndoable({
        category: "receipts", id,
        message: "Η είσπραξη διαγράφηκε",
        onRestore: () => { void qc.invalidateQueries({ queryKey: ["receipts"] }); }
      });
    },
    onError: e => setErr(extractErrorMessage(e))
  });

  const rawRows = q.data ?? [];
  const filtered = useMemo(() => rawRows.filter(r => {
    if (methodFilter && r.method !== methodFilter) return false;
    if (fromDate && r.receivedOn < fromDate) return false;
    if (toDate   && r.receivedOn > toDate)   return false;
    if (customerFilter) {
      const c = customerFilter.toLowerCase();
      if (!`${r.customerName} ${r.policyNumber ?? ""}`.toLowerCase().includes(c)) return false;
    }
    return true;
  }), [rawRows, methodFilter, fromDate, toDate, customerFilter]);

  const table = useTableState<ReceiptDto>({
    rows: filtered,
    searchableText: (r) => `${r.number} ${r.customerName} ${r.policyNumber ?? ""} ${r.method} ${r.notes ?? ""}`,
    pageSize: 25
  });
  const rows = table.paged;
  const receiptCols = useColumnPreferences("receipts", [
    { key: "number",   label: "Αριθμός απόδειξης", alwaysVisible: true },
    { key: "date",     label: "Ημερομηνία" },
    { key: "customer", label: "Πελάτης" },
    { key: "policy",   label: "Συμβόλαιο" },
    { key: "policyStatus", label: "Κατάσταση συμβολαίου" },
    { key: "method",   label: "Τρόπος" },
    { key: "txRef",    label: "Αναφορά συναλλαγής", defaultVisible: false },
    { key: "amount",   label: "Ποσό" },
  ]);
  const total = filtered.reduce((s, r) => s + r.amount, 0);

  const inferType = (key: string): ColumnType =>
    key === "date" ? "date" : key === "amount" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ReceiptDto> = {
        number: "number", date: "receivedOn", customer: "customerName",
        policy: "policyNumber", method: "method", txRef: "transactionReference",
        amount: "amount",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
    onHide: (key) => receiptCols.toggleVisibility(key),
  });
  const rowMenu = useRowContextMenu<ReceiptDto>({
    entityLabel: "απόδειξης",
    onDelete: (r) => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); },
  });

  useEffect(() => { table.setQuery(search); }, [search, table]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("receipts.title")}</Typography>
            <HelpHint id="page.receipts" />
          </Stack>
          <Typography color="text.secondary">{t("receipts.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("receipts.totalShown")}</Typography>
            <Typography variant="h5" fontWeight={800}>{money(total)}</Typography>
          </Box>
          <DataExportButton entity="receipts" search={search} />
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>{t("receipts.create")}</Button>
        </Stack>
      </Stack>

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" alignItems={{ md: "center" }} useFlexGap>
          <TextField size="small" placeholder="Αναζήτηση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό απόδειξης, πελάτη, συμβόλαιο ή σημείωση." />
            }} />
          <FilterFieldWrap tip="Φιλτράρετε τις αποδείξεις ανά τρόπο πληρωμής (Μετρητά, Κάρτα, Μεταφορά κ.λπ.).">
            <SearchableTextField size="small" label="Μέθοδος"
              value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as Method | "")}
              sx={{ minWidth: 150, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <TextField size="small" label="Πελάτης / Συμβόλαιο"
            value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} sx={{ minWidth: 180 }}
            InputProps={{
              endAdornment: <FilterHelp title="Ονοματεπώνυμο πελάτη ή αριθμός συμβολαίου για στοχευμένη αναζήτηση." />
            }} />
          <FilterFieldWrap tip="Ημερομηνία έκδοσης από — εμφανίζει αποδείξεις από αυτήν την ημέρα και μετά.">
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία έκδοσης έως — εμφανίζει αποδείξεις μέχρι αυτήν την ημέρα.">
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <Button size="small" onClick={() => {
            setSearch(""); setMethodFilter(""); setFromDate(""); setToDate(""); setCustomerFilter("");
          }}>Καθαρισμός</Button>
        </Stack>
      </Card>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              {receiptCols.visibleColumns.map(c => (
                <TableCell
                  key={c.key}
                  align={c.key === "amount" ? "right" : "left"}
                  onContextMenu={(e) => headerMenu.open(e, { key: c.key, label: c.label, type: inferType(c.key), canHide: !c.alwaysVisible })}
                  sx={{ userSelect: "none" }}
                >
                  {c.label}
                </TableCell>
              ))}
              <TableCell align="right" padding="checkbox">
                <ColumnPreferencesButton
                  orderedColumns={receiptCols.orderedColumns}
                  hiddenSet={receiptCols.hiddenSet}
                  toggleVisibility={receiptCols.toggleVisibility}
                  moveColumn={receiptCols.moveColumn}
                  reset={receiptCols.reset}
                />
              </TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={receiptCols.visibleColumns.length + 1} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("receipts.empty")}</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id} hover onContextMenu={(e) => rowMenu.open(e, r)}>
                  {receiptCols.visibleColumns.map(c => {
                    switch (c.key) {
                      case "number":
                        return <TableCell key={c.key}><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{r.number}</Typography></TableCell>;
                      case "date":
                        return <TableCell key={c.key}>{date(r.receivedOn)}</TableCell>;
                      case "customer":
                        return <TableCell key={c.key}>{r.customerName}</TableCell>;
                      case "policy":
                        return <TableCell key={c.key}>{r.policyNumber ?? "—"}</TableCell>;
                      case "policyStatus":
                        return <TableCell key={c.key}><PaidChip policyId={r.policyId} /></TableCell>;
                      case "method":
                        return <TableCell key={c.key}>{t(`paymentMethod.${r.method}`)}</TableCell>;
                      case "txRef":
                        return <TableCell key={c.key} sx={{ fontFamily: "monospace", fontSize: 12 }}>{r.transactionReference ?? "—"}</TableCell>;
                      case "amount":
                        return <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</TableCell>;
                      default: return <TableCell key={c.key}>—</TableCell>;
                    }
                  })}
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["receipts"] });
          void qc.invalidateQueries({ queryKey: ["policy-payment-summary"] });
          setCreateOpen(false);
        }} />
    </Box>
  );
}

function FormDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const customers = useQuery({
    queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string; }[]>("/customers")).data
  });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    number: "", receivedOn: today, customerId: "", policyId: "",
    method: "Cash" as Method, amount: 0, currency: "EUR", notes: "",
    transactionReference: ""
  });
  const [err, setErr] = useState<string | null>(null);
  const [inlineCustomerCreate, setInlineCustomerCreate] = useState<string | null>(null);

  // When customer is picked, fetch their open policies so the user can attach
  // the receipt and auto-mark the contract as paid/partial.
  const customerPolicies = useQuery({
    queryKey: ["customer-policies-for-receipt", form.customerId],
    enabled: open && !!form.customerId,
    queryFn: async () => (await api.get<{ id: string; policyNumber: string; premium: number; insuranceCompanyName: string }[]>(
      "/policies", { params: { customerId: form.customerId } })).data
  });
  const policyPayment = useQuery({
    queryKey: ["policy-payment-summary", form.policyId],
    enabled: open && !!form.policyId,
    queryFn: async () => (await api.get<PolicyPaymentSummary>(`/policies/${form.policyId}/payment-summary`)).data
  });

  useEffect(() => {
    if (open) setForm({
      number: `R-${Date.now().toString().slice(-6)}`, receivedOn: today,
      customerId: "", policyId: "", method: "Cash", amount: 0, currency: "EUR", notes: "",
      transactionReference: ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When the user selects a policy with a remaining balance, prefill the receipt
  // amount with the remaining so the receipt fully clears it (the user can edit).
  useEffect(() => {
    if (policyPayment.data && form.amount === 0) {
      setForm(f => ({ ...f, amount: Number(policyPayment.data.remainingAmount.toFixed(2)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyPayment.data]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), receivedOn: form.receivedOn, customerId: form.customerId,
        policyId: form.policyId || null, method: form.method, amount: Number(form.amount),
        currency: form.currency.toUpperCase(), notes: form.notes || null,
        transactionReference: form.transactionReference.trim() || null
      };
      return (await api.post("/receipts", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("receipts.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label="Αριθμός απόδειξης" value={form.number}
              onChange={e => setForm({ ...form, number: e.target.value })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Μοναδικός αριθμός απόδειξης. Προσυμπληρώνεται αυτόματα — μπορείτε να τον αλλάξετε." /> }} />
            <TextField type="date" label={t("receipts.date")} InputLabelProps={{ shrink: true }}
              value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία λήψης χρημάτων." /> }} />
          </Stack>
          <SearchableSelect
            label={t("receipts.customer")}
            required
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v, policyId: "" })}
            options={(customers.data ?? []).map(c => ({
              value: c.id,
              label: c.type === "Individual"
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : (c.companyName ?? ""),
            }))}
            createNewLabel="+ Νέος πελάτης"
            onCreateNew={(input) => setInlineCustomerCreate(input || "")}
          />
          <InlineCreateCustomerDialog
            open={inlineCustomerCreate !== null}
            prefillText={inlineCustomerCreate ?? ""}
            onClose={() => setInlineCustomerCreate(null)}
            onCreated={(c) => { setForm(prev => ({ ...prev, customerId: c.id, policyId: "" })); setInlineCustomerCreate(null); }}
          />
          {form.customerId && (
            <SearchableSelect
              label="Συμβόλαιο (προαιρετικό)"
              value={form.policyId}
              onChange={(v) => setForm({ ...form, policyId: v, amount: 0 })}
              emptyLabel="— Καμία σύνδεση —"
              options={(customerPolicies.data ?? []).map(p => ({
                value: p.id,
                label: p.policyNumber,
                hint: `${p.insuranceCompanyName} · ${money(p.premium)}`,
              }))}
            />
          )}
          {policyPayment.data && (
            <Alert severity={STATUS_COLOR[policyPayment.data.status] === "success" ? "info" : STATUS_COLOR[policyPayment.data.status] as any}>
              {policyPayment.data.statusLabelGr} · Πληρωμένο {money(policyPayment.data.paidAmount)} / {money(policyPayment.data.premium)} ·
              Υπόλοιπο {money(policyPayment.data.remainingAmount)}
            </Alert>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FilterFieldWrap tip="Τρόπος πληρωμής (Μετρητά, Κάρτα, Μεταφορά κ.λπ.). Καθορίζει και το πεδίο αναφοράς συναλλαγής παρακάτω.">
              <SearchableTextField label={t("receipts.method")} value={form.method}
                onChange={e => setForm({ ...form, method: e.target.value as Method })} fullWidth>
                {METHODS.map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`)}</MenuItem>)}
              </SearchableTextField>
            </FilterFieldWrap>
            <TextField type="number" required label={t("receipts.amount")} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Ποσό απόδειξης. Προσυμπληρώνεται με το υπόλοιπο του συμβολαίου αν έχει επιλεχθεί." /> }} />
            <TextField label={t("tariffs.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Νόμισμα (κωδικός ISO 4217, π.χ. EUR)." /> }} />
          </Stack>
          <TextField label={txRefLabelFor(form.method)} value={form.transactionReference}
            onChange={e => setForm({ ...form, transactionReference: e.target.value })}
            placeholder="π.χ. αρ. συναλλαγής, αρ. επιταγής, ΖZΖ"
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Αναφορά συναλλαγής (αρ. εντολής POS, αρ. επιταγής, IBAN κ.λπ.) — για έλεγχο και συμφωνία." /> }} />
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Προαιρετικές σημειώσεις για την απόδειξη." /> }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.number.trim() || !form.customerId || form.amount <= 0}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
