import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableTextField } from "./SearchableTextField";
import { money } from "../utils/format";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
interface CustomerOption { id: string; customerNumber: string; type: string; firstName?: string; lastName?: string; companyName?: string; }
interface CompanyOption { id: string; name: string; }
interface Rule {
  id: string; customerId: string; customerName: string; insuranceCompanyId: string | null; policyType: PolicyType | null;
  currency: string | null; maximumOutstanding: number | null; maximumOverdueDays: number | null; maximumOpenPolicies: number | null;
  effectiveFrom: string; effectiveTo: string | null; isException: boolean; isActive: boolean; notes: string | null;
}
interface RuleBody {
  customerId: string; insuranceCompanyId: string | null; policyType: PolicyType | null; currency: string | null;
  maximumOutstanding: number | null; maximumOverdueDays: number | null; maximumOpenPolicies: number | null;
  effectiveFrom: string; effectiveTo: string | null; isException: boolean; isActive: boolean; notes: string | null;
}
const today = () => new Date().toISOString().slice(0, 10);
const blank = (): RuleBody => ({ customerId: "", insuranceCompanyId: null, policyType: null, currency: null,
  maximumOutstanding: null, maximumOverdueDays: null, maximumOpenPolicies: null,
  effectiveFrom: today(), effectiveTo: null, isException: false, isActive: true, notes: null });
const policyTypes: { value: PolicyType; label: string }[] = [
  { value: "Auto", label: "Αυτοκίνητο" }, { value: "Home", label: "Κατοικία" }, { value: "Health", label: "Υγεία" },
  { value: "Life", label: "Ζωή" }, { value: "Business", label: "Επιχείρηση" }, { value: "Travel", label: "Ταξίδι" }, { value: "Other", label: "Άλλο" },
];
const nameOf = (c: CustomerOption) => c.type === "Individual" ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : c.companyName ?? c.customerNumber;

