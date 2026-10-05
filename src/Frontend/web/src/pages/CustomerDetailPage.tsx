import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import FolderIcon from "@mui/icons-material/Folder";
import BarChartIcon from "@mui/icons-material/BarChart";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { VehicleDetailDialog } from "./CustomerVehiclesPage";

interface CustomerDto {
  id: string;
  customerNumber: string;
  type: string;
  status: string;
  createdAt?: string;
  hasPortalAccount?: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string | null;
  email?: string;
  phone?: string;
  notes?: string;
  paymentDueDate?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  birthDate?: string | null;
  occupation?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  nationality?: string | null;
  zone?: string | null;
  activityCode?: string | null;
  taxOffice?: string | null;
  gemiNumber?: string | null;
  legalForm?: string | null;
  altPhone?: string | null;
  mobilePhone?: string | null;
  amka?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  region?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  employer?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseClass?: string | null;
  driverLicenseIssueDate?: string | null;
  driverLicenseExpiryDate?: string | null;
  source?: string | null;
  tagsJson?: string | null;
  photoUrl?: string | null;
}

interface ConsentRow {
  id: string;
  type: string;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string | null;
  method: string;
  version?: string;
}

interface CommunicationRow {
  id: string;
  kind: string;
  direction: string;
  outcome: string;
  occurredAt: string;
  durationSeconds?: number | null;
  subject: string;
  body?: string | null;
  relatedPolicyNumber?: string | null;
}

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

interface CustomerNeed {
  id: string; kind: string; title: string; hasAsset: boolean; isInsured: boolean;
  priority: number; nextContactAt: string | null; notes: string | null;
}
interface FamilyPolicy {
  id: string; policyNumber: string; policyType: string; status: string;
  startDate: string; endDate: string; premium: number; currency: string;
}
interface FamilyMember {
  relationshipId: string; customerId: string; displayName: string; customerType: string;
  relationshipType: string; notes: string | null; policies: FamilyPolicy[]; needs: CustomerNeed[];
}
interface FamilyProfile {
  profile: {
    id: string; customerNumber: string; type: string; displayName: string;
    maritalStatus: string | null; occupation: string | null; employer: string | null;
    mobilePhone: string | null; email: string | null; phone: string | null; notes: string | null;
    // ALIS-parity KYC fields (all nullable)
    fatherName: string | null;
    motherName: string | null;
    spouseName: string | null;
    nationality: string | null;
    zone: string | null;
    activityCode: string | null;
  };
  needs: CustomerNeed[];
  family: FamilyMember[];
  opportunities: { customerId: string; customerName: string; relationship: string | null; needKind: string; needTitle: string; reason: string; priority: number; }[];
}

// Ομαδοποιημένα consent types για το UI του CustomerDetailPage. Οι δύο
// ομάδες εμφανίζονται σε ξεχωριστά sections ώστε ο operator να μη μπερδεύει
// τα Άρθρα 13/9 GDPR (compliance-critical) με τα marketing opt-ins.
const CONSENT_TYPES_LEGAL = [
  "PrivacyNotice",             // Άρθρο 13 GDPR
  "HealthDataProcessing",      // Άρθρο 9 GDPR
  "IddDemandsAndNeeds",        // Ν.4583/2018 Άρθρο 27
  "AmlKycDeclaration",         // Ν.4557/2018
];
const CONSENT_TYPES_MARKETING = [
  "EmailMarketing",
  "SmsMarketing",
  "PhoneMarketing",
  "AutomatedDecisionMaking",
  "DataSharingPartners"
];

const COMMUNICATION_KINDS = ["Note", "Phone", "Email", "Meeting", "Sms", "WalkIn"];

