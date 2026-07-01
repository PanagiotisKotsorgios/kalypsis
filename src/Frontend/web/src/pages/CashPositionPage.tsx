import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money } from "../utils/format";
import { NumberedPager } from "../components/TableToolbar";
import { SearchableSelect } from "../components/SearchableSelect";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend
} from "recharts";

const REASON_PRESETS = [
  "Είσπραξη ασφαλίστρου", "Πληρωμή προμήθειας συνεργάτη",
  "Απόδοση σε ασφαλιστική εταιρία", "Έκδοση επιταγής",
  "Εξόφληση τιμολογίου προμηθευτή", "Ανάληψη ιδιοκτήτη",
  "Κατάθεση κεφαλαίου", "Μεταφορά μεταξύ ταμείων", "Λοιπά έσοδα", "Λοιπά έξοδα"
];

interface CashAccountDto { id: string; code: string; name: string; currency: string; currentBalance: number; isActive: boolean; notes: string | null; }
interface MovementDto {
  id: string; cashAccountId: string; cashAccountName: string;
  movementDate: string; direction: string; amount: number; currency: string;
  reason: string; reference: string | null;
}

export function CashPositionPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newMovementOpen, setNewMovementOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"In" | "Out" | "">("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const accounts = useQuery({ queryKey: ["cash-accounts"], queryFn: async () => (await api.get<CashAccountDto[]>("/cash/accounts")).data });
  const movements = useQuery({
    queryKey: ["cash-movements", filter],
    queryFn: async () => (await api.get<MovementDto[]>("/cash/movements", { params: filter ? { cashAccountId: filter } : {} })).data
  });

  const totalCash = (accounts.data ?? []).reduce((s, a) => s + a.currentBalance, 0);

  const filteredMovements = useMemo(() => {
    const rows = movements.data ?? [];
    return rows.filter(m => {
      if (directionFilter && m.direction !== directionFilter) return false;
      if (reasonFilter && !m.reason.includes(reasonFilter)) return false;
      if (fromDate && m.movementDate < fromDate) return false;
      if (toDate   && m.movementDate > toDate)   return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${m.reason} ${m.reference ?? ""} ${m.cashAccountName}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [movements.data, search, directionFilter, reasonFilter, fromDate, toDate]);

  // Daily KPIs
  const today = new Date().toISOString().slice(0, 10);
  const todayIn  = filteredMovements.filter(m => m.movementDate === today && m.direction === "In").reduce((s, m) => s + m.amount, 0);
  const todayOut = filteredMovements.filter(m => m.movementDate === today && m.direction === "Out").reduce((s, m) => s + m.amount, 0);
  // Monthly aggregation for the chart
  const monthly = useMemo(() => {
    const byMonth = new Map<string, { month: string; in: number; out: number }>();
    for (const m of filteredMovements) {
      const k = m.movementDate.slice(0, 7);
      const slot = byMonth.get(k) ?? { month: k, in: 0, out: 0 };
      if (m.direction === "In") slot.in  += m.amount;
      else                      slot.out += m.amount;
      byMonth.set(k, slot);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredMovements]);

  const totalPages  = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
  const pagedMovements = filteredMovements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LocalAtmIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("cash.title")}</Typography>
              <HelpHint id="page.cash" />
            </Stack>
            <Typography color="text.secondary">{t("cash.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">{t("cash.totalLabel")}</Typography>
            <Typography variant="h5" fontWeight={800} color="success.main">{money(totalCash)}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewAccountOpen(true)}>{t("cash.createAccount")}</Button>
          <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setNewMovementOpen(true)}>{t("cash.createMovement")}</Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        {(accounts.data ?? []).map(a => (
          <Card key={a.id} variant="outlined" sx={{ p: 2, flex: 1, cursor: "pointer", borderColor: filter === a.id ? "primary.main" : undefined, borderWidth: filter === a.id ? 2 : 1 }} onClick={() => setFilter(filter === a.id ? "" : a.id)}>
            <Typography variant="caption" color="text.secondary">{a.code}</Typography>
            <Typography fontWeight={700}>{a.name}</Typography>
            <Typography variant="h5" fontWeight={800} color={a.currentBalance >= 0 ? "success.main" : "error.main"}>
              {money(a.currentBalance, a.currency)}
            </Typography>
          </Card>
        ))}
      </Stack>

      {/* KPI strip */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Σήμερα — Είσοδος</Typography>
          <Typography variant="h5" fontWeight={800} color="success.main">+{money(todayIn)}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Σήμερα — Έξοδος</Typography>
          <Typography variant="h5" fontWeight={800} color="error.main">−{money(todayOut)}</Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Σήμερα — Καθαρό</Typography>
          <Typography variant="h5" fontWeight={800} color={todayIn - todayOut >= 0 ? "success.main" : "error.main"}>
            {money(todayIn - todayOut)}
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">Σύνολο φιλτραρισμένα</Typography>
          <Typography variant="h5" fontWeight={800}>
            {money(filteredMovements.reduce((s, m) => s + (m.direction === "In" ? m.amount : -m.amount), 0))}
          </Typography>
        </Card>
      </Stack>

      {/* Monthly cash flow chart */}
      {monthly.length > 0 && (
        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography fontWeight={700} mb={1}>Ταμειακή ροή ανά μήνα</Typography>
          <Box sx={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="in"  name="Είσοδοι" fill="#2e7d32" />
                <Bar dataKey="out" name="Έξοδοι"  fill="#c62828" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      )}

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" placeholder="Λόγος, αναφορά, ταμείο…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Κατεύθυνση"
            value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)}
            sx={{ minWidth: 140 }}>
            <MenuItem value="">Όλες</MenuItem>
            <MenuItem value="In">Είσοδοι</MenuItem>
            <MenuItem value="Out">Έξοδοι</MenuItem>
          </TextField>
          <TextField select size="small" label="Κατηγορία λόγου"
            value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}
            sx={{ minWidth: 220 }}>
            <MenuItem value="">Όλες</MenuItem>
            {REASON_PRESETS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="small" onClick={() => {
            setSearch(""); setDirectionFilter(""); setReasonFilter(""); setFromDate(""); setToDate("");
          }}>Καθαρισμός</Button>
        </Stack>
      </Card>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>{t("cash.movementDate")}</TableCell>
            <TableCell>{t("cash.account")}</TableCell>
            <TableCell>{t("cash.direction")}</TableCell>
            <TableCell>{t("cash.reason")}</TableCell>
            <TableCell>{t("cash.reference")}</TableCell>
            <TableCell align="right">{t("cash.amount")}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {movements.isLoading && <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={20} /></TableCell></TableRow>}
            {!movements.isLoading && filteredMovements.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("cash.noMovements")}</TableCell></TableRow>
            )}
            {pagedMovements.map(m => (
              <TableRow key={m.id} hover>
                <TableCell>{m.movementDate}</TableCell>
                <TableCell>{m.cashAccountName}</TableCell>
                <TableCell><Chip size="small" color={m.direction === "In" ? "success" : "error"}
                  label={m.direction === "In" ? "▲ Εισ." : "▼ Εξ."} sx={{ fontWeight: 700 }} /></TableCell>
                <TableCell>{m.reason}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{m.reference ?? "—"}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: m.direction === "In" ? "success.main" : "error.main" }}>
                  {(m.direction === "In" ? "+" : "−")}{money(m.amount, m.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
          <NumberedPager page={page} totalPages={totalPages} onPage={setPage} />
        </Box>
      </Card>

      <AccountDialog open={newAccountOpen} onClose={() => setNewAccountOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cash-accounts"] }); setNewAccountOpen(false); }} />
      <MovementDialog open={newMovementOpen} onClose={() => setNewMovementOpen(false)} accounts={accounts.data ?? []}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["cash-accounts"] }); void qc.invalidateQueries({ queryKey: ["cash-movements"] }); setNewMovementOpen(false); }} />
    </Box>
  );
}

function AccountDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: "", name: "", currency: "EUR", isActive: true, notes: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) setForm({ code: "", name: "", currency: "EUR", isActive: true, notes: "" }); }, [open]);

  const save = useMutation({
    mutationFn: async () => (await api.post("/cash/accounts", {
      code: form.code.trim(), name: form.name.trim(),
      currency: form.currency.toUpperCase(), isActive: form.isActive,
      notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("cash.createAccountTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("cash.code")} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency}
              onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} sx={{ width: 100 }} />
          </Stack>
          <TextField required label={t("cash.accountName")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MovementDialog({ open, onClose, accounts, onSaved }: { open: boolean; onClose: () => void; accounts: CashAccountDto[]; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    cashAccountId: "", movementDate: today, direction: "In",
    amount: 0, currency: "EUR",
    reason: "", reasonCategory: "",
    reference: "",
    counterpartyType: "" as "Customer" | "Producer" | "Company" | "Vendor" | "",
    customerId: "", producerId: "", insuranceCompanyId: "", vendorName: "",
    policyId: "",
    receiptNumber: "",
    paymentMethod: "Cash" as "Cash" | "Card" | "BankTransfer" | "Cheque" | "PromissoryNote" | "Other",
    bankAccount: "",
    chequeNumber: "", chequeDueDate: "",
    notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers-lite-for-cash"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string }[]>("/customers")).data
  });
  const producers = useQuery({
    queryKey: ["producers-lite-for-cash"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data
  });
  const companies = useQuery({
    queryKey: ["companies-lite-for-cash"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/insurance-companies")).data
  });
  const customerPolicies = useQuery({
    queryKey: ["customer-policies-for-cash", form.customerId],
    enabled: open && !!form.customerId,
    queryFn: async () => (await api.get<{ id: string; policyNumber: string; premium: number }[]>(
      "/policies", { params: { customerId: form.customerId } })).data
  });

  useEffect(() => {
    if (open) setForm(f => ({
      ...f, cashAccountId: accounts[0]?.id ?? "", movementDate: today,
      direction: "In", amount: 0, currency: "EUR",
      reason: "", reasonCategory: "", reference: "",
      counterpartyType: "", customerId: "", producerId: "", insuranceCompanyId: "", vendorName: "",
      policyId: "", receiptNumber: "",
      paymentMethod: "Cash", bankAccount: "", chequeNumber: "", chequeDueDate: "",
      notes: ""
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      // Compose a richer "reason" string so we don't need a schema migration for
      // the new fields — they all show up in the audit reason text & reference.
      const counterparty =
        form.counterpartyType === "Customer" && form.customerId
          ? (customers.data ?? []).find(c => c.id === form.customerId)
          : null;
      const counterpartyLabel =
        counterparty ? (counterparty.type === "Individual"
          ? `${counterparty.firstName ?? ""} ${counterparty.lastName ?? ""}`.trim()
          : counterparty.companyName ?? "")
        : form.counterpartyType === "Producer"
          ? (producers.data ?? []).find(p => p.id === form.producerId)?.name ?? ""
        : form.counterpartyType === "Company"
          ? (companies.data ?? []).find(c => c.id === form.insuranceCompanyId)?.name ?? ""
        : form.counterpartyType === "Vendor"
          ? form.vendorName : "";
      const policyLabel = form.policyId
        ? (customerPolicies.data ?? []).find(p => p.id === form.policyId)?.policyNumber ?? ""
        : "";

      const parts = [
        form.reasonCategory || form.reason,
        counterpartyLabel ? `· ${counterpartyLabel}` : "",
        policyLabel       ? `· συμβ. ${policyLabel}` : "",
        form.receiptNumber? `· αρ.απόδ. ${form.receiptNumber}` : "",
        form.paymentMethod !== "Cash" ? `· ${form.paymentMethod}` : "",
        form.chequeNumber ? `· επιταγή ${form.chequeNumber}${form.chequeDueDate ? ` (${form.chequeDueDate})` : ""}` : "",
        form.bankAccount  ? `· τραπ.${form.bankAccount}` : ""
      ].filter(Boolean).join(" ");
      const reference = form.reference
        || [form.receiptNumber, form.chequeNumber, policyLabel].filter(Boolean).join("/")
        || null;
      return (await api.post("/cash/movements", {
        cashAccountId: form.cashAccountId, movementDate: form.movementDate,
        direction: form.direction, amount: Number(form.amount), currency: form.currency.toUpperCase(),
        reason: parts || form.reason || form.reasonCategory || "—",
        reference
      })).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  const showChequeFields = form.paymentMethod === "Cheque" || form.paymentMethod === "PromissoryNote";
  const showBankField    = form.paymentMethod === "BankTransfer";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("cash.createMovementTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          {/* Row 1: account + date + direction + amount */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select required label={t("cash.account")} value={form.cashAccountId}
              onChange={e => setForm({ ...form, cashAccountId: e.target.value })} fullWidth>
              {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({money(a.currentBalance, a.currency)})</MenuItem>)}
            </TextField>
            <TextField type="date" label={t("cash.movementDate")} InputLabelProps={{ shrink: true }}
              value={form.movementDate} onChange={e => setForm({ ...form, movementDate: e.target.value })} fullWidth />
            <TextField select label={t("cash.direction")} value={form.direction}
              onChange={e => setForm({ ...form, direction: e.target.value })} fullWidth>
              <MenuItem value="In">Είσοδος (+)</MenuItem>
              <MenuItem value="Out">Έξοδος (−)</MenuItem>
            </TextField>
            <TextField required type="number" label={t("cash.amount")} value={form.amount}
              onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
          </Stack>

          {/* Row 2: reason category + free text */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Κατηγορία" value={form.reasonCategory}
              onChange={e => setForm({ ...form, reasonCategory: e.target.value })} sx={{ minWidth: 260 }}>
              <MenuItem value="">—</MenuItem>
              {REASON_PRESETS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField label="Ελεύθερη περιγραφή" value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })} fullWidth />
          </Stack>

          {/* Row 3: counterparty */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Τύπος αντισυμβαλλόμενου"
              value={form.counterpartyType}
              onChange={e => setForm({ ...form, counterpartyType: e.target.value as any,
                customerId: "", producerId: "", insuranceCompanyId: "", vendorName: "" })}
              sx={{ minWidth: 220 }}>
              <MenuItem value="">— (χωρίς)</MenuItem>
              <MenuItem value="Customer">Πελάτης</MenuItem>
              <MenuItem value="Producer">Συνεργάτης</MenuItem>
              <MenuItem value="Company">Ασφαλιστική εταιρία</MenuItem>
              <MenuItem value="Vendor">Προμηθευτής</MenuItem>
            </TextField>
            {form.counterpartyType === "Customer" && (
              <SearchableSelect
                label="Πελάτης"
                value={form.customerId}
                onChange={(v) => setForm({ ...form, customerId: v, policyId: "" })}
                options={(customers.data ?? []).map(c => ({
                  value: c.id,
                  label: c.type === "Individual"
                    ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                    : (c.companyName ?? ""),
                }))}
              />
            )}
            {form.counterpartyType === "Producer" && (
              <SearchableSelect
                label="Συνεργάτης"
                value={form.producerId}
                onChange={(v) => setForm({ ...form, producerId: v })}
                options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
              />
            )}
            {form.counterpartyType === "Company" && (
              <SearchableSelect
                label="Ασφαλιστική"
                value={form.insuranceCompanyId}
                onChange={(v) => setForm({ ...form, insuranceCompanyId: v })}
                options={(companies.data ?? []).map(c => ({ value: c.id, label: c.name }))}
              />
            )}
            {form.counterpartyType === "Vendor" && (
              <TextField label="Επωνυμία προμηθευτή" fullWidth value={form.vendorName}
                onChange={e => setForm({ ...form, vendorName: e.target.value })} />
            )}
          </Stack>

          {/* Row 4: linked policy (only when customer is set) */}
          {form.customerId && (
            <SearchableSelect
              label="Συμβόλαιο πελάτη (προαιρετικό)"
              value={form.policyId}
              onChange={(v) => setForm({ ...form, policyId: v })}
              emptyLabel="— Καμία σύνδεση —"
              options={(customerPolicies.data ?? []).map(p => ({
                value: p.id, label: p.policyNumber, hint: money(p.premium),
              }))}
            />
          )}

          {/* Row 5: payment method + receipt # + reference */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Μέθοδος πληρωμής" value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value as any })}
              sx={{ minWidth: 200 }}>
              <MenuItem value="Cash">Μετρητά</MenuItem>
              <MenuItem value="Card">Κάρτα</MenuItem>
              <MenuItem value="BankTransfer">Έμβασμα</MenuItem>
              <MenuItem value="Cheque">Επιταγή</MenuItem>
              <MenuItem value="PromissoryNote">Γραμμάτιο</MenuItem>
              <MenuItem value="Other">Άλλο</MenuItem>
            </TextField>
            <TextField label="Αρ. απόδειξης" value={form.receiptNumber}
              onChange={e => setForm({ ...form, receiptNumber: e.target.value })} sx={{ minWidth: 200 }} />
            <TextField label={t("cash.reference")} value={form.reference}
              onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
          </Stack>

          {/* Row 6: cheque or bank details, depending on method */}
          {showChequeFields && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Αρ. επιταγής" value={form.chequeNumber}
                onChange={e => setForm({ ...form, chequeNumber: e.target.value })} fullWidth />
              <TextField type="date" label="Λήξη επιταγής" InputLabelProps={{ shrink: true }}
                value={form.chequeDueDate} onChange={e => setForm({ ...form, chequeDueDate: e.target.value })} fullWidth />
            </Stack>
          )}
          {showBankField && (
            <TextField label="Τραπεζικός λογαριασμός / IBAN" value={form.bankAccount}
              onChange={e => setForm({ ...form, bankAccount: e.target.value })} fullWidth />
          )}

          <TextField label="Σημειώσεις" multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.cashAccountId || form.amount <= 0
            || (!form.reason.trim() && !form.reasonCategory)}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
