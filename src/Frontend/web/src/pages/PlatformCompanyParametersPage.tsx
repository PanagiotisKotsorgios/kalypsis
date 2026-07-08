import { useEffect, useMemo, useRef, useState } from "react";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { SearchableTextField } from "../components/SearchableTextField";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type VehicleUse = "None" | "EIX" | "EDX" | "FIX" | "FDX" | "LIX" | "LDX" | "Motorcycle" | "Agricultural" | "Construction";
type ParameterKind = "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";

interface CompanyDto {
  id: string;
  name: string;
  code: string;
  isGlobal: boolean;
  isBroker?: boolean;
  parentCompanyId?: string | null;
}

// Row shape enriched with the parent broker's name so the autocomplete can
// group subs under their broker AND surface a searchable "parent name"
// against the free-text filter.
interface CompanyOption extends CompanyDto {
  parentName?: string;
  displayName: string;   // «↳ ACCELERANT (υπό Grand Cover)» for subs, plain name for standalone
  groupLabel: string;    // "Grand Cover — subcompanies" | "Standalone carriers"
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
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!companyFilter) throw new Error("Επιλέξτε ασφαλιστική εταιρία πρώτα.");
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ inserted: number; skipped: number; warnings: string[] }>(
        `/platform/company-parameters/import/${companyFilter}`, fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data;
    },
    onSuccess: (r) => {
      setImporting(false);
      setSuccess(`Προστέθηκαν ${r.inserted} εγγραφές (${r.skipped} παραλείφθηκαν ως διπλές).`);
      void qc.invalidateQueries({ queryKey: ["platform-company-parameters"] });
    },
    onError: (e) => { setImporting(false); setErr(extractErrorMessage(e)); }
  });

  const companies = useQuery({
    queryKey: ["platform-company-parameter-companies"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data.filter(c => c.isGlobal)
  });

  // Options list for the pickers — brokers get their own group, subs are
  // indented and carry their broker's name so `↳ ACCELERANT (υπό Grand Cover)`
  // shows up in every dropdown. Grouping matches how the operator scans:
  //   1. Standalone carriers (ERGO, ATLANTIC, …)
  //   2. Grand Cover — the broker itself
  //   3. Grand Cover — subcompanies, sorted alphabetically
  const companyOptions = useMemo<CompanyOption[]>(() => {
    const rows = companies.data ?? [];
    const byId = new Map(rows.map(c => [c.id, c]));
    return rows
      .map(c => {
        const parent = c.parentCompanyId ? byId.get(c.parentCompanyId) : null;
        const isSub = !!parent;
        return {
          ...c,
          parentName: parent?.name,
          displayName: isSub ? `↳ ${c.name}` : c.name,
          groupLabel: isSub
            ? `Υποεταιρίες ${parent!.name}`
            : c.isBroker
              ? "Πρακτορεία"
              : "Καθολικές εταιρίες"
        } as CompanyOption;
      })
      .sort((a, b) => {
        // Group order: standalone → brokers → subs. Within each group,
        // alphabetical by name.
        const groupRank = (o: CompanyOption) =>
          o.groupLabel.startsWith("Υποεταιρίες") ? 2 : o.isBroker ? 1 : 0;
        const g = groupRank(a) - groupRank(b);
        if (g !== 0) return g;
        return a.name.localeCompare(b.name, "el");
      });
  }, [companies.data]);

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
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImporting(true);
              importMutation.mutate(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={!companyFilter || importing}
            title={!companyFilter ? "Επιλέξτε εταιρία πρώτα" : "Ανέβασμα xlsx/csv με κλάδους, χρήσεις, καλύψεις και πακέτα"}
            onClick={() => importFileInputRef.current?.click()}
          >
            {importing ? <CircularProgress size={18} /> : "Εισαγωγή xlsx/csv"}
          </Button>
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

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" alignItems={{ md: "center" }} useFlexGap>
          <Autocomplete
            size="small"
            sx={{ minWidth: 260 }}
            options={companyOptions}
            groupBy={(o) => o.groupLabel}
            getOptionLabel={(o) => o.displayName}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={companyOptions.find(o => o.id === companyFilter) ?? null}
            onChange={(_, v) => setCompanyFilter(v?.id ?? "")}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter(o =>
                o.name.toLowerCase().includes(q)
                || o.code.toLowerCase().includes(q)
                || (o.parentName ?? "").toLowerCase().includes(q)
              );
            }}
            renderOption={(props, o) => (
              <li {...props} key={o.id} style={{ paddingLeft: o.groupLabel.startsWith("Υπο") ? 24 : 12 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
                  <Typography sx={{ flex: 1 }}>{o.displayName}</Typography>
                  <Chip size="small" variant="outlined" label={o.code} sx={{ fontFamily: "monospace", fontSize: 11 }} />
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Εταιρεία (γράψτε για αναζήτηση)" placeholder="Όλες" />}
            clearOnEscape
          />
          <FilterFieldWrap tip="Φιλτράρετε τα παραμετρικά ανά τύπο (Κλάδος, Κάλυψη, Χρήση οχήματος κ.λπ.).">
            <SearchableTextField size="small" label="Τύπος" value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ParameterKind | "")} sx={{ minWidth: 160, width: "100%" }}>
              <MenuItem value="">Όλοι</MenuItem>
              {KINDS.map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <TextField size="small" label="Αναζήτηση" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            placeholder="κωδικός, όνομα, bridge code"
            InputProps={{
              endAdornment: <FilterHelp title="Αναζήτηση σε κωδικό, όνομα ή bridge code του παραμετρικού." />
            }} />
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

      <ParameterDialog open={createOpen || !!editing} item={editing}
        companies={companies.data ?? []} companyOptions={companyOptions}
        defaultCompanyId={companyFilter || null}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-company-parameters"] });
          setCreateOpen(false);
          setEditing(null);
        }} />
    </Box>
  );
}

