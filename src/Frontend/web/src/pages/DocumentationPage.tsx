import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Card, Chip, Container, Drawer, IconButton, InputAdornment,
  Link as MuiLink, List, ListItem, ListItemButton, ListItemText, Stack,
  TextField, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
import PrintIcon from "@mui/icons-material/Print";
import MenuIcon from "@mui/icons-material/Menu";
import LoginIcon from "@mui/icons-material/Login";
import DownloadIcon from "@mui/icons-material/Download";
import { Link as RouterLink, useLocation } from "react-router-dom";

// ──────────────────────────────────────────────────────────────────────────
// User documentation for Kalypsis — professional, keyword-rich Greek copy
// covering every module the office touches. Used both publicly (indexed by
// Google) at /documentation, and inside the app at /app/documentation. The
// same component renders both surfaces — the outer <App> route decides the
// chrome (public shell vs AppLayout).
//
// Content is authored as a section tree so search/TOC/print are all driven
// off one source of truth. Each section is a heading + prose + optional
// step lists + optional «screenshot placeholder» boxes the office team can
// replace with real images (see the [Στιγμιότυπο: …] blocks in-page).
// ──────────────────────────────────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  keywords: string[]; // helps in-page search + SEO
  body: DocBlock[];
  children?: DocSection[];
}

type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "note"; text: string }
  | { kind: "tip"; text: string }
  | { kind: "shot"; caption: string }
  | { kind: "kv"; rows: { k: string; v: string }[] };

