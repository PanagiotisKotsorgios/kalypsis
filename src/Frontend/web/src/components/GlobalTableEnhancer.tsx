import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

/**
 * Right-click any table header in the app → get column visibility control,
 * print, CSV/XLSX export, PLUS drag-to-reorder any column by grabbing its
 * header. One component mounted at app root does the job for every
 * `<table>` in every page (MUI Table renders standard HTML markup).
 *
 * How it works:
 *   • A single `contextmenu` listener on `document.body` picks up right-
 *     clicks whose target is inside a `<th>` of a `<table>`. Prevents the
 *     browser's native menu, shows an MUI Menu instead.
 *   • Column visibility / order are keyed on the original column index and
 *     persisted to localStorage keyed by page path + first-row header
 *     labels, so both survive navigation and reload.
 *   • Ordering is implemented by tagging each cell with `data-orig-idx`
 *     when its row is (re-)rendered, then rearranging the row's cells to
 *     match the stored order — idempotent so React re-renders don't
 *     clobber the layout.
 *   • Drag-to-reorder: `mousedown` on a `<th>` starts a drag once the
 *     pointer moves > 4 px. A blue indicator line shows the drop position;
 *     `mouseup` commits (or cancels if no target). Skips drags inside
 *     interactive controls (buttons, inputs, checkboxes) so operators
 *     can still click sort arrows or filter chips inside headers.
 *
 * Deliberately DOM-level: touches no page component, requires no
 * per-page wiring, and skips DataGrid (which uses role="columnheader"
 * divs — DataGrid ships its own column-menu machinery already).
 */

interface MenuState {
  x: number; y: number;
  table: HTMLTableElement;
  columnIndex: number;   // ORIGINAL column index
  tableKey: string;
}

function tableKey(table: HTMLTableElement): string {
  const heads = Array.from(table.tHead?.rows?.[0]?.cells ?? [])
    .map(c => (c.getAttribute("data-orig-label") || c.textContent || "").trim())
    .join("|");
  return `${window.location.pathname}#${heads}`;
}

const HIDDEN_STORAGE = "kalypsis.tableHiddenCols.v1";
const ORDER_STORAGE  = "kalypsis.tableColOrder.v1";

function loadJsonMap<T>(storage: string): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(storage);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, T>;
  } catch { return {}; }
}
function writeJsonMap<T>(storage: string, map: Record<string, T>): void {
  try { window.localStorage.setItem(storage, JSON.stringify(map)); }
  catch { /* quota — non-fatal */ }
}

function loadHidden(key: string): Set<number> {
  const map = loadJsonMap<number[]>(HIDDEN_STORAGE);
  return new Set(map[key] ?? []);
}
function saveHidden(key: string, hidden: Set<number>): void {
  const map = loadJsonMap<number[]>(HIDDEN_STORAGE);
  if (hidden.size === 0) delete map[key];
  else map[key] = Array.from(hidden).sort((a, b) => a - b);
  writeJsonMap(HIDDEN_STORAGE, map);
}

function loadOrder(key: string): number[] | null {
  const map = loadJsonMap<number[]>(ORDER_STORAGE);
  const val = map[key];
  return Array.isArray(val) && val.length ? val : null;
}
function saveOrder(key: string, order: number[] | null): void {
  const map = loadJsonMap<number[]>(ORDER_STORAGE);
  if (!order || isIdentity(order)) delete map[key];
  else map[key] = order;
  writeJsonMap(ORDER_STORAGE, map);
}
function isIdentity(o: number[]): boolean {
  for (let i = 0; i < o.length; i++) if (o[i] !== i) return false;
  return true;
}

/** Give every cell in a freshly-rendered row a stable original-column
 *  index. If cells[0] already has `data-orig-idx` we assume the whole
 *  row is tagged and skip. */
function tagRowIfFresh(row: HTMLTableRowElement): void {
  const cells = row.cells;
  if (cells.length === 0) return;
  if (cells[0].hasAttribute("data-orig-idx")) return;
  for (let i = 0; i < cells.length; i++) {
    cells[i].setAttribute("data-orig-idx", String(i));
    // Snapshot original label so tableKey survives a reorder that shuffles
    // the header text away from column 0.
    if (cells[i].tagName === "TH" && !cells[i].hasAttribute("data-orig-label")) {
      cells[i].setAttribute("data-orig-label",
        (cells[i].textContent || "").trim().slice(0, 40));
    }
  }
}

/** Reorder a row's cells so their ORIGINAL indices appear in the given
 *  order. Missing indices (e.g. row has fewer cells) are skipped. */
