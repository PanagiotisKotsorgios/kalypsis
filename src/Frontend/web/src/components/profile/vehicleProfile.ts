export const VEHICLE_SPEC_FIELDS = [
  ["make", "Μάρκα"],
  ["model", "Μοντέλο"],
  ["year", "Έτος κατασκευής"],
  ["vin", "VIN / αριθμός πλαισίου"],
  ["registrationCertificateNumber", "Αριθμός άδειας κυκλοφορίας"],
  ["firstRegistrationDate", "Ημ. πρώτης κυκλοφορίας"],
  ["bodyType", "Τύπος αμαξώματος"],
  ["color", "Χρώμα"],
  ["seats", "Θέσεις"],
  ["doors", "Πόρτες"],
  ["fuelType", "Καύσιμο"],
  ["engineCapacity", "Κυβισμός (cc)"],
  ["enginePowerKw", "Ισχύς (kW)"],
  ["taxableHorsepower", "Φορολογήσιμοι ίπποι"],
  ["emissionsCo2", "Εκπομπές CO₂ (g/km)"],
  ["wheelbaseMm", "Μεταξόνιο (mm)"],
  ["wheelCount", "Αριθμός τροχών"],
  ["rearDualWheels", "Διπλοί πίσω τροχοί"],
  ["grossWeightKg", "Μικτό βάρος (kg)"],
  ["tonnage", "Τονάζ"],
  ["sunroof", "Ηλιοροφή"],
  ["alarm", "Συναγερμός"],
  ["immobilizer", "Immobilizer"],
  ["storageLocation", "Χώρος φύλαξης"],
  ["condition", "Κατάσταση οχήματος"],
  ["mileage", "Χιλιόμετρα"],
  ["estimatedValue", "Εκτιμώμενη αξία"],
  ["purchaseDate", "Ημερομηνία αγοράς"],
  ["transferDate", "Ημερομηνία μεταβίβασης"],
  ["ownerCount", "Αριθμός ιδιοκτητών"],
  ["youngDriver", "Νέος οδηγός"],
  ["specialLicense", "Ειδική άδεια / δίπλωμα"],
  ["inspectionCertificateNumber", "Αριθμός δελτίου ΚΤΕΟ"],
  ["inspectionDate", "Ημερομηνία ΚΤΕΟ"],
  ["nextInspectionDate", "Επόμενο ΚΤΕΟ"],
  ["emissionsCardNumber", "Κάρτα καυσαερίων"],
  ["emissionsCardExpiry", "Λήξη κάρτας καυσαερίων"],
  ["vehicleNotes", "Σημειώσεις οχήματος"],
] as const;

/** Vertical reading order for General only; JSON keys and creation inputs stay unchanged. */
export const VEHICLE_GENERAL_COLUMNS = [
  ["vehicleRegistrationPlate", "spec:make", "spec:model", "spec:year", "spec:vin",
    "spec:registrationCertificateNumber", "spec:firstRegistrationDate", "vehicleUseCategory", "reasonForCirculation",
    "owner", "ownerVat", "spec:ownerCount", "spec:purchaseDate", "spec:transferDate"],
  ["spec:bodyType", "spec:color", "spec:seats", "spec:doors", "spec:fuelType", "spec:engineCapacity",
    "spec:enginePowerKw", "spec:taxableHorsepower", "spec:emissionsCo2", "spec:wheelbaseMm", "spec:wheelCount",
    "spec:rearDualWheels", "spec:grossWeightKg", "spec:tonnage"],
  ["spec:condition", "spec:mileage", "spec:estimatedValue", "spec:sunroof", "spec:alarm", "spec:immobilizer",
    "spec:storageLocation", "spec:youngDriver", "spec:specialLicense", "spec:inspectionCertificateNumber",
    "spec:inspectionDate", "spec:nextInspectionDate", "spec:emissionsCardNumber", "spec:emissionsCardExpiry", "spec:vehicleNotes"],
] as const;

export function vehicleGeneralColumns(count: 1 | 2 | 3): readonly (readonly string[])[] {
  if (count === 3) return VEHICLE_GENERAL_COLUMNS;
  const fields = VEHICLE_GENERAL_COLUMNS.flat();
  const size = Math.ceil(fields.length / count);
  return Array.from({ length: count }, (_, index) => fields.slice(index * size, (index + 1) * size));
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
    specs[key] = value.trim() || null;
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
