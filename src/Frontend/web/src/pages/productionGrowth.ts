import { matchesFamilySearch, NEED_LABEL, RELATION_LABEL } from "../components/customer/customerFamilyData.ts";

export interface ProductionGrowthRow {
  id: string; needId: string | null; customerId: string; customerNumber: string; customerName: string;
  customerType: string; customerStatus: string; city: string | null; occupation: string | null;
  email: string | null; phone: string | null; needKind: string | null; needTitle: string;
  hasAsset: boolean | null; isInsured: boolean | null; priority: number; nextContactAt: string | null;
  notes: string | null; isOpportunity: boolean; coverageState: string; reason: string;
  assetKinds: string[]; activePolicyTypes: string[]; activePolicyCount: number;
  producers: { id: string; name: string }[]; family: { customerId: string; name: string; relationship: string }[];
}
export const GROWTH_STATES: Record<string, string> = {
  Uncovered: "Προτεινόμενη κάλυψη", DeclaredInsured: "Δηλωμένη ασφάλιση", ActivePolicy: "Ενεργό συμβόλαιο κλάδου",
  NoAsset: "Δεν διαθέτει την περιουσία", Unknown: "Χωρίς καταχωρημένες ανάγκες",
};
export const GROWTH_CUSTOMER_STATUSES: Record<string, string> = { Active: "Ενεργός", Prospect: "Πιθανός", Inactive: "Ανενεργός", Churned: "Αποχωρήσας", Blocked: "Σε φραγή" };
export const GROWTH_POLICY_TYPES: Record<string, string> = { Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά" };
export interface ProductionGrowthFilters {
  search: string; view: "opportunities" | "all"; kinds: string[]; coverageStates: string[];
  cities: string[]; producerIds: string[]; customerStatuses: string[]; assetKinds: string[]; activePolicyTypes: string[];
  family: string; priorityMin: string; contactState: string; contactFrom: string; contactTo: string;
  groupBy: "" | "customer" | "kind" | "city" | "producer";
}
export const defaultGrowthFilters = (): ProductionGrowthFilters => ({
  search: "", view: "opportunities", kinds: [], coverageStates: [], cities: [], producerIds: [], customerStatuses: [],
  assetKinds: [], activePolicyTypes: [], family: "", priorityMin: "", contactState: "", contactFrom: "", contactTo: "", groupBy: "",
});
export function normalizeGrowthFilters(value: Partial<ProductionGrowthFilters> | null | undefined): ProductionGrowthFilters {
  const defaults = defaultGrowthFilters();
  if (!value || typeof value !== "object") return defaults;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof ProductionGrowthFilters)[]) {
    const candidate = value[key];
    if (Array.isArray(defaults[key])) (next as unknown as Record<string, unknown>)[key] = Array.isArray(candidate) ? [...new Set(candidate.filter(item => typeof item === "string"))] : [];
    else if (typeof candidate === "string") (next as unknown as Record<string, unknown>)[key] = candidate;
  }
  if (!["opportunities", "all"].includes(next.view)) next.view = defaults.view;
  if (!["", "customer", "kind", "city", "producer"].includes(next.groupBy)) next.groupBy = "";
  return next;
}
export function growthSearchText(row: ProductionGrowthRow) {
  return [row.customerNumber, row.customerName, row.email, row.phone, row.city, row.occupation, row.needTitle,
    row.needKind ? NEED_LABEL[row.needKind] ?? row.needKind : "", row.notes, row.reason,
    ...row.producers.map(p => p.name), ...row.family.map(p => `${p.name} ${RELATION_LABEL[p.relationship] ?? p.relationship}`)].join(" ");
}
export function filterGrowthRows(rows: ProductionGrowthRow[], f: ProductionGrowthFilters, today = new Date().toLocaleDateString("sv-SE")) {
  const any = (values: string[], actual: string[]) => values.length === 0 || values.some(value => actual.includes(value));
  return rows.filter(row => (f.view !== "opportunities" || row.isOpportunity)
    && matchesFamilySearch(growthSearchText(row), f.search)
    && any(f.kinds, row.needKind ? [row.needKind] : []) && any(f.coverageStates, [row.coverageState])
    && any(f.cities, row.city ? [row.city] : []) && any(f.producerIds, row.producers.map(p => p.id))
    && any(f.customerStatuses, [row.customerStatus]) && any(f.assetKinds, row.assetKinds)
    && any(f.activePolicyTypes, row.activePolicyTypes)
    && (!f.family || (f.family === "with" ? row.family.length > 0 : row.family.length === 0))
    && (!f.priorityMin || row.priority >= Number(f.priorityMin))
    && (!f.contactFrom || !!row.nextContactAt && row.nextContactAt >= f.contactFrom)
    && (!f.contactTo || !!row.nextContactAt && row.nextContactAt <= f.contactTo)
    && (!f.contactState || (f.contactState === "unscheduled" ? !row.nextContactAt
      : f.contactState === "due" ? !!row.nextContactAt && row.nextContactAt <= today : !!row.nextContactAt && row.nextContactAt > today)));
}
export function growthGroupLabel(row: ProductionGrowthRow, group: ProductionGrowthFilters["groupBy"]) {
  switch (group) {
    case "customer": return `${row.customerNumber} · ${row.customerName}`;
    case "kind": return row.needKind ? NEED_LABEL[row.needKind] ?? row.needKind : "Χωρίς καταχωρημένες ανάγκες";
    case "city": return row.city || "Χωρίς πόλη";
    case "producer": return row.producers.map(p => p.name).sort((a, b) => a.localeCompare(b, "el")).join(", ") || "Χωρίς συνεργάτη";
    default: return "";
  }
}
