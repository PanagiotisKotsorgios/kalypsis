/** New green cards copy recorded vehicle data; existing cards keep their own snapshot. */
export function greenCardVehicleDefaults(policy: { vehicleRegistrationPlate?: string | null; specsJson?: string | null }) {
  let specs: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(policy.specsJson || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) specs = parsed as Record<string, unknown>;
  } catch { /* An old malformed technical record must not break the form. */ }
  const nested = specs.vehicle && typeof specs.vehicle === "object" && !Array.isArray(specs.vehicle) ? specs.vehicle as Record<string, unknown> : {};
  const text = (key: string) => (typeof specs[key] === "string" ? (specs[key] as string).trim() : "") || (typeof nested[key] === "string" ? (nested[key] as string).trim() : "");
  return {
    vehicleRegistrationPlate: policy.vehicleRegistrationPlate?.trim() ?? "",
    vehicleMakeModel: [text("make"), text("model")].filter(Boolean).join(" "),
    vehicleVin: text("vin"),
  };
}
