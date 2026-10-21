import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { usePermission } from "../auth/permissions";
import { DetailProfileTabs } from "../components/profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, profileFieldGridSx, useProfileFieldEditor, type ProfileFieldSession } from "../components/profile/ProfileFieldEditor";
import { VEHICLE_SPEC_FIELDS, mergeVehicleSpecs } from "../components/profile/vehicleProfile";
import { vehicleOwnerHistory } from "../components/profile/vehicleHistory";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AddIcon from "@mui/icons-material/Add";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import PrintIcon from "@mui/icons-material/Print";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { exportActionSx } from "../components/actionButtonStyles";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SavedReportsButton } from "../components/SavedReportsButton";

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
  customerId?: string;
  customerVat?: string | null;
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

export function vehicleStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    Active: "Ενεργό",
    Inactive: "Ανενεργό",
    Cancelled: "Ακυρωμένο",
    Expired: "Ληγμένο",
    Pending: "Σε εκκρεμότητα",
    PendingRenewal: "Σε ανανέωση",
    Renewal: "Ανανέωση",
    Renewed: "Ανανεωμένο",
    Draft: "Πρόχειρο",
    Issued: "Εκδομένο",
    Prospect: "Πιθανό συμβόλαιο"
  };
  const value = (status ?? "").trim();
  if (!value) return "Δεν έχει οριστεί";
  if (labels[value]) return labels[value];
  const canonical = Object.keys(labels).find(key => key.toLowerCase() === value.toLowerCase());
  return canonical ? labels[canonical] : value;
}

function claimStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    Reported: "Δηλωμένη", UnderReview: "Υπό εξέταση", Investigating: "Υπό διερεύνηση",
    Approved: "Εγκεκριμένη", Rejected: "Απορριφθείσα", Settled: "Αποζημιωμένη", Closed: "Κλειστή",
    Pending: "Σε εκκρεμότητα", Cancelled: "Ακυρωμένη"
  };
  const value = (status ?? "").trim();
  if (!value) return "Δεν έχει οριστεί";
  if (labels[value]) return labels[value];
  const canonical = Object.keys(labels).find(key => key.toLowerCase() === value.toLowerCase());
  return canonical ? labels[canonical] : value;
}

