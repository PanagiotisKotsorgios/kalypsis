import { matchesFamilySearch, NEED_LABEL, RELATION_LABEL } from "../components/customer/customerFamilyData.ts";
import type { SnapshotColumn } from "../utils/tableExportSnapshot.ts";

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
  Uncovered: "Πρόταση ασφάλισης", DeclaredInsured: "Δηλωμένη ασφάλιση", ActivePolicy: "Συμβόλαιο ίδιου κλάδου · προς έλεγχο",
  NoAsset: "Δεν διαθέτει την περιουσία", Unknown: "Χωρίς καταχωρημένες ανάγκες",
};
export const GROWTH_CUSTOMER_STATUSES: Record<string, string> = { Active: "Ενεργός", Prospect: "Πιθανός", Inactive: "Ανενεργός", Churned: "Αποχωρήσας", Blocked: "Σε φραγή" };
export const GROWTH_POLICY_TYPES: Record<string, string> = { Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι", Other: "Λοιπά" };
export const GROWTH_INSURANCE_LABELS: Record<string, string> = {
  Home: "Ασφάλιση κατοικίας", Vehicle: "Ασφάλιση οχήματος", Health: "Ασφάλιση υγείας", Life: "Ασφάλιση ζωής",
  Business: "Ασφάλιση επιχείρησης", Travel: "Ταξιδιωτική ασφάλιση", Pet: "Ασφάλιση κατοικιδίου",
  Liability: "Ασφάλιση αστικής ευθύνης", Cyber: "Ασφάλιση κυβερνοκινδύνων", Other: "Άλλη ασφάλιση",
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
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
    if (Array.isArray(defaults[key])) (next as unknown as Record<string, unknown>)[key] = Array.isArray(candidate) ? [...new Set(candidate.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean))] : [];
    else if (typeof candidate === "string") (next as unknown as Record<string, unknown>)[key] = candidate;
  }
  if (!["opportunities", "all"].includes(next.view)) next.view = defaults.view;
  if (!["", "customer", "kind", "city", "producer"].includes(next.groupBy)) next.groupBy = "";
  if (!["", "with", "without"].includes(next.family)) next.family = "";
  if (!["", "due", "future", "unscheduled"].includes(next.contactState)) next.contactState = "";
  if (!["", "1", "2", "3", "4", "5"].includes(next.priorityMin)) next.priorityMin = "";
  for (const key of ["contactFrom", "contactTo"] as const) if (next[key] && !validDate(next[key])) next[key] = "";
  // Old saved filters may combine an opportunity-only view with insured states.
  if (next.coverageStates.some(state => state !== "Uncovered")) next.view = "all";
  return next;
}
export function growthSearchText(row: ProductionGrowthRow) {
  return [row.customerNumber, row.customerName, row.email, row.phone, row.city, row.occupation, row.needTitle,
    row.needKind ? `${NEED_LABEL[row.needKind] ?? row.needKind} ${GROWTH_INSURANCE_LABELS[row.needKind] ?? ""}` : "", row.notes, row.reason,
    ...row.producers.map(p => p.name), ...row.family.map(p => `${p.name} ${RELATION_LABEL[p.relationship] ?? p.relationship}`)].join(" ");
}
export function filterGrowthRows(rows: ProductionGrowthRow[], f: ProductionGrowthFilters, today = new Date().toLocaleDateString("sv-SE")) {
  if (growthFilterError(f)) return [];
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

export function growthFilterError(f: ProductionGrowthFilters) {
  if ((f.contactFrom && !validDate(f.contactFrom)) || (f.contactTo && !validDate(f.contactTo))) return "Επιλέξτε έγκυρες ημερομηνίες επικοινωνίας.";
  return f.contactFrom && f.contactTo && f.contactFrom > f.contactTo ? "Η ημερομηνία επικοινωνίας «Από» πρέπει να προηγείται της «Έως»." : "";
}

const join = (values: string[], labels: Record<string,string>) => values.map(value => labels[value] ?? value).join(", ") || "—";
export const growthExportColumns: SnapshotColumn<ProductionGrowthRow>[] = [
  { key: "customer", label: "Πελάτης", map: row => `${row.customerNumber} · ${row.customerName}` },
  { key: "assets", label: "Διαθέτει", map: row => join(row.assetKinds, NEED_LABEL) },
  { key: "need", label: "Προτεινόμενη ασφάλιση / ανάγκη", map: row => `${row.needKind ? GROWTH_INSURANCE_LABELS[row.needKind] ?? row.needKind : "Χωρίς στοιχεία"} · ${row.needTitle}` },
  { key: "state", label: "Κατάσταση ασφάλισης", map: row => GROWTH_STATES[row.coverageState] ?? row.coverageState },
  { key: "policies", label: "Ενεργοί κλάδοι", map: row => join(row.activePolicyTypes, GROWTH_POLICY_TYPES) },
  { key: "priority", label: "Προτεραιότητα", map: row => row.needId ? `${row.priority}/5` : "—" },
  { key: "next", label: "Επόμενη επικοινωνία", map: row => row.nextContactAt ? new Date(`${row.nextContactAt}T12:00:00`).toLocaleDateString("el-GR") : "—" },
  { key: "contact", label: "Επικοινωνία", map: row => [row.phone, row.email].filter(Boolean).join(" · ") },
  { key: "producer", label: "Συνεργάτης", map: row => row.producers.map(p => p.name).join(", ") || "—" },
  { key: "city", label: "Πόλη", map: row => row.city || "—" },
  { key: "family", label: "Οικογένεια", map: row => row.family.map(p => `${p.name} (${RELATION_LABEL[p.relationship] ?? p.relationship})`).join(", ") || "—" },
  { key: "notes", label: "Σημειώσεις", map: row => row.notes || "—" }, { key: "reason", label: "Αιτιολογία" },
];

export function groupGrowthRows(rows: ProductionGrowthRow[], groupBy: ProductionGrowthFilters["groupBy"]) {
  return groupBy ? [...rows].sort((a,b) => growthGroupLabel(a,groupBy).localeCompare(growthGroupLabel(b,groupBy),"el")) : rows;
}

/** The same complete filter context accompanies CSV, XLSX, PDF and print. */
export function growthFilterSummary(f: ProductionGrowthFilters, source: ProductionGrowthRow[]) {
  const producers = Object.fromEntries(source.flatMap(row=>row.producers).map(p=>[p.id,p.name]));
  const parts = [f.view === "opportunities" ? "Προτάσεις ασφάλισης" : "Όλοι οι πελάτες / καταχωρημένες ανάγκες"];
  const add = (label: string, value: string) => { if (value) parts.push(`${label}: ${value}`); };
  add("Αναζήτηση", f.search.trim());
  for (const [label,values,labels] of [
    ["Είδος ασφάλισης",f.kinds,GROWTH_INSURANCE_LABELS], ["Κατάσταση ασφάλισης",f.coverageStates,GROWTH_STATES],
    ["Διαθέτει",f.assetKinds,NEED_LABEL], ["Ενεργοί κλάδοι",f.activePolicyTypes,GROWTH_POLICY_TYPES],
    ["Συνεργάτης",f.producerIds,producers], ["Πόλη",f.cities,{}], ["Κατάσταση πελάτη",f.customerStatuses,GROWTH_CUSTOMER_STATUSES],
  ] as [string,string[],Record<string,string>][]) if (values.length) add(label,join(values,labels));
  if (f.family) add("Οικογένεια",f.family === "with" ? "Με συνδεδεμένα μέλη" : "Χωρίς συνδεδεμένα μέλη");
  add("Ελάχιστη προτεραιότητα",f.priorityMin);
  add("Επικοινωνία",({due:"Σήμερα / καθυστερημένη",future:"Μελλοντική",unscheduled:"Χωρίς προγραμματισμό"} as Record<string,string>)[f.contactState] ?? "");
  add("Επικοινωνία από",f.contactFrom); add("Επικοινωνία έως",f.contactTo);
  add("Ομαδοποίηση",({customer:"Ανά πελάτη",kind:"Ανά είδος ασφάλισης",city:"Ανά πόλη",producer:"Ανά συνεργάτη"} as Record<string,string>)[f.groupBy] ?? "");
  return parts.join(" · ");
}
export function growthGroupLabel(row: ProductionGrowthRow, group: ProductionGrowthFilters["groupBy"]) {
  switch (group) {
    case "customer": return `${row.customerNumber} · ${row.customerName}`;
    case "kind": return row.needKind ? GROWTH_INSURANCE_LABELS[row.needKind] ?? row.needKind : "Χωρίς καταχωρημένες ανάγκες";
    case "city": return row.city || "Χωρίς πόλη";
    case "producer": return row.producers.map(p => p.name).sort((a, b) => a.localeCompare(b, "el")).join(", ") || "Χωρίς συνεργάτη";
    default: return "";
  }
}
