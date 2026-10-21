export interface SnapshotColumn<T> {
  key: keyof T | string;
  label: string;
  map?: (row: T) => unknown;
}

/** Freeze the already filtered/sorted table, including its column order. */
export function buildTableExportSnapshot<T>(title: string, columns: SnapshotColumn<T>[], rows: T[], subtitle?: string) {
  const cellText = (value: unknown): string => {
    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleString("el-GR");
    if (typeof value === "boolean") return value ? "Ναι" : "Όχι";
    return String(value);
  };
  return {
    title,
    subtitle,
    headers: columns.map(column => column.label),
    rows: rows.map(row => columns.map(column => cellText(column.map ? column.map(row) : (row as Record<string, unknown>)[column.key as string]))),
  };
}
