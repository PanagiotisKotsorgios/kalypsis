import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import AnnouncementOutlinedIcon from "@mui/icons-material/AnnouncementOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EuroRoundedIcon from "@mui/icons-material/EuroRounded";
import FilterListOutlinedIcon from "@mui/icons-material/FilterListOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HealthAndSafetyOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import LuggageOutlinedIcon from "@mui/icons-material/LuggageOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import SailingOutlinedIcon from "@mui/icons-material/SailingOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WalletOutlinedIcon from "@mui/icons-material/WalletOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

type ViewKey = "dashboard" | "quotes" | "print-pay" | "pay-print" | "requests" | "history";
type BranchKey = "Αυτοκίνητο" | "Κατοικία" | "Υγεία" | "Ζωή" | "Επιχείρηση";

interface QuoteRow {
  id: string;
  carrier: string;
  initials: string;
  colour: string;
  product: string;
  premium: number;
  monthly: number;
  commission: number;
  score: number;
  coverages: string[];
  recommended?: boolean;
  availability: string;
}

interface OfferRow {
  id: string;
  code: string;
  customer: string;
  branch: BranchKey;
  carrier: string;
  premium: number;
  status: "Έτοιμη" | "Στάλθηκε" | "Επιλέχθηκε" | "Ληγμένη";
  updated: string;
}

const branchLabels: BranchKey[] = ["Αυτοκίνητο", "Κατοικία", "Υγεία", "Ζωή", "Επιχείρηση"];

const branchPresets: Record<BranchKey, { customer: string; title: string; fields: [string, string][]; quotes: QuoteRow[] }> = {
  Αυτοκίνητο: {
    customer: "Χάρης Μπερτσιάς",
    title: "Toyota Yaris · ΜΕΒ8677",
    fields: [["Αριθμός κυκλοφορίας", "ΜΕΒ8677"], ["Κατασκευαστής / μοντέλο", "Toyota Yaris 1.2"], ["Έτος πρώτης κυκλοφορίας", "2020"], ["Αξία οχήματος", "14.800 €"]],
    quotes: [
      { id: "q1", carrier: "Νέος Ποσειδώνας", initials: "ΝΠ", colour: "#087f8c", product: "Πλήρης προστασία", premium: 118.71, monthly: 9.89, commission: 18.99, score: 4.8, coverages: ["Αστική ευθύνη", "Θραύση κρυστάλλων", "Οδική βοήθεια", "Πυρός / κλοπής"], recommended: true, availability: "Ισχύει έως 24/10/2026" },
      { id: "q2", carrier: "Μινέττα", initials: "Μ", colour: "#2759a5", product: "Πλήρες Plus", premium: 121.04, monthly: 10.09, commission: 19.37, score: 4.7, coverages: ["Αστική ευθύνη", "Οδική βοήθεια", "Νομική προστασία"], availability: "Ισχύει έως 24/10/2026" },
      { id: "q3", carrier: "Εθνική Ασφαλιστική", initials: "ΕΑ", colour: "#4c6fff", product: "Auto Comfort", premium: 126.5, monthly: 10.54, commission: 20.24, score: 4.6, coverages: ["Αστική ευθύνη", "Πυρός / κλοπής", "Θραύση κρυστάλλων"], availability: "Ισχύει έως 24/10/2026" },
      { id: "q4", carrier: "Hellas Direct", initials: "HD", colour: "#ee7d32", product: "Smart Drive", premium: 132.9, monthly: 11.08, commission: 21.26, score: 4.4, coverages: ["Αστική ευθύνη", "Οδική βοήθεια"], availability: "Ισχύει έως 24/10/2026" },
    ],
  },
  Κατοικία: {
    customer: "Μαρία Παπαδοπούλου",
    title: "Διαμέρισμα · 92 τ.μ. · Αθήνα",
    fields: [["Τύπος κατοικίας", "Διαμέρισμα"], ["Επιφάνεια", "92 τ.μ."], ["Έτος κατασκευής", "2008"], ["Ασφαλιζόμενη αξία", "165.000 €"]],
    quotes: [
      { id: "h1", carrier: "ERGO", initials: "ER", colour: "#e35d6a", product: "Home Complete", premium: 154.2, monthly: 12.85, commission: 24.67, score: 4.8, coverages: ["Πυρκαγιά", "Σεισμός", "Πλημμύρα", "Κλοπή"], recommended: true, availability: "Ισχύει έως 31/10/2026" },
      { id: "h2", carrier: "Generali", initials: "G", colour: "#f1a32b", product: "Home Protect", premium: 168.4, monthly: 14.03, commission: 26.94, score: 4.6, coverages: ["Πυρκαγιά", "Σεισμός", "Αστική ευθύνη"], availability: "Ισχύει έως 31/10/2026" },
      { id: "h3", carrier: "Interamerican", initials: "IA", colour: "#1c9b8f", product: "Κατοικία Plus", premium: 181.7, monthly: 15.14, commission: 29.07, score: 4.5, coverages: ["Πυρκαγιά", "Κλοπή", "Θραύση σωληνώσεων"], availability: "Ισχύει έως 31/10/2026" },
    ],
  },
  Υγεία: {
    customer: "Γιώργος Αντωνίου",
    title: "Ατομικό πρόγραμμα · 38 ετών",
    fields: [["Ηλικία", "38"], ["Θέση νοσηλείας", "Α' θέση"], ["Απαλλαγή", "500 €"], ["Όριο κάλυψης", "100.000 €"]],
    quotes: [
      { id: "y1", carrier: "Interamerican", initials: "IA", colour: "#168d83", product: "Υγεία Premium", premium: 742, monthly: 61.83, commission: 111.3, score: 4.9, coverages: ["Νοσηλεία", "Διαγνωστικές εξετάσεις", "Επείγοντα"], recommended: true, availability: "Ισχύει έως 15/11/2026" },
      { id: "y2", carrier: "Eurolife FFH", initials: "EF", colour: "#536dfe", product: "Health Balance", premium: 684, monthly: 57, commission: 102.6, score: 4.6, coverages: ["Νοσηλεία", "Ιατρικές επισκέψεις"], availability: "Ισχύει έως 15/11/2026" },
      { id: "y3", carrier: "NN Hellas", initials: "NN", colour: "#df5a64", product: "Υγεία Care", premium: 805, monthly: 67.08, commission: 120.75, score: 4.5, coverages: ["Νοσηλεία", "Επείγοντα", "Δεύτερη γνώμη"], availability: "Ισχύει έως 15/11/2026" },
    ],
  },
  Ζωή: {
    customer: "Αλέξανδρος Μιχαηλίδης",
    title: "Πρόγραμμα ζωής · 20 έτη",
    fields: [["Ηλικία ασφαλισμένου", "41"], ["Κεφάλαιο", "100.000 €"], ["Διάρκεια", "20 έτη"], ["Συχνότητα", "Ετήσια"]],
    quotes: [
      { id: "l1", carrier: "Generali", initials: "G", colour: "#f1a32b", product: "Life Secure", premium: 392, monthly: 32.67, commission: 58.8, score: 4.7, coverages: ["Θάνατος", "Μόνιμη ανικανότητα", "Πρόσθετες παροχές"], recommended: true, availability: "Ισχύει έως 12/11/2026" },
      { id: "l2", carrier: "ERGO", initials: "ER", colour: "#e35d6a", product: "Life Plus", premium: 421, monthly: 35.08, commission: 63.15, score: 4.6, coverages: ["Θάνατος", "Ατύχημα"], availability: "Ισχύει έως 12/11/2026" },
    ],
  },
  Επιχείρηση: {
    customer: "Τεχνική Δομή Α.Ε.",
    title: "Επαγγελματικός χώρος · 12 εργαζόμενοι",
    fields: [["Δραστηριότητα", "Τεχνικές υπηρεσίες"], ["Κύκλος εργασιών", "840.000 €"], ["Εργαζόμενοι", "12"], ["Έδρα", "Περιστέρι"]],
    quotes: [
      { id: "b1", carrier: "AIG", initials: "AIG", colour: "#2856a5", product: "Business Complete", premium: 1120, monthly: 93.33, commission: 168, score: 4.8, coverages: ["Αστική ευθύνη", "Πυρός", "Νομική προστασία"], recommended: true, availability: "Ισχύει έως 08/11/2026" },
      { id: "b2", carrier: "Allianz", initials: "AL", colour: "#2493a1", product: "Business Protect", premium: 1260, monthly: 105, commission: 189, score: 4.6, coverages: ["Αστική ευθύνη", "Περιουσία"], availability: "Ισχύει έως 08/11/2026" },
    ],
  },
};

