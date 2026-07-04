import { useEffect, useState } from "react";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

const KIND_LABELS: Record<number, string> = {
  1: "Επιστροφή λόγω ακύρωσης",
  2: "Μείωση ασφαλίστρου",
  3: "Αναπροσαρμογή προμήθειας",
  99: "Χειροκίνητο πιστωτικό"
};

interface CreditNoteDto {
  id: string; creditNoteNumber: string; kind: number; status: string;
  issuedAt: string; customerId: string | null; policyId: string | null;
  amount: number; currency: string;
  description: string; relatedDocumentRef: string | null; createdAt: string;
}

interface CustomerLite { id: string; firstName: string | null; lastName: string | null; companyName: string | null; customerNumber: string; }
interface PolicyLite { id: string; policyNumber: string; }

export function CreditNotesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const q = useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => (await api.get<CreditNoteDto[]>("/credit-notes")).data
  });

  const filtered = (q.data ?? []).filter(c => {
    if (kindFilter   && String(c.kind)  !== kindFilter)   return false;
    if (statusFilter && c.status        !== statusFilter) return false;
    if (fromDate && c.issuedAt < fromDate) return false;
    if (toDate   && c.issuedAt > toDate)   return false;
    if (search) {
      const s = search.toLowerCase();
      if (!`${c.creditNoteNumber} ${c.description} ${c.relatedDocumentRef ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const total = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <ReceiptLongIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Πιστωτικά Σημειώματα</Typography>
              <HelpHint id="creditNote.kind" />
            </Stack>
            <Typography color="text.secondary">
              Δημιουργία και διαχείριση πιστωτικών — επιστροφές από ακυρώσεις, μειώσεις ασφαλίστρου, αναπροσαρμογές προμήθειας ή χειροκίνητα.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέο πιστωτικό
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ md: "center" }}>
          <TextField size="small" placeholder="Αναζήτηση…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό, περιγραφή ή σχετικό έγγραφο." />
            }} />
          <FilterFieldWrap tip="Φιλτράρετε τα πιστωτικά ανά είδος (Έκπτωση, Επιστροφή, Ακύρωση κ.λπ.).">
            <SearchableTextField size="small" label="Είδος"
              value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} sx={{ minWidth: 170, width: "100%" }}>
              <MenuItem value="">Όλα</MenuItem>
              {Object.entries(KIND_LABELS).map(([k, label]) =>
                <MenuItem key={k} value={k}>{label}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε ανά κατάσταση: Εκδόθηκε, Εφαρμόστηκε ή Ακυρώθηκε.">
            <SearchableTextField size="small" label="Κατάσταση"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              <MenuItem value="Issued">Εκδόθηκε</MenuItem>
              <MenuItem value="Applied">Εφαρμόστηκε</MenuItem>
              <MenuItem value="Cancelled">Ακυρώθηκε</MenuItem>
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία έκδοσης από — εμφανίζει πιστωτικά από αυτήν την ημέρα και μετά.">
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Ημερομηνία έκδοσης έως — εμφανίζει πιστωτικά μέχρι αυτήν την ημέρα.">
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 140, width: "100%" }} />
          </FilterFieldWrap>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.secondary">Σύνολο φιλτραρισμένα</Typography>
            <Typography fontWeight={800}>{money(total)}</Typography>
          </Box>
          <Button size="small" onClick={() => {
            setSearch(""); setKindFilter(""); setStatusFilter(""); setFromDate(""); setToDate("");
          }}>Καθαρισμός</Button>
        </Stack>
      </Card>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Αρ. πιστωτικού</TableCell>
                <TableCell>Είδος</TableCell>
                <TableCell>Ημ. έκδοσης</TableCell>
                <TableCell>Περιγραφή</TableCell>
                <TableCell>Σχετικό</TableCell>
                <TableCell align="right">Ποσό</TableCell>
                <TableCell>Κατάσταση</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν πιστωτικά σημειώματα.
                </TableCell></TableRow>
              )}
              {filtered.map(n => (
                <TableRow key={n.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{n.creditNoteNumber}</TableCell>
                  <TableCell>{KIND_LABELS[n.kind] ?? "—"}</TableCell>
                  <TableCell>{date(n.issuedAt)}</TableCell>
                  <TableCell>{n.description}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{n.relatedDocumentRef ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                    {money(n.amount, n.currency)}
                  </TableCell>
                  <TableCell><Chip size="small" color={n.status === "Issued" ? "success" : "default"} label={n.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreditNoteDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["credit-notes"] }); setCreateOpen(false); }} />
    </Box>
  );
}

function CreditNoteDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    kind: 99, issuedAt: today, amount: 0, vatAmount: "", currency: "EUR",
    description: "", relatedDocumentRef: "", notes: ""
  });
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [policy, setPolicy] = useState<PolicyLite | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers-for-credit-note"],
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data, enabled: open
  });
  const policies = useQuery({
    queryKey: ["policies-for-credit-note"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data, enabled: open
  });

  useEffect(() => {
    if (open) {
      setForm({ kind: 99, issuedAt: today, amount: 0, vatAmount: "", currency: "EUR",
        description: "", relatedDocumentRef: "", notes: "" });
      setCustomer(null); setPolicy(null); setErr(null);
    }
  }, [open, today]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        kind: form.kind, issuedAt: form.issuedAt,
        customerId: customer?.id ?? null,
        insuranceCompanyId: null, producerId: null,
        policyId: policy?.id ?? null,
        amount: Number(form.amount),
        vatAmount: form.vatAmount ? Number(form.vatAmount) : null,
        currency: form.currency,
        description: form.description.trim(),
        relatedDocumentRef: form.relatedDocumentRef || null,
        notes: form.notes || null
      };
      return (await api.post("/credit-notes", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const displayName = (c: CustomerLite) =>
    c.companyName ?? (`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέο πιστωτικό σημείωμα</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Είδος *" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: Number(e.target.value) })} sx={{ flex: 1 }}>
              {Object.entries(KIND_LABELS).map(([k, v]) =>
                <MenuItem key={k} value={Number(k)}>{v}</MenuItem>)}
            </SearchableTextField>
            <TextField type="date" label="Ημ. έκδοσης" InputLabelProps={{ shrink: true }}
              value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} />
          </Stack>

          <Autocomplete options={customers.data ?? []} getOptionLabel={displayName}
            value={customer} onChange={(_, v) => setCustomer(v)}
            renderInput={(p) => <TextField {...p} label="Πελάτης (προαιρετικό)" />}
            isOptionEqualToValue={(a, b) => a.id === b.id} />

          <Autocomplete options={policies.data ?? []}
            getOptionLabel={(p) => p.policyNumber}
            value={policy} onChange={(_, v) => setPolicy(v)}
            renderInput={(p) => <TextField {...p} label="Συμβόλαιο (προαιρετικό)" />}
            isOptionEqualToValue={(a, b) => a.id === b.id} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Ποσό *" required value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              inputProps={{ step: "0.01" }} sx={{ flex: 1 }} />
            <TextField type="number" label="ΦΠΑ (προαιρετικά)" value={form.vatAmount}
              onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
              inputProps={{ step: "0.01" }} sx={{ width: 160 }} />
            <TextField label="Νόμισμα" value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
              sx={{ width: 100 }} />
          </Stack>

          <TextField label="Περιγραφή *" required value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} multiline minRows={2} fullWidth />
          <TextField label="Σχετικό παραστατικό" value={form.relatedDocumentRef}
            onChange={(e) => setForm({ ...form, relatedDocumentRef: e.target.value })} fullWidth
            helperText="π.χ. αρ. αρχικού παραστατικού / αρ. ακύρωσης" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !form.description.trim() || form.amount <= 0}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Έκδοση πιστωτικού"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
