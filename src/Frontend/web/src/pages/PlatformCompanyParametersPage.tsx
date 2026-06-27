import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type VehicleUse = "None" | "EIX" | "EDX" | "FIX" | "FDX" | "LIX" | "LDX" | "Motorcycle" | "Agricultural" | "Construction";
type ParameterKind = "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";

interface CompanyDto {
  id: string;
  name: string;
  code: string;
  isGlobal: boolean;
}

interface ParameterDto {
  id: string;
  insuranceCompanyId: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: ParameterKind;
  code: string;
  name: string;
  policyType: PolicyType | null;
  vehicleUseCategory: VehicleUse | null;
  parentCode: string | null;
  bridgeSystem: string | null;
  bridgeCode: string | null;
  bridgeField: string | null;
  defaultValuesJson: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  displayOrder: number;
  source: string;
  notes: string | null;
}

const KINDS: ParameterKind[] = ["Branch", "Coverage", "Use", "Package", "BridgeCode", "Field", "Other"];
const POLICY_TYPES: PolicyType[] = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Other"];
const VEHICLE_USES: VehicleUse[] = ["EIX", "EDX", "FIX", "FDX", "LIX", "LDX", "Motorcycle", "Agricultural", "Construction"];
const KIND_LABEL: Record<ParameterKind, string> = {
  Branch: "Κλάδος",
  Coverage: "Κάλυψη",
  Use: "Χρήση",
  Package: "Πακέτο",
  BridgeCode: "Mapping γέφυρας",
  Field: "Πεδίο",
  Other: "Άλλο"
};
const TYPE_LABEL: Record<PolicyType, string> = {
  Auto: "Αυτοκίνητο",
  Home: "Κατοικία",
  Health: "Υγείας",
  Life: "Ζωής",
  Business: "Επιχείρηση",
  Travel: "Ταξιδιού",
  Other: "Λοιποί"
};

