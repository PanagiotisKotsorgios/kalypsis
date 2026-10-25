import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp } from "../components/FilterHelp";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useCarrierCatalogue } from "../hooks/useCarrierCatalogue";
import { useDraftPersistence } from "../hooks/useDraftPersistence";
import { useCustomerSearch } from "../hooks/useCustomerSearch";
import { InlineCreateCustomerDialog } from "../components/InlineCreateCustomerDialog";
import { InlineCreateInsuranceCompanyDialog } from "../components/InlineCreateInsuranceCompanyDialog";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import GroupsIcon from "@mui/icons-material/Groups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import TuneIcon from "@mui/icons-material/Tune";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { money, date } from "../utils/format";
import { contractDurationLabel } from "../utils/contractDuration";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { PolicyRenewalPremiumFields, renewalPremiumDefaults, renewalPremiumPayload } from "../components/PolicyRenewalPremiumFields";
import { useTableState } from "../components/useTableState";
import { TableToolbar, NumberedPager, RecordCountChip } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { PolicyDeliveryPage } from "./PolicyDeliveryPage";
import { GroupPoliciesPage } from "./GroupPoliciesPage";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useUndoable } from "../components/UndoToast";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { BulkImportDialog, type BulkImportResult } from "../components/BulkImportDialog";
import { SavedReportsButton } from "../components/SavedReportsButton";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type PolicyStatus = "Draft" | "Active" | "Expired" | "Cancelled" | "Renewed" | "PendingRenewal" | "Undelivered" | "AwaitingIssue" | "Prospect";
type PaymentRoute = "" | "direct" | "office";
type PolicyDateFilterField = "issued" | "start" | "end";

interface PolicyDto {
  id: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  producerId: string | null;
  producerName: string | null;
  policyType: PolicyType;
  status: PolicyStatus;
  paidDirectlyToCarrier: boolean;
  deliveredAt: string | null;
  startDate: string;
  endDate: string;
  issuedAt?: string | null;
  premium: number;
  vehicleRegistrationPlate?: string | null;
  netPremium?: number | null;
  specialCommissionPercent: string;
  currency: string;
  createdAt: string;
}

type PolicyConfirmationAction = {
  kind: "delete" | "cancel" | "renew";
  policy: PolicyDto;
};

