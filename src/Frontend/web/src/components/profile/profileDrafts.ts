export function acceptProfileDrafts(previous: Record<string, string>, submitted: Record<string, string>, keys: string[]): Record<string, string> {
  const remaining = { ...previous };
  for (const key of keys) if (remaining[key] === submitted[key]) delete remaining[key];
  return remaining;
}

/** A core PUT followed by independent workspace values. Never mark a failed
 * write as accepted, and never repeat successful writes on a retry. */
export async function persistProfileWrites(
  changes: Record<string, string>,
  writeCore: (fields: Record<string, string>) => Promise<void>,
  writeCustom: (field: string, value: string) => Promise<void>,
  accept: (keys: string[]) => void,
): Promise<void> {
  const entries = Object.entries(changes);
  const primary = entries.filter(([key]) => !key.startsWith("custom:"));
  if (primary.length) { await writeCore(Object.fromEntries(primary)); accept(primary.map(([key]) => key)); }
  for (const [field, value] of entries.filter(([key]) => key.startsWith("custom:"))) {
    await writeCustom(field, value); accept([field]);
  }
}
