export type NotificationSeverity = "success" | "warning" | "error" | "info";

export const NOTIFICATION_SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  success: "#17804b",
  warning: "#b7791f",
  error: "#b42318",
  info: "#1d4e89"
};

export const NOTIFICATION_SEVERITY_TINT: Record<NotificationSeverity, string> = {
  success: "rgba(23,128,75,0.08)",
  warning: "rgba(183,121,31,0.10)",
  error: "rgba(180,35,24,0.08)",
  info: "rgba(29,78,137,0.08)"
};

const CATEGORY_LABELS: Record<string, string> = {
  "renewal-due": "Ανανέωση συμβολαίου",
  "renewal-overdue": "Εκπρόθεσμη ανανέωση",
  "renewal": "Ανανέωση συμβολαίου",
  "policy-renewal": "Ανανέωση συμβολαίου",
  "policy-expiry": "Λήξη συμβολαίου",
  "policy-expiring": "Λήξη συμβολαίου",
  "expiring-policy": "Λήξη συμβολαίου",
  "overdue": "Εκπρόθεσμο",
  "payment-due": "Πληρωμή",
  "paid": "Πληρωμή",
  "claim": "Ζημιά",
  "claims": "Ζημιές",
  "request": "Αίτημα",
  "service-request": "Αίτημα",
  "document": "Έγγραφο",
  "documents": "Έγγραφα",
  "bridge": "Γέφυρα",
  "carrier-bridge": "Γέφυρα εταιρείας",
  "commission": "Προμήθειες",
  "system": "Σύστημα",
  "workflow": "Αυτοματισμός",
  "info": "Ενημέρωση",
  "warning": "Προσοχή",
  "error": "Σφάλμα",
  "success": "Επιτυχία"
};

export function notificationCategoryLabel(category: string | null | undefined): string {
  const raw = (category ?? "").trim();
  if (!raw) return "Ενημέρωση";
  const key = raw.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function notificationSeverity(category: string | null | undefined): NotificationSeverity {
  const c = (category ?? "").toLowerCase();
  if (/(error|fail|failed|cancel|cancellation|overdue|reject|critical|crit)/.test(c)) return "error";
  if (/(warn|warning|caution|attention|pending|due|review|renewal|expir)/.test(c)) return "warning";
  if (/(success|paid|approved|done|complete|completed|resolved|ok)/.test(c)) return "success";
  return "info";
}

export function notificationSearchText(n: {
  title: string;
  body: string;
  category: string | null;
}) {
  return `${n.title} ${n.body} ${n.category ?? ""} ${notificationCategoryLabel(n.category)}`.toLowerCase();
}

export function notificationActionTarget(link: string | null | undefined): string | null {
  const raw = (link ?? "").trim();
  if (!raw) return null;

  const [pathAndQuery, hash] = raw.split("#", 2);
  const path = pathAndQuery.split("?", 1)[0];

  const policyMatch = path.match(/^\/app\/policies\/([^/?#]+)$/i) ?? path.match(/^\/policies\/([^/?#]+)$/i);
  if (policyMatch) {
    const id = encodeURIComponent(policyMatch[1]);
    return `/app/policies?documentPolicyId=${id}${hash ? `#${hash}` : ""}`;
  }

  if (raw.startsWith("/app/")) return raw;
  if (raw.startsWith("/")) return `/app${raw}`;
  return raw;
}
