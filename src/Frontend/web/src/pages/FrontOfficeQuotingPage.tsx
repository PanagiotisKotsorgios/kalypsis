import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  MenuItem,
  Menu,
  List,
  ListItemButton,
  ListItemText,
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
  useMediaQuery,
} from "@mui/material";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EuroRoundedIcon from "@mui/icons-material/EuroRounded";
import FilterListOutlinedIcon from "@mui/icons-material/FilterListOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HealthAndSafetyOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import LuggageOutlinedIcon from "@mui/icons-material/LuggageOutlined";
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
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

type ViewKey = "dashboard" | "quotes" | "print-pay" | "pay-print" | "requests";
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
  // Το παλιό ιστορικό προσφορών δεν αποτελεί πλέον ξεχωριστή προβολή·
  // παλιές διευθύνσεις ανοίγουν με ασφάλεια την αρχική σελίδα.
  return value === "quotes" || value === "print-pay" || value === "pay-print" || value === "requests" ? value : "dashboard";
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
    <Box sx={standalone ? { minHeight: "100vh", bgcolor: "#edf3f8", pb: 2, color: "#172a3a", display: "flex", flexDirection: "column" } : { maxWidth: 1540, mx: "auto", pb: 5 }}>
      {standalone && <StandalonePluginHeader view={view} onNavigate={go} />}
      <Box sx={standalone ? { maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, pt: { xs: 2, md: 3 }, flex: 1, width: "100%" } : undefined}>
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
        </Tabs>
      </Paper>}

      {((!standalone && view === "dashboard") || view === "quotes") ? (
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
      {standalone && <StandalonePluginFooter />}
    </Box>
  );
}

function StandalonePluginFooter() {
  return <Box component="footer" sx={{ borderTop: "1px solid #cbd9e6", bgcolor: "#fff", mt: 3 }}>
    <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, py: 1.25, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: .5 }}>
      <Typography variant="body2" sx={{ color: "#526578", fontWeight: 850, fontSize: { xs: 14, sm: 15 }, letterSpacing: ".02em" }}>Powered by Kalypsis</Typography>
      <KalypsisLogo size={64} crop />
    </Box>
  </Box>;
}

const standaloneDropdowns: { key: string; label: string; views: { label: string; view: ViewKey }[] }[] = [
  { key: "production", label: "Παραγωγή", views: [
    { label: "Λίστες παραγωγής", view: "dashboard" },
    { label: "Συμβόλαια", view: "dashboard" },
    { label: "Πελάτες", view: "dashboard" },
    { label: "Αναφορές", view: "dashboard" },
    { label: "Έντυπα", view: "requests" },
    { label: "Προσφορές", view: "quotes" },
    { label: "Αιτήματα ασφάλισης", view: "requests" },
  ] },
  { key: "quoting", label: "Τιμολόγηση", views: [
    { label: "Οχημάτων", view: "dashboard" },
    { label: "Περιουσίας", view: "dashboard" },
    { label: "Υγείας", view: "dashboard" },
    { label: "Σκαφών", view: "dashboard" },
    { label: "Προσφορές", view: "quotes" },
    { label: "Αιτήσεις", view: "requests" },
    { label: "Οδικής", view: "dashboard" },
    { label: "Πράσινη Κάρτα", view: "dashboard" },
    { label: "Ποδηλάτων-Πατινιών", view: "dashboard" },
    { label: "Προσωπικού Ατυχήματος", view: "dashboard" },
    { label: "Νομική Προστασία", view: "dashboard" },
  ] },
  { key: "print-pay", label: "Τυπώνω-Πληρώνω", views: [
    { label: "Εκτύπωση Συμβολαίων", view: "print-pay" },
    { label: "Παραγγελίες Συμβολαίων", view: "print-pay" },
  ] },
];

