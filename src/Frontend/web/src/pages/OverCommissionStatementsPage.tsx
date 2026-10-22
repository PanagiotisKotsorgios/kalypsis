import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PaidIcon from "@mui/icons-material/Paid";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GridOnIcon from "@mui/icons-material/GridOn";
import BarChartIcon from "@mui/icons-material/BarChart";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { OverCommissionGridEditor } from "../components/OverCommissionGridEditor";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { printTable } from "../utils/printableTable";
import { DEFAULT_STATEMENT_COLUMNS, STATEMENT_COLUMNS, normalizeStatementColumns, statementCurrency, statementMoney, statementDisplayedColumns, statementExportSnapshot, statementOfficeTotal, statementSections, statementTableLines, statementTotals, type StatementColumn, type StatementDto } from "./overCommissionTable";
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
  const theme = useTheme();
  const compactFilters = useMediaQuery(theme.breakpoints.down("xl"));
  const [compactFiltersOpen, setCompactFiltersOpen] = useState(false);
  useEffect(() => { if (!compactFilters) setCompactFiltersOpen(false); }, [compactFilters]);
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
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const statementTableRef = useRef<HTMLTableElement>(null);
  const clearFilters = () => {
    setYear(new Date().getFullYear()); setMonth("");
    setCarrierFilter(""); setProducerFilter(""); setSearch("");
    setDateFrom(""); setDateTo(""); setPaidFilter(""); setGroupBy("producer");
    setClearSavedFilterRequest(value => value + 1);
  };
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
  const groupedSections = useMemo(() => statementSections(rows, groupBy), [rows, groupBy]);
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
  const PRINT_COL_STORAGE = "kalypsis.overCommission.printCols.v2";
  const PRINT_COLS = STATEMENT_COLUMNS;
  const DEFAULT_PRINT_COLS = new Set(DEFAULT_STATEMENT_COLUMNS);
  const [printColsOpen, setPrintColsOpen] = useState(false);
  const [selectedPrintCols, setSelectedPrintCols] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(DEFAULT_PRINT_COLS);
    try {
      const stored = localStorage.getItem(PRINT_COL_STORAGE);
      if (stored) return normalizeStatementColumns(JSON.parse(stored));
      const legacy = localStorage.getItem("kalypsis.overCommission.printCols.v1");
      if (legacy) return normalizeStatementColumns(JSON.parse(legacy), true);
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
    const n = mode === "none" ? new Set<string>() : new Set(mode === "all" ? PRINT_COLS.map(column => column.key) : DEFAULT_PRINT_COLS);
    try { localStorage.setItem(PRINT_COL_STORAGE, JSON.stringify(Array.from(n))); } catch { /* ignore */ }
    return n;
  });

  const activeColumns = useMemo(() => PRINT_COLS.filter(column => selectedPrintCols.has(column.key)), [selectedPrintCols]);
  const tableLines = useMemo(() => statementTableLines(rows, groupedSections, activeColumns), [rows, groupedSections, activeColumns]);
  const exportDisabled = exportBusy || listQ.isFetching || listQ.isError || !rows.length || !activeColumns.length;
  const exportRows = async (kind: "csv" | "xlsx" | "pdf" | "print") => {
    if (exportBusy || listQ.isFetching || listQ.isError) return;
    if (!rows.length) { setError("Δεν υπάρχουν γραμμές για εξαγωγή."); return; }
    // The global header menu also supports hiding/dragging columns directly.
    // Read that presentation order only; record data still comes from the model.
    const visibleKeys = statementTableRef.current ? Array.from(statementTableRef.current.tHead?.rows[0]?.cells ?? [])
      .filter(cell => cell.style.display !== "none").map(cell => cell.dataset.statementColumn).filter((key): key is string => !!key) : activeColumns.map(column => column.key);
    const displayedColumns = statementDisplayedColumns(activeColumns, visibleKeys);
    if (!displayedColumns.length) { setError("Επιλέξτε τουλάχιστον μία ορατή στήλη για εκτύπωση ή εξαγωγή."); return; }
    // Freeze the very same lines the table renders, before any async work.
    const subtitle = [`Έτος: ${year}`, month ? `Μήνας: ${month}` : "Όλοι οι μήνες",
      carrierFilter ? `Ασφαλιστική: ${carriersQ.data?.find(carrier => carrier.id === carrierFilter)?.name ?? carrierFilter}` : "",
      producerFilter ? `Παραγωγός: ${producersQ.data?.find(producer => producer.id === producerFilter)?.name ?? producerFilter}` : "",
      search ? `Αναζήτηση: ${search}` : "", dateFrom ? `Από: ${dateFrom}` : "", dateTo ? `Έως: ${dateTo}` : "",
      paidFilter === "paid" ? "Πληρωμένα" : paidFilter === "unpaid" ? "Απλήρωτα" : "",
      `Ομαδοποίηση: ${{ producer: "Ανά συνεργάτη", month: "Ανά περίοδο", carrier: "Ανά ασφαλιστική", none: "Χωρίς υποομάδες" }[groupBy]}`].filter(Boolean).join(" · ");
    const snapshot = statementExportSnapshot(statementTableLines(rows, groupedSections, displayedColumns), displayedColumns, rows.length, subtitle);
    setError(null); setExportBusy(true);
    try {
      if (kind === "print") {
        const office = (await api.get<{ name: string; code?: string; contactEmail?: string; contactPhone?: string; addressLine?: string; vatNumber?: string }>("/table-exports/office")).data;
        if (!office.name?.trim()) throw new Error("Δεν φορτώθηκαν τα στοιχεία του γραφείου. Δοκιμάστε ξανά.");
        printTable<string[]>({ title: office.name, subtitle: `Υπερπρομήθειες · ${subtitle} · ${rows.length} εγγραφές`,
          columns: snapshot.headers.map((label, index) => ({ key: String(index), label, map: row => row[index] })), rows: snapshot.rows, recordCount: snapshot.recordCount,
          office: { name: null, code: office.code, address: office.addressLine, phone: office.contactPhone, email: office.contactEmail, vatNumber: office.vatNumber }, orientation: "landscape" });
      } else {
        const response = await api.post("/table-exports", snapshot, { params: { format: kind }, responseType: "blob" });
        const mime = kind === "csv" ? "text/csv;charset=utf-8" : kind === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
        const url = URL.createObjectURL(new Blob([response.data], { type: mime }));
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = `overcommissions_${year}${month ? "-" + String(month).padStart(2, "0") : ""}.${kind}`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) { setError(extractErrorMessage(error)); }
    finally { setExportBusy(false); }
  };

  return (
    <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
            <ReceiptLongIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 25, sm: 34 } }}>Υπερπρομήθειες</Typography>
            <Chip label={`${rows.length} γραμμές · ${statementOfficeTotal(rows)} στην έδρα`}
              sx={{ bgcolor: "#159B59", color: "#fff", fontWeight: 800, maxWidth: "100%", height: "auto", minHeight: 26, "& .MuiChip-label": { whiteSpace: "normal", py: .5 } }} />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Καταχώρηση της μηνιαίας υπερπρομήθειας ανά παραγωγό και ασφαλιστική εταιρεία — μία γραμμή για κάθε
            γραμμή του πινακίου (ERGO, Ατλαντική, Grand Cover, κτλ.).
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minWidth: 0, maxWidth: "100%" }}>
          <SavedReportsButton entity="over-commission-statements"
            currentFilters={{ year, month, carrierFilter, producerFilter, search, dateFrom, dateTo, paidFilter, groupBy }}
            onLoad={next => { setYear(next.year ?? now.getFullYear()); setMonth(next.month ?? ""); setCarrierFilter(next.carrierFilter ?? ""); setProducerFilter(next.producerFilter ?? ""); setSearch(next.search ?? ""); setDateFrom(next.dateFrom ?? ""); setDateTo(next.dateTo ?? ""); setPaidFilter(next.paidFilter ?? ""); setGroupBy(next.groupBy ?? "producer"); }}
            onClear={clearFilters} clearRequestToken={clearSavedFilterRequest}
            saveRequestToken={saveFilterRequest} showSaveMenuItem={false} />
          <Button component={RouterLink} to="/app/over-commissions"
            variant="outlined" size="large">
            Ρυθμίσεις υπερπρομηθειών
          </Button>
          <Button variant="contained" size="large" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
            onClick={event => setActionsAnchor(event.currentTarget)}>Ενέργειες</Button>
          {compactFilters && <Button variant="contained" startIcon={<FilterListIcon />} onClick={() => setCompactFiltersOpen(true)}
            aria-haspopup="dialog" aria-expanded={compactFiltersOpen}
            sx={{ bgcolor: "#159B59", color: "#fff", "&:hover": { bgcolor: "#107B46", color: "#fff" } }}>Φίλτρα υπερπρομηθειών</Button>}
        </Stack>
      </Stack>

      <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 300, maxWidth: "calc(100vw - 24px)" } } }}>
        <MenuItem onClick={() => { setActionsAnchor(null); setDialog("new"); }} sx={{ color: "#0877c9", "&:hover": { bgcolor: "#e7f2fd" } }}><ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Νέα εγγραφή" /></MenuItem>
        <MenuItem onClick={() => { setActionsAnchor(null); setGridOpen(value => !value); }} sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb" } }}><ListItemIcon sx={{ color: "#5b55a5" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary={gridOpen ? "Απόκρυψη μαζικής καταχώρησης" : "Μαζική καταχώρηση"} /></MenuItem>
        <MenuItem onClick={() => { setActionsAnchor(null); setStatsOpen(true); }} sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc" } }}><ListItemIcon sx={{ color: "#0b5cad" }}><BarChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στατιστικά" /></MenuItem>
        <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }} sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc" } }}><ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" /></MenuItem>
        <Divider />
        <MenuItem disabled={exportDisabled} onClick={() => { setActionsAnchor(null); void exportRows("csv"); }} sx={{ color: "#087f73", "&:hover": { bgcolor: "#e5f6f3" } }}><ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" /></MenuItem>
        <MenuItem disabled={exportDisabled} onClick={() => { setActionsAnchor(null); void exportRows("xlsx"); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}><ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή Excel" /></MenuItem>
        <MenuItem disabled={exportDisabled} onClick={() => { setActionsAnchor(null); void exportRows("pdf"); }} sx={{ color: "#b32d3c", "&:hover": { bgcolor: "#fcecef" } }}><ListItemIcon sx={{ color: "#b32d3c" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή PDF" /></MenuItem>
        <MenuItem disabled={exportDisabled} onClick={() => { setActionsAnchor(null); void exportRows("print"); }} sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7" } }}><ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" /></MenuItem>
        <Divider />
        <MenuItem onClick={() => { setActionsAnchor(null); setPrintColsOpen(true); }} sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df" } }}><ListItemIcon sx={{ color: "#a45b00" }}><ViewColumnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στήλες εκτύπωσης & εξαγωγής" secondary={`${selectedPrintCols.size}/${PRINT_COLS.length} ενεργές`} /></MenuItem>
      </Menu>

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
      {listQ.isError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => void listQ.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(listQ.error)}</Alert>}

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
      <Dialog open={printColsOpen} onClose={() => setPrintColsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Στήλες πίνακα & εξαγωγών</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" mb={1} display="block">
            Επιλέξτε τις ίδιες στήλες για τον πίνακα, την εκτύπωση και τις εξαγωγές CSV, Excel και PDF.
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
      <ResponsiveFilterPanel compactAt="xl" title="Φίλτρα υπερπρομηθειών" compactButtonPlacement="external"
        compactOpen={compactFiltersOpen} onCompactOpenChange={setCompactFiltersOpen} cardSx={{ bgcolor: "#edf2f7" }}>
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
          <Button size="small" fullWidth color="error" variant="contained"
            onClick={clearFilters}>
            Καθαρισμός φίλτρων
          </Button>
        </Box>
      </ResponsiveFilterPanel>

      {groupBy !== "none" && groupedSections.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 1.5, overflowX: "auto" }}>
            <Typography fontWeight={800} mb={1}>
              Σύνολα ανά {groupBy === "producer" ? "συνεργάτη" : groupBy === "month" ? "περίοδο" : "ασφαλιστική"}
            </Typography>
            <Table size="small" sx={{ minWidth: 640 }}>
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
                {groupedSections.flatMap(section => Array.from(new Set(section.rows.map(statementCurrency))).sort().map(currency => {
                  const summary = statementTotals(section.rows.filter(row => statementCurrency(row) === currency));
                  return (
                    <TableRow key={section.key + currency} hover>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{section.key} · {currency}</TableCell>
                      <TableCell align="right">{summary.count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(31,123,179,0.09)" }}>{statementMoney(summary.gross, currency)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(46,125,50,0.12)", color: "success.dark" }}>{statementMoney(summary.net, currency)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(46,125,50,0.12)", color: "success.dark" }}>{statementMoney(summary.producer, currency)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "rgba(31,123,179,0.09)", color: "info.dark" }}>{statementMoney(summary.office, currency)}</TableCell>
                      <TableCell align="right">{summary.paid} / {summary.count}</TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0, overflowX: "auto" }}>
          <Table ref={statementTableRef} size="small" aria-label="Πίνακας υπερπρομηθειών">
            <TableHead>
              <TableRow>
                {activeColumns.map(column => <TableCell key={column.key} data-statement-column={column.key} align={column.numeric ? "right" : "left"}>{column.label}</TableCell>)}
                <TableCell align="right">Ενέργειες</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow><TableCell colSpan={activeColumns.length + 1} sx={{ py: 4, textAlign: "center" }}>
                  <CircularProgress size={22} />
                </TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={activeColumns.length + 1} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  Καμία εγγραφή για αυτή την περίοδο. Πάτα «Νέα εγγραφή» για να ξεκινήσεις.
                </TableCell></TableRow>
              ) : tableLines.map(line => line.record ? <StatementTableRow key={line.key} row={line.record} columns={activeColumns} cells={line.cells}
                onEdit={() => setDialog(line.record!)} onDelete={() => { if (confirm("Διαγραφή εγγραφής;")) del.mutate(line.record!.id); }} />
                : line.kind === "group" ? <TableRow key={line.key} sx={{ bgcolor: "#e6edf5" }}><TableCell colSpan={activeColumns.length + 1} sx={{ fontWeight: 800, color: "primary.main" }}>{line.cells[0]}</TableCell></TableRow>
                  : <TableRow key={line.key} sx={{ bgcolor: "#e8f5e9", "& td": { fontWeight: 800, color: "success.dark", py: .75 } }}>
                    {line.cells.map((cell, index) => <TableCell key={activeColumns[index].key} align={activeColumns[index].numeric ? "right" : "left"}>{cell}</TableCell>)}<TableCell />
                  </TableRow>)}
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

function StatementTableRow({ row, columns, cells, onEdit, onDelete }: {
  row: StatementDto;
  columns: StatementColumn[];
  cells: string[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow hover>
      {columns.map((column, index) => <TableCell key={column.key} align={column.numeric ? "right" : "left"}
        sx={{ fontFamily: column.numeric ? "monospace" : undefined, color: column.key === "producerAmount" ? "success.main" : column.key === "officeAmount" ? "info.main" : undefined }}>
        {column.key === "period" ? <Chip size="small" label={cells[index]} /> : column.key === "paidOn"
          ? <Chip size="small" color={row.paidOn ? "success" : "warning"} variant={row.paidOn ? "filled" : "outlined"} icon={row.paidOn ? <PaidIcon /> : undefined} label={cells[index]} /> : cells[index]}
      </TableCell>)}
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