const mockOffers: OfferRow[] = [
  { id: "o1", code: "ΠΡ-2026-00482", customer: "Χάρης Μπερτσιάς", branch: "Αυτοκίνητο", carrier: "Νέος Ποσειδώνας", premium: 118.71, status: "Έτοιμη", updated: "09/10/2026 18:42" },
  { id: "o2", code: "ΠΡ-2026-00481", customer: "Μαρία Παπαδοπούλου", branch: "Κατοικία", carrier: "ERGO", premium: 154.2, status: "Στάλθηκε", updated: "09/10/2026 16:18" },
  { id: "o3", code: "ΠΡ-2026-00477", customer: "Γιώργος Αντωνίου", branch: "Υγεία", carrier: "Eurolife FFH", premium: 684, status: "Επιλέχθηκε", updated: "08/10/2026 11:05" },
  { id: "o4", code: "ΠΡ-2026-00459", customer: "Αλέξανδρος Μιχαηλίδης", branch: "Ζωή", carrier: "Generali", premium: 392, status: "Ληγμένη", updated: "06/10/2026 13:21" },
  { id: "o5", code: "ΠΡ-2026-00456", customer: "Τεχνική Δομή Α.Ε.", branch: "Επιχείρηση", carrier: "AIG", premium: 1120, status: "Στάλθηκε", updated: "05/10/2026 09:40" },
];

const currency = (value: number) => value.toLocaleString("el-GR", { style: "currency", currency: "EUR" });
const quoteRisk = (quote: QuoteRow) => quote.score >= 4.7 ? "Χαμηλός" : quote.score >= 4.5 ? "Μεσαίος" : "Υψηλός";
const riskColour = (risk: string): "success" | "warning" | "error" => risk === "Χαμηλός" ? "success" : risk === "Μεσαίος" ? "warning" : "error";
const statusColour: Record<OfferRow["status"], "success" | "info" | "warning" | "error"> = {
  Έτοιμη: "info", Στάλθηκε: "warning", Επιλέχθηκε: "success", Ληγμένη: "error",
};

function viewFromQuery(value: string | null): ViewKey {
  return value === "quotes" || value === "print-pay" || value === "pay-print" || value === "requests" || value === "history" ? value : "dashboard";
}

