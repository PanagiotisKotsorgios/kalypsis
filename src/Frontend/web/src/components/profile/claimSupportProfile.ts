import { customerFieldError } from "../customer/customerValidation";

export type ClaimSupportKind = "garages" | "friendly-settlements" | "indemnities";
export interface ClaimSupportField { key: string; label: string; type?: "text" | "date" | "number" | "email"; readonly?: boolean; multiline?: boolean; options?: { value: string; label: string }[] }
const yesNo = [{ value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }];
export const CLAIM_SUPPORT_SECTIONS: Record<ClaimSupportKind, { label: string; fields: ClaimSupportField[] }[]> = {
  garages: [
    { label: "Γενικά", fields: [{ key: "code", label: "Κωδικός" }, { key: "name", label: "Επωνυμία" }, { key: "afm", label: "ΑΦΜ" }, { key: "specialty", label: "Ειδικότητα" }, { key: "isApproved", label: "Εγκεκριμένο", options: yesNo }, { key: "isActive", label: "Ενεργό", options: yesNo }, { key: "iban", label: "IBAN" }] },
    { label: "Επικοινωνία", fields: [{ key: "address", label: "Διεύθυνση" }, { key: "city", label: "Πόλη" }, { key: "postalCode", label: "Τ.Κ." }, { key: "phone", label: "Τηλέφωνο" }, { key: "email", label: "Email", type: "email" }] },
    { label: "Σημειώσεις", fields: [{ key: "notes", label: "Σημειώσεις", multiline: true }] },
  ],
  "friendly-settlements": [
    { label: "Γενικά", fields: [{ key: "settlementFileNumber", label: "Αριθμός φακέλου" }, { key: "claimNumber", label: "Αριθμός ζημιάς", readonly: true }, { key: "declarationDate", label: "Ημερομηνία δήλωσης", type: "date" }, { key: "settlementDate", label: "Ημερομηνία διακανονισμού", type: "date" }, { key: "settlementAuthority", label: "Φορέας διακανονισμού" }, { key: "status", label: "Κατάσταση", options: [{ value: "Open", label: "Ανοιχτή" }, { value: "InProgress", label: "Σε εξέλιξη" }, { value: "Closed", label: "Κλειστή" }, { value: "Disputed", label: "Αμφισβητούμενη" }] }] },
    { label: "Οικονομικά", fields: [{ key: "agreedAmount", label: "Συμφωνηθέν ποσό", type: "number" }, { key: "feeAmount", label: "Αμοιβές / έξοδα", type: "number" }, { key: "interestAmount", label: "Τόκοι", type: "number" }, { key: "currency", label: "Νόμισμα" }] },
    { label: "Λοιπά", fields: [{ key: "otherPartyInsurer", label: "Ασφαλιστική άλλου μέρους" }, { key: "otherPartyPolicy", label: "Συμβόλαιο άλλου μέρους" }, { key: "appraisorName", label: "Πραγματογνώμονας" }, { key: "appraisalDate", label: "Ημερομηνία πραγματογνωμοσύνης", type: "date" }, { key: "victimCount", label: "Παθόντες", readonly: true }, { key: "notes", label: "Σημειώσεις", multiline: true }] },
  ],
  indemnities: [
    { label: "Γενικά", fields: [{ key: "paymentNumber", label: "Αριθμός πληρωμής" }, { key: "claimId", label: "Αριθμός ζημιάς" }, { key: "paidOn", label: "Ημερομηνία πληρωμής", type: "date" }, { key: "amount", label: "Ποσό", type: "number" }, { key: "currency", label: "Νόμισμα" }, { key: "payeeType", label: "Τύπος δικαιούχου", options: [{ value: "Customer", label: "Πελάτης" }, { value: "Garage", label: "Συνεργείο" }, { value: "Hospital", label: "Νοσοκομείο" }, { value: "Other", label: "Άλλος" }] }, { key: "payeeName", label: "Δικαιούχος" }, { key: "garageId", label: "Συνεργείο" }, { key: "paymentMethod", label: "Τρόπος πληρωμής", options: [{ value: "Cash", label: "Μετρητά" }, { value: "BankTransfer", label: "Τραπεζική μεταφορά" }, { value: "Cheque", label: "Επιταγή" }, { value: "Card", label: "Κάρτα" }, { value: "Other", label: "Άλλος" }] }, { key: "reference", label: "Αναφορά" }, { key: "notes", label: "Σημειώσεις", multiline: true }] },
  ],
};

/** Preserve hidden historical values and associations; only existing PUT endpoints are supported. */
export function claimSupportUpdate(kind: ClaimSupportKind, current: Record<string, unknown>, changes: Record<string, string>, { allowGeneratedGarageCode = false } = {}) {
  const fields = CLAIM_SUPPORT_SECTIONS[kind].flatMap(section => section.fields).filter(field => !field.readonly);
  const next = { ...current };
  for (const [key, raw] of Object.entries(changes)) {
    const field = fields.find(field => field.key === key);
    if (!field) throw new Error("Μη υποστηριζόμενο πεδίο.");
    const value = raw.trim();
    const error = customerFieldError(key === "afm" ? "vatNumber" : key, value);
    if (error) throw new Error(error);
    if (field.type === "number") {
      const number = value ? Number(value) : null;
      if (number !== null && (!Number.isFinite(number) || number < 0)) throw new Error("Συμπληρώστε μη αρνητικό ποσό.");
      next[key] = number;
    } else if (key === "isApproved" || key === "isActive") {
      if (!["true", "false"].includes(value)) throw new Error("Επιλέξτε Ναι ή Όχι.");
      next[key] = value === "true";
    } else {
      if (field.type === "date" && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error("Συμπληρώστε έγκυρη ημερομηνία.");
      if (field.options && !field.options.some(option => option.value === value)) throw new Error("Επιλέξτε τιμή από τη λίστα.");
      next[key] = value || null;
    }
  }
  const required = kind === "garages" ? (allowGeneratedGarageCode ? ["name"] : ["code", "name"]) : kind === "indemnities" ? ["claimId", "paymentNumber", "paidOn", "amount", "currency", "payeeType", "paymentMethod"] : ["claimId", "settlementFileNumber", "declarationDate", "currency", "status"];
  for (const key of required) if (!String(next[key] ?? "").trim()) throw new Error(`Συμπληρώστε το πεδίο «${fields.find(field => field.key === key)?.label ?? key}».`);
  if (kind === "indemnities") {
    if (!(Number(next.amount) > 0)) throw new Error("Το ποσό αποζημίωσης πρέπει να είναι μεγαλύτερο από μηδέν.");
    if (next.payeeType === "Garage" && !next.garageId) throw new Error("Επιλέξτε συνεργείο.");
    if (next.payeeType !== "Garage") next.garageId = null;
    else next.payeeName = null;
    for (const [key, limit] of Object.entries({ paymentNumber: 40, payeeName: 200, reference: 80, notes: 2000 })) if (String(next[key] ?? "").length > limit) throw new Error(`Το πεδίο «${fields.find(field => field.key === key)?.label}» δέχεται έως ${limit} χαρακτήρες.`);
  }
  if (kind !== "garages" && !/^[A-Za-z]{3}$/.test(String(next.currency))) throw new Error("Συμπληρώστε νόμισμα με 3 γράμματα, π.χ. EUR.");
  const keys = fields.map(field => field.key);
  if (kind === "friendly-settlements") keys.push("claimId", "vatAmount");
  const payload = Object.fromEntries(keys.map(key => [key, next[key] ?? null]));
  if (kind !== "garages") payload.currency = String(payload.currency).toUpperCase();
  return payload;
}
