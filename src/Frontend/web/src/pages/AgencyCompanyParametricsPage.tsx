import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { InlineCreateInsuranceCompanyDialog } from "../components/InlineCreateInsuranceCompanyDialog";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type ParameterKind = "Branch" | "Coverage" | "Use" | "Package";

interface CompanyDto {
  id: string; name: string; code: string;
  isGlobal: boolean; isUsedByTenant?: boolean; parentCompanyId?: string | null;
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
  parentCode: string | null;
  isActive: boolean;
  displayOrder: number;
  source: string;
  notes: string | null;
}

// Tab order the office uses when they build up a carrier: first the top
// hierarchy (Κλάδοι → Πακέτα), then the axes that specialise a policy
// (Χρήσεις for motor use categories), and finally the leaf-level Καλύψεις.
const KINDS: ParameterKind[] = ["Branch", "Package", "Use", "Coverage"];
const KIND_LABEL: Record<ParameterKind, string> = {
  Branch: "Κλάδοι",
  Coverage: "Καλύψεις",
  Use: "Χρήσεις",
  Package: "Πακέτα",
};
const KIND_HELP: Record<ParameterKind, string> = {
  Branch: "Κατηγορίες συμβολαίων ανά εταιρεία (Αυτοκίνητο, Πυρός, Ζωής, …).",
  Coverage: "Επιμέρους καλύψεις μέσα σε κάθε κλάδο.",
  Use: "Χρήσεις οχήματος για τον κλάδο Αυτοκινήτου.",
  Package: "Πακέτα καλύψεων που συνδυάζονται από την εταιρεία.",
};
const POLICY_TYPES: PolicyType[] = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Other"];

export function AgencyCompanyParametricsPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [tab, setTab] = useState<ParameterKind>("Branch");
  const [editing, setEditing] = useState<ParameterDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [inlineCarrierCreate, setInlineCarrierCreate] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const carriersQ = useQuery({
    queryKey: ["insurance-companies", "for-parametrics"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data
  });

  // Restrict the carrier picker to what the agency actually owns or has opted
  // into. Legacy platform-global entries the tenant never opted into stay
  // hidden — they were the "Καθολικός κατάλογος Kalypsis" surface we removed.
  const carriers = useMemo(() => {
    const rows = carriersQ.data ?? [];
    return rows.filter(c => !c.isGlobal || c.isUsedByTenant);
  }, [carriersQ.data]);

  const paramsQ = useQuery({
    queryKey: ["company-parameters", "agency", selectedCarrierId, tab],
    enabled: !!selectedCarrierId,
    queryFn: async () => (await api.get<ParameterDto[]>("/company-parameters", {
      params: { insuranceCompanyId: selectedCarrierId, kind: tab }
    })).data
  });

  const filteredParams = useMemo(() => {
    const rows = paramsQ.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(p =>
      p.code.toLowerCase().includes(s)
      || p.name.toLowerCase().includes(s)
      || (p.parentCode ?? "").toLowerCase().includes(s));
  }, [paramsQ.data, search]);

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/company-parameters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-parameters"] }),
    onError: e => setErr(extractErrorMessage(e))
  });

  const selectedCarrier = carriers.find(c => c.id === selectedCarrierId);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <TuneOutlinedIcon sx={{ fontSize: 36 }} color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Παραμετρικά ασφαλιστικών</Typography>
          <Typography color="text.secondary">
            Ορίστε δικούς σας κλάδους, καλύψεις, χρήσεις και πακέτα ανά ασφαλιστική.
            Οι γέφυρες θα δείχνουν σε αυτά κατά την εισαγωγή.
          </Typography>
        </Box>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            select label="Ασφαλιστική εταιρεία" value={selectedCarrierId}
            onChange={e => { setSelectedCarrierId(e.target.value); }}
            sx={{ minWidth: 260, flex: 1 }} size="small"
          >
            <MenuItem value="">— επιλέξτε εταιρεία —</MenuItem>
            {carriers.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name} · {c.code}</MenuItem>
            ))}
          </TextField>
          <Button size="small" onClick={() => setInlineCarrierCreate("")}
            variant="outlined" startIcon={<AddIcon />}>
            Νέα ασφαλιστική
          </Button>
          <TextField
            label="Αναζήτηση κωδικού/ονόματος" value={search} size="small"
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 240, flex: 1 }}
            disabled={!selectedCarrierId}
          />
          <Button variant="contained" startIcon={<AddIcon />}
            disabled={!selectedCarrierId} onClick={() => setCreating(true)}>
            Νέο {KIND_LABEL[tab].toLowerCase()}
          </Button>
        </Stack>
        <InlineCreateInsuranceCompanyDialog
          open={inlineCarrierCreate !== null}
          prefillText={inlineCarrierCreate ?? ""}
          onClose={() => setInlineCarrierCreate(null)}
          onCreated={c => { setSelectedCarrierId(c.id); setInlineCarrierCreate(null); qc.invalidateQueries({ queryKey: ["insurance-companies"] }); }}
        />
      </Card>

      {!selectedCarrierId && (
        <Card variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">
            Επιλέξτε ασφαλιστική για να δείτε και να διαχειριστείτε τα παραμετρικά της.
          </Typography>
        </Card>
      )}

      {selectedCarrierId && (
        <Card variant="outlined">
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            {KINDS.map(k => (
              <Tab key={k} value={k}
                label={<Stack direction="row" spacing={1} alignItems="center">
                  <span>{KIND_LABEL[k]}</span>
                  {tab === k && <Chip size="small" label={filteredParams.length} />}
                </Stack>} />
            ))}
          </Tabs>
          <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {KIND_HELP[tab]}
            </Typography>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Κωδικός</TableCell>
                  <TableCell>Όνομα</TableCell>
                  <TableCell>Κλάδος</TableCell>
                  <TableCell>Γονέας</TableCell>
                  <TableCell>Ενεργό</TableCell>
                  <TableCell align="right" width={100} />
                </TableRow>
              </TableHead>
              <TableBody>
                {paramsQ.isLoading && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}><CircularProgress size={20} /></TableCell></TableRow>
                )}
                {!paramsQ.isLoading && filteredParams.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    Δεν υπάρχουν {KIND_LABEL[tab].toLowerCase()} για αυτή την εταιρεία.
                  </TableCell></TableRow>
                )}
                {filteredParams.map(p => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.policyType ?? "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{p.parentCode ?? ""}</TableCell>
                    <TableCell>{p.isActive ? <Chip size="small" color="success" label="Ναι" /> : <Chip size="small" label="Όχι" />}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Επεξεργασία">
                        <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Διαγραφή">
                        <IconButton size="small" color="error" onClick={() => {
                          if (confirm(`Διαγραφή ${KIND_LABEL[tab].slice(0, -1).toLowerCase()} «${p.code}»;`)) remove.mutate(p.id);
                        }}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {(creating || editing) && selectedCarrierId && (
        <EditDialog
          open={true}
          item={editing}
          carrierId={selectedCarrierId}
          carrierName={selectedCarrier?.name ?? ""}
          kind={tab}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ["company-parameters"] });
          }}
        />
      )}
    </Box>
  );
}