function reorderRow(row: HTMLTableRowElement, order: number[]): void {
  const byOrig = new Map<number, HTMLTableCellElement>();
  for (const c of Array.from(row.cells)) {
    const idx = Number(c.getAttribute("data-orig-idx"));
    if (!Number.isNaN(idx)) byOrig.set(idx, c);
  }
  const frag = document.createDocumentFragment();
  for (const origIdx of order) {
    const cell = byOrig.get(origIdx);
    if (cell) frag.appendChild(cell);
  }
  // Trailing cells whose origIdx isn't in `order` (defensive — shouldn't
  // happen if order is a full permutation).
  for (const [origIdx, cell] of byOrig) {
    if (!order.includes(origIdx)) frag.appendChild(cell);
  }
  row.appendChild(frag);
}

/** Hide/show cells across every row of a table by ORIGINAL column index. */
function applyHiddenByOrig(table: HTMLTableElement, hidden: Set<number>): void {
  const rows = Array.from(table.rows);
  for (const row of rows) {
    for (const cell of Array.from(row.cells)) {
      const origIdx = Number(cell.getAttribute("data-orig-idx"));
      if (Number.isNaN(origIdx)) continue;
      cell.style.display = hidden.has(origIdx) ? "none" : "";
    }
  }
  table.dataset.kalypsisHiddenCols = Array.from(hidden).sort((a, b) => a - b).join(",");
}

/** Full enhancement pass: tag fresh rows, reorder, then apply hidden. */
function enhanceAllTables(): void {
  const tables = document.querySelectorAll("table");
  tables.forEach((raw) => {
    const table = raw as HTMLTableElement;
    // Tag every row first — must happen before we compute the key from
    // `data-orig-label`, otherwise the very first pass gets an empty key.
    for (const row of Array.from(table.rows)) tagRowIfFresh(row);
    const key = tableKey(table);
    const order = loadOrder(key);
    if (order) {
      for (const row of Array.from(table.rows)) reorderRow(row, order);
    }
    const hidden = loadHidden(key);
    if (hidden.size > 0) applyHiddenByOrig(table, hidden);
    table.dataset.kalypsisEnhanced = "1";
  });
}

// ─── Export helpers — walk the DOM, honor hidden columns ────────────
function exportTable(table: HTMLTableElement, kind: "csv" | "xlsx" | "print"): void {
  const rowsData: string[][] = Array.from(table.rows).map(row =>
    Array.from(row.cells)
      .filter(c => c.style.display !== "none")
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
    void import("xlsx").then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet(rowsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `kalypsis-table_${stamp}.xlsx`);
    });
    return;
  }

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

// ─── Drag-to-reorder helpers ────────────────────────────────────────

/** Is the mousedown target inside something clickable / editable? If yes
 *  we skip the drag so operators can still hit sort arrows, checkboxes,
 *  filter chips, etc that live in header cells. */
function isInteractiveTarget(el: HTMLElement): boolean {
  if (el.closest("button, a, input, textarea, select, [role='button'], [role='checkbox'], [role='menuitem']")) return true;
  // MUI icon buttons wrap SVGs — the SVG's parent is a <button>, so the
  // .closest() above already catches them.
  return false;
}

/** Move element at `srcPos` in an array to `dstPos`, returning a new array. */
function moveInArray<T>(arr: T[], srcPos: number, dstPos: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(srcPos, 1);
  copy.splice(dstPos, 0, item);
  return copy;
}

// ─── Component ──────────────────────────────────────────────────────

