import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
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
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import MarkunreadMailboxOutlinedIcon from "@mui/icons-material/MarkunreadMailboxOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useTableState } from "../components/useTableState";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { SearchableTextField } from "../components/SearchableTextField";
import { QuickFilterBar } from "../components/QuickFilterBar";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { BulkImportDialog, type BulkImportResult } from "../components/BulkImportDialog";

type CustomerType = "Individual" | "Company";
type CustomerStatus = "Prospect" | "Active" | "Inactive" | "Churned" | "Blocked";
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;
// Localise the Ανάγκη / περιουσία dropdown values into Greek — the enum
// names ship straight to the API but the operator sees the label.
const NEED_KIND_LABEL: Record<string, string> = {
  Home: "Κατοικία", Vehicle: "Όχημα", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Pet: "Κατοικίδιο",
  Liability: "Ευθύνη", Cyber: "Cyber", Other: "Άλλο",
};
const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  Prospect: "Πιθανός πελάτης",
  Active: "Ενεργός",
  Inactive: "Ανενεργός",
  Churned: "Απώλεια",
  Blocked: "Αποκλεισμένος",
};

interface CustomerDto {
  id: string;
  customerNumber: string;
  type: CustomerType;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  city?: string;
  notes?: string | null;
  paymentDueDate?: string | null;
  address?: string | null;
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
  createdAt: string;
}

interface CustomerAccountSummary {
  customerId: string;
  customerName: string;
  charges: number;
  credits: number;
  balance: number;
  overdueAmount: number;
  overdueCount: number;
  paidInstallments: number;
  latePayments: number;
  onTimeRatePercent: number;
  lastPaymentDate?: string | null;
  lastChargeDate?: string | null;
  paymentDueDate?: string | null;
  isPaymentOverdue?: boolean;
}

type CustomerListRow = CustomerDto & { account?: CustomerAccountSummary };
type PaymentFilter = "all" | "debtors" | "creditors" | "settled" | "overdue" | "good" | "bad" | "unpaid";
type PaymentWindow = "all" | "last7" | "last30" | "previousWeek" | "previousMonth" | "thisMonth" | "custom";

interface CreateBody {
  type: CustomerType;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  occupation?: string;
  notes?: string;
  paymentDueDate?: string;
  birthDate?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  nationality?: string;
  zone?: string;
  activityCode?: string;
  taxOffice?: string;
  gemiNumber?: string;
  legalForm?: string;
  altPhone?: string;
  mobilePhone?: string;
  amka?: string;
  idNumber?: string;
  passportNumber?: string;
  region?: string;
  gender?: string;
  maritalStatus?: string;
  employer?: string;
  driverLicenseNumber?: string;
  driverLicenseClass?: string;
  driverLicenseIssueDate?: string;
  driverLicenseExpiryDate?: string;
  source?: string;
  tagsJson?: string;
  photoUrl?: string;
}

function newCustomerForm(status: CustomerStatus): CreateBody {
  return {
    type: "Individual", status,
    firstName: "", lastName: "", companyName: "", vatNumber: "",
    email: "", phone: "", address: "", city: "", postalCode: "",
    occupation: "", notes: "", paymentDueDate: "", birthDate: "", fatherName: "", motherName: "", spouseName: "", nationality: "", zone: "", activityCode: "",
    taxOffice: "", gemiNumber: "", legalForm: "", altPhone: "", mobilePhone: "", amka: "", idNumber: "", passportNumber: "",
    region: "", gender: "", maritalStatus: "", employer: "", driverLicenseNumber: "", driverLicenseClass: "",
    driverLicenseIssueDate: "", driverLicenseExpiryDate: "", source: "", tagsJson: "", photoUrl: ""
  };
}

const CUSTOMER_IMPORT_COLUMNS = [
  { key: "type", label: "Τύπος πελάτη (Individual/Company)", required: true, example: "Individual" },
  { key: "status", label: "Κατάσταση (Prospect/Active)", required: true, example: "Active" },
  { key: "firstName", label: "Όνομα", example: "Μαρία" },
  { key: "lastName", label: "Επώνυμο", example: "Παπαδοπούλου" },
  { key: "companyName", label: "Επωνυμία εταιρείας", example: "Παράδειγμα ΑΕ" },
  { key: "vatNumber", label: "ΑΦΜ", example: "123456789" },
  { key: "email", label: "Email", example: "maria@example.gr" },
  { key: "phone", label: "Τηλέφωνο", example: "2100000000" },
  { key: "address", label: "Διεύθυνση", example: "Οδός 1" },
  { key: "city", label: "Πόλη", example: "Αθήνα" },
  { key: "postalCode", label: "Τ.Κ.", example: "11111" },
  { key: "occupation", label: "Επάγγελμα", example: "" },
  { key: "notes", label: "Σημειώσεις", example: "" },
  { key: "paymentDueDate", label: "Ημερομηνία εξόφλησης (YYYY-MM-DD)", example: "2026-12-31" }
] as const;

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function paymentStatus(account?: CustomerAccountSummary): string {
  if (!account) return "—";
  if (account.balance > 0.005) return account.overdueAmount > 0.005 ? "Κακοπληρωτής" : "Οφειλέτης";
  if (account.balance < -0.005) return "Πιστωτικός";
  if ((account.credits > 0.005 || account.paidInstallments > 0) && account.latePayments === 0) return "Καλοπληρωτής";
  return "Εξοφλημένος";
}

