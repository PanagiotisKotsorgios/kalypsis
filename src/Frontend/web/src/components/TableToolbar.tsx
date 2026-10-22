import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import PrintIcon from "@mui/icons-material/Print";
import { printActionSx } from "./actionButtonStyles";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { api, extractErrorMessage } from "../api/client";
import { buildTableExportSnapshot, groupTableExportRows } from "../utils/tableExportSnapshot";
import { printTable, type ExportOfficeInfo } from "../utils/printableTable";
import { ExportColumnPicker, useExportColumnSelection, type ExportColumnDescriptor } from "./ExportColumnPicker";
import { ExportFormatMenu, type ExportFormat } from "./ExportFormatMenu";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";

/* ============================================================================
   Numbered pager — renders 1, 2, … current ±2, … last, with prev/next/jumpers.
   ========================================================================= */
export function RecordCountChip({ count, label = "εγγραφές" }: { count: number; label?: string }) {
  return <Chip size="small" label={`${count} ${label}`} sx={{ bgcolor: "#159B59", color: "#fff", fontWeight: 800, height: 26, "& .MuiChip-label": { px: 1.15 } }} />;
}

export function NumberedPager({ page, totalPages, onPage, totalRows, pageSize, onPageSize, pageSizeOptions = [10, 25, 50, 100, 250] }: {
  page: number; totalPages: number; onPage: (p: number) => void;
  /** Optional metadata — when both are supplied we show «1–25 από 137». */
  totalRows?: number;
  pageSize?: number;
  onPageSize?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const { t } = useTranslation();

  // Always render — even a single-page result gets a «1–17 από 17» count
  // line so pagination looks and behaves consistently across every list
  // in the app. Nav buttons are just disabled when there's nowhere to go.

  // Compute compact page list with ellipses.
  const pages = new Set<number>([1, totalPages, page]);
  for (let d = 1; d <= 2; d++) {
    if (page - d >= 1) pages.add(page - d);
    if (page + d <= totalPages) pages.add(page + d);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  let last = 0;
  for (const p of sorted) {
    if (p - last > 1) items.push("…");
    items.push(p);
    last = p;
  }

  const rangeLabel = (totalRows !== undefined && pageSize !== undefined)
    ? (() => {
        if (totalRows === 0) return "0 από 0";
        const from = (page - 1) * pageSize + 1;
        const to = Math.min(page * pageSize, totalRows);
        return `${from}–${to} από ${totalRows}`;
      })()
    : null;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1} sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent={{ xs: "center", sm: "flex-start" }} spacing={0.5} flexWrap="wrap">
      {rangeLabel && (
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1, fontVariantNumeric: "tabular-nums" }}>
          {rangeLabel}
        </Typography>
      )}
      <IconButton size="small" disabled={page <= 1} onClick={() => onPage(1)} title={t("pager.first")}>
        <FirstPageIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={page <= 1} onClick={() => onPage(page - 1)} title={t("pager.prev")}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      {items.map((it, i) =>
        it === "…"
          ? <Typography key={`e${i}`} sx={{ px: 0.5, color: "text.secondary" }}>…</Typography>
          : <Button key={it} size="small" variant={it === page ? "contained" : "text"}
              onClick={() => onPage(it)}
              sx={{ minWidth: 32, px: 1.2, py: 0.4,
                fontWeight: it === page ? 800 : 500 }}>
              {it}
            </Button>
      )}
      <IconButton size="small" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title={t("pager.next")}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={page >= totalPages} onClick={() => onPage(totalPages)} title={t("pager.last")}>
        <LastPageIcon fontSize="small" />
      </IconButton>
      </Stack>
      {pageSize !== undefined && onPageSize && <TextField select size="small" label={t("table.pageSize")} value={pageSize}
        onChange={(event) => onPageSize(Number(event.target.value))} sx={{ width: { xs: "100%", sm: 112 }, flexShrink: 0 }}>
        {pageSizeOptions.map(size => <MenuItem key={size} value={size}>{size}</MenuItem>)}
      </TextField>}
    </Stack>
  );
}

