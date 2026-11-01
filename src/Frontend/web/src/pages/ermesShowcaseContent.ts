export interface ErmesShowcaseContent {
  eyebrow: string;
  chip: string;
  title: string;
  subtitle: string;
  screenshot1Url: string | null;
  screenshot1Caption: string;
  screenshot2Url: string | null;
  screenshot2Caption: string;
  features: { chip: string; title: string; body: string }[];
  footerNote: string;
  ctaLabel: string;
  ctaTo: string;
  en?: Partial<
    Omit<
      ErmesShowcaseContent,
      "en" | "screenshot1Url" | "screenshot2Url" | "ctaTo"
    >
  >;
}

export const ERMES_SHOWCASE_DEFAULTS: ErmesShowcaseContent = {
  eyebrow: "ΕΡΜΗΣ · Kalypsis-native επικοινωνία",
  chip: "ΔΩΡΕΑΝ ΓΙΑ ΠΑΝΤΑ",
  title: "Ο ΕΡΜΗΣ ενώνει το γραφείο σας",
  subtitle:
    "Κρυπτογραφημένα μηνύματα, θέματα και meetings ανάμεσα σε συνεργάτες, πελάτες και ασφαλιστικές — χωρίς Viber, χωρίς Messenger, χωρίς email spam. Περιλαμβάνεται σε κάθε πλάνο Kalypsis δωρεάν για πάντα, χωρίς όριο χρηστών.",
  screenshot1Url: "/images/ermes-inbox.jpg",
  screenshot1Caption:
    "Εισερχόμενα, κανάλια και ομαδικές συνομιλίες σε ένα inbox.",
  screenshot2Url: "/images/ermes-compose.jpg",
  screenshot2Caption:
    "Έτοιμη σύνθεση μηνύματος με templates, ηχητικό, συναντήσεις και επισυνάψεις.",
  features: [
    {
      chip: "E2EE",
      title: "Κρυπτογραφημένη επικοινωνία",
      body: "Απευθείας μηνύματα, θέματα και ομαδικά κανάλια end-to-end encrypted. Ούτε η Kalypsis ούτε τρίτοι μπορούν να διαβάσουν το περιεχόμενο.",
    },
    {
      chip: "Meet",
      title: "Meetings χωρίς download",
      body: "Ξεκινήστε τηλεδιάσκεψη με έναν συνεργάτη ή ασφαλιστική εταιρεία μέσα από τη συνομιλία. Δεν χρειάζεται εγκατάσταση εφαρμογής.",
    },
    {
      chip: "Auto-contacts",
      title: "Επαφές πρακτορείου έτοιμες",
      body: "Οι συνεργάτες με λογαριασμό Kalypsis εμφανίζονται αυτόματα στις επαφές — δεν χρειάζεται να ζητήσετε emails ή τηλέφωνα.",
    },
  ],
  footerNote:
    "Δεν χρειάζεται πιστωτική κάρτα · Δωρεάν για κάθε πλάνο Kalypsis · Ελληνική φιλοξενία",
  ctaLabel: "Ξεκινήστε δωρεάν με το ΕΡΜΗΣ",
  ctaTo: "/register",
};
