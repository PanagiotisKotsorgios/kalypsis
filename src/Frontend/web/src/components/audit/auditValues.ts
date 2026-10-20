export interface AuditFieldChange {
  field: string;
  label: string;
  before?: string | null;
  after?: string | null;
  beforeRecorded: boolean;
  afterRecorded: boolean;
}

const labels: Record<string, string> = {
  Individual: "Φυσικό πρόσωπο", Company: "Νομικό πρόσωπο", Prospect: "Πιθανός", Active: "Ενεργό",
  Inactive: "Ανενεργό", Churned: "Απώλεια", Blocked: "Αποκλεισμένο", Cancelled: "Ακυρωμένο",
  Pending: "Σε αναμονή", Draft: "Πρόχειρο", Expired: "Ληγμένο", Paid: "Εξοφλημένο", Unpaid: "Ανεξόφλητο",
  Male: "Άνδρας", Female: "Γυναίκα", Other: "Άλλο", PreferNotToSay: "Δεν επιθυμεί να δηλώσει",
  Single: "Άγαμος / άγαμη", Married: "Έγγαμος / έγγαμη", Divorced: "Διαζευγμένος / διαζευγμένη", Widowed: "Χήρος / χήρα",
  Inbound: "Εισερχόμενη", Outbound: "Εξερχόμενη", Phone: "Τηλέφωνο", Email: "Email", Sms: "SMS",
  Auto: "Αυτοκίνητο", Home: "Κατοικία", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση", Travel: "Ταξίδι",
};
const translatedFields = new Set(["Type", "Status", "Gender", "MaritalStatus", "Kind", "Direction", "Outcome", "PolicyType", "PaymentMethod"]);

export function auditValue(field: string, value: string | null | undefined, recorded: boolean): string {
  if (!recorded) return "Δεν έχει καταγραφεί";
  if (value == null || !value.trim()) return "Κενό";
  if (value === "***") return "Απόρρητη τιμή";
  if (value === "true" || value === "false") return value === "true" ? "Ναι" : "Όχι";
  if (translatedFields.has(field) && labels[value]) return labels[value];
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    const hasTime = value.includes("T");
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const date = hasTime ? new Date(value) : new Date(year, month - 1, day);
    if (!Number.isNaN(date.valueOf())) return date.toLocaleString("el-GR", hasTime
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "2-digit", day: "2-digit" });
  }
  return value;
}
