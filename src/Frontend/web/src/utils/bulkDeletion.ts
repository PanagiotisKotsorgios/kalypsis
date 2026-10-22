export interface DeletionTarget { id: string; label: string; }
export interface DeletionFailure extends DeletionTarget { reason: string; }
export interface DeletionResult { deletedIds: string[]; failures: DeletionFailure[]; }

export function selectPageRecords(selected: ReadonlySet<string>, pageIds: string[], checked: boolean) {
  const next = new Set(selected);
  pageIds.forEach(id => checked ? next.add(id) : next.delete(id));
  return next;
}

/** Reuse each entity's protected endpoint; never cascade or force-delete. */
export async function deleteSelectedRecords(
  records: DeletionTarget[], remove: (id: string) => Promise<unknown>, errorMessage: (error: unknown) => string,
  onProgress: (completed: number) => void = () => {},
): Promise<DeletionResult> {
  const result: DeletionResult = { deletedIds: [], failures: [] };
  for (const record of new Map(records.map(row => [row.id, row])).values()) {
    try { await remove(record.id); result.deletedIds.push(record.id); }
    catch (error) { result.failures.push({ ...record, reason: errorMessage(error) }); }
    onProgress(result.deletedIds.length + result.failures.length);
  }
  return result;
}
