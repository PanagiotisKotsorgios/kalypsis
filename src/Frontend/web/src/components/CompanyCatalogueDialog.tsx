import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type Kind = "Branch" | "Use" | "Coverage" | "Package";
type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";

interface Item {
  id: string;
  insuranceCompanyId: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: Kind;
  code: string;
  name: string;
  policyType: PolicyType | null;
  vehicleUseCategory: string | null;
  parentCode: string | null;
  bridgeSystem: string | null;
  bridgeCode: string | null;
  isActive: boolean;
  displayOrder: number;
  source: string;
  notes: string | null;
}

const KIND_LABEL: Record<Kind, string> = {
  Branch: "Κλάδος",
  Use: "Χρήση οχήματος",
  Coverage: "Κάλυψη",
  Package: "Πακέτο"
};

const POLICY_TYPES: PolicyType[] = ["Auto", "Home", "Health", "Life", "Business", "Travel", "Other"];

/**
 * Per-carrier catalogue manager. Lists every CompanyParameterItem for a given
 * insurance company, grouped by kind, with add / edit / delete. AgencyAdmin
 * endpoints under /api/company-parameters back the writes — entries are
 * shared across tenants so every γραφειο sees additions immediately.
 */
export function CompanyCatalogueDialog({
  open,
  onClose,
  insuranceCompanyId,
  insuranceCompanyName
}: {
  open: boolean;
  onClose: () => void;
  insuranceCompanyId: string | null;
  insuranceCompanyName?: string;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Kind>("Coverage");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    enabled: open && !!insuranceCompanyId,
    queryKey: ["company-parameters", insuranceCompanyId],
    queryFn: async () => (await api.get<Item[]>("/company-parameters", {
      params: { insuranceCompanyId }
    })).data
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    return all
      .filter(r => r.kind === tab)
      .filter(r => !s || r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
  }, [q.data, tab, search]);

  const close = () => {
    setEditing(null);
    setCreating(false);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 2, height: "85vh" } } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
          Παραμετρικά εταιρίας · {insuranceCompanyName ?? "—"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>
          Καλύψεις, πακέτα, χρήσεις και κλάδοι που εμφανίζονται στα dropdowns και τα φίλτρα της εταιρίας.
        </Typography>
        <IconButton onClick={close} sx={{ position: "absolute", right: 10, top: 10 }} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} sx={{ mb: 1.5 }}>
          <ToggleButtonGroup
            exclusive size="small"
            value={tab}
            onChange={(_, v) => v && setTab(v)}
            sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700 } }}
          >
            {(["Branch","Use","Coverage","Package"] as Kind[]).map(k => (
              <ToggleButton key={k} value={k}>
                {KIND_LABEL[k]}
                <Chip
                  size="small"
                  label={(q.data ?? []).filter(r => r.kind === k).length}
                  sx={{ ml: 1, height: 18, fontSize: 11 }}
                />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            size="small" fullWidth
            placeholder="Αναζήτηση σε κωδικό ή όνομα…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ maxWidth: { md: 320 } }}
          />
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<AddIcon />} variant="contained" size="small"
            onClick={() => setCreating(true)} disabled={!insuranceCompanyId}>
            Νέα εγγραφή
          </Button>
        </Stack>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
            <Typography>Δεν υπάρχουν εγγραφές «{KIND_LABEL[tab]}» — πατήστε «Νέα εγγραφή» για να προσθέσετε.</Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell>Κλάδος</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Bridge</TableCell>
                <TableCell align="right" sx={{ width: 96 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.code}</Typography></TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.policyType ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>{r.parentCode ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: 12 }}>
                    {r.bridgeSystem ? `${r.bridgeSystem}/${r.bridgeCode ?? ""}` : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                    <DeleteButton id={r.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["company-parameters", insuranceCompanyId] })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5 }}>
        <Button onClick={close}>Κλείσιμο</Button>
      </DialogActions>

      <CatalogueItemDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        insuranceCompanyId={insuranceCompanyId}
        defaultKind={tab}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["company-parameters", insuranceCompanyId] })}
      />
    </Dialog>
  );
}

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const mut = useMutation({
    mutationFn: async () => api.delete(`/company-parameters/${id}`),
    onSuccess: () => onDeleted()
  });
  return (
    <IconButton size="small" color="error" disabled={mut.isPending}
      onClick={() => { if (window.confirm("Διαγραφή της εγγραφής;")) mut.mutate(); }}>
      <DeleteOutlineIcon fontSize="small" />
    </IconButton>
  );
}