export function PlatformCompanyParametersPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ParameterDto | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<ParameterKind | "">("");
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const companies = useQuery({
    queryKey: ["platform-company-parameter-companies"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data.filter(c => c.isGlobal)
  });

  const params = useQuery({
    queryKey: ["platform-company-parameters", companyFilter, kindFilter, search, includeInactive],
    queryFn: async () => (await api.get<ParameterDto[]>("/platform/company-parameters", {
      params: {
        insuranceCompanyId: companyFilter || undefined,
        kind: kindFilter || undefined,
        search: search || undefined,
        includeInactive
      }
    })).data
  });

  const seed = useMutation({
    mutationFn: async () => (await api.post<{ companiesProcessed: number; itemsCreated: number }>(
      "/platform/company-parameters/seed-defaults",
      { insuranceCompanyId: companyFilter || null }
    )).data,
    onSuccess: (res) => {
      setSuccess(`Δημιουργήθηκαν ${res.itemsCreated} παραμετρικά για ${res.companiesProcessed} εταιρείες.`);
      void qc.invalidateQueries({ queryKey: ["platform-company-parameters"] });
      void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/platform/company-parameters/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-company-parameters"] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const counts = useMemo(() => {
    const rows = params.data ?? [];
    return KINDS.map(kind => ({ kind, count: rows.filter(r => r.kind === kind).length }));
  }, [params.data]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SettingsSuggestIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Κεντρικά Παραμετρικά Εταιρειών</Typography>
              <HelpHint title="Κεντρική παραμετροποίηση"
                body="Ο superadmin ορίζει μία φορά ανά ασφαλιστική τους κλάδους, χρήσεις, καλύψεις, πακέτα και mappings γέφυρας. Όλα τα γραφεία τα κληρονομούν αυτόματα με βάση τον κωδικό εταιρείας." />
            </Stack>
            <Typography color="text.secondary">
              Source of truth για dropdowns, προμήθειες και γέφυρες. Στόχος: λιγότερη χειροκίνητη παραμετροποίηση και λιγότερα λάθη στα γραφεία.
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<AutoFixHighIcon />} disabled={seed.isPending}
            onClick={() => seed.mutate()}>
            {seed.isPending ? <CircularProgress size={18} /> : "Συμπλήρωση defaults"}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Νέο παραμετρικό
          </Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Εταιρεία" value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)} sx={{ minWidth: 240 }}>
            <MenuItem value="">Όλες</MenuItem>
            {(companies.data ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Τύπος" value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as ParameterKind | "")} sx={{ minWidth: 190 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {KINDS.map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Αναζήτηση" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }}
            placeholder="κωδικός, όνομα, bridge code" />
          <FormControlLabel control={<Switch checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />}
            label="Ανενεργά" />
        </Stack>
      </Card>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
        {counts.map(c => <Chip key={c.kind} label={`${KIND_LABEL[c.kind]}: ${c.count}`} variant="outlined" />)}
      </Stack>

      {params.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Εταιρεία</TableCell>
                <TableCell>Τύπος</TableCell>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell>Κλάδος/Χρήση</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Γέφυρα</TableCell>
                <TableCell>Ισχύς</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(params.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Δεν υπάρχουν παραμετρικά στα φίλτρα. Πατήστε “Συμπλήρωση defaults”.
                  </TableCell>
                </TableRow>
              )}
              {(params.data ?? []).map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{row.insuranceCompanyName}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.insuranceCompanyCode}</Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={KIND_LABEL[row.kind]} /></TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    {row.policyType ? TYPE_LABEL[row.policyType] : "—"}
                    {row.vehicleUseCategory && <Typography variant="caption" display="block">{row.vehicleUseCategory}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{row.parentCode ?? "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {row.bridgeSystem || row.bridgeCode
                      ? <>{row.bridgeSystem ?? "—"} · <span style={{ fontFamily: "monospace" }}>{row.bridgeCode ?? "—"}</span></>
                      : "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {row.effectiveFrom ? `Από ${row.effectiveFrom}` : "Πάντα"}
                    {row.effectiveTo ? ` έως ${row.effectiveTo}` : ""}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? "Ενεργό" : "Ανενεργό"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(row)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm("Διαγραφή παραμετρικού;")) del.mutate(row.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ParameterDialog open={createOpen || !!editing} item={editing} companies={companies.data ?? []}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-company-parameters"] });
          setCreateOpen(false);
          setEditing(null);
        }} />
    </Box>
  );
}

