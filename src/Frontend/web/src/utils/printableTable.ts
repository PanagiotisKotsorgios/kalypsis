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
  /**
   * Optional grouping. When provided, the flat table is replaced by one
   * subsection per group — each with a section header (title + optional
   * summary) followed by the same column layout for the group's rows.
   * `rows` is still the full row set and drives the "Σύνολο εγγραφών"
   * meta line, so callers don't have to pre-flatten anything.
   */
  groups?: Array<{
    /** Section header shown above the group's table. */
    title: string;
    /** Optional right-aligned summary next to the group title (e.g. totals). */
    summary?: string;
    rows: T[];
  }>;
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
  // When the caller doesn't force an orientation, ask the operator —
  // most exports look better landscape once there are more than ~5
  // columns. Native confirm() is intentional: no imports, no library
  // dependency, works from the .ts utility layer.
  const orientation: "portrait" | "landscape" = opts.orientation ?? (
    typeof window !== "undefined" && window.confirm(
      "Οριζόντια εκτύπωση;\n\n· OK  → Οριζόντιος προσανατολισμός (landscape)\n· Cancel → Κάθετος προσανατολισμός (portrait)"
    ) ? "landscape" : "portrait"
  );
  const now = new Date().toLocaleString(locale);

  const head = opts.columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const renderRow = (r: T) => {
    const cells = opts.columns
      .map(c => {
        const raw = c.map ? c.map(r) : (r as Record<string, unknown>)[c.key];
        return `<td>${escapeHtml(formatCell(raw, locale))}</td>`;
      })
      .join("");
    return `<tr>${cells}</tr>`;
  };
  const renderBody = (rows: T[]) => rows.map(renderRow).join("");
  const body = renderBody(opts.rows);
  const colCount = opts.columns.length;
  // Grouped output — one UNIFIED table so column widths stay consistent
  // across every section (auto-width based on the whole dataset, not
  // per-group), the <thead> repeats on every page automatically, and
  // groups can flow across page breaks without leaving a nearly-empty
  // first page. Each group emits a full-width header row (colspan) and,
  // optionally, a subtotal row at the end.
  const groupedBody = opts.groups && opts.groups.length > 0
    ? opts.groups.map(g => {
        const headerRow = `<tr class="group-header-row"><td colspan="${colCount}">
          <span class="group-title">${escapeHtml(g.title)}</span>
          <span class="group-count"> — ${g.rows.length.toLocaleString(locale)} εγγραφές${g.summary ? ` · ${escapeHtml(g.summary)}` : ""}</span>
        </td></tr>`;
        return `${headerRow}${g.rows.map(renderRow).join("")}`;
      }).join("")
    : null;

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
  thead th { background: #f0f4fa; color: #0d47a1; text-align: left; padding: 6px 8px; border-bottom: 1.5px solid #b6c8e0; font-weight: 700; white-space: nowrap; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafbfd; }
  footer { margin-top: 18px; font-size: 10px; color: #888; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 6px; }
  footer .brand { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #0d47a1; }
  footer .brand a { color: inherit; text-decoration: none; }
  .watermark { position: fixed; bottom: 6mm; left: 0; right: 0; text-align: center; font-size: 9px; color: #bbb; }
  .empty { text-align: center; padding: 24px; color: #888; font-style: italic; }
  /* Group header rows live inside the same table as the data rows so
     the browser auto-sizes every column consistently across sections
     and repeats the <thead> on every printed page. */
  tr.group-header-row td {
    background: #eef2f7 !important;
    padding: 8px 10px !important;
    border-top: 2px solid #0d47a1;
    border-bottom: 1px solid #b6c8e0;
  }
  tr.group-header-row .group-title {
    font-size: 12.5px; font-weight: 800; color: #0d47a1; letter-spacing: 0.2px;
  }
  tr.group-header-row .group-count {
    font-size: 10.5px; color: #444; font-variant-numeric: tabular-nums;
  }
  @media print {
    header { break-after: avoid; }
    tr { break-inside: avoid; }
    /* Keep a group header attached to its first row rather than dangling
       at the bottom of a page, but allow the group ITSELF to span pages
       so an 11-row producer doesn't push everything to the next sheet. */
    tr.group-header-row { break-after: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
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
      : `<table><thead><tr>${head}</tr></thead><tbody>${groupedBody !== null ? groupedBody : body}</tbody></table>`}
  <footer>
    <span class="brand">
      Kalypsis — Πλατφόρμα Διαχείρισης Ασφαλιστικού Γραφείου
      · <a href="https://mykalypsis.gr">mykalypsis.gr</a>
    </span>
    <span>© ${new Date().getFullYear()} Kalypsis · ${escapeHtml(now)}</span>
  </footer>
  <div class="watermark">Δημιουργήθηκε από το Kalypsis · https://mykalypsis.gr</div>
</div>
</body>
</html>`;

  // Print via a hidden iframe rendered in the current window. This avoids
  // popup blockers, avoids downloading anything, and hands the browser a
  // clean document so the native print dialog opens straight away.
  //
  // Two subtleties matter here and both used to cause a double-print:
  //   1) An iframe appended with no src fires a `load` event for its
  //      initial about:blank BEFORE `document.write` writes anything —
  //      so calling print() in that first load hits an empty document,
  //      and the second write triggers a *second* load + a second print.
  //      The fix: use `srcdoc`, which navigates once, straight to our
  //      content, and fires load exactly once.
  //   2) Even with srcdoc, we guard the load handler with a `printed`
  //      flag as belt-and-braces, and verify the document has a body
  //      with children before firing the dialog.
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

  let printed = false;
  const cleanup = () => {
    // Give Chrome a moment to actually reach the "print job spooled" state
    // before we yank the frame out from under it.
    setTimeout(() => { iframe.remove(); }, 500);
  };

  iframe.addEventListener("load", () => {
    if (printed) return;
    const win = iframe.contentWindow;
    const doc = win?.document;
    // Skip any spurious empty-document load — only fire print once the
    // real body has been rendered.
    if (!win || !doc?.body || doc.body.children.length === 0) return;
    printed = true;
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

  // Set srcdoc BEFORE appending so the iframe navigates straight to our
  // content instead of loading about:blank first.
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
