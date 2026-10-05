import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface VehiclePolicyRow {
  id: string;
  customerId: string;
  customerDisplay?: string | null;
  policyNumber: string;
  insuranceCompanyName: string;
  policyType: string;
  status: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  vehicleRegistrationPlate?: string | null;
}

interface VehiclePolicyDetail {
  id: string;
  policyNumber: string;
  policyType: string;
  status: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  insuranceCompanyName: string;
  customerDisplay: string;
  vehicleRegistrationPlate?: string | null;
  driverVatNumber?: string | null;
  reasonForCirculation?: string | null;
  vehicleUseCategory?: string | null;
  carrierUseCode?: string | null;
  characteristic?: string | null;
  deductible?: number | null;
  position?: string | null;
  specsJson?: string | null;
  netPremium?: number | null;
  vatAmount?: number | null;
  stampDutyAmount?: number | null;
  insuranceContributionAmount?: number | null;
  otherChargesAmount?: number | null;
  totalReceived?: number;
  outstanding?: number;
  totalCommissions?: number;
  claimCount?: number;
  paymentCollectionMethod?: string | null;
  paidDirectlyToCarrier?: boolean;
  paidOnCredit?: boolean;
  paymentPromisedOn?: string | null;
  creditReason?: string | null;
  policyNotes?: string | null;
}

function parseSpecs(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    const result: Record<string, unknown> = {};
    const walk = (item: unknown, prefix = "") => {
      if (!item || typeof item !== "object" || Array.isArray(item)) { if (prefix) result[prefix] = item; return; }
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) walk(child, prefix ? `${prefix}.${key}` : key);
    };
    walk(parsed);
    return result;
  } catch { return {}; }
}

