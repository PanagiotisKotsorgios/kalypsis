import { FinancialFilters } from "../components/FinancialFilters";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import PaymentsIcon from "@mui/icons-material/Payments";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { money } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

const KINDS = ["Cheque","PromissoryNote"] as const;
const STATUSES = ["Open","PartiallyPaid","Paid","Bounced","Cancelled","Transferred"] as const;
type Kind = typeof KINDS[number]; type Status = typeof STATUSES[number];
interface SecurityDto {
  id: string; number: string; kind: Kind; status: Status;
  customerId: string | null; customerName: string;
  issuingBankId: string | null; issuingBankName: string | null;
  issueDate: string; maturityDate: string; paidDate: string | null;
  amount: number; currency: string; notes: string | null;
  direction: "Incoming" | "Outgoing"; partyKind: string; partyId: string | null; partyName: string | null;
  settledAmount: number; outstandingAmount: number; bankAccount: string | null; drawerName: string | null;
  holderName: string | null; endorserName: string | null; placeOfIssue: string | null; policyId: string | null;
}
interface SecurityEvent { id: string; kind: string; occurredOn: string; amount: number; counterparty: string | null; notes: string | null; previousValuesJson?: string | null; newValuesJson?: string | null; receiptId?: string | null; paymentId?: string | null }

