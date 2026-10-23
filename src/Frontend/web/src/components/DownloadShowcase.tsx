import { useId, useState } from "react";
import { Box, Button, ButtonBase, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import GitHubIcon from "@mui/icons-material/GitHub";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TerminalIcon from "@mui/icons-material/Terminal";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { useTranslation } from "react-i18next";
import { CLI_REPOSITORY } from "./CliProjectLink";

const NAVY = "#0b2545";
const BLUE = "#087CEB";
type Copy = { el: string; en: string };
export type Screenshot = { file: string; width: number; height: number; title: Copy; description: Copy };
const imageRoot = "/images/download/";
const text = (copy: Copy, english: boolean) => english ? copy.en : copy.el;

export const DESKTOP_SCREENSHOTS: Screenshot[] = [
  { file: "desktop-dashboard.jpg", width: 1920, height: 1038,
    title: { el: "Πίνακας ελέγχου", en: "Dashboard" },
    description: { el: "Επισκόπηση γραφείου, παραγωγή και διαγράμματα σε μία οθόνη.", en: "Office overview, production and charts on one screen." } },
  { file: "desktop-partners.jpg", width: 1920, height: 1038,
    title: { el: "Λίστα συνεργατών", en: "Partners list" },
    description: { el: "Αναζήτηση, φίλτρα και καθημερινές ενέργειες σε έναν οργανωμένο πίνακα.", en: "Search, filters and everyday actions in an organised table." } },
  { file: "desktop-new-customer.jpg", width: 1166, height: 750,
    title: { el: "Νέος πελάτης", en: "New customer" },
    description: { el: "Καταχώρηση πελάτη με την ίδια δομή πεδίων που χρησιμοποιεί η καρτέλα του.", en: "Create a customer with the same field layout used in the customer card." } },
  { file: "desktop-customer-edit.jpg", width: 1162, height: 928,
    title: { el: "Επεξεργασία πελάτη", en: "Edit customer" },
    description: { el: "Αντιγραφή και επεξεργασία πεδίων, με αποθήκευση μέσα στην ίδια καρτέλα.", en: "Copy and edit fields, then save within the same customer card." } },
];

export const CLI_SCREENSHOTS: Screenshot[] = [
  { file: "cli-office-overview.jpg", width: 1336, height: 761,
    title: { el: "Πίνακας γραφείου", en: "Office overview" },
    description: { el: "Μενού backoffice με πλήθος εγγραφών και χρωματιστές ενέργειες.", en: "Backoffice menu with record counts and coloured actions." } },
  { file: "cli-customers-list.jpg", width: 1920, height: 917,
    title: { el: "Λίστα πελατών", en: "Customers list" },
    description: { el: "Πίνακας πελατών με αναζήτηση, σελιδοποίηση και άνοιγμα καρτέλας.", en: "Customers table with search, pagination and record details." } },
  { file: "cli-customer-card.jpg", width: 597, height: 351,
    title: { el: "Καρτέλα πελάτη", en: "Customer card" },
    description: { el: "Συγκεντρωμένα στοιχεία ταυτότητας και επικοινωνίας στο τερματικό.", en: "Identity and contact information together in the terminal." } },
  { file: "cli-policies-list.jpg", width: 1023, height: 592,
    title: { el: "Λίστα συμβολαίων", en: "Policies list" },
    description: { el: "Ασφάλιστρα, υπόλοιπα και καταστάσεις με ευδιάκριτες χρωματικές ενδείξεις.", en: "Premiums, balances and statuses with clear colour indicators." } },
  { file: "cli-policy-card.jpg", width: 817, height: 776,
    title: { el: "Καρτέλα συμβολαίου", en: "Policy card" },
    description: { el: "Αναλυτικά στοιχεία συμβολαίου, προμήθειες και πιστωτικά.", en: "Policy details, commissions and credit notes." } },
];

export function ScreenshotGallery({ images, title, english }: { images: Screenshot[]; title: string; english: boolean }) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = images[selected];
  const move = (offset: number) => setSelected(value => (value + offset + images.length) % images.length);
  const label = text(current.title, english);
  const previousLabel = english ? "Previous screenshot" : "Προηγούμενη εικόνα";
  const nextLabel = english ? "Next screenshot" : "Επόμενη εικόνα";

  return <Box role="group" aria-label={title} sx={{ minWidth: 0 }}>
    <Box component="figure" sx={{ m: 0, border: "1px solid #C8D9EA", borderRadius: 2.5, overflow: "hidden", bgcolor: "#F3F7FB", boxShadow: "0 14px 40px -26px rgba(11,37,69,.3)" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ p: { xs: 1.25, sm: 2 }, borderBottom: "1px solid #D6E3F0", flexWrap: "wrap" }}>
        <Typography component="h3" id={`${id}-caption`} sx={{ color: NAVY, fontSize: { xs: 15, sm: 17 }, fontWeight: 800, m: 0 }}>{label}</Typography>
        <Button size="small" startIcon={<ZoomInIcon />} onClick={() => setOpen(true)} aria-haspopup="dialog" sx={{ textTransform: "none", fontWeight: 750, color: BLUE, flexShrink: 0 }}>
          {english ? "Enlarge" : "Μεγέθυνση"}
        </Button>
      </Stack>
      <ButtonBase onClick={() => setOpen(true)} aria-label={`${english ? "Enlarge" : "Μεγέθυνση"}: ${label}`} aria-haspopup="dialog"
        sx={{ display: "flex", width: "100%", aspectRatio: { xs: "4 / 3", sm: "16 / 10" }, maxHeight: 600, p: { xs: 1, sm: 2 }, bgcolor: "#E8EFF6", "&:focus-visible": { outline: `3px solid ${BLUE}`, outlineOffset: -3 } }}>
        <Box component="img" src={imageRoot + current.file} alt={label} width={current.width} height={current.height} loading="lazy" decoding="async"
          sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      </ButtonBase>
      <Box component="figcaption" aria-live="polite" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: "#fff" }}>
        <Typography sx={{ color: "#3d4f6b", fontSize: 14, lineHeight: 1.6 }}>{text(current.description, english)}</Typography>
      </Box>
    </Box>
    <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(${images.length}, minmax(0, 1fr))` }, gap: { xs: 1, sm: 1.25 } }}>
      {images.map((image, index) => <ButtonBase key={image.file} onClick={() => setSelected(index)} aria-pressed={selected === index} aria-label={text(image.title, english)}
        sx={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "stretch", overflow: "hidden", borderRadius: 1.5, border: "2px solid", borderColor: selected === index ? BLUE : "#D6E3F0", bgcolor: selected === index ? "#E8F2FF" : "#F8FAFC", textAlign: "left", "&:hover": { borderColor: BLUE }, "&:focus-visible": { outline: `3px solid ${BLUE}`, outlineOffset: 2 } }}>
        <Box sx={{ aspectRatio: "16 / 10", p: .75, bgcolor: "#E8EFF6" }}>
          <Box component="img" src={imageRoot + image.file} alt="" width={image.width} height={image.height} loading="lazy" decoding="async" sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
        </Box>
        <Typography component="span" sx={{ p: 1, color: selected === index ? "#075DAE" : NAVY, fontWeight: 750, fontSize: { xs: 12, md: 13 }, lineHeight: 1.4 }}>{text(image.title, english)}</Typography>
      </ButtonBase>)}
    </Box>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth aria-labelledby={`${id}-title`}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
      }}
      PaperProps={{ sx: { m: { xs: 1, sm: 3 }, width: { xs: "calc(100% - 16px)", sm: "calc(100% - 48px)" }, maxHeight: "calc(100dvh - 24px)", borderRadius: 2, bgcolor: "#F3F7FB" } }}>
      <DialogTitle id={`${id}-title`} sx={{ color: NAVY, fontWeight: 800, fontSize: { xs: 16, sm: 20 }, pr: 7 }}>{title} · {label}</DialogTitle>
      <IconButton onClick={() => setOpen(false)} aria-label={english ? "Close preview" : "Κλείσιμο προεπισκόπησης"} sx={{ position: "absolute", top: 9, right: 9, bgcolor: "#C92636", color: "#fff", borderRadius: 1, "&:hover": { bgcolor: "#A81928" } }}><CloseIcon /></IconButton>
      <DialogContent sx={{ p: { xs: 1, sm: 2 }, display: "flex", justifyContent: "center", bgcolor: "#E8EFF6" }}>
        <Box component="img" src={imageRoot + current.file} alt={label} width={current.width} height={current.height} sx={{ display: "block", maxWidth: "100%", width: "auto", height: "auto", maxHeight: "calc(100dvh - 210px)", objectFit: "contain", alignSelf: "center" }} />
      </DialogContent>
      <DialogActions sx={{ p: 1.5, justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Stack direction="row" alignItems="center" gap={.5}>
          <Tooltip title={previousLabel}><IconButton onClick={() => move(-1)} aria-label={previousLabel} sx={{ color: NAVY }}><ArrowBackIcon /></IconButton></Tooltip>
          <Typography sx={{ fontSize: 13, color: NAVY, minWidth: 36, textAlign: "center" }}>{selected + 1} / {images.length}</Typography>
          <Tooltip title={nextLabel}><IconButton onClick={() => move(1)} aria-label={nextLabel} sx={{ color: NAVY }}><ArrowForwardIcon /></IconButton></Tooltip>
        </Stack>
        <Button component="a" href={imageRoot + current.file} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewIcon />} sx={{ color: NAVY, textTransform: "none", fontWeight: 750, fontSize: 13 }}>
          {english ? "Open original image" : "Άνοιγμα αρχικής εικόνας"}
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

export function DesktopScreenshotsSection() {
  const { i18n } = useTranslation();
  const english = i18n.language.startsWith("en");
  return <Box component="section" id="desktop-preview" aria-labelledby="desktop-preview-title" sx={{ pt: { xs: 7, md: 10 } }}>
    <Typography sx={{ color: "#1f7bb3", fontSize: 12, fontWeight: 800, letterSpacing: ".16em", mb: 1 }}>{english ? "KALYPSIS DESKTOP · IN PRACTICE" : "KALYPSIS DESKTOP · ΣΤΗΝ ΠΡΑΞΗ"}</Typography>
    <Typography component="h2" id="desktop-preview-title" sx={{ color: NAVY, fontSize: { xs: 27, md: 38 }, lineHeight: 1.15, fontWeight: 850, letterSpacing: "-.025em", mb: 1.5 }}>{english ? "Explore the Desktop application" : "Γνωρίστε την εφαρμογή Desktop"}</Typography>
    <Typography sx={{ color: "#3d4f6b", fontSize: { xs: 15, md: 17 }, lineHeight: 1.7, mb: 3, maxWidth: 820 }}>{english ? "Real application screens with demonstration data. Choose a screenshot and enlarge it to explore the details." : "Πραγματικές οθόνες της εφαρμογής με δεδομένα επίδειξης. Επιλέξτε μια εικόνα και μεγεθύνετέ τη για να δείτε τις λεπτομέρειες."}</Typography>
    <ScreenshotGallery images={DESKTOP_SCREENSHOTS} title="KALYPSIS Desktop" english={english} />
  </Box>;
}

export function CliDownloadSection() {
  const { i18n } = useTranslation();
  const english = i18n.language.startsWith("en");
  const features = english ? [
    ["Core backoffice", "Customers, insurers, partners and policies, with renewals and history."],
    ["Collections & credits", "Partial or full receipts, policy credits and financial summaries by currency."],
    ["Search, exports & backups", "Paged tables, keyword search, Excel-compatible CSV and local database backups."],
  ] : [
    ["Βασικό backoffice", "Πελάτες, ασφαλιστικές, συνεργάτες και συμβόλαια, με ανανεώσεις και ιστορικό."],
    ["Εισπράξεις & πιστωτικά", "Μερικές ή πλήρεις εισπράξεις, πιστωτικά συμβολαίων και οικονομική εικόνα ανά νόμισμα."],
    ["Αναζήτηση, εξαγωγές & backup", "Πίνακες με σελίδες, αναζήτηση, CSV για Excel και αντίγραφα της τοπικής βάσης."],
  ];
  return <Box component="section" id="kalypsis-cli" aria-labelledby="cli-download-title" sx={{ mt: { xs: 8, md: 11 }, pt: { xs: 5, md: 7 }, borderTop: "1px solid #C8D9EA" }}>
    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5, color: BLUE }}><TerminalIcon /><Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: ".16em" }}>{english ? "KALYPSIS CLI · COMMUNITY PROJECT" : "KALYPSIS CLI · ΕΡΓΟ ΓΙΑ ΤΗΝ ΚΟΙΝΟΤΗΤΑ"}</Typography></Stack>
    <Typography component="h2" id="cli-download-title" sx={{ color: NAVY, fontSize: { xs: 27, md: 38 }, lineHeight: 1.15, fontWeight: 850, letterSpacing: "-.025em", mb: 2 }}>{english ? "Free backoffice in your terminal" : "Δωρεάν backoffice στο τερματικό σας"}</Typography>
    <Typography sx={{ color: "#3d4f6b", fontSize: { xs: 15, md: 17 }, lineHeight: 1.8, maxWidth: 900 }}>
      {english ? "A free community project with its source code available on GitHub. KALYPSIS CLI brings the essential insurance-office workflow to the Windows terminal, with clear tables, coloured statuses and keyboard navigation." : "Ένα δωρεάν έργο για την κοινότητα, με τον πηγαίο κώδικά του διαθέσιμο στο GitHub. Το KALYPSIS CLI μεταφέρει τις βασικές εργασίες ενός ασφαλιστικού γραφείου στο τερματικό των Windows, με καθαρούς πίνακες, χρωματικές ενδείξεις και πλοήγηση από το πληκτρολόγιο."}
    </Typography>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 2.5 }}>
      {(english ? ["Free to use", "Windows x64", "C# / .NET", "Local SQLite"] : ["Δωρεάν χρήση", "Windows x64", "C# / .NET", "Τοπική SQLite"]).map(label => <Chip key={label} label={label} size="small" sx={{ bgcolor: "#E8F2FF", color: "#0B305C", border: "1px solid #C8D9EA", fontWeight: 750 }} />)}
    </Stack>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2, my: 3 }}>
      {features.map(([title, description]) => <Box key={title} sx={{ p: 2.5, border: "1px solid #D6E3F0", borderRadius: 2, bgcolor: "#F8FAFC", minWidth: 0 }}>
        <Typography component="h3" sx={{ fontWeight: 800, color: NAVY, fontSize: 16, mb: .75 }}>{title}</Typography>
        <Typography sx={{ color: "#3d4f6b", fontSize: 14, lineHeight: 1.7 }}>{description}</Typography>
      </Box>)}
    </Box>
    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} sx={{ mb: 2 }}>
      <Button component="a" href={`${CLI_REPOSITORY}/releases/latest`} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<DownloadIcon />}
        sx={{ bgcolor: NAVY, color: "#fff", textTransform: "none", fontWeight: 800, px: 3, py: 1.25, borderRadius: 1.5, boxShadow: "none", "&:hover": { bgcolor: "#1d4e89", boxShadow: "none" } }}>{english ? "Download CLI for Windows" : "Λήψη CLI για Windows"}</Button>
      <Button component="a" href={CLI_REPOSITORY} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<GitHubIcon />}
        sx={{ color: NAVY, borderColor: "#9DB7D0", textTransform: "none", fontWeight: 800, px: 3, py: 1.25, borderRadius: 1.5 }}>{english ? "Source code & contributions" : "Κώδικας & συνεισφορά"}</Button>
    </Stack>
    <Typography sx={{ fontSize: 14, color: "#3d4f6b", lineHeight: 1.7, mb: 3 }}>{english ? "Extract the Windows ZIP and run kalypsis.exe. No separate .NET installation or cloud account is required. The CLI uses its own local database and works independently from Desktop and Web." : "Αποσυμπιέστε το ZIP για Windows και εκτελέστε το kalypsis.exe. Δεν χρειάζεται ξεχωριστή εγκατάσταση .NET ή λογαριασμός cloud. Το CLI χρησιμοποιεί δική του τοπική βάση και λειτουργεί ανεξάρτητα από το Desktop και το Web."}</Typography>
    <Typography sx={{ fontSize: 13, color: "#667B98", mb: 1.5 }}>{english ? "Actual CLI 0.2.0 screenshots with synthetic demonstration data." : "Πραγματικές εικόνες του CLI 0.2.0 με συνθετικά δεδομένα επίδειξης."}</Typography>
    <ScreenshotGallery images={CLI_SCREENSHOTS} title="KALYPSIS CLI" english={english} />
  </Box>;
}
