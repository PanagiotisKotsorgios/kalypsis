import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination,
  TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import LinkIcon from "@mui/icons-material/Link";
import SavingsIcon from "@mui/icons-material/Savings";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LocalPostOfficeIcon from "@mui/icons-material/LocalPostOffice";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import { advanceBalances, advanceDirectionLabel } from "./advancePaymentModel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, num } from "../utils/format";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";

/* ============================================================================
   ADVANCE PAYMENTS (Προκαταβολές)
   ========================================================================= */
interface AdvanceAllocation {
  id: string; policyId?: string | null; policyNumber: string; customerName: string;
  targetType?: string; targetId?: string; reference?: string;
  amount: number; linkedOn: string;
}
interface AdvanceRow {
  id: string; number: string; receivedOn: string; partyType: "Customer" | "Producer" | "Carrier";
  customerId?: string | null; customerName?: string | null;
  producerId?: string | null; producerName?: string | null;
  insuranceCompanyId?: string | null; insuranceCompanyName?: string | null;
  amount: number; allocatedAmount: number; currency: string; paymentMethod: string;
  direction?: "Incoming" | "Outgoing" | null;
  reference?: string | null; status: string; notes?: string | null; allocations: AdvanceAllocation[];
}
interface AdvancePolicy {
  id: string; policyNumber: string; customerId: string; customerDisplay: string;
  insuranceCompanyId: string; insuranceCompanyName: string; producerId?: string | null;
  producerName?: string | null; premium: number; currency: string; status: string;
}

