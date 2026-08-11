import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Έσοδα / Έξοδα γραφείου — free-form categorised P&L rows that don't
 * come from a policy. Parity with the desktop Financial Movements module.
 */

interface EntryDto {
  id: string;
  kind: "Income" | "Expense";
  category: string;
  subcategory: string | null;
  entryDate: string;
  amount: number;
  currency: string;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  createdAt: string;
}

interface RollupRow { kind: "Income" | "Expense"; category: string; total: number; }

// Common categories — used as autocomplete suggestions; the field is
// still free-form so tenants can extend without a code change.
const EXPENSE_CATEGORIES = [
  "Ενοίκιο", "Λογαριασμοί (ΔΕΗ / ύδρευση / internet)", "Τηλεπικοινωνίες",
  "Μισθοδοσία", "Ασφάλιση εργαζομένων", "Λογιστής",
  "Γραφική ύλη", "Marketing & διαφήμιση", "Ταξίδια & μετακινήσεις",
  "Εκπαίδευση προσωπικού", "Software & συνδρομές", "Τραπεζικά έξοδα",
  "Φόροι & τέλη", "Επισκευές & συντήρηση", "Άλλα έξοδα"
];
const INCOME_CATEGORIES = [
  "Συμβουλευτικές υπηρεσίες", "Επιχορηγήσεις", "Τόκοι καταθέσεων",
  "Ενοικίαση χώρου", "Άλλα έσοδα"
];

const MONTHS = [
  { v: 1, n: "Ιανουάριος" },   { v: 2, n: "Φεβρουάριος" }, { v: 3, n: "Μάρτιος" },
  { v: 4, n: "Απρίλιος" },     { v: 5, n: "Μάιος" },       { v: 6, n: "Ιούνιος" },
  { v: 7, n: "Ιούλιος" },      { v: 8, n: "Αύγουστος" },   { v: 9, n: "Σεπτέμβριος" },
  { v: 10, n: "Οκτώβριος" },   { v: 11, n: "Νοέμβριος" },  { v: 12, n: "Δεκέμβριος" },
];
const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });

export function GeneralFinancialEntriesPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "">(now.getMonth() + 1);
  const [kindFilter, setKindFilter] = useState<"Income" | "Expense" | "">("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<EntryDto | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["general-financial-entries", year, month, kindFilter, search],
    queryFn: async () => (await api.get<EntryDto[]>("/general-financial-entries", { params: {
      year, month: month || undefined, kind: kindFilter || undefined, search: search || undefined
    }})).data
  });

  const rollupQ = useQuery({
    queryKey: ["general-financial-entries", "rollup", year, month],
    queryFn: async () => (await api.get<RollupRow[]>("/general-financial-entries/rollup", { params: {
      year, month: month || undefined
    }})).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/general-financial-entries/${id}`); },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["general-financial-entries"] }); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const rows = listQ.data ?? [];
  const rollup = rollupQ.data ?? [];
  const totals = useMemo(() => {
    const income = rollup.filter(r => r.kind === "Income").reduce((s, r) => s + r.total, 0);
    const expense = rollup.filter(r => r.kind === "Expense").reduce((s, r) => s + r.total, 0);
    return { income, expense, net: income - expense };
  }, [rollup]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Έσοδα / Έξοδα γραφείου</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Καταγραφή έμμεσων εσόδων και εξόδων που ΔΕΝ έρχονται από συμβόλαιο (ενοίκιο, ρεύμα, μισθοδοσία, marketing κτλ.),
            με κατηγορίες για μηνιαία P&amp;L του γραφείου.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setDialog("new")}>
          Νέα εγγραφή
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI strip */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, mb: 3 }}>
        <Kpi label="Σύνολο εσόδων"  value={moneyFmt.format(totals.income)}  color="success.main" icon={<TrendingUpIcon />} />
        <Kpi label="Σύνολο εξόδων"  value={moneyFmt.format(totals.expense)} color="error.main"   icon={<TrendingDownIcon />} />
        <Kpi label="Καθαρό αποτέλεσμα" value={moneyFmt.format(totals.net)}
             color={totals.net >= 0 ? "success.main" : "error.main"} />
      </Box>

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField type="number" size="small" label="Έτος" value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)} sx={{ width: 110 }} />
          <TextField select size="small" label="Μήνας" value={month}
            onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Τύπος" value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "Income" | "Expense" | "")}
            sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλα</MenuItem>
            <MenuItem value="Income">Έσοδα</MenuItem>
            <MenuItem value="Expense">Έξοδα</MenuItem>
          </TextField>
          <TextField size="small" label="Αναζήτηση" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="κατηγορία / περιγραφή / reference" sx={{ minWidth: 240 }} />
          <Box sx={{ flex: 1 }} />
          <Chip label={`${rows.length} γραμμές`} />
        </Stack>
      </Card>

      {/* Rollup chips */}
      {rollup.length > 0 && (
        <Card variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Σύνολα ανά κατηγορία {month ? `για ${MONTHS[Number(month) - 1].n} ${year}` : `για το ${year}`}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {rollup.map((r) => (
              <Chip key={`${r.kind}:${r.category}`} size="small" variant="outlined"
                color={r.kind === "Income" ? "success" : "error"}
                label={`${r.category}: ${moneyFmt.format(r.total)}`} />
            ))}
          </Stack>
        </Card>
      )}

      {/* Table */}
      <Card variant="outlined">
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ημερομηνία</TableCell>
                <TableCell>Τύπος</TableCell>
                <TableCell>Κατηγορία</TableCell>
                <TableCell>Περιγραφή</TableCell>
                <TableCell>Αντισυμβαλλόμενος</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell align="right">Ποσό</TableCell>
                <TableCell align="right">Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow><TableCell colSpan={8} sx={{ py: 4, textAlign: "center" }}><CircularProgress size={22} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Καμία εγγραφή. Πάτα «Νέα εγγραφή» για να ξεκινήσεις.
                </TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>{new Date(r.entryDate).toLocaleDateString("el-GR")}</TableCell>
                  <TableCell>
                    <Chip size="small" color={r.kind === "Income" ? "success" : "error"}
                      label={r.kind === "Income" ? "Έσοδο" : "Έξοδο"} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{r.category}</Typography>
                    {r.subcategory && <Typography variant="caption" color="text.secondary">{r.subcategory}</Typography>}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 340 }}>{r.description ?? "—"}</TableCell>
                  <TableCell>{r.counterparty ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{r.reference ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700,
                    color: r.kind === "Income" ? "success.main" : "error.main" }}>
                    {r.kind === "Income" ? "+" : "-"}{moneyFmt.format(r.amount)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Επεξεργασία">
                      <IconButton size="small" onClick={() => setDialog(r)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Διαγραφή">
                      <IconButton size="small" color="error"
                        onClick={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(r.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <EntryDialog
        open={!!dialog}
        entry={dialog === "new" ? null : dialog}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          void qc.invalidateQueries({ queryKey: ["general-financial-entries"] });
        }}
      />
    </Box>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        {icon && <Box sx={{ color: color ?? "text.primary" }}>{icon}</Box>}
        <Box>
          <Typography variant="caption" color="text.secondary"
            sx={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: color ?? "text.primary" }}>{value}</Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function EntryDialog({
  open, entry, onClose, onSaved
}: {
  open: boolean;
  entry: EntryDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    kind: "Expense" as "Income" | "Expense",
    category: "",
    subcategory: "",
    entryDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    currency: "EUR",
    description: "",
    counterparty: "",
    reference: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        kind: entry.kind, category: entry.category, subcategory: entry.subcategory ?? "",
        entryDate: entry.entryDate.slice(0, 10), amount: entry.amount, currency: entry.currency,
        description: entry.description ?? "", counterparty: entry.counterparty ?? "",
        reference: entry.reference ?? ""
      });
    } else {
      setForm({
        kind: "Expense", category: "", subcategory: "",
        entryDate: new Date().toISOString().slice(0, 10),
        amount: 0, currency: "EUR",
        description: "", counterparty: "", reference: ""
      });
    }
    setError(null);
  }, [open, entry]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        kind: form.kind, category: form.category.trim(),
        subcategory: form.subcategory.trim() || null,
        entryDate: form.entryDate,
        amount: form.amount, currency: form.currency,
        description: form.description.trim() || null,
        counterparty: form.counterparty.trim() || null,
        reference: form.reference.trim() || null,
      };
      if (entry) return (await api.put(`/general-financial-entries/${entry.id}`, body)).data;
      return (await api.post("/general-financial-entries", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  const valid = form.category.trim().length > 0 && form.amount > 0;
  const suggestions = form.kind === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{entry ? "Επεξεργασία εγγραφής" : "Νέα εγγραφή εσόδου / εξόδου"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField select label="Τύπος" required value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as "Income" | "Expense" })}
              sx={{ width: 180 }}>
              <MenuItem value="Expense">Έξοδο</MenuItem>
              <MenuItem value="Income">Έσοδο</MenuItem>
            </TextField>
            <TextField type="date" label="Ημερομηνία" required fullWidth
              InputLabelProps={{ shrink: true }} value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </Stack>
          <Autocomplete freeSolo options={suggestions}
            value={form.category}
            onChange={(_, v) => setForm({ ...form, category: v ?? "" })}
            onInputChange={(_, v) => setForm({ ...form, category: v })}
            renderInput={(params) => <TextField {...params} label="Κατηγορία" required />}
          />
          <TextField label="Υποκατηγορία (προαιρετικό)" fullWidth value={form.subcategory}
            onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField type="number" label="Ποσό (€)" required fullWidth value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
              inputProps={{ step: "0.01", min: 0 }} />
            <TextField label="Νόμισμα" value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              sx={{ width: 110 }} inputProps={{ maxLength: 3 }} />
          </Stack>
          <TextField label="Αντισυμβαλλόμενος (προμηθευτής / πελάτης)" fullWidth
            value={form.counterparty}
            onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
          <TextField label="Reference (τιμολόγιο / απόδειξη)" fullWidth
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          <TextField label="Περιγραφή / σημείωση" fullWidth multiline minRows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error">Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || save.isPending}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