function ParameterDialog({ open, item, companies, companyOptions, defaultCompanyId, onClose, onSaved }: {
  open: boolean;
  item: ParameterDto | null;
  companies: CompanyDto[];
  companyOptions: CompanyOption[];
  defaultCompanyId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
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
        // Prefill the carrier — priority: existing selection > filter > first
        // company in list. Saves the operator from re-picking after every
        // "New entry" while working on a single carrier's catalogue.
        insuranceCompanyId: defaultCompanyId || companies[0]?.id || "",
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
  }, [item, open, companies, defaultCompanyId]);

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
          <Autocomplete
            options={companyOptions}
            groupBy={(o) => o.groupLabel}
            getOptionLabel={(o) => `${o.displayName} · ${o.code}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={companyOptions.find(o => o.id === form.insuranceCompanyId) ?? null}
            onChange={(_, v) => setForm({ ...form, insuranceCompanyId: v?.id ?? "" })}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter(o =>
                o.name.toLowerCase().includes(q)
                || o.code.toLowerCase().includes(q)
                || (o.parentName ?? "").toLowerCase().includes(q)
              );
            }}
            renderOption={(props, o) => (
              <li {...props} key={o.id} style={{ paddingLeft: o.groupLabel.startsWith("Υπο") ? 24 : 12 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
                  <Typography sx={{ flex: 1 }}>{o.displayName}</Typography>
                  <Chip size="small" variant="outlined" label={o.code} sx={{ fontFamily: "monospace", fontSize: 11 }} />
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Ασφαλιστική εταιρεία *"
                helperText={form.insuranceCompanyId
                  ? (companyOptions.find(o => o.id === form.insuranceCompanyId)?.parentName
                      ? `Υπό: ${companyOptions.find(o => o.id === form.insuranceCompanyId)!.parentName}`
                      : undefined)
                  : "Γράψτε όνομα, κωδικό ή πρακτορείο για γρήγορη εύρεση"} />
            )}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Τύπος *" value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as ParameterKind })} fullWidth>
              {KINDS.map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
            </SearchableTextField>
            <TextField label="Κωδικός *" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required fullWidth placeholder="MTPL, AUTO_BASIC, ERGO_NEW" />
          </Stack>
          <TextField label="Όνομα *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Κλάδος" value={form.policyType}
              onChange={(e) => setForm({ ...form, policyType: e.target.value as PolicyType | "" })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {POLICY_TYPES.map(p => <MenuItem key={p} value={p}>{TYPE_LABEL[p]}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label="Χρήση" value={form.vehicleUseCategory}
              onChange={(e) => setForm({ ...form, vehicleUseCategory: e.target.value as VehicleUse | "" })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {VEHICLE_USES.map(u => <MenuItem key={u} value={u}>{String(t(`vehicleUse.${u}`, u))}</MenuItem>)}
            </SearchableTextField>
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