function money(value?: number | null, currency = "EUR") {
  return value == null ? "—" : `${value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function vehicleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    Active: "Ενεργό",
    Inactive: "Ανενεργό",
    Cancelled: "Ακυρωμένο",
    Expired: "Ληγμένο",
    Pending: "Σε εκκρεμότητα",
    Prospect: "Πιθανό συμβόλαιο"
  };
  return labels[status] ?? status;
}

export function VehicleDetailDialog({ open, plate, policyIds, onClose, zIndex, initialEditing = false }: { open: boolean; plate: string; policyIds: string[]; onClose: () => void; zIndex?: number; initialEditing?: boolean }) {
  const q = useQuery({
    queryKey: ["vehicle-detail", plate, policyIds.join(",")],
    enabled: open && policyIds.length > 0,
    queryFn: async () => {
      const [details, claims] = await Promise.all([
        Promise.all(policyIds.map(id => api.get<VehiclePolicyDetail>(`/policies/${id}/detail`).then(response => response.data))),
        api.get<any[]>("/claims").then(response => response.data)
      ]);
      const claimRows = claims.filter(claim => policyIds.includes(String(claim.policyId)));
      return { details, claims: claimRows };
    }
  });
  const details = q.data?.details ?? [];
  const first = details[0];
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [associationPolicyId, setAssociationPolicyId] = useState("");
  const [form, setForm] = useState({ plate: "", use: "", driverVat: "", reason: "", characteristic: "", deductible: "", position: "", specsJson: "", notes: "" });
  useEffect(() => {
    if (open) setEditing(initialEditing);
  }, [open, initialEditing]);
  useEffect(() => {
    const d = q.data?.details?.[0];
    if (!d) return;
    setForm({
      plate: d.vehicleRegistrationPlate ?? plate,
      use: d.vehicleUseCategory ?? d.carrierUseCode ?? "",
      driverVat: d.driverVatNumber ?? "",
      reason: d.reasonForCirculation ?? "",
      characteristic: d.characteristic ?? "",
      deductible: d.deductible == null ? "" : String(d.deductible),
      position: d.position ?? "",
      specsJson: d.specsJson ?? "",
      notes: d.policyNotes ?? ""
    });
  }, [q.data, plate]);
  const invalidateVehicle = () => {
    void qc.invalidateQueries({ queryKey: ["vehicle-detail", plate, policyIds.join(",")] });
    void qc.invalidateQueries({ queryKey: ["customer-vehicles-all"] });
    void qc.invalidateQueries({ queryKey: ["customer-vehicles"] });
  };
  const updateVehicle = useMutation({
    mutationFn: async () => api.patch(`/policies/${first?.id}/vehicle`, {
      vehicleRegistrationPlate: form.plate.trim() || null,
      vehicleUseCategory: form.use.trim() || null,
      driverVatNumber: form.driverVat.trim() || null,
      reasonForCirculation: form.reason.trim() || null,
      characteristic: form.characteristic.trim() || null,
      deductible: form.deductible.trim() ? Number(form.deductible) : null,
      position: form.position.trim() || null,
      specsJson: form.specsJson.trim() || null,
      notes: form.notes.trim() || null,
      replaceDetails: true,
      clearVehicleRegistrationPlate: !form.plate.trim()
    }),
    onSuccess: () => { setEditing(false); invalidateVehicle(); }
  });
  const removeVehicle = useMutation({
    mutationFn: async (policyId: string) => api.patch(`/policies/${policyId}/vehicle`, { clearVehicleRegistrationPlate: true }),
    onSuccess: invalidateVehicle
  });
  const removeAllVehicle = useMutation({
    mutationFn: async () => Promise.all(policyIds.map(id => api.patch(`/policies/${id}/vehicle`, { clearVehicleRegistrationPlate: true }))),
    onSuccess: () => { invalidateVehicle(); onClose(); }
  });
  const availableQ = useQuery({
    queryKey: ["vehicle-association-policies", plate],
    enabled: open,
    queryFn: async () => (await api.get<VehiclePolicyRow[]>("/policies", { params: { type: "Auto" } })).data
  });
  const associate = useMutation({
    mutationFn: async (policyId: string) => api.patch(`/policies/${policyId}/vehicle`, { vehicleRegistrationPlate: plate }),
    onSuccess: () => { setAssociationPolicyId(""); invalidateVehicle(); }
  });
  const specs = details.reduce<Record<string, unknown>>((all, detail) => ({ ...all, ...parseSpecs(detail.specsJson) }), {});
  const specEntries = Object.entries(specs).filter(([, value]) => value !== null && value !== undefined && value !== "");
  const specLabel: Record<string, string> = {
    taxableHorsepower: "Φορολογήσιμοι ίπποι", taxableHp: "Φορολογήσιμοι ίπποι", taxable_horsepower: "Φορολογήσιμοι ίπποι", horsepower: "Ιπποδύναμη (HP)",
    engineCapacity: "Κυβισμός", vin: "VIN / αριθμός πλαισίου", make: "Μάρκα", model: "Μοντέλο", year: "Έτος κατασκευής",
    color: "Χρώμα", seats: "Θέσεις", usage: "Χρήση"
  };
  const total = (key: keyof VehiclePolicyDetail) => details.reduce((sum, detail) => sum + (Number(detail[key]) || 0), 0);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" sx={zIndex ? { zIndex } : undefined}>
    <DialogTitle sx={{ px: 1.5, py: 1.25 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><DirectionsCarIcon color="primary" /> <Box><Typography variant="h6" fontWeight={800}>Καρτέλα οχήματος · {plate || "Χωρίς πινακίδα"}</Typography><Typography variant="caption" color="text.secondary">Συγκεντρωμένα στοιχεία από όλα τα σχετικά συμβόλαια</Typography></Box></Stack><Button size="small" variant="contained" color={editing ? "error" : "success"} sx={{ color: "#fff", fontWeight: 800 }} startIcon={<EditIcon />} onClick={() => setEditing(value => !value)} disabled={!first}>{editing ? "Ακύρωση επεξεργασίας" : "Επεξεργασία"}</Button></Stack></DialogTitle>
    <DialogContent dividers sx={{ p: 1.25 }}>
      {q.isLoading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}
      {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {!q.isLoading && !q.isError && first && <Stack spacing={1}>
        {editing && <Card variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Επεξεργασία στοιχείων οχήματος</Typography>
          <Stack spacing={1}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
              <TextField label="Πινακίδα" value={form.plate} onChange={e => setForm(current => ({ ...current, plate: e.target.value }))} />
              <TextField label="Χρήση / κατηγορία" value={form.use} onChange={e => setForm(current => ({ ...current, use: e.target.value }))} />
              <TextField label="ΑΦΜ οδηγού" value={form.driverVat} onChange={e => setForm(current => ({ ...current, driverVat: e.target.value }))} />
              <TextField label="Λόγος κυκλοφορίας" value={form.reason} onChange={e => setForm(current => ({ ...current, reason: e.target.value }))} />
              <TextField label="Χαρακτηριστικό" value={form.characteristic} onChange={e => setForm(current => ({ ...current, characteristic: e.target.value }))} />
              <TextField label="Απαλλαγή" type="number" value={form.deductible} onChange={e => setForm(current => ({ ...current, deductible: e.target.value }))} />
              <TextField label="Θέση / spot" value={form.position} onChange={e => setForm(current => ({ ...current, position: e.target.value }))} />
            </Box>
            <TextField label="Τεχνικά στοιχεία (JSON)" value={form.specsJson} onChange={e => setForm(current => ({ ...current, specsJson: e.target.value }))} multiline minRows={3} helperText={'Προαιρετικά, π.χ. {"make":"Toyota","model":"Yaris"}'} />
            <TextField label="Σημειώσεις οχήματος" value={form.notes} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))} multiline minRows={2} />
            {updateVehicle.isError && <Alert severity="error">{extractErrorMessage(updateVehicle.error)}</Alert>}
            <Button variant="contained" color="success" sx={{ color: "#fff", fontWeight: 800 }} startIcon={<EditIcon />} onClick={() => updateVehicle.mutate()} disabled={updateVehicle.isPending}>{updateVehicle.isPending ? "Αποθήκευση…" : "Αποθήκευση στοιχείων"}</Button>
          </Stack>
        </Card>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 0.75 }}>
          {[["Ιδιοκτήτης / πελάτης", first.customerDisplay], ["Πινακίδα", (first.vehicleRegistrationPlate ?? plate) || "—"], ["Χρήση", first.vehicleUseCategory ?? first.carrierUseCode ?? "—"], ["Λόγος κυκλοφορίας", first.reasonForCirculation ?? "—"], ["ΑΦΜ οδηγού", first.driverVatNumber ?? "—"], ["Χαρακτηριστικό", first.characteristic ?? "—"], ["Απαλλαγή", money(first.deductible, first.currency)], ["Θέση / spot", first.position ?? "—"], ["Τρόπος είσπραξης", first.paymentCollectionMethod ?? "—"], ["Πληρωμή απευθείας στην ασφαλιστική", first.paidDirectlyToCarrier ? "Ναι" : "Όχι"]].map(([label, value]) => <Box key={label} sx={{ p: 0.9, bgcolor: "background.default", borderRadius: 1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={700} noWrap>{value}</Typography></Box>)}
        </Box>
        <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>Τεχνικά στοιχεία οχήματος</Typography>{specEntries.length === 0 ? <Typography color="text.secondary">Δεν έχουν σταλεί τεχνικά στοιχεία από την ασφαλιστική. Μπορούν να αποθηκευτούν στο πεδίο παραμετρικών του συμβολαίου.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 0.75 }}>{specEntries.map(([key, value]) => <Box key={key}><Typography variant="caption" color="text.secondary">{specLabel[key] ?? specLabel[key.split(".").pop() ?? ""] ?? key}</Typography><Typography fontWeight={600} noWrap>{typeof value === "object" ? JSON.stringify(value) : String(value)}</Typography></Box>)}</Box>}</Card>
        <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>Κόστος, φόροι και εισπράξεις</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 0.75 }}>{[["Μεικτά", total("premium")], ["Καθαρά", total("netPremium")], ["Φόρος / ΦΠΑ", total("vatAmount")], ["Χαρτόσημο", total("stampDutyAmount")], ["Ασφαλιστική εισφορά", total("insuranceContributionAmount")], ["Λοιπές επιβαρύνσεις", total("otherChargesAmount")], ["Εισπράξεις", total("totalReceived")], ["Υπόλοιπο", total("outstanding")], ["Προμήθειες", total("totalCommissions")]].map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={800}>{money(Number(value), first.currency)}</Typography></Box>)}</Box><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>Οι φόροι και οι προμήθειες προέρχονται από τα επιμέρους συμβόλαια· δεν υπολογίζονται ξανά στην καρτέλα.</Typography></Card>
        <Card variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>Σύνδεση συμβολαίου με το όχημα</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField select fullWidth label="Σύνδεση άλλου συμβολαίου" value={associationPolicyId} onChange={e => setAssociationPolicyId(e.target.value)}>
              <MenuItem value="">Επιλέξτε συμβόλαιο…</MenuItem>
              {(availableQ.data ?? []).filter(policy => !policyIds.includes(policy.id)).map(policy => <MenuItem key={policy.id} value={policy.id}>{policy.policyNumber} · {policy.customerDisplay ?? "Πελάτης"} · {policy.insuranceCompanyName}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={() => associationPolicyId && associate.mutate(associationPolicyId)} disabled={!associationPolicyId || associate.isPending}>{associate.isPending ? "Σύνδεση…" : "Σύνδεση"}</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Η σύνδεση ενημερώνει μόνο την πινακίδα του επιλεγμένου συμβολαίου. Δεν αλλάζει οικονομικά, καλύψεις ή ζημιές.</Typography>
          {associate.isError && <Alert severity="error" sx={{ mt: 1 }}>{extractErrorMessage(associate.error)}</Alert>}
        </Card>
        <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>Ασφαλιστήρια</Typography><Table size="small"><TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ισχύς</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Μεικτά</TableCell><TableCell /></TableRow></TableHead><TableBody>{details.map(detail => <TableRow key={detail.id}><TableCell>{detail.policyNumber}</TableCell><TableCell>{detail.insuranceCompanyName}</TableCell><TableCell>{detail.startDate} → {detail.endDate}</TableCell><TableCell><Chip size="small" label={vehicleStatusLabel(detail.status)} /></TableCell><TableCell align="right">{money(detail.premium, detail.currency)}</TableCell><TableCell align="right"><Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { if (window.confirm("Να αφαιρεθεί το όχημα από αυτό το συμβόλαιο; Το συμβόλαιο και τα οικονομικά του δεν διαγράφονται.")) removeVehicle.mutate(detail.id); }}>Αφαίρεση</Button></TableCell></TableRow>)}</TableBody></Table></Card>
        <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>Ζημιές</Typography>{(q.data?.claims ?? []).length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες ζημιές για το όχημα.</Typography> : <Table size="small"><TableHead><TableRow><TableCell>Αρ. ζημιάς</TableCell><TableCell>Ημερομηνία</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Διεκδίκηση</TableCell><TableCell align="right">Έγκριση</TableCell></TableRow></TableHead><TableBody>{(q.data?.claims ?? []).map(claim => <TableRow key={claim.id}><TableCell>{claim.claimNumber ?? "—"}</TableCell><TableCell>{claim.incidentDate ?? "—"}</TableCell><TableCell><Chip size="small" label={claim.status ?? "—"} /></TableCell><TableCell align="right">{money(claim.claimedAmount, first.currency)}</TableCell><TableCell align="right">{money(claim.approvedAmount, first.currency)}</TableCell></TableRow>)}</TableBody></Table>}</Card>
        {details.some(detail => detail.paidOnCredit || detail.paymentPromisedOn || detail.creditReason || detail.policyNotes) && <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800}>Πληρωμές & σημειώσεις</Typography>{details.map(detail => <Box key={detail.id} sx={{ mt: 0.75 }}><Typography fontWeight={700}>{detail.policyNumber}</Typography><Typography variant="body2">{detail.paidOnCredit ? "Πληρωμή επί πιστώσει" : ""}{detail.paymentPromisedOn ? ` · Υπόσχεση πληρωμής: ${detail.paymentPromisedOn}` : ""}{detail.creditReason ? ` · ${detail.creditReason}` : ""}</Typography>{detail.policyNotes && <Typography variant="body2" color="text.secondary">{detail.policyNotes}</Typography>}</Box>)}</Card>}
      </Stack>}
    </DialogContent>
    <DialogActions sx={{ justifyContent: "space-between" }}>
      <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { if (window.confirm("Να διαγραφεί η συσχέτιση του οχήματος από όλα τα συμβόλαια; Τα συμβόλαια, οι ζημιές και τα οικονομικά τους δεν διαγράφονται.")) removeAllVehicle.mutate(); }} disabled={!first || removeAllVehicle.isPending}>{removeAllVehicle.isPending ? "Διαγραφή…" : "Διαγραφή οχήματος"}</Button>
      <Button color="error" variant="contained" sx={{ color: "#fff", fontWeight: 800 }} onClick={onClose}>Κλείσιμο</Button>
    </DialogActions>
  </Dialog>;
}

function LegacyCustomerVehiclesPage() {
  const [search, setSearch] = useState("");
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["customer-vehicles-all"],
    queryFn: async () => (await api.get<VehiclePolicyRow[]>("/policies", { params: { type: "Auto" } })).data
  });
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    if (!term) return q.data ?? [];
    return (q.data ?? []).filter(row => [row.vehicleRegistrationPlate, row.customerDisplay, row.policyNumber, row.insuranceCompanyName].some(value => String(value ?? "").toLocaleLowerCase("el-GR").includes(term)));
  }, [q.data, search]);
  const uniquePlates = new Set(rows.map(row => row.vehicleRegistrationPlate).filter(Boolean)).size;
  const expiring = rows.filter(row => { const days = (new Date(row.endDate).getTime() - Date.now()) / 86400000; return days >= 0 && days <= 30; }).length;
  const exportCsv = () => {
    const header = ["Πινακίδα", "Πελάτης", "Αριθμός συμβολαίου", "Ασφαλιστική", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Κατάσταση"];
    const body = rows.map(row => [row.vehicleRegistrationPlate ?? "", row.customerDisplay ?? "", row.policyNumber, row.insuranceCompanyName, row.startDate, row.endDate, String(row.premium ?? ""), row.status]);
    const csv = [header, ...body].map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "οχηματα-πελατων.csv"; a.click(); URL.revokeObjectURL(url);
  };
  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  return <Stack spacing={2.5}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="h4" fontWeight={800}>Οχήματα πελατών</Typography><Typography color="text.secondary">Όλα τα οχήματα όπως προκύπτουν από τα ενεργά και ιστορικά συμβόλαια αυτοκινήτου.</Typography></Box>
      <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportCsv}>Εξαγωγή CSV</Button>
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Συμβόλαια αυτοκινήτου</Typography><Typography variant="h5" fontWeight={800}>{rows.length}</Typography></Card>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Μοναδικές πινακίδες</Typography><Typography variant="h5" fontWeight={800}>{uniquePlates}</Typography></Card>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Λήγουν σε 30 ημέρες</Typography><Typography variant="h5" fontWeight={800} color={expiring ? "warning.main" : "text.primary"}>{expiring}</Typography></Card>
    </Stack>
    <TextField value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση πινακίδας, πελάτη, συμβολαίου ή ασφαλιστικής" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
    {rows.length === 0 ? <Alert severity="info"><DirectionsCarIcon sx={{ verticalAlign: "middle", mr: 1 }} />Δεν βρέθηκαν οχήματα με τα συγκεκριμένα κριτήρια.</Alert> : <Card variant="outlined" sx={{ overflowX: "auto" }}><Table size="small">
      <TableHead><TableRow><TableCell>Πινακίδα</TableCell><TableCell>Πελάτης</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id} hover>
        <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.vehicleRegistrationPlate ?? "—"}</TableCell>
        <TableCell><Button component={RouterLink} to={`/app/customers/${row.customerId}`} size="small">{row.customerDisplay ?? "Πελάτης"}</Button></TableCell>
        <TableCell><Button component={RouterLink} to={`/app/policies?focus=${row.id}`} size="small">{row.policyNumber}</Button></TableCell>
        <TableCell>{row.insuranceCompanyName}</TableCell><TableCell>{row.startDate}</TableCell><TableCell>{row.endDate}</TableCell>
        <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell><TableCell><Chip size="small" label={row.status} /></TableCell><TableCell><Button size="small" onClick={() => setSelectedPlate(row.vehicleRegistrationPlate ?? "")}>Καρτέλα οχήματος</Button></TableCell>
      </TableRow>)}</TableBody>
    </Table></Card>}
    <VehicleDetailDialog open={selectedPlate !== null} plate={selectedPlate ?? ""} policyIds={rows.filter(row => (row.vehicleRegistrationPlate ?? "") === (selectedPlate ?? "")).map(row => row.id)} onClose={() => setSelectedPlate(null)} />
  </Stack>;
}

void LegacyCustomerVehiclesPage;

export function CustomerVehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [renewalFilter, setRenewalFilter] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState<{ plate: string; edit: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statsOpen, setStatsOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteText, setDeleteText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const q = useQuery({
    queryKey: ["customer-vehicles-all"],
    queryFn: async () => (await api.get<VehiclePolicyRow[]>("/policies", { params: { type: "Auto" } })).data
  });

  const sourceRows = q.data ?? [];
  const companies = useMemo(() => [...new Set(sourceRows.map(row => row.insuranceCompanyName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "el")), [sourceRows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    const now = Date.now();
    return sourceRows.filter(row => {
      const haystack = [row.vehicleRegistrationPlate, row.customerDisplay, row.policyNumber, row.insuranceCompanyName, row.policyType].join(" ").toLocaleLowerCase("el-GR");
      if (term && !haystack.includes(term)) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (companyFilter && row.insuranceCompanyName !== companyFilter) return false;
      if (renewalFilter !== "all") {
        const days = (new Date(row.endDate).getTime() - now) / 86400000;
        if (renewalFilter === "30" && !(days >= 0 && days <= 30)) return false;
        if (renewalFilter === "90" && !(days >= 0 && days <= 90)) return false;
        if (renewalFilter === "expired" && days >= 0) return false;
      }
      return true;
    });
  }, [sourceRows, search, statusFilter, companyFilter, renewalFilter]);
  useEffect(() => { setPage(0); }, [search, statusFilter, companyFilter, renewalFilter, rowsPerPage]);
  const pageRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const uniquePlates = new Set(filteredRows.map(row => row.vehicleRegistrationPlate).filter(Boolean)).size;
  const expiring = filteredRows.filter(row => {
    const days = (new Date(row.endDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const totalPremium = filteredRows.reduce((sum, row) => sum + (Number(row.premium) || 0), 0);
  const allPageSelected = pageRows.length > 0 && pageRows.every(row => selectedIds.has(row.id));
  const selectedCount = selectedIds.size;
  const companyStats = useMemo(() => {
    const map = new Map<string, { contracts: number; plates: Set<string> }>();
    for (const row of filteredRows) {
      const item = map.get(row.insuranceCompanyName) ?? { contracts: 0, plates: new Set<string>() };
      item.contracts += 1;
      if (row.vehicleRegistrationPlate) item.plates.add(row.vehicleRegistrationPlate);
      map.set(row.insuranceCompanyName, item);
    }
    return [...map.entries()].sort((a, b) => b[1].contracts - a[1].contracts);
  }, [filteredRows]);
  const clearVehicle = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map(id => api.patch(`/policies/${id}/vehicle`, { clearVehicleRegistrationPlate: true }))),
    onSuccess: () => {
      setSelectedIds(new Set());
      setDeleteOpen(false);
      setDeleteText("");
      setDeleteIds([]);
      void qc.invalidateQueries({ queryKey: ["customer-vehicles-all"] });
      void qc.invalidateQueries({ queryKey: ["customer-vehicles"] });
    }
  });
  const requestDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteText(""); setDeleteOpen(true); };
  const exportCsv = (dataset = filteredRows) => {
    const header = ["Πινακίδα", "Πελάτης", "Αριθμός συμβολαίου", "Ασφαλιστική", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Κατάσταση"];
    const body = dataset.map(row => [row.vehicleRegistrationPlate ?? "", row.customerDisplay ?? "", row.policyNumber, row.insuranceCompanyName, row.startDate, row.endDate, String(row.premium ?? ""), row.status]);
    const csv = [header, ...body].map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "οχήματα-πελατών.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  const resetFilters = () => { setSearch(""); setStatusFilter(""); setCompanyFilter(""); setRenewalFilter("all"); setSelectedIds(new Set()); };
  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1} alignItems={{ md: "center" }}>
      <Box><Typography variant="h4" fontWeight={800}>Οχήματα πελατών</Typography><Typography color="text.secondary">Κεντρική αναζήτηση, φίλτρα, στατιστικά και ενέργειες για όλα τα οχήματα των συμβολαίων.</Typography></Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<DirectionsCarIcon />} onClick={() => setStatsOpen(true)}>Στατιστικά</Button>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportCsv()}>Εξαγωγή CSV</Button>
        <Button size="small" variant="outlined" onClick={() => window.print()}>Εκτύπωση</Button>
        {selectedCount > 0 && <Button size="small" color="error" variant="contained" startIcon={<DeleteOutlineIcon />} onClick={() => requestDelete([...selectedIds])}>Διαγραφή ({selectedCount})</Button>}
      </Stack>
    </Stack>
    <Card variant="outlined" sx={{ p: 1 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
        <TextField size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση πινακίδας, πελάτη, συμβολαίου ή ασφαλιστικής" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: 1, minWidth: { md: 260 } }} />
        <TextField select size="small" label="Κατάσταση" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">Όλες</MenuItem>{[...new Set(sourceRows.map(row => row.status))].filter(Boolean).map(value => <MenuItem key={value} value={value}>{vehicleStatusLabel(value)}</MenuItem>)}</TextField>
        <TextField select size="small" label="Ασφαλιστική" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="">Όλες</MenuItem>{companies.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select size="small" label="Λήξη" value={renewalFilter} onChange={e => setRenewalFilter(e.target.value)} sx={{ minWidth: 145 }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="30">Σε 30 ημέρες</MenuItem><MenuItem value="90">Σε 90 ημέρες</MenuItem><MenuItem value="expired">Ληγμένα</MenuItem></TextField>
        <Button size="small" color="error" variant="contained" onClick={resetFilters}>Καθαρισμός</Button>
      </Stack>
    </Card>
    {filteredRows.length === 0 ? <Alert severity="info"><DirectionsCarIcon sx={{ verticalAlign: "middle", mr: 1 }} />Δεν βρέθηκαν οχήματα με τα συγκεκριμένα φίλτρα.</Alert> : <Card variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow><TableCell padding="checkbox"><Checkbox size="small" checked={allPageSelected} onChange={event => { const checked = event.target.checked; setSelectedIds(previous => { const next = new Set(previous); pageRows.forEach(row => checked ? next.add(row.id) : next.delete(row.id)); return next; }); }} /></TableCell><TableCell>Πινακίδα</TableCell><TableCell>Πελάτης</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead>
        <TableBody>{pageRows.map(row => <TableRow key={row.id} hover onClick={() => setSelectedVehicle({ plate: row.vehicleRegistrationPlate ?? "", edit: false })} sx={{ cursor: "pointer" }}>
          <TableCell padding="checkbox"><Checkbox size="small" checked={selectedIds.has(row.id)} onClick={event => event.stopPropagation()} onChange={event => setSelectedIds(previous => { const next = new Set(previous); event.target.checked ? next.add(row.id) : next.delete(row.id); return next; })} /></TableCell>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.vehicleRegistrationPlate ?? "—"}</TableCell>
          <TableCell>
            <Tooltip title="Άνοιγμα καρτέλας πελάτη — δεν ανοίγει την καρτέλα οχήματος" arrow>
              <Button
                component={RouterLink}
                to={`/app/customers/${row.customerId}`}
                size="small"
                onClick={event => event.stopPropagation()}
                sx={{
                  fontWeight: 700,
                  borderRadius: 1,
                  transition: "background-color .15s ease, color .15s ease, box-shadow .15s ease",
                  "&:hover": { bgcolor: "success.main", color: "#fff", boxShadow: 2 },
                }}
              >
                {row.customerDisplay ?? "Πελάτης"}
              </Button>
            </Tooltip>
          </TableCell>
          <TableCell>
            <Tooltip title="Άνοιγμα καρτέλας συμβολαίου — δεν ανοίγει την καρτέλα οχήματος" arrow>
              <Button
                component={RouterLink}
                to={`/app/policies?focus=${row.id}`}
                size="small"
                onClick={event => event.stopPropagation()}
                sx={{
                  fontWeight: 700,
                  borderRadius: 1,
                  transition: "background-color .15s ease, color .15s ease, box-shadow .15s ease",
                  "&:hover": { bgcolor: "success.main", color: "#fff", boxShadow: 2 },
                }}
              >
                {row.policyNumber}
              </Button>
            </Tooltip>
          </TableCell>
          <TableCell>{row.insuranceCompanyName}</TableCell><TableCell>{row.startDate}</TableCell><TableCell>{row.endDate}</TableCell>
          <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell><TableCell><Chip size="small" label={vehicleStatusLabel(row.status)} /></TableCell>
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.25}><Tooltip title="Προεπισκόπηση καρτέλας οχήματος" arrow><IconButton size="small" color="info" onClick={event => { event.stopPropagation(); setSelectedVehicle({ plate: row.vehicleRegistrationPlate ?? "", edit: false }); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Επεξεργασία οχήματος" arrow><IconButton size="small" color="success" onClick={event => { event.stopPropagation(); setSelectedVehicle({ plate: row.vehicleRegistrationPlate ?? "", edit: true }); }}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Αφαίρεση οχήματος από το συμβόλαιο" arrow><IconButton size="small" color="error" onClick={event => { event.stopPropagation(); requestDelete([row.id]); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></Stack></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, next) => setPage(next)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
    </Card>}
    <VehicleDetailDialog open={selectedVehicle !== null} plate={selectedVehicle?.plate ?? ""} initialEditing={selectedVehicle?.edit ?? false} policyIds={sourceRows.filter(row => (row.vehicleRegistrationPlate ?? "") === (selectedVehicle?.plate ?? "")).map(row => row.id)} onClose={() => setSelectedVehicle(null)} />
    <Dialog open={statsOpen} onClose={() => setStatsOpen(false)} fullWidth maxWidth="md"><DialogTitle>Στατιστικά οχημάτων</DialogTitle><DialogContent dividers><Stack spacing={1.5}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1 }}>{[["Συμβόλαια", filteredRows.length], ["Πινακίδες", uniquePlates], ["Λήξεις 30 ημερών", expiring], ["Ασφάλιστρα", money(totalPremium)]].map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ p: 1.25 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value}</Typography></Card>)}</Box><Typography variant="subtitle2" fontWeight={800}>Ανά ασφαλιστική</Typography><Table size="small"><TableHead><TableRow><TableCell>Ασφαλιστική</TableCell><TableCell align="right">Συμβόλαια</TableCell><TableCell align="right">Πινακίδες</TableCell></TableRow></TableHead><TableBody>{companyStats.map(([name, value]) => <TableRow key={name}><TableCell>{name}</TableCell><TableCell align="right">{value.contracts}</TableCell><TableCell align="right">{value.plates.size}</TableCell></TableRow>)}</TableBody></Table></Stack></DialogContent><DialogActions><Button startIcon={<DownloadIcon />} onClick={() => exportCsv()}>Εξαγωγή CSV</Button><Button onClick={() => window.print()}>Εκτύπωση</Button><Button variant="contained" onClick={() => setStatsOpen(false)}>Κλείσιμο</Button></DialogActions></Dialog>
    <Dialog open={deleteOpen} onClose={() => !clearVehicle.isPending && setDeleteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Επιβεβαίωση αφαίρεσης</DialogTitle><DialogContent><Typography variant="body2" sx={{ mb: 1 }}>Θα αφαιρεθεί η σύνδεση οχήματος από {deleteIds.length} συμβόλαιο/α. Δεν διαγράφεται το συμβόλαιο. Πληκτρολόγησε <strong>ΔΙΑΓΡΑΦΗ</strong> για επιβεβαίωση.</Typography><TextField autoFocus fullWidth label="Πληκτρολόγησε ΔΙΑΓΡΑΦΗ" value={deleteText} onChange={event => setDeleteText(event.target.value)} /></DialogContent><DialogActions><Button color="inherit" onClick={() => setDeleteOpen(false)} disabled={clearVehicle.isPending}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => clearVehicle.mutate(deleteIds)} disabled={deleteText.trim().toUpperCase() !== "ΔΙΑΓΡΑΦΗ" || clearVehicle.isPending}>{clearVehicle.isPending ? "Αφαιρείται..." : "Αφαίρεση"}</Button></DialogActions></Dialog>
  </Stack>;
}