export function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [needKind, setNeedKind] = useState("");
  const [onlyUninsuredNeeds, setOnlyUninsuredNeeds] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [paymentWindow, setPaymentWindow] = useState<PaymentWindow>("all");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");
  const [createStatus, setCreateStatus] = useState<CustomerStatus | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", search, occupationFilter, needKind, onlyUninsuredNeeds, statusFilter],
    queryFn: async () =>
      (await api.get<CustomerDto[]>("/customers", { params: {
        search: search || undefined,
        occupation: occupationFilter || undefined,
        needKind: needKind || undefined,
        onlyUninsuredNeeds: needKind && onlyUninsuredNeeds ? true : undefined,
        status: statusFilter || undefined,
        limit: 5000
      } })).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => api.post("/customers", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setCreateStatus(null);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const paymentRange = useMemo(() => {
    if (paymentWindow === "custom") return { from: paymentFrom || undefined, to: paymentTo || undefined };
    if (paymentWindow === "all") return { from: undefined, to: undefined };
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    if (paymentWindow === "last7") start.setDate(start.getDate() - 6);
    if (paymentWindow === "last30") start.setDate(start.getDate() - 29);
    if (paymentWindow === "thisMonth") start.setDate(1);
    if (paymentWindow === "previousWeek") {
      const day = end.getDay() || 7;
      end.setDate(end.getDate() - day);
      start.setDate(end.getDate() - 6);
    }
    if (paymentWindow === "previousMonth") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    }
    return { from: isoDate(start), to: isoDate(end) };
  }, [paymentWindow, paymentFrom, paymentTo]);

  const accountsQuery = useQuery({
    queryKey: ["customer-accounts", paymentRange.from, paymentRange.to],
    retry: false,
    queryFn: async () => (await api.get<CustomerAccountSummary[]>("/customers/accounts", { params: {
      from: paymentRange.from,
      to: paymentRange.to,
      onlyDebtors: false,
      onlyCreditors: false,
      onlyOverdue: false
    } })).data
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CreateBody }) => api.put(`/customers/${id}`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["customers"] }); setEditingCustomer(null); },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const importCustomers = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0; const errors: string[] = []; const failedRows: Record<string, string>[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        const type = row.type === "Company" ? "Company" : "Individual";
        const status: CustomerStatus = row.status === "Prospect" ? "Prospect" : "Active";
        await api.post("/customers", {
          type, status,
          firstName: row.firstName || undefined, lastName: row.lastName || undefined,
          companyName: row.companyName || undefined, vatNumber: row.vatNumber || undefined,
          email: row.email || undefined, phone: row.phone || undefined,
          address: row.address || undefined, city: row.city || undefined,
           postalCode: row.postalCode || undefined, occupation: row.occupation || undefined,
           notes: row.notes || undefined, paymentDueDate: row.paymentDueDate || undefined,
           createPortalAccount: false
        });
        imported++;
      } catch (e) { failedRows.push(row); errors.push(`Row ${index + 2}: ${extractErrorMessage(e)}`); }
    }
    void qc.invalidateQueries({ queryKey: ["customers"] });
    return { imported, failed: rows.length - imported, errors, failedRows };
  };

  const accountByCustomer = useMemo(() => new Map(
    (accountsQuery.data ?? []).map(account => [account.customerId, account])
  ), [accountsQuery.data]);
  const allCustomers = useMemo<CustomerListRow[]>(() => (customersQuery.data ?? []).map(customer => ({
    ...customer,
    account: accountByCustomer.get(customer.id)
  })), [customersQuery.data, accountByCustomer]);
  const financeFilteredCustomers = useMemo(() => allCustomers.filter(customer => {
    if (paymentFilter === "all") return true;
    const account = customer.account;
    if (!account) return false;
    switch (paymentFilter) {
      case "debtors": return account.balance > 0.005;
      case "creditors": return account.balance < -0.005;
      case "settled": return Math.abs(account.balance) <= 0.005;
      case "overdue": return account.overdueAmount > 0.005;
      case "good": return (account.credits > 0.005 || account.paidInstallments > 0) && account.overdueAmount <= 0.005 && account.latePayments === 0 && account.balance <= 0.005;
      case "bad": return account.overdueAmount > 0.005 || account.latePayments > 0;
      case "unpaid": return account.balance > 0.005 && account.credits <= 0.005;
      default: return true;
    }
  }), [allCustomers, paymentFilter]);
  const debtorCount = allCustomers.filter(c => (c.account?.balance ?? 0) > 0.005).length;
  const creditorCount = allCustomers.filter(c => (c.account?.balance ?? 0) < -0.005).length;
  const overdueCount = allCustomers.filter(c => (c.account?.overdueAmount ?? 0) > 0.005).length;
  const goodPayerCount = allCustomers.filter(c => c.account && (c.account.credits > 0.005 || c.account.paidInstallments > 0) && c.account.overdueAmount <= 0.005 && c.account.latePayments === 0 && c.account.balance <= 0.005).length;
  const badPayerCount = allCustomers.filter(c => (c.account?.overdueAmount ?? 0) > 0.005 || (c.account?.latePayments ?? 0) > 0).length;
  const unpaidCount = allCustomers.filter(c => c.account && c.account.balance > 0.005 && c.account.credits <= 0.005).length;
  const settledCount = allCustomers.filter(c => c.account && Math.abs(c.account.balance) <= 0.005).length;
  const table = useTableState<CustomerListRow>({
    rows: financeFilteredCustomers,
    searchableText: (c) => `${c.customerNumber} ${c.firstName ?? ""} ${c.lastName ?? ""} ${c.companyName ?? ""} ${c.vatNumber ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.city ?? ""}`,
    pageSize: 25
  });
  const customers = table.paged;
  const customerFilterCount = [
    search, occupationFilter, needKind, onlyUninsuredNeeds ? "needs" : "", statusFilter,
    paymentFilter !== "all" ? paymentFilter : "", paymentWindow !== "all" ? paymentWindow : "",
    paymentFrom, paymentTo, table.query,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setSearch("");
    setOccupationFilter("");
    setNeedKind("");
    setOnlyUninsuredNeeds(false);
    setStatusFilter("");
    setPaymentFilter("all");
    setPaymentWindow("all");
    setPaymentFrom("");
    setPaymentTo("");
    table.setQuery("");
    table.setPage(1);
  };
  const customerCols = useColumnPreferences("customers", [
    { key: "number", label: "Αρ. Πελάτη", alwaysVisible: true },
    { key: "type",   label: "Τύπος" },
    { key: "name",   label: "Ονοματεπώνυμο / Επωνυμία" },
    { key: "email",  label: "Email" },
    { key: "phone",  label: "Τηλέφωνο" },
    { key: "notes",  label: "Σημειώσεις" },
    { key: "balance", label: "Υπόλοιπο / πληρωμές" },
    { key: "paymentDueDate", label: "Ημ. εξόφλησης" },
    { key: "paymentStatus", label: "Συμπεριφορά πληρωμών" },
    { key: "city",   label: "Πόλη", defaultVisible: false },
  ]);

  // Right-click on a header → sort (Α→Ω / Ω→Α) + «Απόκρυψη στήλης» (via
  // the existing column-preferences hook). Right-click on a row → open
  // the customer detail page in a new tab or delete the customer.
  const inferColumnType = (key: string): ColumnType => {
    if (key === "number") return "string";
    return "string";
  };
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      // useTableState only supports keys that exist on the DTO; map friendly
      // column keys back to the underlying field so sorting works everywhere.
      const map: Record<string, keyof CustomerListRow> = {
        number: "customerNumber", type: "type", name: "lastName",
        email: "email", phone: "phone", city: "city", notes: "notes",
      };
      const dtoKey = map[key];
      if (dtoKey) {
        table.toggleSort(dtoKey);
        // toggleSort only alternates dir; force the direction picked from the menu.
        if (table.sortDir !== dir) table.toggleSort(dtoKey);
      }
    },
    onHide: (key) => customerCols.toggleVisibility(key),
  });
  // Explicit deleter — the delete endpoint refuses if the customer has
  // policies / receipts attached; the API's friendly why/fix bubbles up
  // through extractErrorMessage so the operator sees "Ο πελάτης έχει N
  // ενεργά συμβόλαια — δεν διαγράφεται." instead of a generic 400.
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customers"] }),
    onError: e => setError(extractErrorMessage(e))
  });

  const rowMenu = useRowContextMenu<CustomerDto>({
    entityLabel: "πελάτη",
    onEdit: (c) => { setError(null); setEditingCustomer(c); },
    onDelete: (c) => {
      const label = c.type === "Individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
        : c.companyName || c.customerNumber;
      if (confirm(`Διαγραφή πελάτη «${label}»;\n\nΘα αποτύχει αν έχει συμβόλαια ή αποδείξεις.`)) del.mutate(c.id);
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("customers.title")}</Typography>
          <HelpHint id="page.customers" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="large" startIcon={<UploadFileOutlinedIcon />} onClick={() => setImportOpen(true)}>
            Εισαγωγή
          </Button>
          {/* Export handled by the TableToolbar dropdown below — the old
              header ExportButton was a duplicate CSV-only shortcut. */}
          <Button variant="outlined" size="large" onClick={() => { setError(null); setCreateStatus("Prospect"); }}>
            Πιθανός πελάτης
          </Button>
          <Button data-tour="customers-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateStatus("Active"); }}>
            {t("customers.create")}
          </Button>
        </Stack>
      </Stack>

      <ResponsiveFilterPanel
        activeCount={customerFilterCount}
        title="Φίλτρα πελατών"
        quickFilters={<QuickFilterBar
          activeCount={customerFilterCount}
          onClear={clearFilters}
          options={[
            { key: "all", label: "Όλοι", active: customerFilterCount === 0, onClick: clearFilters },
            { key: "debtors", label: "Οφειλέτες", count: debtorCount, active: paymentFilter === "debtors", color: "error", onClick: () => setPaymentFilter("debtors") },
            { key: "creditors", label: "Πιστωτικοί", count: creditorCount, active: paymentFilter === "creditors", color: "info", onClick: () => setPaymentFilter("creditors") },
            { key: "overdue", label: "Ληξιπρόθεσμοι", count: overdueCount, active: paymentFilter === "overdue", color: "warning", onClick: () => setPaymentFilter("overdue") },
            { key: "good", label: "Καλοπληρωτές", count: goodPayerCount, active: paymentFilter === "good", color: "success", onClick: () => setPaymentFilter("good") },
            { key: "bad", label: "Κακοπληρωτές", count: badPayerCount, active: paymentFilter === "bad", color: "error", onClick: () => setPaymentFilter("bad") },
            { key: "unpaid", label: "Χωρίς καταβολή", count: unpaidCount, active: paymentFilter === "unpaid", onClick: () => setPaymentFilter("unpaid") },
            { key: "settled", label: "Εξοφλημένοι", count: settledCount, active: paymentFilter === "settled", color: "success", onClick: () => setPaymentFilter("settled") },
            { key: "last7", label: "Οφειλές 7 ημερών", active: paymentWindow === "last7", onClick: () => setPaymentWindow("last7") },
            { key: "last30", label: "Οφειλές 30 ημερών", active: paymentWindow === "last30", onClick: () => setPaymentWindow("last30") },
            { key: "previousWeek", label: "Προηγούμενη εβδομάδα", active: paymentWindow === "previousWeek", onClick: () => setPaymentWindow("previousWeek") },
            { key: "previousMonth", label: "Προηγούμενος μήνας", active: paymentWindow === "previousMonth", onClick: () => setPaymentWindow("previousMonth") },
            { key: "thisMonth", label: "Τρέχων μήνας", active: paymentWindow === "thisMonth", onClick: () => setPaymentWindow("thisMonth") },
          ]}
        />}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={0.5}
          alignItems={{ xs: "stretch", md: "center" }}
          flexWrap={{ xs: "wrap", md: "nowrap" }} useFlexGap
          sx={{
            display: { xs: "flex", md: "grid" },
            gridTemplateColumns: { md: "minmax(200px, 1.45fr) repeat(3, minmax(125px, 1fr))" },
            gridAutoFlow: "row",
            rowGap: { md: 1 },
            width: "100%",
            minWidth: 0,
            overflowX: { xs: "visible", md: "auto" },
            overflowY: "hidden",
            pt: { xs: 0, md: 1 },
            pb: { xs: 0, md: 0.25 },
            "& > .MuiTextField-root, & > .MuiFormControl-root, & > .MuiFormControlLabel-root, & > .MuiBox-root": {
              flex: { md: "0 0 auto" },
              minWidth: { md: 125 },
            },
            "& .MuiInputBase-root": { minHeight: 36 },
            "& .MuiInputLabel-root": { fontSize: "0.76rem" },
          }}>
          <TextField
            size="small"
            placeholder={t("customers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: { md: 200, xs: "100%" } }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
              endAdornment: <FilterHelp title="Αναζήτηση σε όνομα, ΑΦΜ, email, τηλέφωνο, αρ. πελάτη ή πόλη." />
            }}
          />
          <FilterFieldWrap tip="Ελεύθερο κείμενο για επάγγελμα ή κλάδο δραστηριότητας (π.χ. «εστίαση»).">
            <TextField size="small" label="Επάγγελμα / κλάδος" value={occupationFilter}
              onChange={(e) => setOccupationFilter(e.target.value)} sx={{ minWidth: 150, width: "100%", flex: "1 1 150px" }}
              placeholder="π.χ. εστίαση" />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε τους πελάτες βάσει ασφαλιστικής ανάγκης ή περιουσιακού στοιχείου.">
            <SearchableTextField size="small" label="Ανάγκη / περιουσία" value={needKind}
              onChange={(e) => setNeedKind(e.target.value)} sx={{ minWidth: 145, width: "100%", flex: "1 1 145px" }}>
              <MenuItem value="">Όλες</MenuItem>
              {NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{NEED_KIND_LABEL[kind] ?? kind}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FormControlLabel sx={{ mx: 0, minWidth: "auto", "& .MuiFormControlLabel-label": { fontSize: "0.78rem", whiteSpace: "nowrap" } }} control={<Switch size="small" checked={onlyUninsuredNeeds} disabled={!needKind}
            onChange={(e) => setOnlyUninsuredNeeds(e.target.checked)} />} label="Μόνο χωρίς κάλυψη" />
          <SearchableTextField select size="small" label="Κατάσταση" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | "")} sx={{ minWidth: 130, width: "100%", flex: "1 1 130px" }}>
            <MenuItem value="">Όλες</MenuItem>
            {Object.entries(CUSTOMER_STATUS_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </SearchableTextField>
          <SearchableTextField select size="small" label="Οικονομική εικόνα" value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)} sx={{ minWidth: 155, width: "100%", flex: "1 1 155px" }}>
            <MenuItem value="all">Όλοι οι πελάτες</MenuItem>
            <MenuItem value="debtors">Χρωστάνε στο γραφείο</MenuItem>
            <MenuItem value="unpaid">Χρέος χωρίς καταβολή</MenuItem>
            <MenuItem value="overdue">Ληξιπρόθεσμοι</MenuItem>
            <MenuItem value="creditors">Πιστωτικοί</MenuItem>
            <MenuItem value="good">Καλοπληρωτές</MenuItem>
            <MenuItem value="bad">Κακοπληρωτές</MenuItem>
            <MenuItem value="settled">Εξοφλημένοι</MenuItem>
          </SearchableTextField>
          <SearchableTextField select size="small" label="Περίοδος οφειλής" value={paymentWindow}
            onChange={(e) => setPaymentWindow(e.target.value as PaymentWindow)} sx={{ minWidth: 145, width: "100%", flex: "1 1 145px" }}>
            <MenuItem value="all">Όλο το ιστορικό</MenuItem>
            <MenuItem value="last7">Τελευταίες 7 ημέρες</MenuItem>
            <MenuItem value="last30">Τελευταίες 30 ημέρες</MenuItem>
            <MenuItem value="previousWeek">Προηγούμενη εβδομάδα</MenuItem>
            <MenuItem value="previousMonth">Προηγούμενος μήνας</MenuItem>
            <MenuItem value="thisMonth">Τρέχων μήνας</MenuItem>
            <MenuItem value="custom">Δική μου περίοδος</MenuItem>
          </SearchableTextField>
          {paymentWindow === "custom" && <>
            <TextField size="small" type="date" label="Από" value={paymentFrom}
              onChange={(e) => setPaymentFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="Έως" value={paymentTo}
              onChange={(e) => setPaymentTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </>}
          <Button size="small" variant="contained" color="error" startIcon={<FilterAltOffIcon />}
            onClick={clearFilters} sx={{ minWidth: "auto", px: 1, whiteSpace: "nowrap", color: "common.white" }}>
            Καθαρισμός φίλτρων
          </Button>
        </Stack>
      </ResponsiveFilterPanel>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TableToolbar<CustomerListRow>
          query={table.query} onQuery={table.setQuery}
          count={financeFilteredCustomers.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`customers-${new Date().toISOString().slice(0, 10)}`}
          exportColumns={[
            { key: "customerNumber", label: "Αρ. Πελάτη" },
            { key: "type", label: "Τύπος" },
            { key: "firstName", label: "Όνομα" },
            { key: "lastName", label: "Επώνυμο" },
            { key: "companyName", label: "Επωνυμία" },
            { key: "vatNumber", label: "ΑΦΜ" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Τηλέφωνο" },
            { key: "city", label: "Πόλη" },
            { key: "balance", label: "Υπόλοιπο", map: (r) => r.account?.balance ?? null },
            { key: "paymentStatus", label: "Συμπεριφορά πληρωμών", map: (r) => paymentStatus(r.account) },
            { key: "overdueAmount", label: "Ληξιπρόθεσμα", map: (r) => r.account?.overdueAmount ?? null },
            { key: "onTimeRatePercent", label: "Έγκαιρες πληρωμές %", map: (r) => r.account?.onTimeRatePercent ?? null },
            { key: "lastPaymentDate", label: "Τελευταία πληρωμή", map: (r) => r.account?.lastPaymentDate ?? null }
          ]}
        />
      </Box>
      {customersQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card data-tour="customers-table">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {customerCols.visibleColumns.map(c => (
                    <TableCell
                      key={c.key}
                      onContextMenu={(e) => headerMenu.open(e, {
                        key: c.key, label: c.label, type: inferColumnType(c.key), canHide: !c.alwaysVisible,
                      })}
                      sx={{ userSelect: "none" }}
                    >
                      {c.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" padding="checkbox">
                    <ColumnPreferencesButton
                      orderedColumns={customerCols.orderedColumns}
                      hiddenSet={customerCols.hiddenSet}
                      toggleVisibility={customerCols.toggleVisibility}
                      moveColumn={customerCols.moveColumn}
                      reset={customerCols.reset}
                    />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={c.status === "Prospect" ? {
                      cursor: "pointer",
                      bgcolor: "rgba(245, 158, 11, 0.12)",
                      "&:hover": { bgcolor: "rgba(245, 158, 11, 0.20)" }
                    } : { cursor: "pointer" }}
                    onClick={() => { window.location.href = `/app/customers/${c.id}`; }}
                    onContextMenu={(e) => rowMenu.open(e, c)}
                  >
                    {customerCols.visibleColumns.map(col => {
                      switch (col.key) {
                        case "number":
                          return <TableCell key={col.key}><Chip label={c.customerNumber} size="small" variant="outlined" /></TableCell>;
                        case "type":
                          return <TableCell key={col.key}>{c.type === "Individual" ? t("customers.individual") : t("customers.company")}</TableCell>;
                        case "name":
                          return (
                            <TableCell key={col.key}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography fontWeight={600}>
                                  {c.type === "Individual"
                                    ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                                    : c.companyName}
                                </Typography>
                                {c.status === "Prospect" && <Chip label="Πιθανός πελάτης" size="small" color="warning" />}
                                {c.account?.isPaymentOverdue && <Chip label="Ληξιπρόθεσμη εξόφληση" size="small" color="error" />}
                              </Stack>
                              {c.vatNumber && (
                                <Typography variant="caption" color="text.secondary">
                                  ΑΦΜ: {c.vatNumber}
                                </Typography>
                              )}
                            </TableCell>
                          );
                        case "email":
                          return <TableCell key={col.key}>{c.email ?? "-"}</TableCell>;
                        case "phone":
                          return <TableCell key={col.key}>{c.phone ?? "-"}</TableCell>;
                        case "city":
                          return <TableCell key={col.key}>{c.city ?? "-"}</TableCell>;
                        case "notes":
                          return <TableCell key={col.key} sx={{ maxWidth: 260 }}>{c.notes ? <Typography variant="body2" noWrap title={c.notes}>{c.notes}</Typography> : "-"}</TableCell>;
                        case "balance": {
                          const balance = c.account?.balance;
                          return <TableCell key={col.key} align="right" sx={{ color: balance === undefined ? "text.disabled" : balance > 0.005 ? "error.main" : balance < -0.005 ? "info.main" : "success.main", fontWeight: 700 }}>
                            {balance === undefined ? "—" : `${balance.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                          </TableCell>;
                        }
                        case "paymentDueDate":
                          return <TableCell key={col.key} sx={{ color: c.account?.isPaymentOverdue ? "error.main" : "text.secondary", fontWeight: c.account?.isPaymentOverdue ? 700 : 400 }}>
                            {c.account?.paymentDueDate ?? c.paymentDueDate ?? "—"}
                          </TableCell>;
                        case "paymentStatus":
                          return <TableCell key={col.key}><Chip size="small" variant="outlined" color={c.account ? (c.account.balance > 0.005 ? "error" : c.account.balance < -0.005 ? "info" : "success") : "default"} label={paymentStatus(c.account)} /></TableCell>;
                        default: return <TableCell key={col.key}>—</TableCell>;
                      }
                    })}
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Επεξεργασία">
                        <IconButton size="small"
                          onClick={() => { setError(null); setEditingCustomer(c); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Διαγραφή">
                        <IconButton size="small" color="error"
                          onClick={() => {
                            const label = c.type === "Individual"
                              ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
                              : c.companyName || c.customerNumber;
                            if (confirm(`Διαγραφή πελάτη «${label}»;\n\nΘα αποτύχει αν έχει συμβόλαια ή αποδείξεις.`)) del.mutate(c.id);
                          }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={customerCols.visibleColumns.length + 1}>
                      <Typography color="text.secondary" textAlign="center" py={4}>
                        {t("customers.noCustomers")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage}
              totalRows={table.filtered.length} pageSize={table.pageSize} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      <CreateCustomerDialog
        open={createStatus !== null}
        initialStatus={createStatus ?? "Active"}
        onClose={() => setCreateStatus(null)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />
      <CreateCustomerDialog
        open={!!editingCustomer}
        initialStatus={editingCustomer?.status ?? "Active"}
        initialCustomer={editingCustomer}
        onClose={() => setEditingCustomer(null)}
        onSubmit={(b) => editingCustomer && updateMutation.mutate({ id: editingCustomer.id, body: b })}
        submitting={updateMutation.isPending}
      />
      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Μαζική εισαγωγή πελατών"
        description="Κατεβάστε το πρότυπο, συμπληρώστε πελάτες ή πιθανούς πελάτες και ανεβάστε το αρχείο. Η στήλη status ορίζει Prospect ή Active."
        columns={[...CUSTOMER_IMPORT_COLUMNS]}
        onImport={importCustomers}
      />

    </Box>
  );
}

function CreateCustomerDialog({
  open,
  initialStatus,
  initialCustomer,
  onClose,
  onSubmit,
  submitting
}: {
  open: boolean;
  initialStatus: CustomerStatus;
  initialCustomer?: CustomerDto | null;
  onClose: () => void;
  onSubmit: (b: CreateBody) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateBody>(() => newCustomerForm(initialStatus));
  const [formTab, setFormTab] = useState(0);
  useEffect(() => {
    if (open) {
      setFormTab(0);
      setForm(initialCustomer ? {
        type: initialCustomer.type, status: initialCustomer.status,
        firstName: initialCustomer.firstName ?? "", lastName: initialCustomer.lastName ?? "",
        companyName: initialCustomer.companyName ?? "", vatNumber: initialCustomer.vatNumber ?? "",
        email: initialCustomer.email ?? "", phone: initialCustomer.phone ?? "", address: initialCustomer.address ?? "",
        city: initialCustomer.city ?? "", postalCode: initialCustomer.postalCode ?? "", occupation: initialCustomer.occupation ?? "",
        notes: initialCustomer.notes ?? "", paymentDueDate: initialCustomer.paymentDueDate ?? "", birthDate: initialCustomer.birthDate ?? "",
        fatherName: initialCustomer.fatherName ?? "", motherName: initialCustomer.motherName ?? "", spouseName: initialCustomer.spouseName ?? "",
        nationality: initialCustomer.nationality ?? "", zone: initialCustomer.zone ?? "", activityCode: initialCustomer.activityCode ?? "",
        taxOffice: initialCustomer.taxOffice ?? "", gemiNumber: initialCustomer.gemiNumber ?? "", legalForm: initialCustomer.legalForm ?? "",
        altPhone: initialCustomer.altPhone ?? "", mobilePhone: initialCustomer.mobilePhone ?? "", amka: initialCustomer.amka ?? "",
        idNumber: initialCustomer.idNumber ?? "", passportNumber: initialCustomer.passportNumber ?? "", region: initialCustomer.region ?? "",
        gender: initialCustomer.gender ?? "", maritalStatus: initialCustomer.maritalStatus ?? "", employer: initialCustomer.employer ?? "",
        driverLicenseNumber: initialCustomer.driverLicenseNumber ?? "", driverLicenseClass: initialCustomer.driverLicenseClass ?? "",
        driverLicenseIssueDate: initialCustomer.driverLicenseIssueDate ?? "", driverLicenseExpiryDate: initialCustomer.driverLicenseExpiryDate ?? "",
        source: initialCustomer.source ?? "", tagsJson: initialCustomer.tagsJson ?? "", photoUrl: initialCustomer.photoUrl ?? ""
      } : newCustomerForm(initialStatus));
    }
  }, [open, initialStatus, initialCustomer]);

  const handleSubmit = () => {
    const payload: CreateBody = {
      ...form,
      firstName: form.type === "Individual" ? form.firstName : undefined,
      lastName: form.type === "Individual" ? form.lastName : undefined,
      companyName: form.type === "Company" ? form.companyName : undefined,
      vatNumber: form.type === "Company" ? form.vatNumber : undefined,
      paymentDueDate: form.paymentDueDate || undefined,
      birthDate: form.birthDate || undefined,
      fatherName: form.fatherName || undefined, motherName: form.motherName || undefined, spouseName: form.spouseName || undefined,
      nationality: form.nationality || undefined, zone: form.zone || undefined, activityCode: form.activityCode || undefined,
      taxOffice: form.taxOffice || undefined, gemiNumber: form.gemiNumber || undefined, legalForm: form.legalForm || undefined,
      altPhone: form.altPhone || undefined, mobilePhone: form.mobilePhone || undefined, amka: form.amka || undefined,
      idNumber: form.idNumber || undefined, passportNumber: form.passportNumber || undefined, region: form.region || undefined,
      gender: form.gender || undefined, maritalStatus: form.maritalStatus || undefined, employer: form.employer || undefined,
      driverLicenseNumber: form.driverLicenseNumber || undefined, driverLicenseClass: form.driverLicenseClass || undefined,
      driverLicenseIssueDate: form.driverLicenseIssueDate || undefined, driverLicenseExpiryDate: form.driverLicenseExpiryDate || undefined,
      source: form.source || undefined, tagsJson: form.tagsJson || undefined, photoUrl: form.photoUrl || undefined
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ py: 1.25 }}>{t("customers.createTitle")}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 } }}>
        <Typography color="text.secondary" mb={1} variant="body2">
          {t("customers.createHelp")}
        </Typography>
        <Tabs value={formTab} onChange={(_, value) => setFormTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: "divider", mb: 1, minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0.5, px: 1 } }}>
          <Tab label="Βασικά & επικοινωνία" />
          <Tab label="Ταυτότητα & οικογένεια" />
          <Tab label="Επιχείρηση & οδήγηση" />
        </Tabs>
        <Stack spacing={1} mt={0.5}>
          <Box sx={{ display: formTab === 0 ? "block" : "none" }}>
          <SearchableTextField
            select
            label={t("customers.type")}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}
            fullWidth
            textFieldProps={{
              InputProps: {
                startAdornment: <InputAdornment position="start"><CategoryOutlinedIcon fontSize="small" /></InputAdornment>,
              },
            }}
          >
            <MenuItem value="Individual">{t("customers.individual")}</MenuItem>
            <MenuItem value="Company">{t("customers.company")}</MenuItem>
          </SearchableTextField>

          <FormControlLabel
            control={<Switch checked={form.status === "Prospect"} onChange={(e) => setForm({
              ...form,
              status: e.target.checked ? "Prospect" : "Active"
            })} />}
            label="Πιθανός πελάτης"
          />
          {form.status === "Prospect" && (
            <Alert severity="info">Θα εμφανίζεται με ειδική επισήμανση στις λίστες.</Alert>
          )}

          {form.type === "Individual" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("customers.firstName")}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><PersonOutlineIcon fontSize="small" /></InputAdornment>,
                  endAdornment: <FilterHelp title="Όνομα πελάτη — όπως αναγράφεται στην αστυνομική ταυτότητα." />,
                }}
              />
              <TextField
                label={t("customers.lastName")}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon fontSize="small" /></InputAdornment>,
                  endAdornment: <FilterHelp title="Επώνυμο πελάτη — όπως αναγράφεται στην αστυνομική ταυτότητα." />,
                }}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("customers.companyName")}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start"><BusinessOutlinedIcon fontSize="small" /></InputAdornment>,
                  endAdornment: <FilterHelp title="Επίσημη επωνυμία επιχείρησης όπως εμφανίζεται στα ΓΕΜΗ / τιμολόγια." />,
                }}
              />
              <TextField
                label={t("customers.vatNumber")}
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                fullWidth
                required={form.status !== "Prospect"}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon fontSize="small" /></InputAdornment>,
                  endAdornment: <FilterHelp title="ΑΦΜ επιχείρησης (9 ψηφία). Χρησιμοποιείται σε τιμολόγηση και έλεγχο διπλοεγγραφών." />,
                }}
              />
            </Stack>
          )}

          <TextField
            label={form.type === "Company" ? "Κλάδος / δραστηριότητα" : "Επάγγελμα"}
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            fullWidth
            placeholder={form.type === "Company" ? "π.χ. Εστίαση, ξενοδοχείο, εμπόριο" : "π.χ. Ελεύθερος επαγγελματίας"}
            InputProps={{
              startAdornment: <InputAdornment position="start"><WorkOutlineIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title={form.type === "Company" ? "Κλάδος δραστηριότητας — βοηθά σε ανάλυση χαρτοφυλακίου ανά τομέα." : "Επάγγελμα πελάτη — αξιοποιείται σε cross-sell προτάσεις."} />,
            }}
          />

          <TextField
            label={t("customers.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><EmailOutlinedIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Email πελάτη. Χρησιμοποιείται για αποστολή συμβολαίων, ανανεώσεων και άλλων ειδοποιήσεων." />,
            }}
          />
          <TextField
            label={t("customers.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><PhoneOutlinedIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Τηλέφωνο επικοινωνίας. Χρησιμοποιείται σε SMS ειδοποιήσεις και CRM δραστηριότητες." />,
            }}
          />

          <TextField
            label={t("customers.address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><HomeOutlinedIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Διεύθυνση αλληλογραφίας — οδός και αριθμός." />,
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("customers.city")}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><LocationCityIcon fontSize="small" /></InputAdornment>,
                endAdornment: <FilterHelp title="Πόλη κατοικίας/έδρας. Χρησιμοποιείται σε φίλτρα και reports ανά περιοχή." />,
              }}
            />
            <TextField
              label={t("customers.postalCode")}
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><MarkunreadMailboxOutlinedIcon fontSize="small" /></InputAdornment>,
                endAdornment: <FilterHelp title="Ταχυδρομικός Κώδικας (5 ψηφία)." />,
              }}
            />
          </Stack>

          <TextField
            label={t("customers.notes")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
            InputProps={{
              startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" /></InputAdornment>,
              endAdornment: <FilterHelp title="Προαιρετικά εσωτερικά σχόλια για τον πελάτη — προτιμήσεις, ιστορικό, ειδικές συμφωνίες." />,
            }}
          />

          <TextField
            label="Ημερομηνία εξόφλησης"
            type="date"
            value={form.paymentDueDate ?? ""}
            onChange={(e) => setForm({ ...form, paymentDueDate: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Αν υπάρχει υπόλοιπο μετά την ημερομηνία, εμφανίζεται κόκκινη ειδοποίηση στο dashboard. Αφήστε κενό για απενεργοποίηση."
          />
          </Box>

          <Box sx={{ display: formTab === 1 ? "block" : "none" }}>
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Ημερομηνία γέννησης" type="date" value={form.birthDate ?? ""} onChange={e => setForm({ ...form, birthDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField select label="Φύλο" value={form.gender ?? ""} onChange={e => setForm({ ...form, gender: e.target.value })} fullWidth>
                  <MenuItem value="">Δεν έχει οριστεί</MenuItem><MenuItem value="Male">Άνδρας</MenuItem><MenuItem value="Female">Γυναίκα</MenuItem><MenuItem value="Other">Άλλο</MenuItem>
                </TextField>
                <TextField label="Εθνικότητα" value={form.nationality ?? ""} onChange={e => setForm({ ...form, nationality: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Πατρώνυμο" value={form.fatherName ?? ""} onChange={e => setForm({ ...form, fatherName: e.target.value })} fullWidth />
                <TextField label="Μητρώνυμο" value={form.motherName ?? ""} onChange={e => setForm({ ...form, motherName: e.target.value })} fullWidth />
                <TextField label="Σύζυγος / σύντροφος" value={form.spouseName ?? ""} onChange={e => setForm({ ...form, spouseName: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Αριθμός ταυτότητας" value={form.idNumber ?? ""} onChange={e => setForm({ ...form, idNumber: e.target.value })} fullWidth />
                <TextField label="ΑΜΚΑ" value={form.amka ?? ""} onChange={e => setForm({ ...form, amka: e.target.value })} fullWidth />
                <TextField label="Αριθμός διαβατηρίου" value={form.passportNumber ?? ""} onChange={e => setForm({ ...form, passportNumber: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="2ο τηλέφωνο" value={form.altPhone ?? ""} onChange={e => setForm({ ...form, altPhone: e.target.value })} fullWidth />
                <TextField label="Κινητό" value={form.mobilePhone ?? ""} onChange={e => setForm({ ...form, mobilePhone: e.target.value })} fullWidth />
                <TextField label="Οικογενειακή κατάσταση" value={form.maritalStatus ?? ""} onChange={e => setForm({ ...form, maritalStatus: e.target.value })} fullWidth />
              </Stack>
              <TextField label="Περιφέρεια / περιοχή" value={form.region ?? ""} onChange={e => setForm({ ...form, region: e.target.value })} fullWidth />
            </Stack>
          </Box>

          <Box sx={{ display: formTab === 2 ? "block" : "none" }}>
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Εργοδότης" value={form.employer ?? ""} onChange={e => setForm({ ...form, employer: e.target.value })} fullWidth />
                <TextField label="Κωδικός δραστηριότητας" value={form.activityCode ?? ""} onChange={e => setForm({ ...form, activityCode: e.target.value })} fullWidth />
                <TextField label="Ζώνη / περιοχή δραστηριότητας" value={form.zone ?? ""} onChange={e => setForm({ ...form, zone: e.target.value })} fullWidth />
              </Stack>
              {form.type === "Company" && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="ΔΟΥ" value={form.taxOffice ?? ""} onChange={e => setForm({ ...form, taxOffice: e.target.value })} fullWidth />
                <TextField label="Αριθμός ΓΕΜΗ" value={form.gemiNumber ?? ""} onChange={e => setForm({ ...form, gemiNumber: e.target.value })} fullWidth />
                <TextField label="Νομική μορφή" value={form.legalForm ?? ""} onChange={e => setForm({ ...form, legalForm: e.target.value })} fullWidth />
              </Stack>}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Αριθμός διπλώματος" value={form.driverLicenseNumber ?? ""} onChange={e => setForm({ ...form, driverLicenseNumber: e.target.value })} fullWidth />
                <TextField label="Κατηγορία διπλώματος" value={form.driverLicenseClass ?? ""} onChange={e => setForm({ ...form, driverLicenseClass: e.target.value })} fullWidth />
                <TextField label="Έκδοση διπλώματος" type="date" value={form.driverLicenseIssueDate ?? ""} onChange={e => setForm({ ...form, driverLicenseIssueDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Λήξη διπλώματος" type="date" value={form.driverLicenseExpiryDate ?? ""} onChange={e => setForm({ ...form, driverLicenseExpiryDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Πηγή πελάτη" value={form.source ?? ""} onChange={e => setForm({ ...form, source: e.target.value })} fullWidth placeholder="π.χ. σύσταση, website, καμπάνια" />
                <TextField label="Ετικέτες" value={form.tagsJson ?? ""} onChange={e => setForm({ ...form, tagsJson: e.target.value })} fullWidth placeholder="π.χ. premium, εταιρεία" />
                <TextField label="URL φωτογραφίας" value={form.photoUrl ?? ""} onChange={e => setForm({ ...form, photoUrl: e.target.value })} fullWidth />
              </Stack>
              <Alert severity="info">Τα οχήματα και τα ασφαλιστήρια προστίθενται από τα συμβόλαια και θα εμφανίζονται αυτόματα στην καρτέλα «Οχήματα».</Alert>
            </Stack>
          </Box>

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} variant="contained"
          disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