export function FrontOfficeQuotingPage({ standalone = false }: { standalone?: boolean }) {
  const [params, setParams] = useSearchParams();
  const view = viewFromQuery(params.get("view"));
  const [branch, setBranch] = useState<BranchKey>("Αυτοκίνητο");
  const [search, setSearch] = useState("");
  const [onlyRecommended, setOnlyRecommended] = useState(false);
  const [sortBy, setSortBy] = useState<"premium" | "score">("premium");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const preset = branchPresets[branch];

  const quotes = useMemo(() => {
    const filtered = preset.quotes.filter((q) => (!search || `${q.carrier} ${q.product}`.toLowerCase().includes(search.toLowerCase())) && (!onlyRecommended || q.recommended));
    return [...filtered].sort((a, b) => sortBy === "premium" ? a.premium - b.premium : b.score - a.score);
  }, [onlyRecommended, preset.quotes, search, sortBy]);

  const go = (next: ViewKey) => setParams({ view: next });

  return (
    <Box sx={standalone ? { minHeight: "100vh", bgcolor: "#edf3f8", pb: 6, color: "#172a3a" } : { maxWidth: 1540, mx: "auto", pb: 5 }}>
      {standalone && <StandalonePluginHeader view={view} onNavigate={go} />}
      <Box sx={standalone ? { maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, pt: { xs: 2, md: 3 } } : undefined}>
      {!standalone && <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={2} sx={{ mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(135deg,#123a64,#168f9a)" }}><CalculateOutlinedIcon /></Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -0.5 }}>Πολυτιμολόγηση & προσφορές</Typography>
            <Typography color="text.secondary">Συγκρίνετε εικονικές προσφορές ανά κλάδο σε λίγα βήματα.</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<ShieldOutlinedIcon />} label="Οπτική προεπισκόπηση · χωρίς διασύνδεση" sx={{ bgcolor: "#fff4df", color: "#8b5a00", fontWeight: 700 }} />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => { setSearch(""); setOnlyRecommended(false); }}>Νέα σύγκριση</Button>
        </Stack>
      </Stack>}

      {standalone && view === "dashboard" && <StandaloneBranchPanel branch={branch} setBranch={setBranch} />}

      {!standalone && <Paper variant="outlined" sx={{ borderRadius: 2.5, mb: 2.5, overflow: "hidden", bgcolor: "#f7f9fc" }}>
        <Tabs value={view} onChange={(_, next: ViewKey) => go(next)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 54, "& .MuiTab-root": { minHeight: 54, fontWeight: 750, textTransform: "none" } }}>
          <Tab value="dashboard" icon={<CalculateOutlinedIcon fontSize="small" />} iconPosition="start" label="Νέα σύγκριση" />
          <Tab value="quotes" icon={<LocalOfferOutlinedIcon fontSize="small" />} iconPosition="start" label="Προσφορές" />
          <Tab value="print-pay" icon={<PrintOutlinedIcon fontSize="small" />} iconPosition="start" label="Τυπώνω – Πληρώνω" />
          <Tab value="pay-print" icon={<PaymentsOutlinedIcon fontSize="small" />} iconPosition="start" label="Πληρώνω – Τυπώνω" />
          <Tab value="requests" icon={<DescriptionOutlinedIcon fontSize="small" />} iconPosition="start" label="Αιτήσεις ασφάλισης" />
          <Tab value="history" icon={<HistoryOutlinedIcon fontSize="small" />} iconPosition="start" label="Ιστορικό" />
        </Tabs>
      </Paper>}

      {view === "dashboard" || view === "quotes" ? (
        <QuoteWorkspace branch={branch} setBranch={setBranch} preset={preset} quotes={quotes} search={search} setSearch={setSearch} onlyRecommended={onlyRecommended} setOnlyRecommended={setOnlyRecommended} sortBy={sortBy} setSortBy={setSortBy} onOpen={setSelectedQuote} onGoOffers={() => go("quotes")} />
      ) : view === "print-pay" ? <PrintPayView /> : view === "pay-print" ? <PayPrintView /> : view === "requests" ? <RequestsView /> : <HistoryView />}

      <Dialog open={!!selectedQuote} onClose={() => setSelectedQuote(null)} fullWidth maxWidth="sm">
        {selectedQuote && <>
          <DialogTitle sx={{ fontWeight: 800 }}>Αναλυτική προσφορά · {selectedQuote.carrier}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={800}>{selectedQuote.product}</Typography><Typography color="text.secondary">Ενδεικτικό πακέτο για {preset.title}</Typography></Box><Typography variant="h5" fontWeight={850} color="primary.main">{currency(selectedQuote.premium)}</Typography></Stack>
              <Divider />
              <Typography fontWeight={750}>Περιλαμβάνει</Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>{selectedQuote.coverages.map((coverage) => <Chip key={coverage} icon={<CheckCircleRoundedIcon />} color="success" variant="outlined" label={coverage} />)}</Stack>
              <Alert severity="info">Η τιμή είναι ενδεικτική προεπισκόπηση. Η τελική έκδοση θα ενεργοποιηθεί όταν ολοκληρωθεί η διασύνδεση του γραφείου.</Alert>
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setSelectedQuote(null)}>Κλείσιμο</Button><Button variant="contained" color="success" startIcon={<CheckCircleRoundedIcon />} onClick={() => setSelectedQuote(null)}>Επιλογή προσφοράς</Button></DialogActions>
        </>}
      </Dialog>
      </Box>
    </Box>
  );
}

const standaloneNav: { value: ViewKey; label: string; icon: ReactElement }[] = [
  { value: "dashboard", label: "Αρχική", icon: <CalculateOutlinedIcon fontSize="small" /> },
  { value: "quotes", label: "Προσφορές", icon: <LocalOfferOutlinedIcon fontSize="small" /> },
  { value: "print-pay", label: "Τυπώνω – Πληρώνω", icon: <PrintOutlinedIcon fontSize="small" /> },
  { value: "pay-print", label: "Πληρώνω – Τυπώνω", icon: <PaymentsOutlinedIcon fontSize="small" /> },
  { value: "requests", label: "Αιτήσεις", icon: <DescriptionOutlinedIcon fontSize="small" /> },
  { value: "history", label: "Ιστορικό", icon: <HistoryOutlinedIcon fontSize="small" /> },
];