export function GlobalTableEnhancer() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  // Ref to the drop-indicator DIV — created once, moved around during drag.
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  // Re-apply tagging/order/hidden on every DOM mutation — MUI re-renders
  // tables when data changes and would otherwise clobber our layout.
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
    if (target.closest('[role="dialog"]')) return;
    const origAttr = th.getAttribute("data-orig-idx");
    if (origAttr === null) return;
    const columnIndex = Number(origAttr);
    if (Number.isNaN(columnIndex)) return;
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

  // ─── Drag handlers (document-level) ────────────────────────────────
  useEffect(() => {
    interface DragState {
      table: HTMLTableElement;
      srcTh: HTMLTableCellElement;
      srcOrigIdx: number;
      startX: number;
      startY: number;
      dragging: boolean;
      dstPos: number | null;   // insertion position in current visual order
      currentOrder: number[];  // visual-position → original-index
    }
    let state: DragState | null = null;

    const ensureIndicator = (): HTMLDivElement => {
      if (indicatorRef.current) return indicatorRef.current;
      const d = document.createElement("div");
      d.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "width:3px",
        "height:0px",
        "background:#2563eb",
        "box-shadow:0 0 6px rgba(37,99,235,0.7)",
        "z-index:99999",
        "pointer-events:none",
        "display:none",
      ].join(";");
      document.body.appendChild(d);
      indicatorRef.current = d;
      return d;
    };

    const moveIndicator = (table: HTMLTableElement, dstPos: number, headerCells: HTMLTableCellElement[]) => {
      const bar = ensureIndicator();
      const tableRect = table.getBoundingClientRect();
      let x: number;
      if (dstPos <= 0) {
        x = headerCells[0].getBoundingClientRect().left;
      } else if (dstPos >= headerCells.length) {
        x = headerCells[headerCells.length - 1].getBoundingClientRect().right;
      } else {
        x = headerCells[dstPos].getBoundingClientRect().left;
      }
      bar.style.display = "block";
      bar.style.left = `${x - 1}px`;
      bar.style.top = `${tableRect.top}px`;
      bar.style.height = `${tableRect.height}px`;
    };
    const hideIndicator = () => {
      if (indicatorRef.current) indicatorRef.current.style.display = "none";
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const th = target.closest("th") as HTMLTableCellElement | null;
      if (!th) return;
      if (isInteractiveTarget(target)) return;
      if (target.closest('[role="dialog"]')) return;
      const table = th.closest("table") as HTMLTableElement | null;
      if (!table) return;
      const origAttr = th.getAttribute("data-orig-idx");
      if (origAttr === null) return;
      const headerRow = table.tHead?.rows?.[0];
      if (!headerRow) return;
      const currentOrder = Array.from(headerRow.cells)
        .map(c => Number(c.getAttribute("data-orig-idx") ?? "-1"))
        .filter(n => n >= 0);
      state = {
        table,
        srcTh: th,
        srcOrigIdx: Number(origAttr),
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        dstPos: null,
        currentOrder,
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state) return;
      if (!state.dragging) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        if (dx * dx + dy * dy < 16) return;   // 4px threshold
        state.dragging = true;
        state.srcTh.style.opacity = "0.4";
        document.body.style.cursor = "grabbing";
        // Prevent text selection while dragging.
        document.body.style.userSelect = "none";
      }
      // Find header cell under the cursor.
      const headerRow = state.table.tHead?.rows?.[0];
      if (!headerRow) return;
      const headerCells = Array.from(headerRow.cells);
      // Walk cells and find where cursor falls.
      let dstPos = headerCells.length;
      for (let i = 0; i < headerCells.length; i++) {
        const r = headerCells[i].getBoundingClientRect();
        const mid = r.left + r.width / 2;
        if (e.clientX < mid) { dstPos = i; break; }
      }
      state.dstPos = dstPos;
      moveIndicator(state.table, dstPos, headerCells);
    };

    const onMouseUp = () => {
      if (!state) return;
      const s = state;
      state = null;
      hideIndicator();
      s.srcTh.style.opacity = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!s.dragging || s.dstPos === null) return;
      // Compute new order — moving current visual pos of srcOrigIdx to dstPos.
      const srcPos = s.currentOrder.indexOf(s.srcOrigIdx);
      if (srcPos < 0) return;
      let dst = s.dstPos;
      // When dropping past the source position, shift left by one to
      // account for the removal at srcPos.
      if (dst > srcPos) dst -= 1;
      if (dst === srcPos) return;
      const newOrder = moveInArray(s.currentOrder, srcPos, dst);
      const key = tableKey(s.table);
      saveOrder(key, newOrder);
      // Apply immediately (don't wait for the mutation observer).
      for (const row of Array.from(s.table.rows)) reorderRow(row, newOrder);
      const hidden = loadHidden(key);
      if (hidden.size > 0) applyHiddenByOrig(s.table, hidden);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const close = () => setMenu(null);

  const hideThisColumn = () => {
    if (!menu) return;
    const hidden = loadHidden(menu.tableKey);
    hidden.add(menu.columnIndex);
    saveHidden(menu.tableKey, hidden);
    applyHiddenByOrig(menu.table, hidden);
    close();
  };
  const showAllColumns = () => {
    if (!menu) return;
    saveHidden(menu.tableKey, new Set());
    applyHiddenByOrig(menu.table, new Set());
    close();
  };
  const resetColumnOrder = () => {
    if (!menu) return;
    saveOrder(menu.tableKey, null);
    // Force React re-render on the table by removing marker so the
    // enhancer re-tags everything. Reload the page as fallback if
    // needed — but the mutation observer picks this up too.
    enhanceAllTables();
    close();
  };
  const hiddenCount = menu ? loadHidden(menu.tableKey).size : 0;
  const hasCustomOrder = menu ? loadOrder(menu.tableKey) !== null : false;

  return (
    <Menu
      open={!!menu}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      slotProps={{ paper: { sx: { minWidth: 240 } } }}
    >
      <MenuItem onClick={hideThisColumn}>
        <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Απόκρυψη αυτής της στήλης</ListItemText>
      </MenuItem>
      <MenuItem onClick={showAllColumns} disabled={hiddenCount === 0}>
        <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Εμφάνιση όλων των στηλών{hiddenCount > 0 ? ` (${hiddenCount})` : ""}</ListItemText>
      </MenuItem>
      <MenuItem onClick={resetColumnOrder} disabled={!hasCustomOrder}>
        <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Επαναφορά σειράς στηλών</ListItemText>
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
