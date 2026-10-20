import { customerFieldError } from "../customer/customerValidation";

export const PRODUCER_FIELDS = [
  ["code", "Κωδικός"], ["name", "Ονοματεπώνυμο / επωνυμία"], ["status", "Κατάσταση"], ["taxId", "ΑΦΜ"], ["taxOffice", "Δ.Ο.Υ."],
  ["businessType", "Τύπος επιχείρησης"], ["professionalCategory", "Κατηγορία"], ["identityNumber", "Αρ. ταυτότητας"],
  ["tier", "Κατηγορία προμηθειών"], ["hierarchyLevel", "Επίπεδο ιεραρχίας"], ["parentProducerId", "Προϊστάμενος"],
  ["email", "Email"], ["secondaryEmail", "Δεύτερο email"], ["phone", "Τηλέφωνο"], ["secondaryPhone", "Δεύτερο τηλέφωνο"],
  ["address", "Διεύθυνση"], ["city", "Πόλη"], ["postalCode", "Τ.Κ."], ["website", "Ιστοσελίδα"],
  ["hasContract", "Σύμβαση"], ["contractNumber", "Αριθμός σύμβασης"], ["contractStartDate", "Έναρξη σύμβασης"], ["contractEndDate", "Λήξη σύμβασης"],
  ["professionalLicenseNumber", "Αρ. επαγγελματικής άδειας"], ["licenseExpiryDate", "Λήξη άδειας"],
  ["iban", "IBAN"], ["bankName", "Τράπεζα"], ["paymentMethod", "Τρόπος πληρωμής"], ["notes", "Σημειώσεις"], ["additionalInfoJson", "Πρόσθετες πληροφορίες"],
] as const;

export function producerUpdatePayload(current: Record<string, unknown>, changes: Record<string, string>) {
  const body: Record<string, unknown> = Object.fromEntries(PRODUCER_FIELDS.map(([key]) => [key, current[key] ?? null]));
  for (const [key, value] of Object.entries(changes)) {
    if (!PRODUCER_FIELDS.some(([name]) => name === key)) throw new Error("Μη υποστηριζόμενο πεδίο συνεργάτη.");
    const kind = /email/i.test(key) ? "email" : /phone/i.test(key) ? "phone" : key === "taxId" ? "vatNumber" : key;
    const error = customerFieldError(kind, value);
    if (error) throw new Error(error);
    if (key === "hasContract") {
      if (!["true", "false"].includes(value)) throw new Error("Επιλέξτε Ναι ή Όχι.");
      body[key] = value === "true";
    } else body[key] = value.trim() || null;
  }
  if (!String(body.code ?? "").trim() || !String(body.name ?? "").trim()) throw new Error("Συμπληρώστε κωδικό και όνομα συνεργάτη.");
  if (body.contractStartDate && body.contractEndDate && String(body.contractEndDate) < String(body.contractStartDate)) throw new Error("Η λήξη σύμβασης δεν μπορεί να προηγείται της έναρξης.");
  return body;
}