function StandalonePluginHeader({ view, onNavigate }: { view: ViewKey; onNavigate: (value: ViewKey) => void }) {
  return <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #ccd8e3", boxShadow: "0 3px 16px rgba(18,58,100,.08)" }}>
    <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 1.25, md: 1.5 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
        <Box component="img" src="/assets/insureone-plugin-logo.png" alt="InsureOne Kalypsis Plugin" sx={{ width: { xs: 240, sm: 340, md: 390 }, height: { xs: 82, sm: 108, md: 124 }, objectFit: "contain", objectPosition: "left center" }} />
        <Box sx={{ display: { xs: "none", md: "block" }, pl: 1.5, borderLeft: "1px solid #d9e3ec" }}>
          <Typography sx={{ color: "#123a64", fontWeight: 900, fontSize: 14, letterSpacing: .5 }}>ΠΟΛΥΤΙΜΟΛΟΓΗΣΗ</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: { md: 360 }, fontSize: { md: 12 } }}>Πολυτιμολόγηση μέσω του InsureOne, ενός προϊόντος της KALYPSIS</Typography>
        </Box>
      </Stack>
    </Box>
    <Box sx={{ bgcolor: "#123a64", borderTop: "1px solid rgba(255,255,255,.12)" }}>
      <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: .5, sm: 2.5, lg: 4 } }}>
        <Tabs value={view} onChange={(_, next: ViewKey) => onNavigate(next)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ minHeight: 52, "& .MuiTabs-indicator": { bgcolor: "#53c6d3", height: 3 }, "& .MuiTab-root": { minHeight: 52, color: "rgba(255,255,255,.76)", fontWeight: 750, textTransform: "none", fontSize: { xs: 12, sm: 13 }, px: { xs: 1.25, sm: 2 }, "&.Mui-selected": { color: "#fff", bgcolor: "rgba(83,198,211,.16)" }, "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,.08)" } } }}>
          {standaloneNav.map((item) => <Tab key={item.value} value={item.value} icon={item.icon} iconPosition="start" label={item.label} />)}
        </Tabs>
      </Box>
    </Box>
  </Box>;
}

function StandaloneBranchPanel({ branch, setBranch }: { branch: BranchKey; setBranch: (value: BranchKey) => void }) {
  const cards: { key: BranchKey; title: string; subtitle: string; icon: ReactNode; colour: string }[] = [
    { key: branchLabels[0], title: "Οχήματα", subtitle: "Αυτοκίνητο & στόλος", icon: <DirectionsCarFilledOutlinedIcon />, colour: "#148a96" },
    { key: branchLabels[1], title: "Κατοικία", subtitle: "Περιουσία & κατοικίες", icon: <HomeWorkOutlinedIcon />, colour: "#3567b8" },
    { key: branchLabels[2], title: "Υγεία", subtitle: "Ατομικά & οικογενειακά", icon: <HealthAndSafetyOutlinedIcon />, colour: "#16876e" },
    { key: branchLabels[3], title: "Ζωή", subtitle: "Προστασία & αποταμίευση", icon: <ShieldOutlinedIcon />, colour: "#8a5bc2" },
    { key: branchLabels[4], title: "Επιχείρηση", subtitle: "Επαγγελματικοί κίνδυνοι", icon: <BusinessCenterOutlinedIcon />, colour: "#c26a2c" },
    { key: branchLabels[0], title: "Ταξίδι & βοήθεια", subtitle: "Ταξιδιωτική κάλυψη", icon: <LuggageOutlinedIcon />, colour: "#247f9e" },
    { key: branchLabels[1], title: "Νομική προστασία", subtitle: "Νομικές δαπάνες", icon: <GavelOutlinedIcon />, colour: "#5f6d7c" },
    { key: branchLabels[0], title: "Σκάφος", subtitle: "Σκάφη αναψυχής", icon: <SailingOutlinedIcon />, colour: "#22679b" },
  ];
  return <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 3, borderColor: "#cad8e5", background: "linear-gradient(130deg,#fff 0%,#f5fbfd 66%,#eaf6f7 100%)", overflow: "hidden" }}>
    <CardContent sx={{ p: { xs: 2, md: 2.75 } }}>
      <Grid container spacing={{ xs: 2, md: 3 }} alignItems="stretch">
        <Grid item xs={12} md={8}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
            <Box><Typography variant="h5" sx={{ color: "#123a64", fontWeight: 900 }}>Ξεκινήστε νέα σύγκριση</Typography><Typography variant="body2" color="text.secondary">Επιλέξτε κλάδο και συμπληρώστε τα στοιχεία του κινδύνου.</Typography></Box>
            <Chip icon={<CompareArrowsRoundedIcon />} label="8 διαθέσιμοι κλάδοι" sx={{ bgcolor: "#fff", border: "1px solid #d7e4ed", fontWeight: 750 }} />
          </Stack>
          <Grid container spacing={1.25}>{cards.map((card) => <Grid item xs={6} sm={4} key={`${card.title}-${card.subtitle}`}><Button onClick={() => setBranch(card.key)} fullWidth sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 1, textAlign: "left", minHeight: 74, p: 1.15, borderRadius: 2, color: "#172a3a", bgcolor: branch === card.key && card.title !== "Ταξίδι & βοήθεια" && card.title !== "Νομική προστασία" && card.title !== "Σκάφος" ? `${card.colour}16` : "#fff", border: branch === card.key && card.title !== "Ταξίδι & βοήθεια" && card.title !== "Νομική προστασία" && card.title !== "Σκάφος" ? `2px solid ${card.colour}` : "1px solid #d8e3eb", "&:hover": { bgcolor: `${card.colour}18`, borderColor: card.colour } }}><Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: "grid", placeItems: "center", color: "#fff", bgcolor: card.colour, flexShrink: 0 }}>{card.icon}</Box><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={850} noWrap>{card.title}</Typography><Typography variant="caption" color="text.secondary" noWrap>{card.subtitle}</Typography></Box></Button></Grid>)}</Grid>
        </Grid>
        <Grid item xs={12} md={4}><Box sx={{ height: "100%", borderRadius: 2.5, bgcolor: "#123a64", color: "#fff", p: { xs: 2, md: 2.25 }, position: "relative", overflow: "hidden" }}><Box sx={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", right: -80, top: -90, bgcolor: "rgba(83,198,211,.2)" }} /><Stack spacing={1.5} sx={{ position: "relative" }}><Stack direction="row" spacing={1} alignItems="center"><AnnouncementOutlinedIcon sx={{ color: "#72d5dc" }} /><Typography fontWeight={900}>Χρήσιμες ενημερώσεις</Typography></Stack><Typography variant="body2" sx={{ color: "rgba(255,255,255,.82)" }}>Συγκρίνετε καλύψεις, ασφάλιστρα και παροχές σε ένα ενιαίο περιβάλλον.</Typography><Divider sx={{ borderColor: "rgba(255,255,255,.18)" }} /><Stack direction="row" justifyContent="space-between"><Box><Typography variant="caption" sx={{ color: "#8ddde1" }}>Ασφαλιστικές</Typography><Typography variant="h5" fontWeight={900}>12+</Typography></Box><Box><Typography variant="caption" sx={{ color: "#8ddde1" }}>Ενδεικτικές προσφορές</Typography><Typography variant="h5" fontWeight={900}>24</Typography></Box><Box><Typography variant="caption" sx={{ color: "#8ddde1" }}>Μέσος χρόνος</Typography><Typography variant="h5" fontWeight={900}>&lt;1′</Typography></Box></Stack><Button variant="contained" endIcon={<OpenInNewRoundedIcon />} onClick={() => document.getElementById("quote-workspace-form")?.scrollIntoView({ behavior: "smooth", block: "start" })} sx={{ alignSelf: "flex-start", bgcolor: "#53c6d3", color: "#123a64", fontWeight: 850, "&:hover": { bgcolor: "#78d9df" } }}>Άνοιγμα φόρμας</Button></Stack></Box></Grid>
      </Grid>
    </CardContent>
  </Card>;
}

