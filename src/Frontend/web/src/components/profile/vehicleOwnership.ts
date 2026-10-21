export interface VehicleCoOwner { name: string; vatNumber: string; percentage: number | null }

function specsObject(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Μη έγκυρα στοιχεία οχήματος.");
  return parsed as Record<string, unknown>;
}

export function vehicleOwnerCount(value: unknown): number {
  if (value == null || value === "") return 1;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Ο αριθμός ιδιοκτητών πρέπει να είναι ακέραιος από 1 έως 100.");
  return count;
}

export function vehicleCoOwners(raw?: string | null, name = "", vatNumber = ""): VehicleCoOwner[] {
  let specs: Record<string, unknown> = {}, count = 1;
  try { specs = specsObject(raw); count = vehicleOwnerCount(specs.ownerCount); } catch { /* Legacy data remains readable. */ }
  const saved = Array.isArray(specs.vehicleOwnership) ? specs.vehicleOwnership : [];
  return Array.from({ length: count }, (_, index) => {
    const row = saved[index] as Partial<VehicleCoOwner> | undefined;
    return { name: typeof row?.name === "string" ? row.name : index === 0 ? name : "",
      vatNumber: typeof row?.vatNumber === "string" ? row.vatNumber : index === 0 ? vatNumber : "",
      percentage: typeof row?.percentage === "number" ? row.percentage : null };
  });
}

export function ownershipFieldValues(rows: readonly VehicleCoOwner[]) {
  return Object.fromEntries(rows.flatMap((row, index) => [
    [`owner:${index}:name`, row.name], [`owner:${index}:vatNumber`, row.vatNumber],
    [`owner:${index}:percentage`, row.percentage == null ? "" : String(row.percentage)],
  ]));
}

/** In creation forms, hidden draft rows must not prevent reducing the requested count. */
export function ownershipCreationChanges(changes: Record<string, string>, countValue: string) {
  const count = vehicleOwnerCount(countValue);
  if (count <= 1) return {};
  return Object.fromEntries(Object.entries(changes).filter(([key]) => Number(key.split(":")[1]) < count));
}

/** Preserve all technical/insurer data. Empty shares stay unknown, never guessed equal. */
export function mergeVehicleOwnership(raw: string | null | undefined, changes: Record<string, string>, name = "", vatNumber = "") {
  const specs = specsObject(raw);
  vehicleOwnerCount(specs.ownerCount);
  const rows = vehicleCoOwners(raw, name, vatNumber);
  if (Array.isArray(specs.vehicleOwnership) && specs.vehicleOwnership.slice(rows.length).some(row => row?.name || row?.vatNumber || row?.percentage != null))
    throw new Error("Υπάρχουν στοιχεία στους επιπλέον ιδιοκτήτες. Καθαρίστε τα πριν μειώσετε τον αριθμό ιδιοκτητών.");
  for (const [key, value] of Object.entries(changes)) {
    const match = /^owner:(\d+):(name|vatNumber|percentage)$/.exec(key);
    if (!match || !rows[Number(match[1])]) throw new Error("Μη έγκυρο πεδίο συνιδιοκτήτη.");
    const row = rows[Number(match[1])], field = match[2];
    if (field === "percentage") {
      const text = value.trim().replace(",", ".");
      if (text && !/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Το ποσοστό δέχεται έως δύο δεκαδικά ψηφία.");
      const number = text ? Number(text) : null;
      if (number != null && (number <= 0 || number > 100)) throw new Error("Το ποσοστό ιδιοκτησίας πρέπει να είναι μεγαλύτερο από 0 και έως 100%.");
      row.percentage = number;
    } else if (field === "vatNumber") {
      if (value.trim() && !/^\d{9}$/.test(value.trim())) throw new Error("Το ΑΦΜ συνιδιοκτήτη πρέπει να έχει 9 ψηφία.");
      row.vatNumber = value.trim();
    } else row.name = value.trim();
  }
  const shares = rows.filter(row => row.percentage != null);
  const total = shares.reduce((sum, row) => sum + Math.round(row.percentage! * 100), 0);
  if (total > 10000 || (shares.length === rows.length && total !== 10000))
    throw new Error("Το σύνολο των ποσοστών πρέπει να είναι 100%. Για αλλαγή πολλών ποσοστών χρησιμοποιήστε «Επεξεργασία οχήματος».");
  const vats = rows.map(row => row.vatNumber).filter(Boolean);
  if (new Set(vats).size !== vats.length) throw new Error("Το ίδιο ΑΦΜ δεν μπορεί να καταχωρηθεί σε δύο συνιδιοκτήτες.");
  return JSON.stringify({ ...specs, vehicleOwnership: rows });
}
