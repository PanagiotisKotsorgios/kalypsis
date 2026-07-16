import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Stack, Step, StepLabel, Stepper, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Visual bridge builder — lets the SuperAdmin author a carrier's bridge
 * config entirely in the browser, no code. Workflow:
 *
 *   1. File hints — pick file type, sheet, header row, encoding, delimiter
 *   2. Upload sample → detect columns → see first 10 raw rows
 *   3. Build mappings — one row per target field with source column +
 *      transform + optional regex + default
 *   4. Add row filters (skip lines where col X = Y)
 *   5. Set date format / decimal separator / currency strip
 *   6. Preview against the sample — see the mapped output
 *   7. Save. Config is versioned server-side.
 *
 * The saved config is stored per (carrier, recordType). The frontend TS shape
 * mirrors BridgeConfigDoc in the backend one-to-one.
 */

interface BridgeConfigDoc {
  fileType: "xlsx" | "csv" | "txt" | "zip";
  sheetName?: string | null;
  headerRow: number;
  csvDelimiter: string;
  encoding: string;
  skipRows: number;
  mappings: ColumnMapping[];
  filters: RowFilter[];
  dateFormat: string;
  decimalSeparator: string;
  currencyStrip?: string | null;
}
interface ColumnMapping {
  target: string;
  source: string;
  transform: "none" | "trim" | "upper" | "lower" | "digitsOnly" | "asDate" | "asNumber";
  defaultValue?: string | null;
  regexPattern?: string | null;
  regexReplacement?: string | null;
}
interface RowFilter {
  source: string;
  op: "equals" | "notEquals" | "contains" | "notEmpty" | "empty";
  value?: string | null;
}
interface DetectResult {
  columns: string[];
  totalRows: number;
  sampleRows: string[][];
  sheetNames: string[];
}
interface PreviewResult {
  totalRows: number;
  matchedRows: number;
  rows: Record<string, string>[];
  warnings: string[];
}
interface ExistingConfig {
  id: string;
  insuranceCompanyId: string;
  fileType: string;
  recordType: string;
  configJson: string;
  version: number;
  enabled: boolean;
  notes: string | null;
}

const EMPTY_CONFIG: BridgeConfigDoc = {
  fileType: "xlsx",
  sheetName: null,
  headerRow: 1,
  csvDelimiter: ";",
  encoding: "utf-8",
  skipRows: 0,
  mappings: [],
  filters: [],
  dateFormat: "dd/MM/yyyy",
  decimalSeparator: ",",
  currencyStrip: null
};

// Target-field suggestions per record type. The SuperAdmin can type anything —
// these are just quick-picks so the common insurance-domain fields don't need
// to be recalled from memory.
const TARGET_HINTS: Record<string, string[]> = {
  Policy: ["PolicyNumber", "CustomerAfm", "CustomerName", "InsuranceCompanyCode",
    "Branch", "Package", "StartDate", "EndDate", "GrossPremium", "NetPremium",
    "AgentCommission", "PlateNumber", "VehicleUse"],
  Customer: ["Afm", "FullName", "Email", "Phone", "Address", "City", "PostalCode", "TaxOffice"],
  Receipt: ["PolicyNumber", "ReceiptNumber", "PaidOn", "Amount", "PaymentMethod"],
  Commission: ["PolicyNumber", "PeriodFrom", "PeriodTo", "AgentCode", "GrossCommission", "NetCommission"]
};

const RECORD_TYPES = ["Policy", "Customer", "Receipt", "Commission"];
const TRANSFORM_OPTIONS: ColumnMapping["transform"][] = ["none", "trim", "upper", "lower", "digitsOnly", "asDate", "asNumber"];
const FILTER_OPS: RowFilter["op"][] = ["equals", "notEquals", "contains", "notEmpty", "empty"];