function QuoteWorkspace({ branch, setBranch, preset, quotes, search, setSearch, onlyRecommended, setOnlyRecommended, sortBy, setSortBy, onOpen, onGoOffers }: { branch: BranchKey; setBranch: (value: BranchKey) => void; preset: typeof branchPresets[BranchKey]; quotes: QuoteRow[]; search: string; setSearch: (value: string) => void; onlyRecommended: boolean; setOnlyRecommended: (value: boolean) => void; sortBy: "premium" | "score"; setSortBy: (value: "premium" | "score") => void; onOpen: (quote: QuoteRow) => void; onGoOffers: () => void }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [coverageFilters, setCoverageFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const carriers = useMemo(() => [...new Set(preset.quotes.map(item => item.carrier))], [preset.quotes]);
  const coverages = useMemo(() => [...new Set(preset.quotes.flatMap(item => item.coverages))], [preset.quotes]);
  const visibleQuotes = useMemo(() => quotes.filter(item => {
    const carrierMatches = carrierFilter === "all" || item.carrier === carrierFilter;
    const riskMatches = riskFilter === "all" || quoteRisk(item) === riskFilter;
    const coverageMatches = coverageFilters.length === 0 || coverageFilters.every(coverage => item.coverages.includes(coverage));
    return carrierMatches && riskMatches && coverageMatches;
  }), [carrierFilter, coverageFilters, quotes, riskFilter]);
  const filterCount = (carrierFilter !== "all" ? 1 : 0) + (riskFilter !== "all" ? 1 : 0) + coverageFilters.length;
  const clearAdvancedFilters = () => { setCarrierFilter("all"); setRiskFilter("all"); setCoverageFilters([]); };
  return <>
    <Grid id="quote-workspace-form" container spacing={2} sx={{ mb: 2.5 }}>
      {[{ label: "Ενδεικτικές προσφορές", value: quotes.length, icon: <LocalOfferOutlinedIcon />, colour: "#147f8d" }, { label: "Χαμηλότερο ασφάλιστρο", value: quotes[0] ? currency(quotes[0].premium) : "—", icon: <EuroRoundedIcon />, colour: "#1b7f55" }, { label: "Ασφαλιστικές", value: "12", icon: <CompareArrowsRoundedIcon />, colour: "#3457a6" }, { label: "Μέσος χρόνος σύγκρισης", value: "< 1′", icon: <SpeedRoundedIcon />, colour: "#a85f19" }].map((stat) => <Grid item key={stat.label} xs={6} md={3}><Card variant="outlined" sx={{ height: "100%", borderRadius: 2.5 }}><CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="caption" color="text.secondary">{stat.label}</Typography><Typography variant="h5" fontWeight={850}>{stat.value}</Typography></Box><Box sx={{ color: stat.colour, bgcolor: `${stat.colour}16`, borderRadius: 2, p: 1 }}>{stat.icon}</Box></Stack></CardContent></Card></Grid>)}</Grid>

    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2.5, bgcolor: "#fbfcfe" }}><CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}><Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}><Typography variant="body2" fontWeight={800} sx={{ mr: { md: "auto" } }}>Φίλτρα σύγκρισης</Typography><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Ασφαλιστική εταιρεία</InputLabel><Select label="Ασφαλιστική εταιρεία" value={carrierFilter} onChange={event => setCarrierFilter(event.target.value)}><MenuItem value="all">Όλες οι εταιρείες</MenuItem>{carriers.map(carrier => <MenuItem key={carrier} value={carrier}>{carrier}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 145 }}><InputLabel>Επίπεδο κινδύνου</InputLabel><Select label="Επίπεδο κινδύνου" value={riskFilter} onChange={event => setRiskFilter(event.target.value)}><MenuItem value="all">Όλα τα επίπεδα</MenuItem><MenuItem value="Χαμηλός">Χαμηλός</MenuItem><MenuItem value="Μεσαίος">Μεσαίος</MenuItem><MenuItem value="Υψηλός">Υψηλός</MenuItem></Select></FormControl><Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setFiltersOpen(true)}>Καλύψεις {filterCount > 0 ? `(${filterCount})` : ""}</Button>{filterCount > 0 && <Button size="small" color="error" onClick={clearAdvancedFilters}>Καθαρισμός</Button>}<Stack direction="row" spacing={0.5} sx={{ ml: { md: 1 } }}><Tooltip title="Προβολή πίνακα"><IconButton size="small" color={viewMode === "table" ? "primary" : "default"} onClick={() => setViewMode("table")}><TableRowsOutlinedIcon /></IconButton></Tooltip><Tooltip title="Προβολή καρτών"><IconButton size="small" color={viewMode === "cards" ? "primary" : "default"} onClick={() => setViewMode("cards")}><GridViewOutlinedIcon /></IconButton></Tooltip></Stack></Stack><Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{visibleQuotes.length} διαθέσιμες προσφορές · τα φίλτρα εφαρμόζονται μόνο στην τοπική προεπισκόπηση.</Typography></CardContent></Card>
    {viewMode === "table" && <QuoteComparisonTable quotes={visibleQuotes} onOpen={onOpen} />}
    <Grid container spacing={2.5} alignItems="flex-start">
      <Grid item xs={12} lg={4}><Card variant="outlined" sx={{ borderRadius: 2.5, position: { lg: "sticky" }, top: { lg: 16 } }}><CardContent sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}><Typography variant="h6" fontWeight={850}>Στοιχεία κινδύνου</Typography><Chip size="small" label="Βήμα 1 από 4" color="primary" variant="outlined" /></Stack><Stack spacing={1.5}><TextField size="small" label="Κλάδος ασφάλισης" select value={branch} onChange={(e) => setBranch(e.target.value as BranchKey)} fullWidth>{branchLabels.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><TextField size="small" label="Πελάτης" defaultValue={preset.customer} fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />{preset.fields.map(([label, value]) => <TextField key={label} size="small" label={label} defaultValue={value} fullWidth />)}<Stack direction="row" spacing={1}><TextField size="small" label="Έναρξη" defaultValue="24/10/2026" fullWidth /><TextField size="small" label="Διάρκεια" defaultValue="12 μήνες" fullWidth /></Stack><Alert icon={false} severity="info" sx={{ fontSize: 12 }}>Τα δεδομένα είναι ενδεικτικά και δεν αποστέλλονται σε ασφαλιστική.</Alert><Button variant="contained" fullWidth startIcon={<CompareArrowsRoundedIcon />} onClick={onGoOffers}>Σύγκριση προσφορών</Button></Stack></CardContent></Card></Grid>
      <Grid item xs={12} lg={8}><Stack spacing={2}><Card variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent sx={{ p: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between"><Box><Typography variant="h6" fontWeight={850}>Προσφορές για {preset.title}</Typography><Typography variant="body2" color="text.secondary">Επιλέξτε το πρόγραμμα που ταιριάζει καλύτερα στον πελάτη.</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><TextField size="small" placeholder="Αναζήτηση ασφαλιστικής" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} sx={{ minWidth: { sm: 230 } }} /><Tooltip title="Φίλτρα προσφορών"><IconButton><FilterListOutlinedIcon /></IconButton></Tooltip></Stack></Stack><Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" mt={1.5}><FormControlLabel control={<Checkbox size="small" checked={onlyRecommended} onChange={(e) => setOnlyRecommended(e.target.checked)} />} label="Μόνο προτεινόμενα" /><Select size="small" value={sortBy} onChange={(e) => setSortBy(e.target.value as "premium" | "score")}><MenuItem value="premium">Ταξινόμηση: χαμηλότερη τιμή</MenuItem><MenuItem value="score">Ταξινόμηση: αξιολόγηση</MenuItem></Select></Stack></CardContent></Card>{quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} onOpen={() => onOpen(quote)} />)}{quotes.length === 0 && <Alert severity="info">Δεν βρέθηκαν προσφορές με τα επιλεγμένα φίλτρα.</Alert>}</Stack></Grid>
    </Grid>
    <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} fullWidth maxWidth="sm"><DialogTitle sx={{ fontWeight: 850 }}>Καλύψεις και προτιμήσεις κινδύνου</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" mb={1.5}>Επιλέξτε μία ή περισσότερες καλύψεις που πρέπει να περιλαμβάνει η προσφορά.</Typography><Stack spacing={0.4}>{coverages.map(coverage => <FormControlLabel key={coverage} control={<Checkbox checked={coverageFilters.includes(coverage)} onChange={event => setCoverageFilters(current => event.target.checked ? [...current, coverage] : current.filter(item => item !== coverage))} />} label={coverage} />)}</Stack><Divider sx={{ my: 2 }} /><Typography variant="body2" fontWeight={750}>Συνδυασμός φίλτρων</Typography><Typography variant="caption" color="text.secondary">Τα φίλτρα εταιρείας, κινδύνου και καλύψεων εφαρμόζονται μαζί στον συγκριτικό πίνακα.</Typography></DialogContent><DialogActions><Button color="error" onClick={clearAdvancedFilters}>Καθαρισμός</Button><Button variant="contained" onClick={() => setFiltersOpen(false)}>Εφαρμογή</Button></DialogActions></Dialog>
  </>;
}

