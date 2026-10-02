import { useRef, useState, type DragEvent } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography
} from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
// xlsx-js-style keeps the SheetJS parser/API but adds the small set of cell
// styles we need for operator-friendly templates (dark header, white text).
// The rest of the application can continue to use the regular xlsx package
// for read-only previews.
import * as XLSX from "xlsx-js-style";

export interface BulkImportColumn {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors?: string[];
  /** Rows that can be corrected and retried without re-importing successes. */
  failedRows?: Record<string, string>[];
}

export interface BulkImportDialogProps {
  open: boolean;
  title: string;
  description: string;
  columns: BulkImportColumn[];
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<BulkImportResult>;
}

/**
 * Shared spreadsheet import surface. It deliberately parses the file in the
 * browser first, shows a preview, and only then calls the page-specific
 * importer. This keeps the same safe drag/drop + template experience while
 * allowing each domain to retain its own server validation and permissions.
 */
export function BulkImportDialog({ open, title, description, columns, onClose, onImport }: BulkImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setRows([]); setFileName(""); setError(null); setResult(null); };
  const close = () => { if (!busy) { reset(); onClose(); } };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const headerStyle = {
      fill: { fgColor: { rgb: "17365D" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "17365D" } },
        bottom: { style: "thin", color: { rgb: "17365D" } },
        left: { style: "thin", color: { rgb: "17365D" } },
        right: { style: "thin", color: { rgb: "17365D" } },
      },
    };
    const requiredStyle = { font: { color: { rgb: "9C0006" } }, fill: { fgColor: { rgb: "FFC7CE" } } };
    const applyHeader = (sheet: XLSX.WorkSheet, row: number, count: number) => {
      for (let index = 0; index < count; index += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index })];
        if (cell) cell.s = headerStyle;
      }
      sheet["!rows"] = [{ hpt: row === 0 ? 30 : 24 }];
    };

    // The first two rows are intentionally human-readable: they remain in
    // the downloaded workbook but are skipped by the importer because the
    // table header is still the first row. Operators can fill row 2 onward.
    const header = columns.map(c => c.label);
    const sheet = XLSX.utils.aoa_to_sheet([header]);
    applyHeader(sheet, 0, columns.length);
    sheet["!cols"] = columns.map(c => ({ wch: Math.max(16, Math.min(34, c.label.length + 5)) }));
    sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(Math.max(0, columns.length - 1))}1` };
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.WSKeys;
    columns.forEach((column, index) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: index })];
      if (cell && column.required) cell.s = { ...headerStyle, fill: { fgColor: { rgb: "7F1D1D" } } };
    });
    XLSX.utils.book_append_sheet(workbook, sheet, "Συμπλήρωση");

    const instructions = columns.map(c => [c.label, c.key, c.required ? "Υποχρεωτικό" : "Προαιρετικό", c.example ?? ""]);
    const help = XLSX.utils.aoa_to_sheet([
      ["Οδηγίες συμπλήρωσης", "", "", ""],
      ["Συμπληρώστε μία εγγραφή ανά γραμμή στο φύλλο «Συμπλήρωση». Μην αλλάξετε τις επικεφαλίδες.", "", "", ""],
      ["Στήλη", "Τεχνικό πεδίο", "Κανόνας", "Παράδειγμα"],
      ...instructions,
    ]);
    applyHeader(help, 2, 4);
    help["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ];
    help["!cols"] = [{ wch: 36 }, { wch: 28 }, { wch: 18 }, { wch: 32 }];
    help["A1"].s = { fill: { fgColor: { rgb: "17365D" } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 } };
    help["A2"].s = { font: { italic: true, color: { rgb: "404040" } }, alignment: { wrapText: true } };
    for (let index = 0; index < columns.length; index += 1) {
      const cell = help[XLSX.utils.encode_cell({ r: index + 3, c: 2 })];
      if (cell && columns[index]?.required) cell.s = requiredStyle;
    }
    XLSX.utils.book_append_sheet(workbook, help, "Οδηγίες");
    XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-template.xlsx`);
  };

  const parseFile = async (file: File) => {
    setError(null); setResult(null); setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const first = workbook.SheetNames[0];
      if (!first) throw new Error("Το αρχείο δεν περιέχει φύλλο δεδομένων.");
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], { defval: "", raw: false });
      const aliases = new Map<string, string>();
      for (const column of columns) {
        aliases.set(column.key.toLowerCase(), column.key);
        aliases.set(column.label.toLowerCase(), column.key);
      }
      const normalized = parsed.map(row => {
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          const canonical = aliases.get(key.replace(/^\uFEFF/, "").trim().toLowerCase());
          if (canonical) next[canonical] = String(value ?? "").trim();
        }
        return next;
      }).filter(row => Object.values(row).some(value => value.length > 0));
      const missing = columns.filter(c => c.required && !normalized.some(row => (row[c.key] ?? "").trim())).map(c => c.label);
      if (missing.length) throw new Error(`Λείπουν υποχρεωτικά πεδία: ${missing.join(", ")}`);
      if (!normalized.length) throw new Error("Δεν βρέθηκαν γραμμές δεδομένων.");
      setRows(normalized);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Δεν ήταν δυνατή η ανάγνωση του αρχείου.");
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void parseFile(file);
  };

  const importRows = async () => {
    if (!rows.length) return;
    setBusy(true); setError(null);
    try {
      const next = await onImport(rows);
      setResult(next);
      setRows(next.failedRows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Η εισαγωγή απέτυχε.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography color="text.secondary">{description}</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button startIcon={<DownloadOutlinedIcon />} variant="outlined" onClick={downloadTemplate}>
              Λήψη προτύπου XLSX
            </Button>
            <Button startIcon={<UploadFileOutlinedIcon />} variant="contained" onClick={() => inputRef.current?.click()}>
              Επιλογή αρχείου
            </Button>
            <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={e => {
              const file = e.target.files?.[0]; if (file) void parseFile(file); e.currentTarget.value = "";
            }} />
          </Stack>
          <Box onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}
            sx={{ border: "2px dashed", borderColor: "primary.main", borderRadius: 2, p: 3, textAlign: "center", cursor: "pointer", bgcolor: "action.hover" }}>
            <UploadFileOutlinedIcon color="primary" sx={{ fontSize: 34 }} />
            <Typography fontWeight={700}>Σύρετε το XLSX/CSV εδώ</Typography>
            <Typography variant="body2" color="text.secondary">{fileName || "ή πατήστε για επιλογή αρχείου"}</Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {result && <Alert severity={result.failed ? "warning" : "success"} icon={result.failed ? undefined : <CheckCircleOutlineIcon /> }>
            Εισήχθησαν {result.imported} γραμμές{result.failed ? ` · Απέτυχαν ${result.failed}` : ""}.
            {result.errors?.length ? <Box component="ul" sx={{ mb: 0, pl: 2 }}>{result.errors.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</Box> : null}
          </Alert>}
          {rows.length > 0 && <>
            <Divider />
            <Typography fontWeight={700}>Προεπισκόπηση · {rows.length} γραμμές</Typography>
            <Box sx={{ maxHeight: 300, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>{columns.map(c => <TableCell key={c.key}>{c.label}{c.required ? " *" : ""}</TableCell>)}</TableRow></TableHead>
                <TableBody>{rows.slice(0, 20).map((row, i) => <TableRow key={i}>{columns.map(c => <TableCell key={c.key}>{row[c.key] || "—"}</TableCell>)}</TableRow>)}</TableBody>
              </Table>
            </Box>
            {rows.length > 20 && <Typography variant="caption" color="text.secondary">Εμφανίζονται οι πρώτες 20 γραμμές.</Typography>}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy}>Κλείσιμο</Button>
        <Button variant="contained" onClick={() => void importRows()} disabled={!rows.length || busy}>
          {busy ? <CircularProgress size={18} /> : `Εισαγωγή ${rows.length || ""} γραμμών`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