const CUSTOMER_PROFILE_TAB_LABELS = [
  { label: "Επισκόπηση & στοιχεία", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Συμβόλαια & οχήματα", icon: <DirectionsCarIcon fontSize="small" /> },
  { label: "Ζημίες & οικονομικά", icon: <AccountBalanceWalletOutlinedIcon fontSize="small" /> },
  { label: "Επικοινωνία & ειδοποιήσεις", icon: <ContactPhoneIcon fontSize="small" /> },
  { label: "Επαφές & οικογένεια", icon: <FamilyRestroomIcon fontSize="small" /> },
  { label: "Έντυπα & προτάσεις", icon: <FolderIcon fontSize="small" /> },
  { label: "Στατιστικά", icon: <BarChartIcon fontSize="small" /> },
];

function CustomerProfileTabs({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Tabs value={value} onChange={(_, next: number) => onChange(next)} variant="standard" sx={{
    position: "sticky", top: 0, zIndex: 4, mb: 2, px: .5, py: .5,
    border: "1px solid", borderColor: "divider", borderRadius: 2,
    bgcolor: "background.paper", boxShadow: "0 3px 10px rgba(15,23,42,.12)",
    overflow: "visible", "& .MuiTabs-scroller": { overflow: "visible !important" },
    "& .MuiTabs-flexContainer": { gap: .75, flexWrap: "wrap" },
    "& .MuiTabs-indicator": { display: "none" },
    "& .MuiTab-root": {
      minHeight: 54, minWidth: { xs: 132, md: 168 }, px: 1.5, py: .75,
      border: "1px solid #263238", borderRadius: 1.5,
      background: "linear-gradient(180deg, #e5e7eb 0%, #b8c0c8 100%) !important",
      color: "#111827 !important", borderColor: "#263238 !important", opacity: "1 !important", textTransform: "none", fontWeight: 750,
      transition: "background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease",
      "&:hover": { background: "linear-gradient(180deg, #d4d8de 0%, #9ca6b1 100%) !important", color: "#0b2545 !important", borderColor: "#111827 !important", transform: "none" },
      "&.Mui-selected": { background: "linear-gradient(135deg, #0b5cad 0%, #063b73 100%) !important", color: "#fff !important", borderColor: "#062f63 !important", boxShadow: "0 3px 8px rgba(6,47,99,.35)" },
    },
  }}>{CUSTOMER_PROFILE_TAB_LABELS.map(item => <Tab key={item.label} icon={item.icon} iconPosition="start" label={item.label} />)}</Tabs>;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [showEditor, setShowEditor] = useState(false);

  const customerQ = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await api.get<CustomerDto>(`/customers/${id}`)).data,
    enabled: !!id
  });
  const statusMutation = useMutation({
    mutationFn: async (status: "Prospect" | "Active") => api.patch(`/customers/${id}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customer", id] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  if (customerQ.isLoading) {
    return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  }
  if (customerQ.isError) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{extractErrorMessage(customerQ.error)}</Alert>
        <Button component={RouterLink} to="/app/customers" sx={{ mt: 2 }}>Πίσω στη λίστα</Button>
      </Box>
    );
  }
  const customer = customerQ.data!;
  const canManageCustomer = user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser";

  const displayName = customer.type === "Company"
    ? customer.companyName ?? "—"
    : [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";

  return (
    <Dialog
      open
      fullWidth
      maxWidth="xl"
      onClose={() => navigate("/app/customers")}
      PaperProps={{ sx: { height: { xs: "100vh", md: "calc(100vh - 32px)" }, maxHeight: "none", m: { xs: 0, md: 2 } } }}
    >
      <DialogTitle sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={800}>Καρτέλα πελάτη</Typography>
          <Typography variant="caption" color="text.secondary">Προβολή στοιχείων · επεξεργασία μόνο με το κουμπί επεξεργασίας</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1, md: 1.75 }, "& .MuiTypography-root": { lineHeight: 1.25 } }}>
      <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} gap={1.5}>
        <Box>
          <Typography variant="overline" color="text.secondary">{customer.customerNumber}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>{displayName}</Typography>
        </Box>
        {canManageCustomer && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button startIcon={<EditIcon />} variant="contained" color="success" sx={{ color: "#fff", fontWeight: 800 }} onClick={() => { setTab(0); setShowEditor(true); }}>
              Επεξεργασία πελάτη
            </Button>
            <Button
              variant={customer.status === "Prospect" ? "contained" : "outlined"}
              color={customer.status === "Prospect" ? "success" : "warning"}
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(customer.status === "Prospect" ? "Active" : "Prospect")}
            >
              {customer.status === "Prospect" ? "Μετατροπή σε πελάτη" : "Ορισμός ως πιθανός"}
            </Button>
          </Stack>
        )}
      </Stack>

      <CustomerProfileTabs value={tab} onChange={setTab} />

      {tab === 0 && (showEditor
        ? <CustomerEditorDialog open customer={customer} onClose={() => setShowEditor(false)} />
        : <OverviewTab customer={customer} />)}
      {tab === 1 && <Stack spacing={3}><CustomerPoliciesTab customerId={id} /><CustomerVehiclesTab customerId={id} /></Stack>}
      {tab === 2 && <Stack spacing={3}><CustomerClaimsTab customerId={id} /><CustomerAccountTab customerId={id} /></Stack>}
      {tab === 3 && <Stack spacing={3}><CommunicationsTab customerId={id} /><CustomerNotificationsTab customerId={id} /></Stack>}
      {tab === 4 && <Stack spacing={0.75}><ContactsTab customerId={id} customerType={customer.type} /><FamilyNeedsTab customerId={id} /></Stack>}
      {tab === 5 && <Stack spacing={3}><GdprActionsTab customerId={id} /><InsuranceOpportunitiesTab customerId={id} /></Stack>}
      {tab === 6 && <CustomerStatisticsTab customerId={id} />}
      </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: "divider" }}>
        <Button component={RouterLink} to="/app/customers" color="error" variant="contained" startIcon={<CloseIcon />} sx={{ color: "#fff", fontWeight: 800 }}>
          Κλείσιμο καρτέλας
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Customer account / payment behaviour ---------- */

interface CustomerAccount {
  customerId: string; customerName: string;
  totalCharges: number; totalCredits: number; balance: number;
  overdueAmount: number; overdueCount: number;
  paymentDueDate?: string | null; isPaymentOverdue?: boolean;
  installmentCount: number; paidInstallmentCount: number;
  onTimePaymentCount: number; latePaymentCount: number; onTimeRatePercent: number;
  entries: { id: string; date: string; kind: string; amount: number; currency: string; description?: string | null; policyNumber?: string | null }[];
  installments: { id: string; policyNumber: string; dueDate: string; amount: number; paidAt?: string | null; isOverdue: boolean; daysLate: number }[];
  monthly: { year: number; month: number; charges: number; credits: number; balance: number }[];
}

function CustomerAccountTab({ customerId }: { customerId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useQuery({
    queryKey: ["customer-account", customerId, from, to],
    queryFn: async () => (await api.get<CustomerAccount>(`/customers/${customerId}/account`, {
      params: { from: from || undefined, to: to || undefined }
    })).data
  });
  const fmt = (n: number) => n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  const a = q.data!;
  const balanceColor = a.balance > 0 ? "error.main" : a.balance < 0 ? "success.main" : "text.primary";
  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
          <Typography variant="caption" color="text.secondary">Το φίλτρο επηρεάζει τις κινήσεις και τους μηνιαίους υπολογισμούς.</Typography>
        </Stack>
      </Card>
      <Card variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          <Box><Typography variant="caption" color="text.secondary">Χρεώσεις</Typography><Typography fontWeight={800}>{fmt(a.totalCharges)} €</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Εισπράξεις</Typography><Typography fontWeight={800} color="success.main">{fmt(a.totalCredits)} €</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Υπόλοιπο πελάτη</Typography><Typography fontWeight={900} color={balanceColor}>{fmt(a.balance)} €</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Ληξιπρόθεσμα</Typography><Typography fontWeight={800} color={a.overdueAmount > 0 ? "error.main" : "text.primary"}>{fmt(a.overdueAmount)} € ({a.overdueCount})</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Συνέπεια πληρωμών</Typography><Typography fontWeight={800}>{a.paidInstallmentCount ? `${fmt(a.onTimeRatePercent)}% εμπρόθεσμα` : "Δεν υπάρχουν δόσεις"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Καθυστερήσεις</Typography><Typography fontWeight={800}>{a.latePaymentCount}</Typography></Box>
        </Stack>
      </Card>
      {a.isPaymentOverdue && <Alert severity="error" sx={{ bgcolor: "#fff0f0", border: "1px solid #ef9a9a" }}>
        Ληξιπρόθεσμη εξόφληση: ο πελάτης έχει ανεξόφλητο υπόλοιπο {fmt(a.balance)} € μετά την ημερομηνία {a.paymentDueDate ?? "—"}. Η κόκκινη ειδοποίηση εμφανίζεται και στο dashboard.
      </Alert>}
      {!a.isPaymentOverdue && a.overdueCount > 0 && <Alert severity="warning">Ο πελάτης έχει ληξιπρόθεσμες δόσεις συμβολαίων. Δημιουργείται ειδοποίηση στον διαχειριστή από το ωριαίο σύστημα υπενθυμίσεων.</Alert>}
      {a.installments.length > 0 && (
        <Card variant="outlined">
          <Typography sx={{ p: 2, pb: 0 }} fontWeight={800}>Δόσεις και ημερομηνίες εξόφλησης</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Λήξη πληρωμής</TableCell><TableCell align="right">Ποσό</TableCell><TableCell>Κατάσταση</TableCell></TableRow></TableHead>
            <TableBody>{a.installments.map(i => <TableRow key={i.id}><TableCell sx={{ fontFamily: "monospace" }}>{i.policyNumber}</TableCell><TableCell>{i.dueDate}</TableCell><TableCell align="right">{fmt(i.amount)} €</TableCell><TableCell>{i.paidAt ? <Chip size="small" color="success" label={`Εξοφλήθηκε ${i.paidAt}`} /> : <Chip size="small" color={i.isOverdue ? "error" : "warning"} label={i.isOverdue ? `Καθυστέρηση ${i.daysLate} ημέρες` : "Εκκρεμεί"} />}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      )}
      <Card variant="outlined">
        <Typography sx={{ p: 2, pb: 0 }} fontWeight={800}>Κινήσεις καρτέλας</Typography>
        {a.entries.length === 0 ? <Typography sx={{ p: 2 }} color="text.secondary">Δεν υπάρχουν οικονομικές κινήσεις.</Typography> :
          <Table size="small"><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Αιτιολογία</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell align="right">Ποσό</TableCell></TableRow></TableHead><TableBody>{a.entries.map(e => <TableRow key={e.id}><TableCell>{e.date}</TableCell><TableCell>{e.kind === "CustomerCharge" ? "Χρέωση" : e.kind === "CustomerCredit" ? "Είσπραξη" : e.kind}{e.description ? ` · ${e.description}` : ""}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{e.policyNumber ?? "—"}</TableCell><TableCell align="right" sx={{ color: e.kind === "CustomerCharge" ? "error.main" : "success.main", fontWeight: 700 }}>{e.kind === "CustomerCharge" ? "+" : "−"}{fmt(e.amount)} {e.currency}</TableCell></TableRow>)}</TableBody></Table>}
      </Card>
      {a.monthly.length > 0 && <Card variant="outlined"><Typography sx={{ p: 2, pb: 0 }} fontWeight={800}>Υπόλοιπο ανά μήνα</Typography><Table size="small"><TableHead><TableRow><TableCell>Μήνας</TableCell><TableCell align="right">Χρεώσεις</TableCell><TableCell align="right">Εισπράξεις</TableCell><TableCell align="right">Υπόλοιπο</TableCell></TableRow></TableHead><TableBody>{a.monthly.map(m => <TableRow key={`${m.year}-${m.month}`}><TableCell>{String(m.month).padStart(2, "0")}/{m.year}</TableCell><TableCell align="right">{fmt(m.charges)} €</TableCell><TableCell align="right">{fmt(m.credits)} €</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{fmt(m.balance)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
    </Stack>
  );
}

/* ---------- Summary card ---------- */

interface CustomerSummary {
  activePolicyCount: number; totalPolicyCount: number;
  lifetimeGrossPremium: number; currentYearGrossPremium: number;
  lifetimeAgencyCommission: number;
  openClaimCount: number; totalClaimCount: number;
  notificationCount: number; communicationCount: number;
  tier: "Premium" | "Gold" | "Standard" | "Basic";
  tierReason: string;
}

const TIER_COLOR: Record<string, "default" | "primary" | "success" | "warning"> = {
  Premium: "warning", Gold: "primary", Standard: "success", Basic: "default"
};
const TIER_LABEL: Record<string, string> = {
  Premium: "Premium", Gold: "Gold", Standard: "Τυπικός", Basic: "Βασικό"
};

function CustomerSummaryCard({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-summary", customerId],
    queryFn: async () => (await api.get<CustomerSummary>(`/customers/${customerId}/summary`)).data,
    enabled: !!customerId
  });
  const fmt = (n: number) => n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card variant="outlined" sx={{ p: { xs: 1.25, md: 1.5 }, mb: 1.5 }}>
      {q.isLoading ? <CircularProgress size={22} /> : q.data ? (
        <Stack direction="row" spacing={{ xs: 1.25, md: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip label={`Κατηγορία: ${TIER_LABEL[q.data.tier] ?? q.data.tier}`}
            color={TIER_COLOR[q.data.tier] ?? "default"} sx={{ fontWeight: 800 }}
            title={q.data.tierReason} />
          <Box>
            <Typography variant="caption" color="text.secondary">Συμβόλαια</Typography>
            <Typography fontWeight={800}>{q.data.activePolicyCount} ενεργά / {q.data.totalPolicyCount} σύνολο</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Μεικτό φέτος</Typography>
            <Typography fontWeight={800}>{fmt(q.data.currentYearGrossPremium)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Σύνολο μεικτό</Typography>
            <Typography fontWeight={800}>{fmt(q.data.lifetimeGrossPremium)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Έσοδα γραφείου</Typography>
            <Typography fontWeight={800} color="primary.main">{fmt(q.data.lifetimeAgencyCommission)} €</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Ζημίες</Typography>
            <Typography fontWeight={800}>{q.data.openClaimCount} ανοιχτές / {q.data.totalClaimCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Ειδοποιήσεις · Επικοινωνίες</Typography>
            <Typography fontWeight={800}>{q.data.notificationCount} · {q.data.communicationCount}</Typography>
          </Box>
        </Stack>
      ) : <Typography color="text.secondary">—</Typography>}
    </Card>
  );
}

interface CustomerVehicleRow {
  id: string;
  policyNumber: string;
  insuranceCompanyName: string;
  policyType: string;
  status: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  vehicleRegistrationPlate?: string | null;
}

function CustomerVehiclesTab({ customerId, compact = false }: { customerId: string; compact?: boolean }) {
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["customer-vehicles", customerId],
    queryFn: async () => (await api.get<CustomerVehicleRow[]>("/policies", { params: { customerId, type: "Auto" } })).data
  });
  if (q.isLoading) return <Card variant="outlined" sx={{ p: 2 }}><CircularProgress size={22} /></Card>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  const rows = q.data ?? [];
  return (
    <Card variant="outlined" sx={{ p: compact ? 1.25 : 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: compact ? 0.75 : 1.5 }}>
        <Box><Typography variant={compact ? "subtitle1" : "h6"} fontWeight={800}>Οχήματα πελάτη</Typography><Typography variant="body2" color="text.secondary">Αυτόματη προβολή από τα συμβόλαια αυτοκινήτου.</Typography></Box>
        <Chip size="small" icon={<DirectionsCarIcon />} label={`${rows.length} συμβόλαια`} />
      </Stack>
      {rows.length === 0 ? <Alert severity="info">Δεν έχει καταχωρηθεί ακόμη συμβόλαιο αυτοκινήτου ή πινακίδα για τον πελάτη.</Alert> : (
        <Table size="small">
          <TableHead><TableRow><TableCell>Πινακίδα</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ισχύς</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>{rows.map(row => <TableRow key={row.id} hover>
            <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.vehicleRegistrationPlate ?? "—"}</TableCell>
            <TableCell><Button size="small" component={RouterLink} to={`/app/policies?focus=${row.id}`}>{row.policyNumber}</Button></TableCell>
            <TableCell>{row.insuranceCompanyName}</TableCell>
            <TableCell>{row.startDate} → {row.endDate}</TableCell>
            <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell>
            <TableCell><Chip size="small" label={row.status} /></TableCell>
            <TableCell><Button size="small" onClick={() => setSelectedPlate(row.vehicleRegistrationPlate ?? "")}>Καρτέλα</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      )}
      <VehicleDetailDialog open={selectedPlate !== null} plate={selectedPlate ?? ""} policyIds={rows.filter(row => (row.vehicleRegistrationPlate ?? "") === (selectedPlate ?? "")).map(row => row.id)} onClose={() => setSelectedPlate(null)} />
    </Card>
  );
}

interface CustomerStatisticsPolicy {
  id: string;
  policyNumber: string;
  policyType: string;
  status: string;
  startDate: string;
  premium: number;
  currency: string;
}

function CustomerStatisticsTab({ customerId }: { customerId: string }) {
  const summaryQ = useQuery({
    queryKey: ["customer-summary", customerId],
    queryFn: async () => (await api.get<CustomerSummary>(`/customers/${customerId}/summary`)).data,
    enabled: !!customerId
  });
  const policiesQ = useQuery({
    queryKey: ["customer-statistics-policies", customerId],
    queryFn: async () => (await api.get<CustomerStatisticsPolicy[]>("/policies", { params: { customerId } })).data,
    enabled: !!customerId
  });
  const accountQ = useQuery({
    queryKey: ["customer-account", customerId, "statistics"],
    retry: false,
    queryFn: async () => (await api.get<CustomerAccount>(`/customers/${customerId}/account`)).data,
    enabled: !!customerId
  });

  const policies = policiesQ.data ?? [];
  const premiumByMonth = useMemo(() => {
    const totals = new Map<string, { label: string; premium: number; contracts: number }>();
    for (const policy of policies) {
      const key = (policy.startDate ?? "").slice(0, 7) || "Χωρίς ημερομηνία";
      const label = key === "Χωρίς ημερομηνία" ? key : key.split("-").reverse().join("/");
      const row = totals.get(key) ?? { label, premium: 0, contracts: 0 };
      row.premium += Number(policy.premium) || 0;
      row.contracts += 1;
      totals.set(key, row);
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
  }, [policies]);
  const typeData = useMemo(() => {
    const totals = new Map<string, { contracts: number; premium: number }>();
    for (const policy of policies) {
      const type = policy.policyType || "Άλλο";
      const row = totals.get(type) ?? { contracts: 0, premium: 0 };
      row.contracts += 1;
      row.premium += Number(policy.premium) || 0;
      totals.set(type, row);
    }
    return [...totals.entries()].map(([name, value]) => ({ name, ...value }));
  }, [policies]);
  const statusData = useMemo(() => {
    const labels: Record<string, string> = { Active: "Ενεργά", Inactive: "Ανενεργά", Expired: "Ληγμένα", Cancelled: "Ακυρωμένα" };
    const totals = new Map<string, number>();
    for (const policy of policies) {
      const label = labels[policy.status] ?? policy.status ?? "Άγνωστη κατάσταση";
      totals.set(label, (totals.get(label) ?? 0) + 1);
    }
    return [...totals.entries()].map(([name, contracts]) => ({ name, contracts }));
  }, [policies]);
  const monthlyAccount = (accountQ.data?.monthly ?? []).map(item => ({
    label: `${String(item.month).padStart(2, "0")}/${item.year}`,
    charges: item.charges,
    credits: item.credits,
    balance: item.balance
  }));

  if (summaryQ.isLoading || policiesQ.isLoading || accountQ.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (summaryQ.isError || policiesQ.isError) {
    return <Alert severity="error">Δεν ήταν δυνατή η φόρτωση των στατιστικών πελάτη.</Alert>;
  }
  const summary = summaryQ.data;
  const formatMoney = (value: number) => value.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatChartValue = (value: unknown, name: unknown): [string, string] => {
    const key = String(name ?? "");
    const numeric = Number(value ?? 0);
    return [key === "premium" || key === "charges" || key === "credits" || key === "balance" ? `${formatMoney(numeric)} €` : String(value ?? 0), key === "premium" ? "Μεικτά" : key === "contracts" ? "Συμβόλαια" : key === "charges" ? "Χρεώσεις" : key === "credits" ? "Εισπράξεις" : "Υπόλοιπο"];
  };
  const chartCard = (title: string, children: React.ReactNode) => (
    <Card variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>{title}</Typography>
      <Box sx={{ width: "100%", height: 250 }}>{children}</Box>
    </Card>
  );

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="h6" fontWeight={800}>Στατιστικά πελάτη</Typography>
        <Typography variant="body2" color="text.secondary">Παραγωγή, οικονομική εικόνα, συμβόλαια και πορεία χαρτοφυλακίου.</Typography>
      </Box>
      <CustomerSummaryCard customerId={customerId} />
      {summary && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
        {[
          ["Ενεργά συμβόλαια", `${summary.activePolicyCount} / ${summary.totalPolicyCount}`, "#0b5cad"],
          ["Μεικτά φέτος", `${formatMoney(summary.currentYearGrossPremium)} €`, "#1976d2"],
          ["Έσοδα γραφείου", `${formatMoney(summary.lifetimeAgencyCommission)} €`, "#2e7d32"],
          ["Ανοιχτές ζημίες", `${summary.openClaimCount} / ${summary.totalClaimCount}`, "#c62828"],
        ].map(([label, value, color]) => <Card key={label} variant="outlined" sx={{ p: 1.25, borderTop: `3px solid ${color}` }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value}</Typography></Card>)}
      </Box>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5 }}>
        {chartCard("Παραγωγή ανά μήνα", premiumByMonth.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα συμβολαίων.</Typography> : <ResponsiveContainer width="100%" height="100%"><LineChart data={premiumByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "premium" ? "Μεικτά" : "Συμβόλαια"} /><Line type="monotone" dataKey="premium" stroke="#0b5cad" strokeWidth={3} dot /><Line type="monotone" dataKey="contracts" stroke="#2e7d32" strokeWidth={2} yAxisId="right" /></LineChart></ResponsiveContainer>)}
        {chartCard("Μεικτά ανά κλάδο", typeData.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα κλάδων.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "premium" ? "Μεικτά" : "Συμβόλαια"} /><Bar dataKey="premium" fill="#1976d2" radius={[5, 5, 0, 0]} /><Bar dataKey="contracts" fill="#66bb6a" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>)}
        {chartCard("Οικονομική πορεία ανά μήνα", monthlyAccount.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν οικονομικές κινήσεις.</Typography> : <ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyAccount}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "charges" ? "Χρεώσεις" : name === "credits" ? "Εισπράξεις" : "Υπόλοιπο"} /><Line type="monotone" dataKey="charges" stroke="#c62828" strokeWidth={2} /><Line type="monotone" dataKey="credits" stroke="#2e7d32" strokeWidth={2} /><Line type="monotone" dataKey="balance" stroke="#0b5cad" strokeWidth={3} /></LineChart></ResponsiveContainer>)}
        {chartCard("Κατάσταση συμβολαίων", statusData.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν συμβόλαια.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="contracts" name="Συμβόλαια" fill="#0b5cad" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>)}
      </Box>
    </Stack>
  );
}

/* ---------- Policies tab ---------- */

function CustomerPoliciesTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-policies", customerId],
    queryFn: async () => (await api.get<{
      id: string; policyNumber: string; insuranceCompanyName: string; policyType: string;
      status: string; startDate: string; endDate: string; premium: number; currency: string;
    }[]>("/policies", { params: { customerId } })).data
  });
  if (q.isLoading) return <CircularProgress />;
  const rows = q.data ?? [];
  if (rows.length === 0) return <Alert severity="info">Δεν υπάρχουν συμβόλαια.</Alert>;
  return (
    <Stack spacing={3}>
      <RenewalTimeline policies={rows} />
      <Card variant="outlined">
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Αρ.Συμβ.</TableCell>
            <TableCell>Εταιρία</TableCell>
            <TableCell>Κλάδος</TableCell>
            <TableCell>Έναρξη → Λήξη</TableCell>
            <TableCell align="right">Ασφάλιστρο</TableCell>
            <TableCell>Κατάσταση</TableCell>
            <TableCell />
          </TableRow></TableHead>
          <TableBody>
            {rows.map(p => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
                <TableCell>{p.insuranceCompanyName}</TableCell>
                <TableCell>{p.policyType}</TableCell>
                <TableCell>{p.startDate} → {p.endDate}</TableCell>
                <TableCell align="right">{p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {p.currency}</TableCell>
                <TableCell><Chip size="small" label={p.status} /></TableCell>
                <TableCell>
                  <Button size="small" component={RouterLink} to={`/app/policies?focus=${p.id}`}>Προβολή</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}

interface TimelinePolicy {
  id: string; policyNumber: string; insuranceCompanyName: string; policyType: string;
  status: string; startDate: string; endDate: string; premium: number; currency: string;
}

/**
 * Renewal timeline — a visual «what's coming up» strip for this customer's
 * active policies, sorted by end date. Colour-codes each row by how many
 * days remain: red < 30, orange < 90, green otherwise. Filters out
 * Cancelled / Expired / Draft so the strip only shows things that need
 * attention.
 */
function RenewalTimeline({ policies }: { policies: TimelinePolicy[] }) {
  const now = new Date();
  const upcoming = policies
    .filter(p => p.status === "Active" || p.status === "PendingRenewal")
    .map(p => {
      const end = new Date(p.endDate);
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { p, days, end };
    })
    .sort((a, b) => a.end.getTime() - b.end.getTime());
  if (upcoming.length === 0) return null;
  const colorFor = (days: number) =>
    days < 30 ? "error" : days < 90 ? "warning" : "success";
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Χρονογραμμή ανανεώσεων
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        {upcoming.map(({ p, days }) => {
          const label = days < 0
            ? `Έληξε πριν ${Math.abs(days)} μέρες`
            : days === 0 ? "Λήγει σήμερα"
            : `Σε ${days} μέρες`;
          return (
            <Stack key={p.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: 1, borderLeft: 4, borderColor: `${colorFor(days)}.main`, bgcolor: "background.default", borderRadius: 1 }}>
              <Chip size="small" color={colorFor(days)} label={label} sx={{ fontWeight: 700, minWidth: 130 }} />
              <Typography sx={{ fontFamily: "monospace" }}>{p.policyNumber}</Typography>
              <Typography color="text.secondary" sx={{ flex: 1 }}>
                {p.insuranceCompanyName} · {p.policyType}
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>Λήξη: {p.endDate}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {p.currency}
              </Typography>
              <Button size="small" component={RouterLink} to={`/app/policies?focus=${p.id}`}>Άνοιγμα</Button>
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}

/* ---------- Claims tab ---------- */

function CustomerClaimsTab({ customerId: _customerId }: { customerId: string }) {
  // Claims are filtered by policy on the backend; fetch all and filter client-side
  // for the user's policies.
  const policiesQ = useQuery({
    queryKey: ["customer-policies-for-claims", _customerId],
    queryFn: async () => (await api.get<{ id: string }[]>("/policies", { params: { customerId: _customerId } })).data
  });
  const claimsQ = useQuery({
    queryKey: ["customer-claims", _customerId],
    queryFn: async () => (await api.get<any[]>("/claims")).data
  });
  if (policiesQ.isLoading || claimsQ.isLoading) return <CircularProgress />;
  const policyIds = new Set((policiesQ.data ?? []).map(p => p.id));
  const claims = (claimsQ.data ?? []).filter((c: any) => policyIds.has(c.policyId));
  if (claims.length === 0) return <Alert severity="success">Δεν υπάρχουν ζημίες.</Alert>;
  return (
    <Card variant="outlined">
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Αρ. Ζημίας</TableCell>
          <TableCell>Συμβόλαιο</TableCell>
          <TableCell>Συμβάν</TableCell>
          <TableCell>Κατάσταση</TableCell>
          <TableCell align="right">Διεκδικ.</TableCell>
          <TableCell align="right">Εγκρ.</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {claims.map((c: any) => (
            <TableRow key={c.id} hover>
              <TableCell>{c.claimNumber}</TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{c.policyNumber}</TableCell>
              <TableCell>{c.incidentDate}</TableCell>
              <TableCell><Chip size="small" label={c.status} /></TableCell>
              <TableCell align="right">{c.claimedAmount?.toFixed?.(2) ?? "—"}</TableCell>
              <TableCell align="right">{c.approvedAmount?.toFixed?.(2) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Notifications tab ---------- */

function CustomerNotificationsTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-notifications", customerId],
    queryFn: async () => {
      try { return (await api.get<any[]>(`/customers/${customerId}/notifications`)).data; }
      catch { return [] as any[]; }
    }
  });
  if (q.isLoading) return <CircularProgress />;
  const rows = q.data ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return <Alert severity="info">Δεν έχουν αποσταλεί ειδοποιήσεις προς αυτόν τον πελάτη.</Alert>;
  return (
    <Card variant="outlined">
      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Ημ/νία</TableCell>
          <TableCell>Τύπος</TableCell>
          <TableCell>Θέμα</TableCell>
          <TableCell>Κατάσταση</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((n: any) => (
            <TableRow key={n.id}>
              <TableCell>{n.createdAt}</TableCell>
              <TableCell>{n.kind ?? n.type ?? "—"}</TableCell>
              <TableCell>{n.title ?? n.subject ?? "—"}</TableCell>
              <TableCell>{n.isRead ? "Αναγνώστηκε" : "Μη αναγνωσμένη"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------- Overview ---------- */

interface CustomerProducerSummaryRow {
  producerId: string;
  producerCode: string;
  producerName: string;
  policyCount: number;
  totalPremium: number;
  currency: string;
  latestPolicyStart: string | null;
}

function CustomerProducersSummary({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-producers", customerId],
    queryFn: async () => (await api.get<CustomerProducerSummaryRow[]>(`/customers/${customerId}/producers`)).data,
    enabled: !!customerId
  });
  const rows = q.data ?? [];
  return <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 } }}>
    <Box sx={{ mb: 0.75, px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}>
      <Typography variant="subtitle2" fontWeight={800}>Συνεργάτες πελάτη</Typography>
      <Typography variant="caption" color="text.secondary">Οι συνεργάτες που έχουν εκδώσει συμβόλαια για τον πελάτη.</Typography>
    </Box>
    {q.isLoading ? <CircularProgress size={20} /> : q.isError ? <Typography variant="body2" color="error.main">Δεν ήταν δυνατή η φόρτωση συνεργατών.</Typography> : rows.length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχουν καταχωρηθεί συνεργάτες από συμβόλαια.</Typography> : (
      <Table size="small">
        <TableHead><TableRow><TableCell>Κωδικός</TableCell><TableCell>Συνεργάτης</TableCell><TableCell align="right">Συμβόλαια</TableCell><TableCell align="right">Σύνολο</TableCell><TableCell>Τελευταία έναρξη</TableCell></TableRow></TableHead>
        <TableBody>{rows.map(row => <TableRow key={row.producerId} hover>
          <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{row.producerCode || "—"}</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>{row.producerName || "—"}</TableCell>
          <TableCell align="right">{row.policyCount}</TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>{row.totalPremium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell>
          <TableCell>{row.latestPolicyStart ?? "—"}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    )}
  </Card>;
}

function OverviewTab({ customer }: { customer: CustomerDto }) {
  const nameDaysQ = useQuery({
    queryKey: ["customer-name-days", customer.id],
    retry: false,
    queryFn: async () => (await api.get<{ name: string; month: number; day: number; isActive: boolean }[]>("/name-days")).data
  });
  const matchingNameDays = (nameDaysQ.data ?? []).filter(nameDay => nameDay.isActive && Boolean(customer.firstName) && nameDay.name.localeCompare(customer.firstName ?? "", "el", { sensitivity: "base" }) === 0);
  const annualDate = (value?: string | null, label = "") => {
    if (!value) return "Δεν έχει οριστεί";
    const parts = value.slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
    const [, month, day] = parts;
    const today = new Date();
    let year = today.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) year += 1;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}${label ? ` · ${label}` : ""}`;
  };
  const nextNameDay = matchingNameDays.map(item => {
    const today = new Date();
    let year = today.getFullYear();
    let date = new Date(year, item.month - 1, item.day);
    if (date.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
      year += 1;
      date = new Date(year, item.month - 1, item.day);
    }
    return { date, label: `${String(item.day).padStart(2, "0")}/${String(item.month).padStart(2, "0")}/${year}` };
  }).sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.label;
  const hasDriverLicense = Boolean(customer.driverLicenseNumber || customer.driverLicenseClass || customer.driverLicenseIssueDate || customer.driverLicenseExpiryDate);
  const licenseExpired = customer.driverLicenseExpiryDate ? new Date(customer.driverLicenseExpiryDate).getTime() < Date.now() : false;
  const licenseStatus = !hasDriverLicense ? "Δεν έχει καταχωρηθεί" : licenseExpired ? "Έχει λήξει" : "Καταχωρημένο / ενεργό";
  const contactMethodCount = [customer.email, customer.phone, customer.mobilePhone, customer.altPhone].filter(value => Boolean(value?.trim())).length;
  const identityDocument = customer.idNumber || customer.passportNumber ? "Καταχωρημένο" : "Δεν έχει καταχωρηθεί";
  const taxProfile = customer.vatNumber || customer.taxOffice || customer.gemiNumber ? "Συμπληρωμένο" : "Δεν έχει συμπληρωθεί";
  const age = customer.birthDate ? (() => {
    const birth = new Date(customer.birthDate);
    if (Number.isNaN(birth.getTime())) return "—";
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
    return years >= 0 ? `${years} ετών` : "—";
  })() : "—";
  const groups: { title: string; fields: [string, React.ReactNode][] }[] = [
    { title: "Επικοινωνία & διεύθυνση", fields: [
      ["Κατάσταση", customer.status === "Prospect" ? "Πιθανός πελάτης" : customer.status === "Active" ? "Ενεργός" : customer.status], ["Τύπος πελάτη", customer.type === "Company" ? "Νομικό πρόσωπο" : "Φυσικό πρόσωπο"],
      ["Email", customer.email ?? "—"], ["Κύριο τηλέφωνο", customer.phone ?? "—"], ["Κινητό", customer.mobilePhone ?? "—"], ["2ο τηλέφωνο", customer.altPhone ?? "—"],
      ["Διεύθυνση", customer.address ?? "—"], ["Πόλη / Τ.Κ.", [customer.city, customer.postalCode].filter(Boolean).join(" · ") || "—"], ["Περιφέρεια", customer.region ?? "—"],
      ["Καταχωρημένα κανάλια", `${contactMethodCount} από 4`], ["Ημ. εξόφλησης", customer.paymentDueDate ?? "Δεν έχει οριστεί"], ["Λογαριασμός portal", customer.hasPortalAccount ? "Ενεργός" : "Δεν έχει δημιουργηθεί"]
    ] },
    { title: "Ταυτότητα & προσωπικά στοιχεία", fields: [
      ["ΑΦΜ", customer.vatNumber ?? "—"], ["Αριθμός ταυτότητας", customer.idNumber ?? "—"], ["ΑΜΚΑ", customer.amka ?? "—"], ["Διαβατήριο", customer.passportNumber ?? "—"],
      ["Ημ. γέννησης", customer.birthDate ?? "—"], ["Επόμενα γενέθλια", annualDate(customer.birthDate)], ["Ηλικία", age], ["Ονομαστική εορτή", matchingNameDays.length ? `${matchingNameDays.map(item => `${String(item.day).padStart(2, "0")}/${String(item.month).padStart(2, "0")}`).join(", ")} · επόμενη ${nextNameDay}` : "Δεν έχει αντιστοίχιση"], ["Φύλο", customer.gender ?? "—"], ["Οικογενειακή κατάσταση", customer.maritalStatus ?? "—"], ["Εθνικότητα", customer.nationality ?? "—"],
      ["Πατρώνυμο", customer.fatherName ?? "—"], ["Μητρώνυμο", customer.motherName ?? "—"], ["Σύζυγος / σύντροφος", customer.spouseName ?? "—"]
    ] },
    { title: "Εργασία & εταιρικά στοιχεία", fields: [
      ["Επάγγελμα", customer.occupation ?? "—"], ["Εργοδότης", customer.employer ?? "—"], ["Δραστηριότητα", customer.activityCode ?? "—"], ["Ζώνη", customer.zone ?? "—"],
      ["ΔΟΥ", customer.taxOffice ?? "—"], ["ΓΕΜΗ", customer.gemiNumber ?? "—"], ["Νομική μορφή", customer.legalForm ?? "—"], ["Πηγή", customer.source ?? "—"],
      ["Φορολογικό προφίλ", taxProfile], ["Φωτογραφία προφίλ", customer.photoUrl ? "Καταχωρημένη" : "Δεν έχει καταχωρηθεί"], ["Αριθμός πελάτη", customer.customerNumber]
    ] },
    { title: "Οδήγηση & εσωτερική πληροφόρηση", fields: [
      ["Οδηγός", hasDriverLicense ? "Ναι" : "Δεν έχει καταχωρηθεί"], ["Κατάσταση διπλώματος", licenseStatus], ["Αριθμός διπλώματος", customer.driverLicenseNumber ?? "—"], ["Κατηγορία", customer.driverLicenseClass ?? "—"],
      ["Έκδοση διπλώματος", customer.driverLicenseIssueDate ?? "—"], ["Λήξη διπλώματος", customer.driverLicenseExpiryDate ?? "—"], ["Έγγραφο ταυτοποίησης", identityDocument], ["Ετικέτες", customer.tagsJson ?? "—"]
    ] }
  ];
  const isMissingField = (value: React.ReactNode) => {
    if (value === null || value === undefined || value === false) return true;
    if (typeof value !== "string") return false;
    const text = value.trim();
    return !text || text === "—" || text === "-" || text === "0 από 4" || /^(Δεν |Χωρίς )/i.test(text);
  };
  return (
    <Stack spacing={0.75}>
      {groups.map(group => <Card key={group.title} variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)", borderColor: "rgba(100,116,139,0.2)", borderRadius: 1.5 }}>
        <Box sx={{ mb: 0.75, px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}>
          <Typography variant="subtitle2" fontWeight={800}>{group.title}</Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, gap: 0.5 }}>
          {group.fields.map(([label, value]) => {
            const missing = isMissingField(value);
            return <Box key={label} sx={{
              p: 0.65,
              minWidth: 0,
              minHeight: 42,
              borderRadius: 0.9,
              bgcolor: missing ? "rgba(211,47,47,0.055)" : "rgba(46,125,50,0.065)",
              border: "1px solid",
              borderColor: missing ? "rgba(211,47,47,0.2)" : "rgba(46,125,50,0.2)",
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.66rem", lineHeight: 1.1, mb: 0.2 }}>{label}</Typography>
              <Typography variant="body2" fontWeight={600} color={missing ? "error.dark" : "success.dark"} sx={{ wordBreak: "break-word", fontSize: "0.78rem", lineHeight: 1.2 }}>{value}</Typography>
            </Box>;
          })}
        </Box>
      </Card>)}
      <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 } }}>
        <Typography variant="subtitle2" fontWeight={800}>Σημειώσεις</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>{customer.notes ?? "Δεν υπάρχουν σημειώσεις."}</Typography>
      </Card>
      <CustomerProducersSummary customerId={customer.id} />
      <CustomerVehiclesTab customerId={customer.id} compact />
    </Stack>
  );
}

