import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Sub-processor list — δημόσια σελίδα με όλους τους τρίτους παρόχους που η
// Kalypsis χρησιμοποιεί για να παρέχει την υπηρεσία στα γραφεία. GDPR Άρθρο
// 28 §2, 4 απαιτεί ρητή εξουσιοδότηση για κάθε sub-processor και 30-day
// notice όταν προστίθεται ή αντικαθίσταται. Το ιστορικό αλλαγών (change log)
// τηρείται στο κάτω μέρος για audit trail.

export function SubProcessorsPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.subprocessors.eyebrow", "GDPR Άρθρο 28")}
      title={t("legal.subprocessors.title", "Λίστα Sub-processors")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Η Kalypsis, ως Εκτελών την Επεξεργασία, χρησιμοποιεί τους παρακάτω
          εξωτερικούς παρόχους («<strong>Sub-processors</strong>») για την παροχή
          της υπηρεσίας προς τα γραφεία-πελάτες. Η πλήρης λίστα δημοσιεύεται εδώ
          και επικαιροποιείται πριν από κάθε προσθήκη/αντικατάσταση με ελάχιστη
          προειδοποίηση 30 ημερών προς τους πελάτες.
        </p>
      }
      sections={[
        {
          id: "current",
          heading: "1. Τρέχοντες Sub-processors",
          body: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr style={{ background: "#f5f7fa" }}>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Πάροχος</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Σκοπός</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Τοποθεσία</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Ενσωμάτωση από</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <strong>Hetzner Online GmbH</strong><br />
                    <small>μέσω Coolify</small>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Φιλοξενία εφαρμογής, βάσης δεδομένων, αντιγράφων ασφαλείας</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Γερμανία (ΕΟΧ)</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Ίδρυση Πλατφόρμας</td>
                </tr>
                <tr>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <strong>Sendinblue SA (Brevo)</strong>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Αποστολή transactional email (επαλήθευση, reset password, ειδοποιήσεις)</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Γαλλία (ΕΟΧ)</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Ίδρυση Πλατφόρμας</td>
                </tr>
              </tbody>
            </table>
          )
        },
        {
          id: "notification",
          heading: "2. Διαδικασία Ενημέρωσης για Αλλαγές",
          body: (
            <>
              <p>
                Κάθε αλλαγή στην ανωτέρω λίστα ανακοινώνεται στους πελάτες
                τουλάχιστον <strong>30 ημερολογιακές ημέρες</strong> πριν την
                έναρξη ισχύος:
              </p>
              <ul>
                <li>Email στους AgencyAdmins όλων των ενεργών γραφείων.</li>
                <li>Ειδοποίηση εντός της Πλατφόρμας.</li>
                <li>Ενημέρωση της παρούσας σελίδας με νέα ημερομηνία.</li>
              </ul>
              <p>
                Ο Πελάτης δύναται να υποβάλει ένσταση εντός των 30 ημερών με email
                στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>. Αν
                δεν εξευρεθεί αμοιβαία λύση, δικαιούται να καταγγείλει τη Σύμβαση
                αζημίως.
              </p>
            </>
          )
        },
        {
          id: "obligations",
          heading: "3. Υποχρεώσεις Kalypsis έναντι κάθε Sub-processor",
          body: (
            <p>
              Η Kalypsis έχει συνάψει έγγραφη σύμβαση επεξεργασίας δεδομένων
              (DPA) με κάθε sub-processor, η οποία επιβάλλει ισοδύναμες
              υποχρεώσεις προστασίας δεδομένων όπως εκείνες που εμείς αναλαμβάνουμε
              έναντι των Πελατών μας. Οι σχετικές συμβάσεις είναι διαθέσιμες προς
              εξέταση κατόπιν αιτήματος από Πελάτη, στο πλαίσιο audit rights
              (§13 DPA).
            </p>
          )
        },
        {
          id: "changelog",
          heading: "4. Ιστορικό Αλλαγών (Change Log)",
          body: (
            <ul>
              <li>
                <strong>16 Ιουλίου 2026</strong> — Δημοσίευση αρχικής έκδοσης της
                σελίδας.
              </li>
            </ul>
          )
        }
      ]}
    />
  );
}