export function AdvancePaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [directionAdvance, setDirectionAdvance] = useState<AdvanceRow | null>(null);
  const [allocationAdvance, setAllocationAdvance] = useState<AdvanceRow | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const q = useQuery<AdvanceRow[]>({ queryKey: ["advance-payments", filter, directionFilter], queryFn: async () =>
    (await api.get<AdvanceRow[]>("/advance-payments", { params: { status: filter || undefined, direction: directionFilter || undefined } })).data });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? []).filter(a => {
      if (needle) {
        const hay = `${a.number} ${a.customerName ?? ""} ${a.producerName ?? ""} ${a.insuranceCompanyName ?? ""} ${a.reference ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (partyFilter && a.partyType !== partyFilter) return false;
      return true;
    });
  }, [q.data, search, partyFilter]);
  useEffect(() => { setPage(0); }, [search, partyFilter, filter, directionFilter]);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  const paged = filtered.slice(visiblePage * rowsPerPage, visiblePage * rowsPerPage + rowsPerPage);
  const balances = advanceBalances(filtered);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ["advance-payments"] }); void qc.invalidateQueries({ queryKey: ["unmatched"] }); };

  return (
    <Box>
      {/* Header — title on the left, «Νέα προκαταβολή» on the right on its
          own line so the button gets its full label without collapsing. */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }} mb={3} gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SavingsIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("advance.title")}</Typography>
              <HelpHint id="page.advance" />
            </Stack>
            <Typography color="text.secondary">Εισερχόμενες και εξερχόμενες προκαταβολές, κατανομές και διαθέσιμα υπόλοιπα.</Typography>
          </Box>
        </Stack>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setOpen(true)}
          sx={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 200 }}>
          {t("advance.create")}
        </Button>
      </Stack>

      {/* Filter card — search + status + party in one compact grid. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "minmax(220px, 2fr) repeat(3, minmax(145px, 1fr)) auto" },
          alignItems: "center",
        }}>
          <TextField size="small" label="Αναζήτηση" placeholder="Αριθμός, όνομα, αναφορά…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 0, gridColumn: { xs: "auto", sm: "span 2", lg: "auto" } }} />
          <SearchableTextField size="small" label="Κατεύθυνση" value={directionFilter} onChange={event => setDirectionFilter(event.target.value)} fullWidth>
            <MenuItem value="">Όλες</MenuItem><MenuItem value="Incoming">Εισερχόμενες</MenuItem><MenuItem value="Outgoing">Εξερχόμενες</MenuItem><MenuItem value="Unspecified">Χωρίς χαρακτηρισμό</MenuItem>
          </SearchableTextField>
          <SearchableTextField size="small" label={t("common.status")} fullWidth
            value={filter} onChange={e => setFilter(e.target.value)}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {["Open", "PartiallyAllocated", "FullyAllocated", "Refunded"].map(s =>
              <MenuItem key={s} value={s}>{t(`batchStatus.${s}`, s)}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label="Τύπος αντισυμβαλλόμενου" fullWidth
            value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
            <MenuItem value="">Όλοι</MenuItem>
            {["Customer", "Producer", "Carrier"].map(p =>
              <MenuItem key={p} value={p}>{t(`payeeType.${p}`, p)}</MenuItem>)}
          </SearchableTextField>
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setFilter(""); setPartyFilter(""); setDirectionFilter(""); }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {(q.data ?? []).some(row => !row.direction) && <Alert severity="warning" sx={{ mb: 1.5 }}>Οι παλιές προκαταβολές δεν έχουν κατεύθυνση. Χαρακτηρίστε τις από το μολύβι στη γραμμή τους· τα ποσά και οι υπάρχουσες κατανομές διατηρούνται.</Alert>}
      {q.data?.length === 500 && <Alert severity="info" sx={{ mb: 1.5 }}>Η λίστα εμφανίζει έως 500 πρόσφατες εγγραφές ανά επιλογή φίλτρων.</Alert>}
      {balances.length > 0 && <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">Σύνολα τρέχουσας λίστας ανά νόμισμα · τα αρχικά ποσά περιλαμβάνουν και τις επιστραφείσες εγγραφές, όχι όμως τα διαθέσιμα.</Typography>
        <Stack gap={1} mt={.5}>{balances.map(balance => <Box key={balance.currency} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
          {[["Εισερχόμενες", balance.incoming, "success.dark"], ["Εξερχόμενες", balance.outgoing, "error.dark"], ["Ακατανέμητες εισερχόμενες", balance.incomingAvailable, "success.dark"], ["Ακατανέμητες εξερχόμενες", balance.outgoingAvailable, "primary.dark"]].map(([label, value, color]) => <Box key={String(label)} sx={{ p: 1, border: "1px solid #D5E0EC", borderRadius: 1.5, bgcolor: "#EDF2F7" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={800} color={String(color)}>{money(Number(value), balance.currency)}</Typography></Box>)}
        </Box>)}</Stack>
      </Box>}
      {q.isError && <Alert severity="error" sx={{ mb: 1.5 }} action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>}
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("advance.number")}</TableCell>
              <TableCell>Ημερομηνία κίνησης</TableCell>
              <TableCell>Κατεύθυνση</TableCell>
              <TableCell>{t("advance.party")}</TableCell>
              <TableCell>{t("advance.partyName")}</TableCell>
              <TableCell align="right">{t("advance.amount")}</TableCell>
              <TableCell align="right">{t("advance.allocated")}</TableCell>
              <TableCell align="right">{t("advance.available")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right">Σύνδεση</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {paged.length === 0 && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>{t("advance.empty")}</TableCell></TableRow>}
              {paged.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{a.number}</TableCell>
                  <TableCell>{a.receivedOn}</TableCell>
                  <TableCell><Stack direction="row" gap={.5} alignItems="center"><AdvanceDirectionChip direction={a.direction} />{(!a.direction || a.allocatedAmount === 0) && <IconButton size="small" aria-label="Ορισμός κατεύθυνσης" onClick={() => setDirectionAdvance(a)}><EditOutlinedIcon fontSize="small" /></IconButton>}</Stack></TableCell>
                  <TableCell>{String(t(`payeeType.${a.partyType}`, a.partyType))}</TableCell>
                  <TableCell>{a.customerName ?? a.producerName ?? a.insuranceCompanyName ?? "—"}</TableCell>
                  <TableCell align="right">{money(a.amount, a.currency)}</TableCell>
                  <TableCell align="right">{num(a.allocatedAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>{num(a.status === "Refunded" || a.status === "FullyAllocated" ? 0 : Math.max(0, a.amount - a.allocatedAmount))}</TableCell>
                  <TableCell><Chip size="small" color={a.status === "FullyAllocated" ? "success" : a.status === "Open" ? "warning" : "info"} label={String(t(`batchStatus.${a.status}`, a.status))} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" color={a.status === "FullyAllocated" ? "success" : "primary"}
                      startIcon={<LinkIcon />} onClick={() => setAllocationAdvance(a)}>
                      {a.allocations?.length ? `Κατανομές (${a.allocations.length})` : "Κατανομή"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={visiblePage}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={ev => { setRowsPerPage(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100, 250]}
            labelRowsPerPage="Ανά σελίδα"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
          />
        </Card>
      )}
      <CreateAdvanceDialog open={open} onClose={() => setOpen(false)} onSaved={() => { invalidate(); setOpen(false); }} />
      <AdvanceDirectionDialog advance={directionAdvance} onClose={() => setDirectionAdvance(null)} onSaved={() => { invalidate(); setDirectionAdvance(null); }} />
      <AllocateAdvanceDialog advance={allocationAdvance} onClose={() => setAllocationAdvance(null)}
        onSaved={() => { invalidate(); setAllocationAdvance(null); }} />
    </Box>
  );
}

export function AdvanceDirectionChip({ direction }: { direction?: string | null }) {
  return <Chip size="small" icon={direction === "Incoming" ? <SouthWestIcon /> : direction === "Outgoing" ? <NorthEastIcon /> : undefined}
    color={direction === "Incoming" ? "success" : direction === "Outgoing" ? "error" : "warning"} label={advanceDirectionLabel(direction)} />;
}

function AdvanceDirectionDialog({ advance, onClose, onSaved }: { advance: AdvanceRow | null; onClose: () => void; onSaved: () => void }) {
  const [direction, setDirection] = useState("");
  useEffect(() => { setDirection(advance?.direction ?? ""); save.reset(); }, [advance?.id]);
  const save = useMutation({ mutationFn: async () => api.patch(`/advance-payments/${advance!.id}/direction`, { direction }), onSuccess: onSaved });
  return <Dialog open={!!advance} onClose={() => { if (!save.isPending) onClose(); }} fullWidth maxWidth="xs">
    <DialogTitle>Κατεύθυνση προκαταβολής · {advance?.number}</DialogTitle>
    <DialogContent dividers><Stack gap={1.5} pt={.5}>
      <Typography variant="body2">Επιλέξτε με βάση την κίνηση χρημάτων του γραφείου. Δεν αλλάζουν το ποσό ή οι ήδη καταχωρημένες συσχετίσεις.</Typography>
      <TextField select fullWidth label="Κατεύθυνση" value={direction} onChange={event => setDirection(event.target.value)} disabled={save.isPending}>
        <MenuItem value="" disabled>Επιλέξτε κατεύθυνση</MenuItem><MenuItem value="Incoming">Εισερχόμενη — λάβαμε χρήματα</MenuItem><MenuItem value="Outgoing">Εξερχόμενη — δώσαμε χρήματα</MenuItem>
      </TextField>
      {save.isError && <Alert severity="error">{extractErrorMessage(save.error)}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button color="error" onClick={onClose} disabled={save.isPending}>Κλείσιμο</Button><Button variant="contained" disabled={!direction || save.isPending} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions>
  </Dialog>;
}

function CreateAdvanceDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ number: "", receivedOn: today, partyType: "Customer", direction: "",
    customerId: "", producerId: "", insuranceCompanyId: "",
    amount: 0, currency: "EUR", paymentMethod: "BankTransfer", reference: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["customers-for-advance"], enabled: open && form.partyType === "Customer",
    queryFn: async () => (await api.get("/customers")).data });
  const producers = useQuery({ queryKey: ["producers-for-advance"], enabled: open && form.partyType === "Producer",
    queryFn: async () => (await api.get("/producers")).data });
  const carriers = useQuery({ queryKey: ["carriers-for-advance"], enabled: open && form.partyType === "Carrier",
    queryFn: async () => (await api.get("/insurance-companies")).data });
  useEffect(() => { if (open) { setErr(null); setForm({ number: `AD-${Date.now().toString(36).toUpperCase()}`, receivedOn: today, partyType: "Customer", direction: "", customerId: "", producerId: "", insuranceCompanyId: "", amount: 0, currency: "EUR", paymentMethod: "BankTransfer", reference: "", notes: "" }); } }, [open]);
  const save = useMutation({
    mutationFn: async () => (await api.post("/advance-payments", {
      number: form.number.trim(), receivedOn: form.receivedOn, partyType: form.partyType, direction: form.direction,
      customerId: form.partyType === "Customer" ? (form.customerId || null) : null,
      producerId: form.partyType === "Producer" ? (form.producerId || null) : null,
      insuranceCompanyId: form.partyType === "Carrier" ? (form.insuranceCompanyId || null) : null,
      amount: Number(form.amount), currency: form.currency.toUpperCase(),
      paymentMethod: form.paymentMethod, reference: form.reference || null, notes: form.notes || null
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={() => { if (!save.isPending) onClose(); }} fullWidth maxWidth="sm">
      <DialogTitle>{t("advance.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select label="Κατεύθυνση προκαταβολής" required value={form.direction} onChange={event => setForm({ ...form, direction: event.target.value })} fullWidth>
            <MenuItem value="" disabled>Επιλέξτε κατεύθυνση</MenuItem><MenuItem value="Incoming">Εισερχόμενη — λάβαμε χρήματα</MenuItem><MenuItem value="Outgoing">Εξερχόμενη — δώσαμε χρήματα</MenuItem>
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField required label={t("advance.number")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} fullWidth />
            <TextField type="date" required label="Ημερομηνία κίνησης" InputLabelProps={{ shrink: true }} value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} fullWidth />
          </Stack>
          <SearchableTextField label={t("advance.party")} value={form.partyType} onChange={e => setForm({
            ...form, partyType: e.target.value, customerId: "", producerId: "", insuranceCompanyId: ""
          })} fullWidth>
            {["Customer", "Producer", "Carrier"].map(p => <MenuItem key={p} value={p}>{t(`payeeType.${p}`, p)}</MenuItem>)}
          </SearchableTextField>
          <Alert severity="info" icon={<LinkIcon />}>
            {form.direction === "Incoming" ? "Καταγράφετε χρήματα που έλαβε το γραφείο από τον επιλεγμένο αντισυμβαλλόμενο." : form.direction === "Outgoing" ? "Καταγράφετε χρήματα που έδωσε το γραφείο στον επιλεγμένο αντισυμβαλλόμενο." : "Η κατεύθυνση επιλέγεται ξεχωριστά από τον τύπο αντισυμβαλλόμενου."} Η σύνδεση με συμβόλαιο ή εκκαθάριση μπορεί να γίνει αργότερα. Η κατανομή δεν δημιουργεί δεύτερη χρηματική κίνηση.
          </Alert>
          {form.partyType === "Customer" && (
            <SearchableSelect
              label={t("advance.customer")}
              value={form.customerId}
              onChange={(v) => setForm({ ...form, customerId: v })}
              options={(customers.data ?? []).map((c: any) => ({
                value: c.id,
                label: c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
              }))}
            />
          )}
          {form.partyType === "Producer" && (
            <SearchableSelect
              label={t("advance.producer")}
              value={form.producerId}
              onChange={(v) => setForm({ ...form, producerId: v })}
              options={(producers.data ?? []).map((p: any) => ({ value: p.id, label: p.name }))}
            />
          )}
          {form.partyType === "Carrier" && (
            <SearchableSelect
              label={t("advance.carrier")}
              value={form.insuranceCompanyId}
              onChange={(v) => setForm({ ...form, insuranceCompanyId: v })}
              options={(carriers.data ?? []).map((c: any) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" required label={t("advance.amount")} value={form.amount} inputProps={{ min: .01, step: .01 }} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} fullWidth />
            <TextField label={t("common.currency")} value={form.currency} inputProps={{ maxLength: 3 }} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} sx={{ width: { xs: "100%", sm: 110 }, flexShrink: 0 }} />
            <SearchableTextField label={t("advance.method")} value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} sx={{ width: { xs: "100%", sm: 180 }, flexShrink: 0 }}>
              {["Cash", "BankTransfer", "Cheque", "Card", "Other"].map(m => <MenuItem key={m} value={m}>{t(`paymentMethod.${m}`, m)}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          {(customers.isError || producers.isError || carriers.isError) && <Alert severity="error">{extractErrorMessage(customers.error || producers.error || carriers.error)}</Alert>}
          <TextField label={t("advance.reference")} value={form.reference} inputProps={{ maxLength: 80 }} onChange={e => setForm({ ...form, reference: e.target.value })} fullWidth />
          <TextField label={t("common.notes")} value={form.notes} inputProps={{ maxLength: 2000 }} onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.direction || !form.number.trim() || !form.receivedOn || form.currency.length !== 3 || !Number.isFinite(form.amount) || form.amount <= 0
          || (form.partyType === "Customer" && !form.customerId)
          || (form.partyType === "Producer" && !form.producerId)
          || (form.partyType === "Carrier" && !form.insuranceCompanyId)}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AllocateAdvanceDialog({ advance, onClose, onSaved }: {
  advance: AdvanceRow | null; onClose: () => void; onSaved: () => void;
}) {
  const [policyId, setPolicyId] = useState("");
  const [targetType, setTargetType] = useState("Policy");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const available = advance && advance.status !== "Refunded" && advance.status !== "FullyAllocated" ? Math.max(0, advance.amount - advance.allocatedAmount) : 0;
  const canAllocate = !!advance?.direction && available > 0 && advance.status !== "FullyAllocated";
  const supportsRuns = advance?.direction === "Outgoing" && advance.partyType === "Producer";
  const runs = useQuery<{ id: string; reference: string; commissionAmount: number; currency: string }[]>({
    queryKey: ["advance-commission-runs", advance?.id], enabled: !!advance && supportsRuns,
    queryFn: async () => (await api.get(`/advance-payments/${advance!.id}/commission-runs`)).data
  });
  const policies = useQuery<AdvancePolicy[]>({
    queryKey: ["policies-for-advance-allocation", advance?.partyType, advance?.customerId,
      advance?.producerId, advance?.insuranceCompanyId],
    enabled: Boolean(advance) && targetType === "Policy" && canAllocate,
    queryFn: async () => {
      const params = advance?.partyType === "Customer" && advance.customerId
        ? { customerId: advance.customerId }
        : advance?.partyType === "Carrier" && advance.insuranceCompanyId
          ? { insuranceCompanyId: advance.insuranceCompanyId }
          : {};
      const rows = (await api.get<AdvancePolicy[]>("/policies", { params })).data;
      if (advance?.partyType === "Producer") return rows.filter(row => row.producerId === advance.producerId);
      return rows;
    }
  });
  const eligiblePolicies = useMemo(() => (policies.data ?? []).filter(policy =>
    policy.currency.toUpperCase() === (advance?.currency ?? "").toUpperCase()), [policies.data, advance?.currency]);
  useEffect(() => {
    setPolicyId("");
    setTargetType("Policy");
    setAmount(available);
    setError(null);
  }, [advance?.id, available]);
  const allocate = useMutation({
    mutationFn: async () => api.post(`/advance-payments/${advance!.id}/allocate`, {
      policyId, targetType, amount: Number(amount)
    }),
    onSuccess: onSaved,
    onError: err => setError(extractErrorMessage(err))
  });
  const partyName = advance?.customerName ?? advance?.producerName ?? advance?.insuranceCompanyName ?? "—";

  return (
    <Dialog open={Boolean(advance)} onClose={() => { if (!allocate.isPending) onClose(); }} fullWidth maxWidth="md">
      <DialogTitle>Σύνδεση και κατανομή προκαταβολής <AdvanceDirectionChip direction={advance?.direction} /></DialogTitle>
      <DialogContent dividers>
        {advance && <Stack spacing={2}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {!advance.direction && <Alert severity="warning">Χαρακτηρίστε πρώτα την κατεύθυνση από το μολύβι στη λίστα προκαταβολών. Οι υπάρχουσες κατανομές παραμένουν ορατές.</Alert>}
          {advance.status === "Refunded" && <Alert severity="info">Η προκαταβολή έχει επιστραφεί και δεν είναι διαθέσιμη για κατανομή.</Alert>}
          <Typography variant="caption" color="text.secondary">Η κατανομή συσχετίζει το ποσό με συμβόλαιο ή εκκαθάριση. Δεν δημιουργεί νέα είσπραξη ή πληρωμή και δεν δηλώνει αυτόματα εξόφληση οφειλής.</Typography>
          <Card variant="outlined" sx={{ p: 1.5, bgcolor: "#edf3f9" }}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
              <Box><Typography variant="caption" color="text.secondary">Προκαταβολή</Typography><Typography fontWeight={800}>{advance.number}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Αντισυμβαλλόμενος</Typography><Typography fontWeight={800}>{partyName}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Αρχικό ποσό</Typography><Typography fontWeight={800}>{money(advance.amount, advance.currency)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Διαθέσιμο υπόλοιπο</Typography><Typography fontWeight={900} color="success.dark">{money(available, advance.currency)}</Typography></Box>
            </Box>
          </Card>

          <Box>
            <Typography fontWeight={800} sx={{ mb: 1 }}>Υφιστάμενες κατανομές</Typography>
            {(advance.allocations ?? []).length === 0 ? (
              <Alert severity="warning">Η προκαταβολή δεν έχει συνδεθεί ακόμη με συμβόλαιο ή οφειλή.</Alert>
            ) : (
              <Card variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Συμβόλαιο / εκκαθάριση</TableCell><TableCell>Πελάτης</TableCell><TableCell>Ημερομηνία</TableCell><TableCell align="right">Ποσό</TableCell></TableRow></TableHead>
                  <TableBody>{advance.allocations.map(row => <TableRow key={row.id}>
                    <TableCell sx={{ fontWeight: 800 }}>{row.reference || row.policyNumber}</TableCell>
                    <TableCell>{row.customerName}</TableCell><TableCell>{row.linkedOn}</TableCell>
                    <TableCell align="right">{money(row.amount, advance.currency)}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </Card>
            )}
          </Box>

          {canAllocate && <Card variant="outlined" sx={{ p: 1.5 }}>
            <Typography fontWeight={800} sx={{ mb: 1 }}>Νέα κατανομή</Typography>
            {supportsRuns && <TextField select size="small" label="Σύνδεση με" value={targetType} onChange={event => { setTargetType(event.target.value); setPolicyId(""); }} fullWidth sx={{ mb: 1.5 }}>
              <MenuItem value="Policy">Συμβόλαιο</MenuItem><MenuItem value="CommissionRun">Οριστικοποιημένη εκκαθάριση προμηθειών συνεργάτη</MenuItem>
            </TextField>}
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 180px" } }}>
              {targetType === "Policy" ? <SearchableSelect label="Συμβόλαιο" value={policyId} onChange={setPolicyId}
                disabled={policies.isLoading || eligiblePolicies.length === 0}
                emptyLabel={policies.isLoading ? "Φόρτωση…" : "Επιλέξτε συμβόλαιο"}
                options={eligiblePolicies.map(policy => ({
                  value: policy.id,
                  label: `${policy.policyNumber} · ${policy.customerDisplay}`,
                  hint: `${money(policy.premium, policy.currency)} · ${policy.insuranceCompanyName}`
                }))} /> : <SearchableSelect label="Εκκαθάριση συνεργάτη" value={policyId} onChange={setPolicyId} disabled={runs.isLoading}
                options={(runs.data ?? []).map(run => ({ value: run.id, label: run.reference, hint: `Προμήθειες συνεργάτη: ${money(run.commissionAmount, run.currency)}` }))} />}
              <TextField type="number" size="small" label="Ποσό κατανομής" value={amount}
                inputProps={{ min: 0.01, max: available, step: 0.01 }}
                onChange={event => setAmount(Number(event.target.value))} />
            </Box>
            {targetType === "Policy" && eligiblePolicies.length === 0 && !policies.isLoading && (
              <Alert severity="info" sx={{ mt: 1 }}>Δεν βρέθηκαν συμβόλαια του ίδιου αντισυμβαλλόμενου και νομίσματος.</Alert>
            )}
            {targetType === "CommissionRun" && !runs.isLoading && !runs.data?.length && <Alert severity="info" sx={{ mt: 1 }}>Δεν υπάρχουν οριστικοποιημένες εκκαθαρίσεις του ίδιου συνεργάτη και νομίσματος.</Alert>}
            {(policies.isError || runs.isError) && <Alert severity="error" sx={{ mt: 1 }}>{extractErrorMessage(policies.error || runs.error)}</Alert>}
          </Card>}
        </Stack>}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose} disabled={allocate.isPending}>Κλείσιμο</Button>
        {canAllocate && <Button variant="contained" startIcon={<LinkIcon />} onClick={() => allocate.mutate()}
          disabled={!policyId || !Number.isFinite(amount) || amount <= 0 || amount > available || allocate.isPending}>
          {allocate.isPending ? <CircularProgress size={18} color="inherit" /> : "Κατανομή ποσού"}
        </Button>}
      </DialogActions>
    </Dialog>
  );
}

/* ============================================================================
   RECONCILIATION (Συσχέτιση Κινήσεων / Αναντιστοίχιστα)
   ========================================================================= */
export function ReconciliationPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["unmatched"], queryFn: async () => (await api.get("/reconciliation/unmatched")).data });
  // Global filters shared across all three sections — one search box +
  // date window keeps the reconciliation flow «check everything today»
  // fast instead of forcing three separate filter cards.
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <CompareArrowsIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("reconciliation.title")}</Typography>
            <HelpHint id="page.reconciliation" />
          </Stack>
          <Typography color="text.secondary">{t("reconciliation.subtitle")}</Typography>
        </Box>
      </Stack>

      {/* Shared filter card — applies to all three tables below. */}
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid", gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField size="small" placeholder="Αναζήτηση: reference ή συμβαλλόμενος…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ gridColumn: { md: "span 2" } }} />
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} fullWidth
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} fullWidth
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}
            sx={{ gridColumn: { md: "1 / -1" } }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {q.isLoading ? <CircularProgress /> : (
        <Stack spacing={3}>
          <Section title={t("reconciliation.unmatchedReceipts")} rows={q.data?.receipts ?? []}
            search={search} fromDate={fromDate} toDate={toDate} />
          <Section title={t("reconciliation.unmatchedPayments")} rows={q.data?.payments ?? []}
            search={search} fromDate={fromDate} toDate={toDate} />
          <Section title={t("reconciliation.openAdvances")} rows={q.data?.advances ?? []}
            search={search} fromDate={fromDate} toDate={toDate} />
        </Stack>
      )}
    </Box>
  );
}

function Section({ title, rows, search, fromDate, toDate }: {
  title: string; rows: any[]; search: string; fromDate: string; toDate: string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(r => {
      if (needle) {
        const hay = `${r.reference ?? ""} ${r.partyName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (fromDate && (r.date ?? "") < fromDate) return false;
      if (toDate && (r.date ?? "") > toDate) return false;
      return true;
    });
  }, [rows, search, fromDate, toDate]);
  useEffect(() => { setPage(0); }, [search, fromDate, toDate]);
  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Card variant="outlined">
      <Typography sx={{ p: 2, fontWeight: 700 }}>{title} ({filtered.length}{filtered.length !== rows.length ? ` / ${rows.length}` : ""})</Typography>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>{t("reconciliation.reference")}</TableCell>
          <TableCell>{t("reconciliation.date")}</TableCell>
          <TableCell>{t("reconciliation.party")}</TableCell>
          <TableCell align="right">{t("reconciliation.amount")}</TableCell>
          <TableCell align="right" />
        </TableRow></TableHead>
        <TableBody>
          {paged.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>{t("reconciliation.allMatched")}</TableCell></TableRow>}
          {paged.map((r, i) => (
            <TableRow key={r.id || i}>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.reference}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.partyName}{r.type === "Advance" && <Box mt={.5}><AdvanceDirectionChip direction={r.direction} /></Box>}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>{money(r.amount, r.currency)}</TableCell>
              <TableCell align="right"><IconButton size="small" color="primary"><LinkIcon fontSize="small" /></IconButton></TableCell>
            </TableRow>
          ))}
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
  );
}

