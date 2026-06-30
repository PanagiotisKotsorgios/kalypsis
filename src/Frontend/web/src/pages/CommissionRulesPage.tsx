import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import RuleIcon from "@mui/icons-material/Rule";
import TuneIcon from "@mui/icons-material/Tune";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { NumberedPager } from "../components/TableToolbar";
import { DataExportButton } from "../components/DataExportButton";
import { BulkCommissionsPage } from "./BulkCommissionsPage";
import { DefaultValueRulesPage } from "./DefaultValueRulesPage";
import { CompanyCatalogueDialog } from "../components/CompanyCatalogueDialog";
import SettingsIcon from "@mui/icons-material/Settings";
import { useCarrierCatalogue } from "../hooks/useCarrierCatalogue";

type ProducerTier = "None" | "A" | "B" | "C" | "D" | "E";
type PolicyType   = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type VehicleUse   = "None" | "EIX" | "EDX" | "FIX" | "FDX" | "LIX" | "LDX" | "Motorcycle" | "Agricultural" | "Construction";

interface CommissionRuleDto {
  id: string;
  producerId: string | null; producerName: string | null;
  producerTier: ProducerTier | null;
  insuranceCompanyId: string | null; insuranceCompanyName: string | null;
  policyType: PolicyType | null;
  vehicleUseCategory: VehicleUse | null;
  coverCode: string | null;
  agencyPercent: number | null;
  producerPercent: number | null;
  legacyValue: number | null;
  effectiveFrom: string; effectiveTo: string | null;
}

const USE_LABEL: Record<VehicleUse, string> = {
  None: "—",
  EIX: "ΕΙΧ — Επιβατικό Ι.Χ.",
  EDX: "ΕΔΧ — Ταξί / Δημ.Χρ.",
  FIX: "ΦΙΧ — Φορτηγό Ι.Χ.",
  FDX: "ΦΔΧ — Φορτηγό Δ.Χ.",
  LIX: "ΛΙΧ — Λεωφορείο Ι.Χ.",
  LDX: "ΛΔΧ — Λεωφορείο Δ.Χ.",
  Motorcycle: "ΜΟΤ — Μοτοσικλέτα",
  Agricultural: "ΑΓΡ — Αγροτικό",
  Construction: "ΕΡΓ — Εργοταξιακό"
};

interface CompanyLite {
  id: string;
  name: string;
  code?: string;
  isBroker?: boolean;
  parentCompanyId?: string | null;
}
interface ProducerLite { id: string; name: string; tier?: ProducerTier; }
type ParameterKind = "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";
interface CompanyParameterItem {
  id: string;
  kind: ParameterKind;
  code: string;
  name: string;
  policyType: PolicyType | null;
  vehicleUseCategory: VehicleUse | null;
  parentCode: string | null;
}

/** A branch option displayed in the Κλάδοι dropdown. When a carrier is
 *  selected, options come from its CompanyParameterItem catalogue and show
 *  the carrier-specific branch NAME (e.g. ΧΕΡΣΑΙΩΝ ΟΧΗΜΑΤΩΝ). When no
 *  carrier is selected, options fall back to the seven PolicyType enums. */
type BranchOption = {
  key: string;              // unique selection key
  code: string;             // carrier-specific code OR enum value
  label: string;            // display name
  policyType: PolicyType;   // derived enum for rule storage
  source: "param" | "enum";
};
type UseOption = {
  key: string;
  code: string;
  label: string;
  vehicleUseCategory: VehicleUse;
  policyType: PolicyType | null;
  source: "param" | "enum";
};

const TIER_LABEL: Record<ProducerTier, string> = {
  A: "Κατ. Α", B: "Κατ. Β", C: "Κατ. Γ", D: "Κατ. Δ", E: "Κατ. Ε", None: "—"
};
const TIER_COLOR: Record<ProducerTier, "default" | "warning" | "primary" | "info" | "success"> = {
  A: "warning", B: "primary", C: "info", D: "success", E: "default", None: "default"
};
const TYPE_LABEL: Record<PolicyType, string> = {
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγείας", Life: "Ζωής",
  Business: "Επιχείρησης", Travel: "Ταξιδιού", Other: "Άλλο"
};

