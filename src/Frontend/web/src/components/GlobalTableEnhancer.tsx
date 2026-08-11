import { useCallback, useEffect, useState } from "react";
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";

/**
 * Right-click any table header in the app → get column visibility control,
 * print, and CSV/XLSX export. This replaces the desktop app's per-page
 * header context menu — one component mounted at app root does the job
 * for every `<table>` in every page (MUI Table renders standard HTML
 * `<table><thead><tr><th>` markup).
 *
 * How it works:
 *   • A single `contextmenu` listener on `document.body` picks up right-
 *     clicks whose target is inside a `<th>` of a `<table>`. Prevents the
 *     browser's native menu, shows an MUI Menu instead.
 *   • Column visibility is applied by walking every row of the table and
 *     setting `display: none` on the cell at the picked column index.
 *     Persisted to localStorage keyed by page path + table caption / first
 *     header labels, so hiding a column outlives navigation and reload.
 *   • Export/print reads the DOM of the still-visible cells so exports
 *     stay in sync with the user's hidden-column choices.
 *
 * Deliberately DOM-level: touches no page component, requires no
 * per-page wiring, and skips DataGrid (which uses role="columnheader"
 * divs — DataGrid ships its own column-menu machinery already).
 */

interface MenuState {
  x: number; y: number;
  table: HTMLTableElement;
  columnIndex: number;
  tableKey: string;
}

function tableKey(table: HTMLTableElement): string {
  // Combine the URL path with the first-row header labels — stable across
  // renders on the same page, distinct across different tables per page.
  const heads = Array.from(table.tHead?.rows?.[0]?.cells ?? [])
    .map(c => c.textContent?.trim() ?? "")
    .join("|");
  return `${window.location.pathname}#${heads}`;
}

const HIDDEN_STORAGE = "kalypsis.tableHiddenCols.v1";

function loadHidden(key: string): Set<number> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE);
    if (!raw) return new Set();
    const map = JSON.parse(raw) as Record<string, number[]>;
    return new Set(map[key] ?? []);
  } catch { return new Set(); }
}

function saveHidden(key: string, hidden: Set<number>): void {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    if (hidden.size === 0) delete map[key]; else map[key] = Array.from(hidden).sort();
    window.localStorage.setItem(HIDDEN_STORAGE, JSON.stringify(map));
  } catch { /* quota — non-fatal */ }
}

/** Toggle a column's visibility across every row of a table. */
function applyHidden(table: HTMLTableElement, hidden: Set<number>): void {
  const rows = Array.from(table.rows);
  for (const row of rows) {
    Array.from(row.cells).forEach((cell, idx) => {
      cell.style.display = hidden.has(idx) ? "none" : "";
    });
  }
  // Persist to a data-attribute so re-renders (via useEffect below) don't
  // wipe the user's choice.
  table.dataset.kalypsisHiddenCols = Array.from(hidden).sort().join(",");
}

/** Every `<table>` we've enhanced already carries this data marker so a
 *  MutationObserver re-application is cheap. */
function enhanceAllTables(): void {
  const tables = document.querySelectorAll("table");
  tables.forEach((raw) => {
    const table = raw as HTMLTableElement;
    // Skip tables inside dialogs where the operator likely doesn't need
    // per-column export/print (they're transient — e.g. confirm popups).
    const key = tableKey(table);
    const hidden = loadHidden(key);
    if (hidden.size > 0) applyHidden(table, hidden);
    // Mark so the MutationObserver doesn't re-scan the same table needlessly.
    table.dataset.kalypsisEnhanced = "1";
  });
}

