import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import HistoryIcon from "@mui/icons-material/History";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import FolderIcon from "@mui/icons-material/Folder";
import BarChartIcon from "@mui/icons-material/BarChart";
import { CustomerCommunicationManager, CustomerHistory, CustomerObligations, CustomerPopup } from "../components/customer/CustomerWorkspace";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { VehicleDetailDialog, vehicleStatusLabel } from "./CustomerVehiclesPage";
import { InlineValueField, type InlineValueOption } from "../components/InlineValueField";
import { drivingFields, persistCustomerEdits, type CustomerDrafts } from "../components/customer/customerEditSession";
import { customerDraftErrors, customerFieldError, fieldMaxLength } from "../components/customer/customerValidation";
import { customerAge } from "../components/customer/customerAge";
import { DetailProfileTabs } from "../components/profile/DetailProfileTabs";

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
  notes?: string | null;
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
  thirdPhone?: string | null;
  secondaryMobilePhone?: string | null;
  secondaryEmail?: string | null;
  assignedAdvisorId?: string | null;
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
  hasDrivingLicense?: boolean | null;
  isDriver?: boolean | null;
  isNewDriver?: boolean | null;
}

/** The PUT endpoint intentionally accepts the complete customer projection.
 * Inline editing therefore merges the changed value into the same payload used
 * by the full editor, keeping all existing fields intact. */
function customerInlinePayload(customer: CustomerDto, key: keyof CustomerDto, value: string) {
  const optional = (field: keyof CustomerDto) => customer[field] ?? undefined;
  return {
    type: customer.type,
    status: customer.status,
    firstName: optional("firstName"), lastName: optional("lastName"), companyName: optional("companyName"),
    vatNumber: optional("vatNumber"), email: optional("email"), phone: optional("phone"),
    address: optional("address"), city: optional("city"), postalCode: optional("postalCode"),
    occupation: optional("occupation"), notes: optional("notes"), paymentDueDate: optional("paymentDueDate"),
    birthDate: optional("birthDate"), fatherName: optional("fatherName"), motherName: optional("motherName"), spouseName: optional("spouseName"),
    nationality: optional("nationality"), zone: optional("zone"), activityCode: optional("activityCode"), taxOffice: optional("taxOffice"),
    gemiNumber: optional("gemiNumber"), legalForm: optional("legalForm"), altPhone: optional("altPhone"), mobilePhone: optional("mobilePhone"),
    amka: optional("amka"), idNumber: optional("idNumber"), passportNumber: optional("passportNumber"), region: optional("region"),
    gender: optional("gender"), maritalStatus: optional("maritalStatus"), employer: optional("employer"),
    driverLicenseNumber: optional("driverLicenseNumber"), driverLicenseClass: optional("driverLicenseClass"),
    driverLicenseIssueDate: optional("driverLicenseIssueDate"), driverLicenseExpiryDate: optional("driverLicenseExpiryDate"),
    source: optional("source"), tagsJson: optional("tagsJson"), photoUrl: optional("photoUrl"),
    createPortalAccount: false,
    assignedAdvisorId: optional("assignedAdvisorId"),
    [key]: value || undefined,
  };
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

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  notes?: string;
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

const CUSTOMER_PROFILE_TAB_LABELS = [
  { label: "Γενικά", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Επικοινωνία", icon: <ContactPhoneIcon fontSize="small" /> },
  { label: "Συμβόλαια", icon: <FolderIcon fontSize="small" /> },
  { label: "Οχήματα", icon: <DirectionsCarIcon fontSize="small" /> },
  { label: "Οικονομικά", icon: <AccountBalanceWalletOutlinedIcon fontSize="small" /> },
  { label: "Εκκρεμή", icon: <InfoOutlinedIcon fontSize="small" /> },
  { label: "Έγγραφα", icon: <FolderIcon fontSize="small" /> },
  { label: "Ιστορικό", icon: <HistoryIcon fontSize="small" /> },
];

export function CustomerProfileTabs({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <DetailProfileTabs value={value} onChange={onChange} items={CUSTOMER_PROFILE_TAB_LABELS} />;
}

/**
 * Shared compact surface for the secondary customer tabs. Keeping one grid
 * and one scroll container makes every tab behave consistently at desktop,
 * tablet and mobile widths without changing any of the tab's data logic.
 */
function CustomerTabLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      alignItems: "start",
      gap: { xs: .75, md: 1 },
      flex: 1, minHeight: 0, alignContent: "start",
      overflowY: "auto",
      overflowX: "hidden",
      pt: 1.5,
      pr: { xs: .15, md: .4 },
      pb: .25,
      "& > *": { minWidth: 0, minHeight: 0, m: "0 !important" },
      "& .MuiCard-root": { borderRadius: 1.15 },
      "& .MuiTableCell-root": { py: .55, px: .75, whiteSpace: "normal", overflowWrap: "anywhere" },
      "& .MuiTypography-h6": { fontSize: { xs: "1rem", md: "1.08rem" } },
    }}>
      {children}
    </Box>
  );
}

