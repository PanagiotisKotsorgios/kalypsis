import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, FormControlLabel, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  TextField, Tooltip, Typography
} from "@mui/material";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { ExportFormatMenu } from "../components/ExportFormatMenu";
import CalculateIcon from "@mui/icons-material/Calculate";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, date } from "../utils/format";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import {
  ExportColumnPicker,
  useExportColumnSelection,
  type ExportColumnDescriptor,
} from "../components/ExportColumnPicker";
import { printTable } from "../utils/printableTable";
import { useHeaderContextMenu, type ColumnType } from "../components/TableContextMenu";

interface Carrier { id: string; name: string; isBroker?: boolean; parentCompanyId?: string | null; }
interface Producer { id: string; name: string; }
interface Row {
  policyId: string; policyNumber: string;
  startDate: string; endDate: string;
  customerName: string; insuranceCompany: string; producer: string | null;
  policyType: string; vehicleUseCategory: string | null; coverCode: string | null; status: string;
  gross: number; net: number; vat: number;
  partnerCommissionPercent: number; partnerCommission: number;
  agencyCommissionPercent: number; agencyCommission: number;
  incomingAgencyCommissionPercent: number; incomingAgencyCommission: number;
  commissionWarning: string | null;
}
interface GroupTotal { key: string; count: number; gross: number; net: number; vat: number; partnerCommission: number; agencyCommission: number; }
interface Result {
  count: number;
  rows: Row[];
  groups: GroupTotal[];
  grand: GroupTotal;
}

const STATUSES = ["Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal"];

interface ParamItem {
  id: string;
  kind: "Branch" | "Coverage" | "Use" | "Package" | "BridgeCode" | "Field" | "Other";
  code: string;
  name: string;
  policyType: string | null;
  vehicleUseCategory: string | null;
  parentCode: string | null;
}