export function VehicleDetailDialog({ open, plate, policyIds: suppliedPolicyIds, onClose, zIndex, initialEditing = false }: { open: boolean; plate: string; policyIds: string[]; onClose: () => void; zIndex?: number; initialEditing?: boolean }) {
  // Keep the linked IDs when a plate edit moves this vehicle out of the parent's old plate group.
  const retained = useRef({ plate, ids: suppliedPolicyIds });
  if (retained.current.plate !== plate) retained.current = { plate, ids: suppliedPolicyIds };
  else if (suppliedPolicyIds.length) retained.current.ids = suppliedPolicyIds;
  const policyIds = suppliedPolicyIds.length ? suppliedPolicyIds : retained.current.ids;
  const qc = useQueryClient();
  const canWrite = usePermission("policies.write");
  const [tab, setTab] = useState(0);
  const [policySearch, setPolicySearch] = useState("");
  const [policyStatus, setPolicyStatus] = useState("");
  const [policyPage, setPolicyPage] = useState(0);
  useEffect(() => { setTab(0); setPolicySearch(""); setPolicyStatus(""); setPolicyPage(0); }, [open, plate]);
  const queryKey = ["vehicle-detail", plate, policyIds.join(",")];
  const q = useQuery({
    queryKey, enabled: open && policyIds.length > 0,
    queryFn: async () => {
      const details = await Promise.all(policyIds.map(id => api.get<VehiclePolicyDetail>(`/policies/${id}/detail`).then(response => response.data)));
      return { details };
    }
  });
  const claimsQ = useQuery({
    queryKey: ["vehicle-claims", policyIds.join(",")], enabled: open && tab === 3 && policyIds.length > 0,
    queryFn: async () => (await api.get<any[]>("/claims")).data.filter(claim => policyIds.includes(String(claim.policyId))),
  });
  const details = [...(q.data?.details ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id)), first = details[0];
  const invalidateVehicle = () => {
    for (const key of [queryKey, ["customer-vehicles-all"], ["customer-vehicles"], ["policies"], ["policy-detail"]]) void qc.invalidateQueries({ queryKey: key });
  };
  const specs = parseSpecs(first?.specsJson);
  const values = Object.fromEntries([
    ["vehicleRegistrationPlate", first?.vehicleRegistrationPlate ?? plate],
    ["vehicleUseCategory", first?.vehicleUseCategory ?? first?.carrierUseCode ?? ""],
    ["reasonForCirculation", first?.reasonForCirculation ?? ""],
    ...VEHICLE_SPEC_FIELDS.map(([key]) => ["spec:" + key, String(specs[key] ?? "")]),
  ]);
  const session = useProfileFieldEditor({
    sessionKey: open ? plate + ":" + policyIds.join(",") : "", initialEditing: initialEditing && canWrite, values, refresh: invalidateVehicle, onClose,
    write: async (changes, accept) => {
      if (!canWrite || !first) throw new Error("Δεν επιτρέπεται η επεξεργασία οχήματος.");
      if (!Object.keys(changes).length) return;
      const latest = qc.getQueryData<{ details: VehiclePolicyDetail[] }>(queryKey)?.details.find(row => row.id === first.id) ?? first;
      const pick = (key: string, fallback?: string | null) => changes[key] === undefined ? fallback ?? null : changes[key].trim() || null;
      const specChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith("spec:")).map(([key, value]) => [key.slice(5), value]));
      const saved = (await api.patch<VehiclePolicyDetail>(`/policies/${latest.id}/vehicle`, {
        vehicleRegistrationPlate: pick("vehicleRegistrationPlate", latest.vehicleRegistrationPlate),
        vehicleUseCategory: pick("vehicleUseCategory", latest.vehicleUseCategory ?? latest.carrierUseCode),
        reasonForCirculation: pick("reasonForCirculation", latest.reasonForCirculation),
        driverVatNumber: latest.customerVat ?? null,
        // The endpoint replaces all details: preserve contract-only data, never expose it as vehicle data.
        characteristic: latest.characteristic, deductible: latest.deductible, position: latest.position, notes: latest.policyNotes,
        specsJson: Object.keys(specChanges).length ? mergeVehicleSpecs(latest.specsJson, specChanges) : latest.specsJson,
        replaceDetails: true, clearVehicleRegistrationPlate: changes.vehicleRegistrationPlate !== undefined && !changes.vehicleRegistrationPlate.trim(),
      })).data;
      qc.setQueryData(queryKey, (previous: typeof q.data) => previous ? { ...previous, details: previous.details.map(row => row.id === saved.id ? saved : row) } : previous);
      accept(Object.keys(changes));
    }
  });
  const removeAllVehicle = useMutation({ mutationFn: async () => Promise.all(policyIds.map(id => api.patch(`/policies/${id}/vehicle`, { clearVehicleRegistrationPlate: true }))), onSuccess: () => { invalidateVehicle(); onClose(); } });
  const owners = vehicleOwnerHistory(details);
  const filteredPolicies = details.filter(row => {
    const term = policySearch.trim().toLocaleLowerCase("el-GR");
    return (!term || [row.policyNumber, row.insuranceCompanyName, row.customerDisplay].some(value => value.toLocaleLowerCase("el-GR").includes(term)))
      && (!policyStatus || row.status === policyStatus);
  });
  const visiblePolicyPage = Math.min(policyPage, Math.max(0, Math.ceil(filteredPolicies.length / 10) - 1));
  return <Dialog open={open} onClose={session.requestClose} fullWidth maxWidth="xl" PaperProps={{ sx: profileDialogPaperSx }} sx={zIndex ? { zIndex } : undefined}>
    <DialogTitle sx={{ px: 1.25, py: .9, bgcolor: "#0b305c", color: "#fff" }}><Stack direction="row" gap={1} alignItems="center"><DirectionsCarIcon /><Typography variant="h6" fontWeight={800}>{first?.vehicleRegistrationPlate || plate || "Χωρίς πινακίδα"}</Typography></Stack></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: .65, md: 1.25 }, minHeight: 0 }}>
      <DetailProfileTabs value={tab} onChange={setTab} items={[
        { label: "Γενικά", icon: <DirectionsCarIcon /> }, { label: "Ιδιοκτήτες", icon: <PersonOutlineIcon /> },
        { label: "Συμβόλαια", icon: <DescriptionOutlinedIcon /> }, { label: "Ζημιές", icon: <ReportProblemOutlinedIcon /> },
      ]} />
      <ProfileEditorFeedback session={session} />
      {q.isLoading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}
      {q.isError && <Alert severity="error">{extractErrorMessage(q.error)}</Alert>}
      {tab === 3 && claimsQ.isLoading && <CircularProgress size={22} />}
      {tab === 3 && claimsQ.isError && <Alert severity="error">Δεν φορτώθηκαν οι συνδεδεμένες ζημιές. {extractErrorMessage(claimsQ.error)}</Alert>}
      {[removeAllVehicle].map((mutation, index) => mutation.isError ? <Alert key={index} severity="error">{extractErrorMessage(mutation.error)}</Alert> : null)}
      {first && tab === 0 && <VehicleProfileFields session={canWrite ? session : undefined} values={values} owner={first.customerDisplay} ownerVat={first.customerVat} />}
      {tab === 1 && <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">Ιστορικό ιδιοκτητών βάσει καταχωρημένων ασφαλιστηρίων. Οι περίοδοι αφορούν ασφαλιστική κάλυψη και όχι πιστοποίηση μεταβίβασης.</Typography>
        <Box sx={{ overflowX: "auto" }}><Table size="small">
          <TableHead><TableRow><TableCell>Ιδιοκτήτης / πελάτης</TableCell><TableCell>ΑΦΜ</TableCell><TableCell>Πρώτη κάλυψη</TableCell><TableCell>Τελευταία κάλυψη</TableCell><TableCell>Συμβόλαια</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>{owners.map(owner => <TableRow key={owner.key}>
            <TableCell>{owner.customerDisplay}</TableCell><TableCell>{owner.customerVat || "—"}</TableCell>
            <TableCell>{owner.from}</TableCell><TableCell>{owner.to}</TableCell><TableCell>{owner.policyNumbers.join(", ")}</TableCell>
            <TableCell>{owner.customerId && <Button component={RouterLink} to={"/app/customers/" + owner.customerId} size="small" variant="contained" color="success" sx={{ color: "#fff", whiteSpace: "nowrap" }}>Καρτέλα πελάτη</Button>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></Box>
        {!owners.length && <Typography color="text.secondary">Δεν υπάρχει καταχωρημένο ιστορικό ιδιοκτητών.</Typography>}
      </Stack>}
      {first && tab === 2 && <Stack spacing={1}>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ pt: .75 }}>
          <TextField size="small" label="Αναζήτηση συμβολαίου, εταιρείας ή πελάτη" value={policySearch} onChange={event => { setPolicySearch(event.target.value); setPolicyPage(0); }} sx={{ flex: "1 1 250px" }} />
          <TextField size="small" select label="Κατάσταση" value={policyStatus} onChange={event => { setPolicyStatus(event.target.value); setPolicyPage(0); }} sx={{ flex: "0 1 180px", minWidth: 130 }}>
            <MenuItem value="">Όλες</MenuItem>{[...new Set(details.map(row => row.status))].map(status => <MenuItem key={status} value={status}>{vehicleStatusLabel(status)}</MenuItem>)}
          </TextField>
        </Stack>
        <Box sx={{ overflowX: "auto" }}><Table size="small">
          <TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Πελάτης</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Μικτά</TableCell></TableRow></TableHead>
          <TableBody>{filteredPolicies.slice(visiblePolicyPage * 10, visiblePolicyPage * 10 + 10).map(detail => <TableRow key={detail.id}>
            <TableCell>{detail.policyNumber}</TableCell><TableCell>{detail.insuranceCompanyName}</TableCell><TableCell>{detail.customerDisplay}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{detail.startDate}</TableCell><TableCell sx={{ whiteSpace: "nowrap" }}>{detail.endDate}</TableCell>
            <TableCell><Chip size="small" label={vehicleStatusLabel(detail.status)} /></TableCell><TableCell align="right">{money(detail.premium, detail.currency)}</TableCell>
          </TableRow>)}</TableBody>
        </Table></Box>
        {!filteredPolicies.length && <Typography color="text.secondary">Δεν βρέθηκαν ασφαλιστήρια με αυτά τα φίλτρα.</Typography>}
        <TablePagination component="div" count={filteredPolicies.length} page={visiblePolicyPage} onPageChange={(_, page) => setPolicyPage(page)} rowsPerPage={10} rowsPerPageOptions={[10]} labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
      </Stack>}
      {first && tab === 3 && <Box sx={{ overflowX: "auto" }}>        <Card variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.75 }}>Ζημιές</Typography>{(claimsQ.data ?? []).length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν καταχωρημένες ζημιές για το όχημα.</Typography> : <Table size="small"><TableHead><TableRow><TableCell>Αρ. ζημιάς</TableCell><TableCell>Ημερομηνία</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Διεκδίκηση</TableCell><TableCell align="right">Έγκριση</TableCell></TableRow></TableHead><TableBody>{(claimsQ.data ?? []).map(claim => <TableRow key={claim.id}><TableCell>{claim.claimNumber ?? "—"}</TableCell><TableCell>{claim.incidentDate ?? "—"}</TableCell><TableCell><Chip size="small" label={claimStatusLabel(claim.status)} /></TableCell><TableCell align="right">{money(claim.claimedAmount, first.currency)}</TableCell><TableCell align="right">{money(claim.approvedAmount, first.currency)}</TableCell></TableRow>)}</TableBody></Table>}</Card></Box>}
    </DialogContent>
    <DialogActions sx={{ px: 1.25, py: .6, justifyContent: "space-between", flexWrap: "wrap", gap: .75 }}>
      {canWrite && <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={!first || session.dirty || session.busy || removeAllVehicle.isPending} onClick={() => { if (window.confirm("Να αφαιρεθεί η συσχέτιση οχήματος; Τα συμβόλαια και οι ζημιές δεν διαγράφονται.")) removeAllVehicle.mutate(); }}>Αφαίρεση συσχέτισης</Button>}
      {canWrite && first ? <ProfileEditorActions session={session} label="οχήματος" /> : <Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}
    </DialogActions>
  </Dialog>;
}

