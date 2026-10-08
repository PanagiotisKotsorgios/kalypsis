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
import BarChartIcon from "@mui/icons-material/BarChart";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { OverCommissionGridEditor } from "../components/OverCommissionGridEditor";
import { exportActionSx, printActionSx } from "../components/actionButtonStyles";
import {
  BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";

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
  // 4-column context from carriers' πινάκια (ERGO ships all four).
  basePremiumsGross: number | null;
  basePremiumsNet: number | null;
  producerDirectCommission: number | null;
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

function statementTotals(items: StatementDto[]) {
  return {
    count: items.length,
    gross: items.reduce((sum, row) => sum + row.grossAmount, 0),
    net: items.reduce((sum, row) => sum + row.netAmount, 0),
    producer: items.reduce((sum, row) => sum + (row.producerAmount ?? row.grossAmount), 0),
    office: items.reduce((sum, row) => sum + (row.officeAmount ?? 0), 0),
    paid: items.filter(row => !!row.paidOn).length,
  };
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
  const [groupBy, setGroupBy] = useState<"producer" | "month" | "carrier" | "none">("producer");
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsDimension, setStatsDimension] = useState<"producer" | "month" | "carrier">("producer");
  const [selectedStatsGroup, setSelectedStatsGroup] = useState<string | null>(null);
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
  const officeQ = useQuery({
    queryKey: ["agency-profile", "export"],
    queryFn: async () => (await api.get<{
      name?: string | null; code?: string | null; contactEmail?: string | null;
      contactPhone?: string | null; addressLine?: string | null; vatNumber?: string | null;
    }>("/agency-profile")).data,
    staleTime: 5 * 60 * 1000,
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
  const groupedSections = useMemo(() => {
    if (groupBy === "none") return [] as Array<{ key: string; rows: StatementDto[] }>;
    const groups = new Map<string, StatementDto[]>();
    for (const row of rows) {
      const key = groupBy === "producer"
        ? `${row.producerName}${row.producerCode ? ` · ${row.producerCode}` : ""}`
        : groupBy === "carrier"
          ? row.insuranceCompanyName
          : `${row.month.toString().padStart(2, "0")}/${row.year}`;
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    }
    return Array.from(groups, ([key, groupedRows]) => ({ key, rows: groupedRows }))
      .sort((a, b) => a.key.localeCompare(b.key, "el"));
  }, [rows, groupBy]);
  const totals = useMemo(() => ({
    // These four columns come straight from carrier πινάκια (ERGO ships
    // all four; other carriers may leave the base-premium ones null).
    // Users read them 1:1 against the carrier's PDF.
    basePremiumsGross:  rows.reduce((s, r) => s + (r.basePremiumsGross ?? 0), 0),
    basePremiumsNet:    rows.reduce((s, r) => s + (r.basePremiumsNet ?? 0), 0),
    producerDirect:     rows.reduce((s, r) => s + (r.producerDirectCommission ?? 0), 0),
    // Over-commission bonus totals — this is what we actually book.
    overCommissionGross: rows.reduce((s, r) => s + r.grossAmount, 0),
    overCommissionNet:   rows.reduce((s, r) => s + r.netAmount, 0),
    // Split of the bonus after applying the per-row producer share %.
    producer: rows.reduce((s, r) => s + (r.producerAmount ?? r.grossAmount), 0),
    office:   rows.reduce((s, r) => s + (r.officeAmount ?? 0), 0),
    paidCount: rows.filter(r => r.paidOn).length,
    unpaidGross: rows.filter(r => !r.paidOn).reduce((s, r) => s + r.grossAmount, 0),
  }), [rows]);

  const statsGroups = useMemo(() => {
    const groups = new Map<string, StatementDto[]>();
    for (const row of rows) {
      const key = statsDimension === "producer"
        ? `${row.producerName}${row.producerCode ? ` · ${row.producerCode}` : ""}`
        : statsDimension === "carrier"
          ? row.insuranceCompanyName
          : `${row.month.toString().padStart(2, "0")}/${row.year}`;
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    }
    return Array.from(groups, ([key, groupedRows]) => ({
      key,
      summary: statementTotals(groupedRows),
    })).sort((a, b) => a.key.localeCompare(b.key, "el"));
  }, [rows, statsDimension]);
  const statsChartData = statsGroups.map(group => ({
    key: group.key,
    name: group.key.length > 22 ? `${group.key.slice(0, 20)}…` : group.key,
    gross: group.summary.gross,
    net: group.summary.net,
    producer: group.summary.producer,
    office: group.summary.office,
  }));
  const selectedStats = statsGroups.find(group => group.key === selectedStatsGroup) ?? null;
  const statsSplitTotal = Math.abs(totals.producer) + Math.abs(totals.office);
  const statsProducerPercent = statsSplitTotal > 0 ? Math.abs(totals.producer) / statsSplitTotal * 100 : 0;
  const statsOfficePercent = statsSplitTotal > 0 ? Math.abs(totals.office) / statsSplitTotal * 100 : 0;

  // Print-column picker — operators asked for the ability to pick which
  // columns to show on the printed πινάκιο (some just want carrier /
  // producer / office amount; others want the full 13-column set). Ticks
  // are persisted in localStorage so the operator's choice sticks.
  const PRINT_COL_STORAGE = "kalypsis.overCommission.printCols.v1";
  const PRINT_COLS: { key: string; label: string; numeric?: boolean; get: (r: StatementDto) => string | number }[] = [
    { key: "year",           label: "Έτος",                                 get: r => r.year },
    { key: "month",          label: "Μήνας",                                get: r => r.month },
    { key: "carrier",        label: "Ασφαλιστική",                          get: r => r.insuranceCompanyName },
    { key: "producer",       label: "Παραγωγός",                            get: r => r.producerName },
    { key: "producerCode",   label: "Κωδικός",                              get: r => r.producerCode ?? "" },
    { key: "gross",          label: "Μικτά (€)",                     numeric:true, get: r => r.grossAmount },
    { key: "net",            label: "Καθαρά (€)",                    numeric:true, get: r => r.netAmount },
    { key: "sharePercent",   label: "% Παραγωγού",                   numeric:true, get: r => r.producerSharePercent },
    { key: "producerAmount", label: "Στον παραγωγό (€)",             numeric:true, get: r => r.producerAmount ?? r.grossAmount },
    { key: "officeAmount",   label: "Στην έδρα / υπερπρομήθεια (€)", numeric:true, get: r => r.officeAmount ?? 0 },
    { key: "reference",      label: "Reference",                            get: r => r.reference ?? "" },
    { key: "paidOn",         label: "Πληρωμή",                              get: r => r.paidOn ?? "" },
    { key: "notes",          label: "Σημείωση",                             get: r => r.notes ?? "" },
  ];
  const DEFAULT_PRINT_COLS = new Set(PRINT_COLS.map(c => c.key));
  const [printColsOpen, setPrintColsOpen] = useState(false);
  const [selectedPrintCols, setSelectedPrintCols] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_PRINT_COLS);
    try {
      const stored = localStorage.getItem(PRINT_COL_STORAGE);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set(DEFAULT_PRINT_COLS);
  });
  const togglePrintCol = (key: string) => setSelectedPrintCols(prev => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    try { localStorage.setItem(PRINT_COL_STORAGE, JSON.stringify(Array.from(n))); } catch { /* ignore */ }
    return n;
  });
  const setAllPrintCols = (mode: "all" | "none" | "reset") => setSelectedPrintCols(() => {
    const n = mode === "none" ? new Set<string>() : new Set(DEFAULT_PRINT_COLS);
    try { localStorage.setItem(PRINT_COL_STORAGE, JSON.stringify(Array.from(n))); } catch { /* ignore */ }
    return n;
  });

  /** Export the currently-filtered rows in CSV / XLSX / print. */
  const exportRows = (kind: "csv" | "xlsx" | "print") => {
    if (rows.length === 0) { setError("Δεν υπάρχουν γραμμές για εξαγωγή."); return; }
    // Every format uses the same columns selected for the visible statement
    // table, so print, CSV and Excel never drift apart.
    const activeCols = PRINT_COLS.filter(c => selectedPrintCols.has(c.key));
    if (activeCols.length === 0) {
      setError("Επιλέξτε τουλάχιστον μία στήλη για εκτύπωση.");
      return;
    }
    const headers = activeCols.map(c => c.label);
    const data = rows.map(r => activeCols.map(c => c.get(r)));
    const numericFlags = activeCols.map(c => !!c.numeric);
    const office = officeQ.data;
    const officeDetails = [office?.addressLine, office?.contactPhone, office?.contactEmail,
      office?.vatNumber ? `ΑΦΜ: ${office.vatNumber}` : null,
      office?.code ? `Κωδικός: ${office.code}` : null]
      .filter(Boolean).join(" · ");
    const totalValues: Record<string, string | number> = {
      year: "Σύνολα", gross: totals.basePremiumsGross, net: totals.basePremiumsNet,
      producerAmount: totals.producer, officeAmount: totals.office,
      paidOn: `${totals.paidCount}/${rows.length}`
    };
    const totalData = activeCols.map(c => totalValues[c.key] ?? "");
    if (kind === "csv") {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        esc(office?.name ?? "Kalypsis"), esc(officeDetails),
        esc(`Υπερπρομήθειες ${year}${month ? `/${String(month).padStart(2, "0")}` : ""}`), "",
        headers.map(esc).join(";"), ...data.map(row => row.map(esc).join(";")),
        totalData.map(esc).join(";"), "© Kalypsis · https://mykalypsis.gr"
      ];
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
        const ws = XLSX.utils.aoa_to_sheet([
          [office?.name ?? "Kalypsis"], [officeDetails],
          [`Υπερπρομήθειες ${year}${month ? `/${String(month).padStart(2, "0")}` : ""}`], [],
          headers, ...data, totalData
        ]);
        const totalRow = 5 + data.length;
        for (let c = 0; c < headers.length; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: totalRow - 1, c })];
          if (cell) cell.s = { fill: { fgColor: { rgb: "E8F5E9" } }, font: { bold: true, color: { rgb: "1B5E20" } } };
        }
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
        th{background:#0b2545;color:#fff;font-weight:600;border-right:1px solid #49627d}
        td+td,th+th{border-left:1px solid #d9e2ec}
        td.num{text-align:right;font-family:Consolas,monospace}
        tfoot td{background:#e8f5e9;color:#1b5e20;font-weight:700;border-top:2px solid #66bb6a}
        @media print{ @page { size: A4 landscape; margin: 12mm } }
      </style></head><body>
      <h1>Υπερπρομήθειες παραγωγών · ${year}${month ? "/" + String(month).padStart(2,"0") : ""}
          · ${rows.length} γραμμές · Έδρα: ${moneyFmt.format(totals.office)}</h1>
      <div class="office">${office?.name ?? "Kalypsis"}${officeDetails ? ` · ${officeDetails}` : ""}</div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${data.map(r => `<tr>${r.map((v,i)=>
          `<td class="${numericFlags[i]?"num":""}">${v ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
        <tfoot><tr>${totalData.map((v,i)=>`<td class="${numericFlags[i]?"num":""}">${v ?? ""}</td>`).join("")}</tr></tfoot>
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

      <Stack direction="row" justifyContent="flex-end" mb={1}>
        <Button
          variant="contained"
          startIcon={<BarChartIcon />}
          onClick={() => setStatsOpen(true)}
          sx={{ fontWeight: 800, borderRadius: 2 }}
        >
          Στατιστικά
        </Button>
      </Stack>

      {/* ── Totals strip — mirrors the ERGO πινάκιο 1:1 ────────────
          Row 1: the four money columns straight off the carrier statement
                 (ΜΙΚΤΑ ασφάλιστρα · ΚΑΘΑΡΑ ασφάλιστρα · ΠΡΟΜ.ΣΥΝΕΡΓΑΤΗ ·
                 ΥΠΕΡΠΡΟΜΗΘΕΙΑ), so the operator can reconcile the totals
                 shown here against the ERGO PDF footer without doing math.
          Row 2: how the over-commission bonus is split (producer vs office),
                 plus the paid/unpaid slice — the operational view. */}
      <Box sx={{ display: "none" }}>{(() => {
        const denom = Math.abs(totals.overCommissionGross);
        const pct = (v: number) => denom > 0 ? `${((v / totals.overCommissionGross) * 100).toFixed(1)}%` : "—";
        const pctFmt = (v: number) => denom > 0 ? `${moneyFmt.format(v)}  ·  ${pct(v)}` : moneyFmt.format(v);
        return (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em", textTransform: "uppercase", display: "block", mb: 0.75 }}>
              Ροή πινακίου
            </Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 2 }}>
              <Kpi label="Μικτά ασφάλιστρα (βάση)"    value={moneyFmt.format(totals.basePremiumsGross)} />
              <Kpi label="Καθαρά ασφάλιστρα (βάση)"   value={moneyFmt.format(totals.basePremiumsNet)} />
              <Kpi label="Προμήθεια συνεργάτη (άμεση)" value={moneyFmt.format(totals.producerDirect)} color="text.primary" />
              <Kpi label="Υπερπρομήθεια (bonus)"      value={moneyFmt.format(totals.overCommissionGross)} color="info.main" />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em", textTransform: "uppercase", display: "block", mb: 0.75 }}>
              Καταμερισμός υπερπρομήθειας
            </Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, mb: 3 }}>
              <Kpi label="Στον παραγωγό (€ · %)"                   value={pctFmt(totals.producer)} color="success.main" />
              <Kpi label="Στην έδρα / υπερπρομήθεια (€ · %)"       value={pctFmt(totals.office)}   color="info.main" />
              <Kpi label="Πληρωμένες γραμμές"                      value={`${totals.paidCount} / ${rows.length}`} />
              <Kpi label="Απλήρωτο (bonus)"                        value={moneyFmt.format(totals.unpaidGross)} color="warning.main" />
            </Box>
          </>
        );
      })()}</Box>

      {/* Filters — dense 4-col grid, ~2 lines on desktop (9 controls +
          clear + counter). Exports moved to their own row above so the
          filter bar stays a single visual block. */}
      <Stack direction="row" spacing={1} justifyContent="flex-end" mb={1} alignItems="center">
        <Tooltip title="Επιλέξτε ποιές στήλες θα εμφανίζονται στο εκτυπωμένο πινάκιο">
          <Button size="small" variant="text" onClick={() => setPrintColsOpen(true)}>
            Στήλες εκτύπωσης ({selectedPrintCols.size}/{PRINT_COLS.length})
          </Button>
        </Tooltip>
        <Button size="small" variant="outlined" sx={exportActionSx} onClick={() => exportRows("csv")}>Εξαγωγή CSV</Button>
        <Button size="small" variant="outlined" sx={exportActionSx} onClick={() => exportRows("xlsx")}>Εξαγωγή XLSX</Button>
        <Button size="small" variant="outlined" sx={printActionSx} onClick={() => exportRows("print")}>🖨 Εκτύπωση</Button>
      </Stack>

      <Dialog open={printColsOpen} onClose={() => setPrintColsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Στήλες προς εκτύπωση</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" mb={1} display="block">
            Επιλέξτε ποιες στήλες θέλετε να εμφανίζονται στο πινάκιο και στις εξαγωγές CSV/XLSX.
            Η επιλογή αποθηκεύεται τοπικά.
          </Typography>
          <Stack>
            {PRINT_COLS.map(c => (
              <FormControlLabel key={c.key}
                control={<Checkbox size="small" checked={selectedPrintCols.has(c.key)} onChange={() => togglePrintCol(c.key)} />}
                label={c.label} />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllPrintCols("none")}>Καμία</Button>
          <Button onClick={() => setAllPrintCols("all")}>Όλες</Button>
          <Button onClick={() => setAllPrintCols("reset")}>Επαναφορά</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setPrintColsOpen(false)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Box sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          alignItems: "center",
        }}>
          <TextField type="number" size="small" label="Έτος" fullWidth value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)} />
          <TextField select size="small" label="Μήνας" fullWidth value={month}
            onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))}>
            <MenuItem value="">Όλοι</MenuItem>
            {MONTHS.map(m => <MenuItem key={m.v} value={m.v}>{m.n}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Ασφαλιστική" fullWidth value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}>
            <MenuItem value="">Όλες</MenuItem>
            {(carriersQ.data ?? []).map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Παραγωγός" fullWidth value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)}>
            <MenuItem value="">Όλοι</MenuItem>
            {(producersQ.data ?? []).map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Αναζήτηση" fullWidth value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="όνομα / κωδικός / reference"
            sx={{ gridColumn: { md: "span 2" } }} />
          <TextField type="date" size="small" label="Από" InputLabelProps={{ shrink: true }} fullWidth
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <TextField type="date" size="small" label="Έως" InputLabelProps={{ shrink: true }} fullWidth
            value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <TextField select size="small" label="Πληρωμή" fullWidth value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value as "" | "paid" | "unpaid")}>
            <MenuItem value="">Όλα</MenuItem>
            <MenuItem value="paid">Πληρωμένα</MenuItem>
            <MenuItem value="unpaid">Απλήρωτα</MenuItem>
          </TextField>
          <TextField select size="small" label="Ομαδοποίηση" fullWidth value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "producer" | "month" | "carrier" | "none")}>
            <MenuItem value="producer">Ανά συνεργάτη</MenuItem>
            <MenuItem value="month">Ανά περίοδο</MenuItem>
            <MenuItem value="carrier">Ανά ασφαλιστική</MenuItem>
            <MenuItem value="none">Χωρίς υποομάδες</MenuItem>
          </TextField>
          <Chip label={`${rows.length} γραμμές · ${moneyFmt.format(totals.office)} στην έδρα`}
            sx={{ gridColumn: { md: "span 2" }, justifySelf: "start" }} />
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={() => {
              setCarrierFilter(""); setProducerFilter(""); setSearch("");
              setDateFrom(""); setDateTo(""); setPaidFilter(""); setMonth(""); setGroupBy("producer");
            }}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </Card>

      {groupBy !== "none" && groupedSections.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={800} mb={1}>
              Σύνολα ανά {groupBy === "producer" ? "συνεργάτη" : groupBy === "month" ? "περίοδο" : "ασφαλιστική"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "rgba(11,37,69,0.06)" }}>
                  <TableCell>Ομάδα</TableCell>
                  <TableCell align="right">Πλήθος</TableCell>
                  <TableCell align="right">Μεικτά</TableCell>
                  <TableCell align="right">Καθαρά</TableCell>
                  <TableCell align="right">Συνεργάτης</TableCell>
                  <TableCell align="right">Έδρα</TableCell>
                  <TableCell align="right">Πληρωμένα</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedSections.map(section => {
                  const summary = statementTotals(section.rows);
                  return (
                    <TableRow key={section.key} hover>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{section.key}</TableCell>
                      <TableCell align="right">{summary.count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(31,123,179,0.09)" }}>{moneyFmt.format(summary.gross)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(46,125,50,0.12)", color: "success.dark" }}>{moneyFmt.format(summary.net)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(46,125,50,0.12)", color: "success.dark" }}>{moneyFmt.format(summary.producer)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(31,123,179,0.09)", color: "info.dark" }}>{moneyFmt.format(summary.office)}</TableCell>
                      <TableCell align="right">{summary.paid} / {summary.count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
              ) : groupBy === "none" ? (
                rows.map(r => (
                  <StatementTableRow
                    key={r.id}
                    row={r}
                    onEdit={() => setDialog(r)}
                    onDelete={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(r.id); }}
                  />
                ))
              ) : (
                groupedSections.flatMap(section => {
                  const summary = statementTotals(section.rows);
                  return [
                    <TableRow key={`group-${section.key}`} sx={{ bgcolor: "action.hover" }}>
                      <TableCell colSpan={11} sx={{ fontWeight: 800, color: "primary.main", py: 1 }}>
                        {section.key}
                        <Typography component="span" sx={{ ml: 1, color: "text.secondary", fontSize: 12, fontWeight: 500 }}>
                          · {summary.count} εγγραφές · {moneyFmt.format(summary.gross)} μεικτά · {moneyFmt.format(summary.office)} έδρα
                        </Typography>
                      </TableCell>
                    </TableRow>,
                    ...section.rows.map(r => (
                      <StatementTableRow
                        key={r.id}
                        row={r}
                        onEdit={() => setDialog(r)}
                        onDelete={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(r.id); }}
                      />
                    )),
                    <TableRow key={`subtotal-${section.key}`} sx={{
                      bgcolor: "rgba(46,125,50,0.10)",
                      borderTop: "2px solid",
                      borderColor: "rgba(46,125,50,0.28)",
                      "& .MuiTableCell-root": { py: 0.85 },
                    }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 800, color: "success.dark", whiteSpace: "nowrap" }}>
                        Υποσύνολο · {section.key}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>{moneyFmt.format(summary.gross)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "success.dark" }}>{moneyFmt.format(summary.net)}</TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "success.dark" }}>{moneyFmt.format(summary.producer)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: "info.dark" }}>{moneyFmt.format(summary.office)}</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{summary.paid}/{summary.count}</TableCell>
                    </TableRow>,
                  ];
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={statsOpen} onClose={() => setStatsOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 800 }}>Στατιστικά υπερπρομηθειών</DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={2}>
            <Button variant={statsDimension === "producer" ? "contained" : "outlined"} onClick={() => { setStatsDimension("producer"); setSelectedStatsGroup(null); }}>Ανά συνεργάτη</Button>
            <Button variant={statsDimension === "month" ? "contained" : "outlined"} onClick={() => { setStatsDimension("month"); setSelectedStatsGroup(null); }}>Ανά περίοδο</Button>
            <Button variant={statsDimension === "carrier" ? "contained" : "outlined"} onClick={() => { setStatsDimension("carrier"); setSelectedStatsGroup(null); }}>Ανά ασφαλιστική</Button>
          </Stack>

          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, mb: 2 }}>
            <Kpi label="Μικτά ασφάλιστρα (βάση)" value={moneyFmt.format(totals.basePremiumsGross)} />
            <Kpi label="Καθαρά ασφάλιστρα (βάση)" value={moneyFmt.format(totals.basePremiumsNet)} />
            <Kpi label="Προμήθεια συνεργάτη (άμεση)" value={moneyFmt.format(totals.producerDirect)} />
            <Kpi label="Υπερπρομήθεια (bonus)" value={moneyFmt.format(totals.overCommissionGross)} color="info.main" />
            <Kpi label="Στον παραγωγό (€ · %)" value={`${moneyFmt.format(totals.producer)} · ${statsSplitTotal > 0 ? statsProducerPercent.toFixed(1) : "0.0"}%`} color="success.main" />
            <Kpi label="Στην έδρα / υπερπρομήθεια (€ · %)" value={`${moneyFmt.format(totals.office)} · ${statsSplitTotal > 0 ? statsOfficePercent.toFixed(1) : "0.0"}%`} color="info.main" />
            <Kpi label="Πληρωμένες γραμμές" value={`${totals.paidCount} / ${rows.length}`} />
            <Kpi label="Απλήρωτο (bonus)" value={moneyFmt.format(totals.unpaidGross)} color="warning.main" />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(280px, 1fr)" } }}>
            <Card variant="outlined" sx={{ p: 2, minHeight: 360 }}>
              <Typography fontWeight={800} mb={1}>Ροή ποσών ανά {statsDimension === "producer" ? "συνεργάτη" : statsDimension === "month" ? "περίοδο" : "ασφαλιστική"}</Typography>
              {statsChartData.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 10, textAlign: "center" }}>Δεν υπάρχουν δεδομένα για τα επιλεγμένα φίλτρα.</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statsChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }} onClick={(state) => {
                    const key = (state as { activePayload?: Array<{ payload?: { key?: string } }> } | undefined)?.activePayload?.[0]?.payload?.key;
                    if (key) setSelectedStatsGroup(key);
                  }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => moneyFmt.format(value)} width={82} />
                    <RechartsTooltip formatter={(value) => moneyFmt.format(Number(value ?? 0))} />
                    <Legend />
                    <Bar dataKey="gross" name="Υπερπρομήθεια" fill="#1f7bb3" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="producer" name="Συνεργάτης" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="office" name="Έδρα" fill="#0b2545" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {selectedStats && (
                <Box sx={{ mt: 1, p: 1.25, borderRadius: 1.5, bgcolor: "action.hover" }}>
                  <Typography variant="caption" color="text.secondary">Επιλεγμένη ομάδα</Typography>
                  <Typography fontWeight={800}>{selectedStats.key}</Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" mt={0.5}>
                    <Typography variant="body2">Bonus: <b>{moneyFmt.format(selectedStats.summary.gross)}</b></Typography>
                    <Typography variant="body2">Συνεργάτης: <b>{moneyFmt.format(selectedStats.summary.producer)}</b></Typography>
                    <Typography variant="body2">Έδρα: <b>{moneyFmt.format(selectedStats.summary.office)}</b></Typography>
                  </Stack>
                </Box>
              )}
            </Card>

            <Card variant="outlined" sx={{ p: 2, minHeight: 360 }}>
              <Typography fontWeight={800} mb={1}>Καταμερισμός υπερπρομήθειας</Typography>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={[{ name: "Συνεργάτης", value: Math.abs(totals.producer) }, { name: "Έδρα", value: Math.abs(totals.office) }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={42} paddingAngle={3} label>
                    <Cell fill="#2e7d32" />
                    <Cell fill="#0b2545" />
                  </Pie>
                  <RechartsTooltip formatter={(value) => moneyFmt.format(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ height: 12, display: "flex", borderRadius: 99, overflow: "hidden", bgcolor: "action.hover" }}>
                <Box sx={{ width: `${statsProducerPercent}%`, bgcolor: "success.main", transition: "width 250ms ease" }} />
                <Box sx={{ width: `${statsOfficePercent}%`, bgcolor: "primary.dark", transition: "width 250ms ease" }} />
              </Box>
              <Stack direction="row" justifyContent="space-between" mt={1}>
                <Typography variant="caption" color="success.dark">Συνεργάτης {statsProducerPercent.toFixed(1)}%</Typography>
                <Typography variant="caption" color="primary.dark">Έδρα {statsOfficePercent.toFixed(1)}%</Typography>
              </Stack>
            </Card>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsOpen(false)} color="error">Κλείσιμο</Button>
        </DialogActions>
      </Dialog>

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

function StatementTableRow({ row, onEdit, onDelete }: {
  row: StatementDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow hover>
      <TableCell>
        <Chip size="small" label={`${row.month.toString().padStart(2, "0")}/${row.year}`} />
      </TableCell>
      <TableCell>{row.insuranceCompanyName}</TableCell>
      <TableCell>
        <Typography fontWeight={600}>{row.producerName}</Typography>
        {row.producerCode && (
          <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
            {row.producerCode}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
        {moneyFmt.format(row.grossAmount)}
      </TableCell>
      <TableCell align="right" sx={{ fontFamily: "monospace" }}>
        {moneyFmt.format(row.netAmount)}
      </TableCell>
      <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12 }}>
        {(row.producerSharePercent ?? 100).toFixed(1)}%
      </TableCell>
      <TableCell align="right" sx={{ fontFamily: "monospace", color: "success.main" }}>
        {moneyFmt.format(row.producerAmount ?? row.grossAmount)}
      </TableCell>
      <TableCell align="right" sx={{ fontFamily: "monospace", color: "info.main" }}>
        {moneyFmt.format(row.officeAmount ?? 0)}
      </TableCell>
      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{row.reference ?? "—"}</TableCell>
      <TableCell>
        {row.paidOn ? (
          <Chip size="small" color="success" icon={<PaidIcon />}
            label={new Date(row.paidOn).toLocaleDateString("el-GR")} />
        ) : (
          <Chip size="small" color="warning" variant="outlined" label="Απλήρωτη" />
        )}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Επεξεργασία">
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Διαγραφή">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
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
        <Button onClick={onClose} color="error" variant="contained">Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || save.isPending}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
