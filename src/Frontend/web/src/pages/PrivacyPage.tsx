import { Box, Container, Divider, Link, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { PublicFooter } from "../components/PublicFooter";
import { AccessibilityWidget } from "../components/AccessibilityWidget";
import { LanguageToggle } from "../components/LanguageToggle";

/**
 * Public privacy notice for Kalypsis.
 *
 * This follows a simple, document-first public layout while using Kalypsis-
 * specific wording and correctly distinguishing the office's controller role
 * from Kalypsis' processor role for office-entered customer data.
 */
export function PrivacyPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff", color: "#182230" }}>
      <Box component="header" sx={{ borderBottom: "1px solid #e5e7eb", bgcolor: "#fff" }}>
        <Container maxWidth="lg" sx={{ py: 1.25, px: { xs: 2, md: 4 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={{ xs: 0.75, sm: 2 }}>
            <Typography variant="body2" sx={{ color: "#536174", fontWeight: 600 }}>
              Kalypsis · Πλατφόρμα διαχείρισης ασφαλιστικού γραφείου
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 2 }}>
              <Link href="tel:+302631028971" underline="hover" sx={{ color: "#536174", display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 13 }}>
                <PhoneOutlinedIcon sx={{ fontSize: 16 }} /> 2631028971
              </Link>
              <Link href="mailto:info@mykalypsis.gr" underline="hover" sx={{ color: "#536174", display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 13 }}>
                <EmailOutlinedIcon sx={{ fontSize: 16 }} /> info@mykalypsis.gr
              </Link>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 2.5, md: 4 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Link component={RouterLink} to="/" underline="hover" sx={{ color: "#0b4b8a", display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 13, fontWeight: 700 }}>
            <ArrowBackIcon sx={{ fontSize: 17 }} /> Επιστροφή στην αρχική
          </Link>
          <LanguageToggle />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.5, md: 3 }} alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 3 }}>
          <Box component="img" src="/kalypsis-logo.png" alt="Kalypsis" sx={{ width: { xs: 118, md: 148 }, height: { xs: 48, md: 60 }, objectFit: "contain", objectPosition: "left center" }} />
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: 27, md: 34 }, lineHeight: 1.15, fontWeight: 800, color: "#0b2545" }}>
              Πολιτική Απορρήτου
            </Typography>
            <Typography sx={{ mt: 0.5, color: "#5e6b7c", fontSize: { xs: 14, md: 16 } }}>
              Πολιτική Προστασίας Προσωπικών Δεδομένων
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ maxWidth: 920 }}>
          <Typography sx={{ color: "#5e6b7c", fontSize: 13, mb: 2.5 }}>
            Τελευταία ενημέρωση: 9 Οκτωβρίου 2026 · Έκδοση 1.0
          </Typography>

          <Typography component="p" sx={{ fontSize: 16, lineHeight: 1.8, mb: 2.5 }}>
            Η Kalypsis σέβεται την ιδιωτικότητα των επισκεπτών, των χρηστών και των
            ασφαλιστικών γραφείων που χρησιμοποιούν την πλατφόρμα. Η παρούσα πολιτική
            εξηγεί ποια δεδομένα μπορεί να συλλέγουμε, για ποιον σκοπό τα χρησιμοποιούμε,
            πώς τα προστατεύουμε και ποια δικαιώματα έχετε.
          </Typography>

          <PolicySection title="Ποια δεδομένα συλλέγουμε">
            <p>Συλλέγουμε μόνο τα δεδομένα που είναι απαραίτητα για τη συγκεκριμένη χρήση της υπηρεσίας και που μας δίνετε εσείς ή το ασφαλιστικό γραφείο σας, όπως:</p>
            <ul>
              <li>όνομα, email, τηλέφωνο, στοιχεία λογαριασμού και στοιχεία σύνδεσης,</li>
              <li>στοιχεία γραφείου, χρηστών, πελατών, συνεργατών, συμβολαίων, οχημάτων, ζημιών, οικονομικών κινήσεων και εγγράφων που καταχωρίζει το γραφείο,</li>
              <li>δεδομένα επικοινωνίας, συγκαταθέσεων, παραδόσεων, υπογραφών και αιτημάτων υποστήριξης,</li>
              <li>τεχνικά στοιχεία λειτουργίας, όπως διεύθυνση IP, χρόνος σύνδεσης, τύπος συσκευής, αρχεία ελέγχου και βασικά στοιχεία ασφάλειας.</li>
            </ul>
            <p>Τα στοιχεία υγείας ή άλλα ειδικά δεδομένα κατηγορίας επεξεργάζονται μόνο όταν υπάρχει νόμιμη βάση και η απαραίτητη εντολή ή συγκατάθεση. Η διεύθυνση, το τηλέφωνο και το ΑΦΜ δεν είναι από μόνα τους «ευαίσθητα» δεδομένα κατά GDPR.</p>
          </PolicySection>

          <PolicySection title="Γιατί χρησιμοποιούμε τα δεδομένα">
            <ul>
              <li>Για να δημιουργούμε και να λειτουργούμε τους λογαριασμούς και τις υπηρεσίες που ζητάτε.</li>
              <li>Για διαχείριση πελατών, συμβολαίων, εγγράφων, παραγωγής, ζημιών, οικονομικών και επικοινωνιών του γραφείου.</li>
              <li>Για ασφάλεια, έλεγχο πρόσβασης, πρόληψη κακόβουλης χρήσης, υποστήριξη, αντίγραφα ασφαλείας και αποκατάσταση.</li>
              <li>Για χρεώσεις, λογιστικές ή φορολογικές υποχρεώσεις και συμμόρφωση με νόμιμα αιτήματα αρχών.</li>
              <li>Για ενημερωτικά ή εμπορικά μηνύματα μόνο όταν υπάρχει κατάλληλη συγκατάθεση και δυνατότητα ανάκλησης.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Νόμιμη βάση επεξεργασίας">
            <p>Η επεξεργασία βασίζεται, ανάλογα με την περίπτωση, στην εκτέλεση σύμβασης ή αιτήματος υπηρεσίας, στη συμμόρφωση με νομική υποχρέωση, στο έννομο συμφέρον για την ασφάλεια και λειτουργία της πλατφόρμας ή στη συγκατάθεσή σας. Η συγκατάθεση μπορεί να ανακληθεί οποτεδήποτε, χωρίς να επηρεάζεται η νομιμότητα της επεξεργασίας που προηγήθηκε.</p>
          </PolicySection>

          <PolicySection title="Ο ρόλος του ασφαλιστικού γραφείου">
            <p>Το γραφείο που χρησιμοποιεί την Kalypsis αποφασίζει γιατί και με ποιον τρόπο χρησιμοποιεί τα δεδομένα των δικών του πελατών και συνήθως ενεργεί ως υπεύθυνος επεξεργασίας. Η Kalypsis παρέχει την τεχνική πλατφόρμα και ενεργεί ως εκτελών την επεξεργασία σύμφωνα με τις οδηγίες του γραφείου και τη σχετική συμφωνία επεξεργασίας. Για αίτημα που αφορά συγκεκριμένο ασφαλιστικό γραφείο, μπορεί να χρειαστεί να απευθυνθείτε και στο ίδιο το γραφείο.</p>
          </PolicySection>

          <PolicySection title="Με ποιους μοιραζόμαστε δεδομένα">
            <p>Δεν πουλάμε προσωπικά δεδομένα. Μπορεί να χρησιμοποιούμε επιλεγμένους τεχνικούς συνεργάτες για φιλοξενία, αποθήκευση, αποστολή email ή SMS, ασφάλεια, υποστήριξη και επεξεργασία πληρωμών, μόνο στον βαθμό που απαιτείται για την υπηρεσία και με κατάλληλες συμβατικές και οργανωτικές εγγυήσεις.</p>
            <p>Δεδομένα μπορεί να γνωστοποιηθούν σε δημόσιες αρχές ή άλλους αποδέκτες όταν αυτό απαιτείται από νόμο, δικαστική εντολή ή νόμιμο αίτημα. Δεν δίνουμε δεδομένα σε τρίτους για δικούς τους εμπορικούς σκοπούς.</p>
          </PolicySection>

          <PolicySection title="Ασφάλεια και διατήρηση">
            <p>Λαμβάνουμε τεχνικά και οργανωτικά μέτρα, όπως κρυπτογράφηση όπου εφαρμόζεται, έλεγχο δικαιωμάτων, απομόνωση γραφείων, καταγραφή ενεργειών, αντίγραφα ασφαλείας και διαδικασίες αποκατάστασης. Κανένα σύστημα δεν μπορεί να εγγυηθεί απόλυτη ασφάλεια, γι’ αυτό ενημερώστε μας άμεσα αν υποψιάζεστε παραβίαση.</p>
            <p>Διατηρούμε τα δεδομένα μόνο για όσο χρειάζονται για τον σκοπό τους, τη λειτουργία του λογαριασμού, την επίλυση διαφορών ή τη συμμόρφωση με νόμιμες υποχρεώσεις. Μετά διαγράφονται ή ανωνυμοποιούνται, σύμφωνα με τις ισχύουσες διαδικασίες και τις οδηγίες του γραφείου.</p>
          </PolicySection>

          <PolicySection title="Τα δικαιώματά σας">
            <p>Μπορείτε, όπου εφαρμόζεται, να ζητήσετε πρόσβαση, διόρθωση, διαγραφή, περιορισμό της επεξεργασίας, φορητότητα ή να αντιταχθείτε σε συγκεκριμένη επεξεργασία. Μπορείτε επίσης να ανακαλέσετε συγκατάθεση και να υποβάλετε καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.</p>
            <p>Για αίτημα ή απορία επικοινωνήστε στο <a href="mailto:info@mykalypsis.gr">info@mykalypsis.gr</a>. Θα ζητήσουμε μόνο τα στοιχεία που είναι απαραίτητα για την επιβεβαίωση της ταυτότητάς σας και θα απαντήσουμε μέσα στις νόμιμες προθεσμίες.</p>
          </PolicySection>

          <PolicySection title="Σύνδεσμοι τρίτων και cookies">
            <p>Η πλατφόρμα μπορεί να περιέχει συνδέσμους προς ιστοσελίδες ή υπηρεσίες τρίτων. Η Kalypsis δεν ελέγχει τις δικές τους πολιτικές απορρήτου· πριν δώσετε στοιχεία, μελετήστε τους σχετικούς όρους. Για cookies και παρόμοιες τεχνολογίες δείτε την <a href="/cookies">Πολιτική Cookies</a>.</p>
          </PolicySection>

          <PolicySection title="Ενημερώσεις της πολιτικής">
            <p>Μπορεί να τροποποιούμε την παρούσα πολιτική όταν αλλάζει η υπηρεσία, οι συνεργάτες ή η νομοθεσία. Η νέα έκδοση θα δημοσιεύεται σε αυτή τη σελίδα με νέα ημερομηνία. Για ουσιώδεις αλλαγές θα ενημερώνουμε τους χρήστες με πρόσθετο τρόπο όπου απαιτείται.</p>
          </PolicySection>

          <Box sx={{ mt: 4, pt: 2.5, borderTop: "1px solid #e5e7eb", color: "#536174", fontSize: 13 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.75, sm: 2 }}>
              <span>© {new Date().getFullYear()} Kalypsis</span>
              <Link href="https://mykalypsis.gr" target="_blank" rel="noreferrer" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <LanguageOutlinedIcon sx={{ fontSize: 15 }} /> mykalypsis.gr
              </Link>
            </Stack>
          </Box>
        </Box>
      </Container>

      <PublicFooter />
      <AccessibilityWidget />

      <style>{`
        @media print {
          body { background: #fff !important; }
          [data-print="hide"], footer, header, aside,
          [role="button"][aria-label*="προσβασιμότητας"] { display: none !important; }
          .MuiContainer-root { max-width: 100% !important; padding: 0 !important; }
          h1, h2, p, li, a { color: #000 !important; }
          a { text-decoration: underline !important; }
        }
      `}</style>
    </Box>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 3.25 }}>
      <Typography component="h2" sx={{ fontSize: 19, lineHeight: 1.35, fontWeight: 800, color: "#0b2545", mb: 1.1 }}>
        {title}
      </Typography>
      <Box sx={{ fontSize: 15, lineHeight: 1.8, color: "#263445", "& p": { mt: 0, mb: 1.25 }, "& p:last-child": { mb: 0 }, "& ul, & ol": { mt: 0, mb: 1.25, pl: 3 }, "& li": { mb: 0.6 }, "& a": { color: "#0b4b8a", fontWeight: 700, textDecoration: "underline", "&:hover": { textDecoration: "none" } } }}>
        {children}
      </Box>
    </Box>
  );
}

export default PrivacyPage;
