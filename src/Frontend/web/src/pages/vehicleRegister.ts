export interface VehicleOwner { name: string; vatNumber?: string | null; percentage?: number | null; customerId?: string | null }
export interface VehicleRow {
  id: string; plate: string; primaryPolicyId: string; policyIds: string[]; owners: VehicleOwner[];
  make?: string | null; model?: string | null; year?: string | null; vin?: string | null;
  use?: string | null; fuelType?: string | null; engineCapacity?: string | null; color?: string | null;
  firstRegistrationDate?: string | null;
}
export const vehicleUseLabel = (value?: string | null) => ({ EIX: "Επιβατικό Ι.Χ.", EDX: "Επιβατικό Δ.Χ.", FIX: "Φορτηγό Ι.Χ.", FDX: "Φορτηγό Δ.Χ.", LIX: "Λεωφορείο Ι.Χ.", LDX: "Λεωφορείο Δ.Χ.", Motorcycle: "Μοτοσικλέτα", Agricultural: "Αγροτικό", Construction: "Μηχάνημα έργου" }[value ?? ""] ?? value) || "—";
export const vehicleOwnerText = (row: VehicleRow) => row.owners.map(owner => `${owner.name || "Χωρίς όνομα"}${owner.percentage != null ? ` (${owner.percentage.toLocaleString("el-GR")}%)` : ""}`).join(", ") || "—";
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
const plateKey = (value: string) => value.toUpperCase().replace(/[ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ]/g, letter => ({ Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X" }[letter]!)).replace(/[^\p{L}\p{N}]/gu, "");
export function filterVehicleRegister(rows: VehicleRow[], filters: { search: string; make: string; fuelType: string; use: string }) {
  const term = normalized(filters.search.trim());
  const plateTerm = plateKey(filters.search);
  return rows.filter(row => (!filters.make || row.make === filters.make) && (!filters.fuelType || row.fuelType === filters.fuelType)
    && (!filters.use || row.use === filters.use) && (!term || normalized([row.plate, row.make, row.model, row.year, row.vin,
      row.color, row.engineCapacity, row.fuelType, vehicleUseLabel(row.use), ...row.owners.flatMap(owner => [owner.name, owner.vatNumber])].join(" ")).includes(term)
      || !!plateTerm && plateKey(row.plate).includes(plateTerm)));
}
/** Shared by CSV / Excel / PDF / print; only vehicle fields in screen order. */
export const vehicleRegisterColumns = [
  { key: "plate", label: "Πινακίδα" },
  { key: "owners", label: "Ιδιοκτήτης / συνιδιοκτήτες", map: vehicleOwnerText },
  { key: "make", label: "Μάρκα", map: (row: VehicleRow) => row.make || "—" },
  { key: "model", label: "Μοντέλο", map: (row: VehicleRow) => row.model || "—" },
  { key: "year", label: "Έτος", map: (row: VehicleRow) => row.year || "—" },
  { key: "use", label: "Χρήση", map: (row: VehicleRow) => vehicleUseLabel(row.use) },
  { key: "fuelType", label: "Καύσιμο", map: (row: VehicleRow) => row.fuelType || "—" },
  { key: "engineCapacity", label: "Κυβισμός (cc)", map: (row: VehicleRow) => row.engineCapacity || "—" },
  { key: "vin", label: "VIN / πλαίσιο", map: (row: VehicleRow) => row.vin || "—" },
];
