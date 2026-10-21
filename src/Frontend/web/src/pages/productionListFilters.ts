/** Fresh default state shared by initial load and both filter-reset actions. */
export function defaultProductionListFilters(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const prefix = `${now.getFullYear()}-${month}`;
  return {
    from: `${prefix}-01`, to: `${prefix}-${day}`, dateField: "start",
    insuranceCompanyId: "", producerId: "", policyType: "", vehicleUseCategory: "",
    coverCode: "", packageCode: "", status: "", groupBy: "carrier",
  };
}
