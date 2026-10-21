import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, ListItemIcon, ListItemText, Menu, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  TextField, Typography
} from "@mui/material";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import PrintIcon from "@mui/icons-material/Print";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import TuneIcon from "@mui/icons-material/Tune";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, date } from "../utils/format";
import { contractDurationLabel } from "../utils/contractDuration";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import {
  useExportColumnSelection,
  type ExportColumnDescriptor,
} from "../components/ExportColumnPicker";
import { printTable } from "../utils/printableTable";
import { useHeaderContextMenu, type ColumnType } from "../components/TableContextMenu";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { useFilterVisibility, type FilterVisibilityDescriptor } from "../components/FilterVisibilityPicker";

interface Carrier { id: string; name: string; isBroker?: boolean; parentCompanyId?: string | null; }
interface Producer { id: string; name: string; }
interface Row {
  policyId: string; policyNumber: string;
  startDate: string; endDate: string;
  customerName: string; insuranceCompany: string; producer: string | null;
  policyType: string; vehicleUseCategory: string | null; coverCode: string | null; status: string;
  /** All cover codes for the contract; legacy rows may omit this field. */
  coverageCodes?: string[];
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

const STATUSES = ["Prospect", "Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal"];
const PRODUCTION_FILTERS: FilterVisibilityDescriptor[] = [
  { key: "dateField", label: "Πεδίο ημερομηνίας" }, { key: "from", label: "Από" }, { key: "to", label: "Έως" },
  { key: "carrier", label: "Ασφαλιστική" }, { key: "subcarrier", label: "Υποασφαλιστική" },
  { key: "producer", label: "Συνεργάτης" }, { key: "type", label: "Κλάδος" }, { key: "use", label: "Χρήση οχήματος" },
  { key: "coverage", label: "Κάλυψη" }, { key: "package", label: "Πακέτο" }, { key: "status", label: "Κατάσταση" },
  { key: "groupBy", label: "Ομαδοποίηση" },
];

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
    // Which policy date the from/to window applies to:
    //   "start"    → Ημερομηνία έναρξης κάλυψης (default; backward-compat)
    //   "issued"   → Ημερομηνία έκδοσης από την ασφαλιστική
    //   "recorded" → Ημερομηνία καταχώρησης στο σύστημα
    // «Ημερομηνία πληρωμής» is deliberately NOT here — payment lives on
    // Receipts/Installments, not on Policy, so a payment-date filter
    // would need a subquery join. Punted as a follow-up.
    dateField: "start",
    insuranceCompanyId: "", producerId: "",
    policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
    status: "", groupBy: "carrier"
  });
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [filterSettingsOpen, setFilterSettingsOpen] = useState(false);
  const filterVisibility = useFilterVisibility("production-lists", PRODUCTION_FILTERS);

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

  // Show every Branch / Use item the office has entered in Παραμετρικά —
  // whether they filled in the PolicyType / VehicleUseCategory enum on
  // the row or not. The submitted value is the enum when set (strict
  // filter server-side) or the item's own code (the backend accepts it
  // as a string and looks it up via Παραμετρικά). No hardcoded fallbacks.
  const branchOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Branch")
      .map(p => ({
        key: `branch:${p.id}`,
        value: p.policyType ?? p.code,
        label: p.name,
      }));
    return f.insuranceCompanyId ? rows : distinctBy(rows);
  }, [carrierParams.data, tenantParams.data, f.insuranceCompanyId]);

  const useOptions = useMemo(() => {
    const source = f.insuranceCompanyId ? (carrierParams.data ?? []) : (tenantParams.data ?? []);
    const rows = source
      .filter(p => p.kind === "Use")
      .map(p => ({
        key: `use:${p.id}`,
        value: p.vehicleUseCategory && p.vehicleUseCategory !== "None"
          ? p.vehicleUseCategory
          : p.code,
        label: p.name,
      }));
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
    // Omit when at the "start" default so the query key doesn't split
    // the cache and old saved-report payloads keep matching.
    dateField: f.dateField && f.dateField !== "start" ? f.dateField : undefined,
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
  const officeProfile = useQuery({
    queryKey: ["agency-profile"],
    queryFn: async () => (await api.get<{
      name?: string | null; code?: string | null; contactEmail?: string | null;
      contactPhone?: string | null; addressLine?: string | null; vatNumber?: string | null;
    }>("/agency-profile")).data,
    staleTime: 5 * 60 * 1000,
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
  // Open the PolicyDetailDrawer (καρτέλα with καλύψεις / πακέτα / τα
  // πάντα ανά συμβόλαιο) when the operator clicks a row's Αρ. Συμβ.
  const [detailPolicyId, setDetailPolicyId] = useState<string | null>(null);
  const [coveragePolicyId, setCoveragePolicyId] = useState<string | null>(null);
  const coveragePolicyRow = useMemo(
    () => (q.data?.rows ?? []).find(r => r.policyId === coveragePolicyId) ?? null,
    [q.data?.rows, coveragePolicyId]
  );
  interface CoverageDetail {
    id: string;
    coverCode: string;
    coverName: string | null;
    grossPremium: number;
    netPremium: number;
    coverageAmount: number | null;
  }
  const coverageDetails = useQuery({
    queryKey: ["production-policy-covers", coveragePolicyId],
    enabled: !!coveragePolicyId,
    queryFn: async () => (await api.get<CoverageDetail[]>(`/policies/${coveragePolicyId}/covers`)).data,
  });
  const coverageCodesForRow = (r: Row): string[] => {
    const codes = (r.coverageCodes ?? []).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) return codes;
    if (!r.coverCode) return [];
    return r.coverCode.split(",").map(c => c.trim()).filter(Boolean);
  };
  const columns: ProductionColumn[] = [
    { key: "policyNumber",   label: t("productionList.col.policy"),
      render: r => (
        <Box component="button" type="button"
          onClick={() => setDetailPolicyId(r.policyId)}
          sx={{
            fontFamily: "monospace", fontWeight: 700, color: "primary.main",
            border: 0, bgcolor: "transparent", padding: 0, cursor: "pointer",
            textAlign: "left", textDecoration: "underline",
            textUnderlineOffset: 2, textDecorationColor: "transparent",
            "&:hover": { textDecorationColor: "inherit" },
          }}
          title="Άνοιγμα καρτέλας συμβολαίου (καλύψεις, πακέτα, ιστορικό)">
          {r.policyNumber}
        </Box>
      ),
      text: r => r.policyNumber },
    { key: "startDate",      label: t("productionList.col.start"),    render: r => <Box component="span" sx={{ fontSize: 12 }}>{date(r.startDate)}</Box>, text: r => date(r.startDate) },
    { key: "duration",       label: "Διάρκεια",                       render: r => <Box component="span" sx={{ fontSize: 12 }}>{contractDurationLabel(r.startDate, r.endDate)}</Box>, text: r => contractDurationLabel(r.startDate, r.endDate) },
    { key: "endDate",        label: "Λήξη",                            render: r => <Box component="span" sx={{ fontSize: 12 }}>{date(r.endDate)}</Box>,   text: r => date(r.endDate), defaultOff: true },
    { key: "customerName",   label: t("productionList.col.customer"), render: r => r.customerName,      text: r => r.customerName },
    { key: "carrier",        label: t("productionList.col.carrier"),  render: r => r.insuranceCompany, text: r => r.insuranceCompany },
    { key: "producer",       label: t("productionList.col.producer"), render: r => r.producer ?? "—",  text: r => r.producer ?? "" },
    { key: "type",           label: t("productionList.col.type"),     render: r => <Chip size="small" variant="outlined" label={r.policyType} />, text: r => r.policyType },
    { key: "use",            label: "Χρήση",                           render: r => r.vehicleUseCategory ? <Chip size="small" label={r.vehicleUseCategory} /> : <Box component="span" sx={{ color: "text.disabled" }}>—</Box>, text: r => r.vehicleUseCategory ?? "", defaultOff: true },
    { key: "cover",          label: "Καλύψεις",                        render: r => (
      <Button
        size="small"
        variant="contained"
        color="success"
        startIcon={<InfoOutlinedIcon fontSize="small" />}
        onClick={() => setCoveragePolicyId(r.policyId)}
        sx={{ minWidth: 0, px: 1.25, whiteSpace: "nowrap", fontSize: 11, color: "common.white" }}
      >
        Καλύψεις
      </Button>
    ), text: r => coverageCodesForRow(r).join(", ") },
    { key: "status",         label: t("productionList.status"),        render: r => r.status, text: r => r.status, defaultOff: true },
    { key: "gross",          label: t("productionList.col.gross"),    align: "right", render: r => <Box component="span" sx={{ fontWeight: 700 }}>{money(r.gross)}</Box>, text: r => money(r.gross) },
    { key: "net",            label: t("productionList.col.net"),      align: "right", render: r => money(r.net),  text: r => money(r.net) },
    { key: "bridgeComm",     label: "Συνολική προμ. έδρας πριν την κατανομή", align: "right", render: r => <Box component="span" sx={{ color: "info.main" }}>{money(r.incomingAgencyCommission)} ({r.incomingAgencyCommissionPercent.toFixed(1)}%)</Box>, text: r => `${money(r.incomingAgencyCommission)} (${r.incomingAgencyCommissionPercent.toFixed(1)}%)` },
    { key: "partnerPct",     label: t("productionList.col.partnerPct"), align: "right", render: r => <Box component="span" sx={{ color: "text.secondary" }}>{r.partnerCommissionPercent.toFixed(1)}%</Box>, text: r => `${r.partnerCommissionPercent.toFixed(1)}%` },
    { key: "partner",        label: t("productionList.col.partner"),  align: "right", render: r => <Box component="span" sx={{ color: "warning.main" }}>{money(r.partnerCommission)}</Box>, text: r => money(r.partnerCommission) },
    { key: "agency",         label: "Προμ. έδρας (υπόλοιπο)",          align: "right", render: r => <Box component="span" sx={{ color: "success.main", fontWeight: 700 }}>{money(r.agencyCommission)}</Box>, text: r => money(r.agencyCommission) },
  ];

  const pickerDescriptors: ExportColumnDescriptor[] = columns.map((c, i) => ({
    key: c.key, label: c.label,
    // The policy number anchors the report and always remains visible.
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

  // «Απόκρυψη προμ. έδρας» state removed — the operator now un-ticks the
  // bridgeComm / agency columns directly in the ExportColumnPicker for
  // the same effect. Legacy `kalypsis.productionList.hideAgency` key in
  // localStorage is left as-is (harmless dead data) — no migration.
  const hideAgencyCols = false;

  const visibleColumns = columns.filter(c => {
    if (!selection.activeKeys.includes(c.key)) return false;
    if (hideAgencyCols && (c.key === "bridgeComm" || c.key === "agency")) return false;
    return true;
  });

  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => { setSortKey(key); setSortDir(dir); },
    onHide: (key) => selection.toggle(key),
  });
  const inferColumnType = (key: string): ColumnType => {
    if (key === "startDate" || key === "endDate") return "date";
    if (["gross", "net", "vat", "bridgeComm", "partnerPct", "partner", "agency"].includes(key)) return "number";
    return "string";
  };

  // Groupers per «Ομαδοποίηση» dimension — the on-screen table lays out
  // one section per group when this returns a non-null classifier.
  const groupClassifier: ((r: Row) => string) | null = (() => {
    switch (f.groupBy) {
      case "carrier":  return r => r.insuranceCompany || "—";
      case "producer": return r => (r.producer ?? "Χωρίς συνεργάτη").trim() || "Χωρίς συνεργάτη";
      case "type":     return r => r.policyType || "—";
      case "month":    return r => (r.startDate ?? "").slice(0, 7) || "—";
      default:         return null;
    }
  })();

  const groupSummary = (rows: Row[]) => {
    const gross = rows.reduce((s, r) => s + (r.gross ?? 0), 0);
    const net = rows.reduce((s, r) => s + (r.net ?? 0), 0);
    const partner = rows.reduce((s, r) => s + (r.partnerCommission ?? 0), 0);
    const agency = rows.reduce((s, r) => s + (r.agencyCommission ?? 0), 0);
    return { gross, net, partner, agency, count: rows.length };
  };

  const totalsCell = (totals: { count?: number; gross: number; net: number; partner: number; agency: number }) => (
    <Stack spacing={0} sx={{ minWidth: 250, textAlign: "right", lineHeight: 1.15 }}>
      <Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
        {totals.count !== undefined && <>Πλήθος <b>{totals.count}</b> · </>}
        Μεικτό <b>{money(totals.gross)}</b> · Καθαρό <b>{money(totals.net)}</b>
      </Typography>
      <Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
        Προμ. Συνεργάτη <b style={{ color: "#ed6c02" }}>{money(totals.partner)}</b>
        {` · `}
        Προμ. Γραφείου <b style={{ color: "#2e7d32" }}>{money(totals.agency)}</b>
      </Typography>
    </Stack>
  );

  // Turn the filtered row set into ordered sections based on the current
  // «Ομαδοποίηση». String groups sort alphabetically (Greek locale) with
  // «Χωρίς συνεργάτη» / «—» pinned at the end; month groups sort
  // chronologically desc so the newest lands on top.
  const sections = useMemo(() => {
    const rows = q.data?.rows ?? [];
    if (!groupClassifier) return [] as Array<{ key: string; rows: Row[] }>;
    const byKey = new Map<string, Row[]>();
    for (const r of rows) {
      const key = groupClassifier(r);
      const bucket = byKey.get(key);
      if (bucket) bucket.push(r); else byKey.set(key, [r]);
    }
    const entries = Array.from(byKey.entries());
    const isEmpty = (v: string) => v === "Χωρίς συνεργάτη" || v === "—";
    entries.sort(([a], [b]) => {
      if (isEmpty(a) && !isEmpty(b)) return 1;
      if (!isEmpty(a) && isEmpty(b)) return -1;
      if (f.groupBy === "month") return b.localeCompare(a);
      return a.localeCompare(b, "el");
    });
    return entries.map(([key, list]) => {
      const sorted = list.slice().sort((x, y) =>
        (y.startDate ?? "").localeCompare(x.startDate ?? ""));
      return { key, rows: sorted };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.rows, f.groupBy]);

  async function downloadExport(fmt: "csv" | "xlsx" | "pdf") {
    // Client-side CSV when a grouping is active — need per-section subtotals
    // interleaved with the rows, and the server export doesn't emit those.
    if (fmt === "csv" && sections.length > 0) {
      const rows = q.data?.rows ?? [];
      if (rows.length === 0) return;
      const activeCols = visibleColumns;
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = activeCols.map(c => esc(c.label)).join(",");
      const dimLabel = f.groupBy === "carrier"  ? "Εταιρία"
                     : f.groupBy === "producer" ? "Συνεργάτης"
                     : f.groupBy === "type"     ? "Κλάδος"
                     : "Μήνας";
      const lines: string[] = [];
      const office = (await api.get<{
        name?: string | null; addressLine?: string | null; contactPhone?: string | null;
        contactEmail?: string | null; vatNumber?: string | null;
      }>("/agency-profile")).data;
      const officeDetails = [office.addressLine, office.contactPhone, office.contactEmail,
        office.vatNumber ? `ΑΦΜ: ${office.vatNumber}` : null].filter(Boolean).join(" · ");
      lines.push(esc(office.name ?? "Kalypsis"));
      if (officeDetails) lines.push(esc(officeDetails));
      lines.push("");
      for (const s of sections) {
        const totals = groupSummary(s.rows);
        lines.push("");
        lines.push(esc(`${dimLabel}: ${s.key} — ${totals.count} συμβόλαια`));
        lines.push(header);
        for (const r of s.rows) {
          lines.push(activeCols.map(c => esc(c.text(r))).join(","));
        }
        const subtotalBits = [
          `Υποσύνολο: ${totals.count} συμβόλαια`,
          `${money(totals.gross)} μικτά`,
          `${money(totals.net)} καθαρά`,
          `${money(totals.partner)} προμ. συν.`,
        ];
        if (!hideAgencyCols) subtotalBits.push(`${money(totals.agency)} προμ. έδρας`);
        lines.push(esc(subtotalBits.join(" · ")));
      }
      const csv = `﻿${lines.join("\r\n")}\r\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `production-grouped-${f.groupBy}-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    // `totals` is a screen/print summary column composed from the row DTO;
    // older server exporters do not know that synthetic key. Never send it
    // to the API, while keeping it in the on-screen and grouped CSV view.
    const activeKeys = selection.activeKeys;
    const exportableKeys = activeKeys.filter(key => key !== "totals");
    const columnsParam = exportableKeys.length > 0 ? exportableKeys.join(",") : undefined;
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

  // Client-side Print — mirrors what's on screen. When a grouping is
  // active, prints one section per group with per-group subtotals at the
  // bottom, before the next group starts. When no grouping, prints the
  // flat table as-is.
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
    if (f.groupBy) {
      const dim = f.groupBy === "carrier"  ? "εταιρία"
                : f.groupBy === "producer" ? "συνεργάτη"
                : f.groupBy === "type"     ? "κλάδο"
                : "μήνα";
      filterBits.push(`Ομαδοποίηση: ανά ${dim}`);
    }

    const printCols = visibleColumns.map(c => ({ key: c.key, label: c.label, map: c.text }));
    printTable<Row>({
      title: t("productionList.title"),
      subtitle: filterBits.join(" · "),
      columns: printCols,
      rows,
      office: officeProfile.data ? {
        name: officeProfile.data.name,
        code: officeProfile.data.code,
        email: officeProfile.data.contactEmail,
        phone: officeProfile.data.contactPhone,
        address: officeProfile.data.addressLine,
        vatNumber: officeProfile.data.vatNumber,
      } : null,
      orientation: "landscape",
      groups: sections.length > 0
        ? sections.map(s => {
            const t = groupSummary(s.rows);
            const bits = [
              `${t.count} συμβόλαια`,
              `${money(t.gross)} μικτά`,
              `${money(t.partner)} προμ. συν.`,
            ];
            if (!hideAgencyCols) bits.push(`${money(t.agency)} προμ. έδρας`);
            return { title: s.key, summary: bits.join(" · "), rows: s.rows };
          })
        : undefined,
    });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={1.25} flexWrap="wrap" gap={1}>
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
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0, maxWidth: "100%" }}>
          <SavedReportsButton entity="production-lists" currentFilters={f} onLoad={(next) => setF({ ...f, ...next })}
            saveRequestToken={saveFilterRequest} />
          {/* «Ετήσια παραγωγή» button removed from the header. The report
              is still reachable via /app/production-report (old bookmarks
              keep working); it's no longer a standalone entry point in
              the UI to reduce header clutter. */}
          <Button
            variant="contained"
            startIcon={<MoreHorizIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(event) => setActionsAnchor(event.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={Boolean(actionsAnchor)}
            sx={{ whiteSpace: "nowrap", minWidth: 132 }}
          >
            Ενέργειες
          </Button>
          <Menu
            anchorEl={actionsAnchor}
            open={Boolean(actionsAnchor)}
            onClose={() => setActionsAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { minWidth: 255, maxWidth: "calc(100vw - 24px)" } } }}
          >
            <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }}
              sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc", color: "#084d91" } }}>
              <ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Αποθήκευση νέου φίλτρου" secondary="Προσθήκη στα αποθηκευμένα φίλτρα" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setActionsAnchor(null); openPrint(); }}
              sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7", color: "#345573" } }}>
              <ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary={t("common.print", "Εκτύπωση")} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setActionsAnchor(null); void downloadExport("csv"); }}
              sx={{ color: "#087f73", "&:hover": { bgcolor: "#e5f6f3", color: "#06675e" } }}>
              <ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Εξαγωγή CSV" />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); void downloadExport("xlsx"); }}
              sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec", color: "#116337" } }}>
              <ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Εξαγωγή Excel" />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); void downloadExport("pdf"); }}
              sx={{ color: "#c73545", "&:hover": { bgcolor: "#fdecef", color: "#a72836" } }}>
              <ListItemIcon sx={{ color: "#c73545" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Εξαγωγή PDF" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setActionsAnchor(null); setColumnSettingsOpen(true); }}
              sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb", color: "#474184" } }}>
              <ListItemIcon sx={{ color: "#5b55a5" }}><ViewColumnIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Στήλες πίνακα & εξαγωγής" secondary={`${selection.activeKeys.length}/${pickerDescriptors.length} ενεργές`} />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); setFilterSettingsOpen(true); }}
              sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df", color: "#814700" } }}>
              <ListItemIcon sx={{ color: "#a45b00" }}><TuneIcon fontSize="small" /></ListItemIcon>
              <ListItemText
                primary="Εμφανιζόμενα φίλτρα"
                secondary={`${PRODUCTION_FILTERS.filter((filter) => !filterVisibility.off.has(filter.key)).length}/${PRODUCTION_FILTERS.length} ενεργά`}
              />
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Στήλες πίνακα & εξαγωγής</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Οι επιλογές εφαρμόζονται στον πίνακα, στην εκτύπωση και στα αρχεία εξαγωγής.
          </Typography>
          <Stack>
            {pickerDescriptors.map(column => (
              <FormControlLabel
                key={column.key}
                control={<Checkbox checked={!selection.off.has(column.key)} onChange={() => selection.toggle(column.key)} />}
                label={column.label}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button onClick={() => selection.setAll(true)}>Όλες</Button>
          <Button onClick={() => selection.setAll(false)}>Καμία</Button>
          <Button onClick={selection.reset}>Επαναφορά</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setColumnSettingsOpen(false)}>Ολοκλήρωση</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={filterSettingsOpen} onClose={() => setFilterSettingsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Εμφανιζόμενα φίλτρα</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Επιλέξτε ποια πεδία χρειάζεστε στην επιφάνεια φίλτρων και στο responsive popup.
          </Typography>
          <Stack>
            {PRODUCTION_FILTERS.map(filter => (
              <FormControlLabel
                key={filter.key}
                control={<Checkbox checked={!filterVisibility.off.has(filter.key)} onChange={() => filterVisibility.toggle(filter.key)} />}
                label={filter.label}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button onClick={() => filterVisibility.setAll(true)}>Όλα</Button>
          <Button onClick={() => filterVisibility.setAll(false)}>Κανένα</Button>
          <Button onClick={filterVisibility.reset}>Επαναφορά</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setFilterSettingsOpen(false)}>Ολοκλήρωση</Button>
        </DialogActions>
      </Dialog>

      <ResponsiveFilterPanel
        compactAt="xl"
        activeCount={[
          f.insuranceCompanyId, f.producerId, f.policyType, f.vehicleUseCategory,
          f.coverCode, f.packageCode, f.status,
        ].filter(Boolean).length}
        title="Φίλτρα λίστας παραγωγής"
        cardSx={{ py: .85, mb: 1.25 }}
      >
        {/* Compact grid — 6 columns on lg, 3 on md. Same ? position unchanged
            (next to the page title above). */}
        <Box sx={{ display: "grid", gap: .85, alignItems: "start", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" } }}>
          {/* «Πεδίο ημερομηνίας» — switches which policy date the Από/Έως
              window filters on. Default «Έναρξη» preserves backward-compat
              with saved reports. «Πληρωμή» is intentionally omitted for
              now: payments live on Receipts, not Policy, so that filter
              would need a join. */}
          {filterVisibility.visible("dateField") && <SearchableSelect
            label="Πεδίο ημερομηνίας"
            value={f.dateField}
            onChange={(v) => setF({ ...f, dateField: v || "start" })}
            options={[
              { value: "issued", label: "Ημερομηνία Έκδοσης" },
              { value: "start", label: "Ημερομηνία Έναρξης" },
              { value: "recorded", label: "Ημερομηνία Καταχώρησης" },
            ]}
          />}
          {filterVisibility.visible("from") && <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.from")}
            value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />}
          {filterVisibility.visible("to") && <TextField type="date" size="small" InputLabelProps={{ shrink: true }} label={t("productionList.to")}
            value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />}
          {filterVisibility.visible("carrier") && <SearchableSelect
            label={t("productionList.carrier")}
            value={f.insuranceCompanyId}
            onChange={(v) => setF({ ...f, insuranceCompanyId: v, policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
            emptyLabel={t("common.all")}
            options={(carriers.data ?? []).filter(c => !c.parentCompanyId).map(c => ({
              value: c.id, label: c.name, hint: c.isBroker ? "πρακτορείο" : undefined,
            }))}
          />}
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
            if (!broker?.isBroker || !filterVisibility.visible("subcarrier")) return null;
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
          {filterVisibility.visible("producer") && <SearchableSelect
            label={t("productionList.producer")}
            value={f.producerId} onChange={(v) => setF({ ...f, producerId: v })}
            emptyLabel={t("common.all")}
            options={(producers.data ?? []).map(p => ({ value: p.id, label: p.name }))}
          />}
          {filterVisibility.visible("type") && <SearchableSelect
            label={t("productionList.type")}
            value={f.policyType} onChange={(v) => setF({ ...f, policyType: v })}
            disabled={branchOptions.length === 0}
            emptyLabel={t("common.all")}
            options={branchOptions.map(o => ({ value: o.value, label: o.label }))}
          />}
          {filterVisibility.visible("use") && <SearchableSelect
            label="Χρήση οχήματος"
            value={f.vehicleUseCategory} onChange={(v) => setF({ ...f, vehicleUseCategory: v })}
            disabled={useOptions.length === 0}
            emptyLabel={t("common.all")}
            options={useOptions.map(o => ({ value: o.value, label: o.label }))}
          />}
          {filterVisibility.visible("coverage") && <SearchableSelect
            label="Κάλυψη"
            value={f.coverCode} onChange={(v) => setF({ ...f, coverCode: v })}
            disabled={coverageOptions.length === 0}
            emptyLabel={t("common.all")}
            options={coverageOptions.map(o => ({ value: o.value, label: o.label }))}
          />}
          {filterVisibility.visible("package") && <SearchableSelect
            label="Πακέτο"
            value={f.packageCode} onChange={(v) => setF({ ...f, packageCode: v })}
            disabled={packageOptions.length === 0}
            emptyLabel={t("common.all")}
            options={packageOptions.map(o => ({ value: o.value, label: o.label }))}
          />}
          {filterVisibility.visible("status") && <SearchableTextField size="small" label={t("productionList.status")} value={f.status}
            onChange={e => setF({ ...f, status: e.target.value })}>
            <MenuItem value="">{t("common.all")}</MenuItem>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{String(t(`policies.statuses.${s}`, s))}</MenuItem>)}
          </SearchableTextField>}
          {filterVisibility.visible("groupBy") && <SearchableTextField size="small" label={t("productionList.groupBy")} value={f.groupBy}
            onChange={e => setF({ ...f, groupBy: e.target.value })}>
            <MenuItem value="">{t("productionList.noGrouping")}</MenuItem>
            <MenuItem value="carrier">{t("productionList.byCarrier")}</MenuItem>
            <MenuItem value="producer">{t("productionList.byProducer")}</MenuItem>
            <MenuItem value="type">{t("productionList.byType")}</MenuItem>
            <MenuItem value="month">{t("productionList.byMonth")}</MenuItem>
          </SearchableTextField>}
        </Box>
        <Stack direction="row" justifyContent="flex-end" mt={1.5}>
          <Button size="small"
            onClick={() => setF({
              from: monthStart, to: todayStr, dateField: "start",
              insuranceCompanyId: "", producerId: "",
              policyType: "", vehicleUseCategory: "", coverCode: "", packageCode: "",
              status: "", groupBy: "carrier"
            })} color="error" variant="contained">Καθαρισμός φίλτρων</Button>
        </Stack>
      </ResponsiveFilterPanel>

      {q.isLoading ? <CircularProgress /> : !q.data ? null : (
        <>
          {/* Grand totals strip */}
          <Card variant="outlined" sx={{ p: .65, mb: 1, bgcolor: "#e6edf5", borderColor: "#d5e0ec", boxShadow: "none" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: .65 }}>
              <Kpi label={t("productionList.kpi.policies")} value={q.data.grand.count} />
              <Kpi label={t("productionList.kpi.gross")} value={money(q.data.grand.gross)} tone="info" />
              <Kpi label={t("productionList.kpi.net")} value={money(q.data.grand.net)} tone="success" />
              <Kpi label={t("productionList.kpi.partnerComm")} value={money(q.data.grand.partnerCommission)} color="error.dark" tone="warning" />
              <Kpi label={t("productionList.kpi.agencyComm")} value={money(q.data.grand.agencyCommission)} color="success.main" tone="success" />
            </Box>
          </Card>

          {/* Aggregate totals per group — read-only summary above the
              detail table. When the operator selects an «Ομαδοποίηση» in
              the filters, the detail table below also lays itself out in
              matching sections with per-group subtotals inline. */}
          {q.data.groups.length > 0 && (
            <Card sx={{ p: 2, mb: 2 }} variant="outlined">
              <Typography fontWeight={700} mb={1}>{t("productionList.groupTotals")}</Typography>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{t("productionList.group")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{t("productionList.count")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{t("productionList.kpi.gross")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{t("productionList.kpi.net")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{t("productionList.kpi.partnerComm")}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{t("productionList.kpi.agencyComm")}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {q.data.groups.map(g => (
                    <TableRow key={g.key} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{g.key}</TableCell>
                      <TableCell align="right">{g.count}</TableCell>
                      <TableCell align="right" sx={{
                        fontWeight: 800,
                        bgcolor: "rgba(31,123,179,0.09)",
                        borderBottom: "1px solid rgba(31,123,179,0.18)",
                      }}>{money(g.gross)}</TableCell>
                      <TableCell align="right" sx={{
                        fontWeight: 800,
                        color: "success.dark",
                        bgcolor: "rgba(46,125,50,0.12)",
                        borderBottom: "1px solid rgba(46,125,50,0.22)",
                      }}>{money(g.net)}</TableCell>
                      <TableCell align="right" sx={{
                        color: "warning.dark",
                        fontWeight: 700,
                        bgcolor: "rgba(237,108,2,0.10)",
                        borderBottom: "1px solid rgba(237,108,2,0.20)",
                      }}>{money(g.partnerCommission)}</TableCell>
                      <TableCell align="right" sx={{
                        color: "success.dark",
                        fontWeight: 800,
                        bgcolor: "rgba(46,125,50,0.12)",
                        borderBottom: "1px solid rgba(46,125,50,0.22)",
                      }}>{money(g.agencyCommission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                        whiteSpace: "nowrap",
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
                  const sortRows = (list: Row[]): Row[] => {
                    if (!sortKey) return list;
                    const col = columns.find(c => c.key === sortKey);
                    if (!col) return list;
                    const type = inferColumnType(sortKey);
                    const arr = list.slice();
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
                  };

                  // GROUPED VIEW — one section per group with a header row
                  // (colspan across the whole width), the group's rows, and
                  // a subtotal footer row before the next group starts.
                  // Pagination is disabled in grouped mode: operators
                  // grouping by producer/carrier/etc want the whole picture
                  // in one go, and paginating across group boundaries
                  // splits sections mid-flow.
                  if (sections.length > 0) {
                    return sections.flatMap(sec => {
                      const rows = sortRows(sec.rows);
                      const totals = groupSummary(rows);
                      return [
                        <TableRow key={`hdr-${sec.key}`}
                          sx={{ bgcolor: "action.hover" }}>
                          <TableCell colSpan={visibleColumns.length}
                            sx={{ fontWeight: 800, color: "primary.main", py: 1 }}>
                            {sec.key}
                            <Typography component="span" sx={{ ml: 1, fontWeight: 500, color: "text.secondary", fontSize: 12 }}>
                              — {totals.count} συμβόλαια · {money(totals.gross)} μικτά · {money(totals.partner)} προμ. συν.
                              {!hideAgencyCols && <> · {money(totals.agency)} προμ. έδρας</>}
                            </Typography>
                          </TableCell>
                        </TableRow>,
                        ...rows.map(r => (
                          <TableRow key={r.policyId} hover>
                            {visibleColumns.map(c => (
                              <TableCell key={c.key} align={c.align}>{c.render(r)}</TableCell>
                            ))}
                          </TableRow>
                        )),
                        <TableRow key={`sub-${sec.key}`}
                          sx={{
                            bgcolor: "rgba(46,125,50,0.10)",
                            borderTop: "2px solid",
                            borderColor: "rgba(46,125,50,0.28)",
                            "& .MuiTableCell-root": { py: 1 },
                          }}>
                          {visibleColumns.map(c => {
                            const label = c.key === "policyNumber"
                              ? `Υποσύνολο · ${sec.key}` : "";
                            if (c.key === "gross")  return <TableCell key={c.key} align="right" sx={{ fontWeight: 800 }}>{money(totals.gross)}</TableCell>;
                            if (c.key === "net")    return <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>{money(totals.net)}</TableCell>;
                            if (c.key === "partner") return <TableCell key={c.key} align="right" sx={{ fontWeight: 700, color: "warning.main" }}>{money(totals.partner)}</TableCell>;
                            if (c.key === "agency")  return <TableCell key={c.key} align="right" sx={{ fontWeight: 800, color: "success.main" }}>{money(totals.agency)}</TableCell>;
                            if (c.key === "totals") return <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>{totalsCell(totals)}</TableCell>;
                            return (
                              <TableCell key={c.key} align={c.align}
                                sx={{
                                  fontWeight: 800,
                                  color: "success.dark",
                                  whiteSpace: "nowrap",
                                  fontSize: 12,
                                }}>
                                {label}
                              </TableCell>
                            );
                          })}
                        </TableRow>,
                      ];
                    });
                  }

                  // FLAT VIEW — original behaviour, with pagination.
                  const sorted = sortRows(q.data.rows);
                  const start = page * rowsPerPage;
                  return sorted.slice(start, start + rowsPerPage).map(r => (
                    <TableRow key={r.policyId} hover>
                      {visibleColumns.map(c => (
                        <TableCell key={c.key} align={c.align}>{c.render(r)}</TableCell>
                      ))}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
            {sections.length === 0 && (
              <TablePagination
                component="div"
                count={q.data.rows.length}
                page={page}
                onPageChange={(_e, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[10, 25, 50, 100, 250]}
                labelRowsPerPage="Γραμμές ανά σελίδα"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} από ${count}`}
              />
            )}
            {sections.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">
                  Ομαδοποίηση ανά {f.groupBy === "carrier" ? "εταιρία"
                    : f.groupBy === "producer" ? "συνεργάτη"
                    : f.groupBy === "type" ? "κλάδο" : "μήνα"} — {sections.length} ομάδες · {q.data.rows.length} συμβόλαια συνολικά.
                  Η σελιδοποίηση απενεργοποιείται σε αναλυτική ομαδοποίηση.
                </Typography>
              </Box>
            )}
          </Card>
          {headerMenu.menu}

        </>
      )}
      <Dialog
        open={coveragePolicyId !== null}
        onClose={() => setCoveragePolicyId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pb: 1 }}>
          Καλύψεις συμβολαίου {coveragePolicyRow?.policyNumber ?? ""}
          {coveragePolicyRow?.customerName ? (
            <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>
              · {coveragePolicyRow.customerName}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          {coverageDetails.isLoading && <CircularProgress size={24} />}
          {coverageDetails.isError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Δεν ήταν δυνατή η ανάκτηση των αναλυτικών καλύψεων. Εμφανίζονται οι διαθέσιμοι κωδικοί της λίστας.
            </Alert>
          )}
          {!coverageDetails.isLoading && (coverageDetails.data?.length ?? 0) > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Κωδικός</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Περιγραφή</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Μικτά</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Καθαρά</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Κεφάλαιο</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {coverageDetails.data!.map(c => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.coverCode}</TableCell>
                    <TableCell>{c.coverName || "—"}</TableCell>
                    <TableCell align="right">{money(c.grossPremium)}</TableCell>
                    <TableCell align="right">{money(c.netPremium)}</TableCell>
                    <TableCell align="right">{c.coverageAmount == null ? "—" : money(c.coverageAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!coverageDetails.isLoading && (coverageDetails.data?.length ?? 0) === 0 && coveragePolicyRow && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Το συμβόλαιο δεν έχει ακόμη αναλυτικές γραμμές κάλυψης. Διαθέσιμοι κωδικοί από την εισαγωγή:
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {coverageCodesForRow(coveragePolicyRow).length > 0
                  ? coverageCodesForRow(coveragePolicyRow).map(code => <Chip key={code} size="small" label={code} />)
                  : <Typography color="text.disabled">Δεν έχουν καταχωρηθεί καλύψεις.</Typography>}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCoveragePolicyId(null)}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
      <PolicyDetailDrawer
        policyId={detailPolicyId}
        open={detailPolicyId !== null}
        onClose={() => setDetailPolicyId(null)}
      />
    </Box>
  );
}

export function Kpi({ label, value, color, tone = "neutral" }: {
  label: string;
  value: React.ReactNode;
  color?: string;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const backgrounds = {
    neutral: "#f0f2f5",
    info: "#eaf2fa",
    success: "#edf6f0",
    warning: "#fbefef",
  } as const;
  const borders = {
    neutral: "#d0d9e4",
    info: "#bfd3e7",
    success: "#bed8c8",
    warning: "#e3bfc2",
  } as const;
  return (
    <Box role="group" aria-label={label} sx={{ minWidth: 0, minHeight: 36, px: .8, py: .45, borderRadius: .8, bgcolor: backgrounds[tone], border: "1px solid", borderColor: borders[tone], display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: .65, rowGap: .1 }}>
      <Typography variant="caption" sx={{ color: "#536b89", fontWeight: 700, fontSize: ".69rem", lineHeight: 1.2, overflowWrap: "anywhere" }}>{label}</Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: color ?? (tone === "warning" ? "#8d343d" : "#102d55"), fontSize: ".82rem", lineHeight: 1.25, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere", minWidth: 0 }}>{value}</Typography>
    </Box>
  );
}