function QuoteComparisonTable({ quotes, onOpen }: { quotes: QuoteRow[]; onOpen: (quote: QuoteRow) => void }) {
  return <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 2.5, overflow: "hidden" }}><CardContent sx={{ pb: 1.5 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}><Box><Typography variant="h6" fontWeight={850}>Συγκριτικός πίνακας προσφορών</Typography><Typography variant="body2" color="text.secondary">Μία γραμμή ανά ασφαλιστική και πακέτο, όπως σε επαγγελματικό quotation desk.</Typography></Box><Chip icon={<ShieldOutlinedIcon />} size="small" label="Ενδεικτικές τιμές" color="info" variant="outlined" /></Stack></CardContent><TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Ασφαλιστική / πακέτο</TableCell><TableCell sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Επίπεδο κινδύνου</TableCell><TableCell sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Καλύψεις</TableCell><TableCell align="right" sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Ετήσιο</TableCell><TableCell align="right" sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Μήνας</TableCell><TableCell align="right" sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Βαθμ.</TableCell><TableCell align="right" sx={{ bgcolor: "#e9eff6", fontWeight: 850 }}>Ενέργεια</TableCell></TableRow></TableHead><TableBody>{quotes.map(quote => { const risk = quoteRisk(quote); return <TableRow key={quote.id} hover sx={{ bgcolor: quote.recommended ? "rgba(28,140,108,.055)" : undefined }}><TableCell><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 30, height: 30, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: quote.colour, color: "#fff", fontSize: 11, fontWeight: 850 }}>{quote.initials}</Box><Box><Typography fontWeight={800}>{quote.carrier}</Typography><Typography variant="caption" color="text.secondary">{quote.product}{quote.recommended ? " · Προτεινόμενο" : ""}</Typography></Box></Stack></TableCell><TableCell><Chip size="small" label={risk} color={riskColour(risk)} variant="outlined" /></TableCell><TableCell><Stack direction="row" flexWrap="wrap" useFlexGap gap={0.35}>{quote.coverages.slice(0, 3).map(coverage => <Chip key={coverage} size="small" label={coverage} variant="outlined" sx={{ fontSize: 10 }} />)}{quote.coverages.length > 3 && <Chip size="small" label={`+${quote.coverages.length - 3}`} sx={{ fontSize: 10 }} />}</Stack></TableCell><TableCell align="right" sx={{ fontWeight: 850, color: "primary.main", whiteSpace: "nowrap" }}>{currency(quote.premium)}</TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{currency(quote.monthly)}</TableCell><TableCell align="right">{quote.score.toFixed(1)}</TableCell><TableCell align="right"><Button size="small" variant="contained" color="success" onClick={() => onOpen(quote)}>Επιλογή</Button></TableCell></TableRow>; })}{quotes.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>Δεν βρέθηκαν προσφορές με τα φίλτρα.</TableCell></TableRow>}</TableBody></Table></TableContainer></Card>;
}