// ─── Export helpers — walk the DOM, honor hidden columns ────────────
function exportTable(table: HTMLTableElement, kind: "csv" | "xlsx" | "print"): void {
  const hidden = new Set((table.dataset.kalypsisHiddenCols || "")
    .split(",").map(s => Number(s)).filter(n => !Number.isNaN(n)));
  const rowsData: string[][] = Array.from(table.rows).map(row =>
    Array.from(row.cells)
      .filter((_c, idx) => !hidden.has(idx))
      .map(c => (c.textContent ?? "").replace(/\s+/g, " ").trim())
  ).filter(row => row.some(cell => cell.length > 0));

  if (rowsData.length === 0) return;

  const title = (document.title || "Kalypsis") + " — " + new Date().toLocaleString("el-GR");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  if (kind === "csv") {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = "﻿" + rowsData.map(r => r.map(esc).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kalypsis-table_${stamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (kind === "xlsx") {
    // Lazy-load SheetJS so this global enhancer costs zero at first paint.
    void import("xlsx").then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet(rowsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `kalypsis-table_${stamp}.xlsx`);
    });
    return;
  }

  // print
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:16px;margin:0 0 12px;font-weight:600}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#0b2545;color:#fff;font-weight:600}
      tr:nth-child(even) td{background:#fafbfc}
      @media print{ @page { size: A4 landscape; margin: 12mm } }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      ${rowsData.map((r, i) => {
        const tag = i === 0 ? "th" : "td";
        return `<tr>${r.map(c => `<${tag}>${escapeHtml(c)}</${tag}>`).join("")}</tr>`;
      }).join("")}
    </table>
    <script>window.onload=()=>setTimeout(()=>window.print(),120);</script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Mount this once (in AppLayout, inside the authenticated shell). It
 * attaches document-level event handlers, so nothing else in the app
 * needs to change to get right-click column visibility + print + export
 * on every table.
 */
export function GlobalTableEnhancer() {
  const [menu, setMenu] = useState<MenuState | null>(null);

  // Re-apply hidden columns on every DOM mutation — MUI re-renders tables
  // when data changes and would otherwise clobber the display:none we set.
  useEffect(() => {
    let raf = 0;
    const rerun = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(enhanceAllTables);
    };
    rerun();
    const obs = new MutationObserver(rerun);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const onContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const th = target.closest("th") as HTMLTableCellElement | null;
    if (!th) return;
    const table = th.closest("table") as HTMLTableElement | null;
    if (!table) return;
    // Skip dialogs — those are transient popups; a right-click there
    // usually means the user wants the browser's default menu.
    if (target.closest('[role="dialog"]')) return;
    // Compute the column index by asking the row.
    const cells = Array.from(th.parentElement?.children ?? []);
    const columnIndex = cells.indexOf(th);
    if (columnIndex < 0) return;
    e.preventDefault();
    setMenu({
      x: e.clientX, y: e.clientY,
      table, columnIndex,
      tableKey: tableKey(table),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [onContextMenu]);

  const close = () => setMenu(null);

  const hideThisColumn = () => {
    if (!menu) return;
    const hidden = loadHidden(menu.tableKey);
    hidden.add(menu.columnIndex);
    saveHidden(menu.tableKey, hidden);
    applyHidden(menu.table, hidden);
    close();
  };
  const showAllColumns = () => {
    if (!menu) return;
    saveHidden(menu.tableKey, new Set());
    applyHidden(menu.table, new Set());
    close();
  };
  const hiddenCount = menu ? loadHidden(menu.tableKey).size : 0;

  return (
    <Menu
      open={!!menu}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      slotProps={{ paper: { sx: { minWidth: 220 } } }}
    >
      <MenuItem onClick={hideThisColumn}>
        <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Απόκρυψη αυτής της στήλης</ListItemText>
      </MenuItem>
      <MenuItem onClick={showAllColumns} disabled={hiddenCount === 0}>
        <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Εμφάνιση όλων των στηλών{hiddenCount > 0 ? ` (${hiddenCount})` : ""}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { if (menu) exportTable(menu.table, "print"); close(); }}>
        <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Εκτύπωση πίνακα</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { if (menu) exportTable(menu.table, "csv"); close(); }}>
        <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Εξαγωγή CSV</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => { if (menu) exportTable(menu.table, "xlsx"); close(); }}>
        <ListItemIcon><TableChartIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Εξαγωγή XLSX (Excel)</ListItemText>
      </MenuItem>
    </Menu>
  );
}

export default GlobalTableEnhancer;
