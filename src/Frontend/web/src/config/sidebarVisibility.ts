/**
 * Stable sidebar identifiers stored per tenant. Paths are intentionally used
 * rather than translated labels, so language changes and label edits never
 * alter a saved office configuration.
 */
import type { PackageCode } from "../auth/PackagesContext";

export const sidebarItemKey = (path: string) => `item:${path}`;
export const sidebarGroupKey = (group: string) => `group:${group}`;
/** Stable key for a card/tile rendered inside an office-facing page. */
export const pageContainerKey = (pageId: string, containerId: string) =>
  `container:/${pageId}/${containerId}`;

export interface SidebarVisibilityItem {
  path: string;
  label: string;
  detail?: string;
  /** Empty means the item is common; otherwise at least one package must be active. */
  packages?: readonly PackageCode[];
}

export interface SidebarVisibilitySection {
  title: string;
  description: string;
  items: SidebarVisibilityItem[];
  /** Hide this whole section when its package is not enabled for the office. */
  packages?: readonly PackageCode[];
  /** The matching collapsible group in the actual sidebar, when one exists. */
  groupKey?: string;
}

export interface PageContainerVisibilityItem {
  pageId: string;
  containerId: string;
  label: string;
  detail?: string;
  packages: readonly PackageCode[];
}

export interface PageContainerVisibilitySection {
  title: string;
  description: string;
  packages: readonly PackageCode[];
  items: PageContainerVisibilityItem[];
}

/** Group headers (the boxed/collapsible sidebar containers) used by agency administrators. */
export const SIDEBAR_GROUP_CONTAINERS: SidebarVisibilityItem[] = [
  { path: "production", label: "Παραγωγή", detail: "Περιλαμβάνει πελάτες, συμβόλαια, ζημιές και συνεργάτες.", packages: ["BackOffice"] },
  { path: "financials", label: "Οικονομικά", detail: "Περιλαμβάνει τα οικονομικά και τις σχετικές αναφορές.", packages: ["BackOffice"] },
  { path: "params", label: "Παραμετροποίηση", detail: "Περιλαμβάνει εταιρείες, παραμετρικά και κανόνες.", packages: ["BackOffice"] },
  { path: "admin", label: "Διοίκηση", detail: "Περιλαμβάνει χρήστες, audit και εργαλεία διαχείρισης.", packages: ["BackOffice"] },
  { path: "crm", label: "CRM", detail: "Περιλαμβάνει τις ομαδοποιημένες λειτουργίες CRM.", packages: ["Crm"] },
  { path: "integrationsGrp", label: "Υπηρεσίες διασύνδεσης", detail: "Περιλαμβάνει τις ομαδοποιημένες διασυνδέσεις.", packages: ["Integrations"] },
  { path: "setup", label: "Ρυθμίσεις διασυνδέσεων", detail: "Περιλαμβάνει υποκαταστήματα και σχεδιασμό κλάδων.", packages: ["Integrations"] }
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
      { path: "/notifications", label: "Ειδοποιήσεις" }
    ]
  },
  {
    title: "BackOffice",
    description: "Αυτόνομες επιλογές του BackOffice, όπως εμφανίζονται εκτός κατηγορίας στο sidebar.",
    packages: ["BackOffice"],
    items: [
      { path: "/carrier-bridges-hub", label: "Γέφυρες εταιρειών" },
      { path: "/documents", label: "Έγγραφα" },
      { path: "/over-commission-bridges", label: "Γέφυρες υπερπρομηθειών" }
    ]
  },
  {
    title: "Παραγωγή",
    description: "Ίδια κατηγορία με το πλαίσιο «Παραγωγή» του sidebar.",
    packages: ["BackOffice"],
    groupKey: "production",
    items: [
      { path: "/production-lists", label: "Λίστες παραγωγής" },
      { path: "/customers", label: "Πελάτες" },
      { path: "/policies", label: "Συμβόλαια" },
      { path: "/claims", label: "Ζημιές" },
      { path: "/producers", label: "Συνεργάτες" },
      { path: "/over-commission-statements", label: "Υπερπρομήθειες" }
    ]
  },
  {
    title: "Οικονομικά",
    description: "Ίδια κατηγορία με το πλαίσιο «Οικονομικά» του sidebar.",
    packages: ["BackOffice"],
    groupKey: "financials",
    items: [
      { path: "/financials", label: "Οικονομικά" },
      { path: "/financial-report", label: "Οικονομική αναφορά" },
      { path: "/producer-statement", label: "Πινάκιο συνεργάτη" }
    ]
  },
  {
    title: "Παραμετροποίηση",
    description: "Ίδια κατηγορία με το πλαίσιο «Παραμετροποίηση» του sidebar.",
    packages: ["BackOffice"],
    groupKey: "params",
    items: [
      { path: "/insurance-companies", label: "Ασφαλιστικές εταιρείες" },
      { path: "/company-parametrics", label: "Παραμετρικά ασφαλιστικών" },
      { path: "/commission-rules", label: "Κανόνες προμηθειών" },
      { path: "/config-hub", label: "Κέντρο παραμετροποίησης" },
      { path: "/legal-templates", label: "Νομικά πρότυπα" }
    ]
  },
  {
    title: "Διοίκηση",
    description: "Ίδια κατηγορία με το πλαίσιο «Διοίκηση» του sidebar.",
    packages: ["BackOffice"],
    groupKey: "admin",
    items: [
      { path: "/users", label: "Χρήστες" },
      { path: "/audit", label: "Ιστορικό ενεργειών" },
      { path: "/recycle-bin", label: "Κάδος ανακύκλωσης" },
      { path: "/reconciliation-hub", label: "Ταυτοποιήσεις & καταμερισμοί" }
    ]
  },
  {
    title: "CRM",
    description: "Εμφανίζονται μόνο όταν το πακέτο CRM είναι ενεργό.",
    packages: ["Crm"],
    groupKey: "crm",
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
    title: "FrontOffice",
    description: "Εμφανίζονται μόνο όταν το πακέτο FrontOffice είναι ενεργό.",
    packages: ["FrontOffice"],
    items: [
      { path: "/cover-notes", label: "Σημειώματα κάλυψης" }
    ]
  },
  {
    title: "Intelligence",
    description: "Εμφανίζονται μόνο όταν το πακέτο Intelligence είναι ενεργό.",
    packages: ["Intelligence"],
    items: [
      { path: "/reports", label: "Αναφορές" },
      { path: "/named-reports", label: "Ονομαστικές αναφορές" },
      { path: "/production-stats", label: "Στατιστικά παραγωγής" }
    ]
  },
  {
    title: "Διασυνδέσεις",
    description: "Εμφανίζονται μόνο όταν το πακέτο Διασυνδέσεις είναι ενεργό.",
    packages: ["Integrations"],
    items: [
      { path: "/integration-settings", label: "Ρυθμίσεις διασυνδέσεων" },
      { path: "/mydata", label: "myDATA" }
    ]
  },
  {
    title: "Υπηρεσίες διασύνδεσης",
    description: "Ίδια κατηγορία με το πλαίσιο «Υπηρεσίες διασύνδεσης» του sidebar.",
    packages: ["Integrations"],
    groupKey: "integrationsGrp",
    items: [
      { path: "/usae", label: "ΥΣΑΕ" },
      { path: "/dias", label: "ΔΙΑΣ" },
      { path: "/bank-connections", label: "Τραπεζικές συνδέσεις" },
      { path: "/info-center", label: "Info Center" },
      { path: "/partner-portals", label: "Πύλες συνεργατών" },
      { path: "/api-keys", label: "Κλειδιά API" }
    ]
  },
  {
    title: "Ρυθμίσεις διασυνδέσεων",
    description: "Ίδια κατηγορία με το πλαίσιο ρυθμίσεων του sidebar.",
    packages: ["Integrations"],
    groupKey: "setup",
    items: [
      { path: "/branches", label: "Σχεδιασμός κλάδων" },
      { path: "/agency-offices", label: "Υποκαταστήματα" }
    ]
  },
  {
    title: "Συντομεύσεις",
    description: "Το «Όλα τα εργαλεία» εμφανίζεται σε περισσότερα από ένα workspaces αλλά ρυθμίζεται μία φορά.",
    packages: ["BackOffice", "FrontOffice", "Crm", "Intelligence", "Integrations"],
    items: [{ path: "/all-tools", label: "Όλα τα εργαλεία" }]
  }
];