function StandalonePluginHeader({ view, onNavigate }: { view: ViewKey; onNavigate: (value: ViewKey) => void }) {
  const { signOut } = useAuth();
  const [menu, setMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const compactNav = useMediaQuery("(max-width:1120px)");
  const activeNav = view === "dashboard" ? "home" : view === "quotes" ? "offers" : view === "requests" ? "production" : view === "print-pay" ? "print-pay" : "pay-print";
  const navButtonSx = {
    minHeight: 58,
    minWidth: "auto",
    px: { xs: 1.5, sm: 2.25, md: 2.75 },
    borderRadius: 0,
    color: "#fff",
    fontWeight: 850,
    fontSize: { xs: 13, sm: 14, md: 15 },
    letterSpacing: ".01em",
    textTransform: "none",
    whiteSpace: "nowrap",
    borderBottom: "3px solid transparent",
    transition: "background-color .16s ease, color .16s ease, border-color .16s ease",
    "&:hover": { bgcolor: "rgba(83,198,211,.2)", color: "#fff", borderBottomColor: "#53c6d3" },
  } as const;
  const officeProfile = useQuery({
    queryKey: ["agency-profile", "insureone-header"],
    queryFn: async () => (await api.get<{ name?: string | null; logoUrl?: string | null }>("/agency-profile")).data,
    staleTime: 5 * 60 * 1000,
  });
  const officeName = officeProfile.data?.name?.trim() || "Το γραφείο σας";
  const officeLogo = officeProfile.data?.logoUrl ? "/api/agency-profile/logo" : null;

  return <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #ccd8e3", boxShadow: "0 3px 16px rgba(18,58,100,.08)" }}>
    <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 1.25, md: 1.5 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0} sx={{ flex: 1 }}>
        <Box component="img" src="/assets/insureone-plugin-logo.png" alt="InsureOne Kalypsis Plugin" sx={{ width: { xs: 180, sm: 290, md: 390 }, height: { xs: 64, sm: 92, md: 124 }, objectFit: "contain", objectPosition: "left center" }} />
        <Box sx={{ display: { xs: "none", md: "block" }, pl: 1.5, borderLeft: "1px solid #d9e3ec", minWidth: 0 }}>
          <Typography sx={{ color: "#123a64", fontWeight: 900, fontSize: 14, letterSpacing: .5 }}>ΠΟΛΥΤΙΜΟΛΟΓΗΣΗ</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: { md: 720 }, fontSize: { md: 12 } }}>Πολυτιμολόγηση μέσω του InsureOne, ενός προϊόντος της KALYPSIS</Typography>
        </Box>
      </Stack>
      <Tooltip title={officeName} placement="bottom">
        <Stack direction="row" spacing={{ xs: .5, sm: 1 }} alignItems="center" justifyContent="flex-end" sx={{ flexShrink: 0, maxWidth: { xs: 100, sm: 220, md: 300 } }}>
          {officeLogo ? <Box component="img" src={officeLogo} alt={`Λογότυπο ${officeName}`} sx={{ width: { xs: 48, sm: 68, md: 88 }, height: { xs: 42, sm: 54, md: 64 }, objectFit: "contain", borderRadius: 1.25, p: .5, bgcolor: "#fff", border: "1px solid #d9e3ec" }} /> : <Box sx={{ px: { xs: .75, sm: 1.25 }, py: .75, borderRadius: 1.25, border: "1px solid #cbd9e6", bgcolor: "#f3f7fb", maxWidth: { xs: 100, sm: 160, md: 210 } }}><Typography noWrap sx={{ color: "#123a64", fontWeight: 850, fontSize: { xs: 10, sm: 12, md: 13 } }}>{officeName}</Typography></Box>}
          {officeLogo && <Typography noWrap sx={{ display: { xs: "none", sm: "block" }, color: "#123a64", fontWeight: 800, fontSize: { sm: 11, md: 12 }, maxWidth: { sm: 120, md: 170 } }}>{officeName}</Typography>}
        </Stack>
      </Tooltip>
    </Box>
    <Box sx={{ bgcolor: "#123a64", borderTop: "1px solid rgba(255,255,255,.12)" }}>
      <Box sx={{ maxWidth: 1540, mx: "auto", px: { xs: .5, sm: 2.5, lg: 4 }, display: "flex", alignItems: "center", gap: { xs: .5, sm: 1 } }}>
        {!compactNav && <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Button onClick={() => onNavigate("dashboard")} sx={{ ...navButtonSx, bgcolor: activeNav === "home" ? "#2e75b6" : "transparent", borderBottomColor: activeNav === "home" ? "#53c6d3" : "transparent" }}>Αρχική</Button>
          <Button onClick={() => onNavigate("quotes")} sx={{ ...navButtonSx, bgcolor: activeNav === "offers" ? "#2e75b6" : "transparent", borderBottomColor: activeNav === "offers" ? "#53c6d3" : "transparent" }}>Προσφορές</Button>
          {standaloneDropdowns.map((item) => {
            const active = activeNav === item.key;
            return <Fragment key={item.key}>
              <Button onClick={(event) => setMenu({ key: item.key, anchor: event.currentTarget })} endIcon={<KeyboardArrowDownRoundedIcon fontSize="small" />} sx={{ ...navButtonSx, bgcolor: active ? "#2e75b6" : "transparent", borderBottomColor: active ? "#53c6d3" : "transparent", "& .MuiButton-endIcon": { ml: .45, transition: "transform .16s ease", transform: menu?.key === item.key ? "rotate(180deg)" : "none" } }}>{item.label}</Button>
              <Menu anchorEl={menu?.key === item.key ? menu.anchor : null} open={menu?.key === item.key} onClose={() => setMenu(null)} PaperProps={{ sx: { mt: .75, minWidth: 210, border: "1px solid #cbd9e6", boxShadow: "0 10px 28px rgba(18,58,100,.2)", borderRadius: 1.5 } }} MenuListProps={{ dense: true, sx: { py: .5, "& .MuiMenuItem-root": { px: 1.75, py: 1, fontSize: 14, fontWeight: 700, color: "#173b5d", borderRadius: .75, mx: .5, "&:hover": { bgcolor: "#e6f4f7", color: "#0b6d84" } } } }}>
                {item.views.map(option => <MenuItem key={`${item.key}-${option.label}`} onClick={() => { setMenu(null); onNavigate(option.view); }}>{option.label}</MenuItem>)}
              </Menu>
            </Fragment>;
          })}
          <Button onClick={() => onNavigate("pay-print")} sx={{ ...navButtonSx, bgcolor: activeNav === "pay-print" ? "#2e75b6" : "transparent", borderBottomColor: activeNav === "pay-print" ? "#53c6d3" : "transparent" }}>Πληρώνω-Τυπώνω</Button>
        </Box>}
        {compactNav && <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <IconButton aria-label="Άνοιγμα μενού" onClick={() => setMobileNavOpen(true)} sx={{ color: "#fff", width: 48, height: 48, borderRadius: 1.25, bgcolor: "rgba(83,198,211,.18)", "&:hover": { bgcolor: "rgba(83,198,211,.35)" } }}>
            <MenuRoundedIcon />
          </IconButton>
          <Typography sx={{ color: "#fff", fontWeight: 850, fontSize: { xs: 14, sm: 16 }, whiteSpace: "nowrap" }}>Μενού InsureOne</Typography>
        </Stack>}
        <Tooltip title="Αποσύνδεση">
          <Button aria-label="Αποσύνδεση" variant="contained" color="error" size="small" onClick={() => { signOut(); window.location.assign("/login"); }} startIcon={<LogoutRoundedIcon />} sx={{ flexShrink: 0, minWidth: { xs: 38, sm: 40 }, px: { xs: 1, sm: 1.25 }, color: "#fff", fontWeight: 850, borderRadius: 1.25, bgcolor: "#c62828", "&:hover": { bgcolor: "#9f1f1f" }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: .75 } } }}>
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Αποσύνδεση</Box>
          </Button>
        </Tooltip>
        <Drawer anchor="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} ModalProps={{ keepMounted: true }}>
          <Box role="presentation" sx={{ width: { xs: "min(88vw, 340px)", sm: 380 }, height: "100%", bgcolor: "#f7fbfd" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.75, bgcolor: "#123a64", color: "#fff" }}>
              <Box><Typography sx={{ fontWeight: 900, fontSize: 17 }}>Μενού InsureOne</Typography><Typography variant="caption" sx={{ color: "rgba(255,255,255,.78)" }}>{officeName}</Typography></Box>
              <IconButton aria-label="Κλείσιμο μενού" onClick={() => setMobileNavOpen(false)} sx={{ color: "#fff" }}><CloseRoundedIcon /></IconButton>
            </Stack>
            <List sx={{ px: 1, py: 1 }}>
              <ListItemButton selected={activeNav === "home"} onClick={() => { setMobileNavOpen(false); onNavigate("dashboard"); }} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" } }}><ListItemText primary="Αρχική" primaryTypographyProps={{ fontWeight: 800 }} /></ListItemButton>
              <ListItemButton selected={activeNav === "offers"} onClick={() => { setMobileNavOpen(false); onNavigate("quotes"); }} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" } }}><ListItemText primary="Προσφορές" primaryTypographyProps={{ fontWeight: 800 }} /></ListItemButton>
              {standaloneDropdowns.map(item => {
                const expanded = mobileExpanded === item.key;
                return <Fragment key={`mobile-${item.key}`}>
                  <ListItemButton selected={activeNav === item.key} onClick={() => setMobileExpanded(current => current === item.key ? null : item.key)} sx={{ borderRadius: 1, mb: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" } }}>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 800 }} /><KeyboardArrowDownRoundedIcon sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
                  </ListItemButton>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <List disablePadding>{item.views.map(option => <ListItemButton key={`mobile-${item.key}-${option.label}`} onClick={() => { setMobileNavOpen(false); setMobileExpanded(null); onNavigate(option.view); }} sx={{ pl: 4, borderRadius: 1, color: "#31516b", "&:hover": { bgcolor: "#e6f4f7", color: "#0b6d84" } }}><ListItemText primary={option.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 650 }} /></ListItemButton>)}</List>
                  </Collapse>
                </Fragment>;
              })}
              <ListItemButton selected={activeNav === "pay-print"} onClick={() => { setMobileNavOpen(false); onNavigate("pay-print"); }} sx={{ borderRadius: 1, mt: .5, "&.Mui-selected": { bgcolor: "#dceff5", color: "#123a64" } }}><ListItemText primary="Πληρώνω-Τυπώνω" primaryTypographyProps={{ fontWeight: 800 }} /></ListItemButton>
            </List>
          </Box>
        </Drawer>
      </Box>
    </Box>
  </Box>;
}

