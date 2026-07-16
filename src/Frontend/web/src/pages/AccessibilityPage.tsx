import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Accessibility statement — Οδηγία (EU) 2016/2102 + WCAG 2.1 AA.
// Υποχρεωτικό για δημόσιο τομέα, best-practice για SaaS και standard
// enterprise-sales απαίτηση.

export function AccessibilityPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.accessibility.eyebrow", "Προσβασιμότητα")}
      title={t("legal.accessibility.title", "Δήλωση Προσβασιμότητας")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Η Kalypsis δεσμεύεται να καθιστά την Πλατφόρμα προσβάσιμη σε όσο το
          δυνατόν περισσότερους χρήστες, ανεξαρτήτως ικανοτήτων. Ακολουθούμε τις
          κατευθυντήριες γραμμές <strong>WCAG 2.1 Level AA</strong> ως στόχο
          συμμόρφωσης.
        </p>
      }
      sections={[
        {
          id: "status",
          heading: "1. Κατάσταση Συμμόρφωσης",
          body: (
            <>
              <p>
                Η Πλατφόρμα είναι <strong>μερικώς συμβατή</strong> με το WCAG 2.1
                Level AA. Οι περισσότερες οθόνες πληρούν τα κριτήρια· ορισμένες
                παλαιότερες φόρμες και reports παραμένουν σε βελτίωση.
              </p>
            </>
          )
        },
        {
          id: "features",
          heading: "2. Χαρακτηριστικά Προσβασιμότητας",
          body: (
            <ul>
              <li>Semantic HTML markup με σωστή ιεραρχία headings.</li>
              <li>Πλήρης πλοήγηση με πληκτρολόγιο (Tab / Enter / Escape) στα κύρια flows.</li>
              <li>ARIA labels σε icon-only κουμπιά και custom controls.</li>
              <li>Αντίθεση χρωμάτων ≥ 4,5:1 για κείμενο κανονικού μεγέθους.</li>
              <li>Responsive design για zoom έως 200% χωρίς απώλεια λειτουργικότητας.</li>
              <li>Alt text για σημαντικές εικόνες.</li>
              <li>Υποστήριξη screen readers (NVDA, JAWS, VoiceOver) στα κύρια CRUD flows.</li>
              <li>Προγραμματιστικά προσβάσιμοι error messages στις φόρμες.</li>
            </ul>
          )
        },
        {
          id: "known-issues",
          heading: "3. Γνωστά Ζητήματα",
          body: (
            <ul>
              <li>Ορισμένα drag-and-drop workflow (Kanban tasks) χρειάζονται αντίστοιχο keyboard alternative — σε roadmap.</li>
              <li>Πίνακες με πολλαπλές στήλες που έχουν horizontal scroll ενδέχεται να μην είναι πλήρως προσβάσιμοι σε screen readers.</li>
              <li>Χάρτες (map widgets) όπου εμφανίζονται δεν έχουν text alternative.</li>
              <li>Ορισμένα PDF exports χρειάζονται semantic tagging βελτίωση.</li>
            </ul>
          )
        },
        {
          id: "assistive-tech",
          heading: "4. Δοκιμασμένες Υποστηρικτικές Τεχνολογίες",
          body: (
            <ul>
              <li>NVDA με Firefox / Chrome</li>
              <li>VoiceOver με Safari (macOS + iOS)</li>
              <li>Windows Narrator με Edge</li>
              <li>Chrome zoom έως 200%</li>
            </ul>
          )
        },
        {
          id: "feedback",
          heading: "5. Ανατροφοδότηση & Αίτημα Προσαρμογής",
          body: (
            <>
              <p>
                Αν αντιμετωπίζετε πρόβλημα προσβασιμότητας ή χρειάζεστε
                εναλλακτική μορφή δεδομένων:
              </p>
              <ul>
                <li>Email: <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a></li>
                <li>Τηλέφωνο: κατόπιν αιτήματος</li>
              </ul>
              <p>
                Απαντάμε εντός <strong>5 εργάσιμων ημερών</strong>. Παρέχουμε
                εναλλακτικά κανάλια πρόσβασης (πχ αποστολή δεδομένων σε
                προσβάσιμη μορφή) όπου εύλογα εφικτό.
              </p>
            </>
          )
        },
        {
          id: "enforcement",
          heading: "6. Δικαίωμα Προσφυγής",
          body: (
            <p>
              Αν η απάντησή μας δεν σας ικανοποιήσει, μπορείτε να απευθυνθείτε στη{" "}
              <strong>Γενική Γραμματεία Πληροφοριακών Συστημάτων Δημόσιας
              Διοίκησης</strong> (για ζητήματα ψηφιακής προσβασιμότητας),
              Χανδρή 1 & Θεσσαλονίκης, 18346 Μοσχάτο.
            </p>
          )
        }
      ]}
    />
  );
}
