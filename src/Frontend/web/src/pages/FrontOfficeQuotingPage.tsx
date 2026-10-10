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
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { KalypsisLogo } from "../components/KalypsisLogo";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

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

type HomeWidgetId = "pricing" | "announcements" | "production" | "blog";

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
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.25, py: .5, minHeight: 38, bgcolor: "rgba(18,58,100,.025)", borderBottom: "1px solid #e1e9f0", cursor: "grab", userSelect: "none" }}
      >
        <Stack direction="row" spacing={.5} alignItems="center" minWidth={0}><DragIndicatorRoundedIcon sx={{ color: "#7990a4", fontSize: 18 }} /><Typography fontWeight={850} noWrap sx={{ color: "#515960", fontSize: 13 }}>{title}</Typography></Stack>
        <Stack direction="row" spacing={0} alignItems="center" flexShrink={0}>
          <Tooltip title="Ανανέωση"><IconButton size="small" aria-label={`Ανανέωση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={refresh} sx={{ color: "#52728e" }}><RefreshRoundedIcon fontSize="small" sx={{ animation: refreshing ? "insureone-spin .55s linear" : "none", "@keyframes insureone-spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } } }} /></IconButton></Tooltip>
          <Tooltip title={minimized ? "Επαναφορά" : "Ελαχιστοποίηση"}><IconButton size="small" aria-label={minimized ? `Επαναφορά ${title}` : `Ελαχιστοποίηση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={onMinimize} sx={{ color: "#52728e" }}><RemoveRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={maximized ? "Επαναφορά μεγέθους" : "Μεγιστοποίηση"}><IconButton size="small" aria-label={maximized ? `Επαναφορά ${title}` : `Μεγιστοποίηση ${title}`} onMouseDown={event => event.stopPropagation()} onClick={onMaximize} sx={{ color: "#52728e" }}>{maximized ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}</IconButton></Tooltip>
        </Stack>
      </Box>
      {!minimized && <Box sx={{ height: "calc(100% - 38px)", minHeight: 0 }}>{children}</Box>}
    </Card>
    {!maximized && !minimized && <Box onMouseDown={beginResize} role="separator" aria-label={`Αλλαγή μεγέθους ${title}`} sx={{ position: "absolute", right: 2, bottom: 2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 2, "&::after": { content: '""', position: "absolute", right: 2, bottom: 2, width: 10, height: 10, borderRight: "2px solid #7191a8", borderBottom: "2px solid #7191a8", opacity: .8 } }} />}
  </Box>;
}

