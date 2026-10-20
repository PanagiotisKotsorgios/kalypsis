export const VEHICLE_SPEC_FIELDS = [
  ["make", "Μάρκα"], ["model", "Μοντέλο"], ["year", "Έτος κατασκευής"], ["vin", "VIN / αριθμός πλαισίου"],
  ["firstRegistrationDate", "Ημ. πρώτης κυκλοφορίας"], ["fuelType", "Καύσιμο"], ["bodyType", "Τύπος αμαξώματος"],
  ["engineCapacity", "Κυβισμός (cc)"], ["enginePowerKw", "Ισχύς (kW)"], ["taxableHorsepower", "Φορολογήσιμοι ίπποι"], ["estimatedValue", "Εκτιμώμενη αξία"],
  ["purchaseDate", "Ημερομηνία αγοράς"], ["condition", "Κατάσταση οχήματος"], ["ownerCount", "Αριθμός ιδιοκτητών"],
  ["color", "Χρώμα"], ["seats", "Θέσεις"], ["mileage", "Χιλιόμετρα"], ["youngDriver", "Νέος οδηγός"], ["sunroof", "Ηλιοροφή"],
  ["vehicleNotes", "Σημειώσεις οχήματος"],
] as const;

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
    specs[key] = value.trim() || null;
  }
  return Object.keys(specs).length ? JSON.stringify(specs) : null;
}