type CustomerEditForm = Record<string, string> & { type: string; status: string };

function CustomerEditorDialog({ open, customer, onClose }: { open: boolean; customer: CustomerDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<CustomerEditForm>(() => customerEditForm(customer));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTab(0); setForm(customerEditForm(customer)); setError(null); } }, [open, customer]);
  const save = useMutation({
    mutationFn: async () => api.put(`/customers/${customer.id}`, {
      ...form,
      createPortalAccount: false,
      paymentDueDate: form.paymentDueDate || undefined,
      birthDate: form.birthDate || undefined,
      driverLicenseIssueDate: form.driverLicenseIssueDate || undefined,
      driverLicenseExpiryDate: form.driverLicenseExpiryDate || undefined,
      assignedAdvisorId: undefined
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["customer", customer.id] }); void qc.invalidateQueries({ queryKey: ["customers"] }); onClose(); },
    onError: e => setError(extractErrorMessage(e))
  });
  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const field = (label: string, key: string, options?: { type?: string; multiline?: boolean; select?: string[]; placeholder?: string }) => options?.select ? (
    <TextField key={key} size="small" select label={label} value={form[key] ?? ""} onChange={e => set(key, e.target.value)} fullWidth>
      <MenuItem value="">Δεν έχει οριστεί</MenuItem>{options.select.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
    </TextField>
  ) : <TextField key={key} size="small" label={label} type={options?.type} value={form[key] ?? ""} onChange={e => set(key, e.target.value)} fullWidth multiline={options?.multiline} rows={options?.multiline ? 2 : undefined} placeholder={options?.placeholder} InputLabelProps={options?.type === "date" ? { shrink: true } : undefined} />;
  const editorGridSx = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 0.75, alignItems: "start", "& > .MuiFormControl-root, & > .MuiBox-root": { minWidth: 0 }, "& .MuiInputLabel-root": { fontSize: "0.78rem" }, "& .MuiInputBase-root": { minHeight: 38 } };
  const editorSection = (title: string, content: React.ReactNode) => (
    <Card key={title} variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
      <Box sx={{ mb: 0.75, px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}>
        <Typography variant="subtitle2" fontWeight={800}>{title}</Typography>
      </Box>
      <Box sx={editorGridSx}>{content}</Box>
    </Card>
  );
  if (!open) return null;
  return <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, "& .MuiTextField-root": { minWidth: 0 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
      <Box><Typography variant="subtitle1" fontWeight={800}>Επεξεργασία καρτέλας · {customer.customerNumber}</Typography><Typography variant="caption" color="text.secondary">Τα πεδία επεξεργάζονται απευθείας μέσα στην καρτέλα πελάτη.</Typography></Box>
      <Button size="small" color="inherit" onClick={onClose}>Κλείσιμο επεξεργασίας</Button>
    </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Stack spacing={0.75}>
        {editorSection("Επικοινωνία & διεύθυνση", <>
          {field("Τύπος", "type", { select: ["Individual", "Company"] })}{field("Κατάσταση", "status", { select: ["Prospect", "Active", "Inactive", "Churned", "Blocked"] })}
          {field("Όνομα", "firstName")}{field("Επώνυμο", "lastName")}{field("Επωνυμία", "companyName")}
          {field("Email", "email", { type: "email" })}{field("Κύριο τηλέφωνο", "phone")}{field("Κινητό", "mobilePhone")}{field("2ο τηλέφωνο", "altPhone")}
          {field("Διεύθυνση", "address")}{field("Πόλη", "city")}{field("Τ.Κ.", "postalCode")}{field("Περιφέρεια", "region")}
          {field("Ημερομηνία εξόφλησης", "paymentDueDate", { type: "date" })}
          <Box sx={{ gridColumn: { sm: "1 / -1" } }}>{field("Σημειώσεις", "notes", { multiline: true })}</Box>
        </>)}
        {editorSection("Ταυτότητα & οικογένεια", <>
          {field("Ημερομηνία γέννησης", "birthDate", { type: "date" })}{field("Φύλο", "gender", { select: ["Male", "Female", "Other"] })}{field("Εθνικότητα", "nationality")}{field("Οικογενειακή κατάσταση", "maritalStatus")}
          {field("Αριθμός ταυτότητας", "idNumber")}{field("ΑΜΚΑ", "amka")}{field("Διαβατήριο", "passportNumber")}{field("Πατρώνυμο", "fatherName")}
          {field("Μητρώνυμο", "motherName")}{field("Σύζυγος / σύντροφος", "spouseName")}
        </>)}
        {editorSection("Εργασία, φορολογικά & ψηφιακά στοιχεία", <>
          {field("Επάγγελμα", "occupation")}{field("Εργοδότης", "employer")}{field("Κωδικός δραστηριότητας", "activityCode")}{field("Ζώνη", "zone")}
          {field("ΑΦΜ", "vatNumber")}{field("ΔΟΥ", "taxOffice")}{field("ΓΕΜΗ", "gemiNumber")}{field("Νομική μορφή", "legalForm")}
          {field("Πηγή", "source")}{field("Ετικέτες", "tagsJson", { placeholder: "π.χ. premium, εταιρεία" })}{field("URL φωτογραφίας", "photoUrl")}
        </>)}
        {editorSection("Οδήγηση & άδεια οδηγού", <>
          {field("Αριθμός διπλώματος", "driverLicenseNumber")}{field("Κατηγορία διπλώματος", "driverLicenseClass")}{field("Έκδοση", "driverLicenseIssueDate", { type: "date" })}{field("Λήξη", "driverLicenseExpiryDate", { type: "date" })}
          <Alert severity="info" sx={{ gridColumn: { sm: "1 / -1" }, py: 0 }}>Τα οχήματα εμφανίζονται αυτόματα από τα συμβόλαια και τις πινακίδες τους.</Alert>
        </>)}
      </Stack>
      <Box sx={{ display: "none" }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: "divider", mb: 0.75, minHeight: 34, "& .MuiTab-root": { minHeight: 34, py: 0.25, px: 0.75, fontSize: "0.76rem" } }}>
        <Tab label="Βασικά & επικοινωνία" /><Tab label="Ταυτότητα & οικογένεια" /><Tab label="Εργασία, εταιρεία & όχημα" />
      </Tabs>
      {tab === 0 && <Box sx={editorGridSx}>
        {field("Τύπος", "type", { select: ["Individual", "Company"] })}{field("Κατάσταση", "status", { select: ["Prospect", "Active", "Inactive", "Churned", "Blocked"] })}
        {field("Όνομα", "firstName")}{field("Επώνυμο", "lastName")}{field("Επωνυμία", "companyName")}
        {field("Email", "email", { type: "email" })}{field("Κύριο τηλέφωνο", "phone")}{field("Κινητό", "mobilePhone")}{field("2ο τηλέφωνο", "altPhone")}
        {field("Διεύθυνση", "address")}{field("Πόλη", "city")}{field("Τ.Κ.", "postalCode")}{field("Περιφέρεια", "region")}
        {field("Ημερομηνία εξόφλησης", "paymentDueDate", { type: "date" })}
        <Box sx={{ gridColumn: { sm: "1 / -1" } }}>{field("Σημειώσεις", "notes", { multiline: true })}</Box>
      </Box>}
      {tab === 1 && <Box sx={editorGridSx}>
        {field("Ημερομηνία γέννησης", "birthDate", { type: "date" })}{field("Φύλο", "gender", { select: ["Male", "Female", "Other"] })}{field("Εθνικότητα", "nationality")}{field("Οικογενειακή κατάσταση", "maritalStatus")}
        {field("Αριθμός ταυτότητας", "idNumber")}{field("ΑΜΚΑ", "amka")}{field("Διαβατήριο", "passportNumber")}{field("Πατρώνυμο", "fatherName")}
        {field("Μητρώνυμο", "motherName")}{field("Σύζυγος / σύντροφος", "spouseName")}
      </Box>}
      {tab === 2 && <Box sx={editorGridSx}>
        {field("Επάγγελμα", "occupation")}{field("Εργοδότης", "employer")}{field("Κωδικός δραστηριότητας", "activityCode")}{field("Ζώνη", "zone")}
        {field("ΑΦΜ", "vatNumber")}{field("ΔΟΥ", "taxOffice")}{field("ΓΕΜΗ", "gemiNumber")}{field("Νομική μορφή", "legalForm")}
        {field("Αριθμός διπλώματος", "driverLicenseNumber")}{field("Κατηγορία διπλώματος", "driverLicenseClass")}{field("Έκδοση", "driverLicenseIssueDate", { type: "date" })}{field("Λήξη", "driverLicenseExpiryDate", { type: "date" })}
        {field("Πηγή", "source")}{field("Ετικέτες", "tagsJson", { placeholder: "π.χ. premium, εταιρεία" })}{field("URL φωτογραφίας", "photoUrl")}
        <Alert severity="info" sx={{ gridColumn: { sm: "1 / -1" }, py: 0 }}>Τα οχήματα εμφανίζονται αυτόματα από τα συμβόλαια και τις πινακίδες τους.</Alert>
      </Box>}
      </Box>
    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.25 }}>
      <Button size="small" onClick={onClose} color="inherit">Άκυρο</Button>
      <Button size="small" variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση πλήρους καρτέλας"}</Button>
    </Stack>
  </Card>;
}