export function CustomerDetailPage({ customerId, initialCustomer, onClose }: {
  customerId?: string;
  initialCustomer?: CustomerDto;
  onClose?: () => void;
} = {}) {
  const { id: routeId = "" } = useParams<{ id: string }>();
  const id = customerId ?? routeId;
  const navigate = useNavigate();
  const closeCard = onClose ?? (() => navigate("/app/customers"));
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [popup, setPopup] = useState<"communications" | "producers" | "statistics" | "family" | null>(null);
  const [editAll, setEditAll] = useState(false);
  const [drafts, setDrafts] = useState<CustomerDrafts>({});
  const [discardAction, setDiscardAction] = useState<"close" | "cancel" | null>(null);
  const [toast, setToast] = useState("");

  const customerQ = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await api.get<CustomerDto>(`/customers/${id}`)).data,
    enabled: !!id,
    placeholderData: initialCustomer?.id === id ? initialCustomer : undefined,
  });
  const hasUnsavedChanges = Object.entries(drafts).some(([key, value]) => value !== String(customerQ.data?.[key as keyof CustomerDto] ?? ""));
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);
  useEffect(() => { setDrafts({}); setEditAll(false); setDiscardAction(null); }, [id]);

  const saveFields = useMutation({
    mutationFn: async ({ changes }: { changes: CustomerDrafts; finish?: boolean }) => {
      const current = qc.getQueryData<CustomerDto>(["customer", id]) ?? customerQ.data;
      if (!current) throw new Error("Δεν έχει φορτωθεί η καρτέλα πελάτη.");
      const errors = customerDraftErrors(changes);
      // Validate cross-field dates against persisted values too, without blocking
      // an unrelated edit because of pre-existing legacy invalid data.
      if ("driverLicenseIssueDate" in changes || "driverLicenseExpiryDate" in changes) {
        errors.push(...customerDraftErrors({ driverLicenseIssueDate: current.driverLicenseIssueDate, driverLicenseExpiryDate: current.driverLicenseExpiryDate, ...changes }));
      }
      if (errors.length) throw new Error([...new Set(errors)].join(" "));
      return persistCustomerEdits(current, changes,
        async (latest, primary) => {
          const [key, value] = Object.entries(primary)[0];
          const payload = {
            ...customerInlinePayload(latest, key as keyof CustomerDto, value),
            ...Object.fromEntries(Object.entries(primary).map(([field, next]) => [field, next || undefined])),
          };
          return (await api.put<CustomerDto>(`/customers/${id}`, payload)).data;
        },
        async (field, value) => (await api.patch<CustomerDto>(`/customers/${id}/${drivingFields.has(field) ? "driving-field" : "communication-field"}`,
          { field, value: drivingFields.has(field) ? (value === "" ? null : value === "true") : value })).data,
        (updated, savedKeys) => {
          qc.setQueryData(["customer", id], updated);
          setDrafts(previous => {
            const remaining = { ...previous };
            savedKeys.forEach(key => { if (remaining[key] === changes[key]) delete remaining[key]; });
            return remaining;
          });
        });
    },
    onSuccess: (_, { finish }) => {
      if (finish) setEditAll(false);
      setToast("Οι αλλαγές αποθηκεύτηκαν επιτυχώς.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["customer", id] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history", id] });
      void qc.invalidateQueries({ queryKey: ["customer-family", id] });
      void qc.invalidateQueries({ queryKey: ["driver-license", id] });
    },
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
      <Dialog open fullWidth maxWidth="sm" onClose={closeCard}>
        <DialogTitle>Καρτέλα πελάτη</DialogTitle>
        <DialogContent><Alert severity="error">{extractErrorMessage(customerQ.error)}</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => void customerQ.refetch()}>Δοκιμή ξανά</Button>
          <Button color="error" onClick={closeCard}>Κλείσιμο</Button>
        </DialogActions>
      </Dialog>
    );
  }
  const customer = customerQ.data!;
  // List data can paint the card immediately. Enable writes only once the
  // complete detail response is available so omitted fields cannot be lost.
  const canManageCustomer = !customerQ.isPlaceholderData && (user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser");
  const discard = () => { setDrafts({}); setEditAll(false); saveFields.reset(); };
  const requestClose = () => {
    if (saveFields.isPending) return;
    if (hasUnsavedChanges) setDiscardAction("close");
    else closeCard();
  };
  const fieldEditing: CustomerFieldEditing = {
    editAll: editAll && canManageCustomer, drafts, saving: saveFields.isPending, canEdit: canManageCustomer,
    onDraftChange: (key, value) => setDrafts(previous => {
      const next = { ...previous };
      if (value === String(customer[key] ?? "")) delete next[key];
      else next[key] = value;
      return next;
    }),
    onCommitField: async (key, value) => { await saveFields.mutateAsync({ changes: { [key]: value } }); },
  };

  const displayName = customer.type === "Company"
    ? customer.companyName ?? "—"
    : [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";

  return (
    <Dialog
      open
      fullWidth
      maxWidth="xl"
      onClose={requestClose}
      PaperProps={{ sx: {
        width: { xs: "100vw", sm: "min(1120px, calc(100vw - 20px))", lg: "min(1500px, calc(100vw - 32px))" },
        height: { xs: "100dvh", sm: "min(820px, calc(100dvh - 20px))", lg: "min(900px, calc(100dvh - 32px))" },
        maxHeight: "calc(100dvh - 12px)",
        m: { xs: 0, sm: 1, lg: 2 },
        borderRadius: { xs: 0, sm: 2 },
        overflow: "hidden",
      } }}
    >
      <DialogContent dividers sx={{ p: { xs: .65, sm: 1, md: 1.25 }, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", "& .MuiTypography-root": { lineHeight: 1.25 } }}>
      <Box sx={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        mb={.75}
        gap={.75}
        sx={{
          flexShrink: 0,
          p: { xs: .75, sm: 1, md: 1.15 },
          borderRadius: 1.75,
          color: "#fff",
          background: "linear-gradient(135deg, #092b56 0%, #0b5cad 52%, #1591c8 100%)",
          boxShadow: "0 8px 22px rgba(9,43,86,.22)",
          border: "1px solid rgba(255,255,255,.2)",
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{
            width: { xs: 38, sm: 42 }, height: { xs: 38, sm: 42 }, flex: "0 0 auto", borderRadius: "50%",
            display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900,
            bgcolor: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.42)",
          }}>
            <PersonOutlineIcon sx={{ fontSize: { xs: 25, sm: 29 } }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 850, lineHeight: 1.1, overflowWrap: "anywhere", fontSize: { xs: "1.15rem", sm: "1.35rem", md: "1.55rem" } }}>
              {displayName}
            </Typography>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.35 }}>
              <Chip
                size="small"
                label={customer.status === "Prospect" ? "Πιθανός πελάτης" : "Ενεργός πελάτης"}
                clickable={canManageCustomer}
                disabled={statusMutation.isPending || saveFields.isPending || editAll}
                onClick={() => canManageCustomer && statusMutation.mutate(customer.status === "Prospect" ? "Active" : "Prospect")}
                sx={{ color: "#fff", bgcolor: customer.status === "Prospect" ? "rgba(245,158,11,.82)" : "rgba(21,155,89,.82)", "&.Mui-disabled": { color: "#fff", opacity: .82 } }}
              />
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap" sx={{ alignItems: "stretch" }}>
          <Box sx={{ pl: .8, borderLeft: "1px solid rgba(255,255,255,.25)", minWidth: { xs: 112, sm: 126 } }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,.7)", display: "block" }}>Κωδικός πελάτη</Typography>
            <Typography fontWeight={800}>{customer.customerNumber}</Typography>
          </Box>
          <Box sx={{ pl: .8, borderLeft: "1px solid rgba(255,255,255,.25)", minWidth: { xs: 86, sm: 102 } }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,.7)", display: "block" }}>ΑΦΜ</Typography>
            <Typography fontWeight={800}>{customer.vatNumber || "—"}</Typography>
          </Box>
        </Stack>
      </Stack>

      <CustomerProfileTabs value={tab} onChange={setTab} />
      {saveFields.isError && <Alert severity="error" sx={{ mb: .75, flexShrink: 0 }}>{extractErrorMessage(saveFields.error, saveFields.error instanceof Error ? saveFields.error.message : "Η αποθήκευση απέτυχε.")} Οι μη αποθηκευμένες αλλαγές παραμένουν διαθέσιμες για διόρθωση ή νέα προσπάθεια.</Alert>}

      {tab === 0 && <DesktopCustomerFields customer={customer} editing={fieldEditing} />}
      {tab === 1 && <CustomerTabLayout>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
          <Button size="small" variant="contained" startIcon={<HistoryIcon />} onClick={() => setPopup("communications")}>Ιστορικό επικοινωνίας</Button>
          <Button size="small" variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => setPopup("family")}>Οικογένεια & πρόσθετα στοιχεία</Button>
        </Stack>
        <DesktopCustomerFields customer={customer} section="contact" editing={fieldEditing} />
        <ContactsTab customerId={id} customerType={customer.type} />
        <Box><Typography variant="subtitle2" sx={{ mb: .5 }}>Ειδοποιήσεις</Typography><CustomerNotificationsTab customerId={id} /></Box>
      </CustomerTabLayout>}
      {tab === 2 && <CustomerTabLayout>
        <CustomerPoliciesTab customerId={id} />
      </CustomerTabLayout>}
      {tab === 3 && <CustomerTabLayout>
        <CustomerVehiclesTab customerId={id} />
      </CustomerTabLayout>}
      {tab === 4 && <CustomerTabLayout>
        <Box><Button size="small" variant="outlined" startIcon={<PersonOutlineIcon />} onClick={() => setPopup("producers")}>Συνεργάτες πελάτη</Button></Box>
        <CustomerAccountTab customerId={id} />
      </CustomerTabLayout>}
      {tab === 5 && <CustomerTabLayout>
        <CustomerObligations customerId={id} />
      </CustomerTabLayout>}
      {tab === 6 && <CustomerTabLayout>
        <Box sx={{ gridColumn: { lg: "1 / -1" } }}><GdprActionsTab customerId={id} /></Box>
      </CustomerTabLayout>}
      {tab === 7 && <CustomerTabLayout>
        <CustomerHistory customerId={id} />
      </CustomerTabLayout>}
      </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: "divider", px: { xs: .75, md: 1.25 }, py: .55, gap: .65, flexWrap: "wrap", justifyContent: "space-between", "& .MuiButton-root": { minHeight: 32, px: { xs: .9, md: 1.1 }, fontSize: { xs: ".72rem", md: ".78rem" } } }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: "1 1 280px" }}>
          <InfoOutlinedIcon fontSize="small" color="info" />
          <Typography variant="caption" color="text.secondary">
            Η οικονομική εικόνα υπολογίζεται από τις κινήσεις της εφαρμογής.
          </Typography>
        </Stack>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75} sx={{ flex: "0 1 auto" }}>
          <Button startIcon={<BarChartIcon />} variant="outlined" onClick={() => setPopup("statistics")}>
            Στατιστικά
          </Button>
          {canManageCustomer && !editAll && (
            <Button startIcon={<EditIcon />} variant="contained" color="success" disabled={saveFields.isPending} onClick={() => { saveFields.reset(); setEditAll(true); }} sx={{ color: "#fff", fontWeight: 800 }}>
              Επεξεργασία πελάτη
            </Button>
          )}
          {canManageCustomer && editAll && (
            <>
              <Button startIcon={<SaveIcon />} variant="contained" color="success" disabled={saveFields.isPending} onClick={() => {
                if (hasUnsavedChanges) saveFields.mutate({ changes: { ...drafts }, finish: true });
                else { setEditAll(false); setToast("Δεν υπάρχουν μη αποθηκευμένες αλλαγές."); }
              }} sx={{ color: "#fff", fontWeight: 800 }}>
                {saveFields.isPending ? "Αποθήκευση…" : "Αποθήκευση επεξεργασίας"}
              </Button>
              <Button startIcon={<CloseIcon />} variant="contained" color="error" disabled={saveFields.isPending} onClick={() => { if (hasUnsavedChanges) setDiscardAction("cancel"); else discard(); }} sx={{ color: "#fff", fontWeight: 800 }}>
                Ακύρωση επεξεργασίας
              </Button>
            </>
          )}
          <Button onClick={requestClose} disabled={saveFields.isPending} color="error" variant="contained" startIcon={<CloseIcon />} sx={{ color: "#fff", fontWeight: 800 }}>
            Κλείσιμο
          </Button>
        </Stack>
      </DialogActions>
      <CustomerPopup open={popup !== null} onClose={() => setPopup(null)} title={({ communications: "Ιστορικό επικοινωνίας", producers: "Συνεργάτες πελάτη", statistics: "Στατιστικά πελάτη", family: "Οικογένεια & πρόσθετα στοιχεία" })[popup ?? "communications"]} wide={popup === "statistics"}>
        {popup === "communications" && <CustomerCommunicationManager customerId={id} />}
        {popup === "producers" && <CustomerProducersSummary customerId={id} />}
        {popup === "statistics" && <CustomerStatisticsTab customerId={id} />}
        {popup === "family" && <Stack spacing={1.5}>
          <FamilyNeedsTab customerId={id} />
        </Stack>}
      </CustomerPopup>
      <Dialog open={discardAction !== null} onClose={() => setDiscardAction(null)} fullWidth maxWidth="xs">
        <DialogTitle>Μη αποθηκευμένες αλλαγές</DialogTitle>
        <DialogContent>Υπάρχουν αλλαγές που δεν έχουν αποθηκευτεί. Θέλετε να τις απορρίψετε;</DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardAction(null)}>Επιστροφή στην καρτέλα</Button>
          <Button color="error" variant="contained" onClick={() => {
            const action = discardAction; setDiscardAction(null); discard();
            if (action === "close") closeCard();
          }}>Απόρριψη αλλαγών</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast("")} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="success" onClose={() => setToast("")}>{toast}</Alert>
      </Snackbar>
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
    <Stack spacing={.75}>
      <Card variant="outlined" sx={{ px: 1, pt: 2, pb: 1 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={from} onChange={e => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={to} onChange={e => setTo(e.target.value)} />
          <Typography variant="caption" color="text.secondary">Το φίλτρο επηρεάζει τις κινήσεις και τους μηνιαίους υπολογισμούς.</Typography>
        </Stack>
      </Card>
      <Card variant="outlined" sx={{ p: 1.25 }}>
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
          <Typography sx={{ p: 1, pb: 0 }} fontWeight={800}>Δόσεις και ημερομηνίες εξόφλησης</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Συμβόλαιο</TableCell><TableCell>Λήξη πληρωμής</TableCell><TableCell align="right">Ποσό</TableCell><TableCell>Κατάσταση</TableCell></TableRow></TableHead>
            <TableBody>{a.installments.map(i => <TableRow key={i.id}><TableCell sx={{ fontFamily: "monospace" }}>{i.policyNumber}</TableCell><TableCell>{i.dueDate}</TableCell><TableCell align="right">{fmt(i.amount)} €</TableCell><TableCell>{i.paidAt ? <Chip size="small" color="success" label={`Εξοφλήθηκε ${i.paidAt}`} /> : <Chip size="small" color={i.isOverdue ? "error" : "warning"} label={i.isOverdue ? `Καθυστέρηση ${i.daysLate} ημέρες` : "Εκκρεμεί"} />}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      )}
      <Card variant="outlined">
          <Typography sx={{ p: 1, pb: 0 }} fontWeight={800}>Κινήσεις καρτέλας</Typography>
        {a.entries.length === 0 ? <Typography sx={{ p: 1 }} color="text.secondary">Δεν υπάρχουν οικονομικές κινήσεις.</Typography> :
          <Table size="small"><TableHead><TableRow><TableCell>Ημερομηνία</TableCell><TableCell>Αιτιολογία</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell align="right">Ποσό</TableCell></TableRow></TableHead><TableBody>{a.entries.map(e => <TableRow key={e.id}><TableCell>{e.date}</TableCell><TableCell>{e.kind === "CustomerCharge" ? "Χρέωση" : e.kind === "CustomerCredit" ? "Είσπραξη" : e.kind}{e.description ? ` · ${e.description}` : ""}</TableCell><TableCell sx={{ fontFamily: "monospace" }}>{e.policyNumber ?? "—"}</TableCell><TableCell align="right" sx={{ color: e.kind === "CustomerCharge" ? "error.main" : "success.main", fontWeight: 700 }}>{e.kind === "CustomerCharge" ? "+" : "−"}{fmt(e.amount)} {e.currency}</TableCell></TableRow>)}</TableBody></Table>}
      </Card>
      {a.monthly.length > 0 && <Card variant="outlined"><Typography sx={{ p: 1, pb: 0 }} fontWeight={800}>Υπόλοιπο ανά μήνα</Typography><Table size="small"><TableHead><TableRow><TableCell>Μήνας</TableCell><TableCell align="right">Χρεώσεις</TableCell><TableCell align="right">Εισπράξεις</TableCell><TableCell align="right">Υπόλοιπο</TableCell></TableRow></TableHead><TableBody>{a.monthly.map(m => <TableRow key={`${m.year}-${m.month}`}><TableCell>{String(m.month).padStart(2, "0")}/{m.year}</TableCell><TableCell align="right">{fmt(m.charges)} €</TableCell><TableCell align="right">{fmt(m.credits)} €</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{fmt(m.balance)} €</TableCell></TableRow>)}</TableBody></Table></Card>}
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const q = useQuery({
    queryKey: ["customer-vehicles", customerId],
    queryFn: async () => (await api.get<CustomerVehicleRow[]>("/policies", { params: { customerId, type: "Auto" } })).data
  });
  if (q.isLoading) return <Card variant="outlined" sx={{ p: 2 }}><CircularProgress size={22} /></Card>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  const rows = q.data ?? [];
  const visibleRows = rows.filter(row => (!status || row.status === status) &&
    `${row.vehicleRegistrationPlate ?? ""} ${row.policyNumber} ${row.insuranceCompanyName}`.toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR")));
  return (
    <Card variant="outlined" sx={{ p: compact ? .75 : 1 }}>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} justifyContent="space-between" alignItems="center" sx={{ mb: compact ? 0.75 : 1.5 }}>
        <Box><Typography variant={compact ? "subtitle1" : "h6"} fontWeight={800}>Οχήματα πελάτη</Typography><Typography variant="body2" color="text.secondary">Αυτόματη προβολή από τα συμβόλαια αυτοκινήτου.</Typography></Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Νέο όχημα</Button>
          <Chip size="small" icon={<DirectionsCarIcon />} label={`${rows.length} συμβόλαια`} />
        </Stack>
      </Stack>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
        <TextField size="small" label="Πινακίδα, συμβόλαιο ή ασφαλιστική" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: "1 1 220px" }} />
        <TextField select size="small" label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="">Όλες</MenuItem>
          {[...new Set(rows.map(r => r.status))].map(s => <MenuItem key={s} value={s}>{vehicleStatusLabel(s)}</MenuItem>)}
        </TextField>
      </Stack>
      {visibleRows.length === 0 ? <Alert severity="info">{rows.length ? "Δεν βρέθηκαν οχήματα με αυτά τα φίλτρα." : "Δεν έχει καταχωρηθεί ακόμη συμβόλαιο αυτοκινήτου ή πινακίδα για τον πελάτη."}</Alert> : (
        <TableContainer tabIndex={0}><Table size="small">
          <TableHead><TableRow><TableCell>Πινακίδα</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Ισχύς</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>{visibleRows.map(row => <TableRow key={row.id} hover>
            <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.vehicleRegistrationPlate ?? "—"}</TableCell>
            <TableCell><Button size="small" component={RouterLink} to={`/app/policies?focus=${row.id}`}>{row.policyNumber}</Button></TableCell>
            <TableCell>{row.insuranceCompanyName}</TableCell>
            <TableCell>{row.startDate} → {row.endDate}</TableCell>
            <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell>
            <TableCell><Chip size="small" label={vehicleStatusLabel(row.status)} /></TableCell>
            <TableCell><Button size="small" onClick={() => setSelectedPlate(row.vehicleRegistrationPlate ?? "")}>Καρτέλα</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
      )}
      <VehicleDetailDialog open={selectedPlate !== null} plate={selectedPlate ?? ""} policyIds={rows.filter(row => (row.vehicleRegistrationPlate ?? "") === (selectedPlate ?? "")).map(row => row.id)} onClose={() => setSelectedPlate(null)} />
      <AddCustomerVehicleDialog open={addOpen} rows={rows} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); void q.refetch(); }} />
    </Card>
  );
}

