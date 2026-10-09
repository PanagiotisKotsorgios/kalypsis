import { useMemo, useState } from "react";
import { FilterHelp } from "./FilterHelp";
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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import GridOnIcon from "@mui/icons-material/GridOn";
import { ExcelImportButton } from "./ExcelImportButton";
import { Tooltip } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { BulkImportDialog, type BulkImportColumn, type BulkImportResult } from "./BulkImportDialog";

type Kind = "Branch" | "Use" | "Coverage" | "Package";
type PolicyType = string;

interface Item {
  id: string;
  insuranceCompanyId: string;
  insuranceCompanyCode: string;
  insuranceCompanyName: string;
  kind: Kind;
  code: string;
  name: string;
  policyType: PolicyType | null;
  policyTypeText?: string | null;
  vehicleUseCategory: string | null;
  vehicleUseCategoryText?: string | null;
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


const PARAMETRIC_IMPORT_COLUMNS: BulkImportColumn[] = [
  { key: "kind", label: "Είδος (Branch/Use/Coverage/Package)", required: true, example: "Coverage" },
  { key: "code", label: "Κωδικός", required: true, example: "AUTO_BASIC" },
  { key: "name", label: "Ονομασία", required: true, example: "Βασική κάλυψη" },
  { key: "policyType", label: "Κλάδος / τύπος συμβολαίου (ελεύθερο κείμενο)", example: "Ασφάλιση σκάφους" },
  { key: "vehicleUseCategory", label: "Κατηγορία χρήσης οχήματος (ελεύθερο κείμενο)", example: "Επαγγελματικό" },
  { key: "parentCode", label: "Κωδικός γονέα", example: "AUTO" },
  { key: "bridgeSystem", label: "Σύστημα γέφυρας", example: "" },
  { key: "bridgeCode", label: "Κωδικός γέφυρας", example: "" },
  { key: "bridgeField", label: "Πεδίο γέφυρας", example: "" },
  { key: "defaultValuesJson", label: "Προεπιλεγμένες τιμές (JSON)", example: "{}" },
  { key: "effectiveFrom", label: "Ισχύς από (YYYY-MM-DD)", example: "2026-10-01" },
  { key: "effectiveTo", label: "Ισχύς έως (YYYY-MM-DD)", example: "" },
  { key: "isActive", label: "Ενεργό (true/false)", example: "true" },
  { key: "displayOrder", label: "Σειρά εμφάνισης", example: "1" },
  { key: "notes", label: "Σημειώσεις", example: "" },
];

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
  const [importOpen, setImportOpen] = useState(false);

