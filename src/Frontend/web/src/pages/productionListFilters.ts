/** Fresh default state shared by initial load and both filter-reset actions. */
export function defaultProductionListFilters(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const prefix = `${now.getFullYear()}-${month}`;
  return {
    from: `${prefix}-01`, to: `${prefix}-${day}`, dateField: "start",
    insuranceCompanyIds: [] as string[], producerIds: [] as string[], policyTypes: [] as string[], vehicleUseCategories: [] as string[],
    coverCodes: [] as string[], packageCodes: [] as string[], statuses: [] as string[], groupBy: "carrier",
  };
}

export type ProductionListFilterState = ReturnType<typeof defaultProductionListFilters>;
const selectionKeys = {
  insuranceCompanyIds: "insuranceCompanyId", producerIds: "producerId", policyTypes: "policyType",
  vehicleUseCategories: "vehicleUseCategory", coverCodes: "coverCode", packageCodes: "packageCode", statuses: "status",
} as const;

/** Upgrade old single-value saved reports, without retaining criteria from the previous selection. */
export function normalizeProductionListFilters(value: unknown, now = new Date()): ProductionListFilterState {
  const result = defaultProductionListFilters(now);
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const [plural, singular] of Object.entries(selectionKeys)) {
    const raw = input[plural] ?? input[singular];
    const values = Array.isArray(raw) ? raw : [raw];
    result[plural as keyof typeof selectionKeys] = [...new Set(values.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean))];
  }
  for (const key of ["from", "to"] as const) if (typeof input[key] === "string") result[key] = input[key];
  if (["start", "issued", "recorded"].includes(String(input.dateField))) result.dateField = String(input.dateField);
  if (["", "carrier", "producer", "type", "month"].includes(String(input.groupBy))) result.groupBy = String(input.groupBy);
  return result;
}

export function productionListParams(filters: ProductionListFilterState) {
  return {
    from: filters.from || undefined, to: filters.to || undefined,
    dateField: filters.dateField !== "start" ? filters.dateField : undefined, groupBy: filters.groupBy || undefined,
    ...Object.fromEntries(Object.keys(selectionKeys).map(key => [key, filters[key as keyof typeof selectionKeys].length ? filters[key as keyof typeof selectionKeys] : undefined])),
  };
}

interface CarrierNode { id: string; parentCompanyId?: string | null }
export function productionCatalogueCarrierIds(selected: string[], carriers: CarrierNode[]) {
  return [...new Set([...selected, ...carriers.filter(carrier => carrier.parentCompanyId && selected.includes(carrier.parentCompanyId)).map(carrier => carrier.id)])];
}

/** Selecting a specific subcompany replaces its broad parent, and vice versa. */
export function productionCarrierSelection(previous: string[], next: string[], carriers: CarrierNode[]) {
  let result = [...new Set(next)];
  for (const added of next.filter(id => !previous.includes(id))) {
    const parent = carriers.find(carrier => carrier.id === added)?.parentCompanyId;
    if (parent) result = result.filter(id => id !== parent);
    else result = result.filter(id => !carriers.some(carrier => carrier.id === id && carrier.parentCompanyId === added));
  }
  return result;
}

export function productionBrokerIds(selected: string[], carriers: CarrierNode[]) {
  const parents = new Set(carriers.map(carrier => carrier.parentCompanyId).filter((id): id is string => !!id));
  return [...new Set(selected.flatMap(id => parents.has(id) ? [id] : carriers.find(carrier => carrier.id === id)?.parentCompanyId ? [carriers.find(carrier => carrier.id === id)!.parentCompanyId!] : []))];
}

export function replaceProductionSubcarriers(current: string[], children: string[], carriers: CarrierNode[]) {
  const brokers = productionBrokerIds(current, carriers);
  const independent = current.filter(id => !brokers.includes(id) && !brokers.includes(carriers.find(carrier => carrier.id === id)?.parentCompanyId ?? ""));
  return [...new Set([...independent, ...brokers.flatMap(broker => {
    const chosen = children.filter(id => carriers.some(carrier => carrier.id === id && carrier.parentCompanyId === broker));
    return chosen.length ? chosen : [broker];
  })])];
}
