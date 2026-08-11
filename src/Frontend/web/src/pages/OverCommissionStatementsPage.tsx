import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PaidIcon from "@mui/icons-material/Paid";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GridOnIcon from "@mui/icons-material/GridOn";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { OverCommissionGridEditor } from "../components/OverCommissionGridEditor";

/**
 * Οικονομικά → Υπερπρομήθειες (per-producer per-month actuals).
 *
 * Each row records one line of a carrier's ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ statement:
 * how much the carrier paid a specific producer for a specific month, plus
 * an optional payment date. The upsert-by-natural-key on the backend means
 * re-entering the same (carrier, producer, month) tuple updates instead of
 * inserting a duplicate — safe to re-key from the file at end of month.
 */

interface StatementDto {
  id: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  producerId: string;
  producerName: string;
  producerCode: string | null;
  year: number;
  month: number;
  grossAmount: number;
  netAmount: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  paidOn: string | null;
  producerSharePercent: number;
  producerAmount: number;
  officeAmount: number;
  periodFrom: string | null;
  periodTo: string | null;
  createdAt: string;
}

interface Producer { id: string; name: string; code: string | null; }
interface Carrier  { id: string; name: string; code: string; }

const MONTHS = [
  { v: 1,  n: "Ιανουάριος" },  { v: 2,  n: "Φεβρουάριος" }, { v: 3,  n: "Μάρτιος" },
  { v: 4,  n: "Απρίλιος" },    { v: 5,  n: "Μάιος" },       { v: 6,  n: "Ιούνιος" },
  { v: 7,  n: "Ιούλιος" },     { v: 8,  n: "Αύγουστος" },   { v: 9,  n: "Σεπτέμβριος" },
  { v: 10, n: "Οκτώβριος" },   { v: 11, n: "Νοέμβριος" },   { v: 12, n: "Δεκέμβριος" },
];

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });

/** Build a YYYY-MM-DD from (year, month, day) — used to compare a
 *  statement's period against the "Από/Έως" filter when no paidOn exists. */