export function SecuritiesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SecurityDto | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [directionFilter, setDirectionFilter] = useState<"Incoming" | "Outgoing" | "">("");
  const [maturityFrom, setMaturityFrom] = useState("");
  const [maturityTo, setMaturityTo] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [eventTarget, setEventTarget] = useState<SecurityDto | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SecurityDto | null>(null);

  const q = useQuery({ queryKey: ["securities", directionFilter], queryFn: async () => (await api.get<SecurityDto[]>("/securities", { params: { direction: directionFilter || undefined } })).data });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/securities/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["securities"] }),
    onError: e => setErr(extractErrorMessage(e)) });

  const colors: Record<Status, "info"|"success"|"error"|"default"|"warning"> = { Open: "info", PartiallyPaid: "warning", Paid: "success", Bounced: "error", Cancelled: "default", Transferred: "warning" };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter(s => {
      if (needle) {
        const hay = `${s.number} ${s.customerName} ${s.issuingBankName ?? ""} ${s.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (kindFilter && s.kind !== kindFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (directionFilter && s.direction !== directionFilter) return false;
      if (maturityFrom && s.maturityDate < maturityFrom) return false;
      if (maturityTo && s.maturityDate > maturityTo) return false;
      return true;
    });
  }, [q.data, search, kindFilter, statusFilter, directionFilter, maturityFrom, maturityTo]);
  useEffect(() => { setPage(0); }, [search, kindFilter, statusFilter, directionFilter, maturityFrom, maturityTo]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{t("securities.title")}</Typography>
          <Typography color="text.secondary">{t("securities.subtitle")}</Typography></Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}
          sx={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 200 }}>
          {t("securities.create")}
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {/* Filter card — same dense grid pattern used across the app. */}
      <FinancialFilters title="Φίλτρα αξιογράφων">
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: αριθμός, πελάτης, τράπεζα…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <SearchableTextField size="small" label={t("securities.kind")} fullWidth
            value={kindFilter} onChange={(e) => setKindFilter(e.target.value as Kind | "")}>
            <MenuItem value="">Όλοι</MenuItem>
            {KINDS.map(k => <MenuItem key={k} value={k}>{t(`securities.kindLabel.${k}`)}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label={t("common.status")} fullWidth
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | "")}>
            <MenuItem value="">Όλες</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{t(`securities.statusLabel.${s}`)}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label="Κατεύθυνση" fullWidth value={directionFilter} onChange={e => setDirectionFilter(e.target.value as "Incoming" | "Outgoing" | "")}>
            <MenuItem value="">Όλες</MenuItem><MenuItem value="Incoming">Εισερχόμενο</MenuItem><MenuItem value="Outgoing">Εξερχόμενο</MenuItem>
          </SearchableTextField>
          <TextField size="small" type="date" label="Λήξη από" InputLabelProps={{ shrink: true }} fullWidth
            value={maturityFrom} onChange={(e) => setMaturityFrom(e.target.value)} />
          <TextField size="small" type="date" label="Λήξη έως" InputLabelProps={{ shrink: true }} fullWidth
            value={maturityTo} onChange={(e) => setMaturityTo(e.target.value)} />
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setKindFilter(""); setStatusFilter(""); setDirectionFilter(""); setMaturityFrom(""); setMaturityTo(""); }}
            sx={{ gridColumn: { md: "span 2" } }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </FinancialFilters>

      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("securities.number")}</TableCell>
              <TableCell>{t("securities.kind")}</TableCell>
              <TableCell>{t("securities.customer")}</TableCell>
              <TableCell>Κατεύθυνση / Αντισυμβαλλόμενος</TableCell>
              <TableCell>{t("securities.bank")}</TableCell>
              <TableCell>{t("securities.issued")}</TableCell>
              <TableCell>{t("securities.maturity")}</TableCell>
              <TableCell align="right">{t("securities.amount")}</TableCell>
              <TableCell align="right">Εξοφλήθηκε</TableCell>
              <TableCell align="right">Υπόλοιπο</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={12} align="center" sx={{ color: "text.secondary", py: 4 }}>{t("securities.empty")}</TableCell></TableRow>
              )}
              {paged.map(s => {
                const overdue = s.outstandingAmount > 0 && new Date(s.maturityDate) < new Date();
                return (
                  <TableRow key={s.id} hover>
                    <TableCell><Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>{s.number}</Typography></TableCell>
                    <TableCell>{t(`securities.kindLabel.${s.kind}`)}</TableCell>
                    <TableCell>{s.customerName}</TableCell>
                    <TableCell>{s.direction === "Incoming" ? "Εισερχόμενο" : "Εξερχόμενο"} · {s.partyName || s.customerName}</TableCell>
                    <TableCell>{s.issuingBankName ?? "—"}</TableCell>
                    <TableCell>{s.issueDate}</TableCell>
                    <TableCell sx={{ color: overdue ? "error.main" : undefined, fontWeight: overdue ? 700 : undefined }}>{s.maturityDate}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(s.amount, s.currency)}</TableCell>
                    <TableCell align="right">{money(s.settledAmount, s.currency)}</TableCell>
                    <TableCell align="right" sx={{ color: s.outstandingAmount > 0 ? "error.main" : "success.main", fontWeight: 700 }}>{money(s.outstandingAmount, s.currency)}</TableCell>
                    <TableCell><Chip size="small" color={colors[s.status]} label={t(`securities.statusLabel.${s.status}`)} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Ιστορικό" onClick={() => setHistoryTarget(s)}><HistoryIcon fontSize="small" /></IconButton>
                      {s.status !== "Paid" && s.status !== "Cancelled" && <IconButton size="small" title="Καταχώρηση κίνησης" color="success" onClick={() => setEventTarget(s)}><PaymentsIcon fontSize="small" /></IconButton>}
                      <IconButton size="small" onClick={() => setEditing(s)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(s.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["securities"] }); setCreateOpen(false); }} />
      <FormDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["securities"] }); setEditing(null); }} />
      <SecurityEventDialog item={eventTarget} onClose={() => setEventTarget(null)} onSaved={() => { void qc.invalidateQueries({ queryKey: ["securities"] }); setEventTarget(null); }} />
      <SecurityHistoryDialog item={historyTarget} onClose={() => setHistoryTarget(null)} />
    </Box>
  );
}

function FormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: SecurityDto | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const editing = !!item;
  const customers = useQuery({ queryKey: ["customers-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; type: string; firstName?: string; lastName?: string; companyName?: string }[]>("/customers")).data });
  const banks = useQuery({ queryKey: ["bank-connections-lite"], enabled: open,
    queryFn: async () => (await api.get<{ id: string; bankName: string }[]>("/bank-connections")).data });

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date(); month.setDate(month.getDate() + 60);
  const [form, setForm] = useState({
    number: "", kind: "Cheque" as Kind, status: "Open" as Status, customerId: "", issuingBankId: "",
    issueDate: today, maturityDate: month.toISOString().slice(0, 10), paidDate: "",
    amount: 0, currency: "EUR", notes: "", direction: "Incoming" as "Incoming" | "Outgoing",
    partyKind: "Customer", partyId: "", partyName: "", settledAmount: 0, bankAccount: "",
    drawerName: "", holderName: "", endorserName: "", placeOfIssue: "", policyId: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({
      number: item.number, kind: item.kind, status: item.status,
      customerId: item.customerId ?? "", issuingBankId: item.issuingBankId ?? "",
      issueDate: item.issueDate, maturityDate: item.maturityDate, paidDate: item.paidDate ?? "",
      amount: item.amount, currency: item.currency, notes: item.notes ?? "", direction: item.direction,
      partyKind: item.partyKind, partyId: item.partyId ?? "", partyName: item.partyName ?? "",
      settledAmount: item.settledAmount, bankAccount: item.bankAccount ?? "", drawerName: item.drawerName ?? "",
      holderName: item.holderName ?? "", endorserName: item.endorserName ?? "", placeOfIssue: item.placeOfIssue ?? "",
      policyId: item.policyId ?? ""
    });
    else if (open) setForm({
      number: `S-${Date.now().toString().slice(-6)}`, kind: "Cheque", status: "Open",
      customerId: "", issuingBankId: "", issueDate: today, maturityDate: month.toISOString().slice(0, 10),
      paidDate: "", amount: 0, currency: "EUR", notes: "", direction: "Incoming", partyKind: "Customer",
      partyId: "", partyName: "", settledAmount: 0, bankAccount: "", drawerName: "", holderName: "",
      endorserName: "", placeOfIssue: "", policyId: ""
    });
    // eslint-disable-next-line
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        number: form.number.trim(), kind: form.kind, status: form.status,
        customerId: form.customerId, issuingBankId: form.issuingBankId || null,
        issueDate: form.issueDate, maturityDate: form.maturityDate,
        paidDate: form.paidDate || null,
        amount: Number(form.amount), currency: form.currency.toUpperCase(), notes: form.notes || null,
        direction: form.direction, partyKind: form.partyKind, partyId: form.partyId || null,
        partyName: form.partyName || null, settledAmount: Number(form.settledAmount), bankAccount: form.bankAccount || null,
        drawerName: form.drawerName || null, holderName: form.holderName || null, endorserName: form.endorserName || null,
        placeOfIssue: form.placeOfIssue || null, policyId: form.policyId || null
      };
      if (editing) return (await api.put(`/securities/${item!.id}`, body)).data;
      return (await api.post("/securities", body)).data;
    },
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("securities.editTitle") : t("securities.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("securities.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <SearchableTextField label={t("securities.kind")} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind })} fullWidth>
              {KINDS.map(k => <MenuItem key={k} value={k}>{t(`securities.kindLabel.${k}`)}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <SearchableTextField label="Κατεύθυνση" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as "Incoming" | "Outgoing" })} fullWidth>
            <MenuItem value="Incoming">Εισερχόμενο</MenuItem><MenuItem value="Outgoing">Εξερχόμενο</MenuItem>
          </SearchableTextField>
          <SearchableTextField label="Τύπος συναλλασσομένου" value={form.partyKind} onChange={e => setForm({ ...form, partyKind: e.target.value })} fullWidth>
            <MenuItem value="Customer">Πελάτης</MenuItem><MenuItem value="Producer">Συνεργάτης</MenuItem>
            <MenuItem value="InsuranceCompany">Ασφαλιστική εταιρεία</MenuItem><MenuItem value="Other">Άλλος</MenuItem>
          </SearchableTextField>
          {(form.direction === "Incoming" || form.partyKind === "Customer") && <SearchableSelect
            label={t("securities.customer")}
            required={form.direction === "Incoming" || form.partyKind === "Customer"}
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            options={(customers.data ?? []).map(c => ({
              value: c.id,
              label: c.type === "Individual"
                ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                : (c.companyName ?? ""),
            }))}
          />}
          <TextField required label="Όνομα συναλλασσομένου / δικαιούχου" value={form.partyName} onChange={e => setForm({ ...form, partyName: e.target.value })} fullWidth />
          <SearchableSelect
            label={t("securities.bank")}
            value={form.issuingBankId}
            onChange={(v) => setForm({ ...form, issuingBankId: v })}
            emptyLabel="—"
            options={(banks.data ?? []).map(b => ({ value: b.id, label: b.bankName }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Λογαριασμός / IBAN" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} fullWidth />
            <TextField label="Εκδότης / συρτής" value={form.drawerName} onChange={e => setForm({ ...form, drawerName: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κάτοχος" value={form.holderName} onChange={e => setForm({ ...form, holderName: e.target.value })} fullWidth />
            <TextField label="Οπισθογράφος" value={form.endorserName} onChange={e => setForm({ ...form, endorserName: e.target.value })} fullWidth />
            <TextField label="Τόπος έκδοσης" value={form.placeOfIssue} onChange={e => setForm({ ...form, placeOfIssue: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label={t("securities.issued")} InputLabelProps={{ shrink: true }} value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("securities.maturity")} InputLabelProps={{ shrink: true }} value={form.maturityDate} onChange={e => setForm({ ...form, maturityDate: e.target.value })} fullWidth />
            <TextField type="date" label={t("securities.paid")} InputLabelProps={{ shrink: true }} value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" required label={t("securities.amount")} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("tariffs.currency")} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} fullWidth />
          </Stack>
          <TextField label={t("common.notes")} multiline rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.number.trim() || !form.partyName.trim() || ((form.direction === "Incoming" || form.partyKind === "Customer") && !form.customerId)}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SecurityEventDialog({ item, onClose, onSaved }: { item: SecurityDto | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState("PartialSettlement");
  const [amount, setAmount] = useState(0);
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 16));
  const [counterparty, setCounterparty] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/securities/${item!.id}/events`, { kind, amount: Number(amount), occurredOn: new Date(occurredOn).toISOString(), counterparty: counterparty || null, notes: notes || null })).data,
    onSuccess: onSaved, onError: e => setError(extractErrorMessage(e))
  });
  useEffect(() => { if (item) { setKind("PartialSettlement"); setAmount(item.outstandingAmount); setOccurredOn(new Date().toISOString().slice(0, 16)); setCounterparty(""); setNotes(""); setError(null); } }, [item]);
  return <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Ενέργεια αξιογράφου · {item?.number}</DialogTitle><DialogContent>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2} mt={1}>
        <Typography color="text.secondary">Υπόλοιπο: {item ? money(item.outstandingAmount, item.currency) : "—"}</Typography>
        <SearchableTextField label="Ενέργεια" value={kind} onChange={e => { const next = e.target.value; setKind(next); if (next === "Bounced") setAmount(item?.settledAmount ?? 0); else if (next === "PartialSettlement" || next === "Settled") setAmount(item?.outstandingAmount ?? 0); }} fullWidth>
          <MenuItem value="PartialSettlement">Μερική εξόφληση</MenuItem><MenuItem value="Settled">Πλήρης εξόφληση</MenuItem>
          <MenuItem value="Transferred">Μεταβίβαση</MenuItem><MenuItem value="Bounced">Ακάλυπτο / αντιλογισμός</MenuItem><MenuItem value="Cancelled">Ακύρωση</MenuItem>
        </SearchableTextField>
        {kind === "PartialSettlement" && <TextField type="number" label="Ποσό κίνησης" value={amount} onChange={e => setAmount(Number(e.target.value))} inputProps={{ min: 0, max: item?.outstandingAmount, step: "0.01" }} fullWidth />}
        {kind === "Bounced" && <TextField type="number" label="Ποσό αντιλογισμού" value={amount} onChange={e => setAmount(Number(e.target.value))} inputProps={{ min: 0, max: item?.settledAmount, step: "0.01" }} fullWidth />}
        <TextField type="datetime-local" label="Ημερομηνία" InputLabelProps={{ shrink: true }} value={occurredOn} onChange={e => setOccurredOn(e.target.value)} fullWidth />
        <TextField label="Αντισυμβαλλόμενος" value={counterparty} onChange={e => setCounterparty(e.target.value)} fullWidth />
        <TextField label="Σημειώσεις" value={notes} onChange={e => setNotes(e.target.value)} multiline minRows={2} fullWidth />
      </Stack>
    </DialogContent><DialogActions><Button onClick={onClose}>Άκυρο</Button><Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <CircularProgress size={18} /> : "Καταχώρηση"}</Button></DialogActions>
  </Dialog>;
}