function QuoteCard({ quote, onOpen }: { quote: QuoteRow; onOpen: () => void }) {
  return <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: quote.recommended ? "success.light" : "divider", boxShadow: quote.recommended ? "0 4px 18px rgba(33,125,83,.11)" : "none" }}><CardContent sx={{ p: 2.25 }}><Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}><Box sx={{ minWidth: 195 }}><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: quote.colour, color: "#fff", display: "grid", placeItems: "center", fontWeight: 850 }}>{quote.initials}</Box><Box><Typography fontWeight={850}>{quote.carrier}</Typography><Typography variant="body2" color="text.secondary">{quote.product}</Typography></Box></Stack>{quote.recommended && <Chip size="small" color="success" label="Προτεινόμενο" sx={{ mt: 1 }} />}</Box><Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">Καλύψεις</Typography><Stack direction="row" flexWrap="wrap" useFlexGap gap={0.6} mt={0.5}>{quote.coverages.map((coverage) => <Chip key={coverage} size="small" label={coverage} variant="outlined" />)}</Stack><Typography variant="caption" color="text.secondary" display="block" mt={1}>Βαθμολογία {quote.score.toFixed(1)} / 5 · {quote.availability}</Typography></Box><Box sx={{ minWidth: 145, textAlign: { md: "right" } }}><Typography variant="caption" color="text.secondary">Ετήσιο ασφάλιστρο</Typography><Typography variant="h5" fontWeight={900} color="primary.main">{currency(quote.premium)}</Typography><Typography variant="body2" color="text.secondary">ή {currency(quote.monthly)} / μήνα</Typography><Typography variant="caption" color="success.main">Προμήθεια {currency(quote.commission)}</Typography></Box><Stack direction={{ xs: "row", md: "column" }} spacing={1}><Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={onOpen}>Καλύψεις</Button><Button size="small" variant="contained" color="success" endIcon={<KeyboardArrowRightRoundedIcon />} onClick={onOpen}>Επιλογή</Button></Stack></Stack></CardContent></Card>;
}

function PrintPayView() {
  const rows = [{ code: "ΠΡ-2026-00482", customer: "Χάρης Μπερτσιάς", amount: 118.71, status: "Έτοιμο για εκτύπωση" }, { code: "ΠΡ-2026-00479", customer: "Ιωάννα Κωνσταντίνου", amount: 164.4, status: "Αναμονή επιβεβαίωσης" }, { code: "ΠΡ-2026-00476", customer: "Τεχνική Δομή Α.Ε.", amount: 1120, status: "Έτοιμο για εκτύπωση" }];
  return <WorkflowView title="Τυπώνω – Πληρώνω" icon={<PrintOutlinedIcon />} subtitle="Συγκεντρώστε τις επιλεγμένες προσφορές, εκτυπώστε το έντυπο και σημειώστε την πληρωμή." rows={rows} primary="Προεπισκόπηση πακέτου" />;
}

