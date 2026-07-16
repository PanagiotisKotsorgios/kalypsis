import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

// Data Retention Schedule — GDPR Άρθρο 5(1)(ε) storage limitation.
// Επίσημος ενοποιημένος πίνακας διατήρησης ανά τύπο δεδομένων, με νομικές
// αναφορές. Συμπληρώνει τη Πολιτική Απορρήτου (γενική) και τη DPA (§12
// διαγραφή μετά τη λήξη σύμβασης).

// Reusable inline styles για τον πίνακα — ενσωμάτωση σε LegalShell body JSX.
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "2px solid #0b2545",
  background: "#f5f7fa",
  fontSize: 12.5,
  verticalAlign: "top"
};
const td: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  fontSize: 12.5,
  verticalAlign: "top"
};

function RetentionTable({ rows }: {
  rows: Array<{ category: string; retention: string; basis: string; action: string }>
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead>
        <tr>
          <th style={{ ...th, width: "30%" }}>Κατηγορία Δεδομένων</th>
          <th style={{ ...th, width: "18%" }}>Περίοδος Διατήρησης</th>
          <th style={{ ...th, width: "27%" }}>Νομική Βάση Περιόδου</th>
          <th style={th}>Ενέργεια μετά τη Λήξη</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}><strong>{r.category}</strong></td>
            <td style={td}>{r.retention}</td>
            <td style={td}>{r.basis}</td>
            <td style={td}>{r.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DataRetentionPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.retention.eyebrow", "GDPR Άρθρο 5(1)(ε)")}
      title={t("legal.retention.title", "Πίνακας Διατήρησης Δεδομένων")}
      lastUpdated={t("legal.lastUpdated", { date: "16 Ιουλίου 2026" })}
      intro={
        <p>
          Ο παρών Πίνακας ορίζει τις περιόδους διατήρησης κάθε κατηγορίας
          δεδομένων που επεξεργάζεται η Πλατφόρμα Kalypsis, σύμφωνα με την αρχή
          του περιορισμού διατήρησης του Άρθρου 5(1)(ε) GDPR. Η διατήρηση
          ορίζεται ως το ελάχιστο αναγκαίο για την επίτευξη του σκοπού
          επεξεργασίας, εκτός αν εκτενέστερη περίοδος επιβάλλεται από νόμο.
        </p>
      }
      sections={[
        {
          id: "scope",
          heading: "1. Πεδίο & Δομή",
          body: (
            <>
              <p>Ο Πίνακας διακρίνει δύο επίπεδα ελέγχου:</p>
              <ul>
                <li>
                  <strong>Kalypsis-controlled:</strong> δεδομένα που η ίδια η
                  Kalypsis διαχειρίζεται ως controller ή processor στο τεχνικό
                  επίπεδο (audit logs, sessions, χρήστες γραφείων).
                </li>
                <li>
                  <strong>Tenant-controlled:</strong> δεδομένα ασφαλισμένων που
                  ανήκουν στο γραφείο-controller — η Kalypsis τα αποθηκεύει
                  βάσει DPA και τα διαγράφει μετά από εντολή του γραφείου ή τη
                  λήξη της συνδρομής.
                </li>
              </ul>
            </>
          )
        },
        {
          id: "kalypsis-data",
          heading: "2. Kalypsis-Controlled Δεδομένα",
          body: (
            <RetentionTable rows={[
              {
                category: "Λογαριασμοί χρηστών γραφείου (AgencyAdmin/User/Producer)",
                retention: "Διάρκεια συνδρομής + 90 ημ.",
                basis: "Εκτέλεση σύμβασης (MSA §4)",
                action: "Anonymization — email γίνεται anon-XXX@example.invalid"
              },
              {
                category: "Refresh tokens (JWT)",
                retention: "30 ημέρες",
                basis: "Ασφάλεια session — βλ. Jwt:RefreshTokenDays",
                action: "Οριστική διαγραφή από RefreshTokens table"
              },
              {
                category: "Password reset tokens",
                retention: "24 ώρες",
                basis: "Ασφάλεια — αποφυγή brute force",
                action: "Διαγραφή· ο χρήστης ξαναζητά link αν χρειαστεί"
              },
              {
                category: "Failed login attempts / IP blocks",
                retention: "24-48 ώρες κυλιόμενα",
                basis: "Ασφάλεια — anti-brute-force",
                action: "Αυτόματη διαγραφή από IpBlockService"
              },
              {
                category: "AuditLog (RequestAuditFilter)",
                retention: "12 μήνες",
                basis: "Ισοζύγιο ασφάλειας vs GDPR minimization",
                action: "Αυτόματη διαγραφή από RetentionCleanupJob"
              },
              {
                category: "Notification (read) — in-app",
                retention: "6 μήνες",
                basis: "Έχει ήδη ενημερωθεί ο χρήστης",
                action: "Αυτόματη διαγραφή από RetentionCleanupJob"
              },
              {
                category: "Notification (unread)",
                retention: "Έως να διαβαστούν + 12 μήνες",
                basis: "Λειτουργική ανάγκη · fallback στα 12 μήνες",
                action: "Ίδιο pattern με τα read"
              },
              {
                category: "CommunicationLog (SMS/Email history)",
                retention: "24 μήνες",
                basis: "Νόμος 4624/2019 · δικαίωμα απόδειξης · Ν. 4557/2018 (AML)",
                action: "Αυτόματη διαγραφή από RetentionCleanupJob"
              },
              {
                category: "Support tickets",
                retention: "5 έτη",
                basis: "Γενική παραγραφή αξιώσεων · παράπονα-policy",
                action: "Anonymization του αιτούντος, τεκμηρίωση κρατείται"
              },
              {
                category: "DPA / MSA acceptance records",
                retention: "Ενεργή συνδρομή + 6 έτη",
                basis: "Απόδειξη νόμιμης βάσης επεξεργασίας · παραγραφή",
                action: "Anonymization user reference, καταγραφή διατηρείται"
              },
              {
                category: "Data Breach Registry",
                retention: "6 έτη από κλείσιμο περιστατικού",
                basis: "GDPR Art. 33 §5 · έλεγχος ΑΠΔΠΧ",
                action: "Οριστική διαγραφή"
              },
              {
                category: "GDPR Erasure / DSAR Requests",
                retention: "6 έτη μετά την ολοκλήρωση",
                basis: "GDPR Art. 12 §6 · απόδειξη ανταπόκρισης",
                action: "Anonymization αιτούντος, τεκμηρίωση διατηρείται"
              },
              {
                category: "Consent records",
                retention: "Ενεργή σχέση + 3 έτη μετά την ανάκληση",
                basis: "GDPR Art. 7 §1 · απόδειξη νόμιμης βάσης",
                action: "Οριστική διαγραφή του record"
              },
              {
                category: "DataProtection master key",
                retention: "Έως χειροκίνητη rotation",
                basis: "Ασφάλεια · Άρθρο 32 GDPR",
                action: "Διαγραφή από Coolify env — re-encryption των δεδομένων"
              }
            ]} />
          )
        },
        {
          id: "tenant-data",
          heading: "3. Tenant-Controlled Δεδομένα (Δεδομένα Ασφαλισμένων)",
          body: (
            <>
              <p>
                Για τα δεδομένα των ασφαλισμένων, το κάθε γραφείο-controller
                ορίζει τη δική του πολιτική διατήρησης εντός των νομικών
                υποχρεώσεων. Οι παρακάτω περίοδοι είναι <strong>ελάχιστες
                υποχρεωτικές</strong> κατά την Ελληνική νομοθεσία:
              </p>
              <RetentionTable rows={[
                {
                  category: "Πελάτες (Customers)",
                  retention: "10 έτη από τη λήξη της τελευταίας ασφαλιστικής σχέσης",
                  basis: "Ν. 4308/2014 (φορολογικά) · Ν. 4557/2018 §13 (AML)",
                  action: "Anonymization από το γραφείο μέσω GDPR Actions"
                },
                {
                  category: "Ασφαλιστήρια συμβόλαια (Policies)",
                  retention: "10 έτη από τη λήξη",
                  basis: "Ν. 2496/1997 (ασφαλιστικές συμβάσεις) · Ν. 4308/2014",
                  action: "Διαγραφή ή anonymization μαζί με τον πελάτη"
                },
                {
                  category: "Ζημιές (Claims)",
                  retention: "10 έτη από την οριστική τακτοποίηση",
                  basis: "ΑΚ 250 (παραγραφή 20 ετών ενδεχομένως) · Ν. 4308/2014",
                  action: "Anonymization ή διαγραφή"
                },
                {
                  category: "Εισπράξεις / Πληρωμές / Λογιστικές κινήσεις",
                  retention: "10 έτη",
                  basis: "Ν. 4308/2014 Άρθρο 5 · φορολογικά βιβλία",
                  action: "Οριστική διαγραφή μετά τα 10 έτη"
                },
                {
                  category: "Τιμολόγια / Παραστατικά",
                  retention: "10 έτη",
                  basis: "Ν. 4308/2014 · MyDATA",
                  action: "Διαγραφή μετά την περίοδο"
                },
                {
                  category: "Στοιχεία KYC/AML",
                  retention: "5 έτη από τη λήξη της σχέσης",
                  basis: "Ν. 4557/2018 Άρθρο 30 §1",
                  action: "Διαγραφή ή anonymization"
                },
                {
                  category: "Ανεβασμένα έγγραφα (PolicyDocument, attachments)",
                  retention: "Ίδια με το parent record",
                  basis: "Ν. 4308/2014 · MyDATA",
                  action: "Διαγραφή από object storage μαζί με το record"
                },
                {
                  category: "Δεδομένα υγείας (Ζωής/Υγείας συμβόλαια)",
                  retention: "10 έτη — απαραίτητα για ζημιές",
                  basis: "GDPR Art. 9 §2(β)(η) · Ν. 2496/1997",
                  action: "Anonymization ή διαγραφή με ρητή εντολή υποκειμένου"
                },
                {
                  category: "Επικοινωνία με πελάτη (email/SMS log)",
                  retention: "24 μήνες",
                  basis: "Απόδειξη επαγγελματικής επικοινωνίας",
                  action: "Ίδιο με CommunicationLog Kalypsis"
                }
              ]} />
            </>
          )
        },
        {
          id: "public-site",
          heading: "4. Δεδομένα Δημόσιας Ιστοσελίδας",
          body: (
            <RetentionTable rows={[
              {
                category: "Newsletter subscribers",
                retention: "Έως ανάκληση συνδρομής (unsubscribe)",
                basis: "Συγκατάθεση — GDPR Art. 6 §1(α)",
                action: "Οριστική διαγραφή από NewsletterSubscribers"
              },
              {
                category: "Φόρμα επικοινωνίας",
                retention: "12 μήνες",
                basis: "Έννομο συμφέρον follow-up",
                action: "Διαγραφή αν δεν έχει προκύψει σχέση συνδρομής"
              },
              {
                category: "Cookies λειτουργικά",
                retention: "1 έτος",
                basis: "ePrivacy · λειτουργική ανάγκη",
                action: "Λήξη cookie ή clear από browser"
              },
              {
                category: "Cookies analytics (αν ενεργοποιηθούν)",
                retention: "26 μήνες",
                basis: "Συγκατάθεση — βλ. Cookie Banner",
                action: "Λήξη· ανάκληση συγκατάθεσης = άμεση διαγραφή"
              },
              {
                category: "Cookies marketing (αν ενεργοποιηθούν)",
                retention: "13 μήνες",
                basis: "Συγκατάθεση — βλ. Cookie Banner",
                action: "Ίδιο · re-consent required"
              },
              {
                category: "Registration Requests (μη-εγκεκριμένες αιτήσεις)",
                retention: "6 μήνες από την υποβολή",
                basis: "Λειτουργική ανάγκη follow-up",
                action: "Αυτόματη διαγραφή αν δεν έχει εγκριθεί"
              }
            ]} />
          )
        },
        {
          id: "backups",
          heading: "5. Αντίγραφα Ασφαλείας",
          body: (
            <RetentionTable rows={[
              {
                category: "Καθημερινό backup (rolling)",
                retention: "30 ημέρες",
                basis: "Λειτουργική ανάγκη · restore capability",
                action: "Αυτόματη κύλιση — παλαιότερα διαγράφονται"
              },
              {
                category: "Μηνιαίο snapshot",
                retention: "12 μήνες",
                basis: "Long-term recovery",
                action: "Αυτόματη κύλιση"
              },
              {
                category: "Backups μετά την καταγγελία συνδρομής γραφείου",
                retention: "90 ημέρες export window + 90 ημέρες backup",
                basis: "DPA §12 · SLA §4",
                action: "Πλήρης διαγραφή μετά τα 180 ημ."
              }
            ]} />
          )
        },
        {
          id: "exceptions",
          heading: "6. Εξαιρέσεις (Legal Hold)",
          body: (
            <>
              <p>Οι παραπάνω περίοδοι <strong>παρατείνονται</strong> στις εξής περιπτώσεις:</p>
              <ul>
                <li>
                  <strong>Εκκρεμούσα ή επαπειλούμενη δίκη (litigation hold):</strong>{" "}
                  τα σχετικά δεδομένα διατηρούνται μέχρι το τελεσίδικο της δίκης
                  + 5 έτη.
                </li>
                <li>
                  <strong>Έλεγχος από αρμόδια αρχή</strong> (ΑΠΔΠΧ, ΤτΕ, ΑΑΔΕ):
                  διατήρηση όσο διαρκεί ο έλεγχος και μέχρι την οριστική περάτωσή του.
                </li>
                <li>
                  <strong>Ρητό αίτημα Πελάτη</strong> για διατήρηση συγκεκριμένου
                  φακέλου (πχ επαναλαμβανόμενο claim): τεκμηριώνεται εγγράφως.
                </li>
                <li>
                  <strong>Ενεργό ερευνητικό αίτημα</strong> από αρχές επιβολής
                  του νόμου βάσει δικαστικής παραγγελίας.
                </li>
              </ul>
              <p>
                Ο ενεργός legal hold καταγράφεται στο εσωτερικό μητρώο και
                αίρεται με ρητή απόφαση.
              </p>
            </>
          )
        },
        {
          id: "process",
          heading: "7. Διαδικασία Διαγραφής",
          body: (
            <ol>
              <li>
                <strong>Αυτόματα (batched):</strong> Το RetentionCleanupJob τρέχει
                κάθε 24 ώρες και σβήνει σε batches των 500 rows όσα rows έχουν
                ξεπεράσει το threshold τους (AuditLog, Notification, CommunicationLog).
              </li>
              <li>
                <strong>Ανά περιοδικά (manual):</strong> Ο PlatformAdmin ελέγχει
                σε εξαμηνιαία βάση την εφαρμογή της πολιτικής για δεδομένα που
                δεν καλύπτονται από αυτόματο job.
              </li>
              <li>
                <strong>Ανά αίτημα:</strong> Ρητή εντολή διαγραφής από
                υποκείμενο μέσω GDPR Erasure Request διεκπεραιώνεται εντός 30
                ημερών.
              </li>
              <li>
                <strong>Ασφαλής διαγραφή:</strong> Στα κρυπτογραφημένα columns
                (AES-256-GCM) η διαγραφή γίνεται με crypto-shredding — απώλεια
                κλειδιού καθιστά τα δεδομένα μη-ανακτήσιμα.
              </li>
              <li>
                <strong>Καταγραφή στο audit log:</strong> Κάθε mass deletion
                event καταγράφεται με timestamp, actor, category, count.
              </li>
            </ol>
          )
        },
        {
          id: "review",
          heading: "8. Παρακολούθηση & Επανεξέταση",
          body: (
            <p>
              Ο παρών Πίνακας επανεξετάζεται <strong>ετησίως</strong> από τον
              DPO στο πλαίσιο του compliance review. Ουσιώδεις μεταβολές
              (νέες περίοδοι, νέες κατηγορίες) ανακοινώνονται στους πελάτες
              μέσω email και ενημέρωσης της παρούσας σελίδας. Οι πελάτες
              διατηρούν το δικαίωμα ένστασης βάσει DPA §3 (Επεξεργασία με
              Εντολή του Πελάτη).
            </p>
          )
        },
        {
          id: "legal-basis",
          heading: "9. Πίνακας Νομικών Αναφορών",
          body: (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={th}>Πηγή</th>
                  <th style={th}>Αντικείμενο</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={td}>GDPR Άρθρο 5(1)(ε)</td><td style={td}>Αρχή περιορισμού διατήρησης</td></tr>
                <tr><td style={td}>GDPR Άρθρο 30 §1(στ)</td><td style={td}>Υποχρέωση καταγραφής περιόδων στο RoPA</td></tr>
                <tr><td style={td}>Ν. 4624/2019</td><td style={td}>Ελληνική εφαρμογή GDPR</td></tr>
                <tr><td style={td}>Ν. 4308/2014</td><td style={td}>Ελληνικά Λογιστικά Πρότυπα — 10ετία φορολογικών</td></tr>
                <tr><td style={td}>Ν. 2496/1997</td><td style={td}>Ασφαλιστική σύμβαση — παραγραφή 4 έτη</td></tr>
                <tr><td style={td}>Ν. 4557/2018</td><td style={td}>AML/KYC — 5 έτη</td></tr>
                <tr><td style={td}>Ν. 4583/2018</td><td style={td}>Insurance Distribution Directive</td></tr>
                <tr><td style={td}>ΑΚ 249, 250, 937</td><td style={td}>Γενική παραγραφή (20/5/2 έτη ανάλογα)</td></tr>
                <tr><td style={td}>ΠΔ 131/2003</td><td style={td}>Ηλεκτρονικό εμπόριο</td></tr>
                <tr><td style={td}>Οδηγία ePrivacy 2002/58/EΚ</td><td style={td}>Cookies retention</td></tr>
              </tbody>
            </table>
          )
        }
      ]}
    />
  );
}