export function VehicleProfileFields({ session, values, owner, ownerVat }: { session?: ProfileFieldSession; values: Record<string, string>; owner?: string; ownerVat?: string | null }) {
  const field = (key: string, label: string, extra: Partial<React.ComponentProps<typeof ProfileEditableField>> = {}) =>
    <ProfileEditableField key={key} field={session ? key : undefined} session={session} value={values[key]} label={label} {...extra} />;
  const booleanVehicleFields = new Set(["sunroof", "youngDriver", "rearDualWheels", "alarm", "immobilizer"]);
  const dateVehicleFields = new Set(["purchaseDate", "firstRegistrationDate", "transferDate", "emissionsCardExpiry", "inspectionDate", "nextInspectionDate"]);
  return <Box sx={{ ...profileFieldGridSx, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
    {field("vehicleRegistrationPlate", "Πινακίδα", { mono: true })}
    <ProfileEditableField label="Ιδιοκτήτης / πελάτης" value={owner} />
    <ProfileEditableField label="ΑΦΜ ιδιοκτήτη (αυτόματο)" value={ownerVat} mono />
    {field("vehicleUseCategory", "Χρήση / κατηγορία")}
    {field("reasonForCirculation", "Λόγος κυκλοφορίας")}
    {VEHICLE_SPEC_FIELDS.map(([key, label]) => field("spec:" + key, label, {
      multiline: key === "vehicleNotes", type: dateVehicleFields.has(key) ? "date" : "text",
      options: booleanVehicleFields.has(key) ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Ναι", label: "Ναι" }, { value: "Όχι", label: "Όχι" }, { value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }] : key === "condition" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Καινούργιο", label: "Καινούργιο" }, { value: "Μεταχειρισμένο", label: "Μεταχειρισμένο" }] : key === "fuelType" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Βενζίνη", label: "Βενζίνη" }, { value: "Πετρέλαιο", label: "Πετρέλαιο" }, { value: "Υβριδικό", label: "Υβριδικό" }, { value: "Ηλεκτρικό", label: "Ηλεκτρικό" }, { value: "Υγραέριο", label: "Υγραέριο (LPG)" }, { value: "Φυσικό αέριο", label: "Φυσικό αέριο (CNG)" }] : key === "bodyType" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Hatchback", label: "Hatchback" }, { value: "Sedan", label: "Sedan" }, { value: "SUV", label: "SUV" }, { value: "Station Wagon", label: "Station Wagon" }, { value: "Coupe", label: "Coupe" }, { value: "Cabrio", label: "Cabrio" }, { value: "Van", label: "Van" }, { value: "Pickup", label: "Pickup" }] : undefined,
    }))}
  </Box>;
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
    const body = rows.map(row => [row.vehicleRegistrationPlate ?? "", row.customerDisplay ?? "", row.policyNumber, row.insuranceCompanyName, row.startDate, row.endDate, String(row.premium ?? ""), vehicleStatusLabel(row.status)]);
    const csv = [header, ...body].map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "οχηματα-πελατων.csv"; a.click(); URL.revokeObjectURL(url);
  };
  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  return <Stack spacing={2.5}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="h4" fontWeight={800}>Οχήματα πελατών</Typography><Typography color="text.secondary">Όλα τα οχήματα όπως προκύπτουν από τα ενεργά και ιστορικά συμβόλαια αυτοκινήτου.</Typography></Box>
      <Button startIcon={<DownloadIcon />} variant="outlined" sx={exportActionSx} onClick={exportCsv}>Εξαγωγή CSV</Button>
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
        <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell><TableCell><Chip size="small" label={vehicleStatusLabel(row.status)} /></TableCell><TableCell><Button size="small" onClick={() => setSelectedPlate(row.vehicleRegistrationPlate ?? "")}>Καρτέλα οχήματος</Button></TableCell>
      </TableRow>)}</TableBody>
    </Table></Card>}
    <VehicleDetailDialog open={selectedPlate !== null} plate={selectedPlate ?? ""} policyIds={rows.filter(row => (row.vehicleRegistrationPlate ?? "") === (selectedPlate ?? "")).map(row => row.id)} onClose={() => setSelectedPlate(null)} />
  </Stack>;
}

