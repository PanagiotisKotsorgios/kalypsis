import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://mykalypsis.gr";
const DEFAULT_TITLE = "Kalypsis — Πλατφόρμα διαχείρισης ασφαλιστικού γραφείου";
const DEFAULT_DESCRIPTION =
  "Kalypsis: πλατφόρμα για ασφαλιστικά γραφεία, διαμεσολαβητές και πελάτες στην Ελλάδα. Συμβόλαια, ανανεώσεις, ζημιές, προμήθειες και portal πελατών.";

const PUBLIC_META: Record<string, { title: string; description: string }> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  "/pricing": {
    title: "Τιμές Kalypsis — Πακέτα για ασφαλιστικά γραφεία",
    description: "Δείτε τα πακέτα και τις δυνατότητες του Kalypsis για κάθε ασφαλιστικό γραφείο.",
  },
  "/faq": {
    title: "Συχνές ερωτήσεις — Kalypsis",
    description: "Απαντήσεις για τη λειτουργία, την ασφάλεια και τα πακέτα της πλατφόρμας Kalypsis.",
  },
  "/download": {
    title: "Λήψη Kalypsis — Web και Desktop",
    description: "Χρησιμοποιήστε το Kalypsis από τον browser ή κατεβάστε την desktop έκδοση για Windows.",
  },
  "/download/releases": {
    title: "Εκδόσεις Kalypsis Desktop",
    description: "Οι διαθέσιμες εκδόσεις και οι οδηγίες εγκατάστασης του Kalypsis Desktop.",
  },
  "/contact": {
    title: "Επικοινωνία με την Kalypsis",
    description: "Επικοινωνήστε με την ομάδα Kalypsis για πληροφορίες, υποστήριξη ή συνεργασία.",
  },
  "/legal": {
    title: "Νομικά κείμενα και πολιτικές — Kalypsis",
    description: "Νομικές πληροφορίες, πολιτικές και όροι χρήσης της Kalypsis.",
  },
  "/terms": { title: "Όροι χρήσης — Kalypsis", description: "Οι όροι χρήσης της πλατφόρμας Kalypsis." },
  "/privacy": { title: "Πολιτική απορρήτου — Kalypsis", description: "Η πολιτική απορρήτου και προστασίας δεδομένων της Kalypsis." },
  "/cookies": { title: "Πολιτική cookies — Kalypsis", description: "Πληροφορίες για τα cookies και τις τεχνολογίες της Kalypsis." },
  "/dpa": { title: "DPA — Kalypsis", description: "Σύμβαση επεξεργασίας δεδομένων της πλατφόρμας Kalypsis." },
  "/subscription-agreement": { title: "Σύμβαση συνδρομής — Kalypsis", description: "Η σύμβαση συνδρομής και οι όροι παροχής της Kalypsis." },
  "/sla": { title: "SLA — Kalypsis", description: "Οι όροι επιπέδου υπηρεσιών της Kalypsis." },
  "/acceptable-use": { title: "Πολιτική θεμιτής χρήσης — Kalypsis", description: "Το πλαίσιο θεμιτής και ασφαλούς χρήσης της Kalypsis." },
  "/sub-processors": { title: "Υπεργολάβοι επεξεργασίας — Kalypsis", description: "Οι υπεργολάβοι επεξεργασίας που χρησιμοποιεί η Kalypsis." },
  "/complaints-policy": { title: "Πολιτική παραπόνων — Kalypsis", description: "Η διαδικασία υποβολής και διαχείρισης παραπόνων στην Kalypsis." },
  "/security-disclosure": { title: "Υπεύθυνη γνωστοποίηση ασφάλειας — Kalypsis", description: "Οδηγίες για υπεύθυνη αναφορά ζητημάτων ασφάλειας στην Kalypsis." },
  "/client-portal-terms": { title: "Όροι πύλης ασφαλισμένου — Kalypsis", description: "Οι όροι χρήσης της πύλης ασφαλισμένου Kalypsis." },
  "/accessibility": { title: "Προσβασιμότητα — Kalypsis", description: "Η δέσμευση της Kalypsis για προσβάσιμη ψηφιακή εμπειρία." },
  "/refund-policy": { title: "Πολιτική επιστροφών — Kalypsis", description: "Η πολιτική επιστροφών και ακυρώσεων συνδρομών της Kalypsis." },
  "/code-of-conduct": { title: "Κώδικας δεοντολογίας — Kalypsis", description: "Ο κώδικας δεοντολογίας της κοινότητας Kalypsis." },
  "/oss-licenses": { title: "Άδειες ανοικτού κώδικα — Kalypsis", description: "Οι άδειες ανοικτού κώδικα των βιβλιοθηκών της Kalypsis." },
  "/ropa": { title: "Αρχείο δραστηριοτήτων επεξεργασίας — Kalypsis", description: "Πληροφορίες για τις δραστηριότητες επεξεργασίας δεδομένων της Kalypsis." },
};

const PRIVATE_PREFIXES = [
  "/app",
  "/documentation",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/sign/",
  "/ermes-app",
];

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string | null) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function SeoController() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    const privatePath = isPrivatePath(normalizedPath);
    const meta = PUBLIC_META[normalizedPath] ?? (normalizedPath.startsWith("/download/releases/guide/")
      ? PUBLIC_META["/download/releases"]
      : null);
    const indexable = !privatePath && !!meta;
    const title = meta?.title ?? (privatePath ? "Kalypsis — Ασφαλής πρόσβαση" : DEFAULT_TITLE);
    const description = meta?.description ?? DEFAULT_DESCRIPTION;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow, noarchive");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", `${SITE_URL}${normalizedPath}`);
    upsertMeta("property", "og:locale", "el_GR");
    upsertCanonical(indexable ? `${SITE_URL}${normalizedPath}` : null);
  }, [pathname]);

  return null;
}
