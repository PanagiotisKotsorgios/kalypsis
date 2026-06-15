import { Box, Card, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LegalShell } from "./LegalShell";

export function CookiesPage() {
  const { t } = useTranslation();

  return (
    <LegalShell
      eyebrow={t("legal.cookies.eyebrow")}
      title={t("legal.cookies.title")}
      lastUpdated={t("legal.lastUpdated", { date: "01 Ιουνίου 2026" })}
      intro={
        <p>
          Η Kalypsis χρησιμοποιεί cookies και παρόμοιες τεχνολογίες για την λειτουργία της
          Πλατφόρμας, τη βελτίωση της εμπειρίας σας και την κατανόηση της χρήσης της
          υπηρεσίας μας. Η παρούσα Πολιτική εξηγεί τι είναι τα cookies, ποια
          χρησιμοποιούμε και πώς μπορείτε να τα διαχειριστείτε.
        </p>
      }
      sections={[
        {
          id: "what",
          heading: "Τι είναι τα cookies",
          body: (
            <p>
              Τα cookies είναι μικρά αρχεία κειμένου που αποθηκεύονται στη συσκευή σας όταν
              επισκέπτεστε έναν ιστότοπο. Επιτρέπουν στον ιστότοπο να σας αναγνωρίσει σε
              επόμενες επισκέψεις, να αποθηκεύσει προτιμήσεις (π.χ. γλώσσα) και να
              συλλέξει ανώνυμα στατιστικά χρήσης.
            </p>
          )
        },
        {
          id: "categories",
          heading: "Κατηγορίες cookies που χρησιμοποιούμε",
          body: (
            <Stack spacing={2.5}>
              <CookieGroup
                title="Απολύτως απαραίτητα"
                strict
                description="Χωρίς αυτά τα cookies η Πλατφόρμα δεν λειτουργεί (π.χ. διατήρηση σύνδεσης, ασφάλεια)."
                items={[
                  { name: "kalypsis_auth", purpose: "Διατήρηση σύνδεσης χρήστη", duration: "Έως αποσύνδεση" },
                  { name: "kalypsis_lang", purpose: "Προτιμώμενη γλώσσα διεπαφής", duration: "1 έτος" },
                  { name: "kalypsis_cookie_consent", purpose: "Καταγραφή της επιλογής σας για cookies", duration: "12 μήνες" },
                  { name: "XSRF-TOKEN", purpose: "Προστασία από CSRF επιθέσεις", duration: "Συνεδρίας" }
                ]}
              />
              <CookieGroup
                title="Επιδόσεων & στατιστικών"
                description="Συλλέγουν ανώνυμες πληροφορίες για το πώς χρησιμοποιείτε την Πλατφόρμα ώστε να τη βελτιώνουμε."
                items={[
                  { name: "_pa_session", purpose: "Plausible Analytics – σύνοδος επίσκεψης", duration: "30 λεπτά" },
                  { name: "_pa_id", purpose: "Plausible Analytics – ανώνυμη αναγνώριση συσκευής", duration: "30 ημέρες" }
                ]}
              />
              <CookieGroup
                title="Λειτουργικά"
                description="Αποθηκεύουν προτιμήσεις σας για την προσωπική σας εμπειρία."
                items={[
                  { name: "kalypsis_theme", purpose: "Αποθήκευση επιλογής θέματος (φωτεινό/σκοτεινό)", duration: "12 μήνες" },
                  { name: "kalypsis_sidebar", purpose: "Κατάσταση πτυσσόμενης πλευρικής στήλης", duration: "30 ημέρες" }
                ]}
              />
              <CookieGroup
                title="Marketing"
                description="Χρησιμοποιούνται για την προβολή σχετικών διαφημίσεων εκτός της Πλατφόρμας. Φορτώνονται μόνο εφόσον δώσετε ρητή συγκατάθεση."
                items={[
                  { name: "_fbp", purpose: "Meta Pixel — επανάληψη διαφημιστικού μηνύματος", duration: "3 μήνες" },
                  { name: "_li_id", purpose: "LinkedIn Insight tag", duration: "6 μήνες" }
                ]}
              />
            </Stack>
          )
        },
        {
          id: "manage",
          heading: "Πώς διαχειρίζεστε τα cookies",
          body: (
            <>
              <p>
                Κατά την πρώτη σας επίσκεψη εμφανίζεται μπάνερ συγκατάθεσης όπου μπορείτε
                να αποδεχθείτε όλα τα cookies ή να επιλέξετε μόνο τα απαραίτητα. Μπορείτε
                να αλλάξετε την επιλογή σας οποιαδήποτε στιγμή κάνοντας κλικ στο σύνδεσμο
                «Cookies» στο υποσέλιδο.
              </p>
              <p>
                Μπορείτε επίσης να ρυθμίσετε τον browser σας ώστε να μπλοκάρει ή να
                διαγράφει cookies. Σημειώστε ότι η απενεργοποίηση των απαραίτητων cookies
                μπορεί να καταστήσει την Πλατφόρμα μη λειτουργική.
              </p>
            </>
          )
        },
        {
          id: "third-party",
          heading: "Cookies τρίτων μερών",
          body: (
            <p>
              Πέρα από τα cookies της Kalypsis, ενδέχεται να αποθηκεύονται cookies από
              υπηρεσίες όπως Plausible Analytics, Stripe (για διαχείριση πληρωμών) και — αν
              έχετε συγκατατεθεί — Meta και LinkedIn (για στοχευμένη προβολή). Ο πλήρης
              κατάλογος των τρίτων μερών είναι διαθέσιμος στη συνεργαζόμενη Πολιτική
              Απορρήτου.
            </p>
          )
        },
        {
          id: "contact",
          heading: "Επικοινωνία",
          body: (
            <p>
              Για ερωτήσεις σχετικά με τη χρήση cookies από την Kalypsis, επικοινωνήστε
              μαζί μας στο <a href="mailto:privacy@kalypsis.gr">privacy@kalypsis.gr</a>.
            </p>
          )
        }
      ]}
    />
  );
}

function CookieGroup({
  title,
  description,
  items,
  strict
}: {
  title: string;
  description: string;
  items: { name: string; purpose: string; duration: string }[];
  strict?: boolean;
}) {
  return (
    <Card sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            borderRadius: 999,
            bgcolor: strict ? "primary.main" : "background.default",
            color: strict ? "common.white" : "text.secondary",
            border: strict ? "none" : "1px solid",
            borderColor: "divider"
          }}
        >
          {strict ? "ΥΠΟΧΡΕΩΤΙΚΑ" : "ΕΠΙΛΟΓΗ"}
        </Box>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2, fontSize: 14 }}>
        {description}
      </Typography>
      <Table size="small" sx={{ "& td, & th": { px: 1, fontSize: 13 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Cookie</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Σκοπός</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Διάρκεια</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((it) => (
            <TableRow key={it.name}>
              <TableCell sx={{ fontFamily: "monospace", color: "primary.main" }}>{it.name}</TableCell>
              <TableCell>{it.purpose}</TableCell>
              <TableCell>{it.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
