import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { CustomerDetailPage } from "./CustomerDetailPage";
import { FilterHelp } from "../components/FilterHelp";
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
  Divider,
  FormControlLabel,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { IconButton, Tooltip } from "@mui/material";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
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
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useTableState } from "../components/useTableState";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { TableToolbar, NumberedPager, RecordCountChip } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { SearchableTextField } from "../components/SearchableTextField";
import { BulkImportDialog, type BulkImportResult } from "../components/BulkImportDialog";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { customerDraftErrors, customerFieldError } from "../components/customer/customerValidation";
import { CustomerDesktopFiltersDialog, CustomerMultiSelect, type CustomerFilterOption } from "../components/customer/CustomerDesktopFilters";
import { activeCustomerFilterCount, customerMatchesFilters, EMPTY_CUSTOMER_LIST_FILTERS, type CustomerListFilters } from "./customerListFilters";

type CustomerType = "Individual" | "Company";
type CustomerStatus = "Prospect" | "Active" | "Inactive" | "Churned" | "Blocked";
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
  hasPortalAccount?: boolean;
  updatedAt?: string | null;
  childrenCount?: number;
  hasPolicy?: boolean;
  hasGdprConsent?: boolean;
  hasMarketingConsent?: boolean;
  hasCommunicationConsent?: boolean;
  hasNeedsForm?: boolean;
  producerIds?: string[];
  producerNames?: string[];
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
  { key: "type", label: "Τύπος πελάτη", required: true, example: "Φυσικό πρόσωπο" },
  { key: "status", label: "Κατάσταση", required: true, example: "Ενεργός" },
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
  const [filters, setFilters] = useState<CustomerListFilters>(() => ({ ...EMPTY_CUSTOMER_LIST_FILTERS }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<CustomerStatus | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<{ id: string; label: string; customer: CustomerDto } | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [toolbarAction, setToolbarAction] = useState<{ token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" }>({ token: 0, action: "csv" });
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", "desktop-parity-filter-list"],
    queryFn: async () =>
      (await api.get<CustomerDto[]>("/customers", { params: {
        limit: 5000
      } })).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => (await api.post<{ customer: CustomerDto }>("/customers", body)).data,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setCreateStatus(null);
      setError(null);
      if (result.customer?.id) {
        const label = result.customer.type === "Company"
          ? result.customer.companyName || result.customer.customerNumber
          : `${result.customer.firstName ?? ""} ${result.customer.lastName ?? ""}`.trim() || result.customer.customerNumber;
        setCreatedCustomer({ id: result.customer.id, label, customer: result.customer });
      }
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const accountsQuery = useQuery({
    queryKey: ["customer-accounts", "all-time"],
    retry: false,
    queryFn: async () => (await api.get<CustomerAccountSummary[]>("/customers/accounts", { params: {
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
        const normalizedType = (row.type ?? "").trim().toLowerCase();
        const type: CustomerType = ["company", "εταιρεία", "εταιρεια", "νομικό πρόσωπο", "νομικο προσωπο"].includes(normalizedType) ? "Company" : "Individual";
        const normalizedStatus = (row.status ?? "").trim().toLowerCase();
        const status: CustomerStatus = ["prospect", "πιθανός πελάτης", "πιθανος πελατης"].includes(normalizedStatus) ? "Prospect" : "Active";
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
  const filteredCustomers = useMemo(() => allCustomers.filter(customer => customerMatchesFilters(customer, filters)), [allCustomers, filters]);
  const cityOptions = useMemo<CustomerFilterOption[]>(() => Array.from(new Set(allCustomers
    .map(customer => customer.city?.trim()).filter((city): city is string => Boolean(city))))
    .sort((a, b) => a.localeCompare(b, "el")).map(city => ({ value: city, label: city })), [allCustomers]);
  const producerOptions = useMemo<CustomerFilterOption[]>(() => {
    const options = new Map<string, string>();
    allCustomers.forEach(customer => customer.producerIds?.forEach((id, index) => options.set(id, customer.producerNames?.[index] ?? id)));
    return Array.from(options, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "el"));
  }, [allCustomers]);
  const table = useTableState<CustomerListRow>({
    rows: filteredCustomers,
    searchableText: (c) => `${c.customerNumber} ${c.firstName ?? ""} ${c.lastName ?? ""} ${c.companyName ?? ""} ${c.vatNumber ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.city ?? ""}`,
    pageSize: 25
  });
  const customers = table.paged;
  const customerFilterCount = activeCustomerFilterCount(filters) + (search ? 1 : 0);
  const clearFilters = () => {
    setClearSavedFilterRequest(value => value + 1);
    setSearch("");
    setFilters({ ...EMPTY_CUSTOMER_LIST_FILTERS });
    table.setQuery("");
    table.setPage(1);
  };
  const savedCustomerFilters = { search, ...filters };
  const loadSavedCustomerFilters = (saved: Partial<typeof savedCustomerFilters>) => {
    const next = { ...EMPTY_CUSTOMER_LIST_FILTERS } as CustomerListFilters;
    (Object.keys(next) as (keyof CustomerListFilters)[]).forEach(key => {
      const value = saved[key];
      if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value;
    });
    setSearch(saved.search ?? "");
    // Retired consent controls must not become invisible criteria from older saved filters.
    next.communication = []; next.gdpr = []; next.marketing = []; next.portal = []; next.needsForm = [];
    setFilters(next);
    table.setQuery(saved.search ?? "");
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
  // The API is authoritative: an empty mistaken record can be deleted, while
  // every customer with operational/history links returns an actionable 409.
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
      if (confirm(`Διαγραφή πελάτη «${label}»;\n\nΗ διαγραφή επιτρέπεται μόνο αν δεν υπάρχει συνδεδεμένο ιστορικό ή άλλη διασύνδεση.`)) del.mutate(c.id);
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={{ xs: 1.5, md: 3 }} gap={1.25} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4" sx={{ fontSize: { xs: "1.55rem", sm: "2rem" }, fontWeight: 800 }}>{t("customers.title")}</Typography>
          <HelpHint id="page.customers" />
          <RecordCountChip count={table.filtered.length} />
        </Stack>
        <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap" sx={{ width: { xs: "100%", sm: "auto" }, alignItems: "center" }}>
        <SavedReportsButton entity="customers" currentFilters={savedCustomerFilters} onLoad={loadSavedCustomerFilters}
          onClear={clearFilters} clearRequestToken={clearSavedFilterRequest}
          saveRequestToken={saveFilterRequest} showSaveMenuItem={false} />
        <Button variant={activeCustomerFilterCount(filters) > 0 ? "contained" : "outlined"} startIcon={<FilterListIcon />}
          onClick={() => setFiltersOpen(true)} sx={{ minHeight: 40, whiteSpace: "nowrap" }}>
          Περισσότερα{activeCustomerFilterCount(filters) > 0 ? ` (${activeCustomerFilterCount(filters)})` : ""}
        </Button>
        <Button data-tour="customers-actions" variant="contained" size="large"
          startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
          onClick={event => setActionsAnchor(event.currentTarget)} aria-haspopup="menu"
          aria-expanded={Boolean(actionsAnchor)} sx={{ minWidth: 142, whiteSpace: "nowrap", flexGrow: { xs: 1, sm: 0 } }}>
          Ενέργειες
        </Button>
        </Stack>
        <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 285, maxWidth: "calc(100vw - 24px)" } } }}>
          <MenuItem data-tour="customers-new" onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Active"); }}
            sx={{ color: "#0877c9", "&:hover": { bgcolor: "#e7f2fd", color: "#075fa0" } }}>
            <ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={t("customers.create")} secondary="Κανονικός ενεργός πελάτης" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Prospect"); }}
            sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df", color: "#814700" } }}>
            <ListItemIcon sx={{ color: "#a45b00" }}><PersonAddAltOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Πιθανός πελάτης" secondary="Καταχώρηση υποψήφιου πελάτη" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setActionsAnchor(null); setImportOpen(true); }}
            sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec", color: "#116337" } }}>
            <ListItemIcon sx={{ color: "#167c45" }}><TableViewOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Εισαγωγή Excel" secondary="Μαζική εισαγωγή πελατών" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }}
            sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb", color: "#474184" } }}>
            <ListItemIcon sx={{ color: "#5b55a5" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Αποθήκευση νέου φίλτρου" secondary="Προσθήκη στα αποθηκευμένα φίλτρα" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "csv" })); }}
            sx={{ color: "#087f73", "&:hover": { bgcolor: "#e5f6f3", color: "#06675e" } }}>
            <ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "xlsx" })); }}
            sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec", color: "#116337" } }}>
            <ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή Excel" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "pdf" })); }}
            sx={{ color: "#c73545", "&:hover": { bgcolor: "#fdecef", color: "#a72836" } }}>
            <ListItemIcon sx={{ color: "#c73545" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή PDF" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "print" })); }}
            sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7", color: "#345573" } }}>
            <ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "columns" })); }}
            sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb", color: "#474184" } }}>
            <ListItemIcon sx={{ color: "#5b55a5" }}><ViewColumnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στήλες εξαγωγής" />
          </MenuItem>
          <MenuItem onClick={() => { setActionsAnchor(null); setFiltersOpen(true); }}
            sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df", color: "#814700" } }}>
            <ListItemIcon sx={{ color: "#a45b00" }}><FilterListIcon fontSize="small" /></ListItemIcon><ListItemText primary="Φίλτρα πελατών" />
          </MenuItem>
        </Menu>
      </Stack>

      <Card variant="outlined" sx={{ mb: { xs: 1.25, md: 2 }, p: { xs: 1, sm: 1.25 }, bgcolor: "#EDF2F7", borderColor: "#C8D5E4", overflow: "visible" }}>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(180px, 2fr) repeat(3, minmax(110px, 1fr)) auto" },
          gap: { xs: 0.75, md: 1 }, alignItems: "center", minWidth: 0,
        }}>
          <TextField size="small" label="Αναζήτηση πελατών" value={search}
            onChange={(e) => { setSearch(e.target.value); table.setQuery(e.target.value); table.setPage(1); }}
            placeholder="Όνομα, ΑΦΜ, email, τηλέφωνο, κωδικός ή πόλη"
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 0, width: "100%", "& .MuiInputBase-input": { minWidth: 0 } }} />

          {customerFilterCount > 0 && <Box sx={{ display: { xs: "flex", lg: "none" }, gap: 0.75, flexWrap: "wrap", minWidth: 0 }}>
            <Button size="small" variant="contained" color="error" startIcon={<FilterAltOffIcon />}
              onClick={clearFilters} sx={{ minHeight: 40, flex: "1 1 150px", whiteSpace: "nowrap", color: "common.white" }}>
              Καθαρισμός
            </Button>
          </Box>}

          <Box sx={{ display: { xs: "none", lg: "contents" } }}>
            <CustomerMultiSelect label="Είδος" values={filters.types} options={[
              { value: "Individual", label: "Φυσικά πρόσωπα" }, { value: "Company", label: "Νομικά πρόσωπα" }, { value: "Prospect", label: "Πιθανοί πελάτες" },
            ]} onChange={types => { setFilters({ ...filters, types: types as CustomerListFilters["types"] }); table.setPage(1); }} minWidth={115} />
            <CustomerMultiSelect label="Πόλη" values={filters.cities} options={cityOptions}
              onChange={cities => { setFilters({ ...filters, cities }); table.setPage(1); }} minWidth={115} />
            <CustomerMultiSelect label="Συνεργάτης" values={filters.producerIds} options={producerOptions}
              onChange={producerIds => { setFilters({ ...filters, producerIds }); table.setPage(1); }} minWidth={130} />
            {customerFilterCount > 0 ? <Button size="small" variant="contained" color="error" startIcon={<FilterAltOffIcon />}
              onClick={clearFilters} sx={{ minHeight: 40, whiteSpace: "nowrap", color: "common.white" }}>
              Καθαρισμός
            </Button> : <Box />}
          </Box>
        </Box>
      </Card>

      <CustomerDesktopFiltersDialog open={filtersOpen} filters={filters} cities={cityOptions} producers={producerOptions}
        activeCount={activeCustomerFilterCount(filters)}
        onChange={next => { setFilters(next); table.setPage(1); }} onClear={clearFilters} onClose={() => setFiltersOpen(false)} />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {createdCustomer && (
        <Alert
          severity="success"
          onClose={() => setCreatedCustomer(null)}
          sx={{ mb: 2, alignItems: "center" }}
          action={
            <Button onClick={() => setSelectedCustomer(createdCustomer.customer)} color="inherit" size="small">
              Άνοιγμα καρτέλας
            </Button>
          }
        >
          Ο πελάτης «{createdCustomer.label}» δημιουργήθηκε και εμφανίζεται στη λίστα.
        </Alert>
      )}

      <Box sx={{ mb: 0 }}>
        <TableToolbar<CustomerListRow>
          query={search} onQuery={(value) => { setSearch(value); table.setQuery(value); }}
          hideSearch
          hideCount
          hidePageSize
          count={filteredCustomers.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          snapshotExport
          columnSelectionId="customers"
          printTitle="Λίστα πελατών"
          printSubtitle={[
            search.trim() ? `Αναζήτηση: ${search.trim()}` : null,
            filters.cities.length ? `Πόλη: ${filters.cities.join(", ")}` : null,
            filters.producerIds.length ? `Συνεργάτης: ${producerOptions.filter(option => filters.producerIds.includes(option.value)).map(option => option.label).join(", ")}` : null,
            customerFilterCount ? `${customerFilterCount} ενεργά φίλτρα` : null,
          ].filter(Boolean).join(" · ")}
          exportFileName={`customers-${new Date().toISOString().slice(0, 10)}`}
          exportColumns={[
            { key: "number", label: "Αρ. Πελάτη", map: (r) => r.customerNumber },
            { key: "type", label: "Τύπος", map: (r) => r.type === "Company" ? t("customers.company") : t("customers.individual") },
            { key: "name", label: "Ονοματεπώνυμο / Επωνυμία", map: (r) => r.type === "Company" ? r.companyName : `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() },
            { key: "email", label: "Email" },
            { key: "phone", label: "Τηλέφωνο" },
            { key: "notes", label: "Σημειώσεις" },
            { key: "balance", label: "Υπόλοιπο / πληρωμές", map: (r) => r.account ? `${r.account.balance.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—" },
            { key: "paymentStatus", label: "Συμπεριφορά πληρωμών", map: (r) => paymentStatus(r.account) },
            { key: "city", label: "Πόλη" }
          ]}
          visibleColumnKeys={customerCols.visibleColumns.map(c => c.key)}
          actionRequest={toolbarAction}
          hideActionButtons
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
                      sx={c.key === "type"
                        ? { userSelect: "none", width: 150, minWidth: 150, whiteSpace: "nowrap" }
                        : { userSelect: "none" }}
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
                    onClick={() => setSelectedCustomer(c)}
                    onContextMenu={(e) => rowMenu.open(e, c)}
                  >
                    {customerCols.visibleColumns.map(col => {
                      switch (col.key) {
                        case "number":
                          return <TableCell key={col.key}><Chip label={c.customerNumber} size="small" variant="outlined" /></TableCell>;
                        case "type":
                          return (
                            <TableCell key={col.key} sx={{ width: 150, minWidth: 150, maxWidth: 170, whiteSpace: "nowrap" }}>
                              <Typography variant="body2" noWrap sx={{ fontSize: "0.78rem", lineHeight: 1.2 }}>
                                {c.type === "Individual" ? t("customers.individual") : t("customers.company")}
                              </Typography>
                            </TableCell>
                          );
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
          <Box sx={{ display: "flex", justifyContent: "center", px: 2, py: 1 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage}
              totalRows={table.filtered.length} pageSize={table.pageSize} onPageSize={table.setPageSize} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
      {selectedCustomer && <CustomerDetailPage key={selectedCustomer.id} customerId={selectedCustomer.id}
        initialCustomer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}

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
        description="Κατεβάστε το πρότυπο, συμπληρώστε πελάτες ή πιθανούς πελάτες και ανεβάστε το αρχείο. Η στήλη «Κατάσταση» ορίζει αν είναι πιθανός ή ενεργός πελάτης."
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
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [formTab, setFormTab] = useState(0);
  useEffect(() => {
    if (open) {
      setValidationMessage(null);
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
    const changed = Object.fromEntries(Object.entries(payload).filter(([field, value]) =>
      !initialCustomer || value !== (initialCustomer as unknown as Record<string, unknown>)[field]));
    const errors = customerDraftErrors(changed);
    if (errors.length) { setValidationMessage(errors.join(" ")); return; }
    setValidationMessage(null);
    onSubmit(payload);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { maxHeight: "calc(100vh - 24px)", bgcolor: "#f8fafc", border: "1px solid #d5e0ec", borderRadius: 2 } }}
    >
      <DialogTitle sx={{ py: 1.25 }}>{initialCustomer ? "Επεξεργασία πελάτη" : t("customers.createTitle")}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 } }}>
        {validationMessage && <Alert severity="error" sx={{ mb: 1 }}>{validationMessage}</Alert>}
        {!initialCustomer ? (
          <Stack spacing={1.25}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Συμπληρώστε τα βασικά στοιχεία. Μετά τη δημιουργία ο πελάτης εμφανίζεται στη λίστα και μπορείτε να ανοίξετε την πλήρη καρτέλα για όλα τα στοιχεία, οχήματα και έγγραφα.
            </Alert>
            <SearchableTextField
              select
              label={t("customers.type")}
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as CustomerType })}
              fullWidth
              textFieldProps={{ InputProps: { startAdornment: <InputAdornment position="start"><CategoryOutlinedIcon fontSize="small" /></InputAdornment> } }}
            >
              <MenuItem value="Individual">{t("customers.individual")}</MenuItem>
              <MenuItem value="Company">{t("customers.company")}</MenuItem>
            </SearchableTextField>
            <FormControlLabel
              control={<Switch checked={form.status === "Prospect"} onChange={e => setForm({ ...form, status: e.target.checked ? "Prospect" : "Active" })} />}
              label={form.status === "Prospect" ? "Πιθανός πελάτης" : "Κανονικός πελάτης"}
            />
            {form.type === "Individual" ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField required fullWidth label={t("customers.firstName")} value={form.firstName ?? ""} onChange={e => setForm({ ...form, firstName: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutlineIcon fontSize="small" /></InputAdornment> }} />
                <TextField required fullWidth label={t("customers.lastName")} value={form.lastName ?? ""} onChange={e => setForm({ ...form, lastName: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon fontSize="small" /></InputAdornment> }} />
              </Stack>
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField required fullWidth label={t("customers.companyName")} value={form.companyName ?? ""} onChange={e => setForm({ ...form, companyName: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><BusinessOutlinedIcon fontSize="small" /></InputAdornment> }} />
                <TextField fullWidth label={t("customers.vatNumber")} value={form.vatNumber ?? ""} onChange={e => setForm({ ...form, vatNumber: e.target.value })} inputProps={{ maxLength: 9, inputMode: "numeric" }} error={!!customerFieldError("vatNumber", form.vatNumber)} helperText={customerFieldError("vatNumber", form.vatNumber)} InputProps={{ startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon fontSize="small" /></InputAdornment> }} />
              </Stack>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField fullWidth type="email" label={t("customers.email")} value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} inputProps={{ maxLength: 254 }} error={!!customerFieldError("email", form.email)} helperText={customerFieldError("email", form.email)} InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon fontSize="small" /></InputAdornment> }} />
              <TextField fullWidth type="tel" label={t("customers.phone")} value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} inputProps={{ maxLength: 40 }} error={!!customerFieldError("phone", form.phone)} helperText={customerFieldError("phone", form.phone)} InputProps={{ startAdornment: <InputAdornment position="start"><PhoneOutlinedIcon fontSize="small" /></InputAdornment> }} />
              <TextField fullWidth label={t("customers.city")} value={form.city ?? ""} onChange={e => setForm({ ...form, city: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><LocationCityIcon fontSize="small" /></InputAdornment> }} />
            </Stack>
          </Stack>
        ) : (
          <>
        <Typography color="text.secondary" mb={1} variant="body2">
          {t("customers.createHelp")}
        </Typography>
        <Tabs value={formTab} onChange={(_, value) => setFormTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ display: "none" }}>
          <Tab label="Βασικά & επικοινωνία" />
          <Tab label="Ταυτότητα & οικογένεια" />
          <Tab label="Επιχείρηση & οδήγηση" />
        </Tabs>
        <Stack spacing={1} mt={0.5} sx={{
          p: { xs: 1, md: 1.5 },
          bgcolor: "#edf3f9",
          border: "1px solid #d6e3f0",
          borderRadius: 1.5,
          "& .MuiTextField-root, & .MuiFormControl-root": { bgcolor: "#fff" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#b8c9da" },
          "& .MuiTabs-root": { bgcolor: "#f8fafc", borderRadius: 1, px: 0.5 },
        }}>
          <Box sx={{ p: { xs: 1, md: 1.25 }, bgcolor: "#f8fafc", border: "1px solid #d6e3f0", borderRadius: 1.25 }}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, px: 0.75, py: 0.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "rgba(25,118,210,0.08)" }}>
            Επικοινωνία & διεύθυνση
          </Typography>
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
            <MenuItem value="Individual">Φυσικό πρόσωπο</MenuItem>
            <MenuItem value="Company">Νομικό πρόσωπο</MenuItem>
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Κινητό" value={form.mobilePhone} onChange={e => setForm({ ...form, mobilePhone: e.target.value })} fullWidth />
            <TextField label="2ο τηλέφωνο" value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value })} fullWidth />
          </Stack>
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
          <TextField label="Περιφέρεια / περιοχή" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} fullWidth />

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

          <Box sx={{ p: { xs: 1, md: 1.25 }, bgcolor: "#f8fafc", border: "1px solid #d6e3f0", borderRadius: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, px: 0.75, py: 0.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "rgba(25,118,210,0.08)" }}>
              Ταυτότητα & προσωπικά στοιχεία
            </Typography>
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
              <TextField label="Οικογενειακή κατάσταση" value={form.maritalStatus ?? ""} onChange={e => setForm({ ...form, maritalStatus: e.target.value })} fullWidth />
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 1, md: 1.25 }, bgcolor: "#f8fafc", border: "1px solid #d6e3f0", borderRadius: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, px: 0.75, py: 0.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "rgba(25,118,210,0.08)" }}>
              Εργασία & εταιρικά στοιχεία
            </Typography>
            <Stack spacing={1}>
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
                <TextField label="Πηγή πελάτη" value={form.source ?? ""} onChange={e => setForm({ ...form, source: e.target.value })} fullWidth placeholder="π.χ. σύσταση, website, καμπάνια" />
                <TextField label="Ετικέτες" value={form.tagsJson ?? ""} onChange={e => setForm({ ...form, tagsJson: e.target.value })} fullWidth placeholder="π.χ. premium, εταιρεία" />
                <TextField label="URL φωτογραφίας" value={form.photoUrl ?? ""} onChange={e => setForm({ ...form, photoUrl: e.target.value })} fullWidth />
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 1, md: 1.25 }, bgcolor: "#f8fafc", border: "1px solid #d6e3f0", borderRadius: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, px: 0.75, py: 0.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "rgba(25,118,210,0.08)" }}>
              Οδήγηση & εσωτερική πληροφόρηση
            </Typography>
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField label="Αριθμός διπλώματος" value={form.driverLicenseNumber ?? ""} onChange={e => setForm({ ...form, driverLicenseNumber: e.target.value })} fullWidth />
                <TextField label="Κατηγορία διπλώματος" value={form.driverLicenseClass ?? ""} onChange={e => setForm({ ...form, driverLicenseClass: e.target.value })} fullWidth />
                <TextField label="Έκδοση διπλώματος" type="date" value={form.driverLicenseIssueDate ?? ""} onChange={e => setForm({ ...form, driverLicenseIssueDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Λήξη διπλώματος" type="date" value={form.driverLicenseExpiryDate ?? ""} onChange={e => setForm({ ...form, driverLicenseExpiryDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
              </Stack>
              <Alert severity="info">Τα οχήματα και τα ασφαλιστήρια προστίθενται από τα συμβόλαια και θα εμφανίζονται αυτόματα στην καρτέλα «Οχήματα».</Alert>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 1, md: 1.25 }, bgcolor: "#f8fafc", border: "1px solid #d6e3f0", borderRadius: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75, px: 0.75, py: 0.5, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: "rgba(25,118,210,0.08)" }}>
              Σημειώσεις συμβούλου
            </Typography>
            <TextField
              label="Σημειώσεις"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth multiline rows={2}
              InputProps={{
                startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" /></InputAdornment>,
                endAdornment: <FilterHelp title="Προαιρετικά εσωτερικά σχόλια για τον πελάτη — προτιμήσεις, ιστορικό, ειδικές συμφωνίες." />,
              }}
            />
          </Box>

        </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="error" variant="contained" sx={{ color: "#fff", fontWeight: 700 }}>{t("common.cancel", "Άκυρο")}</Button>
        <Button onClick={handleSubmit} variant="contained"
          disabled={submitting || (!initialCustomer && (form.type === "Individual" ? !form.firstName?.trim() || !form.lastName?.trim() : !form.companyName?.trim()))}>
          {submitting ? <CircularProgress size={18} /> : initialCustomer ? "Αποθήκευση" : "Δημιουργία πελάτη"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