  const q = useQuery({
    enabled: open && !!insuranceCompanyId,
    queryKey: ["company-parameters", insuranceCompanyId],
    queryFn: async () => {
      const rows = (await api.get<Item[]>("/company-parameters", {
        params: { insuranceCompanyId }
      })).data;
      return rows.map(r => ({
        ...r,
        policyType: (r.policyTypeText ?? r.policyType) as PolicyType | null,
        vehicleUseCategory: r.vehicleUseCategoryText ?? r.vehicleUseCategory,
      }));
    }
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
    setImportOpen(false);
    onClose();
  };

  const importParametrics = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0;
    const errors: string[] = [];
    const failedRows: Record<string, string>[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const kind = row.kind?.trim();
        if (!["Branch", "Use", "Coverage", "Package"].includes(kind)) throw new Error("Το είδος πρέπει να είναι Branch, Use, Coverage ή Package.");
        if (!row.code?.trim() || !row.name?.trim()) throw new Error("Ο κωδικός και η ονομασία είναι υποχρεωτικά.");
        const active = row.isActive?.trim().toLowerCase();
        const displayOrder = row.displayOrder?.trim() ? Number(row.displayOrder) : 0;
        if (!Number.isFinite(displayOrder)) throw new Error("Η σειρά εμφάνισης πρέπει να είναι αριθμός.");
        await api.post("/company-parameters", {
          insuranceCompanyId,
          kind,
          code: row.code.trim(),
          name: row.name.trim(),
          policyType: null,
          vehicleUseCategory: null,
          policyTypeText: row.policyType?.trim() || null,
          vehicleUseCategoryText: row.vehicleUseCategory?.trim() || null,
          parentCode: row.parentCode?.trim() || null,
          bridgeSystem: row.bridgeSystem?.trim() || null,
          bridgeCode: row.bridgeCode?.trim() || null,
          bridgeField: row.bridgeField?.trim() || null,
          defaultValuesJson: row.defaultValuesJson?.trim() || null,
          effectiveFrom: row.effectiveFrom?.trim() || null,
          effectiveTo: row.effectiveTo?.trim() || null,
          isActive: active ? !["false", "no", "όχι", "οχι", "0"].includes(active) : true,
          displayOrder,
          source: "AgencyImport",
          notes: row.notes?.trim() || null,
        });
        imported += 1;
      } catch (error) {
        failedRows.push(row);
        errors.push(`Γραμμή ${index + 2}: ${extractErrorMessage(error, "Αποτυχία εισαγωγής παραμετρικού")}`);
      }
    }
    return { imported, failed: failedRows.length, errors, failedRows };
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
            placeholder="Αναζήτηση…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Αναζήτηση σε κωδικό ή όνομα ασφαλιστικής εταιρίας." />
            }}
            sx={{ maxWidth: { md: 320 } }}
          />
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<GridOnIcon />} variant="outlined" size="small"
            onClick={async () => {
              const resp = await api.get("/company-parameters/export.xlsx", {
                params: {
                  insuranceCompanyId,
                  kind: tab,
                  audience: "headquarters",
                },
                responseType: "blob",
              });
              const url = URL.createObjectURL(resp.data as Blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `parametrics_${(insuranceCompanyName ?? "carrier").replace(/\s+/g, "_")}_${tab}.xlsx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}>
            Εξαγωγή XLSX
          </Button>
          <Button startIcon={<GridOnIcon />} variant="outlined" size="small"
            onClick={async () => {
              const resp = await api.get("/company-parameters/export.xlsx", {
                params: {
                  insuranceCompanyId,
                  kind: tab,
                  audience: "producer",
                },
                responseType: "blob",
              });
              const url = URL.createObjectURL(resp.data as Blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `parametrics_producer_${(insuranceCompanyName ?? "carrier").replace(/\s+/g, "_")}_${tab}.xlsx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}>
            Για συνεργάτες
          </Button>
          <ExcelImportButton size="small"
            onClick={() => setImportOpen(true)} disabled={!insuranceCompanyId}>
            Εισαγωγή XLSX
          </ExcelImportButton>
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
              {rows.map(r => {
                // Bridge-locked or canonical-source rows can't be touched by an
                // agency admin — show a lock instead of edit/delete.
                const locked = !!r.bridgeSystem
                  || r.source?.startsWith("GrandCover")
                  || r.source?.startsWith("Kalypsis defaults")
                  || r.source?.startsWith("Bridge");
                return (
                <TableRow key={r.id} hover>
                  <TableCell><Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.code}</Typography></TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.policyType ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>{r.parentCode ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: 12 }}>
                    {r.bridgeSystem ? `${r.bridgeSystem}/${r.bridgeCode ?? ""}` : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {locked ? (
                      <Tooltip title={`Κλειδωμένο από: ${r.source}. Επεξεργασία μόνο από superadmin.`} arrow>
                        <span><IconButton size="small" disabled><LockOutlinedIcon fontSize="small" /></IconButton></span>
                      </Tooltip>
                    ) : (
                      <>
                        <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                        <DeleteButton id={r.id} onDeleted={() => qc.invalidateQueries({ queryKey: ["company-parameters", insuranceCompanyId] })} />
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
              })}
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
      <BulkImportDialog
        open={importOpen}
        title={`Μαζική εισαγωγή παραμετρικών · ${insuranceCompanyName ?? "ασφαλιστική"}`}
        description="Το πρότυπο περιέχει κλάδους, χρήσεις, καλύψεις και πακέτα. Για Coverage/Package συμπληρώστε κλάδο και κωδικό γονέα. Οι κλειδωμένες εγγραφές γέφυρας δεν τροποποιούνται από το γραφείο."
        columns={PARAMETRIC_IMPORT_COLUMNS}
        onClose={() => setImportOpen(false)}
        onImport={async (rows) => { const result = await importParametrics(rows); void qc.invalidateQueries({ queryKey: ["company-parameters", insuranceCompanyId] }); return result; }}
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
    policyType: editing?.policyTypeText ?? editing?.policyType ?? null,
    vehicleUseCategory: editing?.vehicleUseCategoryText ?? editing?.vehicleUseCategory ?? null,
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
        policyType: null,
        vehicleUseCategory: null,
        policyTypeText: form.policyType?.trim() || null,
        vehicleUseCategoryText: form.vehicleUseCategory?.trim() || null,
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
          <TextField size="small" label="Κλάδος / τύπος συμβολαίου (προαιρετικό)" value={form.policyType ?? ""}
            helperText="Ελεύθερη τιμή γραφείου — δεν περιορίζεται σε προκαθορισμένες επιλογές."
            onChange={(e) => setForm({ ...form, policyType: e.target.value })} />
          {form.kind === "Use" && (
            <TextField size="small" label="Κατηγορία χρήσης οχήματος (προαιρετικό)" value={form.vehicleUseCategory ?? ""}
              helperText="Πληκτρολογήστε την ονομασία που χρησιμοποιεί το γραφείο."
              onChange={(e) => setForm({ ...form, vehicleUseCategory: e.target.value })} />
          )}
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
        <Button onClick={onClose} disabled={save.isPending} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} color="inherit" /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