/**
 * Per-page tiles that a Platform Admin can hide for a specific office. More
 * BackOffice pages can opt in simply by using the same page/container key.
 */
export const BACKOFFICE_PAGE_CONTAINER_SECTIONS: PageContainerVisibilitySection[] = [
  {
    title: "Γέφυρες Εταιρειών",
    description: "Tiles της σελίδας Γέφυρες Εταιρειών.",
    packages: ["BackOffice"],
    items: [
      { pageId: "carrier-bridges-hub", containerId: "production-bridges", label: "Παραγωγή / Γέφυρες εταιρειών", packages: ["BackOffice"] },
      { pageId: "carrier-bridges-hub", containerId: "over-commission-bridges", label: "Γέφυρες υπερπρομηθειών", packages: ["BackOffice"] },
      { pageId: "carrier-bridges-hub", containerId: "collection-file-bridges", label: "Γέφυρες οικονομικών (αρχεία είσπραξης)", packages: ["BackOffice"] },
      { pageId: "carrier-bridges-hub", containerId: "bridge-code-mappings", label: "Αντιστοιχίσεις κωδικών", packages: ["BackOffice"] }
    ]
  },
  {
    title: "Ταυτοποιήσεις & Καταμερισμοί",
    description: "Tiles της αντίστοιχης BackOffice hub σελίδας.",
    packages: ["BackOffice"],
    items: [
      { pageId: "reconciliation-hub", containerId: "financial-reconciliation", label: "Ταυτοποίηση οικονομικών", packages: ["BackOffice"] },
      { pageId: "reconciliation-hub", containerId: "producer-reconciliation", label: "Ταυτοποίηση συνεργατών", packages: ["BackOffice"] },
      { pageId: "reconciliation-hub", containerId: "commission-distribution", label: "Καταμερισμός προμηθειών", packages: ["BackOffice"] },
      { pageId: "reconciliation-hub", containerId: "customer-merge", label: "Συγχώνευση πελατών", packages: ["BackOffice"] }
    ]
  }
];
