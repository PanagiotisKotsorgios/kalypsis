/**
 * Minimal client-side CSV export helper. Emits Excel-compatible UTF-8 with BOM
 * so Greek characters render correctly when the file is opened in Excel or
 * LibreOffice on Windows. Rows and columns mirror the on-screen table so the
 * exported sheet matches what the operator was looking at.
 */
import { api } from "../api/client";

export interface CsvColumn<T> {
  key: string;
  label: string;
  /** Extract the raw value for CSV. Defaults to `row[key]`. */
  map?: (row: T) => unknown;
}

interface ExportOfficeInfo {
  name?: string | null;
  code?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  vatNumber?: string | null;
}

const escapeCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote when the cell contains any of: comma, quote, newline, CR, semicolon.
  // Excel el-GR uses ; as delimiter; we still emit , but keep ; safe.
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export async function exportRowsCsv<T>(opts: {
  fileName: string;
  columns: CsvColumn<T>[];
  rows: T[];
}) {
  const office = await resolveOfficeInfo();
  const header = opts.columns.map(c => escapeCell(c.label)).join(",");
  const body = opts.rows.map(r =>
    opts.columns.map(c => {
      const raw = c.map ? c.map(r) : (r as Record<string, unknown>)[c.key];
      return escapeCell(raw);
    }).join(",")
  ).join("\r\n");

  const officeDetails = [office.addressLine, office.contactPhone, office.contactEmail,
    office.vatNumber ? `ΑΦΜ: ${office.vatNumber}` : null,
    office.code ? `Κωδικός: ${office.code}` : null]
    .filter(Boolean).join(" · ");
  // CSV has no colours/borders, so keep the same branded preamble as the
  // XLSX/PDF/print exports while preserving the exact table columns below.
  const prefix = [office.name || "Kalypsis", officeDetails, opts.fileName, ""];
  // Leading BOM so Excel autodetects UTF-8 instead of showing mojibake.
  const csv = `\ufeff${[...prefix, header, body, "", `© ${new Date().getFullYear()} Kalypsis · https://mykalypsis.gr`].join("\r\n")}\r\n`;
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

async function resolveOfficeInfo(): Promise<ExportOfficeInfo> {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const name = root?.querySelector<HTMLElement>("[data-export-office-name]")?.dataset.exportOfficeName;
  const details = root?.querySelector<HTMLElement>("[data-export-office-details]")?.dataset.exportOfficeDetails;
  if (name) return { name, addressLine: details };
  try {
    const { data } = await api.get<ExportOfficeInfo>("/agency-profile");
    return data ?? {};
  } catch {
    return {};
  }
}
