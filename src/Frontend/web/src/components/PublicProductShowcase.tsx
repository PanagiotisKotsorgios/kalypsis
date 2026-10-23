import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DESKTOP_INSTALLER_URL } from "./DesktopDownloadButton";
import { CLI_SCREENSHOTS, DESKTOP_SCREENSHOTS, ScreenshotGallery, type Screenshot } from "./DownloadShowcase";
import { CLI_REPOSITORY } from "./CliProjectLink";

const LIGHT = "#F1F7FD";
const NAVY = "#0B2B54";
const BLUE = "#087CEB";

export const WEB_SCREENSHOTS: Screenshot[] = [
  { file: "web-dashboard.jpg", width: 1920, height: 953,
    title: { el: "Πίνακας ελέγχου", en: "Dashboard" },
    description: { el: "Η εικόνα του γραφείου και η πορεία παραγωγής, με επιλογή περιόδου και διαδραστικά γραφήματα.", en: "Office overview and production trends, with period selection and interactive charts." } },
  { file: "web-customer-card.jpg", width: 1351, height: 808,
    title: { el: "Καρτέλα πελάτη", en: "Customer card" },
    description: { el: "Στοιχεία πελάτη, συμβόλαια και οικονομικά σε μία καρτέλα, με αντιγραφή και επεξεργασία πεδίων.", en: "Customer details, policies and finances in one card, with field copying and editing." } },
  { file: "web-production-lists.jpg", width: 1609, height: 728,
    title: { el: "Λίστες παραγωγής", en: "Production lists" },
    description: { el: "Συνδυαστικά φίλτρα, ομαδοποίηση, σύνολα και εξαγωγές με βάση τα αποτελέσματα του πίνακα.", en: "Combined filters, grouping, totals and exports based on the table results." } },
  { file: "web-office-financials.jpg", width: 1596, height: 859,
    title: { el: "Οικονομικά γραφείου", en: "Office finances" },
    description: { el: "Εισπράξεις, πληρωμές, προμήθειες και μηνιαία οικονομική εικόνα του γραφείου.", en: "Receipts, payments, commissions and the office’s monthly financial overview." } },
  { file: "web-partner-statements.jpg", width: 1612, height: 804,
    title: { el: "Εκκαθαριστικό συνεργάτη", en: "Partner statement" },
    description: { el: "Αναλυτικά συμβόλαια, προμήθειες, καταβολές και υπόλοιπα ανά συνεργάτη και περίοδο.", en: "Detailed policies, commissions, payments and balances by partner and period." } },
  { file: "web-analytics.jpg", width: 1584, height: 758,
    title: { el: "Στατιστικά γραφείου", en: "Office analytics" },
    description: { el: "Κατανομή συμβολαίων, κλάδοι ασφάλισης, ασφαλιστικές εταιρείες και κατάσταση ζημιών.", en: "Policy distribution, insurance lines, carriers and claim statuses." } },
];

type Product = {
  kind: "web" | "desktop" | "cli";
  id: string;
  name: string;
  title: string;
  description: string;
  features: string[][];
  images: Screenshot[];
  reversed?: boolean;
};

