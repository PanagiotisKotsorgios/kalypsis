import { buildTableExportSnapshot } from "../utils/tableExportSnapshot.ts";

export interface StatementDto {
  id: string; insuranceCompanyId: string; insuranceCompanyName: string;
  producerId: string; producerName: string; producerCode: string | null;
  year: number; month: number; grossAmount: number; netAmount: number; currency: string;
  reference: string | null; notes: string | null; paidOn: string | null;
  producerSharePercent: number; producerAmount: number; officeAmount: number;
  periodFrom: string | null; periodTo: string | null;
  basePremiumsGross: number | null; basePremiumsNet: number | null; producerDirectCommission: number | null;
  createdAt: string;
}
export type StatementGrouping = "producer" | "month" | "carrier" | "none";
export interface StatementColumn { key: string; label: string; numeric?: boolean; get: (row: StatementDto) => string }
export interface StatementSection { key: string; rows: StatementDto[] }
export interface StatementTableLine { key: string; kind: "group" | "record" | "subtotal" | "total"; cells: string[]; record?: StatementDto }
export const statementCurrency = (row: StatementDto) => row.currency?.trim().toUpperCase() || "EUR";
export const statementMoney = (value: number, currency: string) => new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(value);
export const statementPeriod = (row: StatementDto) => `${String(row.month).padStart(2, "0")}/${row.year}`;
const paymentDate = (row: StatementDto) => row.paidOn ? new Date(row.paidOn.slice(0, 10) + "T00:00:00Z").toLocaleDateString("el-GR", { timeZone: "UTC" }) : "Απλήρωτη";

// One schema drives the visible table, its column picker and every export format.
export const STATEMENT_COLUMNS: StatementColumn[] = [
  { key: "period", label: "Περίοδος", get: statementPeriod },
  { key: "carrier", label: "Ασφαλιστική", get: row => row.insuranceCompanyName },
  { key: "producer", label: "Παραγωγός", get: row => row.producerName + (row.producerCode ? ` · ${row.producerCode}` : "") },
  { key: "gross", label: "Μικτά", numeric: true, get: row => statementMoney(row.grossAmount, statementCurrency(row)) },
  { key: "net", label: "Καθαρά", numeric: true, get: row => statementMoney(row.netAmount, statementCurrency(row)) },
  { key: "sharePercent", label: "% Παρ.", numeric: true, get: row => `${(row.producerSharePercent ?? 100).toFixed(1)}%` },
  { key: "producerAmount", label: "Στον παραγωγό", numeric: true, get: row => statementMoney(row.producerAmount ?? row.grossAmount, statementCurrency(row)) },
  { key: "officeAmount", label: "Στην έδρα", numeric: true, get: row => statementMoney(row.officeAmount ?? 0, statementCurrency(row)) },
  { key: "reference", label: "Reference", get: row => row.reference ?? "—" },
  { key: "paidOn", label: "Πληρωμή", get: paymentDate },
  { key: "producerCode", label: "Κωδικός παραγωγού", get: row => row.producerCode ?? "—" },
  { key: "notes", label: "Σημείωση", get: row => row.notes ?? "—" },
  { key: "year", label: "Έτος", get: row => String(row.year) },
  { key: "month", label: "Μήνας", get: row => String(row.month) },
  { key: "currency", label: "Νόμισμα", get: statementCurrency },
];
export const DEFAULT_STATEMENT_COLUMNS = STATEMENT_COLUMNS.slice(0, 10).map(column => column.key);
export function statementDisplayedColumns(columns: StatementColumn[], visibleKeys: string[]) {
  return Array.from(new Set(visibleKeys)).flatMap(key => columns.filter(column => column.key === key));
}
export function normalizeStatementColumns(value: unknown, legacy = false): Set<string> {
  if (!Array.isArray(value)) return new Set(DEFAULT_STATEMENT_COLUMNS);
  const keys = value.filter((key): key is string => typeof key === "string");
  // Preserve legacy choices, joining the old year/month pair into the visible period.
  const normalized = legacy ? keys.filter(key => key !== "year" && key !== "month").concat(keys.some(key => key === "year" || key === "month") ? ["period"] : []) : keys;
  return new Set(normalized.filter(key => STATEMENT_COLUMNS.some(column => column.key === key)));
}