function ParameterDialog({ open, item, companies, onClose, onSaved }: {
  open: boolean;
  item: ParameterDto | null;
  companies: CompanyDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    insuranceCompanyId: "",
    kind: "Coverage" as ParameterKind,
    code: "",
    name: "",
    policyType: "" as PolicyType | "",
    vehicleUseCategory: "" as VehicleUse | "",
    parentCode: "",
    bridgeSystem: "",
    bridgeCode: "",
    bridgeField: "",
    defaultValuesJson: "",
    effectiveFrom: "",
    effectiveTo: "",
    isActive: true,
    displayOrder: 0,
    source: "Manual",
    notes: ""
  });

  useEffect(() => {
    if (item) {
      setForm({
        insuranceCompanyId: item.insuranceCompanyId,
        kind: item.kind,
        code: item.code,
        name: item.name,
        policyType: item.policyType ?? "",
        vehicleUseCategory: item.vehicleUseCategory ?? "",
        parentCode: item.parentCode ?? "",
        bridgeSystem: item.bridgeSystem ?? "",
        bridgeCode: item.bridgeCode ?? "",
        bridgeField: item.bridgeField ?? "",
        defaultValuesJson: item.defaultValuesJson ?? "",
        effectiveFrom: item.effectiveFrom ?? "",
        effectiveTo: item.effectiveTo ?? "",
        isActive: item.isActive,
        displayOrder: item.displayOrder,
        source: item.source,
        notes: item.notes ?? ""
      });
    } else if (open) {
      setForm({
        insuranceCompanyId: companies[0]?.id ?? "",
        kind: "Coverage",
        code: "",
        name: "",
        policyType: "",
        vehicleUseCategory: "",
        parentCode: "",
        bridgeSystem: "",
        bridgeCode: "",
        bridgeField: "",
        defaultValuesJson: "",
        effectiveFrom: "",
        effectiveTo: "",
        isActive: true,
        displayOrder: 0,
        source: "Manual",
        notes: ""
      });
    }
  }, [item, open, companies]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        insuranceCompanyId: form.insuranceCompanyId,
        kind: form.kind,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        policyType: form.policyType || null,
        vehicleUseCategory: form.vehicleUseCategory || null,
        parentCode: form.parentCode.trim().toUpperCase() || null,
        bridgeSystem: form.bridgeSystem.trim().toUpperCase() || null,
        bridgeCode: form.bridgeCode.trim() || null,
        bridgeField: form.bridgeField.trim() || null,
        defaultValuesJson: form.defaultValuesJson.trim() || null,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder) || 0,
        source: form.source.trim() || "Manual",
        notes: form.notes.trim() || null
      };
      if (item) return (await api.put(`/platform/company-parameters/${item.id}`, body)).data;
      return (await api.post("/platform/company-parameters", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>{item ? "Επεξεργασία παραμετρικού" : "Νέο παραμετρικό εταιρείας"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField select label="Ασφαλιστική εταιρεία *" value={form.insuranceCompanyId}
            onChange={(e) => setForm({ ...form, insuranceCompanyId: e.target.value })} required fullWidth>
            {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name} · {c.code}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Τύπος *" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as ParameterKind })} fullWidth>
              {KINDS.map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
            </TextField>
            <TextField label="Κωδικός *" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required fullWidth placeholder="MTPL, AUTO_BASIC, ERGO_NEW" />
          </Stack>
          <TextField label="Όνομα *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Κλάδος" value={form.policyType}
              onChange={(e) => setForm({ ...form, policyType: e.target.value as PolicyType | "" })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {POLICY_TYPES.map(p => <MenuItem key={p} value={p}>{TYPE_LABEL[p]}</MenuItem>)}
            </TextField>
            <TextField select label="Χρήση" value={form.vehicleUseCategory}
              onChange={(e) => setForm({ ...form, vehicleUseCategory: e.target.value as VehicleUse | "" })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {VEHICLE_USES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Parent code" value={form.parentCode}
            onChange={(e) => setForm({ ...form, parentCode: e.target.value.toUpperCase() })}
            fullWidth placeholder="AUTO, HOME, AUTO_BASIC" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Σύστημα γέφυρας" value={form.bridgeSystem}
              onChange={(e) => setForm({ ...form, bridgeSystem: e.target.value.toUpperCase() })}
              fullWidth placeholder="ERGO, BLUEBYTE, ALIS" />
            <TextField label="Bridge code" value={form.bridgeCode}
              onChange={(e) => setForm({ ...form, bridgeCode: e.target.value })}
              fullWidth />
            <TextField label="Bridge field" value={form.bridgeField}
              onChange={(e) => setForm({ ...form, bridgeField: e.target.value })}
              fullWidth />
          </Stack>
          <TextField label="Προεπιλογές / parser hints JSON" value={form.defaultValuesJson}
            onChange={(e) => setForm({ ...form, defaultValuesJson: e.target.value })}
            fullWidth multiline minRows={3}
            placeholder='{"sourceOfTruth":"bridge","autoLink":true}' />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label="Ισχύει από" InputLabelProps={{ shrink: true }} value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} fullWidth />
            <TextField type="date" label="Ισχύει έως" InputLabelProps={{ shrink: true }} value={form.effectiveTo}
              onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Σειρά" value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
              fullWidth />
            <TextField label="Πηγή" value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              fullWidth />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Ενεργό" />
          </Stack>
          <TextField label="Σημειώσεις" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !form.insuranceCompanyId || !form.code || !form.name}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
