export const POLICY_CORE_KEYS = ["insuranceCompanyId", "producerId", "policyType", "startDate", "endDate", "premium", "currency", "status", "netPremium", "vatAmount", "vehicleUseCategory", "coverCode", "packageCode"] as const;
const UPDATE_KEYS = [...POLICY_CORE_KEYS, "specialCommissionPercent", "applicationNumber", "contractPartyCustomerId", "previousInsuranceCompanyId", "issuedAt", "vehicleRegistrationPlate", "paidDirectlyToCarrier"];
export function policyCorePayload(current: Record<string, unknown>, changes: Record<string, string>) {
  const body: Record<string, unknown> = Object.fromEntries(UPDATE_KEYS.map(key => [key, current[key] ?? null]));
  for (const [key, value] of Object.entries(changes)) {
    if (!POLICY_CORE_KEYS.some(field => field === key)) throw new Error("Μη υποστηριζόμενο βασικό πεδίο συμβολαίου.");
    if (["premium", "netPremium", "vatAmount"].includes(key)) {
      const number = value.trim() ? Number(value) : null;
      if (number !== null && (!Number.isFinite(number) || number < 0)) throw new Error("Συμπληρώστε μη αρνητικό ποσό.");
      body[key] = number;
    } else body[key] = value.trim() || null;
  }
  if (!body.insuranceCompanyId || !body.policyType || !body.currency || body.premium == null || !body.status) throw new Error("Συμπληρώστε τα υποχρεωτικά στοιχεία συμβολαίου.");
  for (const key of ["startDate", "endDate"]) {
    const value = String(body[key]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Συμπληρώστε έγκυρες ημερομηνίες.");
  }
  if (String(body.endDate) < String(body.startDate)) throw new Error("Η λήξη δεν μπορεί να προηγείται της έναρξης.");
  return body;
}

export function policyPreservedAmounts(current: Record<string, unknown>) {
  return Object.fromEntries(["netPremium", "vatAmount", "stampDutyAmount", "insuranceContributionAmount", "otherChargesAmount"].map(key => [key, current[key] ?? null]));
}
