import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Menu, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RestoreIcon from "@mui/icons-material/Restore";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { api, extractErrorMessage } from "../api/client";

/**
 * Μαζική Καταχώρηση Υπερπρομηθειών — Excel-like grid.
 *
 * The office keys the carrier's ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ row-by-row here
 * instead of opening the single-entry dialog N times. Every change is
 * autosaved to localStorage under a per-tenant / per-year-month key so a
 * mid-session refresh doesn't lose work.
 *
 * Column visibility is user-configurable and persisted; export produces
 * Excel / CSV / PDF (via print) so the accountant can share the completed
 * πινάκιο with the carrier or archive it.
 *
 * "Import all" hits the bulk-upsert endpoint which does upsert-by-natural
 * key on the backend — retrying an import for the same (carrier × producer
 * × month) tuple updates instead of duplicating.
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
  producerSharePercent: string;   // blank = 100
  reference: string;
  notes: string;
  paidOn: string;
  serverError?: string | null;
  serverOk?: boolean;
}

interface DraftPayload {
  version: 1;
  savedAt: string;
  rows: GridRow[];
}

// Column keys — the four mandatory ones (carrier/producer/year/month/gross)
// are always visible; the rest can be toggled off from the "Στήλες" menu.
type OptionalCol = "netAmount" | "producerSharePercent" | "producerAmount"
                 | "officeAmount" | "reference" | "paidOn" | "notes";
const OPTIONAL_COLS: { key: OptionalCol; label: string }[] = [
  { key: "netAmount",            label: "Καθαρά (€)" },
  { key: "producerSharePercent", label: "% Παραγωγού" },
  { key: "producerAmount",       label: "Ποσό παραγωγού" },
  { key: "officeAmount",         label: "Ποσό έδρας" },
  { key: "reference",            label: "Reference" },
  { key: "paidOn",               label: "Πληρωμή" },
  { key: "notes",                label: "Σημείωση" }
];
const DEFAULT_VISIBLE: Record<OptionalCol, boolean> = {
  netAmount: true, producerSharePercent: true, producerAmount: true,
  officeAmount: true, reference: true, paidOn: true, notes: true
};
const COL_VIS_KEY = "kalypsis.overCommissionCols.v1";

const CURRENCY = "EUR";
const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const uid = () => (crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const MONTHS = [
  { v: 1,  n: "01 · Ιαν" },  { v: 2,  n: "02 · Φεβ" }, { v: 3,  n: "03 · Μαρ" },
  { v: 4,  n: "04 · Απρ" },  { v: 5,  n: "05 · Μάι" }, { v: 6,  n: "06 · Ιουν" },
  { v: 7,  n: "07 · Ιουλ" }, { v: 8,  n: "08 · Αυγ" }, { v: 9,  n: "09 · Σεπ" },
  { v: 10, n: "10 · Οκτ" },  { v: 11, n: "11 · Νοε" }, { v: 12, n: "12 · Δεκ" },
];
const MONTH_NAME_LONG = [
  "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
  "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος"
];

function draftKey(defaultYear: number, defaultMonth: number) {
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
    producerSharePercent: "",
    reference: "",
    notes: "",
    paidOn: ""
  };
}

// Blank % means "everything to the producer". Clamps to [0, 100] so a stray
// keypress can't produce a nonsense share.
function parsePercent(raw: string): number {
  if (raw.trim() === "") return 100;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, n));
}
function splitRow(gross: number, pct: number): { producer: number; office: number } {
  const producer = Math.round(gross * pct) / 100;
  return { producer, office: Math.round((gross - producer) * 100) / 100 };
}
function loadColVisibility(): Record<OptionalCol, boolean> {
  try {
    const raw = window.localStorage.getItem(COL_VIS_KEY);
    if (raw) return { ...DEFAULT_VISIBLE, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return { ...DEFAULT_VISIBLE };
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
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftPayload;
        if (parsed.rows?.length) return parsed.rows;
      }
    } catch { /* corrupted draft — fresh */ }
    return Array.from({ length: 5 }, () => emptyRow(defaultYear, defaultMonth, defaultCarrierId));
  });

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; failed: number } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>(() => loadColVisibility());
  const [colMenuAnchor, setColMenuAnchor] = useState<HTMLElement | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(COL_VIS_KEY, JSON.stringify(visibleCols)); }
    catch { /* quota — non-fatal */ }
  }, [visibleCols]);

  // Debounced autosave — 500ms so a crash never loses more than half a
  // second of typing but bursts still coalesce.
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const payload: DraftPayload = { version: 1, savedAt: new Date().toISOString(), rows };
      try {
        window.localStorage.setItem(key, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch {
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
    let complete = 0, partial = 0, empty = 0, totalGross = 0, totalProducer = 0, totalOffice = 0;
    for (const r of rows) {
      if (isRowEmpty(r)) empty++;
      else if (isRowComplete(r)) {
        complete++;
        const gross = Number(r.grossAmount.replace(",", ".")) || 0;
        const pct = parsePercent(r.producerSharePercent);
        const { producer, office } = splitRow(gross, pct);
        totalGross += gross;
        totalProducer += producer;
        totalOffice += office;
      } else partial++;
    }
    return { complete, partial, empty, totalGross, totalProducer, totalOffice, total: rows.length };
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
        paidOn: r.paidOn || null,
        producerSharePercent: parsePercent(r.producerSharePercent)
      }));
      return {
        completeRows,
        result: (await api.post<{ inserted: number; updated: number; failed: number;
          rows: Array<{ index: number; success: boolean; error: string | null; id: string | null }>
        }>("/over-commission-statements/bulk", { rows: payload })).data
      };
    },
    onSuccess: ({ completeRows, result }) => {
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
    setRows(prev => prev.filter(r => !(r.serverOk === true) || r.serverError));
    setImportResult(null);
  };

  // ─── Exports ───────────────────────────────────────────────────────
  // Only "complete" rows are exported. If nothing is complete we bail with
  // a message so the operator doesn't get an empty file.
  const buildExportRows = () => {
    return rows.filter(isRowComplete).map(r => {
      const gross = Number(r.grossAmount.replace(",", ".")) || 0;
      const pct = parsePercent(r.producerSharePercent);
      const { producer, office } = splitRow(gross, pct);
      return {
        "Ασφαλιστική": carrierLookup.get(r.insuranceCompanyId)?.name ?? "",
        "Παραγωγός": producerLookup.get(r.producerId)?.name ?? "",
        "Κωδικός Παρ.": producerLookup.get(r.producerId)?.code ?? "",
        "Έτος": r.year,
        "Μήνας": r.month,
        "Μικτά (€)": gross,
        "Καθαρά (€)": r.netAmount.trim() === "" ? gross : Number(r.netAmount.replace(",", ".")),
        "% Παραγωγού": pct,
        "Ποσό Παραγωγού (€)": producer,
        "Ποσό Έδρας (€)": office,
        "Reference": r.reference,
        "Πληρωμή": r.paidOn,
        "Σημείωση": r.notes
      };
    });
  };

  const exportToExcel = () => {
    const data = buildExportRows();
    if (data.length === 0) { setGlobalError("Δεν υπάρχουν έτοιμες γραμμές για εξαγωγή."); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Υπερπρομήθειες");
    XLSX.writeFile(wb, `Υπερπρομήθειες_${defaultYear}-${String(defaultMonth).padStart(2,"0")}.xlsx`);
    setExportMenuAnchor(null);
  };
  const exportToCsv = () => {
    const data = buildExportRows();
    if (data.length === 0) { setGlobalError("Δεν υπάρχουν έτοιμες γραμμές για εξαγωγή."); return; }
    const headers = Object.keys(data[0]);
    // CSV escape: wrap in quotes, double-up embedded quotes. BOM prefix so
    // Greek characters render in Excel-on-Windows without manual encoding.
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(";"), ...data.map(r => headers.map(h => esc((r as Record<string, unknown>)[h])).join(";"))];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Υπερπρομήθειες_${defaultYear}-${String(defaultMonth).padStart(2,"0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuAnchor(null);
  };
  const exportToPdf = () => {
    // Opens a print window with a clean tabular view; the operator picks
    // "Save as PDF" from the browser's print dialog. Avoids pulling in
    // jsPDF + autotable just for this one flow.
    const data = buildExportRows();
    if (data.length === 0) { setGlobalError("Δεν υπάρχουν έτοιμες γραμμές για εξαγωγή."); return; }
    const headers = Object.keys(data[0]);
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Υπερπρομήθειες ${MONTH_NAME_LONG[defaultMonth-1]} ${defaultYear}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        h2{font-size:13px;font-weight:400;color:#555;margin:0 0 20px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#0b2545;color:#fff;font-weight:600}
        td.num{text-align:right;font-family:Consolas,Menlo,monospace}
        tfoot td{font-weight:700;background:#f5f5f5}
        @media print{ @page { size: A4 landscape; margin: 15mm } }
      </style></head><body>
      <h1>Πινάκιο Υπερπρομηθειών — ${MONTH_NAME_LONG[defaultMonth-1]} ${defaultYear}</h1>
      <h2>Εξαγωγή από Kalypsis · ${new Date().toLocaleString("el-GR")}</h2>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${data.map(r => `<tr>${headers.map(h => {
            const v = (r as Record<string, unknown>)[h];
            const numeric = typeof v === "number";
            return `<td class="${numeric ? "num" : ""}">${v == null ? "" : String(v)}</td>`;
          }).join("")}</tr>`).join("")}
        </tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 100);</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setGlobalError("Ο browser μπλόκαρε το νέο παράθυρο εκτύπωσης."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setExportMenuAnchor(null);
  };

  // Compact wrapper used for every editable cell so we get consistent
  // sizing without repeating the same sx block ten times.
  const cellField = { minWidth: 0, "& .MuiInputBase-input": { fontSize: 15, py: "10px" } };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(11,37,69,0.03)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800}>Μαζική Καταχώρηση Υπερπρομηθειών</Typography>
            <Typography variant="body2" color="text.secondary">
              Πληκτρολογήστε γραμμή-γραμμή όπως σε Excel. Κάθε αλλαγή σώζεται στα <strong>πρόχειρα</strong> του browser.
              Πατήστε «Εισαγωγή» για να στείλετε τις έτοιμες γραμμές στο σύστημα.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {savedAt && (
              <Tooltip title={new Date(savedAt).toLocaleString("el-GR")}>
                <Chip size="small" color="default" variant="outlined" icon={<RestoreIcon />}
                  label="Αποθηκεύτηκε στα πρόχειρα" />
              </Tooltip>
            )}
            <Button size="small" startIcon={<ViewColumnIcon />} variant="outlined"
              onClick={(e) => setColMenuAnchor(e.currentTarget)}>
              Στήλες
            </Button>
            <Button size="small" startIcon={<FileDownloadIcon />} variant="outlined"
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              disabled={stats.complete === 0}>
              Εξαγωγή
            </Button>
            <Button size="small" variant="text" startIcon={<ClearAllIcon />}
              onClick={() => setConfirmClearOpen(true)}
              disabled={rows.every(isRowEmpty)}>
              Καθαρισμός
            </Button>
            <Button size="small" onClick={onClose}>Κλείσιμο</Button>
          </Stack>
        </Stack>
      </Box>

      {/* Header strip: totals */}
      <Box sx={{ p: 2, display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr) repeat(3, 1fr)" } }}>
        <Mini label="Σύνολο γραμμές" value={stats.total} />
        <Mini label="Έτοιμες" value={stats.complete} color="success.main" />
        <Mini label="Ημιτελείς" value={stats.partial} color={stats.partial > 0 ? "warning.main" : "text.primary"} />
        <Mini label="Άδειες" value={stats.empty} color="text.secondary" />
        <Mini label="Μικτά (έτοιμες)" value={moneyFmt.format(stats.totalGross)} highlight />
        <Mini label="Στον παραγωγό" value={moneyFmt.format(stats.totalProducer)} color="success.main" />
        <Mini label="Στην έδρα" value={moneyFmt.format(stats.totalOffice)} color="info.main" />
      </Box>

      {globalError && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }} onClose={() => setGlobalError(null)}>{globalError}</Alert>
      )}
      {importResult && (
        <Alert severity={importResult.failed > 0 ? "warning" : "success"} sx={{ mx: 2, mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={clearImportedComplete}>Καθαρός πίνακας</Button>
              <Button color="inherit" size="small" onClick={() => setImportResult(null)}>Κλείσιμο</Button>
            </Stack>
          }>
          Εισαγωγή ολοκληρώθηκε: <strong>{importResult.inserted}</strong> νέες, <strong>{importResult.updated}</strong>{" "}
          ενημερώθηκαν{importResult.failed > 0 ? `, ${importResult.failed} απέτυχαν — δείτε τις κόκκινες γραμμές` : ""}.
        </Alert>
      )}

      {/* Grid */}
      <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ "& td, & th": { verticalAlign: "top", py: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }}>#</TableCell>
              <TableCell sx={{ minWidth: 240 }}>Ασφαλιστική *</TableCell>
              <TableCell sx={{ minWidth: 280 }}>Παραγωγός *</TableCell>
              <TableCell sx={{ width: 110 }}>Έτος *</TableCell>
              <TableCell sx={{ width: 160 }}>Μήνας *</TableCell>
              <TableCell sx={{ width: 160 }} align="right">Μικτά (€) *</TableCell>
              {visibleCols.netAmount            && <TableCell sx={{ width: 160 }} align="right">Καθαρά (€)</TableCell>}
              {visibleCols.producerSharePercent && <TableCell sx={{ width: 110 }} align="right">% Παρ.</TableCell>}
              {visibleCols.producerAmount       && <TableCell sx={{ width: 140 }} align="right">Παραγωγός</TableCell>}
              {visibleCols.officeAmount         && <TableCell sx={{ width: 140 }} align="right">Έδρα</TableCell>}
              {visibleCols.reference            && <TableCell sx={{ width: 180 }}>Reference</TableCell>}
              {visibleCols.paidOn               && <TableCell sx={{ width: 170 }}>Πληρωμή</TableCell>}
              {visibleCols.notes                && <TableCell sx={{ minWidth: 220 }}>Σημείωση</TableCell>}
              <TableCell sx={{ width: 110 }} align="center">Status</TableCell>
              <TableCell sx={{ width: 48 }} />
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
              const gross = Number(r.grossAmount.replace(",", ".")) || 0;
              const pct = parsePercent(r.producerSharePercent);
              const { producer, office } = splitRow(gross, pct);
              return (
                <TableRow key={r.key} hover sx={{ bgcolor: rowBg }}>
                  <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", pt: 2 }}>{idx + 1}</TableCell>
                  <TableCell>
                    <Autocomplete
                      value={carrierLookup.get(r.insuranceCompanyId) ?? null}
                      onChange={(_, v) => updateRow(r.key, { insuranceCompanyId: v?.id ?? "" })}
                      options={carriers}
                      getOptionLabel={c => c.name}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      renderInput={(params) => <TextField {...params} placeholder="Ασφαλιστική" sx={cellField} />}
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      value={producerLookup.get(r.producerId) ?? null}
                      onChange={(_, v) => updateRow(r.key, { producerId: v?.id ?? "" })}
                      options={producers}
                      getOptionLabel={p => p.code ? `${p.name} (${p.code})` : p.name}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      renderInput={(params) => <TextField {...params} placeholder="Παραγωγός" sx={cellField} />}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField type="number" value={r.year}
                      onChange={e => updateRow(r.key, { year: Number(e.target.value) || r.year })}
                      inputProps={{ min: 2000, max: 2100 }} sx={cellField} fullWidth />
                  </TableCell>
                  <TableCell>
                    <TextField select value={r.month}
                      onChange={e => updateRow(r.key, { month: Number(e.target.value) })}
                      sx={cellField} fullWidth>
                      {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <TextField value={r.grossAmount}
                      onChange={e => updateRow(r.key, { grossAmount: e.target.value })}
                      placeholder="0,00"
                      inputProps={{ style: { textAlign: "right", fontFamily: "monospace" } }}
                      sx={cellField} fullWidth />
                  </TableCell>
                  {visibleCols.netAmount && (
                    <TableCell align="right">
                      <TextField value={r.netAmount}
                        onChange={e => updateRow(r.key, { netAmount: e.target.value })}
                        placeholder="= μικτά"
                        inputProps={{ style: { textAlign: "right", fontFamily: "monospace" } }}
                        sx={cellField} fullWidth />
                    </TableCell>
                  )}
                  {visibleCols.producerSharePercent && (
                    <TableCell align="right">
                      <TextField value={r.producerSharePercent}
                        onChange={e => updateRow(r.key, { producerSharePercent: e.target.value })}
                        placeholder="100"
                        inputProps={{ style: { textAlign: "right", fontFamily: "monospace" }, min: 0, max: 100 }}
                        sx={cellField} fullWidth />
                    </TableCell>
                  )}
                  {visibleCols.producerAmount && (
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: gross > 0 ? "success.main" : "text.disabled", fontSize: 14, pt: 2 }}>
                      {gross > 0 ? moneyFmt.format(producer) : "—"}
                    </TableCell>
                  )}
                  {visibleCols.officeAmount && (
                    <TableCell align="right" sx={{ fontFamily: "monospace", color: gross > 0 && office > 0 ? "info.main" : "text.disabled", fontSize: 14, pt: 2 }}>
                      {gross > 0 ? moneyFmt.format(office) : "—"}
                    </TableCell>
                  )}
                  {visibleCols.reference && (
                    <TableCell>
                      <TextField value={r.reference}
                        onChange={e => updateRow(r.key, { reference: e.target.value })}
                        placeholder="π.χ. 4/2026" sx={cellField} fullWidth />
                    </TableCell>
                  )}
                  {visibleCols.paidOn && (
                    <TableCell>
                      <TextField type="date" value={r.paidOn}
                        onChange={e => updateRow(r.key, { paidOn: e.target.value })}
                        InputLabelProps={{ shrink: true }} sx={cellField} fullWidth />
                    </TableCell>
                  )}
                  {visibleCols.notes && (
                    <TableCell>
                      <TextField value={r.notes}
                        onChange={e => updateRow(r.key, { notes: e.target.value })}
                        sx={cellField} fullWidth />
                    </TableCell>
                  )}
                  <TableCell align="center" sx={{ pt: 2 }}>
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
                  <TableCell align="center" sx={{ pt: 1.5 }}>
                    <IconButton color="error" onClick={() => removeRow(r.key)}>
                      <DeleteIcon />
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
          <Button size="medium" startIcon={<AddIcon />} onClick={addRow}>Νέα γραμμή</Button>
          <Button size="small" onClick={() => addManyRows(5)}>+5</Button>
          <Button size="small" onClick={() => addManyRows(10)}>+10</Button>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {stats.complete} έτοιμες γραμμές θα εισαχθούν
          </Typography>
          <Button variant="contained" size="large" startIcon={<UploadFileIcon />}
            disabled={stats.complete === 0 || bulk.isPending}
            onClick={() => bulk.mutate()}>
            {bulk.isPending ? <CircularProgress size={16} /> : `Εισαγωγή ${stats.complete} γραμμών`}
          </Button>
        </Stack>
      </Box>

      {/* Column visibility menu */}
      <Menu anchorEl={colMenuAnchor} open={!!colMenuAnchor} onClose={() => setColMenuAnchor(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">Επιλέξτε στήλες που θα εμφανίζονται</Typography>
        </Box>
        {OPTIONAL_COLS.map(c => (
          <MenuItem key={c.key} onClick={() => setVisibleCols(v => ({ ...v, [c.key]: !v[c.key] }))}>
            <FormControlLabel
              sx={{ m: 0, width: "100%" }}
              control={<Checkbox size="small" checked={visibleCols[c.key]} />}
              label={c.label}
            />
          </MenuItem>
        ))}
        <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: "divider" }}>
          <Button size="small" onClick={() => setVisibleCols({ ...DEFAULT_VISIBLE })}>Επαναφορά</Button>
        </Box>
      </Menu>

      {/* Export menu */}
      <Menu anchorEl={exportMenuAnchor} open={!!exportMenuAnchor} onClose={() => setExportMenuAnchor(null)}>
        <MenuItem onClick={exportToExcel}>Excel (.xlsx)</MenuItem>
        <MenuItem onClick={exportToCsv}>CSV (.csv)</MenuItem>
        <MenuItem onClick={exportToPdf}>PDF (εκτύπωση)</MenuItem>
      </Menu>

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
