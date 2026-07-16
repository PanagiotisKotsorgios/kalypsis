import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Responsible Disclosure Policy — RFC 9116 / security.txt συμμόρφωση.
// Δηλώνει πώς οι security researchers μπορούν να αναφέρουν ευπάθειες
// νόμιμα, τι δεσμεύεται να κάνει η Kalypsis, και safe-harbor για ερευνητές
// καλής πίστης.

export function SecurityDisclosurePage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.security.eyebrow", "Ασφάλεια Πληροφοριών")}
      title={t("legal.security.title", "Πολιτική Υπεύθυνης Γνωστοποίησης Ευπαθειών")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Καλωσορίζουμε τη συνεργασία με ερευνητές ασφάλειας που μας βοηθούν να
          κρατάμε την Πλατφόρμα ασφαλή. Η παρούσα πολιτική περιγράφει πώς να
          αναφέρετε ευπάθειες που ανακαλύπτετε και τι μπορείτε να περιμένετε
          από εμάς σε αντάλλαγμα.
        </p>
      }
      sections={[
        {
          id: "how-to-report",
          heading: "1. Πώς να Αναφέρετε",
          body: (
            <>
              <p>
                Στείλτε email στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>{" "}
                με τίτλο <strong>«[SECURITY]»</strong>. Περιλάβετε:
              </p>
              <ul>
                <li>Σύντομη περιγραφή της ευπάθειας</li>
                <li>Βήματα αναπαραγωγής (steps to reproduce)</li>
                <li>Δυνατότητα εκμετάλλευσης (proof-of-concept, αν εφικτό χωρίς ζημία)</li>
                <li>Εκτίμηση σοβαρότητας κατά CVSS 3.1</li>
                <li>Στοιχεία επικοινωνίας σας</li>
              </ul>
              <p>
                Για ευαίσθητες αναφορές μπορείτε να χρησιμοποιήσετε PGP
                encryption — το public key διατίθεται κατόπιν αιτήματος.
              </p>
            </>
          )
        },
        {
          id: "safe-harbor",
          heading: "2. Safe Harbor για Έρευνα Καλής Πίστης",
          body: (
            <>
              <p>Δεσμευόμαστε να μη κινήσουμε νομικές διαδικασίες κατά ερευνητών που:</p>
              <ul>
                <li>Ενεργούν σύμφωνα με την παρούσα πολιτική</li>
                <li>Δεν προκαλούν ζημία σε δεδομένα ή διαθεσιμότητα</li>
                <li>Δεν επιχειρούν προσπέλαση σε δεδομένα άλλων γραφείων/πελατών</li>
                <li>Δεν αποκαλύπτουν την ευπάθεια δημόσια πριν μας δώσουν εύλογο χρόνο για διόρθωση</li>
                <li>Χρησιμοποιούν λογαριασμούς που έχουν δικαίωμα χρήσης, ή δοκιμαστικά περιβάλλοντα</li>
              </ul>
            </>
          )
        },
        {
          id: "in-scope",
          heading: "3. Πεδίο Έρευνας (In-Scope)",
          body: (
            <ul>
              <li><code>*.mykalypsis.gr</code> και το production API</li>
              <li>Web SPA (React)</li>
              <li>Public endpoints (/api/public/*, /api/health, /api/version)</li>
              <li>Authenticated endpoints — μόνο με δικό σας test-tenant λογαριασμό</li>
            </ul>
          )
        },
        {
          id: "out-of-scope",
          heading: "4. Εκτός Πεδίου (Out-of-Scope)",
          body: (
            <ul>
              <li>Denial-of-Service (DoS / DDoS) επιθέσεις</li>
              <li>Social engineering προς τους υπαλλήλους ή τους πελάτες μας</li>
              <li>Φυσική πρόσβαση σε γραφεία ή υποδομές</li>
              <li>Ζητήματα σε third-party sub-processors (πχ Hetzner, Brevo) — αναφέρετε απευθείας σε εκείνους</li>
              <li>Θέματα που εξαρτώνται από ξεπερασμένα browsers χωρίς realistic impact</li>
              <li>SPF/DMARC/DKIM configuration reports χωρίς εκμεταλλευσιμότητα</li>
            </ul>
          )
        },
        {
          id: "our-commitment",
          heading: "5. Δέσμευσή μας",
          body: (
            <ul>
              <li><strong>Επιβεβαίωση παραλαβής:</strong> εντός 3 εργάσιμων ημερών.</li>
              <li><strong>Αρχική εκτίμηση σοβαρότητας:</strong> εντός 10 εργάσιμων ημερών.</li>
              <li><strong>Πλάνο αποκατάστασης:</strong> κοινοποιείται στον ερευνητή.</li>
              <li><strong>Ευχαριστίες:</strong> δημόσια αναγνώριση (Hall of Fame) εφόσον το επιθυμεί ο ερευνητής.</li>
              <li>
                <strong>Χρηματική αμοιβή:</strong> δεν λειτουργεί επίσημο bug bounty
                αυτή τη στιγμή, αλλά αξιολογούμε case-by-case ανάλογα με τη σοβαρότητα.
              </li>
            </ul>
          )
        },
        {
          id: "coordinated",
          heading: "6. Συντονισμένη Δημοσιοποίηση",
          body: (
            <p>
              Ζητούμε να διατηρήσετε εμπιστευτική την ευπάθεια μέχρι εκδοθεί
              patch (συνήθως ≤ 90 ημέρες). Θα συντονιστούμε μαζί σας για την
              ημερομηνία δημοσιοποίησης και θα σας πιστώσουμε στην ανακοίνωση.
            </p>
          )
        }
      ]}
    />
  );
}
