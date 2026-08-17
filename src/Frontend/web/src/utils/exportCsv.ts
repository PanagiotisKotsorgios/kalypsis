/**
 * Minimal client-side CSV export helper. Emits Excel-compatible UTF-8 with BOM
 * so Greek characters render correctly when the file is opened in Excel or
 * LibreOffice on Windows. Rows and columns mirror the on-screen table so the
 * exported sheet matches what the operator was looking at.
 */

export interface CsvColumn<T> {
  key: string;
  label: string;
  /** Extract the raw value for CSV. Defaults to `row[key]`. */
  map?: (row: T) => unknown;
}

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote when the cell contains any of: comma, quote, newline, CR, semicolon.
  // Excel el-GR uses ; as delimiter; we still emit , but keep ; safe.
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function exportRowsCsv<T>(opts: {
  fileName: string;
  columns: CsvColumn<T>[];
  rows: T[];
}) {
  const header = opts.columns.map(c => escapeCell(c.label)).join(",");
  const body = opts.rows.map(r =>
    opts.columns.map(c => {
      const raw = c.map ? c.map(r) : (r as Record<string, unknown>)[c.key];
      return escapeCell(raw);
    }).join(",")
  ).join("\r\n");

  // Leading BOM (﻿) so Excel autodetects UTF-8 instead of showing mojibake.
  const csv = `﻿${header}\r\n${body}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const safeName = opts.fileName.replace(/[/\\?%*:|"<>]/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
