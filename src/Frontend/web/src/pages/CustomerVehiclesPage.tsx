import { SearchableTextField } from "../components/SearchableTextField";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { usePermission } from "../auth/permissions";
import { DetailProfileTabs } from "../components/profile/DetailProfileTabs";
import { ProfileEditableField, ProfileEditorActions, ProfileEditorFeedback, profileDialogPaperSx, profileFieldGridSx, useProfileFieldEditor, type ProfileFieldSession } from "../components/profile/ProfileFieldEditor";
import { VEHICLE_SPEC_FIELDS, mergeVehicleSpecs, vehicleGeneralColumns } from "../components/profile/vehicleProfile";
import { vehicleOwnerHistory } from "../components/profile/vehicleHistory";
import { vehicleCoOwners, ownershipFieldValues, mergeVehicleOwnership, ownershipCreationChanges } from "../components/profile/vehicleOwnership";
import { VehicleOwnershipFields, VehicleOwnershipInputs } from "../components/profile/VehicleOwnershipFields";
import { filterVehicleRegister, vehicleRegisterColumns, vehicleOwnerText, vehicleUseLabel, type VehicleRow } from "./vehicleRegister";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
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
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import { TableToolbar, RecordCountChip } from "../components/TableToolbar";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { BulkDeleteDialog } from "../components/BulkDeleteDialog";
import { deleteSelectedRecords, selectPageRecords, type DeletionTarget, type DeletionResult } from "../utils/bulkDeletion";

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
    for (const key of [queryKey, ["customer-vehicles-all"], ["customer-vehicles"], ["vehicle-policy-options"], ["policies"], ["policy-detail"]]) void qc.invalidateQueries({ queryKey: key });
  };
  const specs = parseSpecs(first?.specsJson);
  const values = Object.fromEntries([
    ["vehicleRegistrationPlate", first?.vehicleRegistrationPlate ?? plate],
    ["vehicleUseCategory", first?.vehicleUseCategory ?? first?.carrierUseCode ?? ""],
    ["reasonForCirculation", first?.reasonForCirculation ?? ""],
    ...VEHICLE_SPEC_FIELDS.map(([key]) => ["spec:" + key, String(specs[key] ?? "")]),
    ...Object.entries(ownershipFieldValues(vehicleCoOwners(first?.specsJson, first?.customerDisplay, first?.customerVat ?? ""))),
  ]);
  const session = useProfileFieldEditor({
    sessionKey: open ? plate + ":" + policyIds.join(",") : "", initialEditing: initialEditing && canWrite, values, refresh: invalidateVehicle, onClose,
    write: async (changes, accept) => {
      if (!canWrite || !first) throw new Error("Δεν επιτρέπεται η επεξεργασία οχήματος.");
      if (!Object.keys(changes).length) return;
      const latest = qc.getQueryData<{ details: VehiclePolicyDetail[] }>(queryKey)?.details.find(row => row.id === first.id) ?? first;
      const pick = (key: string, fallback?: string | null) => changes[key] === undefined ? fallback ?? null : changes[key].trim() || null;
      const specChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith("spec:")).map(([key, value]) => [key.slice(5), value]));
      const ownershipChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith("owner:")));
      let nextSpecs = Object.keys(specChanges).length ? mergeVehicleSpecs(latest.specsJson, specChanges) : latest.specsJson;
      if (Object.keys(ownershipChanges).length || changes["spec:ownerCount"] !== undefined)
        nextSpecs = mergeVehicleOwnership(nextSpecs, ownershipChanges, latest.customerDisplay, latest.customerVat ?? "");
      const saved = (await api.patch<VehiclePolicyDetail>(`/policies/${latest.id}/vehicle`, {
        vehicleRegistrationPlate: pick("vehicleRegistrationPlate", latest.vehicleRegistrationPlate),
        vehicleUseCategory: pick("vehicleUseCategory", latest.vehicleUseCategory ?? latest.carrierUseCode),
        reasonForCirculation: pick("reasonForCirculation", latest.reasonForCirculation),
        driverVatNumber: latest.customerVat ?? null,
        // The endpoint replaces all details: preserve contract-only data, never expose it as vehicle data.
        characteristic: latest.characteristic, deductible: latest.deductible, position: latest.position, notes: latest.policyNotes,
        specsJson: nextSpecs,
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
        <VehicleOwnershipFields values={values} session={canWrite ? session : undefined} />
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
      {canWrite && <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={!first || session.dirty || session.busy || removeAllVehicle.isPending} onClick={() => { if (window.confirm("Να γίνει έλεγχος και διαγραφή του οχήματος; Η διαγραφή δεν επιτρέπεται αν υπάρχει συνδεδεμένο συμβόλαιο ή ιστορικό.")) removeAllVehicle.mutate(); }}>Διαγραφή οχήματος</Button>}
      {canWrite && first ? <ProfileEditorActions session={session} label="οχήματος" /> : <Button color="error" variant="contained" onClick={session.requestClose}>Κλείσιμο</Button>}
    </DialogActions>
  </Dialog>;
}

export function VehicleProfileFields({ session, values, owner, ownerVat }: { session?: ProfileFieldSession; values: Record<string, string>; owner?: string; ownerVat?: string | null }) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const medium = useMediaQuery(theme.breakpoints.up("md"));
  const columnCount = wide ? 3 : medium ? 2 : 1;
  const field = (key: string, label: string, extra: Partial<React.ComponentProps<typeof ProfileEditableField>> = {}) =>
    <ProfileEditableField key={key} field={session ? key : undefined} session={session} value={values[key]} label={label} {...extra} />;
  const booleanVehicleFields = new Set(["sunroof", "youngDriver", "rearDualWheels", "alarm", "immobilizer"]);
  const dateVehicleFields = new Set(["purchaseDate", "firstRegistrationDate", "transferDate", "emissionsCardExpiry", "inspectionDate", "nextInspectionDate"]);
  const fields = new Map<string, React.ReactNode>([
    ["vehicleRegistrationPlate", field("vehicleRegistrationPlate", "Πινακίδα", { mono: true })],
    ["owner", <ProfileEditableField key="owner" label="Ιδιοκτήτης / πελάτης" value={owner} />],
    ["ownerVat", <ProfileEditableField key="ownerVat" label="ΑΦΜ ιδιοκτήτη (αυτόματο)" value={ownerVat} mono />],
    ["vehicleUseCategory", field("vehicleUseCategory", "Χρήση / κατηγορία")],
    ["reasonForCirculation", field("reasonForCirculation", "Λόγος κυκλοφορίας")],
    ...VEHICLE_SPEC_FIELDS.map(([key, label]): [string, React.ReactNode] => ["spec:" + key, field("spec:" + key, label, {
      multiline: key === "vehicleNotes", type: key === "ownerCount" ? "number" : dateVehicleFields.has(key) ? "date" : "text",
      options: booleanVehicleFields.has(key) ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Ναι", label: "Ναι" }, { value: "Όχι", label: "Όχι" }, { value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }] : key === "condition" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Καινούργιο", label: "Καινούργιο" }, { value: "Μεταχειρισμένο", label: "Μεταχειρισμένο" }] : key === "fuelType" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Βενζίνη", label: "Βενζίνη" }, { value: "Πετρέλαιο", label: "Πετρέλαιο" }, { value: "Υβριδικό", label: "Υβριδικό" }, { value: "Ηλεκτρικό", label: "Ηλεκτρικό" }, { value: "Υγραέριο", label: "Υγραέριο (LPG)" }, { value: "Φυσικό αέριο", label: "Φυσικό αέριο (CNG)" }] : key === "bodyType" ? [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Hatchback", label: "Hatchback" }, { value: "Sedan", label: "Sedan" }, { value: "SUV", label: "SUV" }, { value: "Station Wagon", label: "Station Wagon" }, { value: "Coupe", label: "Coupe" }, { value: "Cabrio", label: "Cabrio" }, { value: "Van", label: "Van" }, { value: "Pickup", label: "Pickup" }] : undefined,
    })]),
  ]);
  return <Box sx={{ ...profileFieldGridSx, display: "block" }}>
    <Box data-vehicle-general-columns={columnCount} sx={{ display: "grid", gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, columnGap: 1, alignItems: "start" }}>
      {vehicleGeneralColumns(columnCount).map((keys, index) => <Stack key={index} data-vehicle-column={index + 1} spacing={.25} sx={{ minWidth: 0 }}>
        {keys.map(key => fields.get(key))}
      </Stack>)}
    </Box>
    <VehicleOwnershipFields values={values} session={session} vertical />
  </Box>;
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

