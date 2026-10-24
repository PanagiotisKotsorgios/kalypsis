import vehicleLayout from "./vehicle-card-layout.json";
export interface VehicleCardField { key: string; label: string; path: string; kind: string; section: string; choices: { value: string; label: string }[] | null }
export const VEHICLE_CARD_FIELDS = vehicleLayout.fields as VehicleCardField[];
export const VEHICLE_CARD_TABS = vehicleLayout.tabs;
export const VEHICLE_SPEC_FIELDS: readonly (readonly [string, string])[] = VEHICLE_CARD_FIELDS.filter(f => f.key.startsWith("spec:")).map(f => [f.key.slice(5), f.label] as const);
export function vehicleFieldColumns(section: string, count: 1 | 2 | 3): readonly (readonly string[])[] {
  const fields = VEHICLE_CARD_FIELDS.filter(field => field.section === section).map(field => field.key);
  const size = Math.ceil(fields.length / count);
  return Array.from({ length: count }, (_, index) => fields.slice(index * size, (index + 1) * size));
}
export const VEHICLE_GENERAL_COLUMNS = vehicleFieldColumns("main", 3);
export function vehicleGeneralColumns(count: 1 | 2 | 3) { return vehicleFieldColumns("main", count); }
export interface VehicleOwnerDetails {
  postalCode?: string | null; region?: string | null; city?: string | null; birthDate?: string | null;
  driverLicenseIssueDate?: string | null; hasDrivingLicense?: boolean | null; driverLicenseNumber?: string | null; driverLicenseClass?: string | null;
}
export function vehicleOwnerValues(owner?: VehicleOwnerDetails | null): Record<string, string> {
  return { ownerLocation: [owner?.postalCode, owner?.region || owner?.city].filter(Boolean).join(" · "),
    ownerBirthDate: owner?.birthDate?.slice(0, 10) ?? "", ownerLicenseDate: owner?.driverLicenseIssueDate?.slice(0, 10) ?? "",
    ownerHasLicense: owner?.hasDrivingLicense == null ? "" : String(owner.hasDrivingLicense),
    ownerLicenseNumber: owner?.driverLicenseNumber ?? "", ownerLicenseClass: owner?.driverLicenseClass ?? "" };
}

/** Update only requested vehicle properties; never flatten or erase insurer JSON. */
export function mergeVehicleSpecs(raw: string | null | undefined, changes: Record<string, string>) {
  let specs: Record<string, unknown> = {};
  if (raw?.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      specs = { ...parsed };
    } catch { throw new Error("Τα αποθηκευμένα τεχνικά στοιχεία δεν είναι έγκυρα. Δεν τροποποιήθηκαν."); }
  }
  for (const [key, value] of Object.entries(changes)) {
    if (!VEHICLE_SPEC_FIELDS.some(([name]) => name === key)) throw new Error("Μη υποστηριζόμενο στοιχείο οχήματος.");
    const field = VEHICLE_CARD_FIELDS.find(field => field.key === "spec:" + key)!;
    const text = value.trim();
    if (text && ["number", "integer"].includes(field.kind)) {
      const normalized = text.replace(",", ".");
      if (!/^\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized)) || (field.kind === "integer" && !Number.isInteger(Number(normalized)))) throw new Error(field.label + ": απαιτείται μη αρνητικός αριθμός.");
      if (key === "ownerCount" && (Number(normalized) < 1 || Number(normalized) > 100)) throw new Error("Ο αριθμός ιδιοκτητών πρέπει να είναι από 1 έως 100.");
    }
    if (text && field.kind === "date") {
      const date = new Date(text + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(field.label + ": μη έγκυρη ημερομηνία.");
      if (key.includes("BirthDate") && text > new Date().toISOString().slice(0, 10)) throw new Error("Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική.");
    }
    specs[key] = text && ["number", "integer"].includes(field.kind) ? text.replace(",", ".") : text || null;
  }
  return Object.keys(specs).length ? JSON.stringify(specs) : null;
}

/** Linking a vehicle must not import another contract's beneficiaries, package or cover terms. */
export function linkedVehicleSpecs(targetRaw?: string | null, sourceRaw?: string | null) {
  const read = (raw?: string | null): Record<string, unknown> => {
    if (!raw?.trim()) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Μη έγκυρα στοιχεία οχήματος. Δεν τροποποιήθηκαν τα δεδομένα.");
    return parsed as Record<string, unknown>;
  };
  const target = read(targetRaw), source = read(sourceRaw);
  const from = source.vehicle && typeof source.vehicle === "object" && !Array.isArray(source.vehicle) ? source.vehicle as Record<string, unknown> : source;
  const into = target.vehicle && typeof target.vehicle === "object" && !Array.isArray(target.vehicle) ? target.vehicle as Record<string, unknown> : target;
  const owns = (object: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(object, key);
  for (const key of [...VEHICLE_SPEC_FIELDS.map(([key]) => key), "vehicleOwnership"]) {
    delete into[key];
    if (into !== target) delete target[key];
    if (owns(from, key) || owns(source, key)) into[key] = owns(from, key) ? from[key] : source[key];
  }
  return Object.keys(target).length ? JSON.stringify(target) : null;
}