// Kept for typing; the picker now uses useCustomerSearch's own CustomerLite.
// @ts-expect-error kept for backwards-compat with older imports
interface CustomerLite {
  id: string;
  customerNumber: string;
  type: "Individual" | "Company";
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

interface CarrierDto {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isBroker?: boolean;
  parentCompanyId?: string | null;
}

const STATUS_COLOR: Record<PolicyStatus, "default" | "success" | "warning" | "info" | "error"> = {
  Active: "success",
  PendingRenewal: "warning",
  Expired: "warning",
  Cancelled: "error",
  Renewed: "info",
  Draft: "default",
  // ALIS-parity — awaiting-issue reads as "in progress", undelivered as
  // "waiting on us" so the color scheme still gives operators a signal.
  AwaitingIssue: "info",
  Undelivered: "warning",
  Prospect: "warning"
};

export function policyListExportColumns(t: (key: string) => string) {
  return [
    { key: "number", label: "Αρ. Συμβολαίου", map: (row: PolicyDto) => row.policyNumber },
    { key: "type", label: "Κλάδος", map: (row: PolicyDto) => t(`policies.types.${row.policyType}`) },
    { key: "customer", label: "Πελάτης", map: (row: PolicyDto) => row.customerDisplay },
    { key: "carrier", label: "Ασφαλιστική", map: (row: PolicyDto) => row.insuranceCompanyName },
    { key: "producer", label: "Συνεργάτης", map: (row: PolicyDto) => row.producerName ?? "—" },
    { key: "dates", label: "Έναρξη → Λήξη", map: (row: PolicyDto) => `${contractDurationLabel(row.startDate, row.endDate)} · ${date(row.startDate)} → ${date(row.endDate)}` },
    { key: "premium", label: "Ασφάλιστρο", map: (row: PolicyDto) => money(row.premium, row.currency) },
    { key: "status", label: "Κατάσταση", map: (row: PolicyDto) => row.status === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${row.status}`) },
  ];
}

export function policyListRowSx(status: string, index: number) {
  return { cursor: "pointer", bgcolor: status === "Prospect" ? "#fff0d9" : index % 2 === 0 ? "#f8fafc" : "#f0f2f5",
    "&:hover": { bgcolor: status === "Prospect" ? "#ffe3b5" : "#e5edf7" },
    "&.Mui-selected": { bgcolor: "#dcebfa" }, "&.Mui-selected:hover": { bgcolor: "#c9e1f7" } };
}

const POLICY_IMPORT_COLUMNS = [
  { key: "customerId", label: "ID πελάτη", required: true, example: "00000000-0000-0000-0000-000000000000" },
  { key: "policyNumber", label: "Αριθμός συμβολαίου", example: "POL-1001" },
  { key: "insuranceCompanyId", label: "ID ασφαλιστικής", required: true, example: "00000000-0000-0000-0000-000000000000" },
  { key: "producerId", label: "ID συνεργάτη", example: "" },
  { key: "policyType", label: "Κλάδος (Auto/Home/Health/Life/Business/Travel/Other ή κωδικός γραφείου)", required: true, example: "Auto" },
  { key: "vehicleUseCategory", label: "Χρήση οχήματος", example: "Ιδιωτική χρήση" },
  { key: "vehicleRegistrationPlate", label: "Αριθμός κυκλοφορίας", example: "ΑΒC1234" },
  { key: "coverCode", label: "Κωδικός κάλυψης", example: "" },
  { key: "packageCode", label: "Κωδικός πακέτου", example: "" },
  { key: "startDate", label: "Έναρξη (YYYY-MM-DD)", required: true, example: "2026-10-01" },
  { key: "endDate", label: "Λήξη (YYYY-MM-DD)", required: true, example: "2027-10-01" },
  { key: "premium", label: "Μικτό ασφάλιστρο", required: true, example: "250.00" },
  { key: "netPremium", label: "Καθαρά ασφάλιστρα", example: "" },
  { key: "specialCommissionPercent", label: "Προμήθεια συνεργάτη (%)", example: "10" },
  { key: "currency", label: "Νόμισμα", example: "EUR" },
  { key: "status", label: "Κατάσταση", example: "Active" },
  { key: "paidDirectlyToCarrier", label: "Πληρώθηκε απευθείας στην εταιρεία (true/false)", example: "false" },
] as const;

type PolicyListLocalFilters = { carrierFilter: string; subCarrierFilter: string[]; producerFilter: string;
  dateFilterField: PolicyDateFilterField; fromDate: string; toDate: string; paymentRouteFilter: PaymentRoute; expiryWindow: string };

export function filterPolicyListRows(rawRows: PolicyDto[], allCarriers: Pick<CarrierDto, "id" | "parentCompanyId">[], filters: PolicyListLocalFilters) {
  const { carrierFilter, subCarrierFilter, producerFilter, dateFilterField, fromDate, toDate, paymentRouteFilter, expiryWindow } = filters;
  return rawRows.filter(p => {
    if (carrierFilter) {
      if (subCarrierFilter.length > 0) {
        // Sub picks narrow strictly to those subs.
        if (!subCarrierFilter.includes(p.insuranceCompanyId)) return false;
      } else {
        // No subs picked — match the carrier itself OR (when broker) any of its subs.
        const allowed = new Set<string>([carrierFilter]);
        for (const c of allCarriers) {
          if (c.parentCompanyId === carrierFilter) allowed.add(c.id);
        }
        if (!allowed.has(p.insuranceCompanyId)) return false;
      }
    }
    if (producerFilter && p.producerId !== producerFilter) return false;
    const selectedDate = (dateFilterField === "issued"
      ? (p.issuedAt ?? p.createdAt)
      : dateFilterField === "end"
        ? p.endDate
        : p.startDate)?.slice(0, 10) ?? "";
    if (fromDate && selectedDate < fromDate) return false;
    if (toDate && selectedDate > toDate) return false;
    if (paymentRouteFilter === "direct" && !p.paidDirectlyToCarrier) return false;
    if (paymentRouteFilter === "office" && p.paidDirectlyToCarrier) return false;
    if (expiryWindow) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(p.endDate);
      const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      if (p.status !== "Active" || days < 0 || days > Number(expiryWindow)) return false;
    }
    return true;
  });
}

export function PoliciesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const compactFilters = useMediaQuery(theme.breakpoints.down("xl"));
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isCustomer = user?.role === "Customer";
  const isProducer = user?.role === "Producer";
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser";
  const requestedView = searchParams.get("view");
  const activeView: "policies" | "delivery" | "group" = canEdit && (requestedView === "delivery" || requestedView === "group") ? requestedView : "policies";

  const setActiveView = (view: "policies" | "delivery" | "group") => {
    const next = new URLSearchParams(searchParams);
    if (view === "delivery" || view === "group") next.set("view", view);
    else next.delete("view");
    setSearchParams(next);
  };

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<PolicyType | "">("");
  const [carrierFilter, setCarrierFilter] = useState<string>("");
  const [subCarrierFilter, setSubCarrierFilter] = useState<string[]>([]);
  const [producerFilter, setProducerFilter] = useState<string>("");
  const [dateFilterField, setDateFilterField] = useState<PolicyDateFilterField>("start");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  // ALIS-parity search filters — plate + application number + premium range
  // are the three daily-driver lookups brokers do multiple times a day.
  const [plateFilter, setPlateFilter] = useState<string>("");
  const [appNumberFilter, setAppNumberFilter] = useState<string>("");
  const [premiumMin, setPremiumMin] = useState<string>("");
  const [premiumMax, setPremiumMax] = useState<string>("");
  const [expiryWindow, setExpiryWindow] = useState<"" | "5" | "10" | "20" | "30" | "60" | "90">("");
  const [paymentRouteFilter, setPaymentRouteFilter] = useState<PaymentRoute>("");

  // Carrier-driven Κλάδος options — empty when no carrier is selected.
  const filterCatalogue = useCarrierCatalogue(carrierFilter, subCarrierFilter);

  const carriersQuery = useQuery({
    queryKey: ["insurance-companies-for-filter-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data
  });
  const producersQuery = useQuery({
    queryKey: ["producers-for-filter"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data
  });

  const [createStatus, setCreateStatus] = useState<PolicyStatus | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const openPolicyCard = (id: string, edit = false) => { setDetailEditing(edit && canEdit); setDetailId(id); };
  const [renewing, setRenewing] = useState<PolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PolicyConfirmationAction | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  useEffect(() => { if (!compactFilters) setAdvancedFiltersOpen(false); }, [compactFilters]);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [sectionsAnchor, setSectionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [toolbarAction, setToolbarAction] = useState<{ token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" }>({ token: 0, action: "csv" });

  // Deep-link support — the customer card sends operators here as
  // /app/policies?focus=<policyId>. Read the id once on mount and open
  // the detail drawer so it feels like «click policy → see full policy».
  useEffect(() => {
    const id = searchParams.get("focus");
    if (id && !detailId) openPolicyCard(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("focus")]);

  const policiesQuery = useQuery({
    queryKey: ["policies", search, statusFilter, typeFilter, plateFilter, appNumberFilter, premiumMin, premiumMax],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (plateFilter.trim()) params.plate = plateFilter.trim();
      if (appNumberFilter.trim()) params.applicationNumber = appNumberFilter.trim();
      if (premiumMin.trim()) params.premiumMin = premiumMin.trim();
      if (premiumMax.trim()) params.premiumMax = premiumMax.trim();
      return (await api.get<PolicyDto[]>("/policies", { params })).data;
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<PolicyDto>(`/policies/${id}/cancel`, { reason: null })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policies"] });
      setSuccess("Το συμβόλαιο ακυρώθηκε επιτυχώς.");
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [blockers, setBlockers] = useState<{ kind: string; count: number; message: string }[] | null>(null);
  // Bulk selection for multi-row updates. Only AgencyAdmin sees the checkbox
  // column, so viewers can't accidentally select-and-mutate.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const { pushUndoable } = useUndoable();

  // User-configurable table columns. Order and visibility persist per
  // (user × table) via useColumnPreferences → localStorage. "number" and
  // "actions" stay alwaysVisible so the operator always has an id column
  // and a way to open/edit a row.
  const columnPrefs = useColumnPreferences("policies", [
    { key: "number",   label: "Αρ. Συμβολαίου", alwaysVisible: true },
    { key: "type",     label: "Κλάδος" },
    { key: "customer", label: "Πελάτης" },
    { key: "carrier",  label: "Ασφαλιστική" },
    { key: "producer", label: "Συνεργάτης", defaultVisible: false },
    { key: "dates",    label: "Έναρξη → Λήξη" },
    { key: "premium",  label: "Ασφάλιστρο" },
    { key: "status",   label: "Κατάσταση" },
  ]);

  // Column semantic type — used by useHeaderContextMenu below for the sort
  // labels («Α→Ω», «Παλιότερα → Νεότερα», «Χαμηλότερα → Υψηλότερα»).
  const inferType = (key: string): ColumnType =>
    key === "dates" ? "date" : key === "premium" ? "number" : "string";
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = (await api.delete<{ deleted: boolean; blockers: { kind: string; count: number; message: string }[] }>(`/policies/${id}`)).data;
      return { ...res, id };
    },
    onSuccess: (res) => {
      if (!res.deleted) { setBlockers(res.blockers); return; }
      setBlockers(null);
      void qc.invalidateQueries({ queryKey: ["policies"] });
      setSuccess("Το συμβόλαιο διαγράφηκε επιτυχώς.");
      pushUndoable({
        category: "policies", id: res.id,
        message: "Το συμβόλαιο διαγράφηκε",
        onRestore: () => { void qc.invalidateQueries({ queryKey: ["policies"] }); }
      });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const executePendingAction = () => {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    if (action.kind === "delete") deleteMutation.mutate(action.policy.id);
    else if (action.kind === "cancel") cancelMutation.mutate(action.policy.id);
    else setRenewing(action.policy);
  };

  const rawRows = policiesQuery.data ?? [];
  const documentPolicyId = searchParams.get("documentPolicyId");
  // Deep-link: `/app/policies?documentPolicyId={guid}` opens that policy's
  // drawer directly. We DON'T gate on the policy being present in the
  // filtered list — the drawer fetches its own detail via
  // /api/policies/{id}/detail, so a filter that would hide the row
  // shouldn't hide the deep-linked drawer. We also strip the query
  // param from the URL immediately so closing the drawer doesn't get
  // re-triggered by the same param on a re-render.
  useEffect(() => {
    if (!documentPolicyId) return;
    openPolicyCard(documentPolicyId);
    const next = new URLSearchParams(searchParams);
    next.delete("documentPolicyId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPolicyId]);
  const allRows = useMemo(() => filterPolicyListRows(rawRows, carriersQuery.data ?? [], {
    carrierFilter, subCarrierFilter, producerFilter, dateFilterField, fromDate, toDate, expiryWindow, paymentRouteFilter,
  }), [rawRows, carriersQuery.data, carrierFilter, subCarrierFilter, producerFilter, dateFilterField, fromDate, toDate, expiryWindow, paymentRouteFilter]);

  // Phase 15.2 — client-side search + sort + pagination.
  const table = useTableState<PolicyDto>({
    rows: allRows,
    searchableText: (p) => `${p.policyNumber} ${p.customerDisplay ?? ""} ${p.insuranceCompanyName} ${p.producerName ?? ""} ${p.policyType} ${p.status}`,
    pageSize: 25,
    initialSortKey: "createdAt" as keyof PolicyDto,
    initialSortDir: "desc"
  });
  const rows = table.paged;
  const clearPolicyFilters = () => {
    setClearSavedFilterRequest(value => value + 1);
    setCarrierFilter(""); setSubCarrierFilter([]); setProducerFilter("");
    setDateFilterField("start");
    setFromDate(""); setToDate(""); setStatusFilter(""); setTypeFilter(""); setSearch("");
    setPlateFilter(""); setAppNumberFilter(""); setPremiumMin(""); setPremiumMax("");
    setExpiryWindow("");
    setPaymentRouteFilter("");
    table.setQuery(""); table.setPage(1);
  };
  const policyFilterCount = [
    search, statusFilter, typeFilter, carrierFilter, producerFilter, fromDate, toDate,
    plateFilter, appNumberFilter, premiumMin, premiumMax, expiryWindow, paymentRouteFilter, table.query,
  ].filter(Boolean).length;
  const savedPolicyFilters = {
    search, statusFilter, typeFilter, carrierFilter, subCarrierFilter, producerFilter,
    dateFilterField, fromDate, toDate, plateFilter, appNumberFilter, premiumMin, premiumMax,
    expiryWindow, paymentRouteFilter,
  };
  const loadSavedPolicyFilters = (filters: Partial<typeof savedPolicyFilters>) => {
    setSearch(filters.search ?? "");
    setStatusFilter((filters.statusFilter ?? "") as PolicyStatus | "");
    setTypeFilter((filters.typeFilter ?? "") as PolicyType | "");
    setCarrierFilter(filters.carrierFilter ?? "");
    setSubCarrierFilter(filters.subCarrierFilter ?? []);
    setProducerFilter(filters.producerFilter ?? "");
    setDateFilterField((filters.dateFilterField ?? "start") as PolicyDateFilterField);
    setFromDate(filters.fromDate ?? "");
    setToDate(filters.toDate ?? "");
    setPlateFilter(filters.plateFilter ?? "");
    setAppNumberFilter(filters.appNumberFilter ?? "");
    setPremiumMin(filters.premiumMin ?? "");
    setPremiumMax(filters.premiumMax ?? "");
    setExpiryWindow((filters.expiryWindow ?? "") as typeof expiryWindow);
    setPaymentRouteFilter((filters.paymentRouteFilter ?? "") as PaymentRoute);
    table.setQuery(filters.search ?? "");
    table.setPage(1);
  };

  const importPolicies = async (importRows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0;
    const errors: string[] = [];
    const failedRows: Record<string, string>[] = [];
    const statuses = new Set<PolicyStatus>(["Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal", "Undelivered", "AwaitingIssue", "Prospect"]);
    const optionalNumber = (value: string | undefined) => {
      if (!value?.trim()) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`Μη έγκυρος αριθμός: ${value}`);
      return parsed;
    };
    const booleanValue = (value: string | undefined) => ["true", "1", "yes", "ναι"].includes((value ?? "").trim().toLowerCase());
    for (let index = 0; index < importRows.length; index++) {
      const row = importRows[index];
      try {
        const premium = Number(row.premium);
        if (!Number.isFinite(premium) || premium < 0) throw new Error("Το premium πρέπει να είναι έγκυρος αριθμός.");
        if (!row.policyType?.trim()) throw new Error("Το policyType είναι υποχρεωτικό.");
        if (row.status && !statuses.has(row.status as PolicyStatus)) throw new Error("Μη έγκυρο status.");
        if (Number.isNaN(new Date(row.startDate).getTime()) || Number.isNaN(new Date(row.endDate).getTime())) {
          throw new Error("Οι ημερομηνίες startDate/endDate δεν είναι έγκυρες.");
        }
        await api.post("/policies", {
          customerId: row.customerId.trim(),
          policyNumber: row.policyNumber?.trim() || null,
          insuranceCompanyId: row.insuranceCompanyId.trim(),
          producerId: row.producerId?.trim() || null,
          policyType: row.policyType.trim(),
          vehicleUseCategory: row.vehicleUseCategory?.trim() || null,
          vehicleRegistrationPlate: row.vehicleRegistrationPlate?.trim().toUpperCase() || null,
          coverCode: row.coverCode?.trim() || null,
          packageCode: row.packageCode?.trim() || null,
          startDate: row.startDate,
          endDate: row.endDate,
          premium,
          netPremium: optionalNumber(row.netPremium),
          specialCommissionPercent: optionalNumber(row.specialCommissionPercent),
          vatAmount: optionalNumber(row.vatAmount),
          currency: (row.currency?.trim() || "EUR").toUpperCase(),
          status: row.status?.trim() || "Active",
          paidDirectlyToCarrier: booleanValue(row.paidDirectlyToCarrier),
        });
        imported++;
      } catch (e) {
        failedRows.push(row);
        errors.push(`Row ${index + 2}: ${extractErrorMessage(e)}`);
      }
    }
    void qc.invalidateQueries({ queryKey: ["policies"] });
    return { imported, failed: importRows.length - imported, errors, failedRows };
  };

  // Right-click on a header → sort + hide column; right-click on a row →
  // open detail + delete. Placed here so `table` (defined just above) is
  // in scope for the callbacks.
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof PolicyDto> = {
        number: "policyNumber", type: "policyType", customer: "customerDisplay",
        carrier: "insuranceCompanyName", producer: "producerName",
        dates: "startDate", premium: "premium", status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
    onHide: (key) => columnPrefs.toggleVisibility(key),
  });
  const rowMenu = useRowContextMenu<PolicyDto>({
    entityLabel: "συμβολαίου",
    onEdit: canEdit ? (p) => openPolicyCard(p.id, true) : undefined,
    onDelete: (p) => {
      if (canEdit) setPendingAction({ kind: "delete", policy: p });
    },
  });

  const renderPrimaryFilters = (inDialog: boolean) => <Box sx={{
    display: "grid", gap: 1, pt: .5, alignItems: "center",
    gridTemplateColumns: inDialog ? { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }
      : "minmax(260px, 1.4fr) minmax(220px, .9fr) minmax(165px, .65fr) minmax(165px, .65fr)",
  }}>
    <TextField size="small" fullWidth label="Αναζήτηση συμβολαίων" placeholder="Αρ. συμβολαίου, πελάτης, ΑΦΜ ή πινακίδα…"
      value={search} onChange={event => setSearch(event.target.value)} sx={{ minWidth: 0, gridColumn: inDialog ? "1 / -1" : undefined }}
      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό συμβολαίου, πελάτη, ΑΦΜ, απόδειξη ή πινακίδα οχήματος." /> }} />
    <TextField select size="small" label="Οι ημερομηνίες αφορούν" value={dateFilterField}
      onChange={event => setDateFilterField(event.target.value as PolicyDateFilterField)} sx={{ minWidth: 0, width: "100%", gridColumn: inDialog ? "1 / -1" : undefined }}>
      <MenuItem value="issued">Ημερομηνία έκδοσης</MenuItem><MenuItem value="start">Ημερομηνία έναρξης ισχύος</MenuItem><MenuItem value="end">Ημερομηνία λήξης</MenuItem>
    </TextField>
    <TextField size="small" fullWidth type="date" label="Από" InputLabelProps={{ shrink: true }} value={fromDate} onChange={event => setFromDate(event.target.value)} sx={{ minWidth: 0 }} />
    <TextField size="small" fullWidth type="date" label="Έως" InputLabelProps={{ shrink: true }} value={toDate} onChange={event => setToDate(event.target.value)} sx={{ minWidth: 0 }} />
  </Box>;
  const policyExportSubtitle = [search && `Αναζήτηση: ${search}`, table.query && `Αναζήτηση πίνακα: ${table.query}`,
    carrierFilter && `Εταιρεία: ${carriersQuery.data?.find(carrier => carrier.id === carrierFilter)?.name ?? carrierFilter}`,
    producerFilter && `Συνεργάτης: ${producersQuery.data?.find(producer => producer.id === producerFilter)?.name ?? producerFilter}`,
    statusFilter && `Κατάσταση: ${statusFilter === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${statusFilter}`)}`,
    typeFilter && `Κλάδος: ${t(`policies.types.${typeFilter}`)}`, (fromDate || toDate) && `${dateFilterField === "issued" ? "Ημερομηνία έκδοσης" : dateFilterField === "end" ? "Ημερομηνία λήξης" : "Ημερομηνία έναρξης"}: ${fromDate ? date(fromDate) : "—"} – ${toDate ? date(toDate) : "—"}`,
    plateFilter && `Πινακίδα: ${plateFilter}`, appNumberFilter && `Αίτηση: ${appNumberFilter}`,
    premiumMin && `Μεικτά από: ${premiumMin}`, premiumMax && `Μεικτά έως: ${premiumMax}`,
    expiryWindow && `Λήγουν σε ${expiryWindow} ημέρες`, paymentRouteFilter && `Πληρωμή: ${paymentRouteFilter === "direct" ? "Απευθείας στην ασφαλιστική" : "Στο γραφείο"}`,
  ].filter(Boolean).join(" · ");
  const visiblePolicyColumnKeys = columnPrefs.visibleColumns.filter(column => !(column.key === "customer" && isCustomer)).map(column => column.key);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isCustomer ? t("policies.customerTitle") : t("policies.agencyTitle")}
            </Typography>
            <HelpHint id="page.policies" />
            <RecordCountChip count={table.filtered.length} />
          </Stack>
          <Typography color="text.secondary">
            {isCustomer ? t("policies.customerLead") : t("policies.agencyLead")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!isCustomer && activeView === "policies" && <SavedReportsButton entity="policies" currentFilters={savedPolicyFilters}
            onLoad={loadSavedPolicyFilters} onClear={clearPolicyFilters} clearRequestToken={clearSavedFilterRequest}
            saveRequestToken={saveFilterRequest} showSaveMenuItem={false} />}
          {!isCustomer && activeView === "policies" && compactFilters && <Button variant="contained" startIcon={<FilterListIcon />}
            aria-haspopup="dialog" aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen(true)}
            sx={{ bgcolor: "#159b59", color: "#fff", whiteSpace: "nowrap", flexShrink: 0, "&:hover": { bgcolor: "#107b46", color: "#fff" } }}>
            Φίλτρα{policyFilterCount ? ` (${policyFilterCount})` : ""}
          </Button>}
          {canEdit && <Button variant="outlined" size="large" startIcon={<AccountTreeOutlinedIcon />} endIcon={<KeyboardArrowDownIcon />}
            onClick={event => setSectionsAnchor(event.currentTarget)}>Ενότητες συμβολαίων</Button>}
          <Button data-tour="policies-actions" variant="contained" size="large" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
            disabled={activeView !== "policies"} onClick={event => setActionsAnchor(event.currentTarget)}>Ενέργειες</Button>
        </Stack>
      </Stack>

      <Menu anchorEl={sectionsAnchor} open={Boolean(sectionsAnchor)} onClose={() => setSectionsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 280 } } }}>
        <MenuItem selected={activeView === "policies"} onClick={() => { setSectionsAnchor(null); setActiveView("policies"); }}><ListItemIcon><DescriptionOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText primary="Συμβόλαια" /></MenuItem>
        <MenuItem selected={activeView === "delivery"} onClick={() => { setSectionsAnchor(null); setActiveView("delivery"); }}><ListItemIcon><LocalShippingIcon fontSize="small" /></ListItemIcon><ListItemText primary={t("delivery.title")} /></MenuItem>
        <MenuItem selected={activeView === "group"} onClick={() => { setSectionsAnchor(null); setActiveView("group"); }}><ListItemIcon><GroupsIcon fontSize="small" /></ListItemIcon><ListItemText primary={t("groupPolicies.title")} /></MenuItem>
        <Divider />
        <MenuItem component={RouterLink} to="/app/renewals" onClick={() => setSectionsAnchor(null)} sx={{ color: "#2e7d32" }}><ListItemIcon sx={{ color: "#2e7d32" }}><EventRepeatIcon fontSize="small" /></ListItemIcon><ListItemText primary="Ανανεώσεις" /></MenuItem>
        <MenuItem component={RouterLink} to="/app/endorsements" onClick={() => setSectionsAnchor(null)} sx={{ color: "#8a6d1d" }}><ListItemIcon sx={{ color: "#8a6d1d" }}><EditNoteIcon fontSize="small" /></ListItemIcon><ListItemText primary="Πρόσθετες πράξεις" /></MenuItem>
        <MenuItem component={RouterLink} to="/app/cancellations" onClick={() => setSectionsAnchor(null)} sx={{ color: "#c62828" }}><ListItemIcon sx={{ color: "#c62828" }}><CancelPresentationIcon fontSize="small" /></ListItemIcon><ListItemText primary="Ακυρώσεις" /></MenuItem>
      </Menu>
      <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 290, maxWidth: "calc(100vw - 24px)" } } }}>
        {canEdit && activeView === "policies" && <MenuItem data-tour="policies-new" onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Active"); }} sx={{ color: "#0877c9", "&:hover": { bgcolor: "#e7f2fd" } }}><ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary={t("policies.create")} /></MenuItem>}
        {canEdit && activeView === "policies" && <MenuItem onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Prospect"); }} sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df" } }}><ListItemIcon sx={{ color: "#a45b00" }}><PersonAddAltOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText primary="Πιθανό συμβόλαιο" /></MenuItem>}
        {canEdit && activeView === "policies" && <MenuItem onClick={() => { setActionsAnchor(null); setImportOpen(true); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}><ListItemIcon sx={{ color: "#167c45" }}><TableViewOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εισαγωγή Excel" /></MenuItem>}
        {activeView === "policies" && <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }} sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc" } }}><ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" /></MenuItem>}
        <Divider />
        <MenuItem disabled={policiesQuery.isLoading || policiesQuery.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "csv" })); }} sx={{ color: "#087f73", "&:hover": { bgcolor: "#e5f6f3" } }}><ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" /></MenuItem>
        <MenuItem disabled={policiesQuery.isLoading || policiesQuery.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "xlsx" })); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}><ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή Excel" /></MenuItem>
        <MenuItem disabled={policiesQuery.isLoading || policiesQuery.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "pdf" })); }} sx={{ color: "#c73545", "&:hover": { bgcolor: "#fdecef" } }}><ListItemIcon sx={{ color: "#c73545" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή PDF" /></MenuItem>
        <MenuItem disabled={policiesQuery.isLoading || policiesQuery.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "print" })); }} sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7" } }}><ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" /></MenuItem>
        <Divider />
        <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "columns" })); }} sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb" } }}><ListItemIcon sx={{ color: "#5b55a5" }}><ViewColumnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στήλες εξαγωγής" /></MenuItem>
        <MenuItem onClick={() => { setActionsAnchor(null); setAdvancedFiltersOpen(true); }} sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df" } }}><ListItemIcon sx={{ color: "#a45b00" }}><TuneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Σύνθετα φίλτρα" /></MenuItem>
      </Menu>

      <TableToolbar<PolicyDto> query={table.query} onQuery={table.setQuery} count={allRows.length} filteredCount={table.filtered.length}
        pageSize={table.pageSize} onPageSize={table.setPageSize} exportRows={table.filtered} snapshotExport
        exportFileName={`policies-${new Date().toISOString().slice(0, 10)}`} columnSelectionId="policy-register"
        printTitle="Συμβόλαια" printSubtitle={policyExportSubtitle} visibleColumnKeys={visiblePolicyColumnKeys}
        exportColumns={policyListExportColumns(t)} hideSearch actionRequest={toolbarAction} hideActionButtons hideCount hidePageSize />

      {activeView === "delivery" ? (
        <PolicyDeliveryPage embedded />
      ) : activeView === "group" ? (
        <GroupPoliciesPage embedded />
      ) : (
        <>
      {isProducer && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Τα συμβόλαια καταχωρούνται και ανατίθενται από το γραφείο. Εδώ βλέπετε μόνο όσα έχουν ανατεθεί σε εσάς, μαζί με τυχόν πιθανά συμβόλαια.
        </Alert>
      )}
       {!isCustomer && (
         <>
           {!compactFilters && <Card variant="outlined" sx={{ p: 1, mb: 1, bgcolor: "#edf2f7", borderColor: "#d5e0ec" }}>{renderPrimaryFilters(false)}</Card>}
           <Dialog open={advancedFiltersOpen} onClose={() => setAdvancedFiltersOpen(false)} fullWidth maxWidth="md">
             <DialogTitle>Φίλτρα συμβολαίων</DialogTitle>
             <DialogContent dividers>
               {renderPrimaryFilters(true)}
               <Divider sx={{ my: 1.5 }} />
               <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, pt: .5 }}>
                  <SearchableSelect
                    label="Εταιρεία"
                    value={carrierFilter}
                    onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); }}
                    emptyLabel="Όλες"
                    options={(carriersQuery.data ?? [])
                      .filter(c => !c.parentCompanyId)
                      .map(c => ({ value: c.id, label: c.name, hint: c.isBroker ? "Πρακτορείο" : c.code }))}
                  />
                  <SearchableTextField
                    size="small"
                    label={t("policies.col.type")}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as PolicyType | "")}
                    disabled={!carrierFilter}
                    helperText={!carrierFilter ? "Επιλέξτε πρώτα εταιρεία" : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν κλάδοι" : ""}
                  >
                    <MenuItem value="">Όλοι οι κλάδοι</MenuItem>
                    {filterCatalogue.branches.map(b => <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>)}
                  </SearchableTextField>
                  <SearchableTextField size="small" label={t("policies.col.status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PolicyStatus | "")}>
                   <MenuItem value="">Όλες οι καταστάσεις</MenuItem>
                   {(["Prospect", "Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal", "Undelivered", "AwaitingIssue"] as const).map(s => <MenuItem key={s} value={s}>{s === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${s}`)}</MenuItem>)}
                 </SearchableTextField>
                 <SearchableSelect
                   label="Συνεργάτης"
                   value={producerFilter}
                   onChange={(v) => setProducerFilter(v)}
                   emptyLabel="Όλοι"
                   options={(producersQuery.data ?? []).map(p => ({ value: p.id, label: p.name, hint: p.code }))}
                 />
                 {(() => {
                   const selected = (carriersQuery.data ?? []).find(c => c.id === carrierFilter);
                    if (!selected || !selected.isBroker) return null;
                   const subs = (carriersQuery.data ?? []).filter(c => c.parentCompanyId === selected.id);
                   return <Autocomplete<CarrierDto, true> multiple size="small" options={subs} value={subs.filter(s => subCarrierFilter.includes(s.id))} onChange={(_, value) => setSubCarrierFilter(value.map(v => v.id))} getOptionLabel={(s) => s.name} isOptionEqualToValue={(a, b) => a.id === b.id} renderInput={(params) => <TextField {...params} label="Υποασφαλιστικές" size="small" />} />;
                 })()}
                 <TextField size="small" label="Αρ. κυκλοφορίας" value={plateFilter} onChange={(e) => setPlateFilter(e.target.value.toUpperCase())} />
                 <TextField size="small" label="Αρ. αίτησης" value={appNumberFilter} onChange={(e) => setAppNumberFilter(e.target.value)} />
                 <TextField size="small" type="number" label="Μεικτά από" value={premiumMin} onChange={(e) => setPremiumMin(e.target.value)} />
                 <TextField size="small" type="number" label="Μεικτά έως" value={premiumMax} onChange={(e) => setPremiumMax(e.target.value)} />
                 <SearchableTextField size="small" label="Πληρωμή" value={paymentRouteFilter} onChange={(e) => setPaymentRouteFilter(e.target.value as PaymentRoute)}>
                   <MenuItem value="">Όλες</MenuItem>
                   <MenuItem value="office">Πληρωμή στο γραφείο</MenuItem>
                   <MenuItem value="direct">Απευθείας στην ασφαλιστική</MenuItem>
                 </SearchableTextField>
                 <TextField select size="small" fullWidth label="Λήγουν εντός" value={expiryWindow} onChange={event => setExpiryWindow(event.target.value as typeof expiryWindow)}>
                   <MenuItem value="">Χωρίς περιορισμό</MenuItem>{[5, 10, 20, 30, 60, 90].map(days => <MenuItem key={days} value={String(days)}>{days} ημέρες</MenuItem>)}
                 </TextField>
               </Box>
             </DialogContent>
             <DialogActions>
               <Button color="error" variant="contained" onClick={clearPolicyFilters}>Καθαρισμός φίλτρων</Button>
               <Button variant="contained" onClick={() => setAdvancedFiltersOpen(false)}>Εφαρμογή</Button>
             </DialogActions>
           </Dialog>
         </>
       )}

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {policiesQuery.isError && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={() => void policiesQuery.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(policiesQuery.error)}</Alert>}

      {policiesQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ bgcolor: "#f8fafc", borderColor: "#d5e0ec", overflow: "hidden", boxShadow: "none" }}>
          {canEdit && selectedIds.size > 0 && (
            <Box sx={{ p: 1.5, mb: 2, bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 1,
                display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Typography fontWeight={700}>{selectedIds.size} επιλεγμένα συμβόλαια</Typography>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" color="secondary" onClick={() => setBulkOpen(true)}>
                Μαζική αλλαγή…
              </Button>
              <Button onClick={() => setSelectedIds(new Set())} color="error" variant="contained">Καθαρισμός</Button>
            </Box>
          )}
          <TableContainer sx={{ maxHeight: "70vh", overflow: "auto" }}>
            <Table size="small" stickyHeader aria-label="Μητρώο συμβολαίων" sx={{ minWidth: 1000,
              "& th": { bgcolor: "#e9eef4", color: "#102d55", fontWeight: 800 },
              "& td, & th": { borderColor: "#dfe5ed", px: 1, py: .75, fontSize: 13 },
            }}>
              <TableHead>
                <TableRow>
                  {canEdit && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={rows.length > 0 && rows.every(r => selectedIds.has(r.id))}
                        indeterminate={rows.some(r => selectedIds.has(r.id)) && !rows.every(r => selectedIds.has(r.id))}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) rows.forEach(r => next.add(r.id));
                          else rows.forEach(r => next.delete(r.id));
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                  )}
                  {columnPrefs.visibleColumns.map(c => {
                    if (c.key === "customer" && isCustomer) return null;
                    const isRight = c.key === "premium";
                    return (
                      <TableCell
                        key={c.key}
                        align={isRight ? "right" : "left"}
                        onContextMenu={(e) => headerMenu.open(e, {
                          key: c.key, label: c.label, type: inferType(c.key), canHide: !c.alwaysVisible,
                        })}
                        sx={{ userSelect: "none" }}
                      >
                        {c.label}
                      </TableCell>
                    );
                  })}
                  {canEdit && (
                    <TableCell align="right" padding="checkbox">
                      <ColumnPreferencesButton
                        orderedColumns={columnPrefs.orderedColumns}
                        hiddenSet={columnPrefs.hiddenSet}
                        toggleVisibility={columnPrefs.toggleVisibility}
                        moveColumn={columnPrefs.moveColumn}
                        reset={columnPrefs.reset}
                      />
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p, index) => {
                  const daysToEnd = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const expiringSoon = daysToEnd > 0 && daysToEnd <= 30 && p.status === "Active";
                  return (
                    <TableRow key={p.id} hover sx={policyListRowSx(p.status, index)}
                      data-tour="policies-row"
                      selected={selectedIds.has(p.id)}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root, .MuiCheckbox-root")) return;
                        openPolicyCard(p.id);
                      }}
                      onContextMenu={(e) => rowMenu.open(e, p)}>
                      {canEdit && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selectedIds.has(p.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(p.id); else next.delete(p.id);
                              setSelectedIds(next);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                      )}
                      {columnPrefs.visibleColumns.map(c => {
                        if (c.key === "customer" && isCustomer) return null;
                        switch (c.key) {
                          case "number":
                            return <TableCell key={c.key}><Chip label={p.policyNumber} variant="outlined" size="small" /></TableCell>;
                          case "type":
                            return <TableCell key={c.key}>{t(`policies.types.${p.policyType}`)}</TableCell>;
                          case "customer":
                            return <TableCell key={c.key}><Typography fontWeight={600}>{p.customerDisplay}</Typography></TableCell>;
                          case "carrier":
                            return <TableCell key={c.key}>{p.insuranceCompanyName}</TableCell>;
                          case "producer":
                            return <TableCell key={c.key}>{p.producerName ?? "—"}</TableCell>;
                          case "dates":
                            return (
                              <TableCell key={c.key}>
                                <Typography variant="caption" color="text.secondary">Διάρκεια: {contractDurationLabel(p.startDate, p.endDate)}</Typography>
                                <Typography variant="body2">{date(p.startDate)} → {date(p.endDate)}</Typography>
                                {expiringSoon && (
                                  <Typography variant="caption" color="warning.main" fontWeight={700}>
                                    {t("policies.expiresIn", { days: daysToEnd })}
                                  </Typography>
                                )}
                              </TableCell>
                            );
                          case "premium":
                            return (
                              <TableCell key={c.key} align="right">
                                <Typography fontWeight={700}>{money(p.premium, p.currency)}</Typography>
                              </TableCell>
                            );
                          case "status":
                            return <TableCell key={c.key}><Chip data-tour="policies-status" label={p.status === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${p.status}`)} color={STATUS_COLOR[p.status]} size="small" /></TableCell>;
                          default:
                            return <TableCell key={c.key}>—</TableCell>;
                        }
                      })}
                      {canEdit && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => openPolicyCard(p.id, true)} title={t("common.edit")}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setPendingAction({ kind: "renew", policy: p })}
                              title={t("policies.actions.renew")}
                              disabled={p.status === "Cancelled" || p.status === "Renewed" || p.status === "Prospect"}
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setPendingAction({ kind: "cancel", policy: p })}
                              title={t("policies.actions.cancel")}
                              disabled={p.status === "Cancelled" || p.status === "Prospect"}
                              color="error"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setPendingAction({ kind: "delete", policy: p })}
                              title="Διαγραφή"
                              color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visiblePolicyColumnKeys.length + (canEdit ? 2 : 0)}>
                      <Typography color="text.secondary" textAlign="center" py={4}>{t("policies.noPolicies")}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", px: 2, py: 1, bgcolor: "#edf2f7", borderTop: "1px solid #d5e0ec" }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={table.filtered.length} pageSize={table.pageSize} onPageSize={table.setPageSize} />
          </Box>
        </Card>
      )}

      {/* The detail drawer is READ+edit-safe for every role that reaches
          this page (superadmin viewing an impersonated tenant, agency
          admin/user, customer). It was previously nested inside the
          `canEdit &&` block, which meant clicking a row as a viewer set
          detailId but the drawer wasn't even mounted — click did nothing.
          Now it lives at the top level so every role can preview a policy. */}
      <PolicyDetailDrawer
        key={`${detailId ?? "closed"}:${detailEditing ? "edit" : "view"}`}
        policyId={detailId}
        initialEditing={detailEditing && canEdit}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        presentation="modal"
        readOnly={isProducer}
      />

      {canEdit && (
        <>
          <BulkImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            title="Μαζική εισαγωγή συμβολαίων"
            description="Κατεβάστε το πρότυπο XLSX και συμπληρώστε τα IDs πελάτη, ασφαλιστικής και προαιρετικά συνεργάτη. Κάθε γραμμή ελέγχεται ξεχωριστά πριν δημιουργηθεί το συμβόλαιο."
            columns={[...POLICY_IMPORT_COLUMNS]}
            onImport={importPolicies}
          />
          <PolicyFormDialog
            open={createStatus !== null}
            initialStatus={createStatus ?? "Active"}
            onClose={() => setCreateStatus(null)}
            policy={null}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setCreateStatus(null); }}
          />
          <RenewDialog
            policy={renewing}
            onClose={() => setRenewing(null)}
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ["policies"] });
              setRenewing(null);
              setSuccess("Η ανανέωση του συμβολαίου ολοκληρώθηκε επιτυχώς.");
            }}
          />
          <BulkEditDialog
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            selectedIds={Array.from(selectedIds)}
            onDone={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setSelectedIds(new Set()); setBulkOpen(false); }}
          />
        </>
      )}

      <Dialog open={!!blockers} onClose={() => setBlockers(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Δεν είναι δυνατή η διαγραφή</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Το συμβόλαιο έχει εξαρτημένες εγγραφές. Διαγράψτε τις παρακάτω πρώτα,
            με τη σειρά που εμφανίζονται, και μετά επαναλάβετε τη διαγραφή.
          </Alert>
          <Stack spacing={1.5}>
            {(blockers ?? []).map((b, i) => (
              <Card variant="outlined" key={b.kind} sx={{ p: 2 }}>
                <Typography fontWeight={800}>{i + 1}. {b.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Πλήθος: {b.count} · κατηγορία: <code>{b.kind}</code>
                </Typography>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockers(null)} variant="contained">Κατάλαβα</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!pendingAction} onClose={() => setPendingAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {pendingAction?.kind === "delete" ? "Διαγραφή συμβολαίου" : pendingAction?.kind === "cancel" ? "Ακύρωση συμβολαίου" : "Ανανέωση συμβολαίου"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Είστε σίγουρος ότι θέλετε να {pendingAction?.kind === "delete" ? "διαγράψετε" : pendingAction?.kind === "cancel" ? "ακυρώσετε" : "ξεκινήσετε την ανανέωση του"} το συμβόλαιο <strong>{pendingAction?.policy.policyNumber ?? "—"}</strong>;
          </Typography>
          {pendingAction?.kind === "delete" && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Η διαγραφή μπορεί να αποκλειστεί αν υπάρχουν συνδεδεμένες οικονομικές ή άλλες εγγραφές.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAction(null)}>Ακύρωση</Button>
          <Button
            variant="contained"
            color={pendingAction?.kind === "renew" ? "success" : "error"}
            onClick={executePendingAction}
            startIcon={pendingAction?.kind === "delete" ? <DeleteIcon /> : pendingAction?.kind === "cancel" ? <CancelIcon /> : <AutorenewIcon />}
          >
            Είμαι σίγουρος
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!success} autoHideDuration={4500} onClose={() => setSuccess(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)} sx={{ color: "#fff", fontWeight: 800 }}>
          {success}
        </Alert>
      </Snackbar>
        </>
      )}
      {headerMenu.menu}
      {rowMenu.menu}
    </Box>
  );
}

/* ====================== Create/Edit dialog ====================== */

interface FormBody {
  customerId: string;
  policyNumber: string;
  insuranceCompanyId: string;
  producerId: string;
  policyType: PolicyType;
  vehicleUseCategory: string;
  vehicleRegistrationPlate: string;
  coverCode: string;
  packageCode: string;
  startDate: string;
  endDate: string;
  premium: number;
  netPremium: string;
  specialCommissionPercent: string;
  currency: string;
  status: PolicyStatus;
  paidDirectlyToCarrier: boolean;
  delivered: boolean;
  createReceipt: boolean;
  paymentCollectionMethod: string;
}

function PolicyFormDialog({
  open,
  initialStatus = "Active",
  onClose,
  policy,
  onSaved
}: {
  open: boolean;
  initialStatus?: PolicyStatus;
  onClose: () => void;
  policy: PolicyDto | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const editing = !!policy;

  // Full server-side customer search (ΑΦΜ / κινητό / email / όνομα κ.λπ.) —
  // no more «τα πρώτα 500» wall. See useCustomerSearch for the debounce +
  // selected-customer inclusion logic.
  // Non-null string = inline "new customer" dialog open (with that string
  // as the prefill). Null = closed. Kept as a separate state so the parent
  // dialog stays interactive underneath.
  const [inlineCustomerCreate, setInlineCustomerCreate] = useState<string | null>(null);
  const [inlineCarrierCreate, setInlineCarrierCreate] = useState<string | null>(null);
  const carriersQuery = useQuery({
    queryKey: ["insurance-companies-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data,
    enabled: open
  });
  // Producer list for the «Συνεργάτης» dropdown — local to the dialog so
  // it opens/closes with the form; not shared with the parent page which
  // has its own producers-for-filter query keyed differently.
  const producersQuery = useQuery({
    queryKey: ["producers-for-policy-form"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data,
    enabled: open,
  });
  const workflowSettings = useQuery({
    queryKey: ["office-workflow-settings"],
    enabled: open,
    queryFn: async () => (await api.get<{ keyName: string; value: string | null }[]>("/integration-settings", { params: { service: "OfficeWorkflow" } })).data,
    staleTime: 60_000,
  });

  const [form, setForm] = useState<FormBody>({
    customerId: "",
    policyNumber: "",
    insuranceCompanyId: "",
    producerId: "",
    policyType: "Auto",
    vehicleUseCategory: "",
    vehicleRegistrationPlate: "",
    coverCode: "",
    packageCode: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    premium: 0,
    netPremium: "",
    specialCommissionPercent: "",
    currency: "EUR",
    status: "Active",
    paidDirectlyToCarrier: false,
    delivered: true,
    createReceipt: false,
    paymentCollectionMethod: "Cash"
  });
  const [error, setError] = useState<string | null>(null);
  const customerSearch = useCustomerSearch(form.customerId);
  const dialogCatalogue = useCarrierCatalogue(form.insuranceCompanyId);

  useEffect(() => {
    if (policy) {
      setForm({
        customerId: policy.customerId,
        policyNumber: policy.policyNumber,
        insuranceCompanyId: policy.insuranceCompanyId,
        producerId: policy.producerId ?? "",
        policyType: policy.policyType,
        vehicleUseCategory: "",
        vehicleRegistrationPlate: policy.vehicleRegistrationPlate ?? "",
        coverCode: "",
        packageCode: "",
        startDate: policy.startDate,
        endDate: policy.endDate,
        premium: policy.premium,
        netPremium: "",
        specialCommissionPercent: "",
        currency: policy.currency,
        status: policy.status,
        paidDirectlyToCarrier: policy.paidDirectlyToCarrier ?? false,
        delivered: !!policy.deliveredAt,
        createReceipt: false,
        paymentCollectionMethod: "Cash"
      });
    } else if (open) {
      setForm({
        customerId: "",
        policyNumber: "",
        insuranceCompanyId: "",
        producerId: "",
        policyType: "Auto",
        vehicleUseCategory: "",
        vehicleRegistrationPlate: "",
        coverCode: "",
        packageCode: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
        premium: 0,
        netPremium: "",
        specialCommissionPercent: "",
        currency: "EUR",
        status: initialStatus,
        paidDirectlyToCarrier: false,
        delivered: true,
        createReceipt: false,
        paymentCollectionMethod: "Cash"
      });
    }
  }, [policy, open, initialStatus]);

  // Initialise defaults first, then silently restore the draft. Reversing
  // these effects overwrote restored input with an empty form on opening.
  const { clearDraft, hasDraft, hydrated } = useDraftPersistence<FormBody>(
    "policy-new", user?.userId ?? null, form,
    restored => setForm(previous => ({ ...previous, ...restored })), open && !editing);

  useEffect(() => {
    if (open && !editing && hydrated && !hasDraft && workflowSettings.data) {
      const map = new Map(workflowSettings.data.map(x => [x.keyName, x.value]));
      setForm(prev => ({
        ...prev,
        delivered: map.get("AutoMarkPolicyDelivered") !== "false",
        createReceipt: map.get("AutoCreateReceiptOnPolicy") === "true",
      }));
    }
  }, [workflowSettings.data, open, editing, hasDraft, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Keep historical accounting data when editing; no tax input is exposed.
      const existingTax = policy ? (await api.get<{ vatAmount: number | null }>(`/policies/${policy.id}/detail`)).data.vatAmount : null;
      const taxAmount = policy ? existingTax : (form.netPremium !== "" && form.premium > 0
        ? Math.max(0, form.premium - Number(form.netPremium)) : null);
      const body = {
        insuranceCompanyId: form.insuranceCompanyId,
        producerId: form.producerId || null,
        policyType: form.policyType,
        vehicleUseCategory: form.vehicleUseCategory || null,
        vehicleRegistrationPlate: form.vehicleRegistrationPlate.trim() || null,
        coverCode: form.coverCode || null,
        packageCode: form.packageCode || null,
        startDate: form.startDate,
        endDate: form.endDate,
        premium: form.premium,
        netPremium: form.netPremium === "" ? null : Number(form.netPremium),
        specialCommissionPercent: form.specialCommissionPercent === "" ? null : Number(form.specialCommissionPercent),
        vatAmount: taxAmount,
        currency: form.currency,
        status: form.status,
        paidDirectlyToCarrier: form.paidDirectlyToCarrier,
        delivered: form.delivered,
      };
      if (editing && policy) {
        return (await api.put<PolicyDto>(`/policies/${policy.id}`, { ...body, policyNumber: form.policyNumber.trim() || null })).data;
      } else {
        return (await api.post<PolicyDto>("/policies", {
          customerId: form.customerId,
          policyNumber: form.policyNumber.trim() || null,
          ...body,
          createReceipt: form.createReceipt,
          paymentCollectionMethod: form.paymentCollectionMethod || null,
        })).data;
      }
    },
    onSuccess: () => { clearDraft(); onSaved(); },
    onError: (err) => setError(extractErrorMessage(err))
  });

  // customer options come from useCustomerSearch (server-side filtered).

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="policy-form-title"
      PaperProps={{ sx: {
        m: { xs: 1, sm: 1.5 }, width: { xs: "calc(100% - 16px)", sm: "calc(100% - 24px)" },
        maxHeight: "calc(100dvh - 24px)", bgcolor: "#edf3f9", border: "1px solid #8799ae", borderRadius: 2,
      } }}>
      <DialogTitle id="policy-form-title" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, color: "#102d55", fontWeight: 800, fontSize: 20 }}>
        {editing ? t("policies.form.editTitle") : t("policies.form.createTitle")}
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 1.5, sm: 2 }, pt: "12px !important", pb: 1.5, bgcolor: "#edf3f9" }}>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5 }}>{error}</Alert>}
        <Box sx={{
          display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
          gap: { xs: 1.5, md: 2 }, alignItems: "start",
          "& .MuiFormControl-root, & .MuiAutocomplete-root": { minWidth: 0 },
          "& .MuiInputLabel-root": { color: "#263f5d", fontWeight: 650 },
          "& .MuiInputLabel-root.Mui-focused": { color: "#075ba9" },
          "& .MuiOutlinedInput-root": { bgcolor: "#f8fafc", color: "#102d55", fontSize: 14, fontWeight: 600, minHeight: 44 },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#7b8fa7", borderWidth: "1.25px" },
          "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2e5076" },
          "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#087ceb", borderWidth: 2 },
          "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: "#c62828" },
          "& .MuiInputBase-input::placeholder": { color: "#4e627a", opacity: 1, fontWeight: 400 },
          "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#52647a" },
          "& .MuiInputLabel-root.Mui-disabled": { color: "#52647a" },
          "& .MuiOutlinedInput-root.Mui-disabled": { bgcolor: "#e7edf3" },
          "& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: "#9baabc" },
          "& .MuiFormHelperText-root": { color: "#455c76", fontSize: 12, lineHeight: 1.3, mx: .25, mt: .5 },
          "& .MuiFormHelperText-root.Mui-error": { color: "#c62828" },
          "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": { color: "#355779" },
        }}>
          <Stack spacing={1.5}>
            <SearchableSelect label={t("policies.form.customer")} value={form.customerId}
              onChange={v => setForm({ ...form, customerId: v })} onInputChange={customerSearch.setInput}
              required disabled={editing} options={customerSearch.options}
              helperText={editing ? t("policies.form.customerLocked") : "Αναζήτηση με όνομα, ΑΦΜ, τηλέφωνο ή email"}
              createNewLabel="+ Νέος πελάτης" onCreateNew={editing ? undefined : input => setInlineCustomerCreate(input || "")} />
            <SearchableSelect label={t("policies.form.carrier")} value={form.insuranceCompanyId}
              onChange={v => setForm({ ...form, insuranceCompanyId: v, policyType: "Auto", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
              required options={(carriersQuery.data ?? []).filter(c => !c.parentCompanyId).map(c => ({ value: c.id, label: c.name, hint: c.isBroker ? "πρακτορείο" : undefined }))}
              createNewLabel="+ Νέα ασφαλιστική" onCreateNew={editing ? undefined : input => setInlineCarrierCreate(input || "")} />
            {(() => {
              const carrierData = carriersQuery.data ?? [];
              const selected = carrierData.find(c => c.id === form.insuranceCompanyId);
              const broker = selected?.isBroker ? selected : selected?.parentCompanyId ? carrierData.find(c => c.id === selected.parentCompanyId) : null;
              if (!broker?.isBroker) return null;
              const subs = carrierData.filter(c => c.parentCompanyId === broker.id);
              const subValue = selected?.id !== broker.id ? selected?.id ?? "" : "";
              return <SearchableSelect label="Υποασφαλιστική" value={subValue}
                onChange={v => setForm({ ...form, insuranceCompanyId: v || broker.id, vehicleUseCategory: "", coverCode: "", packageCode: "" })}
                emptyLabel="— επιλέξτε υποασφαλιστική —" options={subs.map(s => ({ value: s.id, label: s.name }))} />;
            })()}
            <SearchableSelect label="Συνεργάτης" value={form.producerId}
              onChange={v => setForm({ ...form, producerId: v })} emptyLabel="— Παραγωγή γραφείου —"
              options={(producersQuery.data ?? []).map(p => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }))}
              helperText="Κενό: παραγωγή γραφείου"
              textFieldProps={{ inputProps: { title: "Χωρίς συνεργάτη, η έδρα λαμβάνει όλη την προμήθεια της ασφαλιστικής. Με συνεργάτη, η προμήθειά του αφαιρείται από το συνολικό ποσοστό." } }} />
            <TextField size="small" label="Αριθμός συμβολαίου" value={form.policyNumber}
              onChange={e => setForm({ ...form, policyNumber: e.target.value })}
              placeholder="π.χ. P-000001" helperText="Κενό: αυτόματη αρίθμηση" fullWidth />
            <SearchableTextField select label={t("policies.col.status")} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as PolicyStatus })} fullWidth>
              {(["Prospect","Draft","AwaitingIssue","Active","Undelivered","PendingRenewal","Expired","Cancelled","Renewed"] as const).map(s =>
                <MenuItem key={s} value={s}>{s === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${s}`)}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack spacing={1.5}>
            <SearchableSelect label={t("policies.form.type")} value={form.policyType}
              onChange={v => setForm({ ...form, policyType: v as PolicyType })} required disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId ? "Επιλέξτε εταιρία πρώτα" : dialogCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              options={dialogCatalogue.branches.map(b => ({ value: b.value, label: b.label }))} />
            <SearchableSelect label="Χρήση οχήματος" value={form.vehicleUseCategory}
              onChange={v => setForm({ ...form, vehicleUseCategory: v })} disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId ? "Επιλέξτε εταιρία" : dialogCatalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="—" options={dialogCatalogue.uses.map(u => ({ value: u.value, label: u.label }))} />
            <TextField size="small" label="Αριθμός κυκλοφορίας" value={form.vehicleRegistrationPlate}
              onChange={e => setForm({ ...form, vehicleRegistrationPlate: e.target.value.toUpperCase() })}
              helperText="Αυτόματη σύνδεση με την καρτέλα οχήματος" placeholder="π.χ. ΑΒC1234" fullWidth />
            <SearchableSelect label="Κάλυψη" value={form.coverCode} onChange={v => setForm({ ...form, coverCode: v })}
              disabled={!form.insuranceCompanyId} emptyLabel="—"
              helperText={!form.insuranceCompanyId ? "Επιλέξτε εταιρία" : dialogCatalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              options={dialogCatalogue.coverages.map(c => ({ value: c.value, label: c.label }))} />
            <SearchableSelect label="Πακέτο" value={form.packageCode} onChange={v => setForm({ ...form, packageCode: v })}
              disabled={!form.insuranceCompanyId} emptyLabel="—"
              helperText={!form.insuranceCompanyId ? "Επιλέξτε εταιρία" : dialogCatalogue.packages.length === 0 ? "Δεν υπάρχουν πακέτα" : ""}
              options={dialogCatalogue.packages.map(p => ({ value: p.value, label: p.label }))} />
          </Stack>
          <Box sx={{ gridColumn: { sm: "1 / -1", md: "auto" }, display: "grid", gap: 1.5,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr)" } }}>
            <TextField size="small" type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} fullWidth required
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία έναρξης ισχύος συμβολαίου. Καθορίζει και πότε αρχίζει η προμήθεια συνεργάτη." /> }} />
            <TextField size="small" type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} fullWidth required
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία λήξης συμβολαίου. Χρησιμοποιείται στις ειδοποιήσεις ανανέωσης." /> }} />
            <TextField size="small" type="number" label="Μικτά ασφάλιστρα" value={form.premium}
              onChange={e => setForm({ ...form, premium: Number(e.target.value) })} fullWidth required
              InputProps={{ endAdornment: <InputAdornment position="end">{form.currency}<FilterHelp title="Το συνολικό μικτό ασφάλιστρο του συμβολαίου." /></InputAdornment> }} />
            <TextField size="small" type="number" label="Καθαρά ασφάλιστρα" value={form.netPremium}
              onChange={e => setForm({ ...form, netPremium: e.target.value })}
              helperText="Κενό: υπολογισμός από μικτά / κανόνες" fullWidth />
            <TextField size="small" type="number" label="Προμήθεια συνεργάτη %" value={form.specialCommissionPercent}
              onChange={e => setForm({ ...form, specialCommissionPercent: e.target.value })}
              helperText="Κενό: χρήση κανόνα προμηθειών" fullWidth />
          </Box>
        </Box>
        {(() => {
          const gross = Number(form.premium) || 0;
          const net = Number(form.netPremium) || 0;
          const tax = gross > 0 && net > 0 ? Math.max(0, gross - net) : null;
          const producerPct = Number(form.specialCommissionPercent);
          const producerAmount = form.producerId && tax !== null && producerPct > 0 ? net * producerPct / 100 : null;
          return producerAmount !== null ? <Alert severity="info" sx={{ mt: 1.5, py: .25, fontSize: 13 }}>
            <strong>Προμήθεια συνεργάτη:</strong> {producerAmount.toFixed(2)} € ({producerPct.toFixed(2)}% επί καθαρών).
            Η έδρα λαμβάνει τη διαφορά από το συνολικό ποσοστό της ασφαλιστικής.
          </Alert> : null;
        })()}
        <Box sx={{ mt: 1.5, pt: .75, borderTop: "1px solid #a9b8c8", display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "1.35fr .7fr 1fr" }, gap: .5,
          "& .MuiFormControlLabel-root": { m: 0, minWidth: 0 },
          "& .MuiFormControlLabel-label": { fontSize: 13, color: "#263f5d", fontWeight: 600 },
          "& .MuiCheckbox-root": { color: "#526c89", p: .75 }, "& .MuiCheckbox-root.Mui-checked": { color: "#087ceb" },
          "& .MuiCheckbox-root.Mui-disabled": { color: "#9baabc" },
        }}>
          <FormControlLabel control={<Checkbox checked={form.paidDirectlyToCarrier}
            onChange={e => setForm({ ...form, paidDirectlyToCarrier: e.target.checked, createReceipt: e.target.checked ? false : form.createReceipt })} />}
            label="Ο πελάτης πλήρωσε απευθείας στην ασφαλιστική" />
          <FormControlLabel control={<Checkbox checked={form.delivered}
            onChange={e => setForm({ ...form, delivered: e.target.checked })} />} label="Παραδόθηκε" />
          <FormControlLabel control={<Checkbox checked={form.createReceipt} disabled={form.paidDirectlyToCarrier}
            onChange={e => setForm({ ...form, createReceipt: e.target.checked })} />} label="Εισπράχθηκε κατά την καταχώρηση" />
          {form.createReceipt && !form.paidDirectlyToCarrier && (
            <SearchableTextField label="Τρόπος είσπραξης" value={form.paymentCollectionMethod}
              onChange={e => setForm({ ...form, paymentCollectionMethod: e.target.value })} fullWidth
              sx={{ gridColumn: { sm: "1 / -1", md: "3" }, "& .MuiOutlinedInput-root": { bgcolor: "#f8fafc", color: "#102d55", minHeight: 44 }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#7b8fa7" }, "& .MuiInputLabel-root": { color: "#263f5d" } }}>
              {(["Cash", "Card", "BankTransfer", "Cheque", "PromissoryNote", "Other"] as const).map(method =>
                <MenuItem key={method} value={method}>{({ Cash: "Μετρητά", Card: "Κάρτα", BankTransfer: "Τραπεζική μεταφορά", Cheque: "Επιταγή", PromissoryNote: "Γραμμάτιο", Other: "Άλλο" } as Record<string, string>)[method]}</MenuItem>)}
            </SearchableTextField>
          )}
        </Box>
        <Typography sx={{ mt: .5, fontSize: 12, lineHeight: 1.4, color: "#455c76" }}>
          Η είσπραξη δημιουργεί απόδειξη και κίνηση ταμείου για όλο το ασφάλιστρο. Η απευθείας πληρωμή στην ασφαλιστική δεν δημιουργεί είσπραξη γραφείου.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: "1px solid #a9b8c8", flexShrink: 0 }}>
        <Button onClick={onClose} color="error" variant="contained" startIcon={<CancelIcon />}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
      <InlineCreateCustomerDialog open={inlineCustomerCreate !== null} prefillText={inlineCustomerCreate ?? ""}
        defaultStatus={form.status === "Prospect" ? "Prospect" : "Active"} onClose={() => setInlineCustomerCreate(null)}
        onCreated={c => { setForm(prev => ({ ...prev, customerId: c.id })); customerSearch.setInput(c.displayName); setInlineCustomerCreate(null); }} />
      <InlineCreateInsuranceCompanyDialog open={inlineCarrierCreate !== null} prefillText={inlineCarrierCreate ?? ""}
        onClose={() => setInlineCarrierCreate(null)}
        onCreated={c => { setForm(prev => ({ ...prev, insuranceCompanyId: c.id, policyType: "Auto", vehicleUseCategory: "", coverCode: "", packageCode: "" })); setInlineCarrierCreate(null); }} />
    </Dialog>
  );
}

/* ====================== Renew dialog ====================== */

function RenewDialog({
  policy,
  onClose,
  onSaved
}: {
  policy: PolicyDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [renewalPremiums, setRenewalPremiums] = useState(() => renewalPremiumDefaults(policy));
  // Optional overrides for the new policy — leaving any of these blank
  // keeps the source policy's value. Covers the common «I need to tweak
  // the coverage/producer/plate before ανανέωση» flow so the operator
  // doesn't have to re-open the new policy in edit mode.
  const [producerIdOverride, setProducerIdOverride] = useState<string>("");
  const [vehicleUse, setVehicleUse] = useState<string>("");
  const [coverCode, setCoverCode] = useState<string>("");
  const [packageCode, setPackageCode] = useState<string>("");
  const [applicationNumber, setApplicationNumber] = useState<string>("");
  const [plate, setPlate] = useState<string>("");
  const [specialCommissionPercent, setSpecialCommissionPercent] = useState<string>("");
  const [showExtras, setShowExtras] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [coverageDrafts, setCoverageDrafts] = useState<{ code: string; name: string; gross: string; net: string; amount: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Carrier catalogue — drives Κάλυψη / Πακέτο / Χρήση οχήματος dropdowns
  // for the source policy's carrier so overrides stay in-parametric.
  const catalogue = useCarrierCatalogue(policy?.insuranceCompanyId ?? "");

  const sourceCoversQ = useQuery({
    queryKey: ["policy-covers-for-renewal", policy?.id],
    queryFn: async () => (await api.get<{ coverCode: string; coverName: string | null; grossPremium: number; netPremium: number; coverageAmount: number | null }[]>(`/policies/${policy!.id}/covers`)).data,
    enabled: !!policy,
  });

  const producersQ = useQuery({
    queryKey: ["producers-for-renew"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data,
    enabled: !!policy
  });

  useEffect(() => {
    if (policy) {
      const nextStart = policy.endDate;
      const nextEnd = new Date(new Date(policy.endDate).getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setRenewalPremiums(renewalPremiumDefaults(policy));
      setError(null);
      // Overrides start blank — «leave alone» is the safe default.
      setProducerIdOverride("");
      setVehicleUse("");
      setCoverCode("");
      setPackageCode("");
      setApplicationNumber("");
      setPlate("");
      setSpecialCommissionPercent("");
      setShowExtras(false);
      setReviewing(false);
      setCoverageDrafts([]);
    }
  }, [policy?.id, policy?.endDate, policy?.premium, policy?.netPremium]);

  useEffect(() => {
    if (!policy || !sourceCoversQ.data) return;
    setCoverageDrafts(sourceCoversQ.data.map(c => ({
      code: c.coverCode,
      name: c.coverName ?? c.coverCode,
      gross: String(c.grossPremium),
      net: String(c.netPremium),
      amount: c.coverageAmount == null ? "" : String(c.coverageAmount),
    })));
  }, [policy?.id, sourceCoversQ.data]);

  const coverageOptions = useMemo(() => {
    const packageCodeNormalized = packageCode.trim().toLocaleUpperCase();
    const fromCatalogue = catalogue.coverages.filter(c => !packageCodeNormalized || !c.parentCode
      || c.parentCode.toLocaleUpperCase() === packageCodeNormalized);
    const options = new Map<string, { code: string; name: string }>();
    for (const c of fromCatalogue) options.set(c.code.toLocaleUpperCase(), { code: c.code, name: c.name ?? c.label });
    for (const c of sourceCoversQ.data ?? []) if (!options.has(c.coverCode.toLocaleUpperCase()))
      options.set(c.coverCode.toLocaleUpperCase(), { code: c.coverCode, name: c.coverName ?? c.coverCode });
    for (const c of coverageDrafts) if (!options.has(c.code.toLocaleUpperCase()))
      options.set(c.code.toLocaleUpperCase(), { code: c.code, name: c.name || c.code });
    return [...options.values()];
  }, [catalogue.coverages, packageCode, sourceCoversQ.data, coverageDrafts]);

  const coverageTotals = coverageDrafts.reduce((totals, c) => ({
    gross: totals.gross + (Number(c.gross) || 0), net: totals.net + (Number(c.net) || 0),
  }), { gross: 0, net: 0 });

  const mutation = useMutation({
    mutationFn: async () => (await api.post<PolicyDto>(`/policies/${policy!.id}/renew`, {
      startDate, endDate, ...renewalPremiumPayload(renewalPremiums),
      producerId: producerIdOverride || null,
      vehicleUseCategory: vehicleUse || null,
      coverCode: coverCode.trim() || null,
      packageCode: packageCode.trim() || null,
      applicationNumber: applicationNumber.trim() || null,
      vehicleRegistrationPlate: plate.trim() || null,
      specialCommissionPercent: specialCommissionPercent.trim()
        ? Number(specialCommissionPercent)
        : null,
      coverages: coverageDrafts.length ? coverageDrafts.map(c => ({
        coverCode: c.code, coverName: c.name,
        grossPremium: Number(c.gross) || 0, netPremium: Number(c.net) || 0,
        coverageAmount: c.amount.trim() ? Number(c.amount) : null,
      })) : null,
    })).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={!!policy} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("policies.renew.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {reviewing && <Alert severity="info" sx={{ mb: 2 }}>
          Προεπισκόπηση ανανέωσης: {startDate || "—"} έως {endDate || "—"} · μικτά {renewalPremiums.gross || "0"} {policy?.currency ?? "EUR"} · καθαρά {renewalPremiums.net || "—"} · πακέτο {packageCode || "διατήρηση αρχικού"}.
          Οι πληρωμές της προηγούμενης περιόδου δεν αντιγράφονται.
        </Alert>}
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("policies.renew.body", { num: policy?.policyNumber ?? "" })}
        </Typography>
        <Stack spacing={2.5}>
          <Divider />
          <TextField type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
            value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth required
            InputProps={{ endAdornment: <FilterHelp title="Νέα ημερομηνία έναρξης — συνήθως η αμέσως επόμενη μέρα από τη λήξη του παλιού συμβολαίου." /> }} />
          <TextField type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
            value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth required
            InputProps={{ endAdornment: <FilterHelp title="Νέα ημερομηνία λήξης — συνήθως ένα έτος μετά τη νέα έναρξη." /> }} />
          <PolicyRenewalPremiumFields value={renewalPremiums} onChange={setRenewalPremiums} currency={policy?.currency ?? "EUR"} />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Καλύψεις νέας περιόδου</Typography>
            <Autocomplete
              multiple
              options={coverageOptions}
              value={coverageDrafts.map(c => ({ code: c.code, name: c.name }))}
              isOptionEqualToValue={(a, b) => a.code.toLocaleUpperCase() === b.code.toLocaleUpperCase()}
              getOptionLabel={o => `${o.name} (${o.code})`}
              onChange={(_, selected) => setCoverageDrafts(selected.map(option => {
                const current = coverageDrafts.find(c => c.code.toLocaleUpperCase() === option.code.toLocaleUpperCase());
                return current ?? { code: option.code, name: option.name, gross: "0", net: "0", amount: "" };
              }))}
              renderInput={params => <TextField {...params} label="Επιλογή καλύψεων" placeholder="Προσθήκη ή αφαίρεση κάλυψης" />}
              disabled={sourceCoversQ.isLoading}
            />
            {coverageDrafts.length > 0 && <Stack spacing={1} sx={{ mt: 1.25 }}>
              {coverageDrafts.map((cover, index) => <Stack key={cover.code} direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                <Typography sx={{ minWidth: 170, fontWeight: 700 }}>{cover.name} · {cover.code}</Typography>
                <TextField size="small" type="number" label="Μικτά" value={cover.gross} inputProps={{ min: 0, step: "0.01" }}
                  onChange={e => setCoverageDrafts(rows => rows.map((r, i) => i === index ? { ...r, gross: e.target.value } : r))} />
                <TextField size="small" type="number" label="Καθαρά" value={cover.net} inputProps={{ min: 0, step: "0.01" }}
                  onChange={e => setCoverageDrafts(rows => rows.map((r, i) => i === index ? { ...r, net: e.target.value } : r))} />
                <TextField size="small" type="number" label="Κεφάλαιο" value={cover.amount} inputProps={{ min: 0, step: "0.01" }}
                  onChange={e => setCoverageDrafts(rows => rows.map((r, i) => i === index ? { ...r, amount: e.target.value } : r))} />
              </Stack>)}
              <Typography variant="caption" color={Math.abs(coverageTotals.gross - Number(renewalPremiums.gross || 0)) < 0.01 ? "success.main" : "error.main"}>
                Σύνολο καλύψεων: μικτά {coverageTotals.gross.toFixed(2)} / {Number(renewalPremiums.gross || 0).toFixed(2)} · καθαρά {coverageTotals.net.toFixed(2)} / {Number(renewalPremiums.net || policy?.netPremium || 0).toFixed(2)}
              </Typography>
            </Stack>}
            {coverageDrafts.length === 0 && !sourceCoversQ.isLoading && <Typography variant="caption" color="text.secondary">Δεν υπάρχουν αποθηκευμένες καλύψεις στην προηγούμενη περίοδο. Μπορείτε να τις επιλέξετε από τον κατάλογο.</Typography>}
          </Box>

          <Button size="small" variant="text" onClick={() => setShowExtras(x => !x)}
            sx={{ alignSelf: "flex-start" }}>
            {showExtras ? "− Απόκρυψη επιπλέον λεπτομερειών" : "+ Επιπλέον λεπτομέρειες (καλύψεις, χρήση, προμήθεια)"}
          </Button>

          {showExtras && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Αφήστε κενό όποιο πεδίο θέλετε να παραμείνει όπως ήταν στο αρχικό συμβόλαιο.
              </Alert>
              <SearchableSelect
                label="Συνεργάτης (μεταφορά)" value={producerIdOverride}
                onChange={setProducerIdOverride}
                emptyLabel="— διατήρηση —"
                options={(producersQ.data ?? []).map(p => ({
                  value: p.id, label: p.name, hint: p.code,
                }))}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <SearchableTextField label="Χρήση οχήματος" value={vehicleUse}
                  onChange={(e) => setVehicleUse(e.target.value)} fullWidth
                  disabled={catalogue.uses.length === 0}
                  helperText={catalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά χρήσης" : ""}>
                  <MenuItem value="">— διατήρηση —</MenuItem>
                  {catalogue.uses.map(u => <MenuItem key={u.key} value={u.value}>{u.label}</MenuItem>)}
                </SearchableTextField>
                <SearchableTextField label="Κάλυψη" value={coverCode}
                  onChange={(e) => setCoverCode(e.target.value)} fullWidth
                  disabled={catalogue.coverages.length === 0}
                  helperText={catalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικές καλύψεις" : ""}>
                  <MenuItem value="">— διατήρηση —</MenuItem>
                  {catalogue.coverages.map(c => <MenuItem key={c.key} value={c.value}>{c.label}</MenuItem>)}
                </SearchableTextField>
              </Stack>
              <SearchableTextField label="Πακέτο" value={packageCode}
                onChange={(e) => setPackageCode(e.target.value)} fullWidth
                disabled={catalogue.packages.length === 0}
                helperText={catalogue.packages.length === 0 ? "Δεν υπάρχουν παραμετρικά πακέτα" : ""}>
                <MenuItem value="">— διατήρηση —</MenuItem>
                {catalogue.packages.map(p => <MenuItem key={p.key} value={p.value}>{p.label}</MenuItem>)}
              </SearchableTextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Αρ. αίτησης" fullWidth
                  value={applicationNumber}
                  onChange={(e) => setApplicationNumber(e.target.value)} />
                <TextField label="Αρ. κυκλοφορίας" fullWidth
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())} />
              </Stack>
              <TextField
                type="number" label="Ειδική προμήθεια συνεργάτη (%)"
                value={specialCommissionPercent}
                onChange={(e) => setSpecialCommissionPercent(e.target.value)}
                inputProps={{ step: "0.01", min: 0, max: 100 }}
                helperText="Παρακάμπτει την προμήθεια του CommissionRule. Άδειο = χρήση παραμετροποίησης."
                fullWidth />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={reviewing ? () => setReviewing(false) : onClose}>{reviewing ? "Πίσω στην επεξεργασία" : t("common.cancel")}</Button>
        <Button variant="contained" startIcon={<AutorenewIcon />} onClick={() => {
          if (!reviewing) { setReviewing(true); return; }
          mutation.mutate();
        }} disabled={mutation.isPending || (reviewing && coverageDrafts.length > 0 && (
          Math.abs(coverageTotals.gross - Number(renewalPremiums.gross || 0)) > 0.01
          || (!!renewalPremiums.net && Math.abs(coverageTotals.net - Number(renewalPremiums.net)) > 0.01)
        ))}>
          {mutation.isPending ? <CircularProgress size={18} /> : reviewing ? "Επιβεβαίωση ανανέωσης" : "Προεπισκόπηση ανανέωσης"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Bulk-edit dialog for the Policies table selection toolbar. Every field
 * is optional — leaving a field empty keeps its existing value on each
 * selected policy. Applies via POST /policies/bulk-update; the handler
 * validates tenant scope and skips silently for any id that isn't
 * touchable so a bad payload can't cross-tenant leak.
 */
function BulkEditDialog({
  open, onClose, selectedIds, onDone
}: {
  open: boolean; onClose: () => void; selectedIds: string[]; onDone: () => void;
}) {
  const producersQ = useQuery({
    queryKey: ["producers-for-bulk"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data,
    enabled: open
  });
  const carriersQ = useQuery({
    queryKey: ["insurance-companies-lite-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data,
    enabled: open
  });
  const [producerId, setProducerId] = useState<string>("");
  const [renewalToProducerId, setRenewalToProducerId] = useState<string>("");
  const [renewalToCarrierId, setRenewalToCarrierId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ updatedCount: number; skippedCount: number } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: async () => (await api.post<{ updatedCount: number; skippedCount: number }>(
      "/policies/bulk-update", {
        policyIds: selectedIds,
        producerId: producerId || null,
        renewalTransferToProducerId: renewalToProducerId || null,
        renewalTransferToCarrierId: renewalToCarrierId || null,
        status: status || null,
        paymentCollectionMethod: null,
      })).data,
    onSuccess: setResult,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const anyChange = producerId || renewalToProducerId || renewalToCarrierId || status;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Μαζική αλλαγή σε {selectedIds.length} συμβόλαια</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Ενημερώθηκαν {result.updatedCount} συμβόλαια
            {result.skippedCount > 0 ? `, ${result.skippedCount} παραλείφθηκαν` : ""}.
          </Alert>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          Πεδία που αφήνετε κενά δεν αλλάζουν στα επιλεγμένα συμβόλαια.
        </Alert>
        <Stack spacing={2}>
          <SearchableSelect label="Νέος συνεργάτης" value={producerId} onChange={setProducerId}
            emptyLabel="— δεν αλλάζει —"
            options={(producersQ.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <SearchableSelect label="Μεταφορά ανανέωσης · Συνεργάτης" value={renewalToProducerId} onChange={setRenewalToProducerId}
            emptyLabel="— δεν αλλάζει —"
            options={(producersQ.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <SearchableSelect label="Μεταφορά ανανέωσης · Ασφαλιστική" value={renewalToCarrierId} onChange={setRenewalToCarrierId}
            emptyLabel="— δεν αλλάζει —"
            options={(carriersQ.data ?? []).filter(c => !c.parentCompanyId).map(c => ({ value: c.id, label: c.name }))} />
          <SearchableSelect label="Κατάσταση" value={status} onChange={setStatus}
            emptyLabel="— δεν αλλάζει —"
            options={["Prospect", "Active", "Draft", "Expired", "Cancelled", "Renewed", "PendingRenewal"]
              .map(s => ({ value: s, label: s === "Prospect" ? "Πιθανό συμβόλαιο" : s }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setResult(null); setErr(null); onClose(); }} color="error" variant="contained">{result ? "Κλείσιμο" : "Άκυρο"}</Button>
        {result ? (
          <Button variant="contained" onClick={onDone}>Ανανέωση λίστας</Button>
        ) : (
          <Button variant="contained" onClick={() => bulkMutation.mutate()}
            disabled={!anyChange || bulkMutation.isPending}>
            {bulkMutation.isPending ? <CircularProgress size={18} /> : `Εφαρμογή σε ${selectedIds.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