/** Plain-text description of the rule scope — broader scopes read first. */
function describeScope(r: CommissionRuleDto): string {
  const parts: string[] = [];
  parts.push(r.insuranceCompanyName ?? "όλες τις εταιρίες");
  parts.push(r.policyType ? TYPE_LABEL[r.policyType] : "όλους τους κλάδους");
  if (r.coverCode) parts.push(`κάλυψη ${r.coverCode}`);
  if (r.vehicleUseCategory && r.vehicleUseCategory !== "None")
    parts.push(`χρήση ${r.vehicleUseCategory}`);
  if (r.producerName)        parts.push(`συνεργάτη «${r.producerName}»`);
  else if (r.producerTier && r.producerTier !== "None") parts.push(`κατηγορία ${r.producerTier}`);
  else                       parts.push("όλους τους συνεργάτες");
  return parts.join(" · ");
}

function isZeroCommissionRule(r: CommissionRuleDto): boolean {
  return (r.agencyPercent ?? 0) === 0
    && (r.producerPercent ?? r.legacyValue ?? 0) === 0;
}

export function CommissionRulesPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRuleDto | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [subCarrierFilter, setSubCarrierFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter]       = useState<ProducerTier | "">("");
  const [typeFilter, setTypeFilter]       = useState<PolicyType | "">("");
  const [useFilter,  setUseFilter]        = useState<VehicleUse  | "">("");
  const [coverFilter, setCoverFilter]     = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Carrier-driven filter options — empty when no carrier picked.
  const filterCatalogue = useCarrierCatalogue(carrierFilter, subCarrierFilter);

  const q = useQuery({
    queryKey: ["commission-rules"],
    queryFn: async () => (await api.get<CommissionRuleDto[]>("/commission-rules")).data
  });
  const companies = useQuery({
    queryKey: ["insurance-companies-lite-rules"],
    queryFn: async () => (await api.get<CompanyLite[]>("/insurance-companies")).data
  });
  const producers = useQuery({
    queryKey: ["producers-lite-rules"],
    queryFn: async () => (await api.get<ProducerLite[]>("/producers")).data
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/commission-rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["commission-rules"] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });
  const seedZero = useMutation({
    mutationFn: async () => (await api.post<{ companiesProcessed: number; rulesCreated: number }>(
      "/commission-rules/seed-zero-defaults",
      { insuranceCompanyId: carrierFilter || null }
    )).data,
    onSuccess: (res) => {
      setSuccess(`Δημιουργήθηκαν ${res.rulesCreated} μηδενικοί κανόνες για ${res.companiesProcessed} εταιρείες.`);
      void qc.invalidateQueries({ queryKey: ["commission-rules"] });
      void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const rawRows = q.data ?? [];
  const seededZeroCount = useMemo(() => rawRows.filter(isZeroCommissionRule).length, [rawRows]);
  const visibleRows = useMemo(
    () => rawRows.filter(r => !isZeroCommissionRule(r)),
    [rawRows]
  );
  const filtered = useMemo(() => visibleRows.filter(r => {
    if (carrierFilter && r.insuranceCompanyId !== carrierFilter) return false;
    if (tierFilter && r.producerTier !== tierFilter) return false;
    if (typeFilter && r.policyType !== typeFilter) return false;
    if (useFilter && r.vehicleUseCategory !== useFilter) return false;
    if (coverFilter && !(r.coverCode ?? "").toLowerCase().includes(coverFilter.trim().toLowerCase())) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${r.producerName ?? ""} ${r.insuranceCompanyName ?? ""} ${r.policyType ?? ""} ${r.producerTier ?? ""} ${r.vehicleUseCategory ?? ""} ${r.coverCode ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [visibleRows, carrierFilter, tierFilter, typeFilter, useFilter, coverFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <RuleIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Παραμετροποίηση προμηθειών</Typography>
              <HelpHint title="Πώς λειτουργούν οι κανόνες"
                body="Ορίστε μία προμήθεια ανά συνδυασμό (εταιρία × κλάδος × κατηγορία συνεργάτη). Αν αφήσετε κάποιο πεδίο κενό, ο κανόνας ισχύει για όλες τις τιμές αυτής της διάστασης. Όταν δύο κανόνες ταιριάζουν, υπερισχύει ο πιο συγκεκριμένος. Η προμήθεια έδρας που έρχεται από γέφυρα δεν αλλάζει — μόνο η προμήθεια συνεργάτη προ-υπολογίζεται από εδώ." />
            </Stack>
            <Typography color="text.secondary">
              Ενιαία οθόνη για προμήθειες γραφείου και συνεργατών: κανόνες ένας-ένας, μηδενική αρχικοποίηση και μαζική επεξεργασία συμβολαίων.
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            size="large"
            onClick={() => setDefaultsOpen(true)}
          >
            Προεπιλογές συμβολαίων
          </Button>
          <Button
            startIcon={<TuneIcon />}
            variant="outlined"
            size="large"
            onClick={() => setBulkOpen(true)}
          >
            Μαζική επεξεργασία
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => seedZero.mutate()}
            disabled={seedZero.isPending}
          >
            {seedZero.isPending ? <CircularProgress size={18} /> : "Μηδενικοί κανόνες"}
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={() => setCreateOpen(true)}>
          Νέος κανόνας γραφείου/συνεργάτη
          </Button>
          <DataExportButton entity="commission-rules" />
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>
        Η παραμετροποίηση είναι πλέον σε ένα σημείο. Οι κανόνες προμηθειών αφορούν πληρωμές γραφείου/συνεργατών. Οι «Προεπιλογές συμβολαίων» αφορούν μόνο αυτόματη συμπλήρωση πεδίων όταν καταχωρείται χειροκίνητα νέο συμβόλαιο.
      </Alert>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" placeholder="Συνεργάτης, εταιρία, κλάδος…"
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Εταιρία" value={carrierFilter}
            onChange={(e) => { setCarrierFilter(e.target.value); setSubCarrierFilter([]); setTypeFilter(""); setUseFilter(""); }}
            sx={{ minWidth: 220 }}>
            <MenuItem value="">Όλες</MenuItem>
            {(companies.data ?? []).filter(c => !c.parentCompanyId).flatMap(c => {
              const subs = (companies.data ?? []).filter(s => s.parentCompanyId === c.id);
              const head = (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}{c.isBroker ? " · πρακτορείο" : ""}
                </MenuItem>
              );
              return subs.length === 0 ? [head] : [head, ...subs.map(s => (
                <MenuItem key={s.id} value={s.id} sx={{ pl: 4, fontSize: 14, color: "text.secondary" }}>
                  ↳ {s.name}
                </MenuItem>
              ))];
            })}
          </TextField>
          {(() => {
            const selected = (companies.data ?? []).find(c => c.id === carrierFilter);
            if (!selected?.isBroker) return null;
            const subs = (companies.data ?? []).filter(c => c.parentCompanyId === selected.id);
            return (
              <Autocomplete<CompanyLite, true>
                multiple size="small" sx={{ minWidth: 260 }}
                options={subs}
                value={subs.filter(s => subCarrierFilter.includes(s.id))}
                onChange={(_, value) => setSubCarrierFilter(value.map(v => v.id))}
                getOptionLabel={(s) => s.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Υποασφαλιστικές" />}
              />
            );
          })()}
          <TextField select size="small" label="Κλάδος" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PolicyType | "")} sx={{ minWidth: 200 }}
            disabled={!carrierFilter}
            helperText={!carrierFilter
              ? "Επιλέξτε εταιρία"
              : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}>
            <MenuItem value="">Όλοι</MenuItem>
            {filterCatalogue.branches.map(b => (
              <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Κατηγορία" value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as ProducerTier | "")} sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλες</MenuItem>
            {(["A","B","C","D","E"] as const).map(t => <MenuItem key={t} value={t}>{TIER_LABEL[t]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Χρήση" value={useFilter}
            onChange={(e) => setUseFilter(e.target.value as VehicleUse | "")} sx={{ minWidth: 220 }}
            disabled={!carrierFilter}
            helperText={!carrierFilter
              ? "Επιλέξτε εταιρία"
              : filterCatalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}>
            <MenuItem value="">Όλες</MenuItem>
            {filterCatalogue.uses.map(u => (
              <MenuItem key={u.key} value={u.value}>{u.label}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Κάλυψη" value={coverFilter}
            onChange={(e) => setCoverFilter(e.target.value.toUpperCase())}
            sx={{ minWidth: 150 }} placeholder="MTPL" />
          <Button size="small" onClick={() => {
            setSearch(""); setCarrierFilter(""); setSubCarrierFilter([]); setTierFilter(""); setTypeFilter(""); setUseFilter(""); setCoverFilter("");
          }}>Καθαρισμός</Button>
          {seededZeroCount > 0 && (
            <Chip size="small" variant="outlined" label={`${seededZeroCount} μηδενικοί κανόνες κρυφοί`} />
          )}
        </Stack>
      </Card>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Εταιρία</TableCell>
              <TableCell>Κλάδος</TableCell>
              <TableCell>Χρήση</TableCell>
              <TableCell>Στόχος</TableCell>
              <TableCell align="right">Προμ. Έδρας %</TableCell>
              <TableCell align="right">Προμ. Συνεργάτη %</TableCell>
              <TableCell>Ισχύς</TableCell>
              <TableCell>Κάλυψη</TableCell>
              <TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  {seededZeroCount > 0
                    ? "Δεν υπάρχουν ενεργοί/χειροκίνητοι κανόνες στα φίλτρα. Οι μηδενικοί κανόνες ασφαλείας είναι κρυφοί."
                    : "Δεν έχουν οριστεί κανόνες — δημιουργήστε τον πρώτο για να αρχίσει η αυτόματη ανάθεση προμηθειών."}
                </TableCell></TableRow>
              )}
              {paged.map(r => (
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }}>
                  <TableCell>{r.insuranceCompanyName ?? <Chip size="small" label="Όλες" variant="outlined" />}</TableCell>
                  <TableCell>{r.policyType ? TYPE_LABEL[r.policyType] : <Chip size="small" label="Όλοι" variant="outlined" />}</TableCell>
                  <TableCell>
                    {r.vehicleUseCategory && r.vehicleUseCategory !== "None"
                      ? <Chip size="small" label={r.vehicleUseCategory} sx={{ fontWeight: 700 }} />
                      : <Chip size="small" label="Όλες" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    {r.producerName
                      ? <Chip size="small" variant="outlined" label={`Συνεργάτης: ${r.producerName}`} />
                      : r.producerTier && r.producerTier !== "None"
                        ? <Chip size="small" color={TIER_COLOR[r.producerTier]} label={TIER_LABEL[r.producerTier]} sx={{ fontWeight: 700 }} />
                        : <Chip size="small" label="Όλοι οι συνεργάτες" variant="outlined" />}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {r.agencyPercent !== null ? `${r.agencyPercent.toFixed(2)}%` : "—"}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                    {r.producerPercent !== null
                      ? `${r.producerPercent.toFixed(2)}%`
                      : r.legacyValue !== null ? `${r.legacyValue.toFixed(2)}% (legacy)` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {r.effectiveTo ? `${r.effectiveFrom} έως ${r.effectiveTo}` : `Από ${r.effectiveFrom}`}
                  </TableCell>
                  <TableCell>
                    {r.coverCode
                      ? <Chip size="small" label={r.coverCode} sx={{ fontWeight: 700 }} />
                      : <Chip size="small" label="Όλες" variant="outlined" />}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm(`Διαγραφή κανόνα;\n${describeScope(r)}`)) del.mutate(r.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
            <NumberedPager page={page} totalPages={totalPages} onPage={setPage} />
          </Box>
        </Card>
      )}

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle sx={{ fontWeight: 800 }}>Μαζική επεξεργασία προμηθειών</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "background.default", p: { xs: 1.5, md: 3 } }}>
          <BulkCommissionsPage embedded />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={defaultsOpen} onClose={() => setDefaultsOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle sx={{ fontWeight: 800 }}>Προεπιλογές συμβολαίων</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "background.default", p: { xs: 1.5, md: 3 } }}>
          <DefaultValueRulesPage embedded />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDefaultsOpen(false)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>

      <RuleDialog open={createOpen || !!editing} rule={editing}
        companies={companies.data ?? []} producers={producers.data ?? []}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["commission-rules"] });
          setCreateOpen(false); setEditing(null);
        }} />
    </Box>
  );
}

function RuleDialog({ open, rule, companies, producers, onClose, onSaved }: {
  open: boolean; rule: CommissionRuleDto | null;
  companies: CompanyLite[]; producers: ProducerLite[];
  onClose: () => void; onSaved: () => void;
}) {
  const editing = !!rule;
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    scope: "tier" as "tier" | "producer" | "all",
    insuranceCompanyId: "",
    subCompanyIds: [] as string[],   // for broker cascade
    branches: [] as BranchOption[],
    uses: [] as UseOption[],
    coverCodes: [] as string[],
    producerId: "",
    producerTier: "None" as ProducerTier,
    agencyPercent: 0,
    producerPercent: 15,
    effectiveFrom: today,
    effectiveTo: ""
  });
  const [manualCode, setManualCode] = useState("");
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Primary carrier parametrics — broker or standalone carrier.
  const parameters = useQuery({
    queryKey: ["company-parameters-for-commissions", form.insuranceCompanyId],
    queryFn: async () => (await api.get<CompanyParameterItem[]>("/company-parameters", {
      params: form.insuranceCompanyId ? { insuranceCompanyId: form.insuranceCompanyId } : {}
    })).data,
    enabled: open
  });

  // Subcompany parametrics, only when a broker is selected. Each subcompany's
  // packages are merged into the dropdowns alongside the broker's branches/uses.
  const subParametersQueries = useQueries({
    queries: form.subCompanyIds.map((id) => ({
      queryKey: ["company-parameters-for-commissions", id],
      queryFn: async () => (await api.get<CompanyParameterItem[]>("/company-parameters", {
        params: { insuranceCompanyId: id }
      })).data,
      enabled: open && form.subCompanyIds.length > 0
    }))
  });

  const mergedParams = useMemo(() => {
    const broker = parameters.data ?? [];
    const subs = subParametersQueries.flatMap(q => q.data ?? []);
    return [...broker, ...subs];
  }, [parameters.data, subParametersQueries.map(q => q.data).join(",")]);

  // Dynamic-only: when a company IS selected, dropdowns show the actual
  // carrier-specific branch NAMES from CompanyParameterItem rows (e.g. for
  // Grand Cover: ΧΕΡΣΑΙΩΝ ΟΧΗΜΑΤΩΝ, ΖΩΗΣ-ΥΓΕΙΑΣ, …). When no carrier is
  // selected, fall back to the seven PolicyType enums so an agency-wide rule
  // can still be made.
  // Strict: only show real παραμετρικά. Never fall back to the PolicyType
  // enum — if the carrier has no Branch items, the dropdown is empty and
  // the helper text tells the user to add them first.
  const branchOptions = useMemo<BranchOption[]>(() => {
    if (!form.insuranceCompanyId) return [];
    return mergedParams
      .filter(p => p.kind === "Branch")
      .map(p => ({
        key: `param:${p.id}`,
        code: p.code,
        label: p.policyType
          ? `${p.name} · ${TYPE_LABEL[p.policyType]}`
          : p.name,
        policyType: p.policyType ?? "Other",
        source: "param" as const,
      }));
  }, [mergedParams, form.insuranceCompanyId]);

  // PolicyType set covered by the user's branch selection — used downstream
  // for coverages/uses filtering and for the saved rule's enum field.
  const selectedPolicyTypes = useMemo<PolicyType[]>(() => {
    const set = new Set<PolicyType>();
    for (const b of form.branches) set.add(b.policyType);
    return Array.from(set);
  }, [form.branches]);

  const selectedBranchCodes = useMemo<string[]>(
    () => form.branches.filter(b => b.source === "param").map(b => b.code),
    [form.branches]
  );

  // Strict: only show real παραμετρικά. No enum fallback.
  const useOptions = useMemo<UseOption[]>(() => {
    if (!form.insuranceCompanyId) return [];
    return mergedParams
      .filter(p => p.kind === "Use" && p.vehicleUseCategory && p.vehicleUseCategory !== "None")
      .filter(p =>
        selectedBranchCodes.length === 0
        || !p.parentCode
        || selectedBranchCodes.includes(p.parentCode)
      )
      .map(p => ({
        key: `param:${p.id}`,
        code: p.code,
        label: `${p.name}${p.vehicleUseCategory && p.vehicleUseCategory !== "None" ? ` · ${p.vehicleUseCategory}` : ""}`,
        vehicleUseCategory: p.vehicleUseCategory ?? "None",
        policyType: p.policyType,
        source: "param" as const,
      }));
  }, [mergedParams, form.insuranceCompanyId, selectedBranchCodes]);

  const codeOptions = useMemo(() => {
    const fromParams = mergedParams
      .filter(p => (p.kind === "Coverage" || p.kind === "Package") && p.code)
      // Narrow by selected branches via parentCode if any are picked; also
      // narrow by selected PolicyTypes for the enum-fallback case.
      .filter(p => {
        if (selectedBranchCodes.length > 0) {
          // Carrier-specific: branch's children link by parentCode.
          if (p.parentCode && selectedBranchCodes.includes(p.parentCode)) return true;
          // Or fall back to policyType match for items without parentCode.
          if (!p.parentCode && (selectedPolicyTypes.length === 0 || !p.policyType || selectedPolicyTypes.includes(p.policyType))) return true;
          return false;
        }
        return selectedPolicyTypes.length === 0 || !p.policyType || selectedPolicyTypes.includes(p.policyType);
      })
      .map(p => ({
        code: p.code,
        label: `${p.name} (${p.code})`,
        kind: p.kind,
        policyType: p.policyType
      }));
    const byCode = new Map<string, typeof fromParams[number]>();
    for (const item of fromParams) byCode.set(item.code, item);
    for (const code of form.coverCodes) if (!byCode.has(code)) byCode.set(code, { code, label: code, kind: "Coverage", policyType: null });
    return Array.from(byCode.values());
  }, [mergedParams, selectedPolicyTypes, selectedBranchCodes, form.coverCodes]);

  useEffect(() => {
    if (rule) {
      const pt = rule.policyType;
      const vu = rule.vehicleUseCategory;
      setForm({
        scope: rule.producerId ? "producer" : (rule.producerTier && rule.producerTier !== "None") ? "tier" : "all",
        insuranceCompanyId: rule.insuranceCompanyId ?? "",
        subCompanyIds: [],
        branches: pt ? [{
          key: `enum:${pt}`, code: pt, label: TYPE_LABEL[pt], policyType: pt, source: "enum" as const,
        }] : [],
        uses: vu && vu !== "None" ? [{
          key: `enum:${vu}`, code: vu, label: USE_LABEL[vu], vehicleUseCategory: vu, policyType: "Auto" as PolicyType, source: "enum" as const,
        }] : [],
        coverCodes: rule.coverCode ? [rule.coverCode] : [],
        producerId: rule.producerId ?? "",
        producerTier: rule.producerTier ?? "None",
        agencyPercent: rule.agencyPercent ?? 0,
        producerPercent: rule.producerPercent ?? rule.legacyValue ?? 15,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo ?? ""
      });
    } else if (open) {
      setForm({
        scope: "tier",
        insuranceCompanyId: "",
        subCompanyIds: [],
        branches: [],
        uses: [],
        coverCodes: [],
        producerId: "",
        producerTier: "None",
        agencyPercent: 0,
        producerPercent: 15,
        effectiveFrom: today,
        effectiveTo: ""
      });
      setManualCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, open]);

  const selectedUseCategories = useMemo<VehicleUse[]>(() => {
    const set = new Set<VehicleUse>();
    for (const u of form.uses) if (u.vehicleUseCategory !== "None") set.add(u.vehicleUseCategory);
    return Array.from(set);
  }, [form.uses]);

  const combos = useMemo(() => {
    const policies = selectedPolicyTypes.length > 0 ? selectedPolicyTypes : [null];
    const covers = form.coverCodes.length > 0 ? form.coverCodes : [null];
    return policies.reduce((sum, p) => {
      const uses = p === "Auto" && selectedUseCategories.length > 0 ? selectedUseCategories : [null];
      return sum + uses.length * covers.length;
    }, 0);
  }, [selectedPolicyTypes, selectedUseCategories, form.coverCodes]);

  const addManualCode = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code || form.coverCodes.includes(code)) return;
    setForm({ ...form, coverCodes: [...form.coverCodes, code] });
    setManualCode("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const singleBody = {
        producerId: form.scope === "producer" ? (form.producerId || null) : null,
        producerTier: form.scope === "tier" && form.producerTier !== "None" ? form.producerTier : null,
        insuranceCompanyId: form.insuranceCompanyId || null,
        policyType: selectedPolicyTypes[0] || null,
        vehicleUseCategory: selectedUseCategories[0] || null,
        coverCode: form.coverCodes[0] || null,
        agencyPercent: Number.isFinite(form.agencyPercent) ? Number(form.agencyPercent) : null,
        producerPercent: Number.isFinite(form.producerPercent) ? Number(form.producerPercent) : null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null
      };

      if (editing && combos <= 1) {
        return (await api.put<CommissionRuleDto>(`/commission-rules/${rule!.id}`, singleBody)).data;
      }

      return (await api.post("/commission-rules/batch", {
        producerId: singleBody.producerId,
        producerTier: singleBody.producerTier,
        insuranceCompanyId: singleBody.insuranceCompanyId,
        policyTypes: selectedPolicyTypes,
        vehicleUseCategories: selectedUseCategories,
        coverCodes: form.coverCodes,
        agencyPercent: singleBody.agencyPercent,
        producerPercent: singleBody.producerPercent,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        replaceExisting: true
      })).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const saveLabel = editing && combos <= 1
    ? "Αποθήκευση"
    : `Αποθήκευση ${combos} κανόν${combos === 1 ? "α" : "ων"}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{editing ? "Επεξεργασία κανόνα προμήθειας" : "Γρήγορη παραμετροποίηση προμηθειών"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Alert severity="info" sx={{ mb: 2 }}>
          Βάζετε μία φορά την προμήθεια έδρας και συνεργάτη και επιλέγετε πολλούς κλάδους, χρήσεις,
          καλύψεις ή πακέτα. Η αποθήκευση δημιουργεί/ενημερώνει όλους τους αντίστοιχους κανόνες χωρίς διπλές εγγραφές.
        </Alert>
        {editing && combos > 1 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Επιλέξατε πολλαπλούς συνδυασμούς ενώ επεξεργάζεστε υπάρχοντα κανόνα. Θα γίνει μαζική ενημέρωση/δημιουργία,
            όχι διαγραφή παλιών συνδυασμών που δεν επιλέχθηκαν.
          </Alert>
        )}

        <Stack spacing={2.5} mt={1}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField select label="Ασφαλιστική εταιρία" value={form.insuranceCompanyId}
              onChange={e => setForm({
                ...form,
                insuranceCompanyId: e.target.value,
                subCompanyIds: [],
                branches: [],
                uses: [],
                coverCodes: [],
              })} fullWidth>
              <MenuItem value="">— Όλες οι εταιρίες —</MenuItem>
              {/* Hide subcompanies from the primary picker — they appear via the
                  broker cascade below. Top-level carriers + brokers only. */}
              {companies.filter(c => !c.parentCompanyId).map(c =>
                <MenuItem key={c.id} value={c.id}>
                  {c.name}{c.isBroker ? " · πρακτορείο" : ""}
                </MenuItem>)}
            </TextField>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<SettingsIcon />}
              disabled={!form.insuranceCompanyId}
              onClick={() => setCatalogueOpen(true)}
              sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
              title="Επεξεργασία καλύψεων / πακέτων / χρήσεων αυτής της εταιρίας"
            >
              Παραμετρικά
            </Button>
          </Stack>

          {/* Broker cascade: when a broker (πρακτορείο) is picked, let the user
              choose one or many of its subcompanies. Each subcompany's own
              catalogue then drives the κλάδοι/χρήσεις/καλύψεις dropdowns. */}
          {(() => {
            const selected = companies.find(c => c.id === form.insuranceCompanyId);
            if (!selected?.isBroker) return null;
            const subs = companies.filter(c => c.parentCompanyId === selected.id);
            if (subs.length === 0) return (
              <Alert severity="info" variant="outlined">
                Δεν έχουν περαστεί ακόμη υποασφαλιστικές για το {selected.name}.
              </Alert>
            );
            return (
              <Autocomplete
                multiple
                options={subs}
                value={subs.filter(s => (form as any).subCompanyIds?.includes(s.id))}
                onChange={(_, value) => setForm({ ...(form as any), subCompanyIds: value.map(v => v.id) })}
                getOptionLabel={(s) => s.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => <Chip label={option.name} {...getTagProps({ index })} key={option.id} />)
                }
                renderInput={(params) => (
                  <TextField {...params} label="Υποασφαλιστικές πρακτορείου"
                    helperText={`Επιλέξτε μία ή περισσότερες από τις ${subs.length} υποασφαλιστικές του ${selected.name}.`} />
                )}
              />
            );
          })()}

          <CompanyCatalogueDialog
            open={catalogueOpen}
            onClose={() => setCatalogueOpen(false)}
            insuranceCompanyId={form.insuranceCompanyId || null}
            insuranceCompanyName={companies.find(c => c.id === form.insuranceCompanyId)?.name}
          />

          <Autocomplete
            multiple
            options={branchOptions}
            value={form.branches}
            onChange={(_, value) => {
              // If selected branches no longer cover Auto, clear uses.
              const stillHasAuto = value.some(b => b.policyType === "Auto");
              setForm({
                ...form,
                branches: value,
                uses: stillHasAuto ? form.uses : [],
              });
            }}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.key === b.key}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => <Chip label={option.label} {...getTagProps({ index })} key={option.key} />)
            }
            renderInput={(params) => (
              <TextField {...params} label="Κλάδοι"
                helperText={!form.insuranceCompanyId
                  ? "Επιλέξτε εταιρία πρώτα — οι κλάδοι έρχονται από τα παραμετρικά της."
                  : branchOptions.length === 0
                    ? "Δεν έχουν περαστεί παραμετρικά για αυτή την εταιρία."
                    : "Κλάδοι από τα παραμετρικά. Επιλέξτε πολλούς για ίδια προμήθεια."} />
            )}
          />

          <Autocomplete
            multiple
            options={useOptions}
            value={form.uses}
            disabled={selectedPolicyTypes.length > 0 && !selectedPolicyTypes.includes("Auto")}
            onChange={(_, value) => setForm({ ...form, uses: value })}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.key === b.key}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => <Chip label={option.label} {...getTagProps({ index })} key={option.key} />)
            }
            renderInput={(params) => (
              <TextField {...params} label="Χρήσεις οχήματος"
                helperText={!form.insuranceCompanyId
                  ? "Επιλέξτε εταιρία πρώτα."
                  : useOptions.length === 0
                    ? "Δεν έχουν περαστεί χρήσεις για αυτή την εταιρία."
                    : "Χρήσεις από τα παραμετρικά. Φιλτράρονται από τους επιλεγμένους κλάδους."} />
            )}
          />

          <Autocomplete
            multiple
            options={codeOptions}
            value={codeOptions.filter(o => form.coverCodes.includes(o.code))}
            onChange={(_, value) => setForm({ ...form, coverCodes: value.map(v => v.code) })}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            groupBy={(option) => option.kind === "Package" ? "Πακέτα" : "Καλύψεις"}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => <Chip label={option.code} {...getTagProps({ index })} key={option.code} />)
            }
            renderInput={(params) => (
              <TextField {...params} label="Καλύψεις / πακέτα" helperText="Κενό σημαίνει όλες οι καλύψεις και πακέτα." />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Χειροκίνητος κωδικός κάλυψης/πακέτου" value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualCode(); } }}
              fullWidth placeholder="π.χ. MTPL, HOME_PLUS" />
            <Button variant="outlined" onClick={addManualCode}>Προσθήκη</Button>
          </Stack>

          <TextField select label="Στόχος προμήθειας" value={form.scope}
            onChange={e => setForm({ ...form, scope: e.target.value as "tier" | "producer" | "all" })} fullWidth>
            <MenuItem value="tier">Κατηγορία συνεργατών (Α/Β/Γ/Δ/Ε)</MenuItem>
            <MenuItem value="producer">Συγκεκριμένος συνεργάτης</MenuItem>
            <MenuItem value="all">Όλοι οι συνεργάτες</MenuItem>
          </TextField>

          {form.scope === "tier" && (
            <TextField select label="Κατηγορία συνεργάτη" value={form.producerTier}
              onChange={e => setForm({ ...form, producerTier: e.target.value as ProducerTier })} fullWidth>
              <MenuItem value="None">— Επιλέξτε κατηγορία —</MenuItem>
              {(["A","B","C","D","E"] as const).map(t => <MenuItem key={t} value={t}>{TIER_LABEL[t]}</MenuItem>)}
            </TextField>
          )}

          {form.scope === "producer" && (
            <TextField select label="Συνεργάτης" value={form.producerId}
              onChange={e => setForm({ ...form, producerId: e.target.value })} fullWidth>
              {producers.map(p =>
                <MenuItem key={p.id} value={p.id}>{p.name}{p.tier && p.tier !== "None" ? ` · ${TIER_LABEL[p.tier]}` : ""}</MenuItem>)}
            </TextField>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Προμήθεια έδρας %" value={form.agencyPercent}
              onChange={e => setForm({ ...form, agencyPercent: Number(e.target.value) })}
              inputProps={{ step: 0.1, min: 0, max: 100 }} fullWidth
              helperText="Σύγκριση/έλεγχος με γέφυρες. Η γέφυρα παραμένει source of truth." />
            <TextField type="number" label="Προμήθεια συνεργάτη %" value={form.producerPercent}
              onChange={e => setForm({ ...form, producerPercent: Number(e.target.value) })}
              inputProps={{ step: 0.1, min: 0, max: 100 }} fullWidth required
              helperText="Χρησιμοποιείται αυτόματα σε παραγωγή και εκκαθαρίσεις." />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label="Ισχύει από" InputLabelProps={{ shrink: true }} value={form.effectiveFrom}
              onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} required fullWidth />
            <TextField type="date" label="Ισχύει έως (προαιρετικό)" InputLabelProps={{ shrink: true }} value={form.effectiveTo}
              onChange={e => setForm({ ...form, effectiveTo: e.target.value })} fullWidth />
          </Stack>

          <Card variant="outlined" sx={{ p: 2, bgcolor: "rgba(11,37,69,0.03)" }}>
            <Typography fontWeight={700}>Προεπισκόπηση</Typography>
            <Typography variant="body2" color="text.secondary">
              Θα αποθηκευτούν {combos} συνδυασμοί. Υπάρχοντες ίδιοι συνδυασμοί ενημερώνονται αυτόματα.
            </Typography>
          </Card>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending
            || (!form.agencyPercent && !form.producerPercent)
            || (form.scope === "producer" && !form.producerId)
            || (form.scope === "tier" && form.producerTier === "None")}>
          {save.isPending ? <CircularProgress size={18} /> : saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