function isoOfPeriod(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function OverCommissionStatementsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number | "">(now.getMonth() + 1);
  const [carrierFilter, setCarrierFilter] = useState<string>("");
  const [producerFilter, setProducerFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<StatementDto | null | "new">(null);
  const [error, setError] = useState<string | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  // Advanced filter fields (client-side over the already-loaded month set).
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo]   = useState<string>("");
  const [paidFilter, setPaidFilter] = useState<"" | "paid" | "unpaid">("");
  // Deep-link ?openImport=ergo (from OverCommissionBridgesPage) auto-opens
  // the μαζική καταχώρηση grid + tells the grid to preselect ERGO layout.
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLayout, setInitialLayout] = useState<"ergo" | undefined>(undefined);
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    if (searchParams.get("openImport") === "ergo") {
      setGridOpen(true);
      setInitialLayout("ergo");
      autoOpened.current = true;
      // Clean the URL so a page refresh doesn't keep re-opening.
      const next = new URLSearchParams(searchParams);
      next.delete("openImport");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const carriersQ = useQuery({
    // onlyUsed=true → dropdown shows only the office's own carriers,
    // not the platform-wide catalog. Keeps the picker focused on the
    // insurers the γραφείο actually works with.
    queryKey: ["insurance-companies-min", "onlyUsed"],
    queryFn: async () => (await api.get<Carrier[]>("/insurance-companies", { params: { onlyUsed: true } })).data
  });
  const producersQ = useQuery({
    queryKey: ["producers-min"],
    queryFn: async () => (await api.get<Producer[]>("/producers")).data
  });
  const listQ = useQuery({
    queryKey: ["over-commission-statements", year, month, carrierFilter, producerFilter, search],
    queryFn: async () => (await api.get<StatementDto[]>("/over-commission-statements", { params: {
      year, month: month || undefined,
      insuranceCompanyId: carrierFilter || undefined,
      producerId: producerFilter || undefined,
      search: search || undefined
    }})).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/over-commission-statements/${id}`); },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["over-commission-statements"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const rawRows = listQ.data ?? [];
  const rows = useMemo(() => {
    // Apply date range + paid-status filters on top of the backend list.
    let r = rawRows;
    if (dateFrom) {
      r = r.filter(x => {
        const ref = x.paidOn ?? isoOfPeriod(x.year, x.month, 1);
        return ref >= dateFrom;
      });
    }
    if (dateTo) {
      r = r.filter(x => {
        const ref = x.paidOn ?? isoOfPeriod(x.year, x.month, 28);
        return ref <= dateTo;
      });
    }
    if (paidFilter === "paid")   r = r.filter(x => !!x.paidOn);
    if (paidFilter === "unpaid") r = r.filter(x => !x.paidOn);
    return r;
  }, [rawRows, dateFrom, dateTo, paidFilter]);
  const totals = useMemo(() => ({
    gross: rows.reduce((s, r) => s + r.grossAmount, 0),
    net: rows.reduce((s, r) => s + r.netAmount, 0),
    producer: rows.reduce((s, r) => s + (r.producerAmount ?? r.grossAmount), 0),
    office: rows.reduce((s, r) => s + (r.officeAmount ?? 0), 0),
    paidCount: rows.filter(r => r.paidOn).length,
    unpaidGross: rows.filter(r => !r.paidOn).reduce((s, r) => s + r.grossAmount, 0)
  }), [rows]);

  /** Export the currently-filtered rows in CSV / XLSX / print. */
  const exportRows = (kind: "csv" | "xlsx" | "print") => {
    if (rows.length === 0) { setError("Δεν υπάρχουν γραμμές για εξαγωγή."); return; }
    const headers = [
      "Έτος","Μήνας","Ασφαλιστική","Παραγωγός","Κωδικός",
      "Μικτά (€)","Καθαρά (€)","% Παραγωγού",
      "Στον παραγωγό (€)","Στην έδρα / υπερπρομήθεια (€)",
      "Reference","Πληρωμή","Σημείωση"
    ];
    const data = rows.map(r => [
      r.year, r.month, r.insuranceCompanyName, r.producerName, r.producerCode ?? "",
      r.grossAmount, r.netAmount, r.producerSharePercent,
      r.producerAmount ?? r.grossAmount, r.officeAmount ?? 0,
      r.reference ?? "", r.paidOn ?? "", r.notes ?? ""
    ]);
    if (kind === "csv") {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [headers.join(";"), ...data.map(row => row.map(esc).join(";"))];
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overcommissions_${year}${month ? "-" + String(month).padStart(2,"0") : ""}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (kind === "xlsx") {
      // Load SheetJS lazily so this page doesn't pull it on first paint.
      import("xlsx").then(XLSX => {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Υπερπρομήθειες");
        XLSX.writeFile(wb, `overcommissions_${year}${month ? "-" + String(month).padStart(2,"0") : ""}.xlsx`);
      });
      return;
    }
    // print
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Υπερπρομήθειες ${year}${month ? "/" + String(month).padStart(2,"0") : ""}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 10px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
        th{background:#0b2545;color:#fff;font-weight:600}
        td.num{text-align:right;font-family:Consolas,monospace}
        tfoot td{background:#f5f5f5;font-weight:700}
        @media print{ @page { size: A4 landscape; margin: 12mm } }
      </style></head><body>
      <h1>Υπερπρομήθειες παραγωγών · ${year}${month ? "/" + String(month).padStart(2,"0") : ""}
          · ${rows.length} γραμμές · Έδρα: ${moneyFmt.format(totals.office)}</h1>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${data.map(r => `<tr>${r.map((v,i)=>
          `<td class="${i>=5&&i<=9?"num":""}">${v ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),100);</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setError("Ο browser μπλόκαρε το νέο παράθυρο."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ReceiptLongIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Υπερπρομήθειες Παραγωγών</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Καταχώρηση της μηνιαίας υπερπρομήθειας ανά παραγωγό και ασφαλιστική εταιρεία — μία γραμμή για κάθε
            γραμμή του πινακίου (ERGO, Ατλαντική, Grand Cover, κτλ.).
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/app/over-commissions"
            variant="outlined" size="large">
            Παραμετρικοί κανόνες (%)
          </Button>
          <Button startIcon={<GridOnIcon />} variant="outlined" size="large"
            color={gridOpen ? "primary" : "inherit"}
            onClick={() => setGridOpen(v => !v)}>
            {gridOpen ? "Απόκρυψη Μαζικής Καταχώρησης" : "Μαζική Καταχώρηση"}
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" size="large"
            onClick={() => setDialog("new")}>
            Νέα εγγραφή
          </Button>
        </Stack>
      </Stack>

      {gridOpen && (
        <OverCommissionGridEditor
          carriers={carriersQ.data ?? []}
          producers={producersQ.data ?? []}
          defaultYear={year}
          defaultMonth={typeof month === "number" ? month : now.getMonth() + 1}
          defaultCarrierId={carrierFilter}
          initialLayout={initialLayout}
          onImported={() => qc.invalidateQueries({ queryKey: ["over-commission-statements"] })}
          onClose={() => setGridOpen(false)}
        />
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Totals strip */}
      {(() => {
        // Auto-percentages of the producer/έδρα split against gross —
        // handles negatives + zero-gross gracefully.
        const denom = Math.abs(totals.gross);
        const pct = (v: number) => denom > 0
          ? `${((v / totals.gross) * 100).toFixed(1)}%`
          : "—";
        const pctFmt = (v: number) =>
          denom > 0 ? `${moneyFmt.format(v)}  ·  ${pct(v)}` : moneyFmt.format(v);
        return (
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3,1fr) repeat(3,1fr)" }, mb: 3 }}>
            <Kpi label="Σύνολο μικτά" value={moneyFmt.format(totals.gross)} />
            <Kpi label="Σύνολο καθαρά" value={moneyFmt.format(totals.net)} />
            <Kpi label="Πληρωμένες γραμμές" value={`${totals.paidCount} / ${rows.length}`} />
            <Kpi label="Στον παραγωγό (€ · %)" value={pctFmt(totals.producer)} color="success.main" />
            <Kpi label="Στην έδρα / υπερπρομήθεια (€ · %)" value={pctFmt(totals.office)} color="info.main" />
            <Kpi label="Απλήρωτο (μικτά)" value={moneyFmt.format(totals.unpaidGross)} color="warning.main" />
          </Box>
        );
      })()}

      {/* Filters */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField type="number" size="small" label="Έτος" value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
            sx={{ width: 110 }} />
          <TextField select size="small" label="Μήνας" value={month}
            onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 160 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Ασφαλιστική" value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">Όλες</MenuItem>
            {(carriersQ.data ?? []).map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Παραγωγός" value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)} sx={{ minWidth: 240 }}>
            <MenuItem value="">Όλοι</MenuItem>
            {(producersQ.data ?? []).map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Αναζήτηση" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="όνομα / κωδικός / reference" sx={{ minWidth: 220 }} />
          <TextField type="date" size="small" label="Από" InputLabelProps={{ shrink: true }}
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            sx={{ minWidth: 160 }} />
          <TextField type="date" size="small" label="Έως" InputLabelProps={{ shrink: true }}
            value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            sx={{ minWidth: 160 }} />
          <TextField select size="small" label="Πληρωμή" value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value as "" | "paid" | "unpaid")}
            sx={{ minWidth: 140 }}>
            <MenuItem value="">Όλα</MenuItem>
            <MenuItem value="paid">Πληρωμένα</MenuItem>
            <MenuItem value="unpaid">Απλήρωτα</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" onClick={() => exportRows("csv")}>
            Εξαγωγή CSV
          </Button>
          <Button size="small" variant="outlined" onClick={() => exportRows("xlsx")}>
            Εξαγωγή XLSX
          </Button>
          <Button size="small" variant="outlined" onClick={() => exportRows("print")}>
            🖨 Εκτύπωση
          </Button>
          <Chip label={`${rows.length} γραμμές · ${moneyFmt.format(totals.office)} στην έδρα`} />
        </Stack>
      </Card>

      {/* Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Περίοδος</TableCell>
                <TableCell>Ασφαλιστική</TableCell>
                <TableCell>Παραγωγός</TableCell>
                <TableCell align="right">Μικτά</TableCell>
                <TableCell align="right">Καθαρά</TableCell>
                <TableCell align="right">% Παρ.</TableCell>
                <TableCell align="right">Παραγωγός</TableCell>
                <TableCell align="right">Έδρα</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Πληρωμή</TableCell>
                <TableCell align="right">Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow><TableCell colSpan={11} sx={{ py: 4, textAlign: "center" }}>
                  <CircularProgress size={22} />
                </TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={11} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Καμία εγγραφή για αυτή την περίοδο. Πάτα «Νέα εγγραφή» για να ξεκινήσεις.
                </TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip size="small" label={`${r.month.toString().padStart(2, "0")}/${r.year}`} />
                  </TableCell>
                  <TableCell>{r.insuranceCompanyName}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{r.producerName}</Typography>
                    {r.producerCode && (
                      <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                        {r.producerCode}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {moneyFmt.format(r.grossAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                    {moneyFmt.format(r.netAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {(r.producerSharePercent ?? 100).toFixed(1)}%
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>
                    {moneyFmt.format(r.producerAmount ?? r.grossAmount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace", color: "info.main" }}>
                    {moneyFmt.format(r.officeAmount ?? 0)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{r.reference ?? "—"}</TableCell>
                  <TableCell>
                    {r.paidOn ? (
                      <Chip size="small" color="success" icon={<PaidIcon />}
                        label={new Date(r.paidOn).toLocaleDateString("el-GR")} />
                    ) : (
                      <Chip size="small" color="warning" variant="outlined" label="Απλήρωτη" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Επεξεργασία">
                      <IconButton size="small" onClick={() => setDialog(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Διαγραφή">
                      <IconButton size="small" color="error"
                        onClick={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(r.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntryDialog
        open={!!dialog}
        entry={dialog === "new" ? null : dialog}
        defaultYear={year}
        defaultMonth={typeof month === "number" ? month : now.getMonth() + 1}
        carriers={carriersQ.data ?? []}
        producers={producersQ.data ?? []}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          qc.invalidateQueries({ queryKey: ["over-commission-statements"] });
        }}
      />
    </Box>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.5, color }}>{value}</Typography>
    </Card>
  );
}

function EntryDialog({ open, entry, defaultYear, defaultMonth, carriers, producers, onClose, onSaved }: {
  open: boolean;
  entry: StatementDto | null;
  defaultYear: number;
  defaultMonth: number;
  carriers: Carrier[];
  producers: Producer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    insuranceCompanyId: "",
    producerId: "",
    year: defaultYear,
    month: defaultMonth,
    grossAmount: 0,
    netAmount: 0,
    producerSharePercent: 100,
    currency: "EUR",
    reference: "",
    notes: "",
    paidOn: "",
    useCustomPeriod: false,
    periodFrom: "",
    periodTo: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        insuranceCompanyId: entry.insuranceCompanyId,
        producerId: entry.producerId,
        year: entry.year,
        month: entry.month,
        grossAmount: entry.grossAmount,
        netAmount: entry.netAmount,
        producerSharePercent: entry.producerSharePercent ?? 100,
        currency: entry.currency,
        reference: entry.reference ?? "",
        notes: entry.notes ?? "",
        paidOn: entry.paidOn?.slice(0, 10) ?? "",
        useCustomPeriod: !!(entry.periodFrom || entry.periodTo),
        periodFrom: entry.periodFrom?.slice(0, 10) ?? "",
        periodTo: entry.periodTo?.slice(0, 10) ?? ""
      });
    } else {
      setForm({
        insuranceCompanyId: "", producerId: "",
        year: defaultYear, month: defaultMonth,
        grossAmount: 0, netAmount: 0,
        producerSharePercent: 100,
        currency: "EUR",
        reference: "", notes: "", paidOn: "",
        useCustomPeriod: false, periodFrom: "", periodTo: ""
      });
    }
    setError(null);
  }, [open, entry, defaultYear, defaultMonth]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        insuranceCompanyId: form.insuranceCompanyId,
        producerId: form.producerId,
        year: form.year, month: form.month,
        grossAmount: form.grossAmount,
        netAmount: form.netAmount || form.grossAmount,
        currency: form.currency,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
        paidOn: form.paidOn || null,
        producerSharePercent: Math.min(100, Math.max(0, form.producerSharePercent)),
        periodFrom: form.useCustomPeriod && form.periodFrom ? form.periodFrom : null,
        periodTo:   form.useCustomPeriod && form.periodTo   ? form.periodTo   : null,
      };
      if (entry) return (await api.put(`/over-commission-statements/${entry.id}`, body)).data;
      return (await api.post("/over-commission-statements", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(extractErrorMessage(e))
  });

  const valid = form.insuranceCompanyId && form.producerId
    && form.year >= 2000 && form.month >= 1 && form.month <= 12
    && form.grossAmount >= 0;

  // ── Derived calculations exposed to the user ──────────────────────
  const gross = form.grossAmount || 0;
  const net = form.netAmount || 0;
  const pct = Math.min(100, Math.max(0, form.producerSharePercent));
  // If net is blank/0 the backend treats it as = gross. Reflect that here
  // so the "taxes" number doesn't look like the whole gross was withheld.
  const effectiveNet = net > 0 ? net : gross;
  const taxes = Math.max(0, gross - effectiveNet);
  const netPercentOfGross = gross > 0 ? (effectiveNet / gross) * 100 : 0;
  const taxPercentOfGross = gross > 0 ? (taxes / gross) * 100 : 0;
  const producerCommission = Math.round(effectiveNet * pct) / 100;
  const officeOverCommission = Math.round((effectiveNet - producerCommission) * 100) / 100;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{entry ? "Επεξεργασία εγγραφής" : "Νέα εγγραφή υπερπρομήθειας"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField select label="Ασφαλιστική εταιρεία" required fullWidth
              value={form.insuranceCompanyId}
              onChange={(e) => setForm({ ...form, insuranceCompanyId: e.target.value })}>
              {carriers.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField select label="Παραγωγός" required fullWidth
            value={form.producerId}
            onChange={(e) => setForm({ ...form, producerId: e.target.value })}>
            {producers.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField type="number" label="Έτος" required value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) || form.year })}
              sx={{ width: 130 }} />
            <TextField select label="Μήνας" required value={form.month}
              onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              sx={{ minWidth: 180 }}>
              {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField type="number" label="Μικτά (€)" required fullWidth
              value={form.grossAmount}
              onChange={(e) => setForm({ ...form, grossAmount: Number(e.target.value) || 0 })}
              inputProps={{ step: "0.01", min: 0 }} />
            <TextField type="number" label="Καθαρά (€)" fullWidth
              value={form.netAmount}
              onChange={(e) => setForm({ ...form, netAmount: Number(e.target.value) || 0 })}
              helperText="Άφησέ το 0 = ίδιο με μικτά"
              inputProps={{ step: "0.01", min: 0 }} />
          </Stack>
          {/* Computed KPIs from Gross + Net */}
          <Card variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(31,123,179,0.04)" }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined"
                label={`Καθαρά επί μικτών: ${netPercentOfGross.toFixed(2)}%`} />
              <Chip size="small" variant="outlined" color="warning"
                label={`Φόροι/κρατήσεις: ${moneyFmt.format(taxes)} (${taxPercentOfGross.toFixed(2)}%)`} />
              <Chip size="small" color="success"
                label={`Προμήθεια παραγωγού: ${moneyFmt.format(producerCommission)}`} />
              <Chip size="small" color="info"
                label={`Υπερπρομήθεια (καθαρή έδρας): ${moneyFmt.format(officeOverCommission)}`} />
            </Stack>
          </Card>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField type="number" label="% Παραγωγού επί καθαρών" required
              value={form.producerSharePercent}
              onChange={(e) => setForm({ ...form, producerSharePercent: Number(e.target.value) })}
              inputProps={{ step: "0.01", min: 0, max: 100 }}
              helperText="Ό,τι μένει (100 − x) πάει στην έδρα ως υπερπρομήθεια."
              sx={{ width: 240 }} />
          </Stack>
          <TextField label="Reference (π.χ. αρ. πινακίου)" fullWidth value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="ΠΙΝΑΚΙΟ ΥΠΕΡΠΡΟΜΗΘΕΙΩΝ ERGO 4/2026" />

          {/* Optional custom period — otherwise Year+Month above are the period. */}
          <Card variant="outlined" sx={{ p: 1.5 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={form.useCustomPeriod}
                onChange={(e) => setForm({ ...form, useCustomPeriod: e.target.checked })} />}
              label="Καθορισμός διάρκειας (από — έως)"
            />
            {form.useCustomPeriod && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
                <TextField type="date" label="Από" fullWidth InputLabelProps={{ shrink: true }}
                  value={form.periodFrom}
                  onChange={(e) => setForm({ ...form, periodFrom: e.target.value })} />
                <TextField type="date" label="Έως" fullWidth InputLabelProps={{ shrink: true }}
                  value={form.periodTo}
                  onChange={(e) => setForm({ ...form, periodTo: e.target.value })} />
              </Stack>
            )}
            {!form.useCustomPeriod && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Χωρίς επιλογή, η περίοδος είναι ολόκληρος ο μήνας {form.month.toString().padStart(2,"0")}/{form.year}.
              </Typography>
            )}
          </Card>

          <TextField label="Ημ/νία πληρωμής (προαιρετικό)" type="date" fullWidth
            InputLabelProps={{ shrink: true }}
            value={form.paidOn}
            onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
            helperText="Άφησέ το κενό αν δεν έχει πληρωθεί ακόμη" />
          <TextField label="Σημείωση" fullWidth multiline minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || save.isPending}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