export function CreditControlRulesPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rules = useQuery({ queryKey: ["credit-control-rules"], queryFn: async () => (await api.get<Rule[]>("/credit-control-rules")).data });
  const customers = useQuery({ queryKey: ["credit-control-customers"], queryFn: async () => (await api.get<CustomerOption[]>("/customers")).data });
  const companies = useQuery({ queryKey: ["credit-control-companies"], queryFn: async () => (await api.get<CompanyOption[]>("/insurance-companies")).data });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/credit-control-rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["credit-control-rules"] }), onError: e => setError(extractErrorMessage(e)) });
  const [form, setForm] = useState<RuleBody>(blank);
  const save = useMutation({ mutationFn: async () => editing
      ? api.put(`/credit-control-rules/${editing.id}`, form)
      : api.post("/credit-control-rules", form),
    onSuccess: () => { setOpen(false); setEditing(null); void qc.invalidateQueries({ queryKey: ["credit-control-rules"] }); },
    onError: e => setError(extractErrorMessage(e)) });
  const customerOptions = useMemo(() => (customers.data ?? []).map(c => ({ value: c.id, label: nameOf(c), hint: c.customerNumber })), [customers.data]);
  const companyOptions = useMemo(() => [{ value: "", label: "Όλες οι ασφαλιστικές" }, ...(companies.data ?? []).map(c => ({ value: c.id, label: c.name }))], [companies.data]);
  const beginCreate = () => { setError(null); setEditing(null); setForm(blank()); setOpen(true); };
  const beginEdit = (r: Rule) => { setError(null); setEditing(r); setForm({ customerId: r.customerId, insuranceCompanyId: r.insuranceCompanyId,
    policyType: r.policyType, currency: r.currency, maximumOutstanding: r.maximumOutstanding, maximumOverdueDays: r.maximumOverdueDays,
    maximumOpenPolicies: r.maximumOpenPolicies, effectiveFrom: r.effectiveFrom.slice(0, 10), effectiveTo: r.effectiveTo?.slice(0, 10) ?? null,
    isException: r.isException, isActive: r.isActive, notes: r.notes }); setOpen(true); };
  const patch = <K extends keyof RuleBody>(key: K, value: RuleBody[K]) => setForm(old => ({ ...old, [key]: value }));
  return <>
    <Card variant="outlined" sx={{ mt: 3, overflow: "hidden" }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={1} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Box><Typography variant="h6" fontWeight={800}>Πιστωτικά όρια πελατών</Typography><Typography variant="body2" color="text.secondary">Έλεγχος ανοικτών ασφαλίστρων πριν από νέα καταχώρηση ή αύξηση έκθεσης.</Typography></Box>
        <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={beginCreate}>Νέος κανόνας</Button>
      </Stack>
      <Alert severity="info" sx={{ m: 1.5 }}>Η έκθεση υπολογίζεται από μικτά ασφάλιστρα προς είσπραξη. Δεν προσμετρώνται πιθανά, ακυρωμένα ή απευθείας πληρωμένα συμβόλαια. Οι εισπράξεις και τα συνδεδεμένα πιστωτικά μειώνουν το υπόλοιπο.</Alert>
      {rules.isLoading ? <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress /></Box> : rules.isError ? <Alert severity="error" sx={{ m: 2 }}>{extractErrorMessage(rules.error)}</Alert> :
        <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Πελάτης</TableCell><TableCell>Ασφαλιστική / κλάδος</TableCell><TableCell>Νόμισμα</TableCell><TableCell>Όριο υπολοίπου</TableCell><TableCell>Ημέρες / ανοικτά</TableCell><TableCell>Ισχύς</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead>
          <TableBody>{(rules.data ?? []).map(r => <TableRow key={r.id} hover><TableCell sx={{ fontWeight: 700 }}>{r.customerName}</TableCell><TableCell>{companies.data?.find(c => c.id === r.insuranceCompanyId)?.name ?? "Όλες"} · {policyTypes.find(t => t.value === r.policyType)?.label ?? "Όλοι οι κλάδοι"}</TableCell><TableCell>{r.currency ?? "Όλα"}</TableCell><TableCell>{r.maximumOutstanding == null ? "—" : money(r.maximumOutstanding, r.currency ?? "EUR")}</TableCell><TableCell>{r.maximumOverdueDays == null ? "—" : `${r.maximumOverdueDays} ημ.`} · {r.maximumOpenPolicies == null ? "—" : `${r.maximumOpenPolicies} συμβ.`}</TableCell><TableCell>{r.effectiveFrom.slice(0, 10)} – {r.effectiveTo?.slice(0, 10) ?? "χωρίς λήξη"}</TableCell><TableCell><Chip size="small" color={r.isActive ? r.isException ? "warning" : "success" : "default"} label={!r.isActive ? "Ανενεργός" : r.isException ? "Εξαίρεση" : "Ενεργός"} /></TableCell><TableCell align="right"><Tooltip title="Επεξεργασία"><IconButton size="small" onClick={() => beginEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" onClick={() => { if (confirm("Να διαγραφεί ο κανόνας;")) remove.mutate(r.id); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>)}
          {(rules.data ?? []).length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>Δεν έχουν καταχωρηθεί πιστωτικά όρια.</TableCell></TableRow>}</TableBody></Table></Box>}
    </Card>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editing ? "Επεξεργασία πιστωτικού κανόνα" : "Νέος πιστωτικός κανόνας"}</DialogTitle><DialogContent>
      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack spacing={2} mt={1}>
        <SearchableSelect label="Πελάτης" value={form.customerId} onChange={v => patch("customerId", v)} options={customerOptions} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><SearchableSelect label="Ασφαλιστική εταιρεία (προαιρετικά)" value={form.insuranceCompanyId ?? ""} onChange={v => patch("insuranceCompanyId", v || null)} options={companyOptions} /><SearchableTextField select label="Κλάδος (προαιρετικά)" fullWidth value={form.policyType ?? ""} onChange={e => patch("policyType", (e.target.value || null) as PolicyType | null)}><MenuItem value="">Όλοι οι κλάδοι</MenuItem>{policyTypes.map(x => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</SearchableTextField><TextField label="Νόμισμα (προαιρετικά)" value={form.currency ?? ""} onChange={e => patch("currency", e.target.value.toUpperCase() || null)} inputProps={{ maxLength: 3 }} sx={{ minWidth: 130 }} /></Stack>
        <Typography variant="subtitle2" fontWeight={800}>Μέγιστα επιτρεπόμενα</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField type="number" label="Ανοικτό υπόλοιπο" value={form.maximumOutstanding ?? ""} onChange={e => patch("maximumOutstanding", e.target.value === "" ? null : Number(e.target.value))} inputProps={{ min: 0, step: "0.01" }} fullWidth /><TextField type="number" label="Ημέρες καθυστέρησης" value={form.maximumOverdueDays ?? ""} onChange={e => patch("maximumOverdueDays", e.target.value === "" ? null : Number(e.target.value))} inputProps={{ min: 0 }} fullWidth /><TextField type="number" label="Ανοικτά συμβόλαια" value={form.maximumOpenPolicies ?? ""} onChange={e => patch("maximumOpenPolicies", e.target.value === "" ? null : Number(e.target.value))} inputProps={{ min: 0 }} fullWidth /></Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField type="date" label="Ισχύει από" InputLabelProps={{ shrink: true }} value={form.effectiveFrom} onChange={e => patch("effectiveFrom", e.target.value)} fullWidth /><TextField type="date" label="Ισχύει έως" InputLabelProps={{ shrink: true }} value={form.effectiveTo ?? ""} onChange={e => patch("effectiveTo", e.target.value || null)} fullWidth /></Stack>
        <Button variant={form.isException ? "contained" : "outlined"} color="warning" onClick={() => patch("isException", !form.isException)}>Εξαίρεση με έγκριση: {form.isException ? "Ναι · επιτρέπεται η έκθεση" : "Όχι · εφαρμογή ορίων"}</Button>
        <TextField multiline minRows={2} label="Αιτιολογία / σημειώσεις" value={form.notes ?? ""} onChange={e => patch("notes", e.target.value || null)} fullWidth />
      </Stack>
    </DialogContent><DialogActions><Button onClick={() => setOpen(false)} color="error">Κλείσιμο</Button><Button variant="contained" disabled={save.isPending || !form.customerId || (!form.isException && form.maximumOutstanding == null && form.maximumOverdueDays == null && form.maximumOpenPolicies == null)} onClick={() => save.mutate()}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}</Button></DialogActions></Dialog>
  </>;
}