function StandaloneHomeSections({ branch, setBranch }: { branch: BranchKey; setBranch: (value: BranchKey) => void }) {
  const pricingCards: { key: BranchKey; title: string; count: string; icon: ReactNode; colour: string }[] = [
    { key: branchLabels[0], title: "Οχημάτων", count: "19 ασφαλιστικά προγράμματα", icon: <DirectionsCarFilledOutlinedIcon />, colour: "#26a69a" },
    { key: branchLabels[0], title: "Σύγκριση Οχημάτων", count: "19 ασφαλιστικά προγράμματα", icon: <CompareArrowsRoundedIcon />, colour: "#337db8" },
    { key: branchLabels[1], title: "Περιουσίας", count: "14 ασφαλιστικά προγράμματα", icon: <HomeWorkOutlinedIcon />, colour: "#df4d3d" },
    { key: branchLabels[2], title: "Υγείας", count: "12 ασφαλιστικά προγράμματα", icon: <HealthAndSafetyOutlinedIcon />, colour: "#8bb7b7" },
    { key: branchLabels[0], title: "Σκαφών", count: "5 ασφαλιστικά προγράμματα", icon: <SailingOutlinedIcon />, colour: "#08a7dc" },
    { key: branchLabels[0], title: "Προσωπικού Ατυχήματος", count: "6 ασφαλιστικά προγράμματα", icon: <ShieldOutlinedIcon />, colour: "#c5bd00" },
    { key: branchLabels[4], title: "Επαγγελματικής Ευθύνης", count: "9 ασφαλιστικά προγράμματα", icon: <BusinessCenterOutlinedIcon />, colour: "#6f5aaf" },
    { key: branchLabels[3], title: "Ζωής", count: "8 ασφαλιστικά προγράμματα", icon: <LuggageOutlinedIcon />, colour: "#db8b37" },
  ];
  const announcements = [
    ["202/2024 · Ενημέρωση ασφαλιστικής αγοράς", "18/04/2024 · Εγκύκλιος"],
    ["96/2024 · Αλλαγή διαδικασίας υποβολής", "26/01/2024 · Εγκύκλιος"],
    ["14/2024 · Τεχνική ενημέρωση ηλεκτρονικού ταχυδρομείου", "09/11/2023 · Εγκύκλιος"],
    ["206/2023 · Επικαιροποίηση διαδικασίας", "09/11/2023 · Εγκύκλιος"],
  ];
  const blogPosts = [
    ["Πώς επιλέγουμε το κατάλληλο πρόγραμμα", "Οδηγός για γρήγορη και τεκμηριωμένη σύγκριση προσφορών."],
    ["Οι νέες δυνατότητες του InsureOne", "Νέα εργαλεία για πιο απλή καθημερινή εργασία του γραφείου."],
    ["Υπενθυμίσεις πριν από τη λήξη", "Πρακτικές συμβουλές για καλύτερη εξυπηρέτηση και ανανεώσεις."],
  ];
  const production = [
    { month: "Μάι", contracts: 22, premium: 2840 },
    { month: "Ιούν", contracts: 27, premium: 3520 },
    { month: "Ιούλ", contracts: 31, premium: 4180 },
    { month: "Αύγ", contracts: 25, premium: 3310 },
    { month: "Σεπ", contracts: 36, premium: 4920 },
    { month: "Οκτ", contracts: 41, premium: 5680 },
  ];
  const defaultOrder: HomeWidgetId[] = ["pricing", "announcements", "production", "blog"];
  const defaultSizes: Record<HomeWidgetId, { span: number; height: number; minimized: boolean }> = {
    pricing: { span: 7, height: 365, minimized: false },
    announcements: { span: 5, height: 365, minimized: false },
    production: { span: 7, height: 365, minimized: false },
    blog: { span: 5, height: 365, minimized: false },
  };
  const loadLayout = () => {
    if (typeof window === "undefined") return { order: defaultOrder, sizes: defaultSizes };
    try {
      const saved = JSON.parse(window.localStorage.getItem("insureone-dashboard-layout") ?? "null") as { order?: HomeWidgetId[]; sizes?: typeof defaultSizes } | null;
      const order = saved?.order?.filter(id => defaultOrder.includes(id));
      return { order: order?.length === defaultOrder.length ? order : defaultOrder, sizes: { ...defaultSizes, ...(saved?.sizes ?? {}) } };
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
    height: widgetSizes[id].height,
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
    <DashboardWidget id="pricing" title="Τιμολόγηση" accent="#df4d3d" {...widgetControls("pricing")}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden", borderTop: "3px solid #df4d3d", bgcolor: "#fff" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography fontWeight={850} sx={{ color: "#515960", mb: 1.25 }}>Τιμολόγηση</Typography>
          <Grid container spacing={1.25}>{pricingCards.map((card, index) => <Grid item xs={6} sm={4} key={`${card.title}-${index}`}><Button onClick={() => setBranch(card.key)} fullWidth sx={{ p: 0, minHeight: 118, display: "flex", flexDirection: "column", alignItems: "stretch", borderRadius: 1.25, overflow: "hidden", textAlign: "left", color: "#fff", bgcolor: card.colour, border: branch === card.key && index < 5 ? "3px solid #123a64" : "2px solid transparent", boxShadow: branch === card.key && index < 5 ? "0 0 0 2px #fff inset" : "none", "&:hover": { filter: "brightness(1.05)", transform: "translateY(-1px)" }, transition: "filter .15s ease, transform .15s ease" }}><Box sx={{ p: 1.25, flex: 1, position: "relative" }}><Typography fontWeight={900} sx={{ fontSize: { xs: 13, sm: 14 } }}>{card.title}</Typography><Typography variant="caption" sx={{ opacity: .9 }}>{card.count}</Typography><Box sx={{ position: "absolute", right: 8, bottom: 6, opacity: .22, fontSize: 42 }}>{card.icon}</Box></Box><Box sx={{ px: 1.25, py: .7, bgcolor: "rgba(0,0,0,.13)", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between" }}>Τιμολογήστε τώρα <span>→</span></Box></Button></Grid>)}</Grid>
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
    <DashboardWidget id="blog" title="BLOG NEWS" accent="#2759a5" {...widgetControls("blog")}>
      <Card variant="outlined" sx={{ borderRadius: 1.5, borderTop: "3px solid #2759a5", bgcolor: "#fff", height: "100%" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography fontWeight={850} sx={{ color: "#515960", mb: 1.25 }}>BLOG NEWS</Typography>
          <Stack divider={<Divider flexItem />} spacing={0}>{blogPosts.map(([title, text]) => <Box key={title} sx={{ py: 1 }}><Typography variant="body2" sx={{ color: "#216285", fontWeight: 850 }}>{title}</Typography><Typography variant="caption" color="text.secondary">{text}</Typography></Box>)}</Stack>
          <Box sx={{ height: 100, mt: .75 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={production.slice(-4)} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis hide /><Bar dataKey="contracts" fill="#53c6d3" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Box>
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

