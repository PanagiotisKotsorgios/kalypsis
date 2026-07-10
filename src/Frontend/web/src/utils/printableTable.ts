/**
 * Client-side "Print" helper. Opens a stripped-down popup with a clean
 * HTML table (no app chrome, no side-nav, no MUI styles), then calls
 * `window.print()` on load so the browser's native print dialog appears
 * against a print-optimised layout.
 *
 * The user gets whatever's on their filtered/paged screen — same rows and
 * same columns the on-screen table shows — so the printed sheet always
 * matches what they were looking at when they clicked the button.
 */

export interface PrintColumn<T> {
  key: string;
  label: string;
  map?: (row: T) => unknown;
}

export interface PrintOptions<T> {
  title: string;
  columns: PrintColumn<T>[];
  rows: T[];
  /** Optional subtitle rendered under the title, e.g. current filters. */
  subtitle?: string;
  /** Locale used for date/number formatting fall-backs. Defaults to el-GR. */
  locale?: string;
  /** Page orientation hint for @page CSS. Defaults to portrait. */
  orientation?: "portrait" | "landscape";
}

const escapeHtml = (s: unknown): string => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatCell = (value: unknown, locale: string): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString(locale);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString(locale) : "";
  }
  if (typeof value === "boolean") return value ? "✓" : "";
  return String(value);
};

export function printTable<T>(opts: PrintOptions<T>): void {
  const locale = opts.locale ?? "el-GR";
  const orientation = opts.orientation ?? "portrait";
  const now = new Date().toLocaleString(locale);

  const head = opts.columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = opts.rows
    .map(r => {
      const cells = opts.columns
        .map(c => {
          const raw = c.map ? c.map(r) : (r as Record<string, unknown>)[c.key];
          return `<td>${escapeHtml(formatCell(raw, locale))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; }
  .kalypsis-print-shell { padding: 16px 20px; }
  header { border-bottom: 2px solid #0d47a1; padding-bottom: 10px; margin-bottom: 14px; }
  header h1 { margin: 0 0 4px; font-size: 20px; color: #0d47a1; letter-spacing: 0.2px; }
  header .subtitle { color: #444; font-size: 12px; }
  header .meta { color: #888; font-size: 11px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead th { background: #f0f4fa; color: #0d47a1; text-align: left; padding: 6px 8px; border-bottom: 1.5px solid #b6c8e0; font-weight: 700; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  footer { margin-top: 18px; font-size: 10px; color: #888; display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 6px; }
  .empty { text-align: center; padding: 24px; color: #888; font-style: italic; }
  @media print {
    header { break-after: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="kalypsis-print-shell">
  <header>
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.subtitle ? `<div class="subtitle">${escapeHtml(opts.subtitle)}</div>` : ""}
    <div class="meta">Εκτυπώθηκε: ${escapeHtml(now)} — Σύνολο εγγραφών: ${opts.rows.length.toLocaleString(locale)}</div>
  </header>
  ${opts.rows.length === 0
      ? `<div class="empty">Δεν υπάρχουν εγγραφές για εκτύπωση.</div>`
      : `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`}
  <footer>
    <span>Kalypsis</span>
    <span>${escapeHtml(now)}</span>
  </footer>
</div>
</body>
</html>`;

  // Print via a hidden iframe rendered in the current window. This avoids
  // popup blockers, avoids downloading anything, and hands the browser a
  // clean document so the native print dialog opens straight away. When
  // the print dialog closes we clean the iframe up.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "kalypsis-print");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  const cleanup = () => {
    // Give Chrome a moment to actually reach the "print job spooled" state
    // before we yank the frame out from under it.
    setTimeout(() => { iframe.remove(); }, 500);
  };

  iframe.addEventListener("load", () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    try {
      // afterprint fires whether the user prints or cancels.
      win.addEventListener("afterprint", cleanup, { once: true });
      // Focus is required in Safari and some Firefox builds for the print
      // dialog to appear against the iframe's document.
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  });

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}