/* ============================================================================
   Toolbar — search + page-size selector + CSV/Excel/PDF/Print buttons.
   Honors an optional visibleColumnKeys filter (from useColumnPreferences) so
   the picker on the table also drives what gets exported and printed.
   ========================================================================= */
export function TableToolbar<T>({
  query, onQuery, count, filteredCount,
  pageSize, onPageSize,
  exportRows, exportFileName, exportColumns,
  serverEntity, serverParams,
  visibleColumnKeys,
  printTitle,
  printSubtitle,
  columnSelectionId,
  hideColumnPicker,
  hideSearch,
  extraExportColumns,
  rightSlot,
  actionRequest,
  hideActionButtons = false,
  hideCount = false,
  hidePageSize = false,
  snapshotExport = false,
  exportGroupBy,
}: {
  query: string;
  onQuery: (s: string) => void;
  count: number;
  filteredCount: number;
  pageSize: number;
  onPageSize: (n: number) => void;
  exportRows: T[];
  exportFileName: string;
  exportColumns: { key: keyof T | string; label: string; map?: (r: T) => any }[];
  /** When set, CSV/Excel/PDF buttons hit /api/data-exports/{entity} with the same search & filters.
   *  Backed by UniversalExportHandler — supports the agency-wide entity catalogue, not just paragogi. */
  serverEntity?:
    | "customers" | "policies" | "claims" | "producers"
    | "insurance-companies" | "commission-rules" | "branches" | "tariffs"
    | "tasks" | "receipts" | "payments" | "appointments"
    | "cover-notes" | "email-templates" | "notifications";
  serverParams?: Record<string, string | number | undefined | null>;
  /** Subset of column keys currently visible. When set, CSV/Excel/PDF/Print
   *  emit only those columns — so the on-screen column picker also drives
   *  what leaves the app. Undefined => export every declared column. */
  visibleColumnKeys?: string[];
  /** Title printed at the top of the print output. Defaults to exportFileName. */
  printTitle?: string;
  /** Optional subtitle line (e.g. "Filtered by ‹something›"). */
  printSubtitle?: string;
  /** localStorage bucket for the export-column selector. Defaults to
   *  `serverEntity ?? exportFileName` — pass an explicit id to share the
   *  selection across multiple toolbars on the same page. */
  columnSelectionId?: string;
  /** Hide the export-column picker even when exportColumns is provided
   *  (useful for very small/synthetic column sets). */
  hideColumnPicker?: boolean;
  /** Hide the toolbar search when the page renders its single search field
   *  alongside the rest of its filters. */
  hideSearch?: boolean;
  /** Columns that are NOT rendered on-screen but can be opted into the
   *  export. Useful for internal ids, audit fields, and similar. */
  extraExportColumns?: { key: keyof T | string; label: string; map?: (r: T) => any; defaultOff?: boolean }[];
  rightSlot?: React.ReactNode;
  /** Execute toolbar actions from a page-level «Ενέργειες» menu. */
  actionRequest?: { token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" };
  /** Hide duplicate inline actions when a page-level menu controls them. */
  hideActionButtons?: boolean;
  /** Count may be rendered beside the page title as a RecordCountChip. */
  hideCount?: boolean;
  /** Page size may be rendered beside the bottom NumberedPager. */
  hidePageSize?: boolean;
  /** Format the exact browser table snapshot on the server for all formats. */
  snapshotExport?: boolean;
  /** Mirror the visible group headings in every snapshot format and printout. */
  exportGroupBy?: (row: T) => string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const officeQuery = useQuery({
    queryKey: ["agency-profile"],
    queryFn: async () => (await api.get<{
      name?: string | null; code?: string | null; contactEmail?: string | null;
      contactPhone?: string | null; addressLine?: string | null; vatNumber?: string | null;
    }>("/agency-profile")).data,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
  const officeInfo: ExportOfficeInfo = {
    name: officeQuery.data?.name ?? user?.tenantName ?? (snapshotExport ? "Γραφείο" : "Kalypsis"),
    code: officeQuery.data?.code,
    email: officeQuery.data?.contactEmail,
    phone: officeQuery.data?.contactPhone,
    address: officeQuery.data?.addressLine,
    vatNumber: officeQuery.data?.vatNumber,
  };

  // Merge the base + extra columns into the export universe. Extras are
  // marked `defaultOff` so the export behaves identically to before unless
  // the user explicitly ticks them.
  const allExportColumns = [
    ...exportColumns.map(c => ({ ...c, defaultOff: false as boolean | undefined })),
    ...(extraExportColumns ?? []).map(c => ({ ...c, defaultOff: c.defaultOff ?? true })),
  ];

  const pickerDescriptors: ExportColumnDescriptor[] = allExportColumns.map((c, i) => ({
    key: String(c.key),
    label: c.label,
    defaultOff: c.defaultOff,
    // First column locks by default — it's usually the primary id that
    // makes the export interpretable.
    alwaysOn: i === 0,
  }));

  const pickerId = columnSelectionId ?? serverEntity ?? exportFileName;
  const selection = useExportColumnSelection(pickerId, pickerDescriptors);
  const [columnPickerRequest, setColumnPickerRequest] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const selectedKeys = new Set(selection.activeKeys);

  // Filter export columns by (a) the display-column whitelist if the caller
  // passed one, and (b) the export-column picker selection. Preserves the
  // caller's declared order.
  const selectedColumns = allExportColumns.filter(c => {
    const k = String(c.key);
    if (!selectedKeys.has(k)) return false;
    if (visibleColumnKeys && visibleColumnKeys.length > 0 && !visibleColumnKeys.includes(k)) {
      // Display-picker also weighs in — only exclude keys the display picker
      // KNOWS about; unknown keys (e.g. extras) stay based on export selection.
      const known = exportColumns.some(ec => String(ec.key) === k);
      if (known) return false;
    }
    return true;
  });
  const effectiveColumns = snapshotExport && visibleColumnKeys
    ? visibleColumnKeys.flatMap(key => selectedColumns.filter(column => String(column.key) === key))
    : selectedColumns;

  async function downloadSnapshot(format: "csv" | "xlsx" | "pdf") {
    setExportError(null);
    if (!effectiveColumns.length) {
      setExportError("Επιλέξτε τουλάχιστον μία στήλη για την εξαγωγή.");
      return;
    }
    try {
      const snapshot = buildTableExportSnapshot(printTitle ?? exportFileName, effectiveColumns, exportRows, printSubtitle, exportGroupBy);
      const response = await api.post("/table-exports", snapshot, { params: { format }, responseType: "blob" });
      const mime = format === "csv" ? "text/csv;charset=utf-8"
        : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
      triggerDownload(new Blob([response.data], { type: mime }), `${exportFileName}.${format}`);
    } catch (error) { setExportError(extractErrorMessage(error)); }
  }

  const buildClientMatrix = (): any[][] => {
    const officeDetails = [officeInfo.address, officeInfo.phone, officeInfo.email,
      officeInfo.vatNumber ? `ΑΦΜ: ${officeInfo.vatNumber}` : null]
      .filter(Boolean).join(" · ");
    const rows = exportRows.map(r => effectiveColumns.map(c =>
      c.map ? c.map(r) : (r as any)[c.key]
    ));
    return [
      [officeInfo.name || "Kalypsis"],
      [officeDetails],
      [printTitle ?? exportFileName],
      [],
      effectiveColumns.map(c => c.label),
      ...rows,
    ];
  };

  // Trailer rows appended to every client-side CSV / Excel export so the
  // reader can always trace the file back to Kalypsis. Two empty rows
  // separate the trailer from the data body.
  const buildBrandingTrailer = (): any[][] => {
    const stamp = new Date().toLocaleString("el-GR");
    return [
      [],
      [],
      [`© ${new Date().getFullYear()} Kalypsis — Πλατφόρμα Διαχείρισης Ασφαλιστικού Γραφείου`],
      [`Δημιουργήθηκε αυτόματα από το Kalypsis · https://mykalypsis.gr · ${stamp}`],
    ];
  };

  const downloadCsv = () => {
    if (snapshotExport) return void downloadSnapshot("csv");
    if (serverEntity) return void downloadFromServer("csv");
    const ws = XLSX.utils.aoa_to_sheet(buildClientMatrix());
    XLSX.utils.sheet_add_aoa(ws, buildBrandingTrailer(), { origin: -1 });
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${exportFileName}.csv`);
  };
  const downloadXlsx = () => {
    if (snapshotExport) return void downloadSnapshot("xlsx");
    if (serverEntity) return void downloadFromServer("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(buildClientMatrix());
    XLSX.utils.sheet_add_aoa(ws, buildBrandingTrailer(), { origin: -1 });
    const wb = XLSX.utils.book_new();
    // Custom document properties surface Kalypsis in the file's Info pane
    // when opened in Excel — useful even if the trailer row is trimmed.
    wb.Props = {
      Title:    exportFileName,
      Subject:  "Kalypsis — Πλατφόρμα Διαχείρισης Ασφαλιστικού Γραφείου",
      Author:   "Kalypsis",
      Company:  "Kalypsis · https://mykalypsis.gr",
      CreatedDate: new Date(),
    };
    const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    if (range) {
      const headerRow = 4; // office, details, title, blank, then table header
      for (let r = range.s.r; r <= range.e.r; r++) {
        const first = ws[XLSX.utils.encode_cell({ r, c: 0 })] as any;
        const isTotal = r > headerRow && /σύνολο|υποσύνολο|total|subtotal/i.test(String(first?.v ?? ""));
        for (let c = range.s.c; c <= range.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          const cell = ws[ref] as any;
          if (!cell) continue;
          cell.s = r === headerRow
            ? { fill: { fgColor: { rgb: "0B2545" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, border: { right: { style: "thin", color: { rgb: "49627D" } } } }
            : isTotal
              ? { fill: { fgColor: { rgb: "E8F5E9" } }, font: { bold: true, color: { rgb: "1B5E20" } }, border: { right: { style: "thin", color: { rgb: "66BB6A" } } } }
              : { fill: { fgColor: { rgb: r % 2 === 0 ? "FFFFFF" : "F4F6FA" } }, border: { right: { style: "thin", color: { rgb: "D9E2EC" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } } } };
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
    triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${exportFileName}.xlsx`);
  };
  const downloadPdf = () => {
    if (snapshotExport) void downloadSnapshot("pdf");
    else if (serverEntity) void downloadFromServer("pdf");
  };

  // Print is always client-side — even when a serverEntity is defined we
  // don't round-trip to the backend, because the visible column selection
  // and any pending filters live only in the browser.
  const openPrint = () => {
    if (snapshotExport && !effectiveColumns.length) {
      setExportError("Επιλέξτε τουλάχιστον μία στήλη για την εκτύπωση.");
      return;
    }
    printTable({
      title: snapshotExport ? officeInfo.name || "Γραφείο" : printTitle ?? exportFileName,
      subtitle: snapshotExport ? [printTitle, printSubtitle].filter(Boolean).join(" · ") : printSubtitle,
      columns: effectiveColumns.map(c => ({
        key: String(c.key),
        label: c.label,
        map: c.map ? (r: T) => c.map!(r) : undefined,
      })),
      rows: exportRows,
      groups: groupTableExportRows(exportRows, exportGroupBy),
      office: snapshotExport ? { ...officeInfo, name: null } : officeInfo,
    });
  };

  async function downloadFromServer(format: "csv" | "xlsx" | "pdf") {
    if (!serverEntity) return;
    const params: Record<string, string> = { format };
    for (const [k, v] of Object.entries(serverParams ?? {})) {
      if (v !== null && v !== undefined && v !== "") params[k] = String(v);
    }
    // Pass the effective column whitelist so a backend that supports it can
    // trim the response. Backends that ignore the parameter still work —
    // they'll just emit every column and the on-screen ones will be a
    // superset of what the user selected.
    const effectiveKeys = effectiveColumns.map(c => String(c.key));
    if (effectiveKeys.length > 0) {
      params.columns = effectiveKeys.join(",");
    }
    const res = await api.get(`/data-exports/${serverEntity}`, { params, responseType: "blob" });
    const mime = format === "csv" ? "text/csv"
              : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf";
    triggerDownload(new Blob([res.data], { type: mime }), `${exportFileName}.${format}`);
  }

  useEffect(() => {
    if (!actionRequest || actionRequest.token <= 0) return;
    if (actionRequest.action === "csv") downloadCsv();
    else if (actionRequest.action === "xlsx") downloadXlsx();
    else if (actionRequest.action === "pdf") downloadPdf();
    else if (actionRequest.action === "print") openPrint();
    else if (actionRequest.action === "columns") setColumnPickerRequest(value => value + 1);
    // The token is the explicit event boundary; export inputs are snapshots
    // from the render in which that token was received.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRequest?.token]);

  const officeExportDetails = [officeInfo.address, officeInfo.phone, officeInfo.email,
    officeInfo.vatNumber ? `ΑΦΜ: ${officeInfo.vatNumber}` : null]
    .filter(Boolean).join(" · ");

  const hasVisibleControls = !hideSearch || !hideCount || !hidePageSize || !hideActionButtons || Boolean(rightSlot);

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={hasVisibleControls ? 2 : 0} alignItems={{ md: "center" }} sx={{ mb: hasVisibleControls ? 2 : 0, position: "relative" }}
      data-export-office-name={officeInfo.name || undefined}
      data-export-office-details={officeExportDetails || undefined}>
      {exportError && <Alert severity="error" onClose={() => setExportError(null)}>{exportError}</Alert>}
      {!hideSearch && <TextField
          size="small" fullWidth placeholder={t("table.searchPlaceholder")} value={query}
          onChange={(e) => onQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ maxWidth: 480 }}
        />}
      {!hideCount && <Typography variant="body2" color="text.secondary" sx={{ minWidth: 130 }}>
        {filteredCount === count
          ? t("table.totalCount", { n: count })
          : t("table.filteredCount", { n: filteredCount, total: count })}
      </Typography>}
      <Box sx={{ flex: 1 }} />
      {!hidePageSize && <TextField select size="small" label={t("table.pageSize")} value={pageSize}
        onChange={(e) => onPageSize(Number(e.target.value))} sx={{ width: 110 }}>
        {[10, 25, 50, 100, 250].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
      </TextField>}
      {!hideActionButtons && <Stack direction="row" spacing={1} alignItems="center">
        {!hideColumnPicker && pickerDescriptors.length > 1 && (
          <ExportColumnPicker
            columns={pickerDescriptors}
            off={selection.off}
            toggle={selection.toggle}
            setAll={selection.setAll}
            reset={selection.reset}
            openRequestToken={columnPickerRequest}
          />
        )}
        {/* Consolidated CSV / Excel / PDF selector. PDF is server-side only,
            so it appears in the menu only when a serverEntity is configured. */}
        <ExportFormatMenu
          formats={serverEntity || snapshotExport ? ["csv", "xlsx", "pdf"] : ["csv", "xlsx"]}
          onExport={(fmt: ExportFormat) => {
            if (fmt === "csv") downloadCsv();
            else if (fmt === "xlsx") downloadXlsx();
            else downloadPdf();
          }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={openPrint}
          sx={printActionSx}
        >
          {t("common.print", "Εκτύπωση")}
        </Button>
      </Stack>}
      {hideActionButtons && !hideColumnPicker && pickerDescriptors.length > 1 && (
        <Box sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }}>
          <ExportColumnPicker columns={pickerDescriptors} off={selection.off} toggle={selection.toggle}
            setAll={selection.setAll} reset={selection.reset} openRequestToken={columnPickerRequest} />
        </Box>
      )}
      {rightSlot}
    </Stack>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