export function ProductionListsPage() {
  const { t } = useTranslation();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [f, setF] = useState({
    from: monthStart, to: todayStr,
    insuranceCompanyId: "", producerId: "",
    policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
    status: "", groupBy: "carrier"
  });
  // Drill-down: click a group row to filter the detail table below to just
  // that group. Cleared automatically when the groupBy changes.
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);
  useEffect(() => { setFocusedGroupKey(null); }, [f.groupBy]);

  const carriers = useQuery({
    queryKey: ["carriers-prod-list"],
    queryFn: async () => (await api.get<Carrier[]>("/insurance-companies", { params: { onlyUsed: true } })).data
  });
  const producers = useQuery({
    queryKey: ["producers-prod-list"],
    queryFn: async () => (await api.get<Producer[]>("/producers")).data
  });
  // Per-carrier params (what the operator sees once they pick a carrier).
  const carrierParams = useQuery({
    queryKey: ["company-parameters-prod-list", f.insuranceCompanyId],
    queryFn: async () => (await api.get<ParamItem[]>("/company-parameters", {
      params: { insuranceCompanyId: f.insuranceCompanyId }
    })).data,
    enabled: !!f.insuranceCompanyId,
  });

  // Tenant-wide params: union of every carrier's Κλάδος/Χρήση/Κάλυψη/Πακέτο,
  // used as the fallback options when no carrier is selected. Distinct
  // per-value so operators see one entry per branch/use/cover/package
  // regardless of how many carriers have it in their catalogue.
  const tenantParams = useQuery({
    queryKey: ["company-parameters-prod-list", "tenant-wide"],
    queryFn: async () => (await api.get<ParamItem[]>("/company-parameters")).data,
  });

  // Distinct helper — first entry wins for label. Every option keeps a
  // `key` so React can render them without warnings.
  const distinctBy = <T extends { value: string; label: string; key: string }>(rows: T[]): T[] => {
    const seen = new Map<string, T>();
    for (const r of rows) if (!seen.has(r.value)) seen.set(r.value, r);
    return Array.from(seen.values());
  };

  const branchOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Branch" && p.policyType)
      .map(p => ({ key: `branch:${p.policyType}:${p.id}`, value: p.policyType!, label: p.name }));
    return f.insuranceCompanyId ? rows : distinctBy(rows);
  }, [carrierParams.data, tenantParams.data, f.insuranceCompanyId]);

  const useOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Use" && p.vehicleUseCategory && p.vehicleUseCategory !== "None")
      .map(p => ({ key: `use:${p.vehicleUseCategory}:${p.id}`, value: p.vehicleUseCategory!, label: p.name }));
    return f.insuranceCompanyId ? rows : distinctBy(rows);
  }, [carrierParams.data, tenantParams.data, f.insuranceCompanyId]);

  const coverageOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Coverage" && p.code)
      .map(p => ({ key: `cov:${p.code}:${p.id}`, value: p.code, label: `${p.name} (${p.code})` }));
    return f.insuranceCompanyId ? rows : distinctBy(rows);
  }, [carrierParams.data, tenantParams.data, f.insuranceCompanyId]);

  const packageOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Package" && p.code)
      .map(p => ({ key: `pkg:${p.code}:${p.id}`, value: p.code, label: `${p.name} (${p.code})` }));
    return f.insuranceCompanyId ? rows : distinctBy(rows);
  }, [carrierParams.data, tenantParams.data, f.insuranceCompanyId]);

  const params = {
    from: f.from || undefined,
    to: f.to || undefined,
    insuranceCompanyId: f.insuranceCompanyId || undefined,
    producerId: f.producerId || undefined,
    policyType: f.policyType || undefined,
    vehicleUseCategory: f.vehicleUseCategory || undefined,
    coverCode: f.coverCode.trim() || undefined,
    packageCode: f.packageCode || undefined,
    status: f.status || undefined,
    groupBy: f.groupBy || undefined
  };

  const q = useQuery({
    queryKey: ["production-list", params],
    queryFn: async () => (await api.get<Result>("/production-lists", { params })).data
  });

  // Single source of truth for the production-lists table columns. Every
  // column carries a display renderer, a plain-text extractor (for Print &
  // client-side export), a header label, and an optional align hint. The
  // export-column picker below is driven by this list, and the on-screen
  // table skips any column the user has unchecked.
  interface ProductionColumn {
    key: string;
    label: string;
    align?: "left" | "right";
    render: (r: Row) => React.ReactNode;
    text: (r: Row) => string;
    defaultOff?: boolean;
  }
  const columns: ProductionColumn[] = [
    { key: "policyNumber",   label: t("productionList.col.policy"),   render: r => <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.policyNumber}</Box>, text: r => r.policyNumber },
    { key: "startDate",      label: t("productionList.col.start"),    render: r => <Box component="span" sx={{ fontSize: 12 }}>{date(r.startDate)}</Box>, text: r => date(r.startDate) },
    { key: "endDate",        label: "Λήξη",                            render: r => <Box component="span" sx={{ fontSize: 12 }}>{date(r.endDate)}</Box>,   text: r => date(r.endDate), defaultOff: true },
    { key: "customerName",   label: t("productionList.col.customer"), render: r => r.customerName,      text: r => r.customerName },
    { key: "carrier",        label: t("productionList.col.carrier"),  render: r => r.insuranceCompany, text: r => r.insuranceCompany },
    { key: "producer",       label: t("productionList.col.producer"), render: r => r.producer ?? "—",  text: r => r.producer ?? "" },
    { key: "type",           label: t("productionList.col.type"),     render: r => <Chip size="small" variant="outlined" label={r.policyType} />, text: r => r.policyType },
    { key: "use",            label: "Χρήση",                           render: r => r.vehicleUseCategory ? <Chip size="small" label={r.vehicleUseCategory} /> : <Box component="span" sx={{ color: "text.disabled" }}>—</Box>, text: r => r.vehicleUseCategory ?? "", defaultOff: true },
    { key: "cover",          label: "Κάλυψη",                          render: r => r.coverCode ? <Chip size="small" variant="outlined" label={r.coverCode} /> : <Box component="span" sx={{ color: "text.disabled" }}>—</Box>, text: r => r.coverCode ?? "", defaultOff: true },
    { key: "status",         label: t("productionList.status"),        render: r => r.status, text: r => r.status, defaultOff: true },
    { key: "gross",          label: t("productionList.col.gross"),    align: "right", render: r => <Box component="span" sx={{ fontWeight: 700 }}>{money(r.gross)}</Box>, text: r => money(r.gross) },
    { key: "net",            label: t("productionList.col.net"),      align: "right", render: r => money(r.net),  text: r => money(r.net) },
    { key: "vat",            label: t("productionList.kpi.vat"),      align: "right", render: r => money(r.vat), text: r => money(r.vat), defaultOff: true },
    { key: "bridgeComm",     label: "Προμ. γέφυρας/έδρας",             align: "right", render: r => <Box component="span" sx={{ color: "info.main" }}>{money(r.incomingAgencyCommission)} ({r.incomingAgencyCommissionPercent.toFixed(1)}%)</Box>, text: r => `${money(r.incomingAgencyCommission)} (${r.incomingAgencyCommissionPercent.toFixed(1)}%)` },
    { key: "partnerPct",     label: t("productionList.col.partnerPct"), align: "right", render: r => <Box component="span" sx={{ color: "text.secondary" }}>{r.partnerCommissionPercent.toFixed(1)}%</Box>, text: r => `${r.partnerCommissionPercent.toFixed(1)}%` },
    { key: "partner",        label: t("productionList.col.partner"),  align: "right", render: r => <Box component="span" sx={{ color: "warning.main" }}>{money(r.partnerCommission)}</Box>, text: r => money(r.partnerCommission) },
    { key: "agency",         label: t("productionList.col.agency"),   align: "right", render: r => <Box component="span" sx={{ color: "success.main", fontWeight: 700 }}>{money(r.agencyCommission)}</Box>, text: r => money(r.agencyCommission) },
    { key: "check",          label: "Έλεγχος",                         render: r => r.commissionWarning ? <Chip size="small" color="warning" label="Έλεγχος σύμβασης" title={r.commissionWarning} /> : <Chip size="small" color="success" variant="outlined" label="OK" />, text: r => r.commissionWarning ?? "OK" },
  ];

  const pickerDescriptors: ExportColumnDescriptor[] = columns.map((c, i) => ({
    key: c.key, label: c.label,
    alwaysOn: i === 0,
    defaultOff: c.defaultOff,
  }));
  const selection = useExportColumnSelection("production-lists", pickerDescriptors);

  // Client-side sort surfaced through the right-click header menu.
  // The report data is already loaded in-memory so we sort locally rather
  // than round-tripping to the backend for every column tick.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Pagination — the report can return hundreds of rows on a full-year
  // window; slicing client-side keeps the table snappy.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  // Reset to the first page whenever the underlying result set changes
  // (new filters, new group-by) so we don't land on an empty tail page.
  useEffect(() => { setPage(0); }, [q.data?.rows.length, f]);
  const visibleColumns = columns.filter(c => selection.activeKeys.includes(c.key));

  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => { setSortKey(key); setSortDir(dir); },
    onHide: (key) => selection.toggle(key),
  });
  const inferColumnType = (key: string): ColumnType => {
    if (key === "startDate" || key === "endDate") return "date";
    if (["gross", "net", "vat", "bridgeComm", "partnerPct", "partner", "agency"].includes(key)) return "number";
    return "string";
  };

  // «Ανά συνεργάτη» — group printed / CSV output by producer, with each
  // producer's policies laid out one-by-one in detail below their name.
  // Persisted per browser so the operator's preference sticks across
  // sessions and reloads.
  const [perProducer, setPerProducer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("kalypsis.productionList.perProducer") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("kalypsis.productionList.perProducer", perProducer ? "1" : "0");
  }, [perProducer]);

  // Group the currently-visible (filtered) row set by producer. Producers
  // are sorted alphabetically with «Χωρίς συνεργάτη» pinned at the end.
  // Policies inside each group sort by startDate desc so the newest is on
  // top — matches what operators expect in a monthly πινάκιο.
  const groupsByProducer = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const byProducer = new Map<string, Row[]>();
    for (const r of rows) {
      const key = (r.producer ?? "Χωρίς συνεργάτη").trim();
      const bucket = byProducer.get(key);
      if (bucket) bucket.push(r); else byProducer.set(key, [r]);
    }
    const groups = Array.from(byProducer.entries())
      .sort(([a], [b]) => {
        if (a === "Χωρίς συνεργάτη") return 1;
        if (b === "Χωρίς συνεργάτη") return -1;
        return a.localeCompare(b, "el");
      })
      .map(([producer, list]) => {
        const sorted = list.slice().sort((x, y) =>
          (y.startDate ?? "").localeCompare(x.startDate ?? ""));
        const gross = sorted.reduce((s, r) => s + (r.gross ?? 0), 0);
        const partner = sorted.reduce((s, r) => s + (r.partnerCommission ?? 0), 0);
        return {
          title: producer,
          summary: `${money(gross)} μικτά · ${money(partner)} προμήθεια`,
          rows: sorted,
        };
      });
    return groups;
  }, [q.data?.rows]);

  async function downloadExport(fmt: "csv" | "xlsx" | "pdf") {
    if (perProducer && fmt === "csv") {
      // Ανά συνεργάτη CSV — client-built so the section headers survive.
      // xlsx / pdf still go through the server export (sections don't
      // translate cleanly to those formats).
      const rows = q.data?.rows ?? [];
      if (rows.length === 0) return;
      const activeCols = visibleColumns;
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = activeCols.map(c => esc(c.label)).join(",");
      const lines: string[] = [];
      for (const g of groupsByProducer) {
        lines.push("");
        lines.push(esc(`Συνεργάτης: ${g.title} — ${g.rows.length} συμβόλαια — ${g.summary}`));
        lines.push(header);
        for (const r of g.rows) {
          lines.push(activeCols.map(c => esc(c.text(r))).join(","));
        }
      }
      const csv = `﻿${lines.join("\r\n")}\r\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `production-per-producer-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const activeKeys = selection.activeKeys;
    const columnsParam = activeKeys.length > 0 && activeKeys.length < columns.length
      ? activeKeys.join(",")
      : undefined;
    const res = await api.get("/production-lists/export", {
      params: { ...params, format: fmt, columns: columnsParam },
      responseType: "blob"
    });
    const mime = fmt === "csv"  ? "text/csv"
              : fmt === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf";
    const blob = new Blob([res.data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const ts   = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `production-${ts}.${fmt}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Client-side Print — always uses the currently loaded (filtered) rows
  // and the current column-picker selection so the printed sheet mirrors
  // exactly what's on screen. When «Ανά συνεργάτη» is on, the flat table
  // is replaced by one section per producer (title + summary + rows).
  const openPrint = () => {
    const rows = q.data?.rows ?? [];
    const filterBits: string[] = [];
    if (f.from) filterBits.push(`Από: ${f.from}`);
    if (f.to)   filterBits.push(`Έως: ${f.to}`);
    const selectedCarrier = (carriers.data ?? []).find(c => c.id === f.insuranceCompanyId);
    if (selectedCarrier) filterBits.push(`Εταιρία: ${selectedCarrier.name}`);
    const selectedProducer = (producers.data ?? []).find(p => p.id === f.producerId);
    if (selectedProducer) filterBits.push(`Συνεργάτης: ${selectedProducer.name}`);
    if (f.status) filterBits.push(`Κατάσταση: ${f.status}`);
    if (perProducer) filterBits.push("Ομαδοποίηση: ανά συνεργάτη");

    const printCols = visibleColumns.map(c => ({ key: c.key, label: c.label, map: c.text }));
    printTable<Row>({
      title: t("productionList.title"),
      subtitle: filterBits.join(" · "),
      columns: printCols,
      rows,
      orientation: "landscape",
      groups: perProducer ? groupsByProducer.map(g => ({
        title: g.title, summary: g.summary, rows: g.rows,
      })) : undefined,
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <StackedBarChartIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("productionList.title")}</Typography>
              <HelpHint id="page.productionList" />
            </Stack>
            <Typography color="text.secondary">{t("productionList.subtitle")}</Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <SavedReportsButton entity="production-lists" currentFilters={f} onLoad={(next) => setF({ ...f, ...next })} />
          <Button component={RouterLink} to="/app/production-report" variant="outlined" startIcon={<StackedBarChartIcon />}>
            Ετήσια παραγωγή
          </Button>
          <Button component={RouterLink} to="/app/commission-runs" variant="outlined" color="secondary" startIcon={<CalculateIcon />}>
            Εκκαθαρίσεις προμηθειών
          </Button>
          <ExportColumnPicker
            columns={pickerDescriptors}
            off={selection.off}
            toggle={selection.toggle}
            setAll={selection.setAll}
            reset={selection.reset}
          />
          <Tooltip title="Ομαδοποίηση εκτύπωσης / εξαγωγής CSV ανά συνεργάτη — αναλυτικά συμβόλαια, χωρίς σύνολα ομάδας.">
            <FormControlLabel
              sx={{ ml: 0.5, mr: 0.5, "& .MuiFormControlLabel-label": { fontSize: 13 } }}
              control={
                <Checkbox size="small" checked={perProducer}
                  onChange={e => setPerProducer(e.target.checked)} />
              }
              label="Ανά συνεργάτη"
            />
          </Tooltip>
          <ExportFormatMenu onExport={downloadExport} />
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={openPrint}>
            {t("common.print", "Εκτύπωση")}
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Οι λίστες παραγωγής είναι αναφορά και εξαγωγή του χαρτοφυλακίου. Από το «Εκκαθαρίσεις προμηθειών» δημιουργείτε, ελέγχετε και οριστικοποιείτε τις μηνιαίες εκκαθαρίσεις συνεργατών.
      </Alert>

      <Card sx={{ px: 1.75, py: 1.25, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <FilterAltIcon color="primary" fontSize="small" />
          <Typography fontWeight={700} variant="body2">{t("productionList.filters")}</Typography>
        </Stack>
        {/* Compact grid — 6 columns on lg, 3 on md. Same ? position unchanged
            (next to the page title above). */}
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" } }}>
          <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.from")}
            value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
          <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.to")}
            value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
          <SearchableSelect
            label={t("productionList.carrier")}
            value={f.insuranceCompanyId}
            onChange={(v) => setF({ ...f, insuranceCompanyId: v, policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
            emptyLabel={t("common.all")}
            options={(carriers.data ?? []).filter(c => !c.parentCompanyId).map(c => ({
              value: c.id, label: c.name, hint: c.isBroker ? "πρακτορείο" : undefined,
            }))}
          />
          {(() => {
            const carrierData = carriers.data ?? [];
            const selected = carrierData.find(c => c.id === f.insuranceCompanyId);
            // Show the sub-picker when EITHER the broker is selected OR a
            // sub of the broker is selected — so the user can switch
            // between subs without going back to the broker first.
            const broker = selected?.isBroker
              ? selected
              : selected?.parentCompanyId
                ? carrierData.find(c => c.id === selected.parentCompanyId)
                : null;
            if (!broker?.isBroker) return null;
            const subs = carrierData.filter(c => c.parentCompanyId === broker.id);
            const subValue = selected?.id !== broker.id ? selected?.id ?? "" : "";
            return (
              <SearchableSelect
                label="Υποασφαλιστική"
                value={subValue}
                onChange={(v) => setF({ ...f, insuranceCompanyId: v || broker.id })}
                emptyLabel="— όλες οι υποασφαλιστικές —"
                options={subs.map(s => ({ value: s.id, label: s.name }))}
              />
            );
          })()}
          <SearchableSelect
            label={t("productionList.producer")}
            value={f.producerId} onChange={(v) => setF({ ...f, producerId: v })}
            emptyLabel={t("common.all")}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />
          <SearchableSelect
            label={t("productionList.type")}
            value={f.policyType} onChange={(v) => setF({ ...f, policyType: v })}
            disabled={branchOptions.length === 0}
            helperText={branchOptions.length === 0
              ? "Δεν υπάρχουν παραμετρικά"
              : f.insuranceCompanyId ? "Από παραμετρικά εταιρίας" : "Από όλα τα παραμετρικά γραφείου"}
            emptyLabel={t("common.all")}
            options={branchOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Χρήση οχήματος"
            value={f.vehicleUseCategory} onChange={(v) => setF({ ...f, vehicleUseCategory: v })}
            disabled={useOptions.length === 0}
            helperText={useOptions.length === 0
              ? "Δεν υπάρχουν παραμετρικά"
              : f.insuranceCompanyId ? "Από παραμετρικά εταιρίας" : "Από όλα τα παραμετρικά γραφείου"}
            emptyLabel={t("common.all")}
            options={useOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Κάλυψη"
            value={f.coverCode} onChange={(v) => setF({ ...f, coverCode: v })}
            disabled={coverageOptions.length === 0}
            helperText={coverageOptions.length === 0
              ? "Δεν υπάρχουν παραμετρικά"
              : f.insuranceCompanyId ? "Από παραμετρικά εταιρίας" : "Από όλα τα παραμετρικά γραφείου"}
            emptyLabel={t("common.all")}
            options={coverageOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableSelect
            label="Πακέτο"
            value={f.packageCode} onChange={(v) => setF({ ...f, packageCode: v })}
            disabled={packageOptions.length === 0}
            helperText={packageOptions.length === 0
              ? "Δεν υπάρχουν παραμετρικά"
              : f.insuranceCompanyId ? "Από παραμετρικά εταιρίας" : "Από όλα τα παραμετρικά γραφείου"}
            emptyLabel={t("common.all")}
            options={packageOptions.map(o => ({ value: o.value, label: o.label }))}
          />
          <SearchableTextField size="small" label={t("productionList.status")} value={f.status}
            onChange={e => setF({ ...f, status: e.target.value })}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{String(t(`policies.statuses.${s}`, s))}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label={t("productionList.groupBy")} value={f.groupBy}
            onChange={e => setF({ ...f, groupBy: e.target.value })}>
            <MenuItem value="">{t("productionList.noGrouping")}</MenuItem>
            <MenuItem value="carrier">{t("productionList.byCarrier")}</MenuItem>
            <MenuItem value="producer">{t("productionList.byProducer")}</MenuItem>
            <MenuItem value="type">{t("productionList.byType")}</MenuItem>
            <MenuItem value="month">{t("productionList.byMonth")}</MenuItem>
          </SearchableTextField>
        </Box>
        <Stack direction="row" justifyContent="flex-end" mt={1.5}>
          <Button size="small"
            onClick={() => setF({
              from: monthStart, to: todayStr,
              insuranceCompanyId: "", producerId: "",
              policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
              status: "", groupBy: "carrier"
            })} color="error" variant="contained">Καθαρισμός φίλτρων</Button>
        </Stack>
      </Card>

      {q.isLoading ? <CircularProgress /> : !q.data ? null : (
        <>
          {/* Grand totals strip */}
          <Card sx={{ p: 2.5, mb: 2, bgcolor: "rgba(11,37,69,0.04)" }}>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Kpi label={t("productionList.kpi.policies")} value={q.data.grand.count} />
              <Kpi label={t("productionList.kpi.gross")} value={money(q.data.grand.gross)} />
              <Kpi label={t("productionList.kpi.net")} value={money(q.data.grand.net)} />
              <Kpi label={t("productionList.kpi.vat")} value={money(q.data.grand.vat)} />
              <Kpi label={t("productionList.kpi.partnerComm")} value={money(q.data.grand.partnerCommission)} color="warning.main" />
              <Kpi label={t("productionList.kpi.agencyComm")} value={money(q.data.grand.agencyCommission)} color="success.main" />
            </Stack>
          </Card>

          {/* Group totals (if grouping enabled) — click a row to filter the
              detail table below to just that group (drill-down). */}
          {q.data.groups.length > 0 && (
            <Card sx={{ p: 2, mb: 2 }} variant="outlined">
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography fontWeight={700}>{t("productionList.groupTotals")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Πατήστε σε γραμμή για να φιλτράρετε το αναλυτικό πίνακα σε αυτήν την ομάδα.
                </Typography>
              </Stack>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>{t("productionList.group")}</TableCell>
                  <TableCell align="right">{t("productionList.count")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.gross")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.net")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.partnerComm")}</TableCell>
                  <TableCell align="right">{t("productionList.kpi.agencyComm")}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {q.data.groups.map(g => {
                    const isFocused = focusedGroupKey === g.key;
                    return (
                      <TableRow key={g.key} hover
                        onClick={() => setFocusedGroupKey(isFocused ? null : g.key)}
                        selected={isFocused}
                        sx={{ cursor: "pointer" }}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {isFocused && <Chip size="small" color="primary" label="Επιλεγμένη" sx={{ mr: 1 }} />}
                          {g.key}
                        </TableCell>
                        <TableCell align="right">{g.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{money(g.gross)}</TableCell>
                        <TableCell align="right">{money(g.net)}</TableCell>
                        <TableCell align="right" sx={{ color: "warning.main" }}>{money(g.partnerCommission)}</TableCell>
                        <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>{money(g.agencyCommission)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {focusedGroupKey !== null && (
                <Stack direction="row" alignItems="center" spacing={1} mt={1}>
                  <Chip color="primary" size="small"
                    label={`Εστίαση: ${focusedGroupKey}`}
                    onDelete={() => setFocusedGroupKey(null)} />
                  <Typography variant="caption" color="text.secondary">
                    Πατήστε το «×» για να δείτε ξανά όλες τις γραμμές.
                  </Typography>
                </Stack>
              )}
            </Card>
          )}

          {/* Detailed rows — headers & cells driven by the column-picker
              selection above, so unchecking a column also removes it from
              the on-screen view (not just the export/print). Left-click a
              header to toggle sort (asc → desc → off); right-click for the
              full menu with «Απόκρυψη στήλης». */}
          <Card variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                {visibleColumns.map(c => {
                  const activeAsc = sortKey === c.key && sortDir === "asc";
                  const activeDesc = sortKey === c.key && sortDir === "desc";
                  const toggleSort = () => {
                    if (activeAsc) { setSortDir("desc"); }
                    else if (activeDesc) { setSortKey(null); }
                    else { setSortKey(c.key); setSortDir("asc"); }
                  };
                  return (
                    <TableCell
                      key={c.key}
                      align={c.align}
                      onClick={toggleSort}
                      onContextMenu={(e) => headerMenu.open(e, {
                        key: c.key, label: c.label, type: inferColumnType(c.key), canHide: c.key !== visibleColumns[0].key,
                      })}
                      sx={{
                        cursor: "pointer",
                        userSelect: "none",
                        fontWeight: 700,
                        "&:hover": { bgcolor: "action.hover" },
                        color: (activeAsc || activeDesc) ? "primary.main" : undefined,
                      }}
                    >
                      {c.label}
                      {(activeAsc || activeDesc) && (
                        <Box component="span" sx={{ ml: 0.5, fontSize: 12, color: "primary.main" }}>
                          {activeAsc ? "▲" : "▼"}
                        </Box>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow></TableHead>
              <TableBody>
                {q.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      {t("productionList.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {(() => {
                  // Drill-down filter — when the operator has clicked a
                  // group row above, narrow the visible rows to just that
                  // group. Matching is per-groupBy dimension so producer
                  // grouping compares against r.producer, carrier against
                  // r.insuranceCompany, and so on.
                  const focused = focusedGroupKey;
                  const matchesGroup = (r: Row): boolean => {
                    if (!focused) return true;
                    switch (f.groupBy) {
                      case "carrier":  return (r.insuranceCompany ?? "") === focused;
                      case "producer": return (r.producer ?? "") === focused
                                            || (!r.producer && focused === "Χωρίς συνεργάτη");
                      case "type":     return (r.policyType ?? "") === focused;
                      case "month":    return (r.startDate ?? "").slice(0, 7) === focused;
                      default:         return true;
                    }
                  };
                  const focusedRows = q.data.rows.filter(matchesGroup);
                  const sorted = (() => {
                    if (!sortKey) return focusedRows;
                    const col = columns.find(c => c.key === sortKey);
                    if (!col) return focusedRows;
                    const type = inferColumnType(sortKey);
                    const arr = focusedRows.slice();
                    arr.sort((a, b) => {
                      const va: string = col.text(a) ?? "";
                      const vb: string = col.text(b) ?? "";
                      let cmp = 0;
                      if (type === "number") {
                        const parse = (s: string) => Number.parseFloat(s.replace(/[^\d.\-]/g, "")) || 0;
                        cmp = parse(va) - parse(vb);
                      } else {
                        cmp = va.localeCompare(vb, "el");
                      }
                      return sortDir === "asc" ? cmp : -cmp;
                    });
                    return arr;
                  })();
                  const start = page * rowsPerPage;
                  return sorted.slice(start, start + rowsPerPage);
                })().map(r => (
                  <TableRow key={r.policyId} hover>
                    {visibleColumns.map(c => (
                      <TableCell key={c.key} align={c.align}>{c.render(r)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={
                focusedGroupKey
                  ? q.data.rows.filter(r => {
                      switch (f.groupBy) {
                        case "carrier":  return (r.insuranceCompany ?? "") === focusedGroupKey;
                        case "producer": return (r.producer ?? "") === focusedGroupKey
                                             || (!r.producer && focusedGroupKey === "Χωρίς συνεργάτη");
                        case "type":     return (r.policyType ?? "") === focusedGroupKey;
                        case "month":    return (r.startDate ?? "").slice(0, 7) === focusedGroupKey;
                        default:         return true;
                      }
                    }).length
                  : q.data.rows.length
              }
              page={page}
              onPageChange={(_e, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100, 250]}
              labelRowsPerPage="Γραμμές ανά σελίδα"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
            />
          </Card>
          {headerMenu.menu}

          <Alert severity="info" icon={<DownloadIcon />} sx={{ mt: 2 }}>
            {t("productionList.note")}
          </Alert>
        </>
      )}
    </Box>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: color ?? "text.primary" }}>{value}</Typography>
    </Box>
  );
}