export function BridgeBuilderDialog({ open, carrier, onClose, onSaved }: {
  open: boolean;
  carrier: { id: string; name: string; code: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [recordType, setRecordType] = useState<string>("Policy");
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<BridgeConfigDoc>(EMPTY_CONFIG);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingConfig, setExistingConfig] = useState<ExistingConfig | null>(null);

  // Load existing config for this (carrier, recordType) so re-opening the
  // builder resumes where the operator left off instead of starting fresh.
  const existingQ = useQuery({
    queryKey: ["bridge-config", carrier?.id, recordType],
    enabled: open && !!carrier,
    queryFn: async () => (await api.get<ExistingConfig | null>(
      `/platform/carrier-bridge-configs/${carrier!.id}/${recordType}`)).data
  });

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSampleFile(null);
    setDetected(null);
    setPreview(null);
    setError(null);
  }, [open, carrier?.id]);

  useEffect(() => {
    // Only reset when the query settles for the current carrier — avoids the
    // "flash back to defaults then load" behavior on reopen.
    if (!existingQ.data) {
      setExistingConfig(null);
      setConfig(EMPTY_CONFIG);
      return;
    }
    setExistingConfig(existingQ.data);
    try {
      const parsed = JSON.parse(existingQ.data.configJson) as BridgeConfigDoc;
      setConfig({ ...EMPTY_CONFIG, ...parsed,
        mappings: parsed.mappings ?? [],
        filters: parsed.filters ?? [] });
    } catch {
      setConfig(EMPTY_CONFIG);
    }
  }, [existingQ.data]);

  const detect = useMutation({
    mutationFn: async () => {
      if (!sampleFile) throw new Error("Επιλέξτε αρχείο δείγματος.");
      const form = new FormData();
      form.append("file", sampleFile);
      form.append("fileType", config.fileType);
      form.append("sheetName", config.sheetName ?? "");
      form.append("headerRow", String(config.headerRow));
      form.append("csvDelimiter", config.csvDelimiter);
      form.append("encoding", config.encoding);
      return (await api.post<DetectResult>("/platform/carrier-bridge-configs/detect", form,
        { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (d) => {
      setDetected(d);
      // Auto-seed empty mappings from detected columns so the operator starts
      // with something concrete rather than a blank canvas.
      if (config.mappings.length === 0 && d.columns.length > 0) {
        setConfig(c => ({
          ...c,
          mappings: d.columns.slice(0, 8).map(col => ({
            target: col, source: col, transform: "none", defaultValue: null,
            regexPattern: null, regexReplacement: null
          }))
        }));
      }
      setError(null);
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const runPreview = useMutation({
    mutationFn: async () => {
      if (!sampleFile) throw new Error("Επιλέξτε αρχείο δείγματος στο βήμα 1.");
      const form = new FormData();
      form.append("file", sampleFile);
      form.append("fileType", config.fileType);
      form.append("configJson", JSON.stringify(config));
      return (await api.post<PreviewResult>("/platform/carrier-bridge-configs/preview", form,
        { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: (p) => { setPreview(p); setError(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!carrier) throw new Error("No carrier.");
      return (await api.put(`/platform/carrier-bridge-configs/${carrier.id}`, {
        fileType: config.fileType,
        recordType,
        configJson: JSON.stringify(config),
        enabled: true,
        notes: null
      })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bridge-config", carrier?.id, recordType] });
      onSaved();
    },
    onError: (e) => setError(extractErrorMessage(e))
  });

  const targetHints = useMemo(() => TARGET_HINTS[recordType] ?? [], [recordType]);
  const knownColumns = detected?.columns ?? [];

  if (!carrier) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={800}>Bridge Builder — {carrier.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
            {carrier.code} · Record type:
          </Typography>
          <TextField select size="small" value={recordType}
            onChange={e => setRecordType(e.target.value)}
            sx={{ ml: 1, minWidth: 140 }}>
            {RECORD_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {existingConfig && (
            <Chip size="small" color="info" label={`v${existingConfig.version}`} sx={{ ml: 1 }} />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step><StepLabel>Αρχείο & δείγμα</StepLabel></Step>
          <Step><StepLabel>Mappings</StepLabel></Step>
          <Step><StepLabel>Filters & format</StepLabel></Step>
          <Step><StepLabel>Preview & Save</StepLabel></Step>
        </Stepper>

        {step === 0 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField select label="Τύπος αρχείου" value={config.fileType}
                onChange={e => setConfig({ ...config, fileType: e.target.value as BridgeConfigDoc["fileType"] })}
                sx={{ minWidth: 140 }}>
                <MenuItem value="xlsx">xlsx</MenuItem>
                <MenuItem value="csv">csv</MenuItem>
                <MenuItem value="txt">txt (fixed/delimited)</MenuItem>
                <MenuItem value="zip">zip</MenuItem>
              </TextField>
              <TextField label="Header row" type="number" size="medium"
                value={config.headerRow}
                onChange={e => setConfig({ ...config, headerRow: Number(e.target.value) || 1 })}
                sx={{ minWidth: 140 }} />
              <TextField label="Skip rows" type="number" size="medium"
                value={config.skipRows}
                onChange={e => setConfig({ ...config, skipRows: Number(e.target.value) || 0 })}
                sx={{ minWidth: 140 }} />
              {config.fileType !== "xlsx" && (
                <>
                  <TextField label="Delimiter" value={config.csvDelimiter}
                    onChange={e => setConfig({ ...config, csvDelimiter: e.target.value })}
                    sx={{ minWidth: 100 }} />
                  <TextField select label="Encoding" value={config.encoding}
                    onChange={e => setConfig({ ...config, encoding: e.target.value })}
                    sx={{ minWidth: 180 }}>
                    <MenuItem value="utf-8">utf-8</MenuItem>
                    <MenuItem value="windows-1253">windows-1253</MenuItem>
                    <MenuItem value="iso-8859-7">iso-8859-7</MenuItem>
                  </TextField>
                </>
              )}
            </Stack>

            {config.fileType === "xlsx" && detected?.sheetNames && detected.sheetNames.length > 1 && (
              <TextField select label="Sheet" value={config.sheetName ?? ""}
                onChange={e => setConfig({ ...config, sheetName: e.target.value || null })}
                sx={{ maxWidth: 320 }}>
                <MenuItem value="">(πρώτο)</MenuItem>
                {detected.sheetNames.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            )}

            <Divider />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                {sampleFile ? sampleFile.name : "Επιλογή sample αρχείου"}
                <input hidden type="file" accept=".xlsx,.csv,.txt,.zip"
                  onChange={e => setSampleFile(e.target.files?.[0] ?? null)} />
              </Button>
              <Button variant="contained" disabled={!sampleFile || detect.isPending}
                onClick={() => detect.mutate()}>
                {detect.isPending ? <CircularProgress size={16} /> : "Ανίχνευση στηλών"}
              </Button>
            </Stack>

            {detected && (
              <>
                <Alert severity="success">
                  Βρέθηκαν <strong>{detected.columns.length}</strong> στήλες σε <strong>{detected.totalRows}</strong> γραμμές δεδομένων.
                </Alert>
                <Typography variant="overline" color="text.secondary">Πρώτες 10 γραμμές</Typography>
                <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {detected.columns.map((c, i) => (
                          <TableCell key={i} sx={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{c}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detected.sampleRows.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} sx={{ fontSize: 11, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </>
            )}
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Κάθε γραμμή αντιστοιχεί σε ένα πεδίο στόχο. Target = πώς θα λέγεται στο output.
              Source = ποια στήλη του αρχείου. Transform = μετασχηματισμός τιμής.
              «col:5» για επιλογή στήλης με θέση.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" alignSelf="center">Πρόσθεσε common target:</Typography>
              {targetHints.map(h => (
                <Chip key={h} label={h} size="small" variant="outlined"
                  onClick={() => setConfig(c => ({
                    ...c,
                    mappings: [...c.mappings, { target: h, source: knownColumns.includes(h) ? h : "",
                      transform: "trim", defaultValue: null, regexPattern: null, regexReplacement: null }]
                  }))} />
              ))}
              <Button size="small" startIcon={<AddIcon />}
                onClick={() => setConfig(c => ({
                  ...c,
                  mappings: [...c.mappings, { target: "", source: "", transform: "none",
                    defaultValue: null, regexPattern: null, regexReplacement: null }]
                }))}>
                Νέα γραμμή
              </Button>
            </Stack>

            <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 200 }}>Target</TableCell>
                    <TableCell sx={{ width: 200 }}>Source</TableCell>
                    <TableCell sx={{ width: 140 }}>Transform</TableCell>
                    <TableCell sx={{ width: 140 }}>Default</TableCell>
                    <TableCell>Regex</TableCell>
                    <TableCell sx={{ width: 60 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {config.mappings.length === 0 && (
                    <TableRow><TableCell colSpan={6} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                      Κανένα mapping. Πρόσθεσε από τα quick-picks ή «Νέα γραμμή».
                    </TableCell></TableRow>
                  )}
                  {config.mappings.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell><TextField size="small" fullWidth value={m.target}
                        onChange={e => updateMapping(i, { target: e.target.value })} /></TableCell>
                      <TableCell>
                        <TextField select={knownColumns.length > 0} size="small" fullWidth value={m.source}
                          onChange={e => updateMapping(i, { source: e.target.value })}>
                          {knownColumns.length === 0
                            ? <MenuItem value="">(no columns detected)</MenuItem>
                            : [<MenuItem key="_empty" value="">—</MenuItem>,
                               ...knownColumns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>),
                               <MenuItem key="_col" value="col:1">col:1 (by position)</MenuItem>]}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select size="small" fullWidth value={m.transform}
                          onChange={e => updateMapping(i, { transform: e.target.value as ColumnMapping["transform"] })}>
                          {TRANSFORM_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell><TextField size="small" fullWidth value={m.defaultValue ?? ""}
                        onChange={e => updateMapping(i, { defaultValue: e.target.value || null })} /></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <TextField size="small" placeholder="pattern" value={m.regexPattern ?? ""}
                            onChange={e => updateMapping(i, { regexPattern: e.target.value || null })} />
                          <TextField size="small" placeholder="replacement" value={m.regexReplacement ?? ""}
                            onChange={e => updateMapping(i, { regexReplacement: e.target.value || null })} />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error"
                          onClick={() => setConfig(c => ({ ...c, mappings: c.mappings.filter((_, idx) => idx !== i) }))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary">Row filters</Typography>
            <Typography variant="body2" color="text.secondary">
              Οι γραμμές που δεν περνούν όλα τα filters αγνοούνται.
            </Typography>
            <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell>Op</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell sx={{ width: 60 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {config.filters.length === 0 && (
                    <TableRow><TableCell colSpan={4} sx={{ py: 2, textAlign: "center", color: "text.secondary" }}>
                      Κανένα filter (όλες οι γραμμές περνάνε).
                    </TableCell></TableRow>
                  )}
                  {config.filters.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <TextField select={knownColumns.length > 0} size="small" fullWidth value={f.source}
                          onChange={e => updateFilter(i, { source: e.target.value })}>
                          {knownColumns.length === 0
                            ? <MenuItem value="">(no columns)</MenuItem>
                            : knownColumns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select size="small" fullWidth value={f.op}
                          onChange={e => updateFilter(i, { op: e.target.value as RowFilter["op"] })}>
                          {FILTER_OPS.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell><TextField size="small" fullWidth value={f.value ?? ""}
                        disabled={f.op === "notEmpty" || f.op === "empty"}
                        onChange={e => updateFilter(i, { value: e.target.value })} /></TableCell>
                      <TableCell>
                        <IconButton size="small" color="error"
                          onClick={() => setConfig(c => ({ ...c, filters: c.filters.filter((_, idx) => idx !== i) }))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => setConfig(c => ({
                ...c,
                filters: [...c.filters, { source: knownColumns[0] ?? "", op: "notEmpty", value: null }]
              }))}>
              Νέο filter
            </Button>

            <Divider sx={{ mt: 2 }} />
            <Typography variant="overline" color="text.secondary">Global format</Typography>
            <Stack direction="row" spacing={2}>
              <TextField label="Date format" value={config.dateFormat}
                onChange={e => setConfig({ ...config, dateFormat: e.target.value })}
                helperText="π.χ. dd/MM/yyyy" />
              <TextField label="Decimal sep" value={config.decimalSeparator}
                onChange={e => setConfig({ ...config, decimalSeparator: e.target.value })} />
              <TextField label="Currency strip" value={config.currencyStrip ?? ""}
                onChange={e => setConfig({ ...config, currencyStrip: e.target.value || null })}
                helperText="π.χ. € (θα αφαιρεθεί από numerics)" />
            </Stack>
          </Stack>
        )}

        {step === 3 && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained" startIcon={<PlayArrowIcon />}
                disabled={!sampleFile || runPreview.isPending || config.mappings.length === 0}
                onClick={() => runPreview.mutate()}>
                {runPreview.isPending ? <CircularProgress size={16} /> : "Preview με το sample"}
              </Button>
              {!sampleFile && (
                <Alert severity="warning" sx={{ py: 0, flex: 1 }}>
                  Ξαναγύρνα στο βήμα 1 για να ανεβάσεις sample αρχείο.
                </Alert>
              )}
            </Stack>

            {preview && (
              <>
                <Alert severity={preview.matchedRows === 0 ? "warning" : "success"}>
                  {preview.matchedRows} από {preview.totalRows} γραμμές πέρασαν τα filters.
                  Δείχνουμε τις πρώτες 20.
                </Alert>
                {preview.warnings.length > 0 && (
                  <Alert severity="warning">
                    <Typography variant="body2" fontWeight={700}>Warnings:</Typography>
                    {preview.warnings.map((w, i) => (
                      <Typography key={i} variant="caption" display="block" sx={{ fontFamily: "monospace" }}>· {w}</Typography>
                    ))}
                  </Alert>
                )}
                {preview.rows.length > 0 && (
                  <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {config.mappings.map(m => (
                            <TableCell key={m.target} sx={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {m.target}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.rows.map((row, i) => (
                          <TableRow key={i}>
                            {config.mappings.map(m => (
                              <TableCell key={m.target} sx={{ fontSize: 11, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {row[m.target] ?? ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Κλείσιμο</Button>
        <Box sx={{ flex: 1 }} />
        <Button disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Πίσω</Button>
        {step < 3 ? (
          <Tooltip title={step === 0 && !detected ? "Ανίχνευσε πρώτα τις στήλες" : ""}>
            <span>
              <Button variant="contained" disabled={step === 0 && !detected}
                onClick={() => setStep(s => Math.min(3, s + 1))}>
                Επόμενο
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Button variant="contained" color="success" startIcon={<SaveIcon />}
            disabled={save.isPending || config.mappings.length === 0}
            onClick={() => save.mutate()}>
            {save.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  function updateMapping(i: number, patch: Partial<ColumnMapping>) {
    setConfig(c => ({ ...c, mappings: c.mappings.map((m, idx) => idx === i ? { ...m, ...patch } : m) }));
  }
  function updateFilter(i: number, patch: Partial<RowFilter>) {
    setConfig(c => ({ ...c, filters: c.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  }
}