type HomeWidgetId = "pricing" | "announcements" | "production";

function DashboardWidget({
  id,
  title,
  accent,
  span,
  height,
  order,
  minimized,
  maximized,
  onMinimize,
  onMaximize,
  onResize,
  onRefresh,
  onDragStart,
  onDragOver,
  onDrop,
  prominentHeader = false,
  children,
}: {
  id: HomeWidgetId;
  title: string;
  accent: string;
  span: number;
  height: number;
  order: number;
  minimized: boolean;
  maximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onResize: (span: number, height: number) => void;
  onRefresh: () => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  prominentHeader?: boolean;
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const resizeStart = useRef<{ x: number; y: number; span: number; height: number } | null>(null);
  const beginResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStart.current = { x: event.clientX, y: event.clientY, span, height };
    const move = (moveEvent: MouseEvent) => {
      if (!resizeStart.current) return;
      const nextSpan = Math.max(4, Math.min(12, resizeStart.current.span + Math.round((moveEvent.clientX - resizeStart.current.x) / 120)));
      const nextHeight = Math.max(150, Math.min(900, resizeStart.current.height + moveEvent.clientY - resizeStart.current.y));
      onResize(nextSpan, nextHeight);
    };
    const end = () => {
      resizeStart.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
  };
  const refresh = () => {
    setRefreshing(true);
    onRefresh();
    window.setTimeout(() => setRefreshing(false), 550);
  };
  const headerHeight = prominentHeader ? 74 : 38;
  return <Box
    id={`insureone-widget-${id}`}
    onDragEnter={event => { event.preventDefault(); setDragOver(true); }}
    onDragLeave={() => setDragOver(false)}
    onDragOver={onDragOver}
    onDrop={event => { setDragOver(false); onDrop(event); }}
    sx={{
      gridColumn: { xs: "1 / -1", md: `span ${span}` },
      order,
      minWidth: 0,
      minHeight: minimized ? "auto" : height,
      position: maximized ? "fixed" : "relative",
      inset: maximized ? { xs: 8, md: 24 } : undefined,
      zIndex: maximized ? 1400 : 1,
      bgcolor: maximized ? "#edf3f8" : undefined,
      borderRadius: 1.5,
      boxShadow: maximized ? "0 18px 50px rgba(12,39,68,.34)" : dragOver ? "0 0 0 3px rgba(23,184,209,.42)" : undefined,
      overflow: maximized ? "auto" : "visible",
    }}
  >
    <Card variant="outlined" sx={{ height: minimized ? "auto" : "100%", borderRadius: 1.5, overflow: "hidden", borderTop: `3px solid ${accent}`, bgcolor: "#fff" }}>
      <Box
        draggable
        onDragStart={onDragStart}
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: prominentHeader ? { xs: 1.5, md: 2.5 } : 1.25, py: prominentHeader ? 1.25 : .5, minHeight: headerHeight, bgcolor: prominentHeader ? "#edf6ff" : "rgba(18,58,100,.025)", borderBottom: "1px solid #dce9f4", cursor: "grab", userSelect: "none" }}
      >
        <Stack direction="row" spacing={prominentHeader ? 1.5 : .5} alignItems="center" minWidth={0}>{prominentHeader ? <GridViewOutlinedIcon sx={{ color: "#28548a", fontSize: 28 }} /> : <DragIndicatorRoundedIcon sx={{ color: "#7990a4", fontSize: 18 }} />}<Typography fontWeight={prominentHeader ? 900 : 850} noWrap sx={{ color: prominentHeader ? "#28548a" : "#515960", fontSize: prominentHeader ? { xs: 20, sm: 24, md: 28 } : 13 }}>{title}</Typography></Stack>
        <Stack direction="row" spacing={0} alignItems="center" flexShrink={0}>
          <Tooltip title="Ανανέωση"><IconButton size="small" aria-label={`Ανανέωση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={refresh} sx={{ color: "#52728e" }}><RefreshRoundedIcon fontSize="small" sx={{ animation: refreshing ? "insureone-spin .55s linear" : "none", "@keyframes insureone-spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /></IconButton></Tooltip>
          <Tooltip title={minimized ? "Επαναφορά" : "Ελαχιστοποίηση"}><IconButton size="small" aria-label={minimized ? `Επαναφορά ${title}` : `Ελαχιστοποίηση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={onMinimize} sx={{ color: "#52728e" }}><RemoveRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={maximized ? "Επαναφορά μεγέθους" : "Μεγιστοποίηση"}><IconButton size="small" aria-label={maximized ? `Επαναφορά ${title}` : `Μεγιστοποίηση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={onMaximize} sx={{ color: "#52728e" }}>{maximized ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}</IconButton></Tooltip>
        </Stack>
      </Box>
      {!minimized && <Box sx={{ height: `calc(100% - ${headerHeight}px)`, minHeight: 0 }}>{children}</Box>}
    </Card>
    {!maximized && !minimized && <Box onMouseDown={beginResize} role="separator" aria-label={`Αλλαγή μεγέθους ${title}`} sx={{ position: "absolute", right: 2, bottom: 2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 2, "&::after": { content: '""', position: "absolute", right: 2, bottom: 2, width: 10, height: 10, borderRight: "2px solid #7191a8", borderBottom: "2px solid #7191a8", opacity: .8 } }} />}
  </Box>;
}

interface PricingCardConfig {
  key: BranchKey;
  title: string;
  count: string;
  icon: ReactNode;
  colour: string;
  darkColour: string;
  gradient: string;
  contentColour: string;
  visualColour: string;
  illustration: PricingIllustrationKind;
  backgroundImage?: string;
  backgroundPosition?: string;
  photoOverlay?: string;
}

type PricingIllustrationKind = "vehicle" | "vehicle-compare" | "property" | "health" | "marine" | "accident" | "liability" | "life";

const pricingCardPhotos: Record<PricingIllustrationKind, { image: string; position: string; overlay: string }> = {
  vehicle: { image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85", position: "center 56%", overlay: "linear-gradient(90deg, rgba(6,105,163,.96) 0%, rgba(13,135,201,.78) 43%, rgba(14,88,151,.18) 100%)" },
  "vehicle-compare": { image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=85", position: "center 48%", overlay: "linear-gradient(90deg, rgba(36,55,166,.97) 0%, rgba(48,73,207,.84) 45%, rgba(36,49,144,.22) 100%)" },
  property: { image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=85", position: "center 52%", overlay: "linear-gradient(90deg, rgba(188,54,47,.96) 0%, rgba(219,70,64,.82) 46%, rgba(145,35,39,.22) 100%)" },
  health: { image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=85", position: "center 45%", overlay: "linear-gradient(90deg, rgba(0,111,101,.96) 0%, rgba(21,166,150,.8) 46%, rgba(0,88,82,.2) 100%)" },
  marine: { image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=85", position: "center 56%", overlay: "linear-gradient(90deg, rgba(191,238,250,.92) 0%, rgba(87,187,226,.76) 44%, rgba(11,105,176,.28) 100%)" },
  accident: { image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=85", position: "center 38%", overlay: "linear-gradient(90deg, rgba(255,221,111,.95) 0%, rgba(255,193,58,.82) 46%, rgba(194,111,10,.3) 100%)" },
  liability: { image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85", position: "center 48%", overlay: "linear-gradient(90deg, rgba(70,43,165,.97) 0%, rgba(103,69,211,.82) 46%, rgba(39,24,115,.3) 100%)" },
  life: { image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=85", position: "center 46%", overlay: "linear-gradient(90deg, rgba(255,183,112,.95) 0%, rgba(255,139,57,.82) 46%, rgba(218,72,13,.28) 100%)" },
};

function PricingIllustration({ kind }: { kind: PricingIllustrationKind }) {
  const stroke = "rgba(255,255,255,.72)";
  if (kind === "vehicle") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "49%", height: "100%", opacity: { xs: .38, sm: .58, md: .76 }, pointerEvents: "none" }}><svg viewBox="0 0 260 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M22 124 C67 104 112 111 148 91 C178 74 210 57 263 51 L263 150 L20 150Z" fill="rgba(255,255,255,.12)" /><path d="M84 121 L101 86 C106 76 116 71 132 70 L169 70 C179 71 190 78 197 88 L221 121Z" fill="rgba(13,87,151,.86)" stroke={stroke} strokeWidth="2" /><path d="M113 87 L131 77 L164 77 L182 88Z" fill="rgba(166,226,250,.72)" /><circle cx="117" cy="122" r="13" fill="#f5fbff" /><circle cx="117" cy="122" r="6" fill="#1b6da9" /><circle cx="192" cy="122" r="13" fill="#f5fbff" /><circle cx="192" cy="122" r="6" fill="#1b6da9" /><path d="M43 139 C102 120 168 119 246 132" fill="none" stroke="rgba(255,255,255,.26)" strokeWidth="3" /></svg></Box>;
  if (kind === "vehicle-compare") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "51%", height: "100%", opacity: { xs: .34, sm: .54, md: .72 }, pointerEvents: "none" }}><svg viewBox="0 0 270 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M75 150 L158 0 L223 0 L143 150Z" fill="rgba(23,40,168,.32)" /><path d="M162 150 L225 0 L270 0 L270 150Z" fill="rgba(118,137,255,.22)" /><path d="M178 135 L209 74" stroke="rgba(255,255,255,.68)" strokeWidth="4" strokeDasharray="13 10" /><path d="M220 145 L247 99" stroke="rgba(255,255,255,.68)" strokeWidth="4" strokeDasharray="13 10" /><path d="M119 117 L139 88 L180 88 L197 117Z" fill="rgba(20,31,128,.72)" stroke={stroke} strokeWidth="1.5" /><circle cx="139" cy="117" r="9" fill="#f5fbff" /><circle cx="178" cy="117" r="9" fill="#f5fbff" /><path d="M181 78 L193 60 L219 60 L232 78Z" fill="rgba(27,50,165,.65)" stroke={stroke} strokeWidth="1.5" /><circle cx="195" cy="78" r="6" fill="#f5fbff" /><circle cx="220" cy="78" r="6" fill="#f5fbff" /></svg></Box>;
  if (kind === "property") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "48%", height: "100%", opacity: { xs: .4, sm: .58, md: .8 }, pointerEvents: "none" }}><svg viewBox="0 0 250 150" width="100%" height="100%" preserveAspectRatio="none"><circle cx="197" cy="39" r="30" fill="rgba(255,219,184,.42)" /><path d="M116 150 L116 76 L170 34 L227 76 L227 150Z" fill="rgba(255,224,196,.56)" /><path d="M103 79 L170 27 L241 79" fill="rgba(183,52,48,.65)" stroke="rgba(255,245,233,.8)" strokeWidth="3" /><rect x="143" y="94" width="24" height="56" rx="2" fill="rgba(177,70,61,.82)" /><rect x="184" y="91" width="23" height="20" fill="rgba(255,250,229,.76)" /><rect x="184" y="118" width="23" height="20" fill="rgba(255,250,229,.76)" /><path d="M54 150 C85 118 106 116 135 150Z" fill="rgba(255,255,255,.15)" /></svg></Box>;
  if (kind === "health") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "45%", height: "100%", opacity: { xs: .34, sm: .52, md: .7 }, pointerEvents: "none" }}><svg viewBox="0 0 230 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M104 18 H128 V60 H171 V84 H128 V127 H104 V84 H61 V60 H104Z" fill="rgba(230,255,250,.8)" /><path d="M184 24 C203 33 215 47 215 68 C215 96 197 118 176 130 C155 118 138 96 138 68 C138 47 150 33 169 24 C174 21 179 21 184 24Z" fill="rgba(0,99,92,.22)" stroke="rgba(228,255,250,.64)" strokeWidth="2" /></svg></Box>;
  if (kind === "marine") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "53%", height: "100%", opacity: { xs: .42, sm: .62, md: .84 }, pointerEvents: "none" }}><svg viewBox="0 0 290 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M0 104 C38 78 66 77 98 96 C128 113 163 109 196 82 C226 58 257 61 290 79 V150 H0Z" fill="rgba(64,157,219,.4)" /><path d="M179 125 L216 125 L198 137Z" fill="rgba(17,89,157,.78)" /><path d="M198 125 L198 31 L151 125Z" fill="rgba(245,254,255,.85)" /><path d="M201 40 L232 125 H201Z" fill="rgba(27,121,192,.74)" /><path d="M15 132 C69 118 113 140 173 126 C220 115 251 118 290 132" fill="none" stroke="rgba(255,255,255,.62)" strokeWidth="3" /><path d="M0 143 C65 130 115 151 182 138 C228 130 260 133 290 143" fill="none" stroke="rgba(22,115,194,.6)" strokeWidth="3" /></svg></Box>;
  if (kind === "accident") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "46%", height: "100%", opacity: { xs: .38, sm: .58, md: .76 }, pointerEvents: "none" }}><svg viewBox="0 0 240 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M153 20 L192 34 L191 74 C190 101 174 120 153 131 C131 120 115 101 115 74 L114 34Z" fill="rgba(255,247,194,.34)" stroke="rgba(255,255,255,.72)" strokeWidth="2" /><circle cx="203" cy="64" r="11" fill="rgba(220,137,16,.78)" /><path d="M204 79 C193 82 190 96 183 108 L169 132 H205 L225 106 C234 93 226 81 214 80Z" fill="rgba(210,118,12,.74)" /><path d="M183 108 L163 96 M202 113 L216 132" stroke="rgba(181,103,9,.78)" strokeWidth="8" strokeLinecap="round" /><path d="M26 143 C69 123 103 127 137 145" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="3" /></svg></Box>;
  if (kind === "liability") return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "49%", height: "100%", opacity: { xs: .38, sm: .58, md: .8 }, pointerEvents: "none" }}><svg viewBox="0 0 255 150" width="100%" height="100%" preserveAspectRatio="none"><path d="M106 150 V42 L147 21 V150Z" fill="rgba(36,20,128,.58)" /><path d="M153 150 V59 L186 42 V150Z" fill="rgba(46,30,145,.74)" /><path d="M192 150 V25 L236 7 V150Z" fill="rgba(53,35,155,.64)" /><g fill="rgba(235,229,255,.62)"><rect x="119" y="58" width="10" height="10" /><rect x="119" y="78" width="10" height="10" /><rect x="165" y="74" width="9" height="10" /><rect x="165" y="95" width="9" height="10" /><rect x="205" y="43" width="10" height="12" /><rect x="205" y="67" width="10" height="12" /><rect x="205" y="91" width="10" height="12" /></g></svg></Box>;
  return <Box aria-hidden sx={{ position: "absolute", right: 0, top: 0, width: "52%", height: "100%", opacity: { xs: .4, sm: .6, md: .82 }, pointerEvents: "none" }}><svg viewBox="0 0 280 150" width="100%" height="100%" preserveAspectRatio="none"><circle cx="166" cy="58" r="11" fill="rgba(234,74,16,.84)" /><circle cx="204" cy="48" r="13" fill="rgba(234,74,16,.84)" /><circle cx="244" cy="68" r="9" fill="rgba(234,74,16,.84)" /><path d="M157 73 C145 78 141 96 151 113 L159 140 H183 L176 105 L188 90 L194 140 H219 L214 104 C210 88 200 74 188 72Z" fill="rgba(232,77,18,.78)" /><path d="M201 67 C188 75 185 93 195 105 L204 126 H225 L221 99 L234 81 C242 72 230 65 220 68Z" fill="rgba(232,77,18,.72)" /><path d="M233 82 C227 91 228 106 236 116 L242 135 H259 L255 111 L264 96 C270 86 260 79 252 82Z" fill="rgba(232,77,18,.64)" /><path d="M103 126 C149 107 204 109 270 128" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="3" /></svg></Box>;
}

function PricingCategoryCard({ card, selected, onSelect }: { card: PricingCardConfig; selected: boolean; onSelect: () => void }) {
  const photo = pricingCardPhotos[card.illustration];
  return <Button
    onClick={onSelect}
    fullWidth
    sx={{
      p: 0,
      minHeight: { xs: 160, sm: 190, md: 220 },
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "space-between",
      borderRadius: 2,
      overflow: "hidden",
      position: "relative",
      textAlign: "left",
      textTransform: "none",
      color: "#fff",
      background: card.gradient,
      backgroundImage: `linear-gradient(135deg, rgba(255,255,255,.12) 0%, transparent 42%), ${card.gradient}`,
      border: selected ? "2px solid #fff" : `1px solid ${card.colour}99`,
      boxShadow: selected ? `0 0 0 3px ${card.darkColour}66` : "0 5px 14px rgba(24,52,73,.12)",
      transition: "filter .18s ease, transform .18s ease, box-shadow .18s ease",
      "&:hover": { filter: "brightness(1.05)", transform: "translateY(-2px)", boxShadow: `0 8px 18px ${card.darkColour}45` },
      "&:focus-visible": { outline: `3px solid ${card.colour}`, outlineOffset: 2 },
      "&:hover .pricing-card-arrow": { transform: "translateX(4px)" },
      "&::before": { content: '""', position: "absolute", inset: 0, background: "linear-gradient(135deg, transparent 0 48%, rgba(255,255,255,.10) 49% 59%, transparent 60%)", pointerEvents: "none" },
      "&::after": { content: '""', position: "absolute", width: 150, height: 150, borderRadius: "50%", right: -50, top: -64, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", pointerEvents: "none" },
    }}
  >
    <Box aria-hidden sx={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: `${card.photoOverlay ?? photo.overlay}, url("${card.backgroundImage ?? photo.image}")`, backgroundSize: "cover", backgroundPosition: card.backgroundPosition ?? photo.position, backgroundRepeat: "no-repeat", opacity: { xs: .9, sm: .94, md: .97 }, filter: "saturate(.92) contrast(1.02)" }} />
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.25 }, display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 1.75, md: 2.25 }, position: "relative", zIndex: 1, minWidth: 0 }}>
      <Box sx={{ width: { xs: 58, sm: 78, md: 94 }, height: { xs: 58, sm: 78, md: 94 }, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.35)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 0 0 3px rgba(255,255,255,.08)", "& svg": { fontSize: { xs: 32, sm: 45, md: 58 } } }}>{card.icon}</Box>
      <Box sx={{ minWidth: 0, color: card.contentColour }}>
        <Typography fontWeight={900} sx={{ fontSize: { xs: 16, sm: 21, md: 29 }, lineHeight: 1.12, whiteSpace: "normal" }}>{card.title}</Typography>
        <Typography sx={{ mt: { xs: .65, md: .95 }, fontSize: { xs: 12, sm: 14, md: 18 }, color: card.contentColour === "#fff" ? "rgba(255,255,255,.94)" : "rgba(16,47,77,.92)", lineHeight: 1.25 }}>{card.count}</Typography>
      </Box>
    </Box>
    <Box sx={{ display: "none" }}><PricingIllustration kind={card.illustration} /></Box>
    <Box className="pricing-card-cta" sx={{ mx: { xs: 1, sm: 1.25 }, mb: { xs: 1, sm: 1.25 }, px: { xs: 1.25, md: 1.5 }, py: { xs: .8, sm: 1.05 }, borderRadius: 1.5, bgcolor: `${card.darkColour}e6`, border: "1px solid rgba(255,255,255,.35)", fontSize: { xs: 14, sm: 17, md: 21 }, lineHeight: 1, fontWeight: 900, letterSpacing: ".01em", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1, color: "#fff" }}>
      <span>Τιμολογήστε τώρα</span>
      <Box component="span" className="pricing-card-arrow" sx={{ fontSize: { xs: 21, sm: 25, md: 30 }, lineHeight: 1, ml: 1, transition: "transform .18s ease" }}>→</Box>
    </Box>
  </Button>;
}

function StandaloneHomeSections({ branch, setBranch }: { branch: BranchKey; setBranch: (value: BranchKey) => void }) {
  const pricingMobile = useMediaQuery("(max-width:599px)");
  const pricingTablet = useMediaQuery("(min-width:600px) and (max-width:899px)");
  const pricingHeight = pricingMobile ? 1520 : pricingTablet ? 980 : 870;
  const pricingCards: PricingCardConfig[] = [
    { key: branchLabels[0], title: "Οχημάτων", count: "19 ασφαλιστικά προγράμματα", icon: <DirectionsCarFilledOutlinedIcon />, colour: "#2fb8ad", darkColour: "#0873a6", gradient: "linear-gradient(135deg, #20b9ee 0%, #168ddd 60%, #41c4f2 100%)", contentColour: "#fff", visualColour: "rgba(10,77,145,.28)", illustration: "vehicle" },
    { key: branchLabels[0], title: "Σύγκριση Οχημάτων", count: "19 ασφαλιστικά προγράμματα", icon: <Box sx={{ display: "flex", alignItems: "center", "& svg": { fontSize: { xs: 22, sm: 32, md: 39 } }, "& svg + svg": { ml: -1.1, transform: "translateY(5px)" } }}><DirectionsCarFilledOutlinedIcon /><DirectionsCarFilledOutlinedIcon /></Box>, colour: "#398fc7", darkColour: "#173daf", gradient: "linear-gradient(135deg, #4765f1 0%, #2d4fd7 60%, #6178ff 100%)", contentColour: "#fff", visualColour: "rgba(14,45,138,.32)", illustration: "vehicle-compare" },
    { key: branchLabels[1], title: "Περιουσίας", count: "14 ασφαλιστικά προγράμματα", icon: <HomeWorkOutlinedIcon />, colour: "#e46659", darkColour: "#b52323", gradient: "linear-gradient(135deg, #ff827d 0%, #e94747 60%, #ff9b85 100%)", contentColour: "#fff", visualColour: "rgba(135,30,31,.3)", illustration: "property" },
    { key: branchLabels[2], title: "Υγείας", count: "12 ασφαλιστικά προγράμματα", icon: <HealthAndSafetyOutlinedIcon />, colour: "#86b7b5", darkColour: "#006c64", gradient: "linear-gradient(135deg, #32c9b7 0%, #1ba997 60%, #64d7c4 100%)", contentColour: "#fff", visualColour: "rgba(0,91,82,.28)", illustration: "health" },
    { key: branchLabels[0], title: "Σκαφών", count: "5 ασφαλιστικά προγράμματα", icon: <SailingOutlinedIcon />, colour: "#16b5d7", darkColour: "#0874b7", gradient: "linear-gradient(135deg, #6bd0f2 0%, #31a8e2 60%, #9be4f4 100%)", contentColour: "#092d57", visualColour: "rgba(20,108,185,.3)", illustration: "marine" },
    { key: branchLabels[0], title: "Προσωπικού Ατυχήματος", count: "6 ασφαλιστικά προγράμματα", icon: <Box sx={{ display: "flex", alignItems: "center", "& svg": { fontSize: { xs: 22, sm: 32, md: 39 } }, "& svg + svg": { ml: -1.35, transform: "translateY(5px)" } }}><PersonOutlineRoundedIcon /><ShieldOutlinedIcon /></Box>, colour: "#c5bd00", darkColour: "#c47600", gradient: "linear-gradient(135deg, #ffd866 0%, #ffc13c 60%, #ffe08a 100%)", contentColour: "#17365a", visualColour: "rgba(191,126,0,.25)", illustration: "accident" },
    { key: branchLabels[4], title: "Επαγγελματικής Ευθύνης", count: "9 ασφαλιστικά προγράμματα", icon: <BusinessCenterOutlinedIcon />, colour: "#7865be", darkColour: "#3d1ca5", gradient: "linear-gradient(135deg, #9373f4 0%, #6843d3 60%, #a78bf8 100%)", contentColour: "#fff", visualColour: "rgba(47,20,133,.3)", illustration: "liability" },
    { key: branchLabels[3], title: "Ζωής", count: "8 ασφαλιστικά προγράμματα", icon: <FavoriteBorderRoundedIcon />, colour: "#e5a14b", darkColour: "#e54805", gradient: "linear-gradient(135deg, #ffb36f 0%, #ff8a38 60%, #ffd078 100%)", contentColour: "#17365a", visualColour: "rgba(217,79,16,.25)", illustration: "life" },
  ];
  const announcements = [
    ["202/2024 · Ενημέρωση ασφαλιστικής αγοράς", "18/04/2024 · Εγκύκλιος"],
    ["96/2024 · Αλλαγή διαδικασίας υποβολής", "26/01/2024 · Εγκύκλιος"],
    ["14/2024 · Τεχνική ενημέρωση ηλεκτρονικού ταχυδρομείου", "09/11/2023 · Εγκύκλιος"],
    ["206/2023 · Επικαιροποίηση διαδικασίας", "09/11/2023 · Εγκύκλιος"],
  ];
  const production = [
    { month: "Μάι", contracts: 22, premium: 2840 },
    { month: "Ιούν", contracts: 27, premium: 3520 },
    { month: "Ιούλ", contracts: 31, premium: 4180 },
    { month: "Αύγ", contracts: 25, premium: 3310 },
    { month: "Σεπ", contracts: 36, premium: 4920 },
    { month: "Οκτ", contracts: 41, premium: 5680 },
  ];
  const defaultOrder: HomeWidgetId[] = ["pricing", "announcements", "production"];
  const defaultSizes: Record<HomeWidgetId, { span: number; height: number; minimized: boolean }> = {
    pricing: { span: 12, height: pricingHeight, minimized: false },
    announcements: { span: 5, height: 365, minimized: false },
    production: { span: 7, height: 365, minimized: false },
  };
  const loadLayout = () => {
    if (typeof window === "undefined") return { order: defaultOrder, sizes: defaultSizes };
    try {
      const saved = JSON.parse(window.localStorage.getItem("insureone-dashboard-layout") ?? "null") as { order?: HomeWidgetId[]; sizes?: typeof defaultSizes } | null;
      const order = saved?.order?.filter(id => defaultOrder.includes(id));
      const sizes = { ...defaultSizes, ...(saved?.sizes ?? {}) };
      const hadRemovedBlog = (saved?.order as string[] | undefined)?.includes("blog");
      if (hadRemovedBlog) sizes.pricing = { ...sizes.pricing, span: 12, height: pricingHeight };
      return { order: order?.length === defaultOrder.length ? order : defaultOrder, sizes };
    } catch { return { order: defaultOrder, sizes: defaultSizes }; }
  };
  const initialLayout = loadLayout();
  const [widgetOrder, setWidgetOrder] = useState<HomeWidgetId[]>(initialLayout.order);
  const [widgetSizes, setWidgetSizes] = useState(initialLayout.sizes);
  const [minimized, setMinimized] = useState<Record<HomeWidgetId, boolean>>(() => Object.fromEntries(defaultOrder.map(id => [id, initialLayout.sizes[id].minimized])) as Record<HomeWidgetId, boolean>);
  const [maximized, setMaximized] = useState<HomeWidgetId | null>(null);
  const dragWidget = useRef<HomeWidgetId | null>(null);
  useEffect(() => {
    window.localStorage.setItem("insureone-dashboard-layout", JSON.stringify({ order: widgetOrder, sizes: widgetSizes }));
  }, [widgetOrder, widgetSizes]);
  const resizeWidget = (id: HomeWidgetId, span: number, height: number) => setWidgetSizes(current => ({ ...current, [id]: { ...current[id], span, height } }));
  const dropWidget = (id: HomeWidgetId) => {
    const source = dragWidget.current;
    dragWidget.current = null;
    if (!source || source === id) return;
    setWidgetOrder(current => { const next = [...current]; const from = next.indexOf(source); const to = next.indexOf(id); next.splice(from, 1); next.splice(to, 0, source); return next; });
  };
  const widgetControls = (id: HomeWidgetId) => ({
    span: widgetSizes[id].span,
    height: id === "pricing" ? Math.max(widgetSizes[id].height, pricingHeight) : widgetSizes[id].height,
    order: widgetOrder.indexOf(id),
    minimized: minimized[id],
    maximized: maximized === id,
    onMinimize: () => setMinimized(current => ({ ...current, [id]: !current[id] })),
    onMaximize: () => setMaximized(current => current === id ? null : id),
    onResize: (span: number, height: number) => resizeWidget(id, span, height),
    onRefresh: () => setWidgetSizes(current => ({ ...current })),
    onDragStart: () => { dragWidget.current = id; },
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => event.preventDefault(),
    onDrop: (event: React.DragEvent<HTMLDivElement>) => { event.stopPropagation(); dropWidget(id); },
  });
  const dropWidgetAtEnd = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const source = dragWidget.current;
    dragWidget.current = null;
    if (!source) return;
    setWidgetOrder(current => [...current.filter(id => id !== source), source]);
  };
  return <Box onDragOver={event => event.preventDefault()} onDrop={dropWidgetAtEnd} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(12, minmax(0, 1fr))" }, gridAutoFlow: "dense", gap: { xs: 2, md: 2.5 }, alignItems: "start" }}>
    <DashboardWidget id="pricing" title="Τιμολόγηση" accent="#c9e2f6" prominentHeader {...widgetControls("pricing")}>
      <Card variant="outlined" sx={{ position: "relative", height: "100%", borderRadius: 1.5, overflow: "hidden", borderTop: 0, bgcolor: "#f8fcff", borderColor: "#dce5ec", "&::after": { content: '""', position: "absolute", right: -170, bottom: -210, width: 560, height: 430, borderRadius: "50% 0 0 0", border: "2px solid rgba(104,170,221,.13)", boxShadow: "0 -18px 0 rgba(104,170,221,.07), 0 -36px 0 rgba(104,170,221,.045)", pointerEvents: "none" } }}>
        <CardContent sx={{ position: "relative", zIndex: 1, p: { xs: 1.5, md: 2.5 }, height: "100%" }}>
          <Box sx={{ borderLeft: "6px solid #15bde0", pl: { xs: 1.25, md: 1.75 }, mb: { xs: 2, md: 2.75 }, py: .25 }}>
            <Typography fontWeight={900} sx={{ color: "#102f4d", fontSize: { xs: 22, sm: 30, md: 38 }, lineHeight: 1.05 }}>Τιμολόγηση</Typography>
          </Box>
          <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }}>
            {pricingCards.map((card, index) => <Grid item xs={12} sm={6} md={4} key={`${card.title}-${index}`}><PricingCategoryCard card={card} selected={branch === card.key && index < 5} onSelect={() => setBranch(card.key)} /></Grid>)}
          </Grid>
        </CardContent>
      </Card>
    </DashboardWidget>
    <DashboardWidget id="announcements" title="Ανακοινώσεις-Εγκύκλιοι" accent="#17b8d1" {...widgetControls("announcements")}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden", borderTop: "3px solid #17b8d1", bgcolor: "#fff", height: "100%" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={850} sx={{ color: "#515960" }}>Ανακοινώσεις-Εγκύκλιοι</Typography><Stack direction="row" spacing={.25}><IconButton size="small" aria-label="Ανανέωση"><RefreshRoundedIcon fontSize="small" /></IconButton><IconButton size="small" aria-label="Σύμπτυξη"><Typography fontWeight={900}>−</Typography></IconButton></Stack></Stack>
          <Divider />
          <Stack divider={<Divider flexItem />} spacing={0}>{announcements.map(([title, meta]) => <Box key={title} sx={{ py: 1 }}><Typography variant="body2" sx={{ color: "#216285", fontWeight: 850, fontSize: 12.5 }}>{title}</Typography><Typography variant="caption" color="text.secondary"><Chip size="small" label="ΣΗΜΑΝΤΙΚΟ" sx={{ height: 18, mr: .75, bgcolor: "#f18b24", color: "#fff", borderRadius: .5, fontSize: 9, fontWeight: 900 }} />{meta}</Typography></Box>)}</Stack>
        </CardContent>
      </Card>
    </DashboardWidget>
    <DashboardWidget id="production" title="Παραγωγή" accent="#1b7f55" {...widgetControls("production")}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, borderTop: "3px solid #1b7f55", bgcolor: "#fff" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}><Typography fontWeight={850} sx={{ color: "#515960" }}>Παραγωγή</Typography><Chip size="small" label="Τελευταίοι 6 μήνες" sx={{ bgcolor: "#e4f4ed", color: "#1b6848", fontWeight: 750 }} /></Stack>
          <Grid container spacing={1} sx={{ mb: 1 }}>{[["Νέα συμβόλαια", "41", "#147f8d"], ["Μικτά ασφάλιστρα", "5.680 €", "#1b7f55"], ["Μέση αξία", "138 €", "#3457a6"]].map(([label, value, colour]) => <Grid item xs={4} key={label}><Box sx={{ p: 1, bgcolor: `${colour}12`, border: `1px solid ${colour}32`, borderRadius: 1.25 }}><Typography variant="caption" color="text.secondary" noWrap>{label}</Typography><Typography fontWeight={900} sx={{ color: colour, fontSize: { xs: 15, sm: 18 } }}>{value}</Typography></Box></Grid>)}</Grid>
          <Box sx={{ height: 210 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={production} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#dce6ee" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" tick={{ fontSize: 10 }} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} /><ChartTooltip formatter={(value, name) => { const key = String(name); const numeric = Number(value ?? 0); return [key === "premium" ? `${numeric.toLocaleString("el-GR")} €` : numeric, key === "premium" ? "Μικτά ασφάλιστρα" : "Συμβόλαια"]; }} /><Line yAxisId="left" type="monotone" dataKey="contracts" stroke="#147f8d" strokeWidth={3} dot={{ r: 3 }} /><Line yAxisId="right" type="monotone" dataKey="premium" stroke="#1b7f55" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></Box>
        </CardContent>
      </Card>
    </DashboardWidget>
  </Box>;
}

function StandaloneBranchPanel({ branch, setBranch }: { branch: BranchKey; setBranch: (value: BranchKey) => void }) {
  return <StandaloneHomeSections branch={branch} setBranch={setBranch} />;
  /* Legacy layout retained below for source compatibility; the standalone home now uses the compact four-section dashboard. */
  const cards: { key: BranchKey; title: string; count: string; icon: ReactNode; colour: string }[] = [
    { key: branchLabels[0], title: "Οχημάτων", count: "19 Ασφαλιστικές", icon: <DirectionsCarFilledOutlinedIcon />, colour: "#26a69a" },
    { key: branchLabels[0], title: "Συγκριτική Οχημάτων", count: "19 Ασφαλιστικές", icon: <CompareArrowsRoundedIcon />, colour: "#337db8" },
    { key: branchLabels[1], title: "Περιουσίας", count: "14 Ασφαλιστικές", icon: <HomeWorkOutlinedIcon />, colour: "#df4d3d" },
    { key: branchLabels[7] ?? branchLabels[0], title: "Σκαφών", count: "5 Ασφαλιστικές", icon: <SailingOutlinedIcon />, colour: "#08a7dc" },
    { key: branchLabels[2], title: "Υγείας", count: "12 Ασφαλιστικές", icon: <HealthAndSafetyOutlinedIcon />, colour: "#8bb7b7" },
    { key: branchLabels[0], title: "Π.Α & Φρ. Αλλοδαπών", count: "6 Ασφαλιστικές", icon: <ShieldOutlinedIcon />, colour: "#c5bd00" },
    { key: branchLabels[4], title: "Αστικής Ευθύνης", count: "9 Ασφαλιστικές", icon: <BusinessCenterOutlinedIcon />, colour: "#6f5aaf" },
    { key: branchLabels[3], title: "Ζωής", count: "8 Ασφαλιστικές", icon: <LuggageOutlinedIcon />, colour: "#db8b37" },
  ];
  const announcements = [
    ["202/2024-AIG-SALES RALLY 2024", "18/04/2024 · Εγκύκλιος"],
    ["96/2024-ACCELERANT: ΜΕΤΑΒΟΛΗ ΠΡΟΜΗΘΕΙΩΝ", "26/01/2024 · Εγκύκλιος"],
    ["14/2024-ΤΕΧΝΙΚΟ ΠΡΟΒΛΗΜΑ EMAIL", "09/11/2023 · Εγκύκλιος"],
    ["206/2023-ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΑΡΜΟΔΙΟΤΗΤΩΝ", "09/11/2023 · Εγκύκλιος"],
    ["204/2023-ΥΠΟΧΡΕΩΤΙΚΗ ΧΡΗΣΗ ΦΡΟΝΤΙΔΑΣ", "23/10/2023 · Εγκύκλιος"],
  ];
  return <>
    <Typography variant="h5" sx={{ mb: 1.25, color: "#4c5358", fontWeight: 850 }}>Dashboard</Typography>
    <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start" sx={{ mb: 2.5 }}>
      <Grid item xs={12} lg={7}>
        <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden", borderTop: "3px solid #df4d3d", bgcolor: "#fff" }}>
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={850} sx={{ color: "#515960", mb: 1.25 }}>Τιμολόγηση</Typography>
            <Grid container spacing={1.25}>{cards.map((card, index) => <Grid item xs={6} sm={4} key={`${card.title}-${index}`}><Button onClick={() => setBranch(card.key)} fullWidth sx={{ p: 0, minHeight: 118, display: "flex", flexDirection: "column", alignItems: "stretch", borderRadius: 1.25, overflow: "hidden", textAlign: "left", color: "#fff", bgcolor: card.colour, border: branch === card.key && index < 5 ? "3px solid #123a64" : "2px solid transparent", boxShadow: branch === card.key && index < 5 ? "0 0 0 2px #fff inset" : "none", "&:hover": { filter: "brightness(1.05)", transform: "translateY(-1px)" }, transition: "filter .15s ease, transform .15s ease" }}><Box sx={{ p: 1.25, flex: 1, position: "relative" }}><Typography fontWeight={900} sx={{ fontSize: { xs: 13, sm: 14 } }}>{card.title}</Typography><Typography variant="caption" sx={{ opacity: .9 }}>{card.count}</Typography><Box sx={{ position: "absolute", right: 8, bottom: 6, opacity: .22, fontSize: 42 }}>{card.icon}</Box></Box><Box sx={{ px: 1.25, py: .7, bgcolor: "rgba(0,0,0,.13)", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>Τιμολογήστε τώρα <span>➜</span></Box></Button></Grid>)}</Grid>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} lg={5}>
        <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden", borderTop: "3px solid #17b8d1", bgcolor: "#fff" }}>
          <CardContent sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={850} sx={{ color: "#515960" }}>Ανακοινώσεις-Εγκύκλιοι</Typography><Stack direction="row" spacing={.25}><IconButton size="small" aria-label="Ανανέωση"><RefreshRoundedIcon fontSize="small" /></IconButton><IconButton size="small" aria-label="Σύμπτυξη"><Typography fontWeight={900}>−</Typography></IconButton></Stack></Stack>
            <Divider />
            <Stack divider={<Divider flexItem />} spacing={0}>{announcements.map(([title, meta]) => <Box key={title} sx={{ py: 1 }}><Typography variant="body2" sx={{ color: "#216285", fontWeight: 850, fontSize: 12.5 }}>{title}</Typography><Typography variant="caption" color="text.secondary"><Chip size="small" label="ΣΗΜΑΝΤΙΚΟ" sx={{ height: 18, mr: .75, bgcolor: "#f18b24", color: "#fff", borderRadius: .5, fontSize: 9, fontWeight: 900 }} />{meta}</Typography></Box>)}</Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </>;
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
  // The quote-history screen was retired from the standalone dashboard. Keep
  // this legacy component as a safe no-op so stale bookmarks/fallbacks cannot
  // render the old history table.
  return null;

  const [query, setQuery] = useState("");
  const visible = mockOffers.filter((offer) => !query || `${offer.code} ${offer.customer} ${offer.carrier}`.toLowerCase().includes(query.toLowerCase()));
  return <Stack spacing={2.5}><Card variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent sx={{ p: 2.5 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5}><Box><Typography variant="h5" fontWeight={850}>Ιστορικό προσφορών</Typography><Typography color="text.secondary">Αποθηκευμένες προσφορές, επιλεγμένα πακέτα και παρακολούθηση κατάστασης.</Typography></Box><Stack direction="row" spacing={1}><TextField size="small" placeholder="Αναζήτηση" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} /><Button variant="outlined" startIcon={<DownloadOutlinedIcon />}>Εξαγωγή</Button></Stack></Stack></CardContent></Card><Card variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}><TableContainer><Table><TableHead><TableRow sx={{ bgcolor: "#eef2f6" }}><TableCell>Κωδικός</TableCell><TableCell>Πελάτης</TableCell><TableCell>Κλάδος</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell><TableCell>Τελευταία ενημέρωση</TableCell></TableRow></TableHead><TableBody>{visible.map((offer) => <TableRow key={offer.id} hover><TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{offer.code}</TableCell><TableCell>{offer.customer}</TableCell><TableCell>{offer.branch}</TableCell><TableCell>{offer.carrier}</TableCell><TableCell sx={{ fontWeight: 800 }}>{currency(offer.premium)}</TableCell><TableCell><Chip size="small" label={offer.status} color={statusColour[offer.status]} /></TableCell><TableCell>{offer.updated}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Card></Stack>;
}