function ProductSection({ product, english }: { product: Product; english: boolean }) {
  const { kind, id, name, title, description, features, images, reversed = false } = product;
  return <Box component="section" aria-labelledby={`${id}-title`} sx={{
    bgcolor: LIGHT,
    backgroundImage: { xs: "none", md: `linear-gradient(90deg, ${reversed ? NAVY : LIGHT} 50%, ${reversed ? LIGHT : NAVY} 50%)` },
    borderTop: "1px solid #D7E5F3",
  }}>
    <Container maxWidth={false} disableGutters sx={{ maxWidth: 1600 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
        <Box sx={{
          gridColumn: { xs: 1, md: reversed ? 2 : 1 }, gridRow: 1,
          bgcolor: LIGHT, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center",
          p: { xs: 3, sm: 4, md: 5, xl: 7 },
        }}>
          <Typography sx={{ color: "#1766B5", fontSize: 12, letterSpacing: ".16em", fontWeight: 800, mb: 2 }}>{name}</Typography>
          <Typography component="h2" id={`${id}-title`} sx={{ color: NAVY, fontSize: { xs: 28, sm: 34, lg: 40 }, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.2, textWrap: "balance", mb: 2 }}>
            {title}
          </Typography>
          <Typography sx={{ color: "#455F7B", fontSize: { xs: 15, lg: 17 }, lineHeight: 1.8, mb: 3 }}>{description}</Typography>
          <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gap: 2.5 }}>
            {features.map(([heading, detail]) => <Box component="li" key={heading} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <CheckCircleOutlineIcon aria-hidden sx={{ color: BLUE, fontSize: 23, mt: .25, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h3" sx={{ color: NAVY, fontSize: 16, fontWeight: 800, mb: .5 }}>{heading}</Typography>
                <Typography sx={{ color: "#455F7B", fontSize: 14.5, lineHeight: 1.75 }}>{detail}</Typography>
              </Box>
            </Box>)}
          </Box>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1.5} sx={{ mt: 3.5 }}>
            {kind === "cli" ? <>
              <Button component="a" href={`${CLI_REPOSITORY}/releases/latest`} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<DownloadIcon />}
                sx={{ bgcolor: NAVY, color: "#fff", textTransform: "none", fontWeight: 800, borderRadius: 1.5, px: 3, py: 1.25, boxShadow: "none", "&:hover": { bgcolor: "#164D85", boxShadow: "none" } }}>
                {english ? "Download CLI for Windows" : "Λήψη CLI για Windows"}
              </Button>
              <Button component="a" href={CLI_REPOSITORY} target="_blank" rel="noopener noreferrer" startIcon={<GitHubIcon />} sx={{ color: "#14599F", fontWeight: 750, textTransform: "none" }}>
                {english ? "Source code on GitHub" : "Κώδικας στο GitHub"}
              </Button>
            </> : kind === "desktop" ? <>
              <Button component="a" href={DESKTOP_INSTALLER_URL} download="kalypsis-desktop-win-Setup.exe" variant="contained" startIcon={<DownloadIcon />}
                sx={{ bgcolor: NAVY, color: "#fff", textTransform: "none", fontWeight: 800, borderRadius: 1.5, px: 3, py: 1.25, boxShadow: "none", "&:hover": { bgcolor: "#164D85", boxShadow: "none" } }}>
                {english ? "Download for Windows" : "Λήψη για Windows"}
              </Button>
              <Button component={RouterLink} to="/download" endIcon={<ArrowForwardIcon />} sx={{ color: "#14599F", fontWeight: 750, textTransform: "none" }}>
                {english ? "More about Desktop" : "Περισσότερα για το Desktop"}
              </Button>
            </> : <Button component={RouterLink} to="/register" variant="contained" endIcon={<ArrowForwardIcon />}
              sx={{ bgcolor: NAVY, color: "#fff", textTransform: "none", fontWeight: 800, borderRadius: 1.5, px: 3, py: 1.25, boxShadow: "none", "&:hover": { bgcolor: "#164D85", boxShadow: "none" } }}>
              {english ? "Get started with Web Backoffice" : "Ξεκινήστε με το Web Backoffice"}
            </Button>}
          </Stack>
        </Box>
        <Box sx={{
          gridColumn: { xs: 1, md: reversed ? 1 : 2 }, gridRow: { xs: 2, md: 1 },
          bgcolor: NAVY, minWidth: 0, display: "flex", alignItems: "center", p: { xs: 2, sm: 3, lg: 4 },
          "& > [role='group']": { width: "100%" },
        }}>
          <ScreenshotGallery images={images} title={name} english={english} showDescriptions={false} />
        </Box>
      </Box>
    </Container>
  </Box>;
}