const SECTIONS: DocSection[] = [
  {
    id: "welcome",
    title: "Καλωσορίσατε στο Kalypsis",
    keywords: [
      "kalypsis", "ασφαλιστικό γραφείο", "λογισμικό ασφαλιστών", "cloud",
      "πλατφόρμα ασφαλιστικού γραφείου", "πωλήσεις ασφαλιστικών",
    ],
    body: [
      { kind: "p", text: "Το Kalypsis είναι η ολοκληρωμένη cloud πλατφόρμα για το ελληνικό ασφαλιστικό γραφείο. Διαχειρίζεστε πελάτες, συμβόλαια, γέφυρες εταιρειών, πληρωμές, εκκαθαρίσεις προμηθειών, ημερολόγιο ραντεβού, εντυπα, ζημιές και πινάκια υπερπρομηθειών — όλα σε ένα σημείο, από οποιαδήποτε συσκευή." },
      { kind: "p", text: "Ο οδηγός αυτός καλύπτει βήμα-προς-βήμα κάθε ενέργεια που θα χρειαστείτε στην καθημερινότητά σας. Χρησιμοποιήστε το πλαϊνό μενού για να μεταβείτε απευθείας σε μία ενότητα, ή το πεδίο αναζήτησης για να βρείτε γρήγορα ένα θέμα." },
      { kind: "tip", text: "Μπορείτε να εκτυπώσετε ή να αποθηκεύσετε ολόκληρο τον οδηγό ως PDF από το κουμπί «Εκτύπωση / PDF» πάνω δεξιά." },
    ],
  },
  {
    id: "getting-started",
    title: "Έναρξη — Πρώτη σύνδεση",
    keywords: ["login", "σύνδεση", "πρώτη σύνδεση", "dashboard", "πίνακας ελέγχου"],
    body: [
      { kind: "p", text: "Μπείτε στη διεύθυνση mykalypsis.gr και πατήστε «Σύνδεση». Χρησιμοποιήστε τα διαπιστευτήρια που σας έστειλε ο πλατφορμικός διαχειριστής στο email εγγραφής του γραφείου σας." },
      {
        kind: "steps",
        items: [
          "Ανοίξτε την αρχική σελίδα mykalypsis.gr",
          "Πατήστε το κουμπί «Σύνδεση» πάνω δεξιά",
          "Συμπληρώστε email και κωδικό",
          "Αν έχετε ενεργοποιήσει 2FA, πληκτρολογήστε τον κωδικό μιας χρήσης από την εφαρμογή authenticator",
          "Θα μεταφερθείτε στον Πίνακα Ελέγχου (Dashboard)",
        ],
      },
      { kind: "shot", caption: "Στιγμιότυπο: Οθόνη σύνδεσης mykalypsis.gr/login" },
      { kind: "note", text: "Αν ξεχάσατε τον κωδικό σας, πατήστε «Ξεχάσατε τον κωδικό;» στην οθόνη σύνδεσης. Θα σας σταλεί email με σύνδεσμο επαναφοράς που ισχύει για 30 λεπτά." },
    ],
    children: [
      {
        id: "dashboard-overview",
        title: "Επισκόπηση Πίνακα Ελέγχου",
        keywords: ["dashboard", "KPIs", "συμβόλαια που λήγουν", "εκκρεμείς πληρωμές"],
        body: [
          { kind: "p", text: "Ο Πίνακας Ελέγχου συνοψίζει τα κρίσιμα νούμερα του γραφείου: ενεργά συμβόλαια, συμβόλαια που λήγουν στις επόμενες 30 ημέρες, εκκρεμείς εισπράξεις, μηνιαία παραγωγή, και τη λίστα των πιο πρόσφατων ενεργειών." },
          { kind: "shot", caption: "Στιγμιότυπο: Dashboard με KPI cards, γραφήματα παραγωγής και λίστα «τελευταίες ενέργειες»" },
          { kind: "p", text: "Κάθε κάρτα KPI λειτουργεί ως συντόμευση — πατώντας π.χ. «Συμβόλαια που λήγουν» μεταφέρεστε στη φιλτραρισμένη λίστα των αντίστοιχων συμβολαίων." },
        ],
      },
      {
        id: "sidebar",
        title: "Πλευρικό μενού (Sidebar)",
        keywords: ["sidebar", "μενού", "πλοήγηση", "navigation"],
        body: [
          { kind: "p", text: "Το αριστερό μενού ομαδοποιεί όλες τις λειτουργίες σε κατηγορίες: Πωλήσεις (Πελάτες, Συμβόλαια, Πρόσθετες Πράξεις, Ακυρώσεις), Παραγωγή (Λίστες Παραγωγής, Πινάκια Υπερπρομηθειών), Οικονομικά (Πληρωμές, Εκκαθαρίσεις), Γέφυρες Εταιρειών, ΕΡΜΗΣ (κρυπτογραφημένη επικοινωνία), Παραμετροποίηση, και Διοίκηση." },
          { kind: "tip", text: "Πατώντας το βέλος δίπλα σε μια κατηγορία, την ανοίγετε/κλείνετε. Οι επιλογές σας θυμούνται μεταξύ συνδέσεων." },
        ],
      },
    ],
  },
  {
    id: "customers",
    title: "Πελάτες",
    keywords: ["πελάτες", "customers", "καρτέλα πελάτη", "ΑΦΜ", "οικογένεια"],
    body: [
      { kind: "p", text: "Η καρτέλα «Πελάτες» είναι το αρχείο όλων των φυσικών και νομικών προσώπων με τα οποία συνεργάζεται το γραφείο σας. Από εδώ δημιουργείτε νέους πελάτες, τους αναζητάτε με ΑΦΜ / όνομα / τηλέφωνο, και μεταβαίνετε στην αναλυτική τους καρτέλα." },
    ],
    children: [
      {
        id: "customers-create",
        title: "Δημιουργία νέου πελάτη",
        keywords: ["νέος πελάτης", "καταχώρηση πελάτη", "AFM", "ΑΦΜ"],
        body: [
          {
            kind: "steps",
            items: [
              "Από το μενού πατήστε «Πωλήσεις» → «Πελάτες»",
              "Πατήστε το κουμπί «+ Νέος πελάτης» πάνω δεξιά",
              "Επιλέξτε τύπο: Φυσικό ή Νομικό Πρόσωπο",
              "Συμπληρώστε ΑΦΜ, όνομα/επωνυμία, στοιχεία επικοινωνίας",
              "Πατήστε «Αποθήκευση»",
            ],
          },
          { kind: "shot", caption: "Στιγμιότυπο: Φόρμα δημιουργίας νέου πελάτη" },
          { kind: "note", text: "Το ΑΦΜ είναι μοναδικό ανά γραφείο — αν υπάρχει ήδη πελάτης με τον ίδιο ΑΦΜ, το σύστημα θα σας ειδοποιήσει και θα σας προτείνει να ανοίξετε την υπάρχουσα καρτέλα." },
        ],
      },
      {
        id: "customers-family",
        title: "Οικογένεια πελάτη",
        keywords: ["οικογένεια", "μέλη", "σύζυγος", "παιδιά"],
        body: [
          { kind: "p", text: "Στην καρτέλα κάθε πελάτη υπάρχει το tab «Οικογένεια» όπου συνδέετε μέλη (σύζυγο, παιδιά, γονείς) με τη σχέση τους. Έτσι όταν καταχωρείτε ένα συμβόλαιο με διαφορετικό οδηγό, μπορείτε να επιλέξετε άμεσα το σωστό μέλος." },
          { kind: "shot", caption: "Στιγμιότυπο: Καρτέλα πελάτη → Tab Οικογένεια" },
        ],
      },
      {
        id: "customers-search",
        title: "Αναζήτηση πελάτη",
        keywords: ["αναζήτηση", "search", "φίλτρα"],
        body: [
          { kind: "p", text: "Η αναζήτηση δουλεύει σε πραγματικό χρόνο. Πληκτρολογήστε ΑΦΜ, όνομα, επωνυμία, email ή τηλέφωνο — τα αποτελέσματα φιλτράρονται καθώς πληκτρολογείτε. Τα φίλτρα «Τύπος», «Κατάσταση» και «Πηγή» στενεύουν περαιτέρω τα αποτελέσματα." },
        ],
      },
    ],
  },
  {
    id: "policies",
    title: "Συμβόλαια",
    keywords: ["συμβόλαια", "policies", "καρτέλα συμβολαίου", "premium", "ασφάλιστρο"],
    body: [
      { kind: "p", text: "Ένα συμβόλαιο αναπαριστά μία ενεργή ή ληξιπρόθεσμη σχέση ασφάλισης ανάμεσα σε πελάτη και ασφαλιστική εταιρεία. Το Kalypsis υποστηρίζει όλους τους κλάδους: Αυτοκίνητο, Πυρός/Κατοικία, Υγείας, Ζωής, Επιχειρήσεων, Ταξιδιωτικά κλπ." },
    ],
    children: [
      {
        id: "policies-create-manual",
        title: "Χειροκίνητη δημιουργία συμβολαίου",
        keywords: ["νέο συμβόλαιο", "χειροκίνητη καταχώρηση", "manual"],
        body: [
          {
            kind: "steps",
            items: [
              "Μεταβείτε στο μενού «Πωλήσεις» → «Συμβόλαια»",
              "Πατήστε «+ Νέο συμβόλαιο»",
              "Επιλέξτε τον πελάτη (ή δημιουργήστε νέο)",
              "Επιλέξτε την ασφαλιστική εταιρεία",
              "Επιλέξτε Κλάδο, Χρήση οχήματος (αν είναι Αυτοκίνητο), Πακέτο, Κάλυψη — όλα από τα δικά σας παραμετρικά",
              "Συμπληρώστε αριθμό συμβολαίου, ημερομηνίες, μικτό ασφάλιστρο και συχνότητα πληρωμής",
              "Πατήστε «Αποθήκευση» — αν χρειάζεται, δημιουργούνται αυτόματα οι δόσεις",
            ],
          },
          { kind: "shot", caption: "Στιγμιότυπο: Φόρμα δημιουργίας νέου συμβολαίου" },
          { kind: "tip", text: "Στα φίλτρα Κλάδου / Χρήσης / Κάλυψης / Πακέτου εμφανίζονται όσες τιμές έχει ορίσει το γραφείο στα «Παραμετρικά Ασφαλιστικών» για τη συγκεκριμένη εταιρεία. Αν λείπει κάποια, μπορείτε να την προσθέσετε από την «Παραμετροποίηση»." },
        ],
      },
      {
        id: "policies-detail",
        title: "Καρτέλα συμβολαίου",
        keywords: ["καρτέλα συμβολαίου", "λεπτομέρειες συμβολαίου", "καλύψεις"],
        body: [
          { kind: "p", text: "Πατώντας τον αριθμό συμβολαίου σε οποιαδήποτε λίστα, ανοίγει η αναλυτική καρτέλα με: γενικά στοιχεία, καλύψεις, δόσεις πληρωμής, ιστορικό (ανανεώσεις, πράξεις, ακυρώσεις), σημειώσεις, και συνημμένα έγγραφα." },
          { kind: "shot", caption: "Στιγμιότυπο: PolicyDetailDrawer — καρτέλα συμβολαίου με tabs" },
        ],
      },
      {
        id: "policies-renewals",
        title: "Ανανεώσεις",
        keywords: ["ανανέωση", "renewal", "νέα περίοδος"],
        body: [
          { kind: "p", text: "Όταν λήγει ένα συμβόλαιο, από την καρτέλα του πατάτε «Ανανέωση». Το σύστημα προσυμπληρώνει τα στοιχεία (πελάτης, εταιρεία, κλάδος, καλύψεις) και σας ζητά μόνο τη νέα περίοδο, το νέο ασφάλιστρο και τυχόν αλλαγές σε συνεργάτη ή ειδικές προμήθειες." },
          { kind: "tip", text: "Οι διακόπτες «Διατήρηση ιστορικού υπερπρομηθειών», «Διατήρηση ειδικών προμηθειών» και «Διατήρηση αρ. εγγράφου» στην ανανέωση σας γλυτώνουν από χειροκίνητο copy-paste." },
        ],
      },
      {
        id: "policies-cancellations",
        title: "Ακυρώσεις",
        keywords: ["ακύρωση", "cancellation", "επιστροφή ασφαλίστρου"],
        body: [
          { kind: "p", text: "Οι ακυρώσεις γίνονται από το μενού «Πωλήσεις» → «Ακυρώσεις» ή απευθείας από την καρτέλα του συμβολαίου. Επιλέγετε αιτία, ημερομηνία ισχύος, και μέθοδο υπολογισμού επιστροφής." },
          {
            kind: "kv",
            rows: [
              { k: "Αναλογική (Pro Rata)", v: "Επιστροφή αναλογικά με τις ημέρες που δεν χρησιμοποιήθηκαν." },
              { k: "Ποινή πρόωρης (Short Rate)", v: "Αναλογικός υπολογισμός με 20% ποινή πρόωρης λήξης." },
              { k: "Πλήρης", v: "Ολόκληρη επιστροφή του καταβληθέντος ποσού." },
              { k: "Χειροκίνητη", v: "Ορίζετε εσείς το ποσό επιστροφής." },
            ],
          },
          { kind: "note", text: "Οι ακυρώσεις από γέφυρες ασφαλιστικών (bridge) καταχωρούνται αυτόματα με μέθοδο «Χειροκίνητη» και σημείωση «Αυτόματη ακύρωση από γέφυρα ασφαλιστικής»." },
        ],
      },
      {
        id: "policies-endorsements",
        title: "Πρόσθετες πράξεις (Endorsements)",
        keywords: ["πρόσθετη πράξη", "endorsement", "τροποποίηση συμβολαίου"],
        body: [
          { kind: "p", text: "Για κάθε αλλαγή στη διάρκεια του συμβολαίου (αλλαγή οδηγού, προσθήκη κάλυψης, αλλαγή διεύθυνσης) δημιουργείτε πρόσθετη πράξη από το μενού «Πωλήσεις» → «Πρόσθετες πράξεις». Το ιστορικό διατηρείται στην καρτέλα του συμβολαίου." },
        ],
      },
    ],
  },
  {
    id: "bridges",
    title: "Γέφυρες Εταιρειών (Bridges)",
    keywords: [
      "γέφυρες", "bridges", "ERGO", "ATLANTIC", "GRAND COVER", "xlsx",
      "εισαγωγή συμβολαίων", "αυτόματη εισαγωγή",
    ],
    body: [
      { kind: "p", text: "Οι γέφυρες κάνουν αυτόματη εισαγωγή συμβολαίων και εκκαθαρίσεων απευθείας από τα αρχεία που στέλνουν οι ασφαλιστικές εταιρείες (xlsx, txt, csv). Καλύπτουμε ERGO, ATLANTIC, GRAND COVER και προσθέτουμε νέες κάθε μήνα." },
    ],
    children: [
      {
        id: "bridges-carrier",
        title: "Γέφυρες παραγωγής (νέα συμβόλαια)",
        keywords: ["γέφυρα παραγωγής", "εισαγωγή xlsx", "νέα συμβόλαια"],
        body: [
          {
            kind: "steps",
            items: [
              "Από το μενού «Γέφυρες Εταιρειών» επιλέξτε «Παραγωγή / Γέφυρες εταιρειών»",
              "Επιλέξτε ασφαλιστική εταιρεία από τη λίστα",
              "Πατήστε «Επιλογή αρχείου» και ανεβάστε το xlsx που σας έστειλε η εταιρεία",
              "Δείτε την επισκόπηση: πόσα συμβόλαια είναι έτοιμα, ποια χρειάζονται προσοχή, ποια είναι διπλότυπα",
              "Πατήστε «Εισαγωγή» — τα συμβόλαια δημιουργούνται αυτόματα και συνδέονται στους σωστούς πελάτες/συνεργάτες",
            ],
          },
          { kind: "shot", caption: "Στιγμιότυπο: Γέφυρα ERGO — προεπισκόπηση εισαγωγής" },
          { kind: "tip", text: "Κάθε παραμετρικό (Κλάδος, Χρήση, Κάλυψη, Πακέτο) που έρχεται από τη γέφυρα αντιστοιχίζεται στα δικά σας παραμετρικά μέσω των «Αντιστοιχίσεων κωδικών» — γίνεται μία φορά και δουλεύει αυτόματα από εκεί και μετά." },
        ],
      },
      {
        id: "bridges-over-commission",
        title: "Γέφυρες Υπερπρομηθειών",
        keywords: ["υπερπρομήθεια", "over commission", "πινάκιο"],
        body: [
          { kind: "p", text: "Ανεβάζετε το μηνιαίο πινάκιο υπερπρομηθειών που στέλνει η εταιρεία. Το σύστημα αντιστοιχίζει κάθε γραμμή με τα ήδη καταχωρημένα συμβόλαια και ενημερώνει αυτόματα τα οικονομικά των συνεργατών." },
        ],
      },
      {
        id: "bridges-collections",
        title: "Γέφυρες Οικονομικών (αρχεία είσπραξης)",
        keywords: ["είσπραξη", "collection files", "πληρωμές ασφαλίστρων"],
        body: [
          { kind: "p", text: "Τα αρχεία είσπραξης δείχνουν ποια ασφάλιστρα έχουν πληρωθεί απευθείας στην εταιρεία. Ανεβάζοντάς τα, το σύστημα σβήνει αυτόματα τις αντίστοιχες οφειλές και συμφωνεί με τα ημερολόγιά σας." },
        ],
      },
      {
        id: "bridges-mappings",
        title: "Αντιστοιχίσεις κωδικών",
        keywords: ["αντιστοίχιση", "mapping", "κωδικοί εταιρειών"],
        body: [
          { kind: "p", text: "Κάθε ασφαλιστική στέλνει τα δικά της νούμερα για κλάδους, καλύψεις και συνεργάτες. Στη σελίδα «Αντιστοιχίσεις κωδικών» τα χαρτογραφείτε μία φορά στα δικά σας παραμετρικά — από εκεί και μετά κάθε νέα εισαγωγή δουλεύει σιωπηλά." },
        ],
      },
    ],
  },
  {
    id: "production-lists",
    title: "Λίστες Παραγωγής",
    keywords: [
      "λίστες παραγωγής", "production lists", "πινάκια παραγωγής",
      "εκτύπωση παραγωγής", "εξαγωγή CSV", "εξαγωγή Excel",
    ],
    body: [
      { kind: "p", text: "Η αναφορά παραγωγής δείχνει όλα τα συμβόλαια του χαρτοφυλακίου με πλήρη φίλτρα, ομαδοποίηση, σύνολα προμηθειών και εξαγωγή σε CSV / Excel / PDF. Είναι το εργαλείο που στέλνετε στους συνεργάτες σας και στους λογιστές." },
    ],
    children: [
      {
        id: "production-filters",
        title: "Φίλτρα και ομαδοποίηση",
        keywords: ["φίλτρα", "ομαδοποίηση", "grouping", "ανά συνεργάτη"],
        body: [
          { kind: "p", text: "Στην κορυφή της σελίδας υπάρχουν φίλτρα για Από/Έως ημερομηνία, Ασφαλιστική, Συνεργάτης, Κλάδος, Χρήση οχήματος, Κάλυψη, Πακέτο, Κατάσταση συμβολαίου, και Ομαδοποίηση." },
          {
            kind: "kv",
            rows: [
              { k: "Χωρίς ομαδοποίηση", v: "Ενιαία λίστα όλων των συμβολαίων." },
              { k: "Ανά ασφαλιστική", v: "Οι γραμμές ομαδοποιούνται και σε κάθε ομάδα υπάρχει υποσύνολο." },
              { k: "Ανά συνεργάτη", v: "Ο κλασικός τρόπος για μηνιαίο πινάκιο συνεργάτη." },
              { k: "Ανά κλάδο", v: "Χρήσιμο για διοικητική επισκόπηση." },
              { k: "Ανά μήνα", v: "Δείχνει την εξέλιξη παραγωγής μήνα-μήνα." },
            ],
          },
          { kind: "shot", caption: "Στιγμιότυπο: Λίστες Παραγωγής με ενεργή ομαδοποίηση ανά συνεργάτη" },
        ],
      },
      {
        id: "production-print-export",
        title: "Εκτύπωση & Εξαγωγή",
        keywords: ["εκτύπωση", "εξαγωγή", "CSV", "Excel", "PDF"],
        body: [
          { kind: "p", text: "Το κουμπί «Εκτύπωση» ανοίγει την προεπισκόπηση εκτύπωσης με βάση τα ενεργά φίλτρα και την ομαδοποίηση. Το «Εξαγωγή» παράγει CSV, Excel ή PDF." },
          { kind: "tip", text: "Ο διακόπτης «Απόκρυψη προμ. έδρας» κρύβει τη στήλη προμήθειας γραφείου — χρήσιμο όταν στέλνετε πινάκιο σε συνεργάτη και δεν θέλετε να ξέρει τι κρατά η έδρα." },
          { kind: "note", text: "Η στήλη ΦΠΑ εμφανίζεται αυτόματα μόνο όταν κάποια γραμμή έχει πραγματικό ΦΠΑ (από γέφυρα). Αλλιώς κρύβεται για καθαρότερη εμφάνιση — μπορείτε να την ενεργοποιήσετε χειροκίνητα από τον επιλογέα στηλών." },
        ],
      },
      {
        id: "production-commission-runs",
        title: "Εκκαθαρίσεις Προμηθειών",
        keywords: ["εκκαθάριση", "commission run", "πινάκιο συνεργάτη", "μηνιαία εκκαθάριση"],
        body: [
          { kind: "p", text: "Από το κουμπί «Εκκαθαρίσεις προμηθειών» πάνω δεξιά ανοίγει η σελίδα όπου δημιουργείτε τη μηνιαία εκκαθάριση κάθε συνεργάτη. Το σύστημα υπολογίζει βάσει των CommissionRules που έχετε ορίσει, δείχνει τι θα καταβληθεί, και σας δίνει τη δυνατότητα οριστικοποίησης." },
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Πληρωμές & Εισπράξεις",
    keywords: ["πληρωμές", "εισπράξεις", "receipts", "payments", "ταμείο"],
    body: [
      { kind: "p", text: "Κάθε συμβόλαιο έχει δόσεις. Όταν εισπράττετε ένα ποσό (μετρητά, POS, τραπεζική κατάθεση), το καταχωρείτε ως «Είσπραξη» — το σύστημα ενημερώνει αυτόματα την αντίστοιχη δόση και την οφειλή του πελάτη." },
    ],
    children: [
      {
        id: "payments-installments",
        title: "Δόσεις συμβολαίου",
        keywords: ["δόσεις", "installments"],
        body: [
          { kind: "p", text: "Οι δόσεις παράγονται αυτόματα με βάση τη συχνότητα πληρωμής που ορίσατε στο συμβόλαιο (ετήσια / εξαμηνιαία / τριμηνιαία / μηνιαία). Μπορείτε πάντα να τις αναγεννήσετε χειροκίνητα από την καρτέλα του συμβολαίου." },
        ],
      },
      {
        id: "payments-receipts",
        title: "Καταχώρηση είσπραξης",
        keywords: ["είσπραξη", "receipt", "μετρητά", "POS"],
        body: [
          {
            kind: "steps",
            items: [
              "Ανοίξτε την καρτέλα του συμβολαίου",
              "Στο tab «Δόσεις» βρείτε τη δόση προς πληρωμή",
              "Πατήστε «Είσπραξη»",
              "Επιλέξτε μέθοδο (μετρητά, POS, κατάθεση), βάλτε τεκμήριο (Ζ αριθμός, αρ. συναλλαγής POS)",
              "Πατήστε «Καταχώρηση»",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "claims",
    title: "Ζημιές",
    keywords: ["ζημιές", "claims", "αναγγελία ζημιάς"],
    body: [
      { kind: "p", text: "Καταχωρείτε ζημιές που δηλώνουν οι πελάτες σας, τις συνδέετε με το αντίστοιχο συμβόλαιο, ανεβάζετε συνημμένα (φωτογραφίες, πραγματογνωμοσύνες, αστυνομικές αναφορές) και παρακολουθείτε την εξέλιξή τους μέχρι την αποζημίωση." },
      { kind: "shot", caption: "Στιγμιότυπο: Λίστα ζημιών με φίλτρα" },
    ],
  },
  {
    id: "producers",
    title: "Συνεργάτες / Παραγωγοί",
    keywords: ["συνεργάτες", "παραγωγοί", "producers", "προμήθειες συνεργατών"],
    body: [
      { kind: "p", text: "Καταχωρείτε τους συνεργάτες σας (πωλητές, υποπράκτορες), ορίζετε ιεραρχία (Producer / Manager / Unit / Assistant / Agency), και τους αντιστοιχίζετε σε συμβόλαια. Οι προμήθειες υπολογίζονται αυτόματα βάσει των κανόνων που έχετε ορίσει." },
    ],
    children: [
      {
        id: "producers-commission-rules",
        title: "Κανόνες Προμηθειών",
        keywords: ["commission rules", "κανόνες προμηθειών", "ποσοστά"],
        body: [
          { kind: "p", text: "Στη σελίδα «Κανόνες Προμηθειών» ορίζετε ποσοστά ανά συνεργάτη + ασφαλιστική + κλάδο + κάλυψη + tier. Ο πιο ειδικός κανόνας υπερισχύει πάντα του γενικού — έτσι μπορείτε να έχετε γενικό ποσοστό για μια εταιρεία και ειδικό για μια συγκεκριμένη κάλυψη." },
          { kind: "shot", caption: "Στιγμιότυπο: Πίνακας κανόνων προμηθειών" },
        ],
      },
    ],
  },
  {
    id: "parametrics",
    title: "Παραμετρικά Ασφαλιστικών",
    keywords: ["παραμετρικά", "parametrics", "κλάδοι", "καλύψεις", "πακέτα"],
    body: [
      { kind: "p", text: "Ορίζετε τους δικούς σας Κλάδους, Καλύψεις, Χρήσεις οχήματος και Πακέτα ανά ασφαλιστική εταιρεία. Οι γέφυρες αντιστοιχίζουν τα αρχεία εισαγωγής σε αυτά τα παραμετρικά, ενώ οι φόρμες συμβολαίων τα εμφανίζουν στα dropdown menus." },
    ],
    children: [
      {
        id: "parametrics-add-carrier",
        title: "Προσθήκη νέας ασφαλιστικής",
        keywords: ["νέα εταιρεία", "insurance company"],
        body: [
          {
            kind: "steps",
            items: [
              "Παραμετροποίηση → Ασφαλιστικές Εταιρείες",
              "«+ Νέα εταιρεία»",
              "Συμπληρώστε επωνυμία, κωδικό (π.χ. ERGO), ΑΦΜ, στοιχεία επικοινωνίας",
              "Αποθήκευση — η εταιρεία εμφανίζεται σε όλα τα dropdown",
            ],
          },
        ],
      },
      {
        id: "parametrics-add-items",
        title: "Καταχώρηση παραμετρικών",
        keywords: ["κλάδος", "κάλυψη", "χρήση", "πακέτο"],
        body: [
          { kind: "p", text: "Στη σελίδα «Παραμετρικά ασφαλιστικών» επιλέγετε ασφαλιστική και μετά tab (Κλάδοι, Καλύψεις, Χρήσεις, Πακέτα). Πατώντας «+ Νέο» δημιουργείτε νέα καταχώρηση με κωδικό, όνομα, και προαιρετικά policyType / vehicleUseCategory ώστε να συνδέεται με τους ενσωματωμένους enums του συστήματος." },
          { kind: "tip", text: "Αν αφήσετε άδειο το policyType/vehicleUseCategory, το φίλτρο στις Λίστες Παραγωγής θα χρησιμοποιεί τον κωδικό σας απευθείας — δουλεύει σε κάθε περίπτωση." },
        ],
      },
    ],
  },
  {
    id: "ermes",
    title: "ΕΡΜΗΣ — Κρυπτογραφημένη Επικοινωνία",
    keywords: ["ερμής", "ermes", "chat", "κρυπτογραφημένη επικοινωνία", "end-to-end"],
    body: [
      { kind: "p", text: "Ο ΕΡΜΗΣ είναι το ενσωματωμένο κρυπτογραφημένο chat του Kalypsis. Μιλάτε με τους συναδέλφους σας ή τους συνεργάτες σας σε πραγματικό χρόνο — τα μηνύματα κρυπτογραφούνται στη συσκευή και αποκρυπτογραφούνται μόνο στην άλλη άκρη, ούτε καν οι διαχειριστές της πλατφόρμας δεν μπορούν να τα διαβάσουν." },
      { kind: "shot", caption: "Στιγμιότυπο: ΕΡΜΗΣ — καρτέλα συνομιλίας" },
    ],
  },
  {
    id: "appointments",
    title: "Ημερολόγιο & Ραντεβού",
    keywords: ["ραντεβού", "appointments", "ημερολόγιο", "calendar"],
    body: [
      { kind: "p", text: "Το ενσωματωμένο ημερολόγιο σας βοηθά να προγραμματίσετε ραντεβού με πελάτες, εξωτερικές συναντήσεις και δραστηριότητες του γραφείου. Δουλεύει σε 24ωρη μορφή ώρας (Athens time)." },
    ],
  },
  {
    id: "settings",
    title: "Ρυθμίσεις",
    keywords: ["ρυθμίσεις", "settings", "προφίλ", "εταιρεία"],
    body: [
      { kind: "p", text: "Στις Ρυθμίσεις διαχειρίζεστε το προφίλ σας, τα στοιχεία εταιρείας, τους χρήστες που έχουν πρόσβαση, τους ρόλους και τα δικαιώματα, καθώς και την ενεργοποίηση των πακέτων που έχει το γραφείο σας." },
    ],
  },
  {
    id: "desktop",
    title: "Kalypsis Desktop",
    keywords: ["desktop", "Windows", "εγκατάσταση", "offline"],
    body: [
      { kind: "p", text: "Πέρα από τη web εφαρμογή, το Kalypsis διαθέτει και εφαρμογή Windows για offline εργασία, γρήγορη πρόσβαση και offline εκτυπώσεις. Η εγκατάσταση γίνεται από τη σελίδα «Λήψη» στο mykalypsis.gr/download." },
    ],
  },
  {
    id: "faq",
    title: "Συχνές Ερωτήσεις",
    keywords: ["FAQ", "συχνές ερωτήσεις", "βοήθεια"],
    body: [
      { kind: "p", text: "Παρακάτω βρίσκετε γρήγορες απαντήσεις σε ερωτήσεις που κάνουν οι περισσότεροι νέοι χρήστες. Για οτιδήποτε άλλο, γράψτε μας στο info@mykalypsis.gr." },
      {
        kind: "kv",
        rows: [
          { k: "Πώς αλλάζω τον κωδικό μου;", v: "Πάνω δεξιά → Προφίλ → Αλλαγή κωδικού. Συνιστούμε επίσης να ενεργοποιήσετε το 2FA από την ίδια σελίδα." },
          { k: "Χάθηκε ένα συμβόλαιο — πώς το βρίσκω;", v: "Χρησιμοποιήστε τη σφαιρική αναζήτηση (Ctrl+K) και πληκτρολογήστε αριθμό συμβολαίου, ΑΦΜ πελάτη ή πινακίδα οχήματος." },
          { k: "Πώς εξάγω πινάκιο για συνεργάτη;", v: "Λίστες Παραγωγής → Φίλτρο «Συνεργάτης», Ομαδοποίηση «Ανά συνεργάτη», Ενεργοποιήστε «Απόκρυψη προμ. έδρας», Εκτύπωση ή Εξαγωγή." },
          { k: "Ξέχασα να ανεβάσω πινάκιο — μπορώ αναδρομικά;", v: "Ναι — οι γέφυρες υποστηρίζουν αρχεία από οποιαδήποτε περίοδο. Το σύστημα εντοπίζει διπλότυπα και τα παραλείπει." },
          { k: "Οι ώρες φαίνονται λάθος στην οθόνη μου.", v: "Όλες οι ώρες εμφανίζονται σε ώρα Αθήνας (24ωρη μορφή). Αν βλέπετε αλλιώς, αδειάστε την cache του browser." },
        ],
      },
    ],
  },
  {
    id: "support",
    title: "Υποστήριξη",
    keywords: ["υποστήριξη", "support", "επικοινωνία"],
    body: [
      { kind: "p", text: "Για τεχνική υποστήριξη, ερωτήσεις ή προτάσεις βελτίωσης, γράψτε μας στο info@mykalypsis.gr ή χρησιμοποιήστε τη φόρμα επικοινωνίας στη σελίδα mykalypsis.gr/contact. Απαντάμε εντός 24 ωρών εργάσιμες μέρες." },
    ],
  },
];

// Flatten the tree for search + linear rendering.
function flatten(sections: DocSection[], parent = "", depth = 1): Array<DocSection & { depth: number; parentId: string }> {
  const out: Array<DocSection & { depth: number; parentId: string }> = [];
  for (const s of sections) {
    out.push({ ...s, depth, parentId: parent });
    if (s.children) out.push(...flatten(s.children, s.id, depth + 1));
  }
  return out;
}

function matches(section: DocSection, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  if (section.title.toLowerCase().includes(q)) return true;
  if (section.keywords.some(k => k.toLowerCase().includes(q))) return true;
  for (const block of section.body) {
    if (block.kind === "p" && block.text.toLowerCase().includes(q)) return true;
    if (block.kind === "note" && block.text.toLowerCase().includes(q)) return true;
    if (block.kind === "tip" && block.text.toLowerCase().includes(q)) return true;
    if (block.kind === "steps" && block.items.some(i => i.toLowerCase().includes(q))) return true;
    if (block.kind === "kv" && block.rows.some(r => `${r.k} ${r.v}`.toLowerCase().includes(q))) return true;
  }
  if (section.children) return section.children.some(c => matches(c, q));
  return false;
}

const SEO_TITLE = "Οδηγίες Χρήσης Kalypsis — Ασφαλιστικό Λογισμικό";
const SEO_DESCRIPTION = "Πλήρης οδηγός χρήσης της πλατφόρμας Kalypsis για ασφαλιστικά γραφεία: πελάτες, συμβόλαια, γέφυρες εταιρειών, λίστες παραγωγής, εκκαθαρίσεις προμηθειών, ζημιές, ραντεβού και ΕΡΜΗΣ κρυπτογραφημένη επικοινωνία.";
const SEO_KEYWORDS = "kalypsis, οδηγίες χρήσης, ασφαλιστικό λογισμικό, λογισμικό ασφαλιστών, ERGO γέφυρα, ATLANTIC γέφυρα, GRAND COVER, πινάκιο παραγωγής, εκκαθάριση προμηθειών, ασφαλιστικό γραφείο, cloud CRM ασφαλιστών, ασφάλειες αυτοκινήτου, πυρός, ζωής, υγείας";

export function DocumentationPage() {
  const location = useLocation();
  const isPublic = !location.pathname.startsWith("/app");
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const [tocOpen, setTocOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("welcome");

  const flat = useMemo(() => flatten(SECTIONS), []);
  const visibleTop = useMemo(
    () => SECTIONS.map(s => ({ ...s, matched: matches(s, query) })).filter(s => s.matched),
    [query]
  );

  // Set page title + SEO meta tags. On the public route only, inject rich
  // meta tags for Google — description, keywords, Open Graph, canonical.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO_TITLE;
    const upsert = (attr: string, key: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, key);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    upsert("name", "description", SEO_DESCRIPTION);
    upsert("name", "keywords", SEO_KEYWORDS);
    upsert("property", "og:title", SEO_TITLE);
    upsert("property", "og:description", SEO_DESCRIPTION);
    upsert("property", "og:type", "website");
    upsert("property", "og:locale", "el_GR");
    return () => { document.title = prevTitle; };
  }, []);

  // Track active section via IntersectionObserver so the sidebar highlights
  // whichever heading the reader has scrolled into view. Cheap version:
  // update on scroll, not on every intersection event.
  useEffect(() => {
    const onScroll = () => {
      let current = "welcome";
      for (const s of flat) {
        const el = document.getElementById(`doc-${s.id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top < 140) current = s.id; else break;
      }
      setActiveId(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [flat]);

  const scrollTo = (id: string) => {
    setTocOpen(false);
    const el = document.getElementById(`doc-${id}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const tocList = (
    <List dense sx={{ py: 0 }}>
      {visibleTop.map(s => (
        <Box key={s.id}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => scrollTo(s.id)}
              selected={activeId === s.id || (s.children?.some(c => c.id === activeId) ?? false)}
              sx={{ borderRadius: 1, mb: 0.25 }}
            >
              <ListItemText
                primary={s.title}
                primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
              />
            </ListItemButton>
          </ListItem>
          {s.children?.filter(c => matches(c, query)).map(c => (
            <ListItem key={c.id} disablePadding sx={{ pl: 2 }}>
              <ListItemButton
                onClick={() => scrollTo(c.id)}
                selected={activeId === c.id}
                sx={{ borderRadius: 1, py: 0.4 }}
              >
                <ListItemText primary={c.title} primaryTypographyProps={{ fontSize: 13 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </Box>
      ))}
    </List>
  );

  const renderBlock = (block: DocBlock, idx: number) => {
    switch (block.kind) {
      case "p":
        return <Typography key={idx} paragraph sx={{ lineHeight: 1.75, fontSize: 15.5 }}>{block.text}</Typography>;
      case "steps":
        return (
          <Box key={idx} component="ol" sx={{ pl: 3, my: 2, "& li": { mb: 1, lineHeight: 1.7 } }}>
            {block.items.map((step, i) => <li key={i}>{step}</li>)}
          </Box>
        );
      case "note":
        return (
          <Box key={idx} sx={{
            my: 2, p: 2, borderRadius: 1.5,
            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(78,138,206,0.14)" : "#eef4fb",
            borderLeft: "4px solid", borderColor: "info.main",
          }}>
            <Typography sx={{ fontSize: 14.5, lineHeight: 1.65 }}>
              <strong>Σημείωση:</strong> {block.text}
            </Typography>
          </Box>
        );
      case "tip":
        return (
          <Box key={idx} sx={{
            my: 2, p: 2, borderRadius: 1.5,
            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(52,168,83,0.14)" : "#eef8f0",
            borderLeft: "4px solid", borderColor: "success.main",
          }}>
            <Typography sx={{ fontSize: 14.5, lineHeight: 1.65 }}>
              <strong>Συμβουλή:</strong> {block.text}
            </Typography>
          </Box>
        );
      case "shot":
        return (
          <Box key={idx} sx={{
            my: 2.5, p: 3, borderRadius: 2, textAlign: "center",
            border: "1.5px dashed", borderColor: "divider",
            bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#fafbfd",
          }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary", fontStyle: "italic" }}>
              📸 {block.caption}
            </Typography>
          </Box>
        );
      case "kv":
        return (
          <Box key={idx} sx={{ my: 2, overflowX: "auto" }}>
            <Box component="table" sx={{
              width: "100%", borderCollapse: "collapse",
              "& th, & td": { textAlign: "left", p: 1.25, borderBottom: "1px solid", borderColor: "divider", fontSize: 14, verticalAlign: "top" },
              "& th": { fontWeight: 700, width: 220, bgcolor: (t) => t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f6f8fb" },
            }}>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i}><th>{r.k}</th><td>{r.v}</td></tr>
                ))}
              </tbody>
            </Box>
          </Box>
        );
    }
  };

  const renderSection = (s: DocSection, depth: number) => (
    <Box key={s.id} id={`doc-${s.id}`} sx={{ scrollMarginTop: 80, mb: 5 }}>
      {depth === 1 ? (
        <Typography component="h2" sx={{
          fontSize: { xs: 24, md: 30 }, fontWeight: 800, mb: 2, mt: 4, letterSpacing: -0.5,
          borderBottom: "2px solid", borderColor: "primary.main", pb: 1,
        }}>{s.title}</Typography>
      ) : (
        <Typography component="h3" sx={{
          fontSize: { xs: 19, md: 22 }, fontWeight: 700, mb: 1.5, mt: 3,
        }}>{s.title}</Typography>
      )}
      {s.body.map((b, i) => renderBlock(b, i))}
      {s.children?.filter(c => matches(c, query)).map(c => renderSection(c, depth + 1))}
    </Box>
  );

  return (
    <Box sx={{
      // Print styles: strip chrome, flow all content, drop dashed shot boxes.
      "@media print": {
        "& .kal-doc-sidebar, & .kal-doc-toolbar": { display: "none !important" },
        "& .kal-doc-content": { p: 0, maxWidth: "none" },
        bgcolor: "#fff", color: "#000",
      },
    }}>
      {/* SEO-visible H1 + intro on the public page. Kept outside the toolbar
          so it lands in the print output too. */}
      {isPublic && (
        <Box sx={{
          bgcolor: "primary.main", color: "primary.contrastText",
          py: { xs: 5, md: 7 }, px: 3, mb: 2,
          "@media print": { display: "none" },
        }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Box>
                <Chip icon={<MenuBookIcon />} label="Οδηγός χρήσης" size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "inherit", fontWeight: 700, mb: 1.5 }} />
                <Typography component="h1" sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>
                  Οδηγίες Χρήσης Kalypsis
                </Typography>
                <Typography sx={{ mt: 1.5, fontSize: { xs: 15, md: 17 }, opacity: 0.9, maxWidth: 720 }}>
                  Πλήρης εγχειρίδιο για ασφαλιστικά γραφεία: πελάτες, συμβόλαια, γέφυρες εταιρειών, λίστες παραγωγής, εκκαθαρίσεις προμηθειών και πολλά ακόμα — στα ελληνικά, με βήμα-προς-βήμα οδηγίες.
                </Typography>
              </Box>
              <Stack direction={{ xs: "row", sm: "column" }} spacing={1}>
                <Button component={RouterLink} to="/login" variant="contained"
                  startIcon={<LoginIcon />} color="secondary"
                  sx={{ bgcolor: "#fff", color: "primary.main", fontWeight: 700, "&:hover": { bgcolor: "#f0f4fa" } }}>
                  Σύνδεση
                </Button>
                <Button onClick={() => window.print()} variant="outlined"
                  startIcon={<DownloadIcon />}
                  sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)", "&:hover": { borderColor: "#fff" } }}>
                  Λήψη PDF
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        {/* Toolbar: TOC toggle (mobile) + search + print. */}
        <Card variant="outlined" className="kal-doc-toolbar" sx={{ p: 2, mb: 3, position: "sticky", top: 8, zIndex: 5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isNarrow && (
              <IconButton onClick={() => setTocOpen(true)} size="small"><MenuIcon /></IconButton>
            )}
            <TextField
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση στον οδηγό…" size="small" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" startIcon={<PrintIcon />} size="small" onClick={() => window.print()}
              sx={{ whiteSpace: "nowrap" }}>
              Εκτύπωση / PDF
            </Button>
          </Stack>
        </Card>

        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "260px 1fr" } }}>
          {/* Desktop TOC */}
          <Box className="kal-doc-sidebar" sx={{
            display: { xs: "none", md: "block" },
            position: "sticky", top: 78, alignSelf: "flex-start",
            maxHeight: "calc(100vh - 100px)", overflowY: "auto",
            pr: 1,
          }}>
            <Typography variant="overline" sx={{ display: "block", mb: 1, color: "text.secondary", fontWeight: 700 }}>
              Περιεχόμενα
            </Typography>
            {tocList}
          </Box>

          {/* Mobile TOC drawer */}
          <Drawer open={tocOpen} onClose={() => setTocOpen(false)}>
            <Box sx={{ width: 300, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 800 }}>Περιεχόμενα</Typography>
              {tocList}
            </Box>
          </Drawer>

          <Box className="kal-doc-content" component="article" sx={{ minWidth: 0 }}>
            {visibleTop.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                Καμία ενότητα δεν αντιστοιχεί στην αναζήτηση «{query}».
              </Typography>
            ) : (
              visibleTop.map(s => renderSection(s, 1))
            )}

            {isPublic && (
              <Box sx={{
                mt: 6, pt: 4, borderTop: "1px solid", borderColor: "divider",
                textAlign: "center", "@media print": { display: "none" },
              }}>
                <Typography sx={{ mb: 2, color: "text.secondary" }}>
                  Έτοιμοι να ξεκινήσετε; Συνδεθείτε στο Kalypsis και ξεκινήστε τη δουλειά σας.
                </Typography>
                <Button component={RouterLink} to="/login" variant="contained" size="large" startIcon={<LoginIcon />}>
                  Σύνδεση στο Kalypsis
                </Button>
                <Typography sx={{ mt: 3, fontSize: 13, color: "text.secondary" }}>
                  Δεν έχετε ακόμα λογαριασμό;{" "}
                  <MuiLink component={RouterLink} to="/register" underline="hover" sx={{ fontWeight: 700 }}>
                    Εγγραφή γραφείου
                  </MuiLink>
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default DocumentationPage;