type AddVehicleForm = {
  policyId: string;
  plate: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  engineCapacity: string;
  taxableHorsepower: string;
  estimatedValue: string;
  purchaseDate: string;
  condition: string;
  ownerCount: string;
  youngDriver: boolean;
  sunroof: boolean;
  use: string;
  color: string;
  seats: string;
  notes: string;
};

const blankAddVehicleForm = (policyId = ""): AddVehicleForm => ({
  policyId, plate: "", make: "", model: "", year: "", vin: "", engineCapacity: "", taxableHorsepower: "", estimatedValue: "",
  purchaseDate: "", condition: "Μεταχειρισμένο", ownerCount: "", youngDriver: false, sunroof: false, use: "", color: "", seats: "", notes: ""
});

function AddCustomerVehicleDialog({ open, rows, onClose, onSaved }: { open: boolean; rows: CustomerVehicleRow[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AddVehicleForm>(() => blankAddVehicleForm(rows[0]?.id));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setForm(blankAddVehicleForm(rows[0]?.id)); setError(null); } }, [open, rows]);
  const update = useMutation({
    mutationFn: async () => {
      const specs: Record<string, unknown> = {
        make: form.make.trim(), model: form.model.trim(), year: form.year.trim(), vin: form.vin.trim(), engineCapacity: form.engineCapacity.trim(),
        taxableHorsepower: form.taxableHorsepower.trim(), estimatedValue: form.estimatedValue.trim(), purchaseDate: form.purchaseDate,
        condition: form.condition, ownerCount: form.ownerCount.trim(), youngDriver: form.youngDriver ? "Ναι" : "Όχι", sunroof: form.sunroof ? "Ναι" : "Όχι",
        color: form.color.trim(), seats: form.seats.trim()
      };
      Object.keys(specs).forEach(key => { const value = specs[key]; if (value === "" || value === undefined) delete specs[key]; });
      return api.patch(`/policies/${form.policyId}/vehicle`, {
        vehicleRegistrationPlate: form.plate.trim(), vehicleUseCategory: form.use.trim() || null,
        specsJson: JSON.stringify(specs), notes: form.notes.trim() || null, replaceDetails: true
      });
    },
    onSuccess: onSaved,
    onError: e => setError(extractErrorMessage(e))
  });
  const set = <K extends keyof AddVehicleForm>(key: K, value: AddVehicleForm[K]) => setForm(current => ({ ...current, [key]: value }));
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Προσθήκη οχήματος στον πελάτη</DialogTitle>
    <DialogContent dividers>
      {rows.length === 0 ? <Alert severity="info">Για να συνδεθεί όχημα χρειάζεται πρώτα ένα συμβόλαιο αυτοκινήτου στην καρτέλα του πελάτη.</Alert> : <Stack spacing={1.25} sx={{ pt: 0.25 }}>
        <Alert severity="info" sx={{ py: 0.5 }}>Το όχημα συνδέεται με το επιλεγμένο συμβόλαιο και όλα τα στοιχεία του παραμένουν επεξεργάσιμα από την καρτέλα οχήματος.</Alert>
        <TextField select fullWidth label="Συμβόλαιο σύνδεσης" value={form.policyId} onChange={e => set("policyId", e.target.value)}>
          {rows.map(row => <MenuItem key={row.id} value={row.id}>{row.policyNumber} · {row.insuranceCompanyName} · {row.startDate}</MenuItem>)}
        </TextField>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
          <TextField required label="Πινακίδα" value={form.plate} onChange={e => set("plate", e.target.value)} />
          <TextField label="Μάρκα" value={form.make} onChange={e => set("make", e.target.value)} />
          <TextField label="Μοντέλο" value={form.model} onChange={e => set("model", e.target.value)} />
          <TextField label="Έτος κατασκευής" value={form.year} onChange={e => set("year", e.target.value)} />
          <TextField label="VIN / αριθμός πλαισίου" value={form.vin} onChange={e => set("vin", e.target.value)} />
          <TextField label="Κυβισμός (cc)" value={form.engineCapacity} onChange={e => set("engineCapacity", e.target.value)} />
          <TextField label="Φορολογήσιμοι ίπποι" value={form.taxableHorsepower} onChange={e => set("taxableHorsepower", e.target.value)} />
          <TextField label="Εκτιμώμενη αξία" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} />
          <TextField label="Ημερομηνία αγοράς" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField select label="Κατάσταση" value={form.condition} onChange={e => set("condition", e.target.value)}><MenuItem value="Καινούργιο">Καινούργιο</MenuItem><MenuItem value="Μεταχειρισμένο">Μεταχειρισμένο</MenuItem></TextField>
          <TextField label="Αριθμός ιδιοκτητών" value={form.ownerCount} onChange={e => set("ownerCount", e.target.value)} />
          <TextField label="Χρήση" value={form.use} onChange={e => set("use", e.target.value)} />
          <TextField label="Χρώμα" value={form.color} onChange={e => set("color", e.target.value)} />
          <TextField label="Θέσεις" value={form.seats} onChange={e => set("seats", e.target.value)} />
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControlLabel control={<Switch checked={form.youngDriver} onChange={e => set("youngDriver", e.target.checked)} />} label="Νέος οδηγός / οδηγεί παιδί" />
          <FormControlLabel control={<Switch checked={form.sunroof} onChange={e => set("sunroof", e.target.checked)} />} label="Ηλιοροφή" />
        </Stack>
        <TextField label="Σημειώσεις οχήματος" value={form.notes} onChange={e => set("notes", e.target.value)} multiline minRows={2} />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>}
    </DialogContent>
    <DialogActions><Button color="error" variant="contained" onClick={onClose} sx={{ color: "#fff" }}>Ακύρωση</Button><Button variant="contained" color="success" onClick={() => update.mutate()} disabled={!form.policyId || !form.plate.trim() || update.isPending || rows.length === 0}>{update.isPending ? "Αποθήκευση…" : "Προσθήκη οχήματος"}</Button></DialogActions>
  </Dialog>;
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
    refetchInterval: 30000,
    queryFn: async () => (await api.get<CustomerSummary>(`/customers/${customerId}/summary`)).data,
    enabled: !!customerId
  });
  const policiesQ = useQuery({
    queryKey: ["customer-statistics-policies", customerId],
    refetchInterval: 30000,
    queryFn: async () => (await api.get<CustomerStatisticsPolicy[]>("/policies", { params: { customerId } })).data,
    enabled: !!customerId
  });
  const accountQ = useQuery({
    queryKey: ["customer-account", customerId, "statistics"],
    refetchInterval: 30000,
    retry: false,
    queryFn: async () => (await api.get<CustomerAccount>(`/customers/${customerId}/account`)).data,
    enabled: !!customerId
  });

  const policies = useMemo(() => (policiesQ.data ?? []).filter(p => p.status !== "Prospect"), [policiesQ.data]);
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
    <Card variant="outlined" sx={{ p: 1, minWidth: 0 }}>
      <Typography fontWeight={800} sx={{ mb: .5, fontSize: { xs: ".85rem", md: ".92rem" } }}>{title}</Typography>
      <Box sx={{ width: "100%", height: { xs: 185, md: 210 } }}>{children}</Box>
    </Card>
  );

  return (
    <Stack spacing={.75}>
      <Box>
        <Typography variant="h6" fontWeight={800}>Στατιστικά πελάτη</Typography>
        <Typography variant="body2" color="text.secondary">Παραγωγή, οικονομική εικόνα, συμβόλαια και πορεία χαρτοφυλακίου.</Typography>
      </Box>
      <CustomerSummaryCard customerId={customerId} />
      <Typography variant="caption" color="text.secondary">Αυτόματη ενημέρωση κάθε 30 δευτερόλεπτα όσο το παράθυρο παραμένει ανοιχτό.</Typography>
      {accountQ.isError && <Alert severity="warning">Η οικονομική ανάλυση δεν είναι διαθέσιμη: {extractErrorMessage(accountQ.error)}</Alert>}
      {summary && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
        {[
          ["Ενεργά συμβόλαια", `${summary.activePolicyCount} / ${summary.totalPolicyCount}`, "#0b5cad"],
          ["Μεικτά φέτος", `${formatMoney(summary.currentYearGrossPremium)} €`, "#1976d2"],
          ["Έσοδα γραφείου", `${formatMoney(summary.lifetimeAgencyCommission)} €`, "#2e7d32"],
          ["Ανοιχτές ζημίες", `${summary.openClaimCount} / ${summary.totalClaimCount}`, "#c62828"],
        ].map(([label, value, color]) => <Card key={label} variant="outlined" sx={{ p: 1.25, borderTop: `3px solid ${color}` }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value}</Typography></Card>)}
      </Box>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5 }}>
        {chartCard("Παραγωγή ανά μήνα", premiumByMonth.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα συμβολαίων.</Typography> : <ResponsiveContainer width="100%" height="100%"><LineChart data={premiumByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><YAxis yAxisId="right" orientation="right" allowDecimals={false} /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "premium" ? "Μεικτά" : "Συμβόλαια"} /><Line type="monotone" dataKey="premium" stroke="#0b5cad" strokeWidth={3} dot /><Line type="monotone" dataKey="contracts" stroke="#2e7d32" strokeWidth={2} yAxisId="right" /></LineChart></ResponsiveContainer>)}
        {chartCard("Μεικτά ανά κλάδο", typeData.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν δεδομένα κλάδων.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "premium" ? "Μεικτά" : "Συμβόλαια"} /><Bar dataKey="premium" fill="#1976d2" radius={[5, 5, 0, 0]} /><Bar dataKey="contracts" fill="#66bb6a" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>)}
        {chartCard("Οικονομική πορεία ανά μήνα", monthlyAccount.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν οικονομικές κινήσεις.</Typography> : <ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyAccount}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><ChartTooltip formatter={formatChartValue} /><Legend formatter={name => name === "charges" ? "Χρεώσεις" : name === "credits" ? "Εισπράξεις" : "Υπόλοιπο"} /><Line type="monotone" dataKey="charges" stroke="#c62828" strokeWidth={2} /><Line type="monotone" dataKey="credits" stroke="#2e7d32" strokeWidth={2} /><Line type="monotone" dataKey="balance" stroke="#0b5cad" strokeWidth={3} /></LineChart></ResponsiveContainer>)}
        {chartCard("Κατάσταση συμβολαίων", statusData.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν συμβόλαια.</Typography> : <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><ChartTooltip /><Bar dataKey="contracts" name="Συμβόλαια" fill="#0b5cad" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>)}
      </Box>
    </Stack>
  );
}

