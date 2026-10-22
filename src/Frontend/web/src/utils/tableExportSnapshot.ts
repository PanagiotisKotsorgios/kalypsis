export interface SnapshotColumn<T> {
  key: keyof T | string;
  label: string;
  map?: (row: T) => unknown;
}

/** Preserve contiguous group sections and the table's ordering, without losing records. */
export function groupTableExportRows<T>(rows: T[], groupBy?: (row: T) => string) {
  if (!groupBy) return undefined;
  const groups: { title: string; rows: T[] }[] = [];
  for (const row of rows) {
    const title = groupBy(row);
    let group = groups[groups.length - 1];
    if (!group || group.title !== title) {
      group = { title, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** Freeze the already filtered/sorted table, including its column order. */
export function buildTableExportSnapshot<T>(title: string, columns: SnapshotColumn<T>[], rows: T[], subtitle?: string, groupBy?: (row: T) => string) {
  const cellText = (value: unknown): string => {
    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleString("el-GR");
    if (typeof value === "boolean") return value ? "Ναι" : "Όχι";
    return String(value);
  };
  const mapRow = (row: T) => columns.map(column => cellText(column.map ? column.map(row) : (row as Record<string, unknown>)[column.key as string]));
  const groups = groupTableExportRows(rows, groupBy);
  return {
    title,
    subtitle,
    headers: columns.map(column => column.label),
    rows: groups ? groups.flatMap(group => [
      columns.map((_column, index) => index === 0 ? `ΟΜΑΔΑ: ${group.title} · ${group.rows.length} εγγραφές` : ""),
      ...group.rows.map(mapRow),
    ]) : rows.map(mapRow),
    ...(groups ? { recordCount: rows.length } : {}),
  };
}
