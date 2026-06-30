/**
 * Centralised display formatters. Use these everywhere instead of ad-hoc
 * `${n.toFixed(2)} €` so the entire dashboard reads with one voice.
 */

const EUR = new Intl.NumberFormat("el-GR", {
  style: "currency", currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const PCT = new Intl.NumberFormat("el-GR", {
  style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("el-GR", {
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

/** «1.234,56 €» for any number; empty string for null/undefined. */
export function money(n: number | null | undefined, currency: string = "EUR"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  if (currency === "EUR") return EUR.format(n);
  return `${NUM.format(n)} ${currency}`;
}

/** Localised percent. Pass 0.15 → «15%», 0.0825 → «8,25%». */
export function percent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return PCT.format(n);
}

/** Plain number with Greek thousands separator. */
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return NUM.format(n);
}

/** «dd/MM/yyyy» from an ISO date or Date. */
export function date(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** «dd/MM/yyyy HH:mm» for timestamps. */
export function dateTime(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("el-GR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Days from today to a date. Negative if in the past. */
export function daysUntil(input: string | Date | null | undefined): number | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