function customerEditForm(customer: CustomerDto): CustomerEditForm {
  const keys = ["firstName", "lastName", "companyName", "vatNumber", "email", "phone", "address", "city", "postalCode", "notes", "paymentDueDate", "birthDate", "occupation", "fatherName", "motherName", "spouseName", "nationality", "zone", "activityCode", "taxOffice", "gemiNumber", "legalForm", "altPhone", "mobilePhone", "amka", "idNumber", "passportNumber", "region", "gender", "maritalStatus", "employer", "driverLicenseNumber", "driverLicenseClass", "driverLicenseIssueDate", "driverLicenseExpiryDate", "source", "tagsJson", "photoUrl"];
  const result: Record<string, string> = {};
  for (const key of keys) result[key] = String((customer as unknown as Record<string, unknown>)[key] ?? "");
  return { ...result, type: customer.type, status: customer.status };
}

/* ---------- Communications ---------- */

function CommunicationsTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["customer-communications", customerId],
    queryFn: async () => (await api.get<CommunicationRow[]>(`/customers/${customerId}/communications`)).data
  });

  const [form, setForm] = useState({
    kind: "Note",
    direction: "Internal",
    outcome: "None",
    subject: "",
    body: "",
    durationSeconds: ""
  });

  const create = useMutation({
    mutationFn: async () => api.post(`/customers/${customerId}/communications`, {
      kind: form.kind,
      direction: form.direction,
      outcome: form.outcome,
      subject: form.subject.trim(),
      body: form.body.trim(),
      occurredAt: new Date().toISOString(),
      durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null
    }),
    onSuccess: () => {
      setOpen(false);
      setForm({ kind: "Note", direction: "Internal", outcome: "None", subject: "", body: "", durationSeconds: "" });
      void qc.invalidateQueries({ queryKey: ["customer-communications", customerId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Ιστορικό επικοινωνίας</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>+ Νέα καταχώρηση</Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? <CircularProgress /> : q.data?.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
          Δεν υπάρχει καμία καταχωρημένη αλληλεπίδραση ακόμη.
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {q.data?.map((c) => (
            <Card key={c.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={c.kind} color="primary" variant="outlined" />
                  <Chip size="small" label={c.direction} variant="outlined" />
                  {c.outcome !== "None" && <Chip size="small" label={c.outcome} variant="outlined" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">{formatDate(c.occurredAt)}</Typography>
              </Stack>
              <Typography sx={{ mt: 1, fontWeight: 700 }}>{c.subject}</Typography>
              {c.body && <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", fontSize: 14 }}>{c.body}</Typography>}
              {c.relatedPolicyNumber && (
                <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                  Συμβόλαιο: {c.relatedPolicyNumber}
                </Typography>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Νέα καταχώρηση επικοινωνίας</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <SearchableTextField label="Τύπος" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {COMMUNICATION_KINDS.map((k) => <MenuItem key={k} value={k}>{String(t(`communicationKind.${k}`, k))}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField label="Κατεύθυνση" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              {["Internal", "Inbound", "Outbound"].map((d) => <MenuItem key={d} value={d}>{String(t(`communicationDirection.${d}`, d))}</MenuItem>)}
            </SearchableTextField>
            <TextField required label="Θέμα" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextField multiline rows={4} label="Σώμα / σημειώσεις" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <TextField type="number" label="Διάρκεια (sec)" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="error" variant="contained">Άκυρο</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending || !form.subject.trim()}>
            Καταχώρηση
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---------- Consents ---------- */

function ConsentsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["customer-consents", customerId],
    queryFn: async () => (await api.get<ConsentRow[]>(`/customers/${customerId}/consents`)).data
  });

  const grant = useMutation({
    mutationFn: async (type: string) => {
      // Νομικές συγκαταθέσεις: υπογράφονται σε τυπωμένο έντυπο. Marketing:
      // στην πράξη δίνονται είτε τηλεφωνικά είτε online — «OnlineForm» είναι
      // λογικό default. Ο operator μπορεί να το αλλάξει από το UI αν χρειαστεί.
      const isLegal = CONSENT_TYPES_LEGAL.includes(type);
      return api.post(`/customers/${customerId}/consents`, {
        type,
        method: isLegal ? "PaperForm" : "OnlineForm",
        version: "v1.0"
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-consents", customerId] });
      qc.invalidateQueries({ queryKey: ["compliance-dashboard"] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const revoke = useMutation({
    mutationFn: async (type: string) => api.post(`/customers/${customerId}/consents/revoke`, { type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-consents", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const liveByType = useMemo(() => {
    const m: Record<string, ConsentRow | undefined> = {};
    for (const c of q.data ?? []) {
      if (!c.revokedAt && !m[c.type]) m[c.type] = c;
    }
    return m;
  }, [q.data]);

  const renderRow = (type: string, i: number) => {
    const active = !!liveByType[type];
    return (
      <Stack key={type} direction="row" alignItems="center" sx={{
        p: 2,
        borderTop: i === 0 ? 0 : 1,
        borderColor: "divider"
      }}>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={700}>{consentLabel(type)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {active
              ? `Δόθηκε ${formatDate(liveByType[type]!.grantedAt)}`
              : "Ανενεργό"}
          </Typography>
        </Box>
        <Switch
          checked={active}
          disabled={grant.isPending || revoke.isPending}
          onChange={(e) => (e.target.checked ? grant.mutate(type) : revoke.mutate(type))}
        />
      </Stack>
    );
  };

  return (
    <Box>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      <Typography variant="h6" sx={{ mb: 1.5 }}>Νομικές Συγκαταθέσεις</Typography>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Υποχρεωτικές βάσει GDPR / IDD / AML. Πάρτε το έντυπο από τη σελίδα «Νομικά
        Έντυπα Πελατών», δώστε το στον πελάτη, και μόλις υπογραφεί ενεργοποιήστε
        το αντίστοιχο switch εδώ.
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        {CONSENT_TYPES_LEGAL.map((type, i) => renderRow(type, i))}
      </Card>

      <Typography variant="h6" sx={{ mb: 1.5 }}>Συγκαταθέσεις Επικοινωνίας</Typography>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Marketing opt-ins ανά κανάλι. Ο πελάτης μπορεί να ανακαλέσει ανά πάσα στιγμή.
      </Typography>
      <Card variant="outlined">
        {CONSENT_TYPES_MARKETING.map((type, i) => renderRow(type, i))}
      </Card>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center" }}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} /> Ιστορικό
        </Typography>
        {q.data?.length === 0 ? (
          <Typography color="text.secondary" variant="body2">—</Typography>
        ) : (
          <Card variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Τύπος</TableCell>
                  <TableCell>Κατάσταση</TableCell>
                  <TableCell>Από</TableCell>
                  <TableCell>Ανακλήθηκε</TableCell>
                  <TableCell>Μέθοδος</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(q.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{consentLabel(c.type)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={c.revokedAt ? "Ανακλήθηκε" : "Ενεργό"}
                        color={c.revokedAt ? "default" : "success"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(c.grantedAt)}</TableCell>
                    <TableCell>{c.revokedAt ? formatDate(c.revokedAt) : "—"}</TableCell>
                    <TableCell>{c.method}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Box>
    </Box>
  );
}

function consentLabel(type: string): string {
  switch (type) {
    case "PrivacyNotice": return "Ενημέρωση Υποκειμένου (Άρθρο 13 GDPR)";
    case "HealthDataProcessing": return "Επεξεργασία δεδομένων υγείας (Άρθρο 9 GDPR)";
    case "IddDemandsAndNeeds": return "Ανάλυση Αναγκών Πελάτη (IDD)";
    case "AmlKycDeclaration": return "Δήλωση Πραγματικού Δικαιούχου (AML/KYC)";
    case "EmailMarketing": return "Email marketing";
    case "SmsMarketing": return "SMS marketing";
    case "ViberMarketing": return "Viber marketing";
    case "PhoneMarketing": return "Τηλεμάρκετινγκ";
    case "AutomatedDecisionMaking": return "Αυτοματοποιημένη λήψη αποφάσεων";
    case "DataSharingPartners": return "Κοινοποίηση σε συνεργάτες";
    default: return type;
  }
}

// Kept as an internal legacy implementation for backwards-compatible bundles;
// the old consent page is no longer exposed from the customer-card navigation.
void ConsentsTab;

/* ---------- Contacts (for company customers) ---------- */

function ContactsTab({ customerId, customerType }: { customerId: string; customerType: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactRow | null>(null);

  const q = useQuery({
    queryKey: ["customer-contacts", customerId],
    queryFn: async () => (await api.get<ContactRow[]>(`/customers/${customerId}/contacts`)).data
  });

  const empty = { firstName: "", lastName: "", role: "", email: "", phone: "", notes: "", isPrimary: false };
  const [form, setForm] = useState<typeof empty>(empty);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (c: ContactRow) => {
    setEditing(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: "",
      isPrimary: c.isPrimary
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        isPrimary: form.isPrimary
      };
      if (editing) return api.put(`/customers/${customerId}/contacts/${editing.id}`, payload);
      return api.post(`/customers/${customerId}/contacts`, payload);
    },
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["customer-contacts", customerId] });
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const del = useMutation({
    mutationFn: async (cid: string) => api.delete(`/customers/${customerId}/contacts/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-contacts", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: { xs: 0.75, md: 1 }, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "rgba(248,250,252,0.92)" }}>
        <Box sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>
          Επαφές
          {customerType !== "Company" && (
            <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 12 }}>
              (συνήθως για νομικά πρόσωπα)
            </Typography>
          )}
        </Typography></Box>
        <Button size="small" variant="contained" onClick={startCreate}>+ Νέα επαφή</Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? <CircularProgress /> : q.data?.length === 0 ? (
        <Card variant="outlined" sx={{ p: 1.5, textAlign: "center", color: "text.secondary" }}>
          Δεν έχουν προστεθεί επιπλέον επαφές.
        </Card>
      ) : (
        <Card variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Όνομα</TableCell>
                <TableCell>Ρόλος</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Τηλέφωνο</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    {c.firstName} {c.lastName}
                    {c.isPrimary && <Chip size="small" label="Κύρια" color="primary" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{c.role ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => startEdit(c)}>Επεξεργασία</Button>
                    <IconButton size="small" color="error" onClick={() => { if (confirm("Διαγραφή;")) del.mutate(c.id); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Επεξεργασία επαφής" : "Νέα επαφή"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField required label="Όνομα" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth />
              <TextField required label="Επώνυμο" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Ρόλος" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              helperText="π.χ. Νόμιμος εκπρόσωπος, HR Manager, Λογιστής" />
            <Stack direction="row" spacing={2}>
              <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
              <TextField label="Τηλέφωνο" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            </Stack>
            <TextField label="Σημειώσεις" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} />
              <Typography>Κύρια επαφή</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="error" variant="contained">Άκυρο</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.firstName || !form.lastName}>
            Αποθήκευση
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---------- Family, assets and insurance opportunities ---------- */

const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"];
const RELATIONSHIP_TYPES = ["Spouse", "Partner", "Child", "Parent", "Grandparent", "Grandchild", "Sibling", "Dependent", "Other"];
const NEED_LABEL: Record<string, string> = {
  Home: "Κατοικία", Vehicle: "Όχημα", Health: "Υγεία", Life: "Ζωή", Business: "Επιχείρηση",
  Travel: "Ταξίδι", Pet: "Κατοικίδιο", Liability: "Αστική ευθύνη", Cyber: "Cyber", Other: "Άλλο"
};
const RELATION_LABEL: Record<string, string> = {
  Spouse: "Σύζυγος", Partner: "Σύντροφος", Child: "Παιδί", Parent: "Γονέας", Grandparent: "Παππούς / γιαγιά",
  Grandchild: "Εγγόνι", Sibling: "Αδελφός / αδελφή", Dependent: "Εξαρτώμενο μέλος", Other: "Άλλη σχέση"
};

function FamilyNeedsTab({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["customer-family", customerId],
    queryFn: async () => (await api.get<FamilyProfile>(`/customers/${customerId}/family`)).data
  });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError || !q.data) return <Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Δεν φορτώθηκε η οικογενειακή καρτέλα."}</Alert>;

  return (
    <Stack spacing={0.75}>
      <CustomerProfileCard customerId={customerId} profile={q.data.profile} />
      <DriverLicenseCard customerId={customerId} />
      <CustomerNeedsCard customerId={customerId} needs={q.data.needs} />
      <FamilyMembersCard customerId={customerId} members={q.data.family} />
      <CommunicationsCard customerId={customerId} />
      <OpportunitiesCard opportunities={q.data.opportunities} />
    </Stack>
  );
}

function ConsentsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["consents", customerId],
    queryFn: async () => (await api.get<any[]>(`/customers/${customerId}/consents`)).data
  });
  const [form, setForm] = useState({ kind: "Marketing", channel: "Email", source: "ManualAgency" });
  const grant = useMutation({
    mutationFn: async () => (await api.post(`/customers/${customerId}/consents`, form)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consents", customerId] })
  });
  const revoke = useMutation({
    mutationFn: async (kind: string) => api.post(`/customers/${customerId}/consents/revoke`, { kind }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["consents", customerId] })
  });
  return (
    <Card variant="outlined" sx={{ p: 2.5 }}>
      <Stack mb={2}>
        <Typography variant="h6">Συγκαταθέσεις (GDPR)</Typography>
        <Typography variant="body2" color="text.secondary">
          Καταγραφή ρητής συγκατάθεσης για επικοινωνία / προώθηση / άλλους σκοπούς.
        </Typography>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (q.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">Δεν έχουν καταγραφεί συγκαταθέσεις.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {(q.data ?? []).map((c: any) => (
            <Stack key={c.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={700}>{c.kind} · {c.channel}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Από {c.source} · {c.grantedAt ? `δοθείσα ${c.grantedAt}` : "—"}
                  {c.revokedAt && ` · ανακλήθηκε ${c.revokedAt}`}
                </Typography>
              </Box>
              {!c.revokedAt && (
                <Button size="small" color="error" onClick={() => revoke.mutate(c.kind)}>Ανάκληση</Button>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Νέα συγκατάθεση</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
          <SearchableTextField size="small" label="Είδος" value={form.kind}
            onChange={e => setForm({ ...form, kind: e.target.value })} sx={{ minWidth: 160 }}>
            {["Marketing", "Communication", "DataSharing", "Other"].map(k => <MenuItem key={k} value={k}>{String(t(`consentKind.${k}`, k))}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField size="small" label="Κανάλι" value={form.channel}
            onChange={e => setForm({ ...form, channel: e.target.value })} sx={{ minWidth: 140 }}>
            {["Email", "Sms", "Phone", "Postal", "All"].map(c => <MenuItem key={c} value={c}>{String(t(`consentChannel.${c}`, c))}</MenuItem>)}
          </SearchableTextField>
          <Button variant="contained" onClick={() => grant.mutate()} disabled={grant.isPending}>
            {grant.isPending ? <CircularProgress size={18} /> : "Καταγραφή συγκατάθεσης"}
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}

// Kept for older bundles and API compatibility; the customer card no longer
// renders the confusing legal-consents block. Forms are handled in GDPR actions.
void ConsentsCard;

function CommunicationsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["communications", customerId],
    queryFn: async () => (await api.get<any[]>(`/customers/${customerId}/communications`)).data
  });
  const [form, setForm] = useState({ kind: "Call", subject: "", summary: "" });
  const log = useMutation({
    mutationFn: async () => (await api.post(`/customers/${customerId}/communications`, form)).data,
    onSuccess: () => {
      setOpen(false);
      setForm({ kind: "Call", subject: "", summary: "" });
      void qc.invalidateQueries({ queryKey: ["communications", customerId] });
    }
  });
  return (
    <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={0.75} sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800}>Επικοινωνίες</Typography>
          <Typography variant="caption" color="text.secondary">
            Ιστορικό κλήσεων / email / SMS / επιστολών με τον πελάτη.
          </Typography>
        </Box>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ flexShrink: 0 }}>
          Προσθήκη επικοινωνίας
        </Button>
      </Stack>
      {q.isLoading ? <CircularProgress size={20} /> : (q.data ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">Δεν έχουν καταγραφεί επικοινωνίες.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {(q.data ?? []).slice(0, 20).map((c: any) => (
            <Box key={c.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                <Typography fontWeight={700}>{c.kind} · {c.subject ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">{c.occurredAt ?? c.createdAt}</Typography>
              </Stack>
              {c.summary && <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>{c.summary}</Typography>}
            </Box>
          ))}
        </Stack>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Προσθήκη επικοινωνίας</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} mt={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <SearchableTextField size="small" label="Είδος" value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value })} sx={{ minWidth: { sm: 180 } }}>
                {["Call", "Email", "Sms", "Postal", "Meeting", "Note"].map(k => <MenuItem key={k} value={k}>{String(t(`communicationKind.${k}`, k))}</MenuItem>)}
              </SearchableTextField>
              <TextField size="small" label="Θέμα" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })} fullWidth />
            </Stack>
            <TextField size="small" label="Σύνοψη" value={form.summary} multiline rows={4}
              onChange={e => setForm({ ...form, summary: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="error" variant="contained">Ακύρωση</Button>
          <Button variant="contained" onClick={() => log.mutate()} disabled={log.isPending || !form.subject.trim()}>
            {log.isPending ? <CircularProgress size={18} /> : "Καταγραφή"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function DriverLicenseCard({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["driver-license", customerId],
    queryFn: async () => (await api.get<{ number: string | null; class: string | null;
      issueDate: string | null; expiryDate: string | null }>(`/customers/${customerId}/driver-license`)).data
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ number: "", class: "", issueDate: "", expiryDate: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setForm({
      number: q.data.number ?? "", class: q.data.class ?? "",
      issueDate: q.data.issueDate ?? "", expiryDate: q.data.expiryDate ?? ""
    });
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => api.put(`/customers/${customerId}/driver-license`, {
      number: form.number || null, class: form.class || null,
      issueDate: form.issueDate || null, expiryDate: form.expiryDate || null
    }),
    onSuccess: () => { setEditing(false); setErr(null); void qc.invalidateQueries({ queryKey: ["driver-license", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  return (
    <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Box sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>Δίπλωμα οδήγησης</Typography>
          <Typography variant="caption" color="text.secondary">
            Χρησιμοποιείται στις ασφαλίσεις αυτοκινήτου και στη λίστα επιτρεπτών οδηγών.
          </Typography></Box>
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(!editing)} color="error" variant="contained">{editing ? "Ακύρωση" : "Επεξεργασία"}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {editing ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField label="Αριθμός" value={form.number}
            onChange={e => setForm({ ...form, number: e.target.value })} sx={{ flex: 1, minWidth: 200 }} />
          <SearchableTextField label="Κατηγορία" value={form.class}
            onChange={e => setForm({ ...form, class: e.target.value })} sx={{ width: 160 }}>
            <MenuItem value="">—</MenuItem>
            {["ΑΜ", "Α1", "Α2", "Α", "Β", "ΒΕ", "Γ", "ΓΕ", "Δ", "ΔΕ"].map(k =>
              <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </SearchableTextField>
          <TextField type="date" label="Έκδοση" InputLabelProps={{ shrink: true }}
            value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} sx={{ width: 180 }} />
          <TextField type="date" label="Λήξη" InputLabelProps={{ shrink: true }}
            value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} sx={{ width: 180 }} />
          <Box sx={{ width: "100%" }}>
            <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button>
          </Box>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" } }}>
          <ProfileValue label="Αριθμός" value={q.data?.number ?? null} />
          <ProfileValue label="Κατηγορία" value={q.data?.class ?? null} />
          <ProfileValue label="Έκδοση" value={q.data?.issueDate ?? null} />
          <ProfileValue label="Λήξη" value={q.data?.expiryDate ?? null} />
        </Box>
      )}
    </Card>
  );
}

function CustomerProfileCard({ customerId, profile }: { customerId: string; profile: FamilyProfile["profile"] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  // Reference-catalog lookups feed the two free-text-lite fields the operators
  // actually fill in every day. Kept lazy — only fetched when the operator
  // starts editing the profile card.
  const occupationsQ = useQuery({
    queryKey: ["lookup", "occupations"],
    enabled: editing,
    queryFn: async () => (await api.get<Array<{ id: string; name: string; category?: string | null }>>("/lookups/occupations")).data
  });
  const nationalitiesQ = useQuery({
    queryKey: ["lookup", "nationalities"],
    enabled: editing,
    queryFn: async () => (await api.get<Array<{ id: string; iso2: string; name: string }>>("/lookups/nationalities")).data
  });
  const [form, setForm] = useState({
    maritalStatus: "", occupation: "", employer: "", mobilePhone: "", notes: "",
    fatherName: "", motherName: "", spouseName: "",
    nationality: "", zone: "", activityCode: ""
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setForm({
    maritalStatus: profile.maritalStatus ?? "", occupation: profile.occupation ?? "", employer: profile.employer ?? "",
    mobilePhone: profile.mobilePhone ?? "", notes: profile.notes ?? "",
    fatherName: profile.fatherName ?? "", motherName: profile.motherName ?? "", spouseName: profile.spouseName ?? "",
    nationality: profile.nationality ?? "", zone: profile.zone ?? "", activityCode: profile.activityCode ?? ""
  }), [profile]);
  const save = useMutation({
    mutationFn: async () => api.put(`/customers/${customerId}/family/profile`, form),
    onSuccess: () => { setEditing(false); setErr(null); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });

  return (
    <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Box sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>Προφίλ και οικογενειακή κατάσταση</Typography>
          <Typography variant="caption" color="text.secondary">Τα στοιχεία αυτά χρησιμοποιούνται στα φίλτρα πελατών, στα ασφαλιστικά έντυπα και στις προτάσεις κάλυψης.</Typography></Box>
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(!editing)} color="error" variant="contained">{editing ? "Ακύρωση" : "Επεξεργασία"}</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {editing ? (
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <SearchableTextField label="Οικογενειακή κατάσταση" value={form.maritalStatus} onChange={e => setForm({ ...form, maritalStatus: e.target.value })} fullWidth>
              <MenuItem value="">—</MenuItem>
              {["Single", "Married", "Divorced", "Widowed", "Other"].map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </SearchableTextField>
            <Autocomplete
              freeSolo fullWidth
              options={(occupationsQ.data ?? []).map(o => o.name)}
              value={form.occupation}
              onChange={(_, v) => setForm({ ...form, occupation: v ?? "" })}
              onInputChange={(_, v) => setForm({ ...form, occupation: v })}
              renderInput={(p) => <TextField {...p} label="Επάγγελμα / κλάδος"
                helperText="Ελεύθερο κείμενο ή επιλογή από τον κατάλογο «Επαγγέλματα» (Λίστες & Καταλόγοι)." />}
            />
            <TextField label="Εργοδότης / επιχείρηση" value={form.employer} onChange={e => setForm({ ...form, employer: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField label="Πατρώνυμο" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} fullWidth
              helperText="Απαιτείται για MyDATA και ασφαλιστικά έντυπα." />
            <TextField label="Μητρώνυμο" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} fullWidth />
            <TextField label="Όνομα συζύγου" value={form.spouseName} onChange={e => setForm({ ...form, spouseName: e.target.value })} fullWidth
              helperText="Ελεύθερο κείμενο. Για δομημένη σχέση χρησιμοποιήστε την ενότητα Οικογένεια." />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <Autocomplete
              freeSolo fullWidth
              options={(nationalitiesQ.data ?? []).map(n => n.name)}
              value={form.nationality}
              onChange={(_, v) => setForm({ ...form, nationality: v ?? "" })}
              onInputChange={(_, v) => setForm({ ...form, nationality: v })}
              renderInput={(p) => <TextField {...p} label="Εθνικότητα" placeholder="π.χ. Ελληνική" />}
            />
            <TextField label="Ζώνη" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} fullWidth
              helperText="Γεωγραφική ή εμπορική ζώνη για πολιτικές τιμολόγησης." />
            <TextField label="Κωδικός δραστηριότητας" value={form.activityCode} onChange={e => setForm({ ...form, activityCode: e.target.value })} fullWidth
              placeholder="π.χ. ΚΑΔ" />
          </Stack>
          <TextField label="Κινητό" value={form.mobilePhone} onChange={e => setForm({ ...form, mobilePhone: e.target.value })} fullWidth />
          <TextField label="Σημειώσεις πελάτη" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
          <Stack direction="row" justifyContent="flex-end"><Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Αποθήκευση</Button></Stack>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 0.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" } }}>
          <ProfileValue label="Οικογενειακή κατάσταση" value={profile.maritalStatus} />
          <ProfileValue label="Επάγγελμα / κλάδος" value={profile.occupation} />
          <ProfileValue label="Εργοδότης / επιχείρηση" value={profile.employer} />
          <ProfileValue label="Κινητό" value={profile.mobilePhone ?? profile.phone} />
          <ProfileValue label="Πατρώνυμο" value={profile.fatherName} />
          <ProfileValue label="Μητρώνυμο" value={profile.motherName} />
          <ProfileValue label="Όνομα συζύγου" value={profile.spouseName} />
          <ProfileValue label="Εθνικότητα" value={profile.nationality} />
          <ProfileValue label="Ζώνη" value={profile.zone} />
          <ProfileValue label="Κωδ. δραστηριότητας" value={profile.activityCode} />
          {profile.notes && <Box sx={{ gridColumn: "1/-1" }}><ProfileValue label="Σημειώσεις" value={profile.notes} /></Box>}
        </Box>
      )}
    </Card>
  );
}

function ProfileValue({ label, value }: { label: string; value?: string | null }) {
  const missing = !value || value === "—";
  return <Box sx={{ p: 0.65, minWidth: 0, minHeight: 42, borderRadius: 0.9, bgcolor: missing ? "rgba(211,47,47,0.055)" : "rgba(46,125,50,0.065)", border: "1px solid", borderColor: missing ? "rgba(211,47,47,0.2)" : "rgba(46,125,50,0.2)" }}><Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.66rem", lineHeight: 1.1 }}>{label}</Typography><Typography fontWeight={700} color={missing ? "error.dark" : "success.dark"} sx={{ wordBreak: "break-word", fontSize: "0.78rem", lineHeight: 1.2 }}>{value || "—"}</Typography></Box>;
}

function CustomerNeedsCard({ customerId, needs }: { customerId: string; needs: CustomerNeed[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerNeed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const empty = { kind: "Home", title: "", hasAsset: true, isInsured: false, priority: 3, nextContactAt: "", notes: "" };
  const [form, setForm] = useState(empty);
  const openCreate = (kind?: string) => { setEditing(null); setForm({ ...empty, kind: kind ?? "Home", title: kind === "Home" ? "Κύρια κατοικία" : kind === "Vehicle" ? "Όχημα" : "" }); setOpen(true); };
  const openEdit = (need: CustomerNeed) => { setEditing(need); setForm({ kind: need.kind, title: need.title, hasAsset: need.hasAsset, isInsured: need.isInsured, priority: need.priority, nextContactAt: need.nextContactAt ?? "", notes: need.notes ?? "" }); setOpen(true); };
  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, nextContactAt: form.nextContactAt || null };
      return editing ? api.put(`/customers/${customerId}/family/needs/${editing.id}`, body) : api.post(`/customers/${customerId}/family/needs`, body);
    },
    onSuccess: () => { setOpen(false); setErr(null); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); },
    onError: e => setErr(extractErrorMessage(e))
  });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/customers/${customerId}/family/needs/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }), onError: e => setErr(extractErrorMessage(e)) });

  return (
    <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75} flexWrap="wrap" gap={1}>
        <Box sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>Περιουσία και ανάγκες ασφάλισης</Typography><Typography variant="caption" color="text.secondary">Καταχωρήστε όχημα, σπίτι, υγεία ή οποιαδήποτε ανάγκη. Η κατάσταση «χωρίς κάλυψη» τροφοδοτεί τις προτάσεις.</Typography></Box>
        <Button size="small" variant="contained" onClick={() => openCreate()}>+ Νέα ανάγκη</Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Button size="small" startIcon={<HomeWorkIcon />} onClick={() => openCreate("Home")}>Έχει σπίτι</Button>
        <Button size="small" startIcon={<DirectionsCarIcon />} onClick={() => openCreate("Vehicle")}>Έχει όχημα</Button>
        <Button size="small" startIcon={<HealthAndSafetyIcon />} onClick={() => openCreate("Health")}>Υγεία</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
      {needs.length === 0 ? <Alert severity="info">Δεν έχουν καταχωρηθεί ακόμη περιουσία ή ανάγκες.</Alert> : (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          {needs.map(need => <Card key={need.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" gap={1}><Box><Chip label={NEED_LABEL[need.kind] ?? need.kind} size="small" color={need.isInsured ? "success" : "warning"} />
              <Typography fontWeight={800} mt={0.5}>{need.title}</Typography>
              <Typography variant="caption" color="text.secondary">{need.isInsured ? "Με ενεργή κάλυψη" : "Χωρίς ενεργή κάλυψη"} · Προτεραιότητα {need.priority}/5</Typography>
              {need.notes && <Typography variant="body2" mt={0.5}>{need.notes}</Typography>}</Box>
              <Stack spacing={0.25}><Button size="small" onClick={() => openEdit(need)}>Επεξεργασία</Button><Button size="small" color="error" onClick={() => { if (confirm("Διαγραφή ανάγκης;")) del.mutate(need.id); }}>Διαγραφή</Button></Stack>
            </Stack>
          </Card>)}
        </Box>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Επεξεργασία ανάγκης" : "Νέα ανάγκη / περιουσία"}</DialogTitle><DialogContent><Stack spacing={2} mt={1}>
        <SearchableTextField label="Τύπος" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} fullWidth>{NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{NEED_LABEL[kind]}</MenuItem>)}</SearchableTextField>
        <TextField label="Περιγραφή" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth required placeholder="π.χ. Toyota Yaris, εξοχικό, ιδιωτική υγεία" />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><FormControlLabel control={<Switch checked={form.hasAsset} onChange={e => setForm({ ...form, hasAsset: e.target.checked })} />} label="Έχει την περιουσία / ανάγκη" />
          <FormControlLabel control={<Switch checked={form.isInsured} onChange={e => setForm({ ...form, isInsured: e.target.checked })} />} label="Είναι ήδη ασφαλισμένο" /></Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><SearchableTextField label="Προτεραιότητα" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} fullWidth>{[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}</SearchableTextField>
          <TextField type="date" label="Επόμενη επικοινωνία" InputLabelProps={{ shrink: true }} value={form.nextContactAt} onChange={e => setForm({ ...form, nextContactAt: e.target.value })} fullWidth /></Stack>
        <TextField label="Σημειώσεις" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
      </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} color="error" variant="contained">Άκυρο</Button><Button variant="contained" disabled={!form.title.trim() || save.isPending} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions></Dialog>
    </Card>
  );
}

function FamilyMembersCard({ customerId, members }: { customerId: string; members: FamilyMember[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ relatedCustomerId: "", relationshipType: "Spouse", notes: "" });
  const customersQ = useQuery({ queryKey: ["customers", "family-candidates"], queryFn: async () => (await api.get<{ id: string; customerNumber: string; type: string; firstName?: string; lastName?: string; companyName?: string }[]>("/customers")).data, enabled: open });
  const save = useMutation({ mutationFn: async () => api.post(`/customers/${customerId}/family/relationships`, form),
    onSuccess: () => { setOpen(false); setForm({ relatedCustomerId: "", relationshipType: "Spouse", notes: "" }); void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }); }, onError: e => setErr(extractErrorMessage(e)) });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/customers/${customerId}/family/relationships/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-family", customerId] }), onError: e => setErr(extractErrorMessage(e)) });
  const candidates = (customersQ.data ?? []).filter(c => c.id !== customerId && !members.some(member => member.customerId === c.id));
  const display = (candidate: typeof candidates[number]) => candidate.type === "Company" ? candidate.companyName ?? candidate.customerNumber : `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim();

  return <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)" }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}><Box sx={{ px: 0.75, py: 0.5, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>Οικογένεια και συνδεδεμένοι πελάτες</Typography><Typography variant="caption" color="text.secondary">Κάθε μέλος βλέπει τα δικά του συμβόλαια, ανάγκες και τις εκκρεμείς ευκαιρίες κάλυψης.</Typography></Box><Button size="small" variant="contained" onClick={() => setOpen(true)}>+ Σύνδεση μέλους</Button></Stack>
    {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
    {members.length === 0 ? <Alert severity="info">Δεν έχουν συνδεθεί ακόμη σύζυγος, παιδιά ή άλλα μέλη.</Alert> : <Stack spacing={1}>{members.map(member => <Card key={member.relationshipId} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={800}>{member.displayName}</Typography><Chip size="small" label={RELATION_LABEL[member.relationshipType] ?? member.relationshipType} /></Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={1}>{member.policies.length ? member.policies.map(policy => <Chip key={policy.id} size="small" color="success" variant="outlined" label={`${policy.policyType} · ${policy.policyNumber}`} />) : <Typography variant="caption" color="text.secondary">Δεν έχει συμβόλαια.</Typography>}</Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>{member.needs.map(need => <Chip key={need.id} size="small" color={need.isInsured ? "success" : "warning"} label={`${NEED_LABEL[need.kind] ?? need.kind}: ${need.title}`} />)}</Stack>
      {member.notes && <Typography variant="body2" color="text.secondary" mt={0.75}>{member.notes}</Typography>}</Box><Button size="small" color="error" onClick={() => { if (confirm("Αφαίρεση οικογενειακής σχέσης;")) del.mutate(member.relationshipId); }}>Αφαίρεση</Button></Stack></Card>)}</Stack>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Σύνδεση οικογενειακού μέλους</DialogTitle><DialogContent><Stack spacing={2} mt={1}>
      <SearchableSelect
        label="Υπάρχων πελάτης"
        required
        value={form.relatedCustomerId}
        onChange={(v) => setForm({ ...form, relatedCustomerId: v })}
        options={candidates.map(candidate => ({
          value: candidate.id,
          label: display(candidate),
          hint: candidate.customerNumber,
        }))}
      />
      <SearchableTextField label="Σχέση" value={form.relationshipType} onChange={e => setForm({ ...form, relationshipType: e.target.value })} fullWidth>{RELATIONSHIP_TYPES.map(type => <MenuItem key={type} value={type}>{RELATION_LABEL[type]}</MenuItem>)}</SearchableTextField>
      <TextField label="Σημειώσεις σχέσης" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={3} fullWidth />
      <Alert severity="info">Αν το μέλος δεν υπάρχει ακόμη ως πελάτης, δημιουργήστε πρώτα την καρτέλα του και μετά συνδέστε το εδώ.</Alert>
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} color="error" variant="contained">Άκυρο</Button><Button variant="contained" disabled={!form.relatedCustomerId || save.isPending} onClick={() => save.mutate()}>Σύνδεση</Button></DialogActions></Dialog>
  </Card>;
}

function OpportunitiesCard({ opportunities }: { opportunities: FamilyProfile["opportunities"] }) {
  return <Card variant="outlined" sx={{ p: { xs: 0.75, md: 1 }, bgcolor: "rgba(248,250,252,0.92)", borderColor: opportunities.length ? "warning.light" : "divider" }}>
    <Box sx={{ px: 0.75, py: 0.5, mb: 0.75, borderRadius: 0.75, bgcolor: "rgba(25,118,210,0.08)", borderLeft: "3px solid", borderColor: "primary.main" }}><Typography variant="subtitle2" fontWeight={800}>Προτεινόμενες καλύψεις</Typography><Typography variant="caption" color="text.secondary">Παράγονται από την καταχωρημένη περιουσία/ανάγκη όταν δεν υπάρχει ενεργό συμβόλαιο του αντίστοιχου κλάδου.</Typography></Box>
    {opportunities.length === 0 ? <Alert severity="success">Δεν υπάρχουν ανοικτές προτάσεις με βάση τα σημερινά στοιχεία.</Alert> : <Stack spacing={1}>{opportunities.map((opportunity, index) => <Alert key={`${opportunity.customerId}-${opportunity.needKind}-${index}`} severity="warning"><strong>{opportunity.customerName}</strong>{opportunity.relationship ? ` (${RELATION_LABEL[opportunity.relationship] ?? opportunity.relationship})` : ""}: {NEED_LABEL[opportunity.needKind] ?? opportunity.needKind} — {opportunity.needTitle}. {opportunity.reason}</Alert>)}</Stack>}
  </Card>;
}

function InsuranceOpportunitiesTab({ customerId }: { customerId: string }) {
  const q = useQuery({ queryKey: ["customer-family", customerId], queryFn: async () => (await api.get<FamilyProfile>(`/customers/${customerId}/family`)).data });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError || !q.data) return <Alert severity="error">{q.isError ? extractErrorMessage(q.error) : "Δεν φορτώθηκαν προτάσεις."}</Alert>;
  return <OpportunitiesCard opportunities={q.data.opportunities} />;
}

/* ---------- GDPR actions (export + anonymize) ---------- */

interface CustomerFormSigningRow {
  id: string; customerId: string; policyId?: string | null; formCode: string; status: string;
  customerConsented?: boolean | null; customerName: string; customerEmail?: string | null;
  officeEmail?: string | null; insurerEmail?: string | null; createdAt: string; expiresAt: string;
  customerSignedAt?: string | null; officeSignedAt?: string | null; insurerSignedAt?: string | null;
  completedAt?: string | null; hasFinalDocument: boolean;
}
interface CustomerFormPolicyOption { id: string; policyNumber: string; insuranceCompanyName: string; status: string; }

function CustomerGdprFormSigningPanel({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customer-form-signings", customerId], queryFn: async () => (await api.get<CustomerFormSigningRow[]>(`/customers/${customerId}/form-signings`)).data });
  const policiesQ = useQuery({ queryKey: ["customer-form-signing-policies", customerId], queryFn: async () => (await api.get<CustomerFormPolicyOption[]>("/policies", { params: { customerId } })).data });
  const [policyId, setPolicyId] = useState("");
  const [needsOpen, setNeedsOpen] = useState(false);
  const [intermediaryOpen, setIntermediaryOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [previewing, setPreviewing] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const create = useMutation({ mutationFn: async () => (await api.post<CustomerFormSigningRow>(`/customers/${customerId}/form-signings`, { formCode: "gdpr-consent", policyId: policyId || null })).data, onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-form-signings", customerId] }) });
  const sendAdditional = useMutation({ mutationFn: async (input: { formCode: string; fields: Record<string, string> }) => (await api.post<CustomerFormSigningRow>(`/customers/${customerId}/form-signings`, { formCode: input.formCode, policyId: policyId || null, fields: input.fields })).data, onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-form-signings", customerId] }) });
  const resend = useMutation({ mutationFn: async (id: string) => api.post(`/customer-form-signings/${id}/resend`), onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-form-signings", customerId] }) });
  const download = async (id: string) => { const res = await api.get(`/customer-form-signings/${id}/document`, { responseType: "blob" }); const url = URL.createObjectURL(res.data); const a = document.createElement("a"); a.href = url; a.download = "signed-customer-form.pdf"; a.click(); URL.revokeObjectURL(url); };
  const preview = async (formCode: "gdpr-consent" | "customer-needs" | "intermediary-information" | "document-receipt", fields?: Record<string, string>, policyOverride?: string) => {
    setPreviewError(null); setPreviewing(formCode);
    try {
      const res = await api.post(`/customers/${customerId}/form-preview`, { formCode, policyId: (policyOverride ?? policyId) || null, fields: fields ?? {} }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setPreviewError(await extractFormPreviewError(e)); }
    finally { setPreviewing(""); }
  };
  const exportData = async (format: "xlsx" | "csv") => { const res = await api.get(`/customer-form-signings/export`, { params: { format, status: exportStatus || undefined, from: exportFrom || undefined, to: exportTo || undefined }, responseType: "blob" }); const url = URL.createObjectURL(res.data); const a = document.createElement("a"); a.href = url; a.download = `gdpr-forms.${format}`; a.click(); URL.revokeObjectURL(url); };
  return <><Card variant="outlined" sx={{ p: 3, mb: 2, borderColor: "primary.light" }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} mb={1}><Box><Typography variant="h6" fontWeight={800}>Έντυπο GDPR και ηλεκτρονικές υπογραφές</Typography><Typography variant="body2" color="text.secondary">Τα πεδία συμπληρώνονται από την καρτέλα. Η λειτουργία ενεργοποιείται από τις ρυθμίσεις γραφείου.</Typography></Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField select size="small" label="Κατάσταση εξαγωγής" value={exportStatus} onChange={e => setExportStatus(e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Όλες</MenuItem><MenuItem value="PendingCustomer">Αναμονή πελάτη</MenuItem><MenuItem value="PendingOffice">Αναμονή γραφείου</MenuItem><MenuItem value="PendingInsurer">Αναμονή ασφαλιστικής</MenuItem><MenuItem value="Completed">Ολοκληρωμένα</MenuItem><MenuItem value="Declined">Δεν συναινούν</MenuItem></TextField><TextField size="small" type="date" label="Από" value={exportFrom} onChange={e => setExportFrom(e.target.value)} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="Έως" value={exportTo} onChange={e => setExportTo(e.target.value)} InputLabelProps={{ shrink: true }} /><Button size="small" variant="outlined" onClick={() => exportData("xlsx")}>XLSX</Button><Button size="small" variant="outlined" onClick={() => exportData("csv")}>CSV</Button></Stack></Stack>
     <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
       <Button size="small" variant="outlined" onClick={() => void preview("gdpr-consent")} disabled={previewing === "gdpr-consent"}>{previewing === "gdpr-consent" ? <CircularProgress size={16} /> : "Προεπισκόπηση GDPR"}</Button>
       <Button size="small" variant="contained" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <CircularProgress size={16} color="inherit" /> : "Αποστολή GDPR για υπογραφή"}</Button>
       <Button size="small" variant="outlined" onClick={() => setNeedsOpen(true)}>Έντυπο Αναγκών Πελάτη</Button>
     </Stack>
     <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
       <Button size="small" variant="outlined" onClick={() => { create.reset(); sendAdditional.reset(); setPreviewError(null); setIntermediaryOpen(true); }}>Πληροφορίες διαμεσολαβητή</Button>
       <Button size="small" variant="outlined" onClick={() => { create.reset(); sendAdditional.reset(); setPreviewError(null); setReceiptOpen(true); }}>Απόδειξη παραλαβής εντύπων</Button>
     </Stack>
     {previewError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setPreviewError(null)}>{previewError}</Alert>}
    {create.isError && <Alert severity="error" sx={{ mb: 1 }}>{extractErrorMessage(create.error)}</Alert>}
    {sendAdditional.isError && <Alert severity="error" sx={{ mb: 1 }}>{extractErrorMessage(sendAdditional.error)}</Alert>}
    {resend.isError && <Alert severity="error" sx={{ mb: 1 }}>{extractErrorMessage(resend.error)}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}><TextField select size="small" label="Συμβόλαιο (προαιρετικό, για ασφαλιστική)" value={policyId} onChange={e => setPolicyId(e.target.value)} sx={{ minWidth: { sm: 340 } }}><MenuItem value="">Χωρίς συγκεκριμένο συμβόλαιο</MenuItem>{(policiesQ.data ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber || "—"} · {p.insuranceCompanyName}</MenuItem>)}</TextField></Stack>
    {q.isLoading ? <CircularProgress size={20} /> : q.isError ? <Alert severity="error">{extractErrorMessage(q.error)}</Alert> : q.data?.length === 0 ? <Typography variant="body2" color="text.secondary">Δεν έχει δημιουργηθεί έντυπο για αυτόν τον πελάτη.</Typography> : <Stack spacing={1}>{q.data?.map(row => <Box key={row.id} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}><Box><Typography fontWeight={700}>{row.status === "Completed" ? "Ολοκληρωμένο" : row.status === "Declined" ? "Δεν συναινεί" : row.status === "PendingCustomer" ? "Αναμονή πελάτη" : row.status === "PendingOffice" ? "Αναμονή γραφείου" : row.status === "PendingInsurer" ? "Αναμονή ασφαλιστικής" : row.status}</Typography><Typography variant="caption" color="text.secondary">Δημιουργήθηκε {formatDate(row.createdAt)} · Λήξη {formatDate(row.expiresAt)}</Typography></Box><Stack direction="row" spacing={1}>{row.status === "PendingCustomer" && <Button size="small" onClick={() => resend.mutate(row.id)}>Επανάληψη email</Button>}{row.hasFinalDocument && <Button size="small" startIcon={<DownloadIcon />} onClick={() => void download(row.id)}>PDF</Button>}</Stack></Stack></Box>)}</Stack>}
    </Card><CustomerNeedsFormDialog open={needsOpen} customerId={customerId} policies={policiesQ.data ?? []} onClose={() => setNeedsOpen(false)} onPreview={(fields, selectedPolicyId) => preview("customer-needs", fields, selectedPolicyId)} onSaved={() => { setNeedsOpen(false); void qc.invalidateQueries({ queryKey: ["customer-form-signings", customerId] }); }} /><IntermediaryInformationDialog open={intermediaryOpen} onClose={() => setIntermediaryOpen(false)} onPreview={fields => preview("intermediary-information", fields)} onSend={fields => sendAdditional.mutate({ formCode: "intermediary-information", fields }, { onSuccess: () => setIntermediaryOpen(false) })} sending={sendAdditional.isPending} /><DocumentReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} onPreview={fields => preview("document-receipt", fields, policyId)} onSend={fields => sendAdditional.mutate({ formCode: "document-receipt", fields }, { onSuccess: () => setReceiptOpen(false) })} sending={sendAdditional.isPending} /></>;
}

const CUSTOMER_NEEDS_FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: "coverageVehicle", label: "Ασφάλιση οχήματος (Ναι/Όχι)" },
  { key: "coverageVessel", label: "Ασφάλιση σκάφους (Ναι/Όχι)" },
  { key: "coverageHome", label: "Ασφάλιση κατοικίας / εξοχικού (Ναι/Όχι)" },
  { key: "coverageBusiness", label: "Ασφάλιση επιχείρησης (Ναι/Όχι)" },
  { key: "coverageProfessional", label: "Επαγγελματική αστική ευθύνη (Ναι/Όχι)" },
  { key: "coverageOtherText", label: "Άλλο ενδιαφέρον" },
  { key: "vesselName", label: "Όνομα σκάφους / Name" },
  { key: "registrationNumber", label: "Νηολόγιο / Reg. No" },
  { key: "flag", label: "Σημαία / Flag" },
  { key: "hullNumber", label: "Hull No" },
  { key: "vesselType", label: "Τύπος / Type" },
  { key: "maker", label: "Κατασκευαστής / Maker" },
  { key: "hullMaterial", label: "Υλικό κατασκευής / Hull material" },
  { key: "yearBuilt", label: "Έτος κατασκευής" },
  { key: "maxSpeed", label: "Μέγιστη ταχύτητα" },
  { key: "purchaseDate", label: "Ημερομηνία αγοράς" },
  { key: "purchasePrice", label: "Τιμή αγοράς" },
  { key: "length", label: "Μήκος" },
  { key: "beam", label: "Πλάτος / Beam" },
  { key: "draft", label: "Βύθισμα / Draft" },
  { key: "use", label: "Χρήση / Use" },
  { key: "crewDetails", label: "Πλήρωμα / Crew details", multiline: true },
  { key: "engine_inboard_maker", label: "Εσωλέμβια: κατασκευαστής" },
  { key: "engine_inboard_serial", label: "Εσωλέμβια: serial no" },
  { key: "engine_inboard_hp", label: "Εσωλέμβια: ίπποι / HP" },
  { key: "engine_inboard_year", label: "Εσωλέμβια: έτος" },
  { key: "engine_inboard_fuel", label: "Εσωλέμβια: καύσιμα" },
  { key: "engine_outboard_maker", label: "Εξωλέμβια: κατασκευαστής" },
  { key: "engine_outboard_serial", label: "Εξωλέμβια: serial no" },
  { key: "engine_outboard_hp", label: "Εξωλέμβια: ίπποι / HP" },
  { key: "engine_outboard_year", label: "Εξωλέμβια: έτος" },
  { key: "engine_outboard_fuel", label: "Εξωλέμβια: καύσιμα" },
  { key: "engine_inoutboard_maker", label: "Εσω-εξωλέμβια: κατασκευαστής" },
  { key: "engine_inoutboard_serial", label: "Εσω-εξωλέμβια: serial no" },
  { key: "engine_inoutboard_hp", label: "Εσω-εξωλέμβια: ίπποι / HP" },
  { key: "engine_inoutboard_year", label: "Εσω-εξωλέμβια: έτος" },
  { key: "engine_inoutboard_fuel", label: "Εσω-εξωλέμβια: καύσιμα" },
  { key: "largerLiabilityLimit", label: "Μεγαλύτερο όριο αστικής ευθύνης" },
  { key: "laidUpPeriod", label: "Περίοδος εκτός νερού" },
  { key: "laidUpLocation", label: "Πού θα είναι το σκάφος" },
  { key: "marina", label: "Σε μαρίνα (Ναι/Όχι)" },
  { key: "moorings", label: "Προσδέσεις" },
  { key: "cruisingLimits", label: "Περιορισμοί πλεύσης", multiline: true },
  { key: "automaticFireExtinguishing", label: "Αυτόματο σύστημα πυρόσβεσης (Ναι/Όχι)" },
  { key: "waterSkiers", label: "Water skiers / liability (Ναι/Όχι)" },
  { key: "racingRisks", label: "Racing risks (Ναι/Όχι)" },
  { key: "replacementValues", label: "Αξίες αντικατάστασης" },
  { key: "roadTransit", label: "Οδική μεταφορά (Ναι/Όχι)" },
  { key: "claimsLastFiveYears", label: "Ζημιές τελευταίας 5ετίας", multiline: true },
  { key: "loan", label: "Υπάρχει δάνειο (Ναι/Όχι)" },
  { key: "loanAmount", label: "Ποσό δανείου" },
  { key: "insuredFrom", label: "Ασφαλιστική περίοδος από" },
  { key: "insuredTo", label: "Ασφαλιστική περίοδος έως" },
  { key: "premiumPayment", label: "Πληρωμή ασφαλίστρων (Ετήσια / Εξαμηνιαία)" },
  { key: "additionalInformation", label: "Παρατηρήσεις / πρόσθετες πληροφορίες", multiline: true }
];

function CustomerNeedsFormDialog({ open, customerId, policies, onClose, onPreview, onSaved }: { open: boolean; customerId: string; policies: CustomerFormPolicyOption[]; onClose: () => void; onPreview: (fields: Record<string, string>, policyId: string) => void; onSaved: () => void }) {
  const [policyId, setPolicyId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: async () => (await api.post<CustomerFormSigningRow>(`/customers/${customerId}/form-signings`, { formCode: "customer-needs", policyId: policyId || null, fields })).data,
    onSuccess: onSaved
  });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Έντυπο Αναγκών Πελάτη</DialogTitle>
    <DialogContent dividers>
      <Alert severity="info" sx={{ mb: 2 }}>Τα στοιχεία πελάτη, επικοινωνίας, γραφείου, λογοτύπου και τυχόν συμβολαίου συμπληρώνονται αυτόματα από την καρτέλα. Συμπληρώστε μόνο τα πρόσθετα στοιχεία του ερωτηματολογίου.</Alert>
      <TextField select fullWidth label="Σύνδεση με συμβόλαιο (προαιρετικό)" value={policyId} onChange={e => setPolicyId(e.target.value)} sx={{ mb: 2 }}>
        <MenuItem value="">Χωρίς συγκεκριμένο συμβόλαιο</MenuItem>
        {policies.map(p => <MenuItem key={p.id} value={p.id}>{p.policyNumber || "Χωρίς αριθμό"} · {p.insuranceCompanyName}</MenuItem>)}
      </TextField>
      <Stack spacing={1.25}>
       {CUSTOMER_NEEDS_FIELDS.map(field => <TextField key={field.key} label={field.label} value={fields[field.key] ?? ""} onChange={e => setFields(prev => ({ ...prev, [field.key]: e.target.value }))} multiline={field.multiline} minRows={field.multiline ? 2 : undefined} fullWidth />)}
       </Stack>
       <Button sx={{ mt: 2 }} variant="outlined" onClick={() => onPreview(fields, policyId)}>Προεπισκόπηση PDF με τα συμπληρωμένα στοιχεία</Button>
       {create.isError && <Alert severity="error" sx={{ mt: 2 }}>{extractErrorMessage(create.error)}</Alert>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Άκυρο</Button><Button variant="contained" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <CircularProgress size={18} color="inherit" /> : "Δημιουργία και αποστολή για υπογραφή"}</Button></DialogActions>
  </Dialog>;
}

interface MailMergedFormField {
  key: string;
  label: string;
  value?: string;
  multiline?: boolean;
  type?: "text" | "date";
}

function MailMergedFormDialog({ open, title, description, fields: fieldDefinitions, onClose, onPreview, onSend, sending }: {
  open: boolean;
  title: string;
  description: string;
  fields: MailMergedFormField[];
  onClose: () => void;
  onPreview: (fields: Record<string, string>) => void;
  onSend: (fields: Record<string, string>) => void;
  sending: boolean;
}) {
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(fieldDefinitions.map(field => [field.key, field.value ?? ""])));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>{title}</DialogTitle>
    <DialogContent dividers>
      <Alert severity="info" sx={{ mb: 2 }}>{description} Τα στοιχεία πελάτη, γραφείου, λογότυπου και συμβολαίου συμπληρώνονται αυτόματα από την καρτέλα.</Alert>
      <Stack spacing={1.25}>
        {fieldDefinitions.map(field => <TextField key={field.key} type={field.type ?? "text"} label={field.label} value={fields[field.key] ?? ""} onChange={e => setFields(previous => ({ ...previous, [field.key]: e.target.value }))} multiline={field.multiline} minRows={field.multiline ? 2 : undefined} fullWidth InputLabelProps={field.type === "date" ? { shrink: true } : undefined} />)}
      </Stack>
      <Button sx={{ mt: 2 }} variant="outlined" onClick={() => onPreview(fields)}>Προεπισκόπηση PDF</Button>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Άκυρο</Button>
      <Button variant="contained" onClick={() => onSend(fields)} disabled={sending}>{sending ? <CircularProgress size={18} color="inherit" /> : "Δημιουργία και αποστολή για υπογραφή"}</Button>
    </DialogActions>
  </Dialog>;
}

const INTERMEDIARY_INFORMATION_FIELDS: MailMergedFormField[] = [
  { key: "intermediaryCategory", label: "Επαγγελματική ιδιότητα / κατηγορία", value: "Ασφαλιστικός πράκτορας" },
  { key: "legalActivity", label: "Νομικός τρόπος δραστηριότητας", value: "Συμπληρώνεται από το γραφείο" },
  { key: "represents", label: "Ενεργεί για λογαριασμό", value: "Για λογαριασμό των ασφαλιστικών επιχειρήσεων με τις οποίες συνεργάζεται" },
  { key: "providesAdvice", label: "Παρέχει συμβουλή", value: "Ναι — σύμφωνα με τις απαιτήσεις και τις ανάγκες του πελάτη" },
  { key: "singleInformationPointUrl", label: "Σύνδεσμος Ενιαίου Σημείου Πληροφόρησης", value: "https://insuranceregistry.uhc.gr/" },
  { key: "collaboratingInsurers", label: "Ασφαλιστικές εταιρείες που συνεργάζεται", value: "", multiline: true },
  { key: "remunerationNature", label: "Φύση αμοιβής", value: "Προμήθεια ή άλλη αμοιβή που περιλαμβάνεται στο ασφάλιστρο, όπου εφαρμόζεται" },
  { key: "remunerationMethod", label: "Τρόπος αμοιβής", value: "Συμπληρώνεται από το γραφείο" },
  { key: "ownershipDisclosure", label: "Συμμετοχές άνω του 10%", value: "Δεν υπάρχει συμμετοχή άνω του 10%, εκτός αν αναφέρεται διαφορετικά" },
  { key: "investmentBasedInsurance", label: "Επενδυτικά προϊόντα βασιζόμενα σε ασφάλιση", value: "Δεν προωθούνται, εκτός αν αναφέρεται διαφορετικά" },
  { key: "premiumCollectionMandate", label: "Εντολή είσπραξης ασφαλίστρων", value: "Συμπληρώνεται από το γραφείο" },
  { key: "complaintsProcedure", label: "Διαδικασία αιτιάσεων / καταγγελιών", value: "Έγγραφη υποβολή στο γραφείο και στις αρμόδιες αρχές" },
  { key: "outOfCourtDisputes", label: "Εξωδικαστική επίλυση διαφορών", value: "Συμπληρώνεται από το γραφείο", multiline: true }
];

function IntermediaryInformationDialog({ open, onClose, onPreview, onSend, sending }: { open: boolean; onClose: () => void; onPreview: (fields: Record<string, string>) => void; onSend: (fields: Record<string, string>) => void; sending: boolean }) {
  return <MailMergedFormDialog open={open} title="Πληροφορίες ασφαλιστικού διαμεσολαβητή" description="Το πρότυπο περιλαμβάνει τα στοιχεία ενημέρωσης των άρθρων 28, 29 και 33 του ν. 4583/2018." fields={INTERMEDIARY_INFORMATION_FIELDS} onClose={onClose} onPreview={onPreview} onSend={onSend} sending={sending} />;
}

const DOCUMENT_RECEIPT_FIELDS: MailMergedFormField[] = [
  { key: "contactDate", label: "Ημερομηνία επικοινωνίας", type: "date", value: new Date().toISOString().slice(0, 10) },
  { key: "deliveryDate", label: "Ημερομηνία παράδοσης / παραλαβής", type: "date", value: new Date().toISOString().slice(0, 10) },
  { key: "deliveryMethod", label: "Τρόπος παράδοσης", value: "Ηλεκτρονικά μέσω ασφαλούς συνδέσμου" },
  { key: "documentsReceived", label: "Έγγραφα που παρέλαβε ο πελάτης", value: "Έντυπο GDPR; Έντυπο Αναγκών Πελάτη; Πληροφορίες Ασφαλιστικού Διαμεσολαβητή", multiline: true },
  { key: "receiptNotes", label: "Παρατηρήσεις", multiline: true }
];

function DocumentReceiptDialog({ open, onClose, onPreview, onSend, sending }: { open: boolean; onClose: () => void; onPreview: (fields: Record<string, string>) => void; onSend: (fields: Record<string, string>) => void; sending: boolean }) {
  return <MailMergedFormDialog open={open} title="Απόδειξη παραλαβής εντύπων από τον πελάτη" description="Καταγράψτε τις ημερομηνίες, τον τρόπο παράδοσης και ακριβώς ποια έγγραφα παρέλαβε ο πελάτης." fields={DOCUMENT_RECEIPT_FIELDS} onClose={onClose} onPreview={onPreview} onSend={onSend} sending={sending} />;
}

async function extractFormPreviewError(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    const raw = await data.text();
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as { message?: unknown; detail?: unknown; title?: unknown; errors?: Record<string, unknown> };
        const trace = typeof (parsed as { traceId?: unknown }).traceId === "string" ? ` (κωδικός: ${(parsed as { traceId: string }).traceId})` : "";
        if (typeof parsed.message === "string" && parsed.message !== "One or more validation errors occurred") return parsed.message + trace;
        if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail + trace;
        if (typeof parsed.title === "string" && parsed.title !== "One or more validation errors occurred") return parsed.title + trace;
        if (parsed.errors && typeof parsed.errors === "object") {
          const messages = Object.values(parsed.errors).flatMap(value => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
          if (messages.length) return messages.join(" · ");
        }
      } catch { /* fall through to the raw server message */ }
      return raw.trim();
    }
  }
  return extractErrorMessage(error);
}

function GdprActionsTab({ customerId }: { customerId: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const exportNow = useMutation({
    mutationFn: async () => (await api.get(`/customers/${customerId}/export`)).data,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-${customerId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOk("Η εξαγωγή ολοκληρώθηκε.");
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const anonymize = useMutation({
    mutationFn: async () => api.post(`/customers/${customerId}/anonymize`),
    onSuccess: () => setOk("Ο πελάτης ανωνυμοποιήθηκε."),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>GDPR ενέργειες</Typography>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" onClose={() => setOk(null)} sx={{ mb: 2 }}>{ok}</Alert>}

      <CustomerGdprFormSigningPanel customerId={customerId} />

      <Card variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography fontWeight={700}>Δικαίωμα πρόσβασης / φορητότητας</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Κατεβάστε όλα τα δεδομένα του πελάτη σε JSON.
        </Typography>
        <Button variant="contained" startIcon={<DownloadIcon />}
          onClick={() => exportNow.mutate()} disabled={exportNow.isPending}>
          Εξαγωγή σε JSON
        </Button>
      </Card>

      <Card variant="outlined" sx={{ p: 3, borderColor: "warning.light" }}>
        <Typography fontWeight={700} color="error">Δικαίωμα διαγραφής (anonymization)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Τα προσωπικά πεδία αντικαθίστανται με placeholders και ο πελάτης σημαίνεται ως «Blocked».
          Δεν επιτρέπεται αν υπάρχουν ενεργά συμβόλαια.
        </Typography>
        <Button variant="outlined" color="error"
          onClick={() => { if (confirm("Είστε σίγουροι;")) anonymize.mutate(); }}
          disabled={anonymize.isPending}>
          Ανωνυμοποίηση
        </Button>
      </Card>
    </Box>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" });
}

/* ============================================================================
   Ζημιάδες Εμπλεκόμενοι — ALIS parity item #29. One row per person / entity
   involved in a claim beyond the policyholder. Aggregated across every claim
   tied to this customer's policies, grouped by claim, edit + delete inline,
   add via a claim picker.
   ============================================================================ */
interface ClaimInvolvedParty {
  id: string;
  claimId: string;
  claimNumber: string;
  claimIncidentDate: string | null;
  policyId: string;
  policyNumber: string;
  role: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  vehiclePlate: string | null;
  insuranceCompany: string | null;
  policyNumberOther: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClaimLite {
  id: string;
  claimNumber: string;
  incidentDate: string;
  policyNumber: string;
}

const INVOLVED_ROLES = [
  "Driver", "Passenger", "Pedestrian", "Cyclist", "Witness",
  "OwnerOfOther", "Garage", "Attorney", "Expert", "Other"
];
const INVOLVED_ROLE_LABEL: Record<string, string> = {
  Driver: "Οδηγός", Passenger: "Επιβάτης", Pedestrian: "Πεζός",
  Cyclist: "Ποδηλάτης", Witness: "Μάρτυρας",
  OwnerOfOther: "Ιδιοκτήτης άλλου οχήματος",
  Garage: "Συνεργείο", Attorney: "Δικηγόρος",
  Expert: "Πραγματογνώμονας", Other: "Άλλο"
};

void ClaimInvolvedPartiesTab;
function ClaimInvolvedPartiesTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClaimInvolvedParty | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["customer-involved-parties", customerId],
    queryFn: async () =>
      (await api.get<ClaimInvolvedParty[]>(`/customers/${customerId}/claim-involved-parties`)).data
  });

  // Customer's claims — needed for the "which claim?" picker in the add dialog.
  const claimsQ = useQuery({
    queryKey: ["customer-claims-lite", customerId],
    enabled: creating,
    queryFn: async () => {
      const rows = (await api.get<any[]>("/claims")).data;
      // Filter to this customer's claims via their policies.
      const policies = (await api.get<any[]>("/policies", { params: { customerId } })).data;
      const policyIds = new Set(policies.map((p: any) => p.id));
      return rows
        .filter((c: any) => policyIds.has(c.policyId))
        .map((c: any): ClaimLite => ({
          id: c.id, claimNumber: c.claimNumber,
          incidentDate: c.incidentDate,
          policyNumber: c.policyNumber ?? ""
        }));
    }
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/claim-involved-parties/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customer-involved-parties", customerId] }),
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const grouped = useMemo(() => {
    const rows = q.data ?? [];
    const byClaim = new Map<string, { claimNumber: string; incidentDate: string | null; policyNumber: string; rows: ClaimInvolvedParty[] }>();
    for (const r of rows) {
      let bucket = byClaim.get(r.claimId);
      if (!bucket) {
        bucket = { claimNumber: r.claimNumber, incidentDate: r.claimIncidentDate, policyNumber: r.policyNumber, rows: [] };
        byClaim.set(r.claimId, bucket);
      }
      bucket.rows.push(r);
    }
    return Array.from(byClaim.entries());
  }, [q.data]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">Ζημιάδες Εμπλεκόμενοι</Typography>
          <Typography variant="body2" color="text.secondary">
            Άλλοι οδηγοί, επιβάτες, μάρτυρες, συνεργεία και όσοι εμπλέκονται σε ζημιές του πελάτη.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
          Νέος εμπλεκόμενος
        </Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : grouped.length === 0 ? (
        <Card variant="outlined">
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <Typography>Δεν έχουν καταχωρηθεί εμπλεκόμενοι σε καμία ζημιά του πελάτη.</Typography>
          </Box>
        </Card>
      ) : (
        <Stack spacing={2}>
          {grouped.map(([claimId, group]) => (
            <Card key={claimId} variant="outlined">
              <Box sx={{ p: 2, bgcolor: "rgba(11,37,69,0.03)", borderBottom: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                  <Chip size="small" label={group.claimNumber} sx={{ fontFamily: "monospace", fontWeight: 700 }} />
                  <Typography variant="body2" color="text.secondary">
                    Ημ. συμβάντος: {group.incidentDate ?? "—"} · Συμβόλαιο: <b>{group.policyNumber || "—"}</b>
                  </Typography>
                </Stack>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ρόλος</TableCell>
                    <TableCell>Ονοματεπώνυμο</TableCell>
                    <TableCell>Στοιχεία επικοινωνίας</TableCell>
                    <TableCell>Ασφαλιστική / Συμβόλαιο</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.rows.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell><Chip size="small" label={INVOLVED_ROLE_LABEL[r.role] ?? r.role} /></TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>{r.fullName}</Typography>
                        {(r.vatNumber || r.vehiclePlate) && (
                          <Typography variant="caption" color="text.secondary">
                            {r.vatNumber && <>ΑΦΜ: {r.vatNumber}</>}
                            {r.vatNumber && r.vehiclePlate && " · "}
                            {r.vehiclePlate && <>Πινακίδα: {r.vehiclePlate}</>}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.phone && <div>{r.phone}</div>}
                        {r.email && <div><a href={`mailto:${r.email}`}>{r.email}</a></div>}
                        {!r.phone && !r.email && "—"}
                      </TableCell>
                      <TableCell>
                        {r.insuranceCompany || r.policyNumberOther
                          ? <>
                              {r.insuranceCompany}
                              {r.policyNumberOther && <Typography variant="caption" color="text.secondary" display="block">
                                Αρ. συμβολαίου: {r.policyNumberOther}
                              </Typography>}
                            </>
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setEditing(r)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => {
                          if (confirm("Διαγραφή εμπλεκόμενου;")) del.mutate(r.id);
                        }}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}

      <InvolvedPartyDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        editing={editing}
        claims={claimsQ.data ?? []}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["customer-involved-parties", customerId] });
        }}
      />
    </Box>
  );
}

function InvolvedPartyDialog({ open, onClose, editing, claims, onSaved }: {
  open: boolean;
  onClose: () => void;
  editing: ClaimInvolvedParty | null;
  claims: ClaimLite[];
  onSaved: () => void;
}) {
  const [claimId, setClaimId] = useState("");
  const [form, setForm] = useState({
    role: "Driver",
    fullName: "",
    phone: "",
    email: "",
    vatNumber: "",
    vehiclePlate: "",
    insuranceCompany: "",
    policyNumberOther: "",
    notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setClaimId(editing.claimId);
      setForm({
        role: editing.role,
        fullName: editing.fullName,
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        vatNumber: editing.vatNumber ?? "",
        vehiclePlate: editing.vehiclePlate ?? "",
        insuranceCompany: editing.insuranceCompany ?? "",
        policyNumberOther: editing.policyNumberOther ?? "",
        notes: editing.notes ?? ""
      });
    } else if (open) {
      setClaimId("");
      setForm({
        role: "Driver", fullName: "", phone: "", email: "",
        vatNumber: "", vehiclePlate: "", insuranceCompany: "",
        policyNumberOther: "", notes: ""
      });
    }
    setErr(null);
  }, [editing, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        role: form.role,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        vehiclePlate: form.vehiclePlate.trim() || null,
        insuranceCompany: form.insuranceCompany.trim() || null,
        policyNumberOther: form.policyNumberOther.trim() || null,
        notes: form.notes.trim() || null
      };
      if (editing) return (await api.put(`/claim-involved-parties/${editing.id}`, body)).data;
      return (await api.post(`/claims/${claimId}/involved-parties`, body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Επεξεργασία εμπλεκόμενου" : "Νέος εμπλεκόμενος σε ζημιά"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          {!editing && (
            <SearchableTextField label="Ζημιά" value={claimId} onChange={e => setClaimId(e.target.value)} fullWidth required
              helperText="Επιλέξτε τη ζημιά στην οποία εμπλέκεται.">
              <MenuItem value="">— Επιλέξτε ζημιά —</MenuItem>
              {claims.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.claimNumber} · {c.incidentDate} · Συμβόλαιο {c.policyNumber}
                </MenuItem>
              ))}
            </SearchableTextField>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Ρόλος" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} fullWidth>
              {INVOLVED_ROLES.map(r => <MenuItem key={r} value={r}>{INVOLVED_ROLE_LABEL[r] ?? r}</MenuItem>)}
            </SearchableTextField>
            <TextField required label="Ονοματεπώνυμο" value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Τηλέφωνο" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="ΑΦΜ" value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value })} fullWidth />
            <TextField label="Πινακίδα οχήματος" value={form.vehiclePlate}
              onChange={e => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Ασφαλιστική εταιρεία" value={form.insuranceCompany}
              onChange={e => setForm({ ...form, insuranceCompany: e.target.value })} fullWidth />
            <TextField label="Αρ. συμβολαίου (τρίτου)" value={form.policyNumberOther}
              onChange={e => setForm({ ...form, policyNumberOther: e.target.value })} fullWidth />
          </Stack>
          <TextField label="Σημειώσεις" multiline rows={3} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} fullWidth
            placeholder="π.χ. σοβαρότητα τραυματισμού, μαρτυρίες, εκκρεμότητες…" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained">Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !form.fullName.trim() || (!editing && !claimId)}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