export function statementTotals(items: StatementDto[]) {
  return { count: items.length, gross: items.reduce((sum, row) => sum + row.grossAmount, 0),
    net: items.reduce((sum, row) => sum + row.netAmount, 0),
    producer: items.reduce((sum, row) => sum + (row.producerAmount ?? row.grossAmount), 0),
    office: items.reduce((sum, row) => sum + (row.officeAmount ?? 0), 0), paid: items.filter(row => !!row.paidOn).length };
}
export function statementSections(rows: StatementDto[], groupBy: StatementGrouping): StatementSection[] {
  if (groupBy === "none") return [];
  const groups = new Map<string, StatementDto[]>();
  for (const row of rows) {
    const key = groupBy === "producer" ? `${row.producerName}${row.producerCode ? ` · ${row.producerCode}` : ""}`
      : groupBy === "carrier" ? row.insuranceCompanyName : statementPeriod(row);
    const current = groups.get(key) ?? []; current.push(row); groups.set(key, current);
  }
  return Array.from(groups, ([key, items]) => ({ key, rows: items })).sort((a, b) => a.key.localeCompare(b.key, "el"));
}
export function statementOfficeTotal(rows: StatementDto[]) {
  return Array.from(new Set(rows.map(statementCurrency))).sort().map(currency =>
    statementMoney(statementTotals(rows.filter(row => statementCurrency(row) === currency)).office, currency)).join(" · ") || statementMoney(0, "EUR");
}

/** Already-filtered records only. Group ordering and totals are frozen at the click. */
export function statementTableLines(rows: StatementDto[], sections: StatementSection[], columns: StatementColumn[]): StatementTableLine[] {
  const recordLines = (items: StatementDto[]): StatementTableLine[] => items.map(record => ({ key: record.id, kind: "record", record, cells: columns.map(column => column.get(record)) }));
  const totalLines = (items: StatementDto[], label: string, kind: "subtotal" | "total"): StatementTableLine[] =>
    Array.from(new Set(items.map(statementCurrency))).sort().map(currency => {
      const summary = statementTotals(items.filter(row => statementCurrency(row) === currency));
      const amounts: Record<string, number> = { gross: summary.gross, net: summary.net, producerAmount: summary.producer, officeAmount: summary.office };
      const cells = columns.map(column => column.key in amounts ? statementMoney(amounts[column.key], currency)
        : column.key === "paidOn" ? `${summary.paid}/${summary.count}` : column.key === "currency" ? currency : "");
      // The summary name must remain visible even when the first column is numeric.
      if (cells.length) cells[0] = `${label} · ${currency}${cells[0] ? ` · ${cells[0]}` : ""}`;
      return { key: `${kind}-${label}-${currency}`, kind, cells };
    });
  const lines: StatementTableLine[] = sections.length ? sections.flatMap(section => [
    { key: `group-${section.key}`, kind: "group" as const, cells: columns.map((_column, index) => index === 0 ? `ΟΜΑΔΑ: ${section.key} · ${section.rows.length} εγγραφές` : "") },
    ...recordLines(section.rows), ...totalLines(section.rows, `Υποσύνολο · ${section.key}`, "subtotal"),
  ]) : recordLines(rows);
  return [...lines, ...totalLines(rows, "Σύνολα", "total")];
}
export function statementExportSnapshot(lines: StatementTableLine[], columns: StatementColumn[], recordCount: number, subtitle: string) {
  return { ...buildTableExportSnapshot("Υπερπρομήθειες", columns.map((column, index) => ({ key: column.key, label: column.label, map: (line: StatementTableLine) => line.cells[index] })), lines, subtitle), recordCount };
}