function CatalogueItemDialog({
  open, onClose, insuranceCompanyId, defaultKind, editing, onSaved
}: {
  open: boolean;
  onClose: () => void;
  insuranceCompanyId: string | null;
  defaultKind: Kind;
  editing: Item | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const initial = useMemo(() => ({
    kind: editing?.kind ?? defaultKind,
    code: editing?.code ?? "",
    name: editing?.name ?? "",
    policyType: editing?.policyType ?? null,
    vehicleUseCategory: editing?.vehicleUseCategory ?? null,
    parentCode: editing?.parentCode ?? "",
    bridgeSystem: editing?.bridgeSystem ?? "",
    bridgeCode: editing?.bridgeCode ?? "",
    notes: editing?.notes ?? "",
    displayOrder: editing?.displayOrder ?? 0,
    isActive: editing?.isActive ?? true
  }), [editing, defaultKind, open]);

  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // Reset whenever the dialog opens with a different item.
  useMemo(() => { setForm(initial); setError(null); }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!insuranceCompanyId) throw new Error("Επιλέξτε εταιρία πρώτα.");
      if (!form.code.trim() || !form.name.trim()) throw new Error("Κωδικός και όνομα είναι υποχρεωτικά.");
      const body = {
        insuranceCompanyId,
        kind: form.kind,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        policyType: form.policyType,
        vehicleUseCategory: form.vehicleUseCategory,
        parentCode: form.parentCode.trim() || null,
        bridgeSystem: form.bridgeSystem.trim() || null,
        bridgeCode: form.bridgeCode.trim() || null,
        bridgeField: null,
        defaultValuesJson: null,
        effectiveFrom: null,
        effectiveTo: null,
        isActive: form.isActive,
        displayOrder: form.displayOrder ?? 0,
        source: editing?.source ?? "AgencyAdmin",
        notes: form.notes.trim() || null
      };
      if (isEdit && editing) {
        await api.put(`/company-parameters/${editing.id}`, body);
      } else {
        await api.post(`/company-parameters`, body);
      }
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
      <DialogTitle>{isEdit ? "Επεξεργασία εγγραφής" : "Νέα εγγραφή"}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5 }}>{error}</Alert>}
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField select size="small" label="Τύπος" value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
            disabled={isEdit}>
            {(["Branch","Use","Coverage","Package"] as Kind[]).map(k => (
              <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" label="Κωδικός" value={form.code} required fullWidth
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <TextField size="small" label="Σειρά" type="number" sx={{ width: 100 }} value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) || 0 })} />
          </Stack>
          <TextField size="small" label="Όνομα" value={form.name} required fullWidth
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField select size="small" label="Κλάδος (προαιρετικό)" value={form.policyType ?? ""}
            onChange={(e) => setForm({ ...form, policyType: (e.target.value || null) as PolicyType | null })}>
            <MenuItem value="">—</MenuItem>
            {POLICY_TYPES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          {form.kind === "Coverage" || form.kind === "Package" ? (
            <TextField size="small" label="Parent code (π.χ. branch / package)" value={form.parentCode}
              onChange={(e) => setForm({ ...form, parentCode: e.target.value.toUpperCase() })} />
          ) : null}
          <Stack direction="row" spacing={1.5}>
            <TextField size="small" label="Bridge system" fullWidth value={form.bridgeSystem}
              placeholder="ERGO / GRAND_COVER / ..."
              onChange={(e) => setForm({ ...form, bridgeSystem: e.target.value.toUpperCase() })} />
            <TextField size="small" label="Bridge code" fullWidth value={form.bridgeCode}
              onChange={(e) => setForm({ ...form, bridgeCode: e.target.value })} />
          </Stack>
          <TextField size="small" label="Σημείωση" value={form.notes} multiline minRows={2}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
