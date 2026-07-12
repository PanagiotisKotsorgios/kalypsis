import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { SearchableSelect } from "../components/SearchableSelect";
import { InlineCreateInsuranceCompanyDialog } from "../components/InlineCreateInsuranceCompanyDialog";

type Kind = "Company" | "Branch" | "Coverage" | "Use" | "Package";

const KIND_LABELS: Record<Kind, string> = {
  Company: "Εταιρεία",
  Branch: "Κλάδος",
  Coverage: "Κάλυψη",
  Use: "Χρήση",
  Package: "Πακέτο",
};

interface Mapping {
  id: string;
  kind: Kind;
  sourceCarrier: string | null;
  rawCode: string;
  rawLabel: string | null;
  targetInsuranceCompanyId: string | null;
  targetInsuranceCompanyName: string | null;
  targetParameterItemId: string | null;
  targetParameterItemCode: string | null;
  targetParameterItemName: string | null;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface CarrierLite { id: string; name: string; code: string; isGlobal?: boolean; isUsedByTenant?: boolean; }
interface ParameterItem { id: string; kind: string; code: string; name: string; insuranceCompanyName: string; }

export function BridgeCodeMappingsPage() {
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [carrierFilter, setCarrierFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mappings = useQuery({
    queryKey: ["bridge-code-mappings", { kindFilter, carrierFilter, search }],
    queryFn: async () => (await api.get<Mapping[]>("/bridge-code-mappings", {
      params: {
        kind: kindFilter || undefined,
        sourceCarrier: carrierFilter || undefined,
        search: search || undefined,
      }
    })).data
  });

  const carriersRaw = useQuery({
    queryKey: ["insurance-companies-lite"],
    queryFn: async () => (await api.get<CarrierLite[]>("/insurance-companies", { params: { onlyUsed: false } })).data
  });
  // Only the office's own carriers are valid link targets — a Kalypsis-global
  // is never one (we'd loop right back to the "please link" gate on the
  // bridges page). Legacy globals the tenant opted into stay for backward
  // compat so historical mappings keep resolving.
  const carriers = useMemo(
    () => (carriersRaw.data ?? []).filter(c => !c.isGlobal || c.isUsedByTenant),
    [carriersRaw.data]
  );

  const distinctCarrierSources = useMemo(() => {
    const set = new Set<string>();
    for (const m of mappings.data ?? []) if (m.sourceCarrier) set.add(m.sourceCarrier);
    return Array.from(set).sort();
  }, [mappings.data]);

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/bridge-code-mappings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bridge-code-mappings"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <LinkIcon sx={{ fontSize: 36 }} color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Αντιστοιχίσεις γεφυρών</Typography>
          <Typography color="text.secondary">
            Κάθε ασφαλιστική στέλνει κωδικούς με τη δική της ονομασία (π.χ. «ΑΥΤΟ», «Α1001»).
            Εδώ λέτε πώς λέγονται τα ίδια πράγματα στο δικό σας γραφείο.
            Μία φορά τα συνδέετε — από εκεί και πέρα κάθε αρχείο γέφυρας βρίσκει μόνο του πού πάει.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          Νέα αντιστοίχιση
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select label="Τύπος" value={kindFilter} onChange={e => setKindFilter(e.target.value as Kind | "")}
            sx={{ minWidth: 160 }} size="small"
          >
            <MenuItem value="">Όλοι</MenuItem>
            {(Object.keys(KIND_LABELS) as Kind[]).map(k =>
              <MenuItem key={k} value={k}>{KIND_LABELS[k]}</MenuItem>)}
          </TextField>
          <TextField
            select label="Πάροχος (πηγή)" value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
            sx={{ minWidth: 200 }} size="small"
          >
            <MenuItem value="">Όλοι</MenuItem>
            {distinctCarrierSources.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField
            label="Αναζήτηση (κωδικός/label)" value={search} onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1 }} size="small"
          />
        </Stack>
      </Card>

      <Card variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Τύπος</TableCell>
              <TableCell>Πάροχος (πηγή)</TableCell>
              <TableCell>Κωδικός γέφυρας</TableCell>
              <TableCell>Ονομασία γέφυρας</TableCell>
              <TableCell>Στο γραφείο σας το λέτε</TableCell>
              <TableCell width={90} />
            </TableRow>
          </TableHead>
          <TableBody>
            {mappings.isLoading && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <CircularProgress size={20} />
              </TableCell></TableRow>
            )}
            {!mappings.isLoading && (mappings.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                Δεν υπάρχουν αντιστοιχίσεις ακόμα.
              </TableCell></TableRow>
            )}
            {(mappings.data ?? []).map(m => (
              <TableRow key={m.id} hover>
                <TableCell><Chip size="small" label={KIND_LABELS[m.kind]} /></TableCell>
                <TableCell>{m.sourceCarrier ?? "—"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{m.rawCode}</TableCell>
                <TableCell>{m.rawLabel ?? ""}</TableCell>
                <TableCell>
                  {m.kind === "Company"
                    ? (m.targetInsuranceCompanyName ?? <Chip size="small" color="warning" label="δεν έχει συνδεθεί ακόμη" />)
                    : (m.targetParameterItemCode
                      ? <>
                          <Typography component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {m.targetParameterItemCode}
                          </Typography>
                          {m.targetParameterItemName && <> · {m.targetParameterItemName}</>}
                        </>
                      : <Chip size="small" color="warning" label="δεν έχει συνδεθεί ακόμη" />)}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Επεξεργασία">
                    <IconButton size="small" onClick={() => setEditing(m)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Διαγραφή">
                    <IconButton size="small" color="error" onClick={() => {
                      if (confirm("Να διαγραφεί η αντιστοίχιση;")) remove.mutate(m.id);
                    }}><DeleteIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {(creating || editing) && (
        <EditDialog
          open={true}
          item={editing}
          carriers={carriers}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ["bridge-code-mappings"] });
          }}
        />
      )}
    </Box>
  );
}