/* ---------- Policies tab ---------- */

function CustomerPoliciesTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [timeline, setTimeline] = useState(false);
  const q = useQuery({
    queryKey: ["customer-policies", customerId],
    queryFn: async () => (await api.get<{
      id: string; policyNumber: string; insuranceCompanyName: string; policyType: string;
      status: string; startDate: string; endDate: string; premium: number; currency: string;
    }[]>("/policies", { params: { customerId } })).data
  });
  if (q.isLoading) return <CircularProgress />;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  const rows = q.data ?? [];
  const visibleRows = rows.filter(p => (!status || p.status === status) && (!type || p.policyType === type) &&
    `${p.policyNumber} ${p.insuranceCompanyName} ${p.policyType}`.toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR")));
  return (
    <Stack spacing={.75}>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
        <TextField size="small" label="Αναζήτηση συμβολαίου / ασφαλιστικής" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: "1 1 230px" }} />
        <TextField select size="small" label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">Όλες</MenuItem>{[...new Set(rows.map(r => r.status))].map(s => <MenuItem key={s} value={s}>{vehicleStatusLabel(s)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Κλάδος" value={type} onChange={e => setType(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">Όλοι</MenuItem>{[...new Set(rows.map(r => r.policyType))].map(s => <MenuItem key={s} value={s}>{String(t(`policyType.${s}`, s))}</MenuItem>)}
        </TextField>
        <Button size="small" variant="contained" color="success" onClick={() => setTimeline(true)} sx={{ color: "#fff", "&:hover": { bgcolor: "success.dark", color: "#fff" } }}>Χρονογραμμή ανανεώσεων</Button>
      </Stack>
      <Typography variant="caption">{visibleRows.length} από {rows.length} συμβόλαια</Typography>
      <Card variant="outlined">
        <TableContainer tabIndex={0}><Table size="small">
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
            {visibleRows.length === 0 && <TableRow><TableCell colSpan={7}>Δεν βρέθηκαν συμβόλαια.</TableCell></TableRow>}
            {visibleRows.map(p => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{p.policyNumber}</TableCell>
                <TableCell>{p.insuranceCompanyName}</TableCell>
                <TableCell>{String(t(`policyType.${p.policyType}`, p.policyType))}</TableCell>
                <TableCell>{p.startDate} → {p.endDate}</TableCell>
                <TableCell align="right">{p.premium.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {p.currency}</TableCell>
                <TableCell><Chip size="small" label={vehicleStatusLabel(p.status)} /></TableCell>
                <TableCell>
                  <Button size="small" component={RouterLink} to={`/app/policies?focus=${p.id}`}>Προβολή</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></TableContainer>
      </Card>
      <CustomerPopup open={timeline} title="Χρονογραμμή ανανεώσεων" onClose={() => setTimeline(false)}>
        {rows.some(p => p.status === "Active" || p.status === "PendingRenewal") ? <RenewalTimeline policies={rows} /> : <Alert severity="info">Δεν υπάρχουν συμβόλαια προς ανανέωση.</Alert>}
      </CustomerPopup>
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
    <Card variant="outlined" sx={{ p: 1 }}>
      <Typography variant="overline" color="text.secondary" fontWeight={700}>
        Χρονογραμμή ανανεώσεων
      </Typography>
      <Stack spacing={.5} sx={{ mt: .5 }}>
        {upcoming.map(({ p, days }) => {
          const label = days < 0
            ? `Έληξε πριν ${Math.abs(days)} μέρες`
            : days === 0 ? "Λήγει σήμερα"
            : `Σε ${days} μέρες`;
          return (
            <Stack key={p.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ p: .7, borderLeft: 4, borderColor: `${colorFor(days)}.main`, bgcolor: "background.default", borderRadius: 1 }}>
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


type DesktopCustomerField = {
  id?: string;
  label: string;
  key?: keyof CustomerDto;
  value?: string | null;
  displayValue?: React.ReactNode;
  type?: "text" | "date" | "email" | "number";
  options?: InlineValueOption[];
};

interface CustomerFieldEditing {
  editAll: boolean;
  drafts: CustomerDrafts;
  saving: boolean;
  canEdit: boolean;
  onDraftChange: (key: keyof CustomerDto, value: string) => void;
  onCommitField: (key: keyof CustomerDto, value: string) => Promise<void>;
}

export function DesktopCustomerFields({ customer, section = "general", editing, fieldKeys }: {
  customer: CustomerDto; section?: "general" | "contact"; editing: CustomerFieldEditing;
  /** Reuse the exact same controls for a selected subset without duplicating field metadata. */
  fieldKeys?: readonly (keyof CustomerDto)[];
}) {
  const wide = useMediaQuery("(min-width:1200px)");
  const occupations = useQuery({ queryKey: ["lookup", "occupations"], enabled: section === "general",
    queryFn: async () => (await api.get<Array<{ name: string }>>("/lookups/occupations")).data });
  const nationalities = useQuery({ queryKey: ["lookup", "nationalities"], enabled: section === "general",
    queryFn: async () => (await api.get<Array<{ name: string }>>("/lookups/nationalities")).data });
  const dash = "—";
  const age = customerAge(editing.drafts.birthDate ?? customer.birthDate);
  const booleanOptions: InlineValueOption[] = [{ value: "", label: "Δεν έχει οριστεί" }, { value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }];
  const driving = (key: "hasDrivingLicense" | "isDriver" | "isNewDriver", label: string): DesktopCustomerField => ({
    key, label, value: customer[key] == null ? "" : String(customer[key]),
    displayValue: customer[key] == null ? "Δεν έχει οριστεί" : customer[key] ? "Ναι" : "Όχι", options: booleanOptions,
  });
  const dateTime = customer.createdAt ? new Date(customer.createdAt).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }) : dash;
  const typeLabel = customer.type === "Company" ? "Νομικό πρόσωπο" : "Φυσικό πρόσωπο";
  const statusLabel = ({ Prospect: "Πιθανός πελάτης", Active: "Ενεργός πελάτης", Inactive: "Ανενεργός", Churned: "Απώλεια", Blocked: "Αποκλεισμένος" } as Record<string, string>)[customer.status] ?? customer.status;
  const typeOptions: InlineValueOption[] = [
    { value: "Individual", label: "Φυσικό πρόσωπο" },
    { value: "Company", label: "Νομικό πρόσωπο" },
  ];
  const statusOptions: InlineValueOption[] = [
    { value: "Prospect", label: "Πιθανός πελάτης" },
    { value: "Active", label: "Ενεργός πελάτης" },
    { value: "Inactive", label: "Ανενεργός" },
    { value: "Churned", label: "Απώλεια" },
    { value: "Blocked", label: "Αποκλεισμένος" },
  ];
  const left: DesktopCustomerField[] = [
    { label: "Κωδ. πελάτη", value: customer.customerNumber },
    { label: "ΑΦΜ", key: "vatNumber", value: customer.vatNumber },
    { label: "Επώνυμο", key: "lastName", value: customer.lastName },
    { label: "Όνομα", key: "firstName", value: customer.firstName },
    { label: "Διεύθυνση", key: "address", value: customer.address },
    { label: "Περιοχή", key: "region", value: customer.region },
    { label: "Πόλη", key: "city", value: customer.city },
    { label: "Τηλέφωνο", key: "phone", value: customer.phone },
    { label: "Κινητό τηλ.", key: "mobilePhone", value: customer.mobilePhone },
    { label: "Επάγγελμα / κλάδος", key: "occupation", value: customer.occupation },
    { label: "Ταχ. κώδικας", key: "postalCode", value: customer.postalCode },
    { label: "Σημ. πελάτη", key: "notes", value: customer.notes },
  ];
  const right: DesktopCustomerField[] = [
    { label: "Ημ. δημιουργίας", value: dateTime },
    { label: "Ημ. ενημέρωσης", value: dash },
    { label: "Δ.Ο.Υ.", key: "taxOffice", value: customer.taxOffice },
    { label: "Αριθ. ταυτότητας", key: "idNumber", value: customer.idNumber },
    { label: "e-mail", key: "email", value: customer.email, type: "email" },
    { label: "Τύπος προσώπου", key: "type", value: customer.type, displayValue: typeLabel, options: typeOptions },
    { label: "Επωνυμία νομ. προσώπου", key: "companyName", value: customer.companyName },
    { label: "ΑΜΚΑ", key: "amka", value: customer.amka },
    { label: "Κατάσταση", key: "status", value: customer.status, displayValue: statusLabel, options: statusOptions },
  ];

  const contactLeft: DesktopCustomerField[] = [
    { label: "Τηλέφωνο", key: "phone", value: customer.phone },
    { label: "2ο τηλέφωνο", key: "altPhone", value: customer.altPhone },
    { label: "3ο τηλέφωνο", key: "thirdPhone", value: customer.thirdPhone },
    { label: "Κινητό", key: "mobilePhone", value: customer.mobilePhone },
    { label: "2ο κινητό", key: "secondaryMobilePhone", value: customer.secondaryMobilePhone },
  ];
  const contactRight: DesktopCustomerField[] = [
    { label: "Email", key: "email", value: customer.email, type: "email" },
    { label: "2ο email", key: "secondaryEmail", value: customer.secondaryEmail, type: "email" },
    { label: "Διεύθυνση", key: "address", value: customer.address },
    { label: "Πόλη", key: "city", value: customer.city },
    { label: "Ταχ. κώδικας", key: "postalCode", value: customer.postalCode },
    { label: "Περιφέρεια", key: "region", value: customer.region },
  ];

  const additional: DesktopCustomerField[] = [
    { label: "Ημ. γέννησης", key: "birthDate", value: customer.birthDate, type: "date" },
    { id: "age", label: "Ηλικία (αυτόματα)", value: age == null ? dash : `${age} έτη` },
    driving("hasDrivingLicense", "Έχει δίπλωμα"),
    driving("isDriver", "Είναι οδηγός"),
    driving("isNewDriver", "Νέος οδηγός"),
    { label: "Φύλο", key: "gender", value: customer.gender, displayValue: ({ Male: "Άνδρας", Female: "Γυναίκα", Other: "Άλλο", PreferNotToSay: "Δεν επιθυμεί να δηλώσει" } as Record<string, string>)[customer.gender ?? ""] || customer.gender || dash,
      options: [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Male", label: "Άνδρας" }, { value: "Female", label: "Γυναίκα" }, { value: "Other", label: "Άλλο" }, { value: "PreferNotToSay", label: "Δεν επιθυμεί να δηλώσει" }] },
    { label: "Εθνικότητα", key: "nationality", value: customer.nationality },
    { label: "Οικογενειακή κατάσταση", key: "maritalStatus", value: customer.maritalStatus,
      displayValue: ({ Single: "Άγαμος / άγαμη", Married: "Έγγαμος / έγγαμη", Divorced: "Διαζευγμένος / διαζευγμένη", Widowed: "Χήρος / χήρα", Other: "Άλλο" } as Record<string, string>)[customer.maritalStatus ?? ""] || customer.maritalStatus || dash,
      options: [{ value: "", label: "Δεν έχει οριστεί" }, { value: "Single", label: "Άγαμος / άγαμη" }, { value: "Married", label: "Έγγαμος / έγγαμη" }, { value: "Divorced", label: "Διαζευγμένος / διαζευγμένη" }, { value: "Widowed", label: "Χήρος / χήρα" }, { value: "Other", label: "Άλλο" }] },
    { label: "Διαβατήριο", key: "passportNumber", value: customer.passportNumber },
    { label: "Πατρώνυμο", key: "fatherName", value: customer.fatherName },
    { label: "Μητρώνυμο", key: "motherName", value: customer.motherName },
    { label: "Σύζυγος / σύντροφος", key: "spouseName", value: customer.spouseName },
    { label: "ΓΕΜΗ", key: "gemiNumber", value: customer.gemiNumber },
    { label: "Νομική μορφή", key: "legalForm", value: customer.legalForm,
      options: [
        { value: "", label: "Δεν έχει οριστεί" }, { value: "Ατομική επιχείρηση", label: "Ατομική επιχείρηση" },
        { value: "Ο.Ε.", label: "Ο.Ε." }, { value: "Ε.Ε.", label: "Ε.Ε." }, { value: "Ι.Κ.Ε.", label: "Ι.Κ.Ε." },
        { value: "Ε.Π.Ε.", label: "Ε.Π.Ε." }, { value: "Α.Ε.", label: "Α.Ε." },
        { value: "Σωματείο / σύλλογος", label: "Σωματείο / σύλλογος" }, { value: "Άλλη", label: "Άλλη" },
      ] },
    { label: "Αριθμός διπλώματος", key: "driverLicenseNumber", value: customer.driverLicenseNumber },
    { label: "Κατηγορία διπλώματος", key: "driverLicenseClass", value: customer.driverLicenseClass,
      options: [{ value: "", label: "Δεν έχει οριστεί" }, ...["ΑΜ", "Α1", "Α2", "Α", "Β", "ΒΕ", "Γ", "ΓΕ", "Δ", "ΔΕ"].map(value => ({ value, label: value }))] },
    { label: "Έκδοση διπλώματος", key: "driverLicenseIssueDate", value: customer.driverLicenseIssueDate, type: "date" },
    { label: "Λήξη διπλώματος", key: "driverLicenseExpiryDate", value: customer.driverLicenseExpiryDate, type: "date" },
  ];

  // All customer identity, tax, family and driving information now lives in
  // General. This avoids a second catch-all tab and keeps one edit workflow.
  const allGeneralFields = [...left, ...right, ...additional];
  const generalFields = fieldKeys !== undefined ? allGeneralFields.filter(field => field.key && fieldKeys.includes(field.key))
    : allGeneralFields;
  const columnCount = wide ? 3 : 2;
  const columnSize = Math.ceil(generalFields.length / columnCount);
  const columns = section === "contact" ? [contactLeft, contactRight]
    : Array.from({ length: columnCount }, (_, index) => generalFields.slice(index * columnSize, (index + 1) * columnSize));

  const renderField = (field: DesktopCustomerField) => {
    const stored = field.key ? customer[field.key] : field.value;
    const raw = typeof stored === "string" || typeof stored === "number" ? stored : stored == null ? "" : String(stored);
    const display = field.displayValue ?? (field.value || dash);
    return (
      <Box key={field.label} data-customer-field={field.key ?? field.id ?? field.label} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(104px, .36fr) minmax(0, 1fr)", sm: "132px minmax(0, 1fr)" }, alignItems: "center", minHeight: 32, gap: .5 }}>
        <Typography variant="caption" sx={{ color: "#506783", fontWeight: 700, lineHeight: 1.15, pr: .35 }}>{field.label}</Typography>
        <InlineValueField
          label={field.label}
          value={raw}
          copyValue={typeof display === "string" || typeof display === "number" ? display : raw}
          displayValue={display}
          options={field.options}
          type={field.type}
          suggestions={field.key === "occupation" ? (occupations.data ?? []).map(item => item.name) : field.key === "nationality" ? (nationalities.data ?? []).map(item => item.name) : undefined}
          validate={field.key ? value => customerFieldError(field.key!, value) : undefined}
          maxLength={field.key ? fieldMaxLength(field.key) : undefined}
          inputMode={field.key?.toLowerCase().includes("phone") ? "tel" : field.type === "email" ? "email" : field.key === "vatNumber" || field.key === "amka" || field.key === "postalCode" ? "numeric" : undefined}
          valueColor="#193653"
          compact
          hideLabel
          showActions
          disabled={editing.saving}
          editMode={editing.editAll}
          draftValue={field.key ? editing.drafts[field.key] : undefined}
          onDraftChange={field.key ? value => editing.onDraftChange(field.key!, value) : undefined}
          onCommit={field.key && editing.canEdit ? value => editing.onCommitField(field.key!, value) : undefined}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: "#edf3f9", border: "1px solid #d6e3f0", borderRadius: 1.25, p: { xs: .5, md: .75 }, minHeight: 0, overflow: section !== "contact" ? "auto" : "visible", flexShrink: section !== "contact" ? 1 : 0 }}>
      {fieldKeys?.length === 0 && <Typography role="status" variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Δεν έχουν οριστεί ακόμη πεδία για αυτή την ενότητα.
      </Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", lg: `repeat(${section !== "contact" ? 3 : 2}, minmax(0, 1fr))` }, columnGap: { xs: 0, md: 1 }, alignItems: "start" }}>
        {columns.map((fields, index) => <Stack key={index} spacing={.25}>{fields.map(renderField)}</Stack>)}
      </Box>
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
      notes: c.notes ?? "",
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
      <Typography variant="h6" sx={{ mb: .75 }}>GDPR ενέργειες</Typography>
      {err && <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" onClose={() => setOk(null)} sx={{ mb: 2 }}>{ok}</Alert>}

      <CustomerGdprFormSigningPanel customerId={customerId} />

      <Card variant="outlined" sx={{ p: 1, mb: .75 }}>
        <Typography fontWeight={700}>Δικαίωμα πρόσβασης / φορητότητας</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: .75 }}>
          Κατεβάστε όλα τα δεδομένα του πελάτη σε JSON.
        </Typography>
        <Button variant="contained" startIcon={<DownloadIcon />}
          onClick={() => exportNow.mutate()} disabled={exportNow.isPending}>
          Εξαγωγή σε JSON
        </Button>
      </Card>

      <Card variant="outlined" sx={{ p: 1, borderColor: "warning.light" }}>
        <Typography fontWeight={700} color="error">Δικαίωμα διαγραφής (anonymization)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: .75 }}>
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
