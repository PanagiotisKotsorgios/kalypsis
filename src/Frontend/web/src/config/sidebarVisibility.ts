/**
 * Stable sidebar identifiers stored per tenant. Paths are intentionally used
 * rather than translated labels, so language changes and label edits never
 * alter a saved office configuration.
 */
export const sidebarItemKey = (path: string) => `item:${path}`;
export const sidebarGroupKey = (group: string) => `group:${group}`;

export interface SidebarVisibilityItem {
  path: string;
  label: string;
  detail?: string;
}

export interface SidebarVisibilitySection {
  title: string;
  description: string;
  items: SidebarVisibilityItem[];
}

/** Group headers (the boxed/collapsible sidebar containers) used by agency administrators. */
export const SIDEBAR_GROUP_CONTAINERS: SidebarVisibilityItem[] = [
  { path: "production", label: "Παραγωγή", detail: "Περιλαμβάνει πελάτες, συμβόλαια, ζημιές και συνεργάτες." },
  { path: "financials", label: "Οικονομικά", detail: "Περιλαμβάνει τα οικονομικά και τις σχετικές αναφορές." },
  { path: "params", label: "Παραμετροποίηση", detail: "Περιλαμβάνει εταιρείες, παραμετρικά και κανόνες." },
  { path: "admin", label: "Διοίκηση", detail: "Περιλαμβάνει χρήστες, audit και εργαλεία διαχείρισης." },
  { path: "crm", label: "CRM", detail: "Περιλαμβάνει τις ομαδοποιημένες λειτουργίες CRM." },
  { path: "integrationsGrp", label: "Υπηρεσίες διασύνδεσης", detail: "Περιλαμβάνει τις ομαδοποιημένες διασυνδέσεις." },
  { path: "setup", label: "Ρυθμίσεις διασυνδέσεων", detail: "Περιλαμβάνει υποκαταστήματα και σχεδιασμό κλάδων." }
];

/** Every route currently rendered by an office-facing sidebar, across its roles. */
export const SIDEBAR_VISIBILITY_SECTIONS: SidebarVisibilitySection[] = [
  {
    title: "Κοινές λειτουργίες",
    description: "Εμφανίζονται ανάλογα με τον ρόλο και τα ενεργά πακέτα του γραφείου.",
    items: [
      { path: "/", label: "Πίνακας ελέγχου" },
      { path: "/ermes-app", label: "ΕΡΜΗΣ" },
      { path: "/documentation", label: "Οδηγίες χρήσης" },
      { path: "/bookkeeping", label: "Μηχανογράφιση" },
      { path: "/agency-and-profile", label: "Ρυθμίσεις γραφείου & προφίλ" },
      { path: "/profile", label: "Προφίλ" },
      { path: "/notifications", label: "Ειδοποιήσεις" },
      { path: "/my-expected-rates", label: "Οι αναμενόμενες προμήθειές μου" },
      { path: "/my-reconciliation", label: "Σύγκριση προμηθειών μου" }
    ]
  },
  {
    title: "BackOffice",
    description: "Εμφανίζονται μόνο όταν το πακέτο BackOffice είναι ενεργό.",
    items: [
      { path: "/carrier-bridges-hub", label: "Γέφυρες εταιρειών" },
      { path: "/production-lists", label: "Λίστες παραγωγής" },
      { path: "/customers", label: "Πελάτες" },
      { path: "/policies", label: "Συμβόλαια" },
      { path: "/claims", label: "Ζημιές" },
      { path: "/producers", label: "Συνεργάτες" },
      { path: "/financials", label: "Οικονομικά" },
      { path: "/financial-report", label: "Οικονομική αναφορά" },
      { path: "/producer-statement", label: "Πινάκιο συνεργάτη" },
      { path: "/over-commission-statements", label: "Υπερπρομήθειες" },
      { path: "/insurance-companies", label: "Ασφαλιστικές εταιρείες" },
      { path: "/company-parametrics", label: "Παραμετρικά ασφαλιστικών" },
      { path: "/commission-rules", label: "Κανόνες προμηθειών" },
      { path: "/config-hub", label: "Κέντρο παραμετροποίησης" },
      { path: "/legal-templates", label: "Νομικά πρότυπα" },
      { path: "/users", label: "Χρήστες" },
      { path: "/audit", label: "Ιστορικό ενεργειών" },
      { path: "/recycle-bin", label: "Κάδος ανακύκλωσης" },
      { path: "/reconciliation-hub", label: "Ταυτοποιήσεις & καταμερισμοί" },
      { path: "/documents", label: "Έγγραφα" },
      { path: "/over-commission-bridges", label: "Γέφυρες υπερπρομηθειών" }
    ]
  },
  {
    title: "CRM",
    description: "Εμφανίζονται μόνο όταν το πακέτο CRM είναι ενεργό.",
    items: [
      { path: "/tasks", label: "Εργασίες" },
      { path: "/requests", label: "Αιτήματα" },
      { path: "/appointments", label: "Ραντεβού" },
      { path: "/marketing", label: "Marketing" },
      { path: "/name-days", label: "Ονομαστικές εορτές" },
      { path: "/document-manager", label: "Διαχείριση εγγράφων" },
      { path: "/delivery-tracking", label: "Παρακολούθηση αποστολών" }
    ]
  },
  {
    title: "FrontOffice & Intelligence",
    description: "Εμφανίζονται μόνο όταν τα αντίστοιχα πακέτα είναι ενεργά.",
    items: [
      { path: "/cover-notes", label: "Σημειώματα κάλυψης" },
      { path: "/reports", label: "Αναφορές" },
      { path: "/named-reports", label: "Ονομαστικές αναφορές" },
      { path: "/production-stats", label: "Στατιστικά παραγωγής" }
    ]
  },
  {
    title: "Διασυνδέσεις",
    description: "Εμφανίζονται μόνο όταν το πακέτο Διασυνδέσεις είναι ενεργό.",
    items: [
      { path: "/integration-settings", label: "Ρυθμίσεις διασυνδέσεων" },
      { path: "/mydata", label: "myDATA" },
      { path: "/usae", label: "ΥΣΑΕ" },
      { path: "/dias", label: "ΔΙΑΣ" },
      { path: "/bank-connections", label: "Τραπεζικές συνδέσεις" },
      { path: "/info-center", label: "Info Center" },
      { path: "/partner-portals", label: "Πύλες συνεργατών" },
      { path: "/api-keys", label: "Κλειδιά API" },
      { path: "/branches", label: "Σχεδιασμός κλάδων" },
      { path: "/agency-offices", label: "Υποκαταστήματα" }
    ]
  },
  {
    title: "Συντομεύσεις",
    description: "Το «Όλα τα εργαλεία» εμφανίζεται σε περισσότερα από ένα workspaces αλλά ρυθμίζεται μία φορά.",
    items: [{ path: "/all-tools", label: "Όλα τα εργαλεία" }]
  }
];
