export type CustomerDrafts = Partial<Record<string, string>>;
export const drivingFields = new Set(["hasDrivingLicense", "isDriver", "isNewDriver"]);
const additionalChannels = new Set(["thirdPhone", "secondaryMobilePhone", "secondaryEmail", ...drivingFields]);

/** One primary update for all normal fields, then independent additional channels.
 * Report successful writes immediately so a retry only sends remaining changes. */
export async function persistCustomerEdits<T>(
  initial: T,
  drafts: CustomerDrafts,
  writePrimary: (current: T, changes: Record<string, string>) => Promise<T>,
  writeAdditional: (field: string, value: string) => Promise<T>,
  accepted: (customer: T, savedFields: string[]) => void,
): Promise<T> {
  const entries = Object.entries(drafts).filter((entry): entry is [string, string] => entry[1] !== undefined);
  const primary = entries.filter(([key]) => !additionalChannels.has(key));
  let current = initial;
  if (primary.length) {
    current = await writePrimary(current, Object.fromEntries(primary));
    accepted(current, primary.map(([key]) => key));
  }
  for (const [key, value] of entries.filter(([field]) => additionalChannels.has(field))) {
    current = await writeAdditional(key, value);
    accepted(current, [key]);
  }
  return current;
}
