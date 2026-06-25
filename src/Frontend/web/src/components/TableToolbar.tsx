import {
  Box, Button, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import GridOnIcon from "@mui/icons-material/GridOn";
import TableChartIcon from "@mui/icons-material/TableChart";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { api } from "../api/client";

/* ============================================================================
   Numbered pager — renders 1, 2, … current ±2, … last, with prev/next/jumpers.
   ========================================================================= */
export function NumberedPager({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

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

  return (
    <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
      <IconButton size="small" disabled={page === 1} onClick={() => onPage(1)} title={t("pager.first")}>
        <FirstPageIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={page === 1} onClick={() => onPage(page - 1)} title={t("pager.prev")}>
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
      <IconButton size="small" disabled={page === totalPages} onClick={() => onPage(page + 1)} title={t("pager.next")}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={page === totalPages} onClick={() => onPage(totalPages)} title={t("pager.last")}>
        <LastPageIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

/* ============================================================================
   Toolbar — search + page-size selector + CSV/Excel export buttons.
   ========================================================================= */
export function TableToolbar<T>({
  query, onQuery, count, filteredCount,
  pageSize, onPageSize,
  exportRows, exportFileName, exportColumns,
  serverEntity, serverParams,
  rightSlot
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
  /** When set, CSV/Excel/PDF buttons hit /api/paragogi-exports/{entity} with the same search & filters. */
  serverEntity?: "customers" | "policies" | "claims" | "producers";
  serverParams?: Record<string, string | number | undefined | null>;
  rightSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();

  const buildSheetRows = () => exportRows.map(r => {
    const o: Record<string, any> = {};
    for (const c of exportColumns) {
      o[c.label] = c.map ? c.map(r) : (r as any)[c.key];
    }
    return o;
  });

  const downloadCsv = () => {
    if (serverEntity) return void downloadFromServer("csv");
    const ws = XLSX.utils.json_to_sheet(buildSheetRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${exportFileName}.csv`);
  };
  const downloadXlsx = () => {
    if (serverEntity) return void downloadFromServer("xlsx");
    const ws = XLSX.utils.json_to_sheet(buildSheetRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${exportFileName}.xlsx`);
  };
  const downloadPdf = () => { if (serverEntity) void downloadFromServer("pdf"); };

  async function downloadFromServer(format: "csv" | "xlsx" | "pdf") {
    if (!serverEntity) return;
    const params: Record<string, string> = { format };
    for (const [k, v] of Object.entries(serverParams ?? {})) {
      if (v !== null && v !== undefined && v !== "") params[k] = String(v);
    }
    const res = await api.get(`/paragogi-exports/${serverEntity}`, { params, responseType: "blob" });
    const mime = format === "csv" ? "text/csv"
              : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf";
    triggerDownload(new Blob([res.data], { type: mime }), `${exportFileName}.${format}`);
  }

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
      <TextField
        size="small" fullWidth placeholder={t("table.searchPlaceholder")} value={query}
        onChange={(e) => onQuery(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ maxWidth: 480 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 130 }}>
        {filteredCount === count
          ? t("table.totalCount", { n: count })
          : t("table.filteredCount", { n: filteredCount, total: count })}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <TextField select size="small" label={t("table.pageSize")} value={pageSize}
        onChange={(e) => onPageSize(Number(e.target.value))} sx={{ width: 110 }}>
        {[10, 25, 50, 100, 250].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
      </TextField>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={downloadCsv}>CSV</Button>
        <Button size="small" variant="outlined" startIcon={<GridOnIcon />} onClick={downloadXlsx}>Excel</Button>
        {serverEntity && (
          <Button size="small" variant="outlined" color="error" startIcon={<PictureAsPdfIcon />} onClick={downloadPdf}>PDF</Button>
        )}
      </Stack>
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