export function PublicProductShowcase() {
  const { i18n } = useTranslation();
  const english = (i18n.resolvedLanguage ?? i18n.language).startsWith("en");
  const web: Product = {
    kind: "web", id: "public-web", name: "KALYPSIS WEB BACKOFFICE", images: WEB_SCREENSHOTS,
    title: english ? "Your agency, organised in your browser." : "Το γραφείο σας, οργανωμένο από τον browser.",
    description: english
      ? "Manage customers, policies, production and finances in one backoffice, with a shared overview for your team and offices."
      : "Διαχειριστείτε πελάτες, συμβόλαια, παραγωγή και οικονομικά σε ένα backoffice, με κοινή εικόνα για την ομάδα και τα γραφεία σας.",
    features: english ? [
      ["Connected customer records", "Customers, vehicles, policies, partners and claims stay linked, with clear details in every card."],
      ["Production and financial overview", "Combined filters, grouping, commissions, receipts, payments and exports of the results you need."],
      ["Control over everyday work", "User permissions, multiple offices, renewals and reminders in the same workspace."],
    ] : [
      ["Συνδεδεμένες καρτέλες", "Πελάτες, οχήματα, συμβόλαια, συνεργάτες και ζημιές παραμένουν συνδεδεμένα, με ξεκάθαρα στοιχεία σε κάθε καρτέλα."],
      ["Παραγωγή και οικονομική εικόνα", "Συνδυαστικά φίλτρα, ομαδοποιήσεις, προμήθειες, εισπράξεις, πληρωμές και εξαγωγές των αποτελεσμάτων που χρειάζεστε."],
      ["Έλεγχος στην καθημερινότητα", "Δικαιώματα χρηστών, πολλαπλά γραφεία, ανανεώσεις και υπενθυμίσεις στο ίδιο περιβάλλον."],
    ],
  };
  const desktop: Product = {
    kind: "desktop", id: "public-desktop", name: "KALYPSIS DESKTOP", images: DESKTOP_SCREENSHOTS, reversed: true,
    title: english ? "Everyday work, in a Windows application." : "Η καθημερινή σας εργασία, σε εφαρμογή Windows.",
    description: english
      ? "KALYPSIS Desktop brings the backoffice to your computer, with a local database and a workspace designed for daily data entry. New installations receive a 30-day free trial."
      : "Το KALYPSIS Desktop φέρνει το backoffice στον υπολογιστή σας, με τοπική βάση δεδομένων και περιβάλλον σχεδιασμένο για καθημερινή καταχώρηση. Οι νέες εγκαταστάσεις ξεκινούν με δωρεάν δοκιμή 30 ημερών.",
    features: english ? [
      ["Quick data entry and editing", "Consistent customer, policy and partner cards, with field copying and editing within the same screen."],
      ["Local data and office tools", "Organise your office records, print, export and keep backups on your computer."],
      ["An installer with everything included", "The installer includes the required runtime and database. Internet is required for registration and startup license checks."],
    ] : [
      ["Γρήγορη καταχώρηση και επεξεργασία", "Ενιαίες καρτέλες πελατών, συμβολαίων και συνεργατών, με αντιγραφή πεδίων και επεξεργασία μέσα στην ίδια οθόνη."],
      ["Τοπικά δεδομένα και εργαλεία γραφείου", "Οργανώστε τις εγγραφές του γραφείου, εκτυπώστε, εξαγάγετε και κρατήστε αντίγραφα ασφαλείας στον υπολογιστή σας."],
      ["Εγκατάσταση με όλα τα απαραίτητα", "Ο εγκαταστάτης περιλαμβάνει το περιβάλλον λειτουργίας και τη βάση δεδομένων. Απαιτείται Internet για εγγραφή και έλεγχο άδειας στην εκκίνηση."],
    ],
  };
  const cli: Product = {
    kind: "cli", id: "public-cli", name: "KALYPSIS CLI", images: CLI_SCREENSHOTS,
    title: english ? "Free backoffice in your terminal." : "Δωρεάν backoffice στο τερματικό σας.",
    description: english
      ? "A free, standalone Windows application with a Greek interactive menu, clear tables and coloured statuses. It works offline with its own local database, without a cloud account."
      : "Μια δωρεάν, αυτόνομη εφαρμογή για το τερματικό των Windows, με ελληνικό διαδραστικό μενού, καθαρούς πίνακες και χρωματικές ενδείξεις. Λειτουργεί offline με δική της τοπική βάση, χωρίς λογαριασμό cloud.",
    features: english ? [
      ["The essential backoffice workflow", "Customers, insurers, partners, policies and renewals through an interactive menu and keyboard commands."],
      ["Receipts, credits and financial summaries", "Partial or full receipts, policy credits and financial totals by currency."],
      ["Search, exports and backups", "Search paged tables, export Excel-compatible CSV files and back up your local database."],
    ] : [
      ["Οι βασικές εργασίες του backoffice", "Πελάτες, ασφαλιστικές, συνεργάτες, συμβόλαια και ανανεώσεις μέσα από διαδραστικό μενού και εντολές πληκτρολογίου."],
      ["Εισπράξεις, πιστωτικά και οικονομική εικόνα", "Μερικές ή πλήρεις εισπράξεις, πιστωτικά συμβολαίων και οικονομικά σύνολα ανά νόμισμα."],
      ["Αναζήτηση, εξαγωγές και αντίγραφα", "Αναζητήστε σε πίνακες με σελιδοποίηση, εξαγάγετε CSV για Excel και κρατήστε αντίγραφα της τοπικής βάσης."],
    ],
  };
  return <><ProductSection product={web} english={english} /><ProductSection product={desktop} english={english} /><ProductSection product={cli} english={english} /></>;
}
