import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Service Level Agreement — δεσμεύσεις διαθεσιμότητας, χρόνων απόκρισης
// υποστήριξης, και reserved maintenance windows. Παράρτημα της Σύμβασης
// Παροχής Υπηρεσιών.

export function SlaPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.sla.eyebrow", "Παράρτημα Υπηρεσιών")}
      title={t("legal.sla.title", "Συμφωνία Επιπέδου Υπηρεσίας (SLA)")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Η παρούσα SLA («<strong>Συμφωνία Επιπέδου Υπηρεσίας</strong>») αποτελεί
          αναπόσπαστο μέρος της Σύμβασης Παροχής Υπηρεσιών Πλατφόρμας και
          καθορίζει τα ελάχιστα επίπεδα διαθεσιμότητας, υποστήριξης και ασφάλειας
          που ο <strong>Πάροχος</strong> εγγυάται προς τον <strong>Πελάτη</strong>.
          Έκδοση: <strong>v1.0</strong>.
        </p>
      }
      sections={[
        {
          id: "uptime",
          heading: "1. Διαθεσιμότητα Πλατφόρμας",
          body: (
            <>
              <p>
                Ο Πάροχος εγγυάται <strong>μηνιαία διαθεσιμότητα ≥ 99,5%</strong> για
                όλες τις παραγωγικές υπηρεσίες της Πλατφόρμας (BackOffice,
                FrontOffice, CRM).
              </p>
              <ul>
                <li>
                  <strong>Υπολογισμός:</strong> (Συνολικά λεπτά μηνός − Λεπτά
                  διακοπής) / Συνολικά λεπτά μηνός.
                </li>
                <li>
                  <strong>Εξαιρέσεις:</strong> προγραμματισμένα maintenance windows,
                  διακοπές τρίτων παρόχων υποδομής (Hetzner) που είναι εκτός ελέγχου
                  του Παρόχου, ανωτέρα βία.
                </li>
              </ul>
            </>
          )
        },
        {
          id: "maintenance",
          heading: "2. Προγραμματισμένη Συντήρηση",
          body: (
            <>
              <ul>
                <li>
                  <strong>Παράθυρα συντήρησης:</strong> Κυριακές, 03:00–06:00 (ώρα
                  Ελλάδος). Ανακοινώνονται τουλάχιστον 48 ώρες πριν.
                </li>
                <li>
                  Επείγουσες ενημερώσεις ασφαλείας ενδέχεται να απαιτήσουν διακοπή
                  εκτός των παραθύρων· ανακοινώνονται όσο νωρίτερα είναι πρακτικά
                  εφικτό.
                </li>
              </ul>
            </>
          )
        },
        {
          id: "support",
          heading: "3. Χρόνοι Απόκρισης Υποστήριξης",
          body: (
            <>
              <p>
                Οι χρόνοι απόκρισης μετρώνται από τη λήψη του αιτήματος στο
                <a href="mailto:info@mykalypsis.gr"> info@mykalypsis.gr</a> ή μέσω
                της φόρμας υποστήριξης εντός της Πλατφόρμας.
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <thead>
                  <tr style={{ background: "#f5f7fa" }}>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Σοβαρότητα</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Ορισμός</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Απόκριση</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Επίλυση*</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}><strong>Critical</strong></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Πλήρης διακοπή, απώλεια δεδομένων</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>≤ 2 εργάσιμες ώρες</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>≤ 8 ώρες</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}><strong>High</strong></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Σοβαρή δυσλειτουργία, workaround δύσκολο</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>≤ 4 εργάσιμες ώρες</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>≤ 2 εργάσιμες ημέρες</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}><strong>Medium</strong></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Δυσλειτουργία με workaround</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>≤ 1 εργάσιμη ημέρα</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Επόμενη έκδοση</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 8 }}><strong>Low</strong></td>
                    <td style={{ padding: 8 }}>Ερώτηση, cosmetic bug, feature request</td>
                    <td style={{ padding: 8 }}>≤ 2 εργάσιμες ημέρες</td>
                    <td style={{ padding: 8 }}>Roadmap</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                * Χρόνοι στοχευόμενοι, όχι εγγυημένοι — εξαρτώνται από την πολυπλοκότητα.
              </p>
              <p>
                <strong>Ώρες υποστήριξης:</strong> Δευτέρα–Παρασκευή, 09:00–18:00 (ώρα
                Ελλάδος), εξαιρουμένων επίσημων αργιών. Critical incidents
                εξυπηρετούνται 24/7 μέσω on-call.
              </p>
            </>
          )
        },
        {
          id: "backups",
          heading: "4. Αντίγραφα Ασφαλείας (Backups)",
          body: (
            <>
              <ul>
                <li>
                  <strong>Συχνότητα:</strong> Αυτόματα καθημερινά backup σε ξεχωριστή
                  γεωγραφική περιοχή της ΕΕ.
                </li>
                <li>
                  <strong>RPO (Recovery Point Objective):</strong> ≤ 24 ώρες.
                  Δηλαδή, σε περίπτωση απώλειας μπορεί να χαθούν μέχρι 24 ώρες
                  δεδομένων.
                </li>
                <li>
                  <strong>RTO (Recovery Time Objective):</strong> ≤ 4 ώρες για
                  restore από backup, μετά από απόφαση restore.
                </li>
                <li>
                  <strong>Διατήρηση backup:</strong> 30 ημέρες κυλιόμενα daily, 12
                  μήνες monthly snapshot.
                </li>
                <li>
                  Ο Πελάτης έχει επίσης δυνατότητα <strong>self-service backup</strong>
                  ανά πάσα στιγμή μέσω της σελίδας «Αντίγραφα ασφαλείας» της
                  Πλατφόρμας.
                </li>
              </ul>
            </>
          )
        },
        {
          id: "credits",
          heading: "5. Πιστώσεις για Παραβίαση Στόχων",
          body: (
            <>
              <p>
                Αν η μηνιαία διαθεσιμότητα πέσει κάτω από το εγγυημένο 99,5%, ο
                Πελάτης δικαιούται τις παρακάτω πιστώσεις υπολογιζόμενες επί του
                μηνιαίου ποσοστού της Συνδρομής:
              </p>
              <ul>
                <li>Διαθεσιμότητα 99,0% – 99,5%: <strong>10%</strong> πίστωση</li>
                <li>Διαθεσιμότητα 95,0% – 99,0%: <strong>25%</strong> πίστωση</li>
                <li>Διαθεσιμότητα κάτω από 95,0%: <strong>50%</strong> πίστωση</li>
              </ul>
              <p>
                Οι πιστώσεις πρέπει να ζητηθούν εγγράφως εντός 30 ημερών από το τέλος
                του επηρεαζόμενου μήνα και εφαρμόζονται στο επόμενο τιμολόγιο. Δεν
                μετατρέπονται σε επιστροφή χρημάτων.
              </p>
            </>
          )
        },
        {
          id: "monitoring",
          heading: "6. Παρακολούθηση & Διαφάνεια",
          body: (
            <p>
              Ο Πάροχος παρακολουθεί τη διαθεσιμότητα με external monitors 24/7 και
              δημοσιεύει τα σχετικά μετρικά σε δημόσια <strong>Status Page</strong>
              διαθέσιμη μέσω της Πλατφόρμας. Ιστορικό incidents και post-mortems
              διατηρούνται τουλάχιστον 12 μήνες.
            </p>
          )
        },
        {
          id: "exclusions",
          heading: "7. Εξαιρέσεις",
          body: (
            <p>
              Η SLA δεν καλύπτει: (α) διακοπές λόγω ενεργειών του Πελάτη ή των
              Χρηστών του (π.χ. εσφαλμένη διαγραφή δεδομένων), (β) διακοπές λόγω
              μη-καταβολής συνδρομής (suspend for non-payment), (γ) beta features
              που έχουν χαρακτηριστεί ως πειραματικές, (δ) διακοπές τρίτων παρόχων
              (τραπεζικά APIs, ΜyDATA, ασφαλιστικές εταιρείες) που ενσωματώνει η
              Πλατφόρμα.
            </p>
          )
        }
      ]}
    />
  );
}