function PayPrintView() {
  const rows = [{ code: "ΠΛ-2026-00118", customer: "Μαρία Παπαδοπούλου", amount: 154.2, status: "Πληρωμή προς επιβεβαίωση" }, { code: "ΠΛ-2026-00112", customer: "Γιώργος Αντωνίου", amount: 684, status: "Εξοφλήθηκε" }, { code: "ΠΛ-2026-00106", customer: "Αλέξανδρος Μιχαηλίδης", amount: 392, status: "Αναμονή εκτύπωσης" }];
  return <WorkflowView title="Πληρώνω – Τυπώνω" icon={<PaymentsOutlinedIcon />} subtitle="Παρακολουθήστε τις εικονικές πληρωμές και κρατήστε την έκδοση οργανωμένη σε ένα βήμα." rows={rows} primary="Καταχώρηση πληρωμής" />;
}

function WorkflowView({ title, subtitle, icon, rows, primary }: { title: string; subtitle: string; icon: ReactNode; rows: { code: string; customer: string; amount: number; status: string }[]; primary: string }) {
  return <Stack spacing={2.5}><Card variant="outlined" sx={{ borderRadius: 2.5, background: "linear-gradient(115deg,#f3f8ff,#f5fbfa)" }}><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ bgcolor: "#123a64", color: "#fff", p: 1.2, borderRadius: 2 }}>{icon}</Box><Box><Typography variant="h5" fontWeight={850}>{title}</Typography><Typography color="text.secondary">{subtitle}</Typography></Box></Stack><Alert severity="info" sx={{ mt: 2 }}>Προσομοίωση ροής · οι πληρωμές και η εκτύπωση θα συνδεθούν με τον πάροχο μετά την ενεργοποίηση της διασύνδεσης.</Alert></CardContent></Card><Card variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}><TableContainer><Table><TableHead><TableRow sx={{ bgcolor: "#eef2f6" }}><TableCell>Κωδικός</TableCell><TableCell>Πελάτης</TableCell><TableCell>Ποσό</TableCell><TableCell>Κατάσταση</TableCell><TableCell align="right">Ενέργειες</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.code} hover><TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.code}</TableCell><TableCell>{row.customer}</TableCell><TableCell sx={{ fontWeight: 800 }}>{currency(row.amount)}</TableCell><TableCell><Chip size="small" label={row.status} color={row.status.includes("Εξοφλήθηκε") ? "success" : "warning"} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Προβολή</Button><Button size="small" variant="contained" sx={{ ml: 1 }} startIcon={title.startsWith("Τυπ") ? <PrintOutlinedIcon /> : <WalletOutlinedIcon />}>{primary}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Card></Stack>;
}

function RequestsView() {
  return <Stack spacing={2.5}><Card variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent sx={{ p: 3 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}><Box><Typography variant="h5" fontWeight={850}>Αιτήσεις ασφάλισης</Typography><Typography color="text.secondary">Νέα αιτήματα από την ιστοσελίδα ή τον ασφαλιστή, έτοιμα για σύγκριση.</Typography></Box><Button variant="contained" startIcon={<DescriptionOutlinedIcon />}>Νέα αίτηση</Button></Stack></CardContent></Card><Grid container spacing={2}>{[{ name: "Χάρης Μπερτσιάς", branch: "Αυτοκίνητο", received: "Μόλις τώρα", state: "Νέα" }, { name: "Μαρία Παπαδοπούλου", branch: "Κατοικία", received: "09/10/2026 16:18", state: "Σε επεξεργασία" }, { name: "Τεχνική Δομή Α.Ε.", branch: "Επιχείρηση", received: "08/10/2026 11:05", state: "Έτοιμη προσφορά" }].map((request) => <Grid item xs={12} md={4} key={request.name}><Card variant="outlined" sx={{ borderRadius: 2.5, height: "100%" }}><CardContent><Stack direction="row" justifyContent="space-between"><Chip size="small" label={request.branch} color="primary" variant="outlined" /><Chip size="small" label={request.state} color={request.state === "Νέα" ? "info" : "success"} /></Stack><Typography fontWeight={800} mt={2}>{request.name}</Typography><Typography variant="body2" color="text.secondary">Παραλήφθηκε {request.received}</Typography><Button fullWidth sx={{ mt: 2 }} variant="outlined" endIcon={<KeyboardArrowRightRoundedIcon />}>Άνοιγμα αιτήματος</Button></CardContent></Card></Grid>)}</Grid></Stack>;
}

function HistoryView() {
  const [query, setQuery] = useState("");
  const visible = mockOffers.filter((offer) => !query || `${offer.code} ${offer.customer} ${offer.carrier}`.toLowerCase().includes(query.toLowerCase()));
  return <Stack spacing={2.5}><Card variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent sx={{ p: 2.5 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5}><Box><Typography variant="h5" fontWeight={850}>Ιστορικό προσφορών</Typography><Typography color="text.secondary">Αποθηκευμένες προσφορές, επιλεγμένα πακέτα και παρακολούθηση κατάστασης.</Typography></Box><Stack direction="row" spacing={1}><TextField size="small" placeholder="Αναζήτηση" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} /><Button variant="outlined" startIcon={<DownloadOutlinedIcon />}>Εξαγωγή</Button></Stack></Stack></CardContent></Card><Card variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}><TableContainer><Table><TableHead><TableRow sx={{ bgcolor: "#eef2f6" }}><TableCell>Κωδικός</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell><TableCell>Τελευταία ενημέρωση</TableCell></TableRow></TableHead><TableBody>{visible.map((offer) => <TableRow key={offer.id} hover><TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{offer.code}</TableCell><TableCell>{offer.customer}</TableCell><TableCell>{offer.branch}</TableCell><TableCell>{offer.carrier}</TableCell><TableCell sx={{ fontWeight: 800 }}>{currency(offer.premium)}</TableCell><TableCell><Chip size="small" label={offer.status} color={statusColour[offer.status]} /></TableCell><TableCell>{offer.updated}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Card></Stack>;
}