function EditDialog({ open, item, carriers, onClose, onSaved }: {
  open: boolean;
  item: Mapping | null;
  carriers: CarrierLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!item;
  const [form, setForm] = useState({
    kind: item?.kind ?? "Coverage" as Kind,
    sourceCarrier: item?.sourceCarrier ?? "",
    rawCode: item?.rawCode ?? "",
    rawLabel: item?.rawLabel ?? "",
    targetInsuranceCompanyId: item?.targetInsuranceCompanyId ?? "",
    targetParameterItemId: item?.targetParameterItemId ?? "",
    notes: item?.notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [inlineCarrierCreate, setInlineCarrierCreate] = useState<string | null>(null);

  const params = useQuery({
    queryKey: ["company-parameters", { kind: form.kind, carrierId: form.targetInsuranceCompanyId }],
    enabled: open && form.kind !== "Company",
    queryFn: async () => (await api.get<ParameterItem[]>("/company-parameters", {
      params: { kind: form.kind }
    })).data
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        kind: form.kind,
        sourceCarrier: form.sourceCarrier.trim() || null,
        rawCode: form.rawCode.trim(),
        rawLabel: form.rawLabel.trim() || null,
        targetInsuranceCompanyId: form.kind === "Company" ? (form.targetInsuranceCompanyId || null) : null,
        targetParameterItemId: form.kind !== "Company" ? (form.targetParameterItemId || null) : null,
        notes: form.notes.trim() || null,
      };
      if (editing) return (await api.put(`/bridge-code-mappings/${item!.id}`, body)).data;
      return (await api.post("/bridge-code-mappings", body)).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  const canSave = !!form.rawCode.trim()
    && (form.kind === "Company" ? !!form.targetInsuranceCompanyId : !!form.targetParameterItemId);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Επεξεργασία αντιστοίχισης" : "Νέα αντιστοίχιση"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={0.5}>
          <TextField
            select label="Τι είναι αυτός ο κωδικός;" value={form.kind}
            helperText="Επιλέξτε αν ο κωδικός αντιστοιχεί σε εταιρεία, κλάδο, κάλυψη, χρήση, πακέτο ή συνεργάτη."
            onChange={e => setForm({ ...form, kind: e.target.value as Kind, targetInsuranceCompanyId: "", targetParameterItemId: "" })}
            fullWidth
          >
            {(Object.keys(KIND_LABELS) as Kind[]).map(k =>
              <MenuItem key={k} value={k}>{KIND_LABELS[k]}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Ασφαλιστική εταιρεία (από τη γέφυρα)" value={form.sourceCarrier}
              onChange={e => setForm({ ...form, sourceCarrier: e.target.value })}
              fullWidth placeholder="π.χ. ERGO Ασφαλιστική"
              helperText="Ποιας εταιρείας τα αρχεία θα διαβάζουμε."
            />
            <TextField
              label="Κωδικός στη γέφυρα" value={form.rawCode}
              onChange={e => setForm({ ...form, rawCode: e.target.value })}
              fullWidth required placeholder="π.χ. Α1001 ή 1003"
              helperText="Ο κωδικός όπως έρχεται στο αρχείο."
            />
          </Stack>
          <TextField
            label="Ονομασία στη γέφυρα (προαιρετικά)"
            value={form.rawLabel}
            onChange={e => setForm({ ...form, rawLabel: e.target.value })}
            fullWidth
            helperText="Ο τίτλος όπως εμφανίζεται δίπλα στον κωδικό — βοηθάει να θυμάστε τι είναι."
          />

          {form.kind === "Company" ? (
            <>
              <SearchableSelect
                label="Δική σας ασφαλιστική εταιρεία"
                value={form.targetInsuranceCompanyId}
                onChange={v => setForm({ ...form, targetInsuranceCompanyId: v })}
                options={carriers.map(c => ({ value: c.id, label: c.name, hint: c.code }))}
                createNewLabel="+ Νέα ασφαλιστική"
                onCreateNew={input => setInlineCarrierCreate(input || "")}
              />
              <InlineCreateInsuranceCompanyDialog
                open={inlineCarrierCreate !== null}
                prefillText={inlineCarrierCreate ?? ""}
                onClose={() => setInlineCarrierCreate(null)}
                onCreated={c => { setForm(prev => ({ ...prev, targetInsuranceCompanyId: c.id })); setInlineCarrierCreate(null); }}
              />
            </>
          ) : (
            <SearchableSelect
              label={`Το αντίστοιχο ${KIND_LABELS[form.kind].toLowerCase()} στο δικό σας γραφείο`}
              value={form.targetParameterItemId}
              onChange={v => setForm({ ...form, targetParameterItemId: v })}
              options={(params.data ?? []).map(p => ({
                value: p.id,
                label: `${p.code} · ${p.name}`,
                hint: p.insuranceCompanyName,
              }))}
              helperText={params.isLoading ? "Φόρτωση…" : `${params.data?.length ?? 0} διαθέσιμα παραμετρικά`}
            />
          )}

          <TextField
            label="Σημειώσεις" multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
