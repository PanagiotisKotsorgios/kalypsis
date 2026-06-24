import { useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";

interface CatalogDef {
  id: string;
  label: string;
  endpoint: string;
  fields: { key: string; label: string; required?: boolean; defaultValue?: unknown; type?: "text" | "number" | "checkbox" }[];
  columns: { key: string; label: string }[];
}

const CATALOGS: CatalogDef[] = [
  { id: "banks", label: "Τράπεζες", endpoint: "/lookups/banks",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "swift", label: "SWIFT" },
      { key: "accountIban", label: "IBAN" },
      { key: "displayOrder", label: "Σειρά", type: "number", defaultValue: 0 },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [
      { key: "code", label: "Κωδικός" }, { key: "name", label: "Όνομα" },
      { key: "swift", label: "SWIFT" }, { key: "accountIban", label: "IBAN" }, { key: "isActive", label: "Ενεργή" }
    ] },
  { id: "tax-offices", label: "Δ.Ο.Υ.", endpoint: "/lookups/tax-offices",
    fields: [
      { key: "code", label: "Κωδικός Δ.Ο.Υ.", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "city", label: "Πόλη" },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" }, { key: "city", label: "Πόλη" }, { key: "isActive", label: "Ενεργή" }] },
  { id: "customer-categories", label: "Κατηγορίες πελατών", endpoint: "/lookups/customer-categories",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "colorHex", label: "Χρώμα (#hex)" },
      { key: "displayOrder", label: "Σειρά", type: "number", defaultValue: 0 },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" }, { key: "colorHex", label: "Χρώμα" }, { key: "isActive", label: "Ενεργή" }] },
  { id: "producer-categories", label: "Κατηγορίες συνεργατών", endpoint: "/lookups/producer-categories",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "displayOrder", label: "Σειρά", type: "number", defaultValue: 0 },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" }, { key: "isActive", label: "Ενεργή" }] },
  { id: "legal-forms", label: "Νομικές μορφές", endpoint: "/lookups/legal-forms",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" }, { key: "isActive", label: "Ενεργή" }] },
  { id: "nationalities", label: "Υπηκοότητες", endpoint: "/lookups/nationalities",
    fields: [
      { key: "iso2", label: "ISO2", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "isActive", label: "Ενεργή", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "iso2", label: "ISO" }, { key: "name", label: "Όνομα" }, { key: "isActive", label: "Ενεργή" }] },
  { id: "cities", label: "Πόλεις", endpoint: "/lookups/cities",
    fields: [
      { key: "name", label: "Όνομα", required: true },
      { key: "region", label: "Νομός" },
      { key: "postalCode", label: "ΤΚ" },
      { key: "displayOrder", label: "Σειρά", type: "number", defaultValue: 0 }
    ],
    columns: [{ key: "name", label: "Όνομα" }, { key: "region", label: "Νομός" }, { key: "postalCode", label: "ΤΚ" }] },
  { id: "occupations", label: "Επαγγέλματα", endpoint: "/lookups/occupations",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "category", label: "Κατηγορία" },
      { key: "isActive", label: "Ενεργό", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" }, { key: "category", label: "Κατηγορία" }, { key: "isActive", label: "Ενεργό" }] },
  { id: "cancellation-reasons", label: "Λόγοι ακύρωσης", endpoint: "/cancellation-reasons",
    fields: [
      { key: "code", label: "Κωδικός", required: true },
      { key: "name", label: "Όνομα", required: true },
      { key: "triggersRefund", label: "Επιστροφή", type: "checkbox", defaultValue: true },
      { key: "triggersCreditNote", label: "Πιστωτικό", type: "checkbox", defaultValue: false },
      { key: "displayOrder", label: "Σειρά", type: "number", defaultValue: 0 },
      { key: "isActive", label: "Ενεργός", type: "checkbox", defaultValue: true }
    ],
    columns: [{ key: "code", label: "Κωδ." }, { key: "name", label: "Όνομα" },
              { key: "triggersRefund", label: "Επιστροφή" }, { key: "triggersCreditNote", label: "Πιστωτικό" },
              { key: "isActive", label: "Ενεργός" }] }
];

export function ReferenceCatalogsPage() {
  const [activeId, setActiveId] = useState(CATALOGS[0].id);
  const active = CATALOGS.find(c => c.id === activeId)!;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <MenuBookIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Λίστες & Καταλόγοι</Typography>
            <HelpHint title="Βοηθητικά αρχεία"
              body="Καταλόγοι αναφοράς που τροφοδοτούν τις φόρμες σε όλη την εφαρμογή — τράπεζες, Δ.Ο.Υ., κατηγορίες, νομικές μορφές, πόλεις, επαγγέλματα, λόγοι ακύρωσης." />
          </Stack>
          <Typography color="text.secondary">
            Διαμορφώστε τα βοηθητικά αρχεία του γραφείου σας — όλα τα dropdowns της εφαρμογής τα τροφοδοτούν.
          </Typography>
        </Box>
      </Stack>

      <Tabs value={activeId} onChange={(_, v) => setActiveId(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 3 }}>
        {CATALOGS.map(c => <Tab key={c.id} value={c.id} label={c.label} />)}
      </Tabs>

      <CatalogTab def={active} key={active.id} />
    </Box>
  );
}

function CatalogTab({ def }: { def: CatalogDef }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["catalog", def.endpoint],
    queryFn: async () => (await api.get<Record<string, unknown>[]>(def.endpoint)).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`${def.endpoint}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["catalog", def.endpoint] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{def.label}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
          Νέα εγγραφή
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {def.columns.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={def.columns.length + 1} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν εγγραφές. Προσθέστε την πρώτη.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map((row, i) => (
                <TableRow key={String(row.id) ?? i} hover>
                  {def.columns.map(c => (
                    <TableCell key={c.key}>
                      {renderCell(row[c.key])}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <IconButton size="small" color="error"
                      onClick={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(String(row.id)); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CatalogCreateDialog def={def} open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["catalog", def.endpoint] }); setCreateOpen(false); }} />
    </Box>
  );
}

function renderCell(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean")
    return <Chip size="small" color={v ? "success" : "default"} label={v ? "Ναι" : "Όχι"} />;
  if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v))
    return <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: 14, height: 14, bgcolor: v, border: "1px solid", borderColor: "divider" }} />
      <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span>
    </Stack>;
  return String(v);
}

function CatalogCreateDialog({ def, open, onClose, onSaved }: {
  def: CatalogDef; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const initialForm = () => {
    const f: Record<string, unknown> = {};
    for (const fld of def.fields) f[fld.key] = fld.defaultValue ?? (fld.type === "checkbox" ? false : "");
    return f;
  };
  const [form, setForm] = useState<Record<string, unknown>>(initialForm());
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      // Convert numeric fields
      const body: Record<string, unknown> = {};
      for (const fld of def.fields) {
        const v = form[fld.key];
        if (fld.type === "number") body[fld.key] = v === "" || v === null ? 0 : Number(v);
        else if (fld.type === "checkbox") body[fld.key] = Boolean(v);
        else body[fld.key] = typeof v === "string" ? (v.trim() || null) : v;
      }
      return (await api.post(def.endpoint, body)).data;
    },
    onSuccess: () => { setForm(initialForm()); onSaved(); },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέα εγγραφή — {def.label}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          {def.fields.map(fld => fld.type === "checkbox" ? (
            <label key={fld.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(form[fld.key])}
                onChange={(e) => setForm({ ...form, [fld.key]: e.target.checked })} />
              <span>{fld.label}</span>
            </label>
          ) : (
            <TextField key={fld.key} label={fld.label + (fld.required ? " *" : "")}
              type={fld.type === "number" ? "number" : "text"}
              required={fld.required}
              value={String(form[fld.key] ?? "")}
              onChange={(e) => setForm({ ...form, [fld.key]: e.target.value })}
              fullWidth />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
