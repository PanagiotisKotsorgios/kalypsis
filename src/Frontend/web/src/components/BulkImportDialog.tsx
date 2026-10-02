import { useRef, useState, type DragEvent } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography
} from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import * as XLSX from "xlsx";

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
    const header = columns.map(c => c.label);
    const sheet = XLSX.utils.aoa_to_sheet([header]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");
    const instructions = columns.map(c => [c.label, c.key, c.required ? "Required" : "Optional", c.example ?? ""]);
    const help = XLSX.utils.aoa_to_sheet([["Column", "Field key", "Rule", "Example"], ...instructions]);
    XLSX.utils.book_append_sheet(workbook, help, "Instructions");
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
