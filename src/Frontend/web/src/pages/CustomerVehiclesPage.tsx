import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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

export function VehicleDetailDialog({ open, plate, policyIds, onClose }: { open: boolean; plate: string; policyIds: string[]; onClose: () => void }) {
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
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><DirectionsCarIcon color="primary" /> <Box><Typography variant="h6" fontWeight={800}>Καρτέλα οχήματος · {plate || "Χωρίς πινακίδα"}</Typography><Typography variant="caption" color="text.secondary">Συγκεντρωμένα στοιχεία από όλα τα σχετικά συμβόλαια</Typography></Box></Stack><Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setEditing(value => !value)} disabled={!first}>{editing ? "Κλείσιμο επεξεργασίας" : "Επεξεργασία"}</Button></Stack></DialogTitle>
    <DialogContent dividers>
      {q.isLoading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}
      {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {!q.isLoading && !q.isError && first && <Stack spacing={2.5}>
        {editing && <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Επεξεργασία στοιχείων οχήματος</Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
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
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => updateVehicle.mutate()} disabled={updateVehicle.isPending}>{updateVehicle.isPending ? "Αποθήκευση…" : "Αποθήκευση στοιχείων"}</Button>
          </Stack>
        </Card>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
          {[["Ιδιοκτήτης / πελάτης", first.customerDisplay], ["Χρήση", first.vehicleUseCategory ?? first.carrierUseCode ?? "—"], ["Λόγος κυκλοφορίας", first.reasonForCirculation ?? "—"], ["ΑΦΜ οδηγού", first.driverVatNumber ?? "—"], ["Χαρακτηριστικό", first.characteristic ?? "—"], ["Απαλλαγή", money(first.deductible, first.currency)], ["Θέση / spot", first.position ?? "—"], ["Τρόπος είσπραξης", first.paymentCollectionMethod ?? "—"]].map(([label, value]) => <Box key={label} sx={{ p: 1.25, bgcolor: "background.default", borderRadius: 1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={700}>{value}</Typography></Box>)}
        </Box>
        <Card variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Τεχνικά στοιχεία οχήματος</Typography>{specEntries.length === 0 ? <Typography color="text.secondary">Δεν έχουν σταλεί τεχνικά στοιχεία από την ασφαλιστική. Μπορούν να αποθηκευτούν στο πεδίο παραμετρικών του συμβολαίου.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>{specEntries.map(([key, value]) => <Box key={key}><Typography variant="caption" color="text.secondary">{specLabel[key] ?? specLabel[key.split(".").pop() ?? ""] ?? key}</Typography><Typography fontWeight={600}>{typeof value === "object" ? JSON.stringify(value) : String(value)}</Typography></Box>)}</Box>}</Card>
        <Card variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Κόστος, φόροι και εισπράξεις</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>{[["Μεικτά", total("premium")], ["Καθαρά", total("netPremium")], ["Φόρος / ΦΠΑ", total("vatAmount")], ["Χαρτόσημο", total("stampDutyAmount")], ["Ασφαλιστική εισφορά", total("insuranceContributionAmount")], ["Λοιπές επιβαρύνσεις", total("otherChargesAmount")], ["Εισπράξεις", total("totalReceived")], ["Υπόλοιπο", total("outstanding")], ["Προμήθειες", total("totalCommissions")]].map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={800}>{money(Number(value), first.currency)}</Typography></Box>)}</Box><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>Οι φόροι και οι προμήθειες προέρχονται από τα επιμέρους συμβόλαια· δεν υπολογίζονται ξανά στην καρτέλα.</Typography></Card>
        <Card variant="outlined" sx={{ p: 2 }}>
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
        <Card variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Ασφαλιστήρια</Typography><Table size="small"><TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ισχύς</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Μεικτά</TableCell><TableCell /></TableRow></TableHead><TableBody>{details.map(detail => <TableRow key={detail.id}><TableCell>{detail.policyNumber}</TableCell><TableCell>{detail.insuranceCompanyName}</TableCell><TableCell>{detail.startDate} → {detail.endDate}</TableCell><TableCell><Chip size="small" label={detail.status} /></TableCell><TableCell align="right">{money(detail.premium, detail.currency)}</TableCell><TableCell align="right"><Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { if (window.confirm("Να αφαιρεθεί το όχημα από αυτό το συμβόλαιο; Το συμβόλαιο και τα οικονομικά του δεν διαγράφονται.")) removeVehicle.mutate(detail.id); }}>Αφαίρεση</Button></TableCell></TableRow>)}</TableBody></Table></Card>
        <Card variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>Ζημιές</Typography>{(q.data?.claims ?? []).length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες ζημιές για το όχημα.</Typography> : <Table size="small"><TableHead><TableRow><TableCell>Αρ. ζημιάς</TableCell><TableCell>Ημερομηνία</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Διεκδίκηση</TableCell><TableCell align="right">Έγκριση</TableCell></TableRow></TableHead><TableBody>{(q.data?.claims ?? []).map(claim => <TableRow key={claim.id}><TableCell>{claim.claimNumber ?? "—"}</TableCell><TableCell>{claim.incidentDate ?? "—"}</TableCell><TableCell><Chip size="small" label={claim.status ?? "—"} /></TableCell><TableCell align="right">{money(claim.claimedAmount, first.currency)}</TableCell><TableCell align="right">{money(claim.approvedAmount, first.currency)}</TableCell></TableRow>)}</TableBody></Table>}</Card>
        {details.some(detail => detail.paidOnCredit || detail.paymentPromisedOn || detail.creditReason || detail.policyNotes) && <Card variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={800}>Πληρωμές & σημειώσεις</Typography>{details.map(detail => <Box key={detail.id} sx={{ mt: 1.5 }}><Typography fontWeight={700}>{detail.policyNumber}</Typography><Typography variant="body2">{detail.paidOnCredit ? "Πληρωμή επί πιστώσει" : ""}{detail.paymentPromisedOn ? ` · Υπόσχεση πληρωμής: ${detail.paymentPromisedOn}` : ""}{detail.creditReason ? ` · ${detail.creditReason}` : ""}</Typography>{detail.policyNotes && <Typography variant="body2" color="text.secondary">{detail.policyNotes}</Typography>}</Box>)}</Card>}
      </Stack>}
    </DialogContent>
    <DialogActions sx={{ justifyContent: "space-between" }}>
      <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => { if (window.confirm("Να διαγραφεί η συσχέτιση του οχήματος από όλα τα συμβόλαια; Τα συμβόλαια, οι ζημιές και τα οικονομικά τους δεν διαγράφονται.")) removeAllVehicle.mutate(); }} disabled={!first || removeAllVehicle.isPending}>{removeAllVehicle.isPending ? "Διαγραφή…" : "Διαγραφή οχήματος"}</Button>
      <Button onClick={onClose}>Κλείσιμο</Button>
    </DialogActions>
  </Dialog>;
}

export function CustomerVehiclesPage() {
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
