import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Records of Processing Activities (RoPA) — GDPR Άρθρο 30.
// Εσωτερικό μητρώο δραστηριοτήτων επεξεργασίας που πρέπει να τηρεί κάθε
// controller/processor. Δημοσιεύεται ημι-δημόσια εδώ για διαφάνεια — η
// ΑΠΔΠΧ μπορεί να ζητήσει αντίγραφο σε έλεγχο.

export function RopaPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.ropa.eyebrow", "GDPR Άρθρο 30")}
      title={t("legal.ropa.title", "Μητρώο Δραστηριοτήτων Επεξεργασίας (RoPA)")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Το παρόν αποτελεί το Μητρώο Δραστηριοτήτων Επεξεργασίας (Record of
          Processing Activities) της Kalypsis, όπως απαιτείται από το Άρθρο 30
          GDPR. Καλύπτει τη δραστηριότητα του Παρόχου <strong>και ως Υπεύθυνου
          Επεξεργασίας</strong> (για τα δεδομένα των γραφείων-πελατών) <strong>και
          ως Εκτελούντος την Επεξεργασία</strong> (για τα δεδομένα των ασφαλισμένων
          που εισάγει το κάθε γραφείο).
        </p>
      }
      sections={[
        {
          id: "controller",
          heading: "1. Στοιχεία Υπευθύνου Επεξεργασίας",
          body: (
            <ul>
              <li><strong>Επωνυμία:</strong> Παναγιώτης Κοτσοργιός — Kalypsis</li>
              <li><strong>ΑΦΜ:</strong> 176091030 (ΔΟΥ Μεσολογγίου)</li>
              <li><strong>Έδρα:</strong> Εργατικές Κατοικίες Λιμάνι Μεσολογγίου 113, 30200 Μεσολόγγι</li>
              <li><strong>DPO Contact:</strong> <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a></li>
            </ul>
          )
        },
        {
          id: "activity-1",
          heading: "2. Δραστηριότητα Α — Δεδομένα Γραφείων-Πελατών (Controller Role)",
          body: (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <tbody>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", width: "35%", fontWeight: 700 }}>Σκοπός</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Παροχή υπηρεσίας SaaS στα γραφεία, τιμολόγηση, υποστήριξη, νομικές υποχρεώσεις.</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Νομική βάση</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Άρθρο 6§1(β) εκτέλεση σύμβασης, 6§1(γ) νομική υποχρέωση, 6§1(στ) έννομο συμφέρον.</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Κατηγορίες υποκειμένων</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Χρήστες γραφείων (AgencyAdmin, AgencyUser, Producer), υπεύθυνοι επικοινωνίας.</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Κατηγορίες δεδομένων</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Ονοματεπώνυμο, email, τηλέφωνο, ΑΦΜ γραφείου, IP διεύθυνση, ημερομηνίες συνδέσεων, credentials (hashed).</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Αποδέκτες</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Hetzner (hosting), Brevo (transactional email). Λίστα στη σελίδα «Sub-processors».</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Διαβίβαση εκτός ΕΟΧ</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Καμία τακτική διαβίβαση. Έκτακτες με SCCs.</td></tr>
                  <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Διάρκεια διατήρησης</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Ενεργή συνδρομή + 90 ημέρες. Φορολογικά δεδομένα έως 10 έτη (Ν.4308/2014). Logs 12 μήνες.</td></tr>
                  <tr><td style={{ padding: 8, fontWeight: 700 }}>Τεχνικά μέτρα</td><td style={{ padding: 8 }}>Passwords BCrypt, TLS 1.3, 2FA, rate limiting, IP blocking, security headers, ClamAV στα uploads.</td></tr>
                </tbody>
              </table>
            </>
          )
        },
        {
          id: "activity-2",
          heading: "3. Δραστηριότητα Β — Δεδομένα Ασφαλισμένων (Processor Role)",
          body: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <tbody>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", width: "35%", fontWeight: 700 }}>Σκοπός</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Αποκλειστικά για την εκτέλεση εντολών του γραφείου-Controller (Άρθρο 28 GDPR).</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Νομική βάση</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>DPA v1.0 μεταξύ Παρόχου και κάθε Πελάτη-Γραφείου.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Κατηγορίες υποκειμένων</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Πελάτες γραφείων (ασφαλισμένοι), συνεργάτες-παραγωγοί, οδηγοί, δικαιούχοι.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Κατηγορίες δεδομένων</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Στοιχεία ταυτότητας, ΑΜΚΑ, ΑΦΜ, IBAN, επικοινωνία, ασφαλιστικά. Ειδικές κατηγορίες (Άρθρο 9): δεδομένα υγείας για Ζωής/Υγείας συμβόλαια βάσει ρητής συγκατάθεσης.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Αποδέκτες</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Hetzner, Brevo. Καμία απευθείας διαβίβαση σε ασφαλιστικές — τα αρχεία τα εξάγει και τα ανεβάζει το ίδιο το γραφείο.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Διαβίβαση εκτός ΕΟΧ</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Καμία.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Διάρκεια διατήρησης</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Καθορίζεται από το κάθε γραφείο-Controller. Ελάχιστο 90 ημέρες μετά τη λήξη συνδρομής (window εξαγωγής).</td></tr>
                <tr><td style={{ padding: 8, fontWeight: 700 }}>Τεχνικά μέτρα</td><td style={{ padding: 8 }}>Application-level AES-256-GCM για ΑΜΚΑ, ταυτότητα, διαβατήριο, δίπλωμα, IBAN, integration secrets. Anonymization workflow, GDPR erasure requests.</td></tr>
              </tbody>
            </table>
          )
        },
        {
          id: "activity-3",
          heading: "4. Δραστηριότητα Γ — Δημόσια Ιστοσελίδα",
          body: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <tbody>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", width: "35%", fontWeight: 700 }}>Σκοπός</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Πληροφόρηση επισκεπτών, φόρμα επικοινωνίας, εγγραφή για δοκιμή.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Νομική βάση</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Συγκατάθεση (cookies), έννομο συμφέρον.</td></tr>
                <tr><td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 700 }}>Κατηγορίες δεδομένων</td><td style={{ padding: 8, borderBottom: "1px solid #eee" }}>IP διεύθυνση, cookies, στοιχεία φόρμας επικοινωνίας.</td></tr>
                <tr><td style={{ padding: 8, fontWeight: 700 }}>Διάρκεια</td><td style={{ padding: 8 }}>Cookies κατά την Πολιτική Cookies. Newsletter subscriptions μέχρι ανάκληση.</td></tr>
              </tbody>
            </table>
          )
        },
        {
          id: "rights",
          heading: "5. Άσκηση Δικαιωμάτων Υποκειμένων",
          body: (
            <p>
              Αιτήματα άσκησης δικαιωμάτων (Άρθρα 15-22 GDPR) διεκπεραιώνονται
              μέσω της σελίδας «GDPR Ενέργειες» εντός της Πλατφόρμας ή με email
              στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>.
              Χρόνος απόκρισης ≤ 30 ημέρες.
            </p>
          )
        }
      ]}
    />
  );
}