function SecurityHistoryDialog({ item, onClose }: { item: SecurityDto | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["security-events", item?.id], enabled: !!item, queryFn: async () => (await api.get<SecurityEvent[]>(`/securities/${item!.id}/events`)).data });
  return <Dialog open={!!item} onClose={onClose} fullWidth maxWidth="md"><DialogTitle>Ιστορικό αξιογράφου · {item?.number}</DialogTitle><DialogContent>
    {q.isLoading ? <CircularProgress /> : q.isError ? <Alert severity="error">Αδυναμία φόρτωσης ιστορικού.</Alert> : (q.data?.length ?? 0) === 0 ? <Alert severity="info">Δεν έχουν καταχωρηθεί ενέργειες.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Ενέργεια</TableCell><TableCell>Αντισυμβαλλόμενος</TableCell><TableCell align="right">Ποσό</TableCell><TableCell>Παραστατικό</TableCell><TableCell>Μεταβολή στοιχείων</TableCell><TableCell>Σημειώσεις</TableCell></TableRow></TableHead><TableBody>{q.data!.map(e => <TableRow key={e.id}><TableCell>{new Date(e.occurredOn).toLocaleString("el-GR")}</TableCell><TableCell>{e.kind}</TableCell><TableCell>{e.counterparty || "—"}</TableCell><TableCell align="right">{money(e.amount, item?.currency || "EUR")}</TableCell><TableCell>{e.receiptId ? "Είσπραξη" : e.paymentId ? "Πληρωμή" : "—"}</TableCell><TableCell sx={{ minWidth: 180 }}><Typography variant="caption" component="pre" sx={{ m: 0, whiteSpace: "pre-wrap" }}>{e.previousValuesJson && e.newValuesJson ? `${e.previousValuesJson} → ${e.newValuesJson}` : "—"}</Typography></TableCell><TableCell>{e.notes || "—"}</TableCell></TableRow>)}</TableBody></Table>}
  </DialogContent><DialogActions><Button onClick={onClose}>Κλείσιμο</Button></DialogActions></Dialog>;
}