function EditDialog({ open, item, carrierId, carrierName, kind, onClose, onSaved }: {
  open: boolean;
  item: ParameterDto | null;
  carrierId: string;
  carrierName: string;
  kind: ParameterKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!item;
  const [form, setForm] = useState({
    code: item?.code ?? "",
    name: item?.name ?? "",
    policyType: (item?.policyType ?? (kind === "Branch" ? "Auto" : "")) as PolicyType | "",
    parentCode: item?.parentCode ?? "",
    isActive: item?.isActive ?? true,
    displayOrder: item?.displayOrder ?? 0,
    notes: item?.notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        insuranceCompanyId: carrierId,
        kind,
        code: form.code.trim(),
        name: form.name.trim(),
        policyType: form.policyType || null,
        vehicleUseCategory: null,
        parentCode: form.parentCode.trim() || null,
        bridgeSystem: null,
        bridgeCode: null,
        bridgeField: null,
        defaultValuesJson: null,
        effectiveFrom: null,
        effectiveTo: null,
        isActive: form.isActive,
        displayOrder: form.displayOrder,
        source: item?.source ?? "Agency",
        notes: form.notes.trim() || null,
      };
      if (editing) return (await api.put(`/company-parameters/${item!.id}`, body)).data;
      return (await api.post(`/company-parameters`, body)).data;
    },
    onSuccess: onSaved,
    onError: e => setErr(extractErrorMessage(e))
  });

  const requiresPolicyType = kind === "Branch" || kind === "Coverage" || kind === "Package";
  const canSave = !!form.code.trim() && !!form.name.trim()
    && (!requiresPolicyType || !!form.policyType)
    && (kind !== "Coverage" && kind !== "Package" ? true : !!form.parentCode.trim());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {editing ? `Επεξεργασία ${kind}` : `Νέο ${KIND_LABEL[kind].slice(0, -1)}`} · {carrierName}
      </DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={0.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός" required sx={{ width: 180 }}
              value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <TextField label="Όνομα" required fullWidth
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Stack>
          {requiresPolicyType && (
            <TextField select label="Κλάδος (τύπος συμβολαίου)" required
              value={form.policyType}
              onChange={e => setForm({ ...form, policyType: e.target.value as PolicyType })}
              fullWidth>
              {POLICY_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          )}
          {(kind === "Coverage" || kind === "Package") && (
            <TextField label="Κωδικός γονέα (κλάδος/πακέτο)" required
              value={form.parentCode}
              onChange={e => setForm({ ...form, parentCode: e.target.value.toUpperCase() })}
              fullWidth
              helperText="π.χ. AUTO για κλάδο αυτοκινήτου. Το raw ID είναι ο δικός σας κωδικός."
            />
          )}
          <Stack direction="row" spacing={2}>
            <TextField label="Σειρά εμφάνισης" type="number" value={form.displayOrder}
              onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
              sx={{ width: 160 }} />
            <TextField select label="Ενεργό" value={form.isActive ? "yes" : "no"}
              onChange={e => setForm({ ...form, isActive: e.target.value === "yes" })}
              sx={{ width: 140 }}
            >
              <MenuItem value="yes">Ναι</MenuItem>
              <MenuItem value="no">Όχι</MenuItem>
            </TextField>
          </Stack>
          <TextField label="Σημειώσεις" multiline rows={2} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth />
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