function AddVehicleDialog({ open, rows, loading = false, error: loadError, onClose, onSaved }: { open: boolean; rows: VehiclePolicyRow[]; loading?: boolean; error?: string | null; onClose: () => void; onSaved: (plate: string, policyId: string) => void }) {
  const [form, setForm] = useState<AddVehicleForm>(() => emptyVehicleForm(rows[0]?.id));
  const [ownershipValues, setOwnershipValues] = useState<Record<string, string>>({});
  useEffect(() => { setOwnershipValues({}); }, [open, form.policyId]);
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
        specsJson: mergeVehicleOwnership(mergeVehicleSpecs(current.specsJson, specs), ownershipCreationChanges(ownershipValues, form.ownerCount), current.customerDisplay, current.customerVat ?? ""), replaceDetails: true
      });
    },
    onSuccess: () => onSaved(form.plate.trim().toUpperCase(), form.policyId),
    onError: e => setError(extractErrorMessage(e))
  });
  const set = <K extends keyof AddVehicleForm>(key: K, value: AddVehicleForm[K]) => setForm(current => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Προσθήκη οχήματος</DialogTitle>
      <DialogContent dividers>
        {loading ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress /></Box> : loadError ? <Alert severity="error">{loadError}</Alert> : rows.length === 0 ? <Alert severity="info">Δεν υπάρχουν καταχωρημένα ασφαλιστήρια αυτοκινήτου για σύνδεση οχήματος.</Alert> : (
          <Stack spacing={1.25} sx={{ pt: 0.25 }}>
            <Alert severity="info" sx={{ py: 0.5 }}>Το όχημα συνδέεται με το επιλεγμένο ασφαλιστήριο. Τα στοιχεία μπορούν να συμπληρωθούν και αργότερα από την καρτέλα οχήματος.</Alert>
            <SearchableTextField select fullWidth label="Συμβόλαιο σύνδεσης" value={form.policyId} onChange={e => set("policyId", e.target.value)}>
              {rows.map(row => <MenuItem key={row.id} value={row.id}>{row.policyNumber} · {row.customerDisplay ?? "Πελάτης"} · {row.insuranceCompanyName}</MenuItem>)}
            </SearchableTextField>
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
              <TextField label="Αριθμός ιδιοκτητών" type="number" inputProps={{ min: 1, max: 100, step: 1 }} value={form.ownerCount} onChange={e => set("ownerCount", e.target.value)} />
              <TextField label="Χρήση" value={form.use} onChange={e => set("use", e.target.value)} />
              <TextField label="Χρώμα" value={form.color} onChange={e => set("color", e.target.value)} />
              <TextField label="Θέσεις" value={form.seats} onChange={e => set("seats", e.target.value)} />
            </Box>
            <VehicleOwnershipInputs count={form.ownerCount} values={ownershipValues} onChange={setOwnershipValues} primaryName={rows.find(row => row.id === form.policyId)?.customerDisplay ?? ""} />
            <TextField label="Σημειώσεις οχήματος" value={form.notes} onChange={e => set("notes", e.target.value)} multiline minRows={2} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="error" variant="contained" onClick={onClose} sx={{ color: "#fff" }}>Ακύρωση</Button>
        <Button color="success" variant="contained" onClick={() => save.mutate()} disabled={loading || !!loadError || !form.policyId || !form.plate.trim() || save.isPending || rows.length === 0} sx={{ color: "#fff" }}>
          {save.isPending ? "Αποθήκευση…" : "Προσθήκη οχήματος"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CustomerVehiclesPage() {
  const qc = useQueryClient();
  const canWrite = usePermission("policies.write");
  const theme = useTheme();
  const compactFilters = useMediaQuery(theme.breakpoints.down("xl"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const defaults = { search: "", make: "", fuelType: "", use: "" };
  const [filters, setFilters] = useState(defaults);
  const activeFilterCount = Object.values(filters).filter(value => value.trim()).length;
  useEffect(() => { if (!compactFilters) setFiltersOpen(false); }, [compactFilters]);
  const [selectedVehicle, setSelectedVehicle] = useState<{ plate: string; policyIds: string[]; edit: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statsOpen, setStatsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<DeletionTarget[] | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeletionResult | null>(null);
  const [deleteCompleted, setDeleteCompleted] = useState(0);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [exportAction, setExportAction] = useState<{ token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" }>({ token: 0, action: "csv" });
  const runExport = (action: typeof exportAction.action) => {
    setActionsAnchor(null);
    setExportAction(previous => ({ token: previous.token + 1, action }));
  };
  const q = useQuery({
    queryKey: ["customer-vehicles-all", "vehicle-register"],
    queryFn: async () => (await api.get<VehicleRow[]>("/vehicles")).data,
  });
  // Contract choices belong only to the existing add/link dialog, never to the vehicle table.
  const policyOptionsQ = useQuery({
    queryKey: ["vehicle-policy-options"], enabled: addOpen,
    queryFn: async () => (await api.get<VehiclePolicyRow[]>("/policies", { params: { type: "Auto" } })).data,
  });
  const policyOptions = useMemo(() => policyOptionsQ.data ?? [], [policyOptionsQ.data]);
  const sourceRows = useMemo(() => q.data ?? [], [q.data]);
  const filteredRows = useMemo(() => filterVehicleRegister(sourceRows, filters), [sourceRows, filters]);
  const update = (key: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value })); setPage(0);
  };
  const resetFilters = () => {
    setFilters(defaults); setSelectedIds(new Set()); setPage(0);
    setClearSavedFilterRequest(value => value + 1);
  };
  useEffect(() => { setPage(0); }, [filters, rowsPerPage]);
  const filteredIdsKey = JSON.stringify(filteredRows.map(row => row.id));
  useEffect(() => {
    const visible = new Set<string>(JSON.parse(filteredIdsKey));
    setSelectedIds(previous => {
      const next = new Set([...previous].filter(id => visible.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [filteredIdsKey]);
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1));
  const pageRows = filteredRows.slice(visiblePage * rowsPerPage, visiblePage * rowsPerPage + rowsPerPage);
  const allPageSelected = pageRows.length > 0 && pageRows.every(row => selectedIds.has(row.id));
  const somePageSelected = pageRows.some(row => selectedIds.has(row.id));
  const selectedRows = filteredRows.filter(row => selectedIds.has(row.id));
  const selectedCount = selectedRows.length;
  const options = (key: "make" | "fuelType" | "use") => [...new Set(sourceRows.map(row => row[key]).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "el"));
  const stats = (key: "make" | "fuelType") => {
    const counts = new Map<string, number>();
    filteredRows.forEach(row => { const label = row[key] || "Δεν έχει οριστεί"; counts.set(label, (counts.get(label) ?? 0) + 1); });
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const invalidateVehicles = () => {
    for (const key of [["customer-vehicles-all"], ["customer-vehicles"], ["vehicle-detail"], ["vehicle-policy-options"], ["policies"], ["policy-detail"]])
      void qc.invalidateQueries({ queryKey: key });
  };
  const clearVehicle = useMutation({
    mutationFn: (targets: DeletionTarget[]) => deleteSelectedRecords(targets, id => {
      const vehicle = sourceRows.find(row => row.id === id);
      if (!vehicle) throw new Error("Το όχημα δεν είναι πλέον διαθέσιμο. Ανανεώστε τη λίστα.");
      // The existing protected endpoint prevents detaching an entire vehicle's history.
      return api.patch(`/policies/${vehicle.primaryPolicyId}/vehicle`, { clearVehicleRegistrationPlate: true });
    }, extractErrorMessage, setDeleteCompleted),
    onSuccess: result => {
      setSelectedIds(previous => selectPageRecords(previous, result.deletedIds, false));
      if (result.deletedIds.length) {
        setDeleteSuccess(`Διαγράφηκαν επιτυχώς ${result.deletedIds.length} οχήματα.`);
        invalidateVehicles();
      }
      if (result.failures.length) setDeleteResult(result);
      else setDeleteTargets(null);
    },
  });
  const requestDelete = (ids: string[]) => {
    if (!canWrite || clearVehicle.isPending) return;
    const targets = filteredRows.filter(row => ids.includes(row.id)).map(row => ({ id: row.id, label: `${row.plate} · ${vehicleOwnerText(row)}` }));
    if (!targets.length) return;
    clearVehicle.reset(); setDeleteResult(null); setDeleteCompleted(0); setDeleteTargets(targets);
  };
  const openVehicle = (row: VehicleRow, edit = false) => setSelectedVehicle({ plate: row.plate, policyIds: row.policyIds, edit });
  const exportSubtitle = [
    filters.search && `Αναζήτηση: ${filters.search}`, filters.make && `Μάρκα: ${filters.make}`,
    filters.fuelType && `Καύσιμο: ${filters.fuelType}`, filters.use && `Χρήση: ${vehicleUseLabel(filters.use)}`,
  ].filter(Boolean).join(" · ");
  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;

  return <Stack spacing={1}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} alignItems={{ sm: "center" }}>
      <Stack direction="row" alignItems="center" gap={1}><DirectionsCarIcon color="primary" /><Typography variant="h5" fontWeight={800}>Οχήματα</Typography><RecordCountChip count={filteredRows.length} /></Stack>
      <Stack direction="row" gap={.75} flexWrap="wrap" useFlexGap>
        {compactFilters && <Button variant="contained" startIcon={<FilterListIcon />} onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog" aria-expanded={filtersOpen}
          sx={{ bgcolor: "#159b59", color: "#fff", whiteSpace: "nowrap", flexShrink: 0, "&:hover": { bgcolor: "#107b46", color: "#fff" } }}>
          Φίλτρα{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </Button>}
        <Button variant="contained" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
          onClick={event => setActionsAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(actionsAnchor)}>Ενέργειες</Button>
        <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 260, maxWidth: "calc(100vw - 24px)" } } }}>
          <MenuItem disabled={!canWrite} onClick={() => { setActionsAnchor(null); setAddOpen(true); }} sx={{ color: "#0877c9" }}>
            <ListItemIcon sx={{ color: "inherit" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Προσθήκη οχήματος" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setStatsOpen(true); }} sx={{ color: "#5b55a5" }}>
            <ListItemIcon sx={{ color: "inherit" }}><DirectionsCarIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στατιστικά οχημάτων" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }} sx={{ color: "#0b5cad" }}>
            <ListItemIcon sx={{ color: "inherit" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" />
          </MenuItem>
          <Divider />
          {([['csv', 'Εξαγωγή CSV', DownloadIcon, '#087f73'], ['xlsx', 'Εξαγωγή Excel', GridOnIcon, '#167c45'], ['pdf', 'Εξαγωγή PDF', PictureAsPdfIcon, '#c73545'], ['print', 'Εκτύπωση', PrintIcon, '#456b91'], ['columns', 'Στήλες εξαγωγής', ViewColumnIcon, '#5b55a5']] as const).map(([action, label, Icon, color]) => <MenuItem key={action} onClick={() => runExport(action)} sx={{ color }}><ListItemIcon sx={{ color: "inherit" }}><Icon fontSize="small" /></ListItemIcon><ListItemText primary={label} /></MenuItem>)}
          <Divider />
          <MenuItem disabled={!canWrite || !selectedCount || clearVehicle.isPending} onClick={() => { setActionsAnchor(null); requestDelete(selectedRows.map(row => row.id)); }} sx={{ color: "#c73545" }}>
            <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon><ListItemText primary={`Διαγραφή επιλεγμένων (${selectedCount})`} secondary="Με έλεγχο συσχετίσεων και ιστορικού" />
          </MenuItem>
        </Menu>
      </Stack>
    </Stack>
    <ResponsiveFilterPanel title="Φίλτρα οχημάτων" activeCount={activeFilterCount} compactAt="xl"
      compactButtonPlacement="external" compactOpen={filtersOpen} onCompactOpenChange={setFiltersOpen}
      cardSx={{ p: 1, mb: 0, bgcolor: "#edf2f7", border: "1px solid #d5e0ec", boxShadow: "none" }}>
      <Stack direction={compactFilters ? "column" : "row"} spacing={1} alignItems={compactFilters ? "stretch" : "center"} flexWrap="wrap" useFlexGap sx={{ pt: .5 }}>
        <TextField size="small" value={filters.search} onChange={event => update("search", event.target.value)} label="Αναζήτηση οχήματος ή ιδιοκτήτη"
          placeholder="Πινακίδα, ιδιοκτήτης, μάρκα, μοντέλο, VIN, ΑΦΜ…"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ flex: compactFilters ? "0 0 auto" : "1 1 260px", minWidth: 0, width: compactFilters ? "100%" : "auto" }} />
        {([["make", "Μάρκα"], ["fuelType", "Καύσιμο"], ["use", "Χρήση"]] as const).map(([key, label]) =>
          <TextField key={key} select size="small" label={label} value={filters[key]} onChange={event => update(key, event.target.value)} sx={{ width: compactFilters ? "100%" : 150, flexShrink: 0 }}>
            <MenuItem value="">Όλα</MenuItem>{options(key).map(value => <MenuItem key={value} value={value}>{key === "use" ? vehicleUseLabel(value) : value}</MenuItem>)}
          </TextField>)}
        <SavedReportsButton entity="vehicles" currentFilters={filters}
          onLoad={next => { setFilters({ search: typeof next.search === "string" ? next.search : "", make: typeof next.make === "string" ? next.make : "", fuelType: typeof next.fuelType === "string" ? next.fuelType : "", use: typeof next.use === "string" ? next.use : "" }); setPage(0); }}
          onClear={resetFilters} clearRequestToken={clearSavedFilterRequest} saveRequestToken={saveFilterRequest} showSaveMenuItem={false} />
        <Button size="small" color="error" variant="contained" onClick={resetFilters}>Καθαρισμός</Button>
      </Stack>
    </ResponsiveFilterPanel>
    <TableToolbar<VehicleRow> query="" onQuery={() => {}} count={sourceRows.length} filteredCount={filteredRows.length}
      pageSize={rowsPerPage} onPageSize={setRowsPerPage} hideSearch hideCount hidePageSize hideActionButtons snapshotExport
      exportRows={filteredRows} exportColumns={vehicleRegisterColumns} exportFileName="vehicles" printTitle="Οχήματα"
      printSubtitle={exportSubtitle} columnSelectionId="vehicle-register" actionRequest={exportAction} />
    {selectedCount > 0 && <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} alignItems="center">
      <Chip size="small" label={`${selectedCount} επιλεγμένα`} sx={{ bgcolor: "#102d55", color: "#fff", fontWeight: 750 }} />
      <Button size="small" variant="contained" color="error" startIcon={<DeleteOutlineIcon />} disabled={!canWrite || clearVehicle.isPending} onClick={() => requestDelete(selectedRows.map(row => row.id))}>Διαγραφή επιλεγμένων ({selectedCount})</Button>
      <Button size="small" disabled={clearVehicle.isPending} onClick={() => setSelectedIds(new Set())}>Καθαρισμός επιλογής</Button>
      {selectedCount < filteredRows.length && <Button size="small" disabled={clearVehicle.isPending} onClick={() => setSelectedIds(new Set(filteredRows.map(row => row.id)))}>Επιλογή όλων των αποτελεσμάτων ({filteredRows.length})</Button>}
    </Stack>}
    {filteredRows.length === 0 ? <Alert severity="info">Δεν βρέθηκαν οχήματα με τα συγκεκριμένα φίλτρα.</Alert> : <Card variant="outlined" sx={{ overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: "70vh", overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Μητρώο οχημάτων" sx={{ minWidth: 1150, "& th": { bgcolor: "#e9eef4", fontWeight: 800 }, "& td": { borderColor: "#dfe5ed" }, "& tbody tr:nth-of-type(even)": { bgcolor: "#f0f2f5" } }}>
          <TableHead><TableRow>
            <TableCell padding="checkbox"><Checkbox size="small" checked={allPageSelected} indeterminate={somePageSelected && !allPageSelected} disabled={!pageRows.length || clearVehicle.isPending}
              inputProps={{ "aria-label": "Επιλογή όλων των οχημάτων αυτής της σελίδας" }} onChange={(_event, checked) => setSelectedIds(previous => selectPageRecords(previous, pageRows.map(row => row.id), checked))} /></TableCell>
            {vehicleRegisterColumns.map(column => <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>{column.label}</TableCell>)}
            <TableCell align="right">Ενέργειες</TableCell>
          </TableRow></TableHead>
          <TableBody>{pageRows.map(row => <TableRow key={row.id} hover selected={selectedIds.has(row.id)} onClick={() => openVehicle(row)} sx={{ cursor: "pointer" }}>
            <TableCell padding="checkbox" onClick={event => event.stopPropagation()}><Checkbox size="small" checked={selectedIds.has(row.id)} disabled={clearVehicle.isPending}
              inputProps={{ "aria-label": `Επιλογή οχήματος ${row.plate}` }} onChange={(_event, checked) => setSelectedIds(previous => selectPageRecords(previous, [row.id], checked))} /></TableCell>
            {vehicleRegisterColumns.map(column => <TableCell key={column.key} sx={column.key === "plate" ? { fontFamily: "monospace", fontWeight: 800, whiteSpace: "nowrap" } : undefined}>
              {column.key === "owners" ? <Stack spacing={.2}>{row.owners.map((owner, index) => <Box key={index}>
                {owner.customerId ? <Button component={RouterLink} to={`/app/customers/${owner.customerId}`} size="small" onClick={event => event.stopPropagation()}
                  sx={{ p: 0, minWidth: 0, textAlign: "left", fontWeight: 700 }}>{owner.name || "Χωρίς όνομα"}</Button> : owner.name || "Χωρίς όνομα"}
                {owner.percentage != null && <Typography component="span" variant="caption" sx={{ ml: .5 }}>({owner.percentage.toLocaleString("el-GR")}%)</Typography>}
              </Box>)}</Stack> : column.map ? column.map(row) : row.plate}
            </TableCell>)}
            <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.25}>
              <Tooltip title="Προβολή οχήματος"><IconButton size="small" color="info" onClick={event => { event.stopPropagation(); openVehicle(row); }}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Επεξεργασία οχήματος"><span><IconButton size="small" color="success" disabled={!canWrite} onClick={event => { event.stopPropagation(); openVehicle(row, true); }}><EditIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Διαγραφή οχήματος — έλεγχος συσχετίσεων"><span><IconButton size="small" color="error" disabled={!canWrite || clearVehicle.isPending} onClick={event => { event.stopPropagation(); requestDelete([row.id]); }}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
            </Stack></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={filteredRows.length} page={visiblePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Ανά σελίδα" labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`} />
    </Card>}
    <VehicleDetailDialog open={selectedVehicle !== null} plate={selectedVehicle?.plate ?? ""} initialEditing={selectedVehicle?.edit ?? false}
      policyIds={selectedVehicle?.policyIds ?? []} onClose={() => setSelectedVehicle(null)} />
    <AddVehicleDialog open={addOpen} rows={policyOptions} loading={policyOptionsQ.isLoading} error={policyOptionsQ.isError ? extractErrorMessage(policyOptionsQ.error) : null}
      onClose={() => setAddOpen(false)} onSaved={(plate, policyId) => { setAddOpen(false); setSelectedVehicle({ plate, policyIds: [policyId], edit: false }); invalidateVehicles(); }} />
    <Dialog open={statsOpen} onClose={() => setStatsOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>Στατιστικά οχημάτων</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">Κάθε όχημα υπολογίζεται μία φορά, ανεξάρτητα από το πλήθος συμβολαίων του.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1 }}>
            {[["Οχήματα", filteredRows.length], ["Ιδιοκτήτες", new Set(filteredRows.flatMap(row => row.owners.map(owner => owner.vatNumber || owner.customerId || owner.name).filter(Boolean))).size],
              ["Με καταχωρημένο VIN", filteredRows.filter(row => row.vin).length], ["Μάρκες", new Set(filteredRows.map(row => row.make).filter(Boolean)).size]].map(([label, value]) =>
                <Card key={String(label)} variant="outlined" sx={{ p: 1.25, bgcolor: "#edf2f7" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value}</Typography></Card>)}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
            {([["make", "Οχήματα ανά μάρκα"], ["fuelType", "Οχήματα ανά καύσιμο"]] as const).map(([key, title]) =>
              <Card key={key} variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={800}>{title}</Typography>
                <Box sx={{ height: 280, mt: 1 }}>{!filteredRows.length ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα.</Typography> :
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={stats(key)} margin={{ top: 8, right: 8, left: -20, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><ChartTooltip />
                    <Bar dataKey="count" name="Οχήματα" fill="#087ceb" radius={[4, 4, 0, 0]} />
                  </BarChart></ResponsiveContainer>}</Box>
              </Card>)}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions><Button startIcon={<DownloadIcon />} onClick={() => runExport("csv")}>Εξαγωγή CSV</Button><Button startIcon={<PrintIcon />} onClick={() => runExport("print")}>Εκτύπωση</Button><Button variant="contained" color="error" sx={{ color: "#fff" }} onClick={() => setStatsOpen(false)}>Κλείσιμο</Button></DialogActions>
    </Dialog>
    <BulkDeleteDialog entity="vehicles" targets={deleteTargets} pending={clearVehicle.isPending} completed={deleteCompleted} result={deleteResult}
      onClose={() => { if (!clearVehicle.isPending) { setDeleteTargets(null); setDeleteResult(null); } }}
      onConfirm={() => { if (deleteTargets && !clearVehicle.isPending) clearVehicle.mutate(deleteTargets); }} />
    <Snackbar open={deleteSuccess !== null} autoHideDuration={4000} onClose={() => setDeleteSuccess(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
      <Alert severity="success" variant="filled" onClose={() => setDeleteSuccess(null)}>{deleteSuccess}</Alert>
    </Snackbar>
  </Stack>;
}