/* ============================================================================
   TACHYPAYMENTS (Ταχυπληρωμές ΕΛ.ΤΑ.)
   ========================================================================= */
export function TachyPaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["tachy"], queryFn: async () => (await api.get("/tachypayments")).data });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LocalPostOfficeIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("tachy.title")}</Typography>
              <HelpHint id="page.tachy" />
            </Stack>
            <Typography color="text.secondary">{t("tachy.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>{t("tachy.create")}</Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("tachy.batchNumber")}</TableCell>
              <TableCell>{t("tachy.createdAt")}</TableCell>
              <TableCell>{t("tachy.dueDate")}</TableCell>
              <TableCell align="right">{t("tachy.policyCount")}</TableCell>
              <TableCell align="right">{t("tachy.totalAmount")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((b: any) => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{b.batchNumber}</TableCell>
                  <TableCell>{new Date(b.createdAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell>{b.dueDate}</TableCell>
                  <TableCell align="right">{b.policyCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{money(b.totalAmount, b.currency)}</TableCell>
                  <TableCell><Chip size="small" color={b.status === "Settled" ? "success" : b.status === "Exported" ? "info" : "default"} label={String(t(`batchStatus.${b.status}`, b.status))} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<DownloadIcon />} href={`/api/tachypayments/${b.id}/export`} target="_blank">{t("tachy.exportCsv")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateTachyDialog open={open} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["tachy"] }); setOpen(false); }} />
    </Box>
  );
}

function CreateTachyDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(today);
  const [surcharge, setSurcharge] = useState(2);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const policies = useQuery({ queryKey: ["unpaid-for-tachy"], enabled: open,
    queryFn: async () => (await api.get("/reports/507")).data });
  const save = useMutation({
    mutationFn: async () => (await api.post("/tachypayments", {
      dueDate, surchargePerSlip: Number(surcharge), policyIds: Array.from(selected)
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("tachy.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack direction="row" spacing={2} mb={2}>
          <TextField type="date" label={t("tachy.dueDate")} InputLabelProps={{ shrink: true }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <TextField type="number" label={t("tachy.surcharge")} value={surcharge} onChange={e => setSurcharge(Number(e.target.value))} />
          <Typography sx={{ ml: 2, alignSelf: "center" }}>{t("tachy.selected", { count: selected.size })}</Typography>
        </Stack>
        <Card variant="outlined" sx={{ maxHeight: 400, overflow: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell />
              <TableCell>{t("tachy.policyNumber")}</TableCell>
              <TableCell>{t("tachy.customer")}</TableCell>
              <TableCell align="right">{t("tachy.outstanding")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(policies.data ?? []).map((p: any) => (
                <TableRow key={p.id} hover selected={selected.has(p.id)} onClick={() => toggle(p.id)} sx={{ cursor: "pointer" }}>
                  <TableCell><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
                  <TableCell>{p.customerName}</TableCell>
                  <TableCell align="right">{money(p.outstanding, p.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || selected.size === 0}>{t("tachy.createBatch")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ============================================================================
   INFO CENTER (Ελληνικό Κέντρο Πληροφοριών)
   ========================================================================= */
export function InfoCenterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [kind, setKind] = useState("Vehicles");
  const q = useQuery({ queryKey: ["info-center"], queryFn: async () => (await api.get("/info-center")).data });
  const create = useMutation({ mutationFn: async () => (await api.post("/info-center", { kind })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["info-center"] }) });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CloudUploadIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("infoCenter.title")}</Typography>
              <HelpHint id="page.infoCenter" />
            </Stack>
            <Typography color="text.secondary">{t("infoCenter.subtitle")}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <SearchableTextField label={t("infoCenter.kind")} value={kind} onChange={e => setKind(e.target.value)} sx={{ width: 200 }}>
            {["Vehicles", "Customers", "Policies"].map(k => <MenuItem key={k} value={k}>{t(`infoCenterKind.${k}`, k)}</MenuItem>)}
          </SearchableTextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => create.mutate()} disabled={create.isPending}>{t("infoCenter.createBatch")}</Button>
        </Stack>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>{t("infoCenter.note")}</Alert>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("infoCenter.batchNumber")}</TableCell>
              <TableCell>{t("infoCenter.createdAt")}</TableCell>
              <TableCell>{t("infoCenter.kind")}</TableCell>
              <TableCell align="right">{t("infoCenter.recordCount")}</TableCell>
              <TableCell>{t("common.status")}</TableCell>
              <TableCell>{t("infoCenter.response")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{e.batchNumber}</TableCell>
                  <TableCell>{new Date(e.createdAt).toLocaleString("el-GR")}</TableCell>
                  <TableCell>{String(t(`infoCenterKind.${e.kind}`, e.kind))}</TableCell>
                  <TableCell align="right">{e.recordCount}</TableCell>
                  <TableCell><Chip size="small" color={e.status === "Accepted" ? "success" : e.status === "Rejected" ? "error" : "default"} label={String(t(`batchStatus.${e.status}`, e.status))} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{e.responseCode ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
}

/* ============================================================================
   VEHICLE MODELS (lookup catalog)
   ========================================================================= */
export function VehicleModelsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["vehicle-models"], queryFn: async () => (await api.get("/vehicle-models")).data });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <DirectionsCarIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("vehicles.title")}</Typography>
              <HelpHint id="page.vehicles" />
            </Stack>
            <Typography color="text.secondary">{t("vehicles.subtitle")}</Typography>
          </Box>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>{t("vehicles.create")}</Button>
      </Stack>
      {q.isLoading ? <CircularProgress /> : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{t("vehicles.manufacturer")}</TableCell>
              <TableCell>{t("vehicles.model")}</TableCell>
              <TableCell>{t("vehicles.trim")}</TableCell>
              <TableCell align="right">{t("vehicles.engineCc")}</TableCell>
              <TableCell align="right">{t("vehicles.hp")}</TableCell>
              <TableCell>{t("vehicles.fuel")}</TableCell>
              <TableCell>{t("vehicles.category")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(q.data ?? []).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{v.manufacturer}</TableCell>
                  <TableCell>{v.model}</TableCell>
                  <TableCell>{v.trim ?? "—"}</TableCell>
                  <TableCell align="right">{v.engineCc ?? "—"}</TableCell>
                  <TableCell align="right">{v.horsePower ?? "—"}</TableCell>
                  <TableCell>{v.fuelType ?? "—"}</TableCell>
                  <TableCell>{v.category ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <CreateVehicleDialog open={open} onClose={() => setOpen(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ["vehicle-models"] }); setOpen(false); }} />
    </Box>
  );
}

function CreateVehicleDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ manufacturer: "", model: "", trim: "", engineCc: "", horsePower: "", fuelType: "Petrol", category: "passenger", isActive: true });
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post("/vehicle-models", {
      manufacturer: form.manufacturer.trim(), model: form.model.trim(),
      trim: form.trim || null, engineCc: form.engineCc ? Number(form.engineCc) : null,
      horsePower: form.horsePower ? Number(form.horsePower) : null,
      fuelType: form.fuelType, category: form.category, isActive: form.isActive
    })).data,
    onSuccess: onSaved, onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("vehicles.createTitle")}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField required label={t("vehicles.manufacturer")} value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} fullWidth />
            <TextField required label={t("vehicles.model")} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} fullWidth />
          </Stack>
          <TextField label={t("vehicles.trim")} value={form.trim} onChange={e => setForm({ ...form, trim: e.target.value })} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField type="number" label={t("vehicles.engineCc")} value={form.engineCc} onChange={e => setForm({ ...form, engineCc: e.target.value })} fullWidth />
            <TextField type="number" label={t("vehicles.hp")} value={form.horsePower} onChange={e => setForm({ ...form, horsePower: e.target.value })} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <SearchableTextField label={t("vehicles.fuel")} value={form.fuelType} onChange={e => setForm({ ...form, fuelType: e.target.value })} fullWidth>
              {["Petrol", "Diesel", "Hybrid", "Electric", "LPG", "CNG"].map(f => <MenuItem key={f} value={f}>{String(t(`fuel.${f}`, f))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label={t("vehicles.category")} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth>
              {["passenger", "van", "truck", "motorcycle", "bus", "tractor"].map(c => <MenuItem key={c} value={c}>{String(t(`vehicleClass.${c}`, c))}</MenuItem>)}
            </SearchableTextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.manufacturer.trim() || !form.model.trim()}>{t("common.save")}</Button>
      </DialogActions>
    </Dialog>
  );
}
