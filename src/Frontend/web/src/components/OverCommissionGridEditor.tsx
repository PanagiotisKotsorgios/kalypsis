import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RestoreIcon from "@mui/icons-material/Restore";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { useMutation } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Excel-like grid editor for over-commission statements.
 *
 * The office keys the carrier's ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ row-by-row here
 * instead of opening the single-entry dialog N times. Every change is
 * autosaved to localStorage under a per-tenant / per-year-month key so a
 * mid-session refresh doesn't lose work. On mount the draft is restored
 * automatically; a "Καθαρισμός προχείρου" button wipes it when the operator
 * is done or wants a fresh sheet.
 *
 * "Import all" hits the bulk-upsert endpoint which does upsert-by-natural
 * key on the backend — retrying an import for the same (carrier × producer
 * × month) tuple updates instead of duplicating, so partially-successful
 * batches are always safe to re-submit.
 */

interface Producer { id: string; name: string; code: string | null; }
interface Carrier { id: string; name: string; code: string; }

interface GridRow {
  key: string;                    // client-side stable id for React
  insuranceCompanyId: string;
  producerId: string;
  year: number;
  month: number;
  grossAmount: string;            // strings while editing — parsed on send
  netAmount: string;
  reference: string;
  notes: string;
  paidOn: string;
  serverError?: string | null;    // per-row error surfaced from bulk result
  serverOk?: boolean;
}

interface DraftPayload {
  version: 1;
  savedAt: string;
  rows: GridRow[];
}