type AddVehicleForm = {
  policyId: string;
  plate: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  engineCapacity: string;
  taxableHorsepower: string;
  estimatedValue: string;
  purchaseDate: string;
  condition: string;
  ownerCount: string;
  use: string;
  color: string;
  seats: string;
  notes: string;
};

const emptyVehicleForm = (policyId = ""): AddVehicleForm => ({
  policyId, plate: "", make: "", model: "", year: "", vin: "", engineCapacity: "",
  taxableHorsepower: "", estimatedValue: "", purchaseDate: "", condition: "Μεταχειρισμένο",
  ownerCount: "", use: "", color: "", seats: "", notes: ""
});

function AddVehicleDialog({ open, rows, onClose, onSaved }: { open: boolean; rows: VehiclePolicyRow[]; onClose: () => void; onSaved: (plate: string) => void }) {
  const [form, setForm] = useState<AddVehicleForm>(() => emptyVehicleForm(rows[0]?.id));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setForm(emptyVehicleForm(rows[0]?.id)); setError(null); }
  }, [open, rows]);
  const save = useMutation({
    mutationFn: async () => {
      const specs: Record<string, string> = {
        make: form.make.trim(), model: form.model.trim(), year: form.year.trim(), vin: form.vin.trim(),
        engineCapacity: form.engineCapacity.trim(), taxableHorsepower: form.taxableHorsepower.trim(),
        estimatedValue: form.estimatedValue.trim(), purchaseDate: form.purchaseDate, condition: form.condition,
        ownerCount: form.ownerCount.trim(), color: form.color.trim(), seats: form.seats.trim(), vehicleNotes: form.notes.trim()
      };
      Object.keys(specs).forEach(key => { if (!specs[key]) delete specs[key]; });
      const current = (await api.get<VehiclePolicyDetail>(`/policies/${form.policyId}/detail`)).data;
      return api.patch(`/policies/${form.policyId}/vehicle`, {
        vehicleRegistrationPlate: form.plate.trim(), vehicleUseCategory: form.use.trim() || null,
        driverVatNumber: current.customerVat ?? null, reasonForCirculation: current.reasonForCirculation,
        characteristic: current.characteristic, deductible: current.deductible, position: current.position, notes: current.policyNotes,
        specsJson: mergeVehicleSpecs(current.specsJson, specs), replaceDetails: true
      });
    },
    onSuccess: () => onSaved(form.plate.trim().toUpperCase()),
    onError: e => setError(extractErrorMessage(e))
  });
  const set = <K extends keyof AddVehicleForm>(key: K, value: AddVehicleForm[K]) => setForm(current => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Προσθήκη οχήματος</DialogTitle>
      <DialogContent dividers>
        {rows.length === 0 ? <Alert severity="info">Δεν υπάρχουν καταχωρημένα ασφαλιστήρια αυτοκινήτου για σύνδεση οχήματος.</Alert> : (
          <Stack spacing={1.25} sx={{ pt: 0.25 }}>
            <Alert severity="info" sx={{ py: 0.5 }}>Το όχημα συνδέεται με το επιλεγμένο ασφαλιστήριο. Τα στοιχεία μπορούν να συμπληρωθούν και αργότερα από την καρτέλα οχήματος.</Alert>
            <TextField select fullWidth label="Συμβόλαιο σύνδεσης" value={form.policyId} onChange={e => set("policyId", e.target.value)}>
              {rows.map(row => <MenuItem key={row.id} value={row.id}>{row.policyNumber} · {row.customerDisplay ?? "Πελάτης"} · {row.insuranceCompanyName}</MenuItem>)}
            </TextField>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
              <TextField required label="Αριθμός κυκλοφορίας" value={form.plate} onChange={e => set("plate", e.target.value)} />
              <TextField label="Μάρκα" value={form.make} onChange={e => set("make", e.target.value)} />
              <TextField label="Μοντέλο" value={form.model} onChange={e => set("model", e.target.value)} />
              <TextField label="Έτος κατασκευής" value={form.year} onChange={e => set("year", e.target.value)} />
              <TextField label="VIN / αριθμός πλαισίου" value={form.vin} onChange={e => set("vin", e.target.value)} />
              <TextField label="Κυβισμός (cc)" value={form.engineCapacity} onChange={e => set("engineCapacity", e.target.value)} />
              <TextField label="Φορολογήσιμοι ίπποι" value={form.taxableHorsepower} onChange={e => set("taxableHorsepower", e.target.value)} />
              <TextField label="Εκτιμώμενη αξία" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} />
              <TextField label="Ημερομηνία αγοράς" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField select label="Κατάσταση" value={form.condition} onChange={e => set("condition", e.target.value)}><MenuItem value="Καινούργιο">Καινούργιο</MenuItem><MenuItem value="Μεταχειρισμένο">Μεταχειρισμένο</MenuItem></TextField>
              <TextField label="Αριθμός ιδιοκτητών" value={form.ownerCount} onChange={e => set("ownerCount", e.target.value)} />
              <TextField label="Χρήση" value={form.use} onChange={e => set("use", e.target.value)} />
              <TextField label="Χρώμα" value={form.color} onChange={e => set("color", e.target.value)} />
              <TextField label="Θέσεις" value={form.seats} onChange={e => set("seats", e.target.value)} />
            </Box>
            <TextField label="Σημειώσεις οχήματος" value={form.notes} onChange={e => set("notes", e.target.value)} multiline minRows={2} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="error" variant="contained" onClick={onClose} sx={{ color: "#fff" }}>Ακύρωση</Button>
        <Button color="success" variant="contained" onClick={() => save.mutate()} disabled={!form.policyId || !form.plate.trim() || save.isPending || rows.length === 0} sx={{ color: "#fff" }}>
          {save.isPending ? "Αποθήκευση…" : "Προσθήκη οχήματος"}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
  const [addOpen, setAddOpen] = useState(false);
  const [statsFocus, setStatsFocus] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteText, setDeleteText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
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
        if (renewalFilter === "31-90" && !(days > 30 && days <= 90)) return false;
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
  const statusStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredRows) map.set(row.status, (map.get(row.status) ?? 0) + 1);
    return [...map.entries()].map(([key, value]) => ({ key, name: vehicleStatusLabel(key), value })).sort((a, b) => b.value - a.value);
  }, [filteredRows]);
  const typeStats = useMemo(() => {
    const map = new Map<string, { contracts: number; premium: number }>();
    for (const row of filteredRows) {
      const key = row.policyType || "Χωρίς κλάδο";
      const current = map.get(key) ?? { contracts: 0, premium: 0 };
      current.contracts += 1;
      current.premium += Number(row.premium) || 0;
      map.set(key, current);
    }
    return [...map.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.contracts - a.contracts);
  }, [filteredRows]);
  const expiryStats = useMemo(() => {
    const now = Date.now();
    const buckets = new Map([
      ["expired", { name: "Ληγμένα", value: 0, filter: "expired" }],
      ["30", { name: "Έως 30 ημέρες", value: 0, filter: "30" }],
      ["31-90", { name: "31–90 ημέρες", value: 0, filter: "31-90" }],
      ["later", { name: "Πάνω από 90 ημέρες", value: 0, filter: null }]
    ]);
    for (const row of filteredRows) {
      const days = (new Date(row.endDate).getTime() - now) / 86400000;
      const bucket = days < 0 ? buckets.get("expired") : days <= 30 ? buckets.get("30") : days <= 90 ? buckets.get("31-90") : buckets.get("later");
      if (bucket) bucket.value += 1;
    }
    return [...buckets.values()];
  }, [filteredRows]);
  const monthlyExpiryStats = useMemo(() => {
    const map = new Map<string, { label: string; contracts: number; premium: number; sort: number }>();
    for (const row of filteredRows) {
      const date = new Date(row.endDate);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) ?? { label: date.toLocaleDateString("el-GR", { month: "short", year: "numeric" }), contracts: 0, premium: 0, sort: date.getTime() };
      current.contracts += 1;
      current.premium += Number(row.premium) || 0;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort).slice(0, 12);
  }, [filteredRows]);
  const chartColors = ["#0b5cad", "#2e7d32", "#ed6c02", "#c62828", "#6a1b9a", "#00838f", "#546e7a"];
  const applyChartFilter = (kind: "status" | "company" | "expiry", value: string) => {
    if (kind === "status") setStatusFilter(value);
    if (kind === "company") setCompanyFilter(value);
    if (kind === "expiry") setRenewalFilter(value);
    setStatsFocus(`${kind}:${value}`);
  };
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
    const body = dataset.map(row => [row.vehicleRegistrationPlate ?? "", row.customerDisplay ?? "", row.policyNumber, row.insuranceCompanyName, row.startDate, row.endDate, String(row.premium ?? ""), vehicleStatusLabel(row.status)]);
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
      <Box>
        <Button variant="contained" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
          onClick={event => setActionsAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(actionsAnchor)}>
          Ενέργειες
        </Button>
        <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 285, maxWidth: "calc(100vw - 24px)" } } }}>
          <MenuItem onClick={() => { setActionsAnchor(null); setAddOpen(true); }} sx={{ color: "#0877c9", "&:hover": { bgcolor: "#e7f2fd" } }}>
            <ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Προσθήκη οχήματος" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setStatsFocus(null); setStatsOpen(true); }} sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb" } }}>
            <ListItemIcon sx={{ color: "#5b55a5" }}><DirectionsCarIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στατιστικά οχημάτων" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }} sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc" } }}>
            <ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setActionsAnchor(null); exportCsv(); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}>
            <ListItemIcon sx={{ color: "#167c45" }}><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); window.print(); }} sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7" } }}>
            <ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" />
          </MenuItem>
          {selectedCount > 0 && <><Divider /><MenuItem onClick={() => { setActionsAnchor(null); requestDelete([...selectedIds]); }} sx={{ color: "#c73545", "&:hover": { bgcolor: "#fdecef" } }}>
            <ListItemIcon sx={{ color: "#c73545" }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon><ListItemText primary={`Διαγραφή (${selectedCount})`} />
          </MenuItem></>}
        </Menu>
      </Box>
    </Stack>
    <Card variant="outlined" sx={{ p: 1 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
        <TextField size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση πινακίδας, πελάτη, συμβολαίου ή ασφαλιστικής" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: 1, minWidth: { md: 260 } }} />
        <TextField select size="small" label="Κατάσταση" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="">Όλες</MenuItem>{[...new Set(sourceRows.map(row => row.status))].filter(Boolean).map(value => <MenuItem key={value} value={value}>{vehicleStatusLabel(value)}</MenuItem>)}</TextField>
        <TextField select size="small" label="Ασφαλιστική" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="">Όλες</MenuItem>{companies.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select size="small" label="Λήξη" value={renewalFilter} onChange={e => setRenewalFilter(e.target.value)} sx={{ minWidth: 145 }}><MenuItem value="all">Όλες</MenuItem><MenuItem value="30">Σε 30 ημέρες</MenuItem><MenuItem value="31-90">31–90 ημέρες</MenuItem><MenuItem value="90">Σε 90 ημέρες</MenuItem><MenuItem value="expired">Ληγμένα</MenuItem></TextField>
        <SavedReportsButton entity="vehicles" currentFilters={{ search, statusFilter, companyFilter, renewalFilter }}
          onLoad={next => { setSearch(next.search ?? ""); setStatusFilter(next.statusFilter ?? ""); setCompanyFilter(next.companyFilter ?? ""); setRenewalFilter(next.renewalFilter ?? "all"); }}
          saveRequestToken={saveFilterRequest} />
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
    <AddVehicleDialog open={addOpen} rows={sourceRows} onClose={() => setAddOpen(false)} onSaved={plate => { setAddOpen(false); setSelectedVehicle({ plate, edit: false }); void qc.invalidateQueries({ queryKey: ["customer-vehicles-all"] }); void qc.invalidateQueries({ queryKey: ["customer-vehicles"] }); }} />
    <Dialog open={statsOpen} onClose={() => setStatsOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box><Typography variant="h6" fontWeight={900}>Στατιστικά οχημάτων</Typography><Typography variant="body2" color="text.secondary">Ζωντανή εικόνα των {filteredRows.length} εγγραφών που ταιριάζουν στα τρέχοντα φίλτρα.</Typography></Box>
          {statsFocus && <Button size="small" color="error" onClick={() => { setStatsFocus(null); resetFilters(); }}>Καθαρισμός φίλτρου γραφήματος</Button>}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1 }}>{[["Συμβόλαια", filteredRows.length], ["Πινακίδες", uniquePlates], ["Λήξεις 30 ημερών", expiring], ["Ασφάλιστρα", money(totalPremium)]].map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ p: 1.25, bgcolor: "#f7f9fc" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value}</Typography></Card>)}</Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            <Card variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={900}>Κατάσταση συμβολαίων</Typography>
              <Typography variant="caption" color="text.secondary">Κάντε κλικ σε τμήμα για φιλτράρισμα της λίστας.</Typography>
              <Box sx={{ height: 250, mt: 0.5 }}>
                {statusStats.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>Δεν υπάρχουν δεδομένα.</Typography> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusStats} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2} label onClick={entry => { if (entry?.key != null) applyChartFilter("status", String(entry.key)); }}>{statusStats.map((entry, index) => <Cell key={entry.key} fill={chartColors[index % chartColors.length]} />)}</Pie><ChartTooltip /><Legend /></PieChart></ResponsiveContainer>}
              </Box>
            </Card>
            <Card variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={900}>Συμβόλαια ανά ασφαλιστική</Typography>
              <Typography variant="caption" color="text.secondary">Κλικ σε μπάρα για εφαρμογή φίλτρου ασφαλιστικής.</Typography>
              <Box sx={{ height: 250, mt: 0.5 }}>
                {companyStats.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>Δεν υπάρχουν δεδομένα.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={companyStats.map(([name, value]) => ({ name, contracts: value.contracts }))} margin={{ top: 8, right: 8, left: -12, bottom: 8 }} onClick={event => { const chartEvent = event as unknown as { activePayload?: Array<{ payload?: { name?: string } }> }; const name = chartEvent.activePayload?.[0]?.payload?.name; if (name) applyChartFilter("company", name); }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="contracts" name="Συμβόλαια" fill="#0b5cad" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}
              </Box>
            </Card>
            <Card variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={900}>Λήξεις ανά χρονικό διάστημα</Typography>
              <Typography variant="caption" color="text.secondary">Παρακολούθηση άμεσων ανανεώσεων και ληγμένων.</Typography>
              <Box sx={{ height: 250, mt: 0.5 }}>
                <ResponsiveContainer width="100%" height="100%"><BarChart data={expiryStats} margin={{ top: 8, right: 8, left: -12, bottom: 8 }} onClick={event => { const chartEvent = event as unknown as { activePayload?: Array<{ payload?: { filter?: string | null } }> }; const item = chartEvent.activePayload?.[0]?.payload; if (item?.filter) applyChartFilter("expiry", item.filter); }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-14} textAnchor="end" height={52} /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="value" name="Συμβόλαια" radius={[5, 5, 0, 0]}>{expiryStats.map((entry, index) => <Cell key={entry.name} fill={index === 0 ? "#c62828" : index === 1 ? "#ed6c02" : index === 2 ? "#f9a825" : "#2e7d32"} />)}</Bar></BarChart></ResponsiveContainer>
              </Box>
            </Card>
            <Card variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={900}>Μηνιαία εικόνα λήξεων και ασφαλίστρων</Typography>
              <Typography variant="caption" color="text.secondary">Υπολογίζεται αυτόματα από τις ημερομηνίες λήξης.</Typography>
              <Box sx={{ height: 250, mt: 0.5 }}>
                {monthlyExpiryStats.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>Δεν υπάρχουν έγκυρες ημερομηνίες.</Typography> : <ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyExpiryStats} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" allowDecimals={false} /><YAxis yAxisId="right" orientation="right" /><ChartTooltip formatter={(value, name) => [name === "premium" ? money(Number(value)) : value, name === "premium" ? "Ασφάλιστρα" : "Συμβόλαια"]} /><Legend formatter={name => name === "premium" ? "Ασφάλιστρα" : "Συμβόλαια"} /><Line yAxisId="left" type="monotone" dataKey="contracts" name="Συμβόλαια" stroke="#0b5cad" strokeWidth={3} dot /><Line yAxisId="right" type="monotone" dataKey="premium" name="premium" stroke="#2e7d32" strokeWidth={2} dot /></LineChart></ResponsiveContainer>}
              </Box>
            </Card>
          </Box>
          <Card variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 0.75 }}>Κλάδοι οχημάτων</Typography>
            {typeStats.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα κλάδων.</Typography> : <Box sx={{ height: Math.max(180, Math.min(330, typeStats.length * 42)) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={typeStats} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} /><ChartTooltip formatter={(value, name) => [name === "premium" ? money(Number(value)) : value, name === "premium" ? "Ασφάλιστρα" : "Συμβόλαια"]} /><Legend formatter={name => name === "premium" ? "Ασφάλιστρα" : "Συμβόλαια"} /><Bar dataKey="contracts" name="Συμβόλαια" fill="#0b5cad" radius={[0, 5, 5, 0]} /><Bar dataKey="premium" name="premium" fill="#2e7d32" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></Box>}
          </Card>
          <Typography variant="caption" color="text.secondary">Τα γραφήματα ανανεώνονται άμεσα όταν αλλάζετε αναζήτηση ή φίλτρα. Τα ποσά είναι τα ασφάλιστρα των συμβολαίων που εμφανίζονται.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions><Button startIcon={<DownloadIcon />} onClick={() => exportCsv()}>Εξαγωγή CSV</Button><Button onClick={() => window.print()}>Εκτύπωση</Button><Button variant="contained" color="error" sx={{ color: "#fff" }} onClick={() => setStatsOpen(false)}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <Dialog open={deleteOpen} onClose={() => !clearVehicle.isPending && setDeleteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Επιβεβαίωση αφαίρεσης</DialogTitle><DialogContent><Typography variant="body2" sx={{ mb: 1 }}>Θα αφαιρεθεί η σύνδεση οχήματος από {deleteIds.length} συμβόλαιο/α. Δεν διαγράφεται το συμβόλαιο. Πληκτρολόγησε <strong>ΔΙΑΓΡΑΦΗ</strong> για επιβεβαίωση.</Typography><TextField autoFocus fullWidth label="Πληκτρολόγησε ΔΙΑΓΡΑΦΗ" value={deleteText} onChange={event => setDeleteText(event.target.value)} /></DialogContent><DialogActions><Button color="inherit" onClick={() => setDeleteOpen(false)} disabled={clearVehicle.isPending}>Ακύρωση</Button><Button color="error" variant="contained" onClick={() => clearVehicle.mutate(deleteIds)} disabled={deleteText.trim().toUpperCase() !== "ΔΙΑΓΡΑΦΗ" || clearVehicle.isPending}>{clearVehicle.isPending ? "Αφαιρείται..." : "Αφαίρεση"}</Button></DialogActions></Dialog>
  </Stack>;
}