const CURRENCY = "EUR";
const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const uid = () => (crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const MONTHS = [
  { v: 1,  n: "01 · Ιαν" },  { v: 2,  n: "02 · Φεβ" }, { v: 3,  n: "03 · Μαρ" },
  { v: 4,  n: "04 · Απρ" },  { v: 5,  n: "05 · Μάι" }, { v: 6,  n: "06 · Ιουν" },
  { v: 7,  n: "07 · Ιουλ" }, { v: 8,  n: "08 · Αυγ" }, { v: 9,  n: "09 · Σεπ" },
  { v: 10, n: "10 · Οκτ" },  { v: 11, n: "11 · Νοε" }, { v: 12, n: "12 · Δεκ" },
];

function draftKey(defaultYear: number, defaultMonth: number) {
  // Draft is scoped per (year, month) so the operator can work on multiple
  // periods without them clobbering each other in localStorage.
  return `kalypsis.overCommissionDraft.v1.${defaultYear}-${String(defaultMonth).padStart(2, "0")}`;
}

function emptyRow(defaultYear: number, defaultMonth: number, defaultCarrierId = ""): GridRow {
  return {
    key: uid(),
    insuranceCompanyId: defaultCarrierId,
    producerId: "",
    year: defaultYear,
    month: defaultMonth,
    grossAmount: "",
    netAmount: "",
    reference: "",
    notes: "",
    paidOn: ""
  };
}

export function OverCommissionGridEditor({
  carriers, producers, defaultYear, defaultMonth, defaultCarrierId = "",
  onImported, onClose
}: {
  carriers: Carrier[];
  producers: Producer[];
  defaultYear: number;
  defaultMonth: number;
  defaultCarrierId?: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const key = useMemo(() => draftKey(defaultYear, defaultMonth), [defaultYear, defaultMonth]);

  const [rows, setRows] = useState<GridRow[]>(() => {
    // Draft restore on mount. If nothing is stored yet we open with 5 blank
    // rows — enough to feel like a spreadsheet without demanding the user
    // click "add row" before typing.
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftPayload;
        if (parsed.rows?.length) return parsed.rows;
      }
    } catch { /* corrupted draft — fall through to fresh */ }
    return Array.from({ length: 5 }, () => emptyRow(defaultYear, defaultMonth, defaultCarrierId));
  });

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; failed: number } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Autosave — debounced so we're not thrashing localStorage on every keystroke.
  // 500ms is fast enough that a browser crash never loses more than the last
  // half-second of typing but slow enough that the write coalesces bursts.
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const payload: DraftPayload = { version: 1, savedAt: new Date().toISOString(), rows };
      try {
        window.localStorage.setItem(key, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch {
        // Quota exceeded is possible on tiny devices — surface it once so
        // the operator doesn't wonder why their draft isn't sticking.
        setGlobalError("Δεν μπόρεσα να αποθηκεύσω πρόχειρο (πλήρες localStorage;).");
      }
    }, 500);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [rows, key]);

  const producerLookup = useMemo(() => {
    const m = new Map<string, Producer>();
    for (const p of producers) m.set(p.id, p);
    return m;
  }, [producers]);
  const carrierLookup = useMemo(() => {
    const m = new Map<string, Carrier>();
    for (const c of carriers) m.set(c.id, c);
    return m;
  }, [carriers]);

  const isRowComplete = useCallback((r: GridRow) => {
    return !!r.insuranceCompanyId && !!r.producerId
      && r.year >= 2000 && r.month >= 1 && r.month <= 12
      && r.grossAmount.trim() !== ""
      && !Number.isNaN(Number(r.grossAmount.replace(",", ".")));
  }, []);

  const isRowEmpty = useCallback((r: GridRow) => {
    return !r.insuranceCompanyId && !r.producerId
      && !r.grossAmount && !r.netAmount && !r.reference && !r.notes && !r.paidOn;
  }, []);

  const stats = useMemo(() => {
    let complete = 0, partial = 0, empty = 0, totalGross = 0;
    for (const r of rows) {
      if (isRowEmpty(r)) empty++;
      else if (isRowComplete(r)) {
        complete++;
        totalGross += Number(r.grossAmount.replace(",", ".")) || 0;
      } else partial++;
    }
    return { complete, partial, empty, totalGross, total: rows.length };
  }, [rows, isRowComplete, isRowEmpty]);

  const updateRow = useCallback((k: string, patch: Partial<GridRow>) => {
    setRows(prev => prev.map(r => r.key === k ? { ...r, ...patch, serverError: null, serverOk: undefined } : r));
  }, []);
  const removeRow = useCallback((k: string) => setRows(prev => prev.filter(r => r.key !== k)), []);
  const addRow = useCallback(() =>
    setRows(prev => [...prev, emptyRow(defaultYear, defaultMonth, defaultCarrierId)]),
    [defaultYear, defaultMonth, defaultCarrierId]);
  const addManyRows = useCallback((n: number) => {
    setRows(prev => [...prev, ...Array.from({ length: n },
      () => emptyRow(defaultYear, defaultMonth, defaultCarrierId))]);
  }, [defaultYear, defaultMonth, defaultCarrierId]);

  const bulk = useMutation({
    mutationFn: async () => {
      const completeRows = rows.filter(isRowComplete);
      const payload = completeRows.map(r => ({
        insuranceCompanyId: r.insuranceCompanyId,
        producerId: r.producerId,
        year: r.year,
        month: r.month,
        grossAmount: Number(r.grossAmount.replace(",", ".")),
        netAmount: r.netAmount.trim() === "" ? 0 : Number(r.netAmount.replace(",", ".")),
        currency: CURRENCY,
        reference: r.reference.trim() || null,
        notes: r.notes.trim() || null,
        paidOn: r.paidOn || null
      }));
      return {
        completeRows,
        result: (await api.post<{ inserted: number; updated: number; failed: number;
          rows: Array<{ index: number; success: boolean; error: string | null; id: string | null }>
        }>("/over-commission-statements/bulk", { rows: payload })).data
      };
    },
    onSuccess: ({ completeRows, result }) => {
      // Wire per-row backend feedback back into the grid so the operator
      // sees which rows landed and which need attention.
      setRows(prev => prev.map(r => {
        const originalIdx = completeRows.findIndex(c => c.key === r.key);
        if (originalIdx < 0) return r;
        const outcome = result.rows[originalIdx];
        if (!outcome) return r;
        return { ...r, serverOk: outcome.success, serverError: outcome.error };
      }));
      setImportResult({ inserted: result.inserted, updated: result.updated, failed: result.failed });
      onImported();
    },
    onError: (e) => setGlobalError(extractErrorMessage(e))
  });

  const clearAll = () => {
    setRows(Array.from({ length: 5 }, () => emptyRow(defaultYear, defaultMonth, defaultCarrierId)));
    setImportResult(null);
    setSavedAt(null);
    window.localStorage.removeItem(key);
    setConfirmClearOpen(false);
  };

  const clearImportedComplete = () => {
    // After a successful import the operator usually wants to purge the rows
    // that landed so they can key the next batch. Keep any row that still
    // has issues (serverError) or is not yet complete.
    setRows(prev => prev.filter(r => !(r.serverOk === true) || r.serverError));
    setImportResult(null);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800}>Grid Editor · Πινάκιο Υπερπρομηθειών</Typography>
            <Typography variant="caption" color="text.secondary">
              Πληκτρολόγησε γραμμή-γραμμή όπως σε Excel. Κάθε αλλαγή σώζεται στα <strong>πρόχειρα</strong> του browser.
              Πάτα «Εισαγωγή» για να στείλεις στο σύστημα.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {savedAt && (
              <Tooltip title={new Date(savedAt).toLocaleString("el-GR")}>
                <Chip size="small" color="default" variant="outlined" icon={<RestoreIcon />}
                  label="Αποθηκεύτηκε στα πρόχειρα" />
              </Tooltip>
            )}
            <Button size="small" variant="text" startIcon={<ClearAllIcon />}
              onClick={() => setConfirmClearOpen(true)}
              disabled={rows.every(isRowEmpty)}>
              Καθαρισμός
            </Button>
            <Button size="small" onClick={onClose}>Κλείσιμο editor</Button>
          </Stack>
        </Stack>
      </Box>

      {/* Header strip: totals + import */}
      <Box sx={{ p: 2, display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" } }}>
        <Mini label="Σύνολο γραμμές" value={stats.total} />
        <Mini label="Έτοιμες" value={stats.complete} color="success.main" />
        <Mini label="Ημιτελείς" value={stats.partial} color={stats.partial > 0 ? "warning.main" : "text.primary"} />
        <Mini label="Άδειες" value={stats.empty} color="text.secondary" />
        <Mini label="Σύνολο μικτά (έτοιμες)" value={moneyFmt.format(stats.totalGross)} highlight />
      </Box>

      {globalError && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }} onClose={() => setGlobalError(null)}>{globalError}</Alert>
      )}
      {importResult && (
        <Alert severity={importResult.failed > 0 ? "warning" : "success"} sx={{ mx: 2, mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={clearImportedComplete}>Κάθαρος πίνακας</Button>
              <Button color="inherit" size="small" onClick={() => setImportResult(null)}>Κλείσιμο</Button>
            </Stack>
          }>
          Εισαγωγή ολοκληρώθηκε: <strong>{importResult.inserted}</strong> νέες, <strong>{importResult.updated}</strong>{" "}
          ενημερώθηκαν{importResult.failed > 0 ? `, ${importResult.failed} απέτυχαν — δες τις κόκκινες γραμμές` : ""}.
        </Alert>
      )}

      {/* Grid */}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { verticalAlign: "top", py: 0.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }}>#</TableCell>
              <TableCell sx={{ minWidth: 200 }}>Ασφαλιστική *</TableCell>
              <TableCell sx={{ minWidth: 240 }}>Παραγωγός *</TableCell>
              <TableCell sx={{ width: 90 }}>Έτος *</TableCell>
              <TableCell sx={{ width: 130 }}>Μήνας *</TableCell>
              <TableCell sx={{ width: 130 }} align="right">Μικτά (€) *</TableCell>
              <TableCell sx={{ width: 130 }} align="right">Καθαρά (€)</TableCell>
              <TableCell sx={{ width: 150 }}>Reference</TableCell>
              <TableCell sx={{ width: 150 }}>Πληρωμή</TableCell>
              <TableCell sx={{ minWidth: 180 }}>Σημείωση</TableCell>
              <TableCell sx={{ width: 90 }} align="center">Status</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx) => {
              const complete = isRowComplete(r);
              const empty = isRowEmpty(r);
              const hasError = !!r.serverError;
              const rowBg = hasError ? "rgba(211,47,47,0.06)"
                          : r.serverOk ? "rgba(46,125,50,0.05)"
                          : "transparent";
              return (
                <TableRow key={r.key} hover sx={{ bgcolor: rowBg }}>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace" }}>{idx + 1}</TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      value={carrierLookup.get(r.insuranceCompanyId) ?? null}
                      onChange={(_, v) => updateRow(r.key, { insuranceCompanyId: v?.id ?? "" })}
                      options={carriers}
                      getOptionLabel={c => c.name}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      renderInput={(params) => <TextField {...params} placeholder="Ασφαλιστική" />}
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      value={producerLookup.get(r.producerId) ?? null}
                      onChange={(_, v) => updateRow(r.key, { producerId: v?.id ?? "" })}
                      options={producers}
                      getOptionLabel={p => p.code ? `${p.name} (${p.code})` : p.name}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      renderInput={(params) => <TextField {...params} placeholder="Παραγωγός" />}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={r.year}
                      onChange={e => updateRow(r.key, { year: Number(e.target.value) || r.year })}
                      inputProps={{ min: 2000, max: 2100 }} />
                  </TableCell>
                  <TableCell>
                    <TextField select size="small" value={r.month}
                      onChange={e => updateRow(r.key, { month: Number(e.target.value) })}>
                      {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <TextField size="small" value={r.grossAmount}
                      onChange={e => updateRow(r.key, { grossAmount: e.target.value })}
                      placeholder="0,00"
                      inputProps={{ style: { textAlign: "right", fontFamily: "monospace" } }} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField size="small" value={r.netAmount}
                      onChange={e => updateRow(r.key, { netAmount: e.target.value })}
                      placeholder="= μικτά"
                      inputProps={{ style: { textAlign: "right", fontFamily: "monospace" } }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={r.reference}
                      onChange={e => updateRow(r.key, { reference: e.target.value })}
                      placeholder="π.χ. 4/2026" />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="date" value={r.paidOn}
                      onChange={e => updateRow(r.key, { paidOn: e.target.value })}
                      InputLabelProps={{ shrink: true }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={r.notes}
                      onChange={e => updateRow(r.key, { notes: e.target.value })} />
                  </TableCell>
                  <TableCell align="center">
                    {hasError ? (
                      <Tooltip title={r.serverError!}>
                        <Chip size="small" color="error" icon={<WarningAmberIcon />} label="Σφάλμα" />
                      </Tooltip>
                    ) : r.serverOk ? (
                      <Chip size="small" color="success" icon={<CheckCircleIcon />} label="OK" />
                    ) : complete ? (
                      <Chip size="small" color="success" variant="outlined" label="Έτοιμη" />
                    ) : empty ? (
                      <Chip size="small" variant="outlined" label="Άδεια" sx={{ color: "text.disabled" }} />
                    ) : (
                      <Chip size="small" color="warning" variant="outlined" icon={<WarningAmberIcon />} label="Ημιτελής" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => removeRow(r.key)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Footer with add-row and import controls */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow}>Νέα γραμμή</Button>
          <Button size="small" onClick={() => addManyRows(5)}>+5</Button>
          <Button size="small" onClick={() => addManyRows(10)}>+10</Button>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {stats.complete} έτοιμες γραμμές θα εισαχθούν
          </Typography>
          <Button variant="contained" startIcon={<UploadFileIcon />}
            disabled={stats.complete === 0 || bulk.isPending}
            onClick={() => bulk.mutate()}>
            {bulk.isPending ? <CircularProgress size={16} /> : `Εισαγωγή ${stats.complete} γραμμών`}
          </Button>
        </Stack>
      </Box>

      <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Καθαρισμός προχείρου;</DialogTitle>
        <DialogContent>
          <Typography>Όλες οι γραμμές θα διαγραφούν από το πρόχειρο. Οι ήδη εισηγμένες στο σύστημα δεν πειράζονται.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)}>Ακύρωση</Button>
          <Button color="error" variant="contained" onClick={clearAll}>Καθαρισμός</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function Mini({ label, value, color, highlight }: {
  label: string;
  value: string | number;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, border: 1,
               borderColor: highlight ? "primary.main" : "divider",
               bgcolor: highlight ? "rgba(11,37,69,0.03)" : "transparent" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: color ?? "text.primary" }}>{value}</Typography>
    </Box>
  );
}
